/*
 * Licensed to Cloudkick, Inc ('Cloudkick') under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * Cloudkick licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var sys = require('sys');
var net = require('net');

var sprintf = require('sprintf').sprintf;
var WorkerPool = require('worker-pool/index').worker_pool.WorkerPool;

var ps = require('util/pubsub');
var config = require('util/config');
var log = require('util/log');
var misc = require('util/misc');
var version = require('util/version');
var Errorf = require('util/misc').Errorf;

var Service = require('services').Service;
var constants = require('agent/constants');

var SERVICE_NAME = 'Cloudkick Agent';

/**
 * Agent service class.

 * @constructor
 */
function Agent() {
  Service.call(this, SERVICE_NAME);

  this._endpointPort = null;
  this._endpointHost = null;

  this._connectDelay = constants.INITIAL_CONNECT_DELAY;

  this._pingSentCount = 0;
  this._pongGotCount = 0;
  this._lastPingTime = 0;
  this._buffer = '';

  this._connection = null;
  this._reconnecting = false;
  this._restarting = false;
  this._stopped = false;

  this._pendingCommandsQueue = [];

  this._connected = false;
  this._connectTimeoutId = null;
  this._pingIntervalId = null;
}

sys.inherits(Agent, Service);

/**
 * Start the agent service.
 *
 * @param {Number} port Endpoint port.
 * @param {String} host Endpoint host.
 */
Agent.prototype.start = function(port, host) {
  Service.prototype.start.call(this);
  var conf = config.get();
  this._endpointPort = port || conf['agent_endpoint_port'];
  this._endpointHost = host || conf['agent_endpoint_host'];

  this._stopped = false;
  this.workerPool = new WorkerPool(constants.WORKER_POOL_SIZE, constants.WORKER_CHECK_SCRIPT);
  this.connectToEndpoint();
};

/**
 * Stop the service.
 */
Agent.prototype.stop = function() {
  var graceful = false;
  Service.prototype.stop.call(this);

  this._stopped = true;
  if (graceful === true) {
    // @TODO: Wait for all the active checks to finish and post the result before shuting down
    this.workerPool.terminate(true);
    this._connection.end();
  }
  else {
    this.workerPool.terminate(false);
    this._connection.end();
  }
};

/**
 * Connect to the agent endpoint.
 */
Agent.prototype.connectToEndpoint = function() {
  var self = this;

  // @TODO: Add SSL support
  this._connection = net.createConnection(this._endpointPort, this._endpointHost);

  function handleError(err) {
    log.info(sprintf('Connection to %s:%s failed, reason: %s', self._endpointHost,
                                                               self._endpointPort,
                                                               err.message));
    self.clearConnectTimeout();

    self.increaseBackoffDelay();
    self.reconnectToEndpoint();
  }

  this._connection.on('error', handleError);

  // Set connection timeout handler
  this._connectTimeoutId = setTimeout(function() {
    self.handleConnectTimeout();
  }, constants.CONNECT_TIMEOUT);

  this._connection.on('connect', function() {
    self._connection.setKeepAlive(true);
    self._connection.setNoDelay(true);

    log.info(sprintf('Connected to the endpoint %s:%s', self._endpointHost,
                                                        self._endpointPort));
    // Clear the connect timeout, reset the connection delay timer
    self.clearConnectTimeout();
    self.resetConnectDelay();

    // Clear the restarting and reconnecting flag and set connected to true
    self._reconnecting = false;
    self._restarting = false;
    self._connected = true;

    // Send the hello command
    self.sendCmdHello();

    // Set the ping interval
    self._pingIntervalId = setInterval(function() {
      self.sendCmdPing();
    }, constants.PING_INTERVAL);

    function removeAllListeners() {
      self._connection.removeAllListeners('error');
      self._connection.removeAllListeners('data');
      self._connection.removeAllListeners('end');
      self._connection.removeAllListeners('close');
    }

    function handleData(data) {
      self.handleData(data.toString());
    }

    function handleEnd(err) {
      self._connection.end();
    }

    function handleClose() {
      log.info('Endpoint closed the connection');

      // Remove all the listeners, reset ping counters and interval
      self._connected = false;
      removeAllListeners();
      self.resetPingCountersAndClearInterval();

      if (!self._restarting && !self._stopped) {
        // Increase backoff time delay and try to reconnect to the endpoint
        self.increaseBackoffDelay();
        self.reconnectToEndpoint();
      }
    }

    self._connection.on('data', handleData);
    self._connection.on('end', handleEnd);
    self._connection.on('close', handleClose);
  });
};

/**
 * Reconnect to the endpoint. If there is an active connection, destroy it.
 *
 * @param {boolean} True to reconnect immediately, otherwise wait connectDelay seconds.
 */
Agent.prototype.reconnectToEndpoint = function(now) {
  var connectDelay;
  var self = this;

  if (this._reconnecting) {
    return;
  }

  this._reconnecting = true;

  if (now === true) {
    connectDelay = 1000;
  }
  else {
    connectDelay = this._connectDelay;
  }

  if (this._connection) {
    // If there is an active connection, kill it
    this._connection.destroy();
  }

  log.info(sprintf('Reconnecting in %s seconds...', (Math.round(connectDelay / 1000))));

  this._connectTimeoutId = setTimeout(function() {
    self.connectToEndpoint();
  }, connectDelay);
};

/**
 * Log the command.
 *
 * @param  {String} command Command name.
 * @param  {String} type Command type ('incoming' or 'outgoing').
 * @return {Array} commandArguments Command arguments.
 */
Agent.prototype.logCommand = function(command, type, commandArguments) {
  var commandData, time, i, argument, value, logString;

  if (!misc.inArray(type, ['incoming', 'outgoing'])) {
    throw new Errorf('Invalid command type: %s (valid types are incoming)' +
                    ' and outgoing', type);
  }

  commandData = (type === 'incoming') ? constants.INCOMING_COMMAND_MAPPING[command] :
                                        constants.OUTGOING_COMMAND_MAPPING[command];

  time = new Date();

  var ret = [];
  for (i = 0; i < commandArguments.length; i++) {
    argument = commandData.args[i];

    if (misc.inArray(argument, commandData.dontLog)) {
      // This argument is not logged
      continue;
    }

    value = commandArguments[i];

    ret.push(sprintf('%s = %s', argument, value));
  }

  ret = ret.join(', ');
  ret = ret.replace(/%/g, '%%');
  logString = sprintf('%s %s %s (%s): %s', ((type === 'incoming') ? '<-' : '->'), type, command, time,
                       ret);
  log.info(logString);
};

/**
 * Increase the connection backoff time delay.
 */
Agent.prototype.increaseBackoffDelay = function() {
  this._connectDelay += Math.ceil(Math.random() * 2000);
};

/**
 * If not connected, increase the backoff time delay and try to re-connect.
 */
Agent.prototype.handleConnectTimeout = function() {
  if (!this._connected) {
    log.info(sprintf('Connection to %s:%s failed, reason: timeout', this._endpointHost,
                                                                    this._endpointPort));

    if (this._connection) {
      this._connection.destroy();
    }

    this.increaseBackoffDelay();
    this.reconnectToEndpoint();
  }
};

/*
 * Clear the connection timeout handler.
 *
 * This function is called after the connection is successfully established or if the connection fails
 * because of a different reason then a timeout (connection refused, etc.)
 */
Agent.prototype.clearConnectTimeout = function() {
  if (!this._connected && this._connectTimeoutId) {
    clearTimeout(this._connectTimeoutId);
  }
};

/*
 * Reset ping counters and clear the ping interval handler.
 */
Agent.prototype.resetPingCountersAndClearInterval = function() {
  this._pingSentCount = 0;
  this._pongGotCount = 0;
  this._lastPingTime = 0;

  clearInterval(this._pingIntervalId);
};

/*
 * Reset the connection backoff delay.
 *
 * This function is called after the connection is successfully established.
 */
Agent.prototype.resetConnectDelay = function() {
  this._connectDelay = constants.INITIAL_CONNECT_DELAY;
};

/*
 * Send command to the endpoint.
 *
 * @param {String} command Command name.
 * @param {Array} commandArguments Command arguments.
 */
Agent.prototype.sendCommand = function(command, commandArguments) {
  var commandData, argumentsCount, sprintfArguments, commandString;
  if (!this._connected) {
    // Queue any commands to be replayed on the next connect
    this.queueOutgoingCommand(command, commandArguments);
    return;
  }

  if (!misc.inArray(command, Object.keys(constants.OUTGOING_COMMAND_MAPPING))) {
    log.err(sprintf('Invalid command: %s', command));
    return;
  }

  commandData = constants.OUTGOING_COMMAND_MAPPING[command];

  argumentsCount = commandArguments.length;
  if (argumentsCount !== commandData.argCount) {
    log.err(sprintf('Invalid number of arguments (%s) for command %s', argumentsCount, command));
    return;
  }

  sprintfArguments = commandArguments.slice();
  sprintfArguments.unshift(commandData.command);
  commandString = sprintf.apply(null, sprintfArguments);

  try {
    this._connection.write(commandString + '\n');
  }
  catch (err) {
    // Probably "Socket not writable" error
    this.queueOutgoingCommand(command, commandArguments);
    return;
  }

  this.logCommand(command, 'outgoing', commandArguments);
};

/*
 * Add an outgoing command to the pending commands queue.
 *
 * @param {String} command Command name.
 * @param {Array} commandArguments Command arguments.
 */
Agent.prototype.queueOutgoingCommand = function(command, commandArguments) {
  if (misc.inArray(command, constants.DONT_QUEUE)) {
    return;
  }

  if (this._pendingCommandsQueue.length >= constants.COMMAND_QUEUE_SIZE) {
    this._pendingCommandsQueue.pop();
  }

  this._pendingCommandsQueue.push([command, commandArguments]);
};

/*
 * Replay commands in the pending queue.
 *
 * This is called if there are any commands in the queue after the connection with
 * the endpoint has been successfully established (received "accepted" command).
 */
Agent.prototype.replayQueuedCommands = function() {
  var i, command;
  var pendingCommandsLength = this._pendingCommandsQueue.length;

  if (pendingCommandsLength === 0) {
    // No commands in the queue
    return;
  }

  for (i = 0; i < pendingCommandsLength; i++) {
    command = this._pendingCommandsQueue.shift();
    this.sendCommand(command[0], command[1]);
  }
};

/*
 * Pop a line from the data buffer, or return false if no complete lines are
 * available.
 */
Agent.prototype.popLine = function() {
  var line = false;
  var index;

  index = this._buffer.indexOf('\n');
  if (index >= 0) {
    line = misc.trim(this._buffer.slice(0, index));
    this._buffer = this._buffer.substr(index + 1);
  }
  return line;
};

/*
 * Push a line back into the data buffer.
 *
 * @param {String} line The line (excluding \n) to be pushed.
 */
Agent.prototype.pushLine = function(line) {
  this._buffer = line + '\n' + this._buffer;
};

/*
 * Handler for incoming data.
 *
 * @param {String} data Incoming data (protocol is line orinted, so each command / message is on a
 *                      separate line).
 */
Agent.prototype.handleData = function(data) {
  var i, line, nextLine, lineSplit, command, bracePos, runCheckPayload;
  var commandData, commandArguments;

  this._buffer += data;

  while ((line = this.popLine()) !== false) {
    if (line === '') {
      continue;
    }

    lineSplit = line.split(' ');
    command = lineSplit[0];

    if (!misc.inArray(command, Object.keys(constants.INCOMING_COMMAND_MAPPING))) {
      log.err(sprintf('Received invalid line: %s', line));
      continue;
    }

    // Special case for a run_check command - payload is on a separate line (separated by a \r\n)
    if (command === 'run_check') {
      // Next line is a check payload
      nextLine = this.popLine();

      // If the payload hasn't arrived yet, push the state back into the buffer
      // and go wait for it.
      if (!nextLine) {
        this.pushLine(line);
        break;
      }

      if (nextLine.charAt(0) !== '{') {
        log.err('Missing payload for the run_check command');
        continue;
      }

      line = sprintf('%s %s', line, nextLine);
    }

    commandData = constants.INCOMING_COMMAND_MAPPING[command];

    if (commandData.argsSplit) {
      // Only split commands where args_split property equals true (some commands receive a single string
      // argument which can contain spaces and commands like this are not split).
      commandArguments = lineSplit.splice(1);

      if (command === 'run_check') {
        // Special case for run_check commands, where a payload is JSON encoded string
        bracePos = line.indexOf('{');
        runCheckPayload = line.substr(bracePos);
        commandArguments = commandArguments.concat(runCheckPayload);
      }
    }
    else {
      commandArguments = [misc.trim(line.replace(command, ''))];
    }

    this.handleCommand(command, commandArguments);
  }
};

/*
 * Run appropriate function for the incoming command.
 *
 * @param {String} command Command name.
 * @param {Array} commandArguments Command arguments.
 */
Agent.prototype.handleCommand = function(command, commandArguments) {
  var argumentCount, commandData;

  argumentCount = commandArguments.length;
  commandData = constants.INCOMING_COMMAND_MAPPING[command];

  if (argumentCount !== commandData.argCount) {
    log.err('Invalid number for arguments (%s) for command %s', argumentCount, command);
    return;
  }

  this.logCommand(command, 'incoming', commandArguments);
  commandData.handler.apply(this, commandArguments);
};

/*
 * Outgoing command handlers
 */

/*
 * Send hello command to the endpoint.
 */
Agent.prototype.sendCmdHello = function() {
  // @TODO: Read endpoint key and secret from the config?
  this.sendCommand('hello', [version.toString(), '', '']);
};

/*
 * Send ping command to the endpoint.
 */
Agent.prototype.sendCmdPing = function() {
  var currentTime = misc.getUnixTimestamp();
  var timeDiff = currentTime - this._lastPingTime;

  if ((this._pingSentCount - this._pongGotCount) >= constants.MAX_MISSED_PONGS) {
    log.info(sprintf('Failed to receive %s ping replies, restarting...',
             constants.MAX_MISSED_PONGS));
    this.reconnectToEndpoint();
    return;
  }

  this.sendCommand('ping', [misc.getUnixTimestamp()]);
  this._lastPingTime = currentTime;
  this._pingSentCount++;
};

/*
 * Incoming command handlers
 */

/*
 * Reset the connection backoff timer and replay queued commands (if any);
 */
Agent.prototype.handleCmdAccepted = function() {
  this.connectBackoffDelay = 0;

  this.replayQueuedCommands();
};

/*
 * Increase the number of received pongs.
 *
 * @param {String} pongValue Pong value (Unix time stamp which client has sent to the endpoint with the
 *                                        ping command)
 */
Agent.prototype.handleCmdPong = function(pongValue) {
  var currentTime = Math.round(new Date().getTime() / 1000);
  var timeDifference = currentTime - parseInt(pongValue, 10);

  this._pongGotCount++;
};

/*
 * Serializes the check result and prepares it to be sent over the wire.
 *
 * @param {Object} checkResult Check result.
 * @return {Array} First item is JSON encoded result object and the second item is result length.
 */
Agent.prototype.prepareResult = function(checkResult) {
  var result, resultLen;

  try {
    result = JSON.stringify(checkResult);
    resultLen = result.length;
  }
  catch (err) {
    // @TODO: Create a new check result object and try to stringify it again
  }

  return [result, resultLen];
};

/*
 * Run a check.
 *
 * @param {String} token Check token.
 * @param {String} checkName Check name.
 * @param {Number} payloadLen Payload length.
 * @param {String} payload Check payload (JSON encoded string)
 */
Agent.prototype.handleCmdRunCheck = function(token, checkName, payloadLen, payload) {
  var self = this;
  var checkArguments, parsedPayload, checkWorker;
  var temp, result, resultLen;

  try {
    parsedPayload = JSON.parse(payload);
  }
  catch (err) {
    log.err(sprintf('Failed to parse "%s" check payload: %s', checkName, err.toString()));
    return;
  }

  checkArguments = { 'check_name': checkName, 'payload': parsedPayload };
  this.workerPool.runInPool(checkArguments, { timeout: constants.CHECK_TIMEOUT },
                               function(err, worker) {
    if (!err) {
       worker.addListener('result', function(checkResult) {
        temp = self.prepareResult(checkResult);
        result = temp[0];
        resultLen = temp[1];

        self.sendCommand('result', [checkName, token, resultLen, result]);
      });

      worker.addListener('error', function(err) {
        self.sendCommand('result', [checkName, token, 0, '']);
      });

      worker.addListener('timeout', function() {
        self.sendCommand('result', [checkName, token, 0, '']);
      });
    }
  });
};

/*
 * Log the error message
 *
 * @param {String} errorMessage Error message.
 */
Agent.prototype.handleCmdError = function(errorMessage) {
  log.err(sprintf('Got error: %s', errorMessage));
};

/*
 * Restart the agent service.
 */
Agent.prototype.handleCmdRestart = function() {
  // @TODO: For now this just reconnects
  this._restarting = true;

  this.reconnectToEndpoint(true);
};

var agent = new Agent();

function load() {
  ps.on(ps.AGENT_STATE_START, function() {
    if (!agent.isRunning) {
      agent.start();
    }
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (agent.isRunning) {
      agent.stop();
    }
  });
}

/*
 * Set incoming command handlers.
 */
constants.INCOMING_COMMAND_MAPPING['accepted'].handler = Agent.prototype.handleCmdAccepted;
constants.INCOMING_COMMAND_MAPPING['run_check'].handler = Agent.prototype.handleCmdRunCheck;
constants.INCOMING_COMMAND_MAPPING['pong'].handler = Agent.prototype.handleCmdPong;
constants.INCOMING_COMMAND_MAPPING['restart'].handler = Agent.prototype.handleCmdRestart;
constants.INCOMING_COMMAND_MAPPING['error'].handler = Agent.prototype.handleCmdError;

exports.load = load;
exports.agent = agent;
exports.instance = agent;

exports._agent = Agent;
