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

var sprintf = require('extern/sprintf').sprintf;
var WorkerPool = require('extern/node-worker').worker_pool.WorkerPool;

var ps = require('util/pubsub');
var log = require('util/log');
var misc = require('util/misc');
var version = require('util/version');
var Errorf = require('util/misc').Errorf;

var Service = require('services').Service;
var constants = require('agent/constants');

var SERVICE_NAME = 'Cloudkick Agent';

// @TODO: Move this to the config?
var endpoint_host = 'localhost';
var endpoint_port = 4166;

/**
 * Agent service class.

 * @constructor
 */
function Agent() {
  Service.call(this, SERVICE_NAME);

  this.connect_delay = constants.INITIAL_CONNECT_DELAY;

  this.ping_sent_count = 0;
  this.pong_got_count = 0;
  this.last_ping_time = 0;
  this.buffer = '';

  this.connection = null;
  this._reconnecting = false;
  this.restarting = false;

  this.pending_commands_queue = [];

  this.connected = false;
  this.connect_timeout_id = null;
  this.ping_interval_id = null;
}

sys.inherits(Agent, Service);

/**
 * Start the agent service.
 */
Agent.prototype.start = function() {
  Service.prototype.start.call(this);

  this.worker_pool = new WorkerPool(constants.WORKER_POOL_SIZE, constants.WORKER_CHECK_SCRIPT);
  this.connect_to_endpoint();
};

/**
 * Stop the service.
 */
Agent.prototype.stop = function() {
  var graceful = false;
  Service.prototype.stop.call(this);

  if (graceful === true) {
    // @TODO: Wait for all the active checks to finish and post the result before shuting down
    this.worker_pool.terminate(true);
    this.connection.end();
  }
  else {
    this.worker_pool.terminate(false);
    this.connection.end();
  }
};

/**
 * Connect to the agent endpoint.
 */
Agent.prototype.connect_to_endpoint = function() {
  var self = this;

  // @TODO: Add SSL support
  this.connection = net.createConnection(endpoint_port, endpoint_host);

  var handle_error = function(err) {
    log.info(sprintf('Connection to %s:%s failed, reason: %s', endpoint_host, endpoint_port, err.message));
    self.clear_connect_timeout();

    self.increase_backoff_delay();
    self.reconnect_to_endpoint();
  };

  this.connection.on('error', handle_error);

  // Set connection timeout handler
  this.connect_timeout_id = setTimeout(function() {
    self.handle_connect_timeout();
  }, constants.CONNECT_TIMEOUT);

  this.connection.on('connect', function() {
    self.connection.setKeepAlive(true);
    self.connection.setNoDelay(true);

    log.info(sprintf('Connected to the endpoint %s:%s', endpoint_host,
                                                        endpoint_port));
    // Clear the connect timeout, reset the connection delay timer
    self.clear_connect_timeout();
    self.reset_connect_delay();

    // Clear the restarting and reconnecting flag and set connected to true
    self._reconnecting = false;
    self.restarting = false;
    self.connected = true;

    // Send the hello command
    self.send_cmd_hello();

    // Set the ping interval
    self.ping_interval_id = setInterval(function() {
      self.send_cmd_ping();
    }, constants.PING_INTERVAL);

    var remove_all_listeners = function() {
      self.connection.removeAllListeners('data');
      self.connection.removeAllListeners('end');
      self.connection.removeAllListeners('close');
    };

    var handle_data = function(data) {
      self.handle_data(data.toString());
    };

    var handle_end = function(err) {
      self.connection.end();
    };

    var handle_close = function() {
      log.info('Endpoint closed the connection');

      // Remove all the listeners, reset ping counters and interval
      self.connected = false;
      remove_all_listeners();
      self.reset_ping_counters_and_clear_interval();

      if (!self.restarting) {
        // Increase backoff time delay and try to reconnect to the endpoint
        self.increase_backoff_delay();
        self.reconnect_to_endpoint();
      }
    };

    self.connection.on('data', handle_data);
    self.connection.on('end', handle_end);
    self.connection.on('close', handle_close);
  });
};

/**
 * Reconnect to the endpoint. If there is an active connection, destroy it.
 *
 * @param {boolean} True to reconnect immediately, otherwise wait connect_delay seconds.
 */
Agent.prototype.reconnect_to_endpoint = function(now) {
  var connect_delay;
  var self = this;

  if (this._reconnecting) {
    return;
  }

  this._reconnecting = true;

  if (now === true) {
    connect_delay = 1000;
  }
  else {
    connect_delay = this.connect_delay;
  }

  if (this.connection) {
    // If there is an active connection, kill it
    this.connection.destroy();
  }

  log.info(sprintf('Reconnecting in %s seconds...', (Math.round(connect_delay / 1000))));

  this.connect_timeout_id = setTimeout(function() {
    self.connect_to_endpoint();
  }, connect_delay);
};

/**
 * Log the command.
 *
 * @param  {String} command Command name.
 * @param  {String} type Command type ('incoming' or 'outgoing')
 * @return {Array} command_arguments Command arguments
 */
Agent.prototype.log_command = function(command, type, command_arguments) {
  var command_data, time, i, argument, value, log_string;

  if (!misc.in_array(type, ['incoming', 'outgoing'])) {
    throw new Errorf('Invalid command type: %s (valid types are incoming)' +
                    ' and outgoing', type);
  }

  command_data = (type === 'incoming') ? constants.INCOMING_COMMAND_MAPPING[command] :
                                        constants.OUTGOING_COMMAND_MAPPING[command];

  time = new Date();

  var ret = [];
  for (i = 0; i < command_arguments.length; i++) {
    argument = command_data.args[i];

    if (misc.in_array(argument, command_data.dont_log)) {
      // This argument is not logged
      continue;
    }

    value = command_arguments[i];

    ret.push(sprintf('%s = %s', argument, value));
  }

  ret = ret.join(', ');
  ret = ret.replace(/%/g, '%%');
  log_string = sprintf('%s %s %s (%s): %s', ((type === 'incoming') ? '<-' : '->'), type, command, time,
                       ret);
  log.info(log_string);
};

/**
 * Increase the connection backoff time delay.
 */
Agent.prototype.increase_backoff_delay = function() {
  this.connect_delay += Math.ceil(Math.random() * 2000);
};

/**
 * If not connected, increase the backoff time delay and try to re-connect.
 */
Agent.prototype.handle_connect_timeout = function() {
  if (!this.connected) {
    log.info(sprintf('Connection to %s:%s failed, reason: timeout', endpoint_host, endpoint_port));

    if (this.connection) {
      this.connection.destroy();
    }

    this.increase_backoff_delay();
    this.reconnect_to_endpoint();
  }
};

/*
 * Clear the connection timeout handler.
 *
 * This function is called after the connection is successfully established or if the connection fails
 * because of a different reason then a timeout (connection refused, etc.)
 */
Agent.prototype.clear_connect_timeout = function() {
  if (!this.connected && this.connect_timeout_id) {
    clearTimeout(this.connect_timeout_id);
  }
};

/*
 * Reset ping counters and clear the ping interval handler.
 */
Agent.prototype.reset_ping_counters_and_clear_interval = function() {
  this.ping_sent_count = 0;
  this.pong_got_count = 0;
  this.last_ping_time = 0;

  clearInterval(this.ping_interval_id);
};

/*
 * Reset the connection backoff delay.
 *
 * This function is called after the connection is successfully established.
 */
Agent.prototype.reset_connect_delay = function() {
  this.connect_delay = constants.INITIAL_CONNECT_DELAY;
};

/*
 * Send command to the endpoint.
 *
 * @param {String} command Command name.
 * @param {Array} command_arguments Command arguments.
 */
Agent.prototype.send_command = function(command, command_arguments) {
  var command_data, arguments_count, sprintf_arguments, command_string;

  if (!this.connected) {
    // Queue any commands to be replayed on the next connect
    this.queue_outgoing_command(command, command_arguments);
    return;
  }

  if (!misc.in_array(command, Object.keys(constants.OUTGOING_COMMAND_MAPPING))) {
    log.err(sprintf('Invalid command: %s', command));
    return;
  }

  command_data = constants.OUTGOING_COMMAND_MAPPING[command];

  arguments_count = command_arguments.length;
  if (arguments_count !== command_data.arg_count) {
    log.err(sprintf('Invalid number of arguments (%s) for command %s', arguments_count, command));
    return;
  }

  sprintf_arguments = command_arguments.slice();
  sprintf_arguments.unshift(command_data.command);
  command_string = sprintf.apply(null, sprintf_arguments);
  this.connection.write(command_string + '\n');

  this.log_command(command, 'outgoing', command_arguments);
};

/*
 * Add an outgoing command to the pending commands queue.
 *
 * @param {String} command Command name.
 * @param {Array} command_arguments Command arguments.
 */
Agent.prototype.queue_outgoing_command = function(command, command_arguments) {
  if (misc.in_array(command, constants.DONT_QUEUE)) {
    return;
  }

  if (this.pending_commands_queue.length >= constants.COMMAND_QUEUE_SIZE) {
    this.pending_commands_queue.pop();
  }

  this.pending_commands_queue.push([ command, command_arguments ]);
};

/*
 * Replay commands in the pending queue.
 *
 * This is called if there are any commands in the queue after the connection with
 * the endpoint has been successfully established (received "accepted" command).
 */
Agent.prototype.replay_queued_commands = function() {
  var i, command;
  var pending_commands_length = this.pending_commands_queue.length;

  if (pending_commands_length === 0) {
    // No commands in the queue
    return;
  }

  for (i = 0; i < pending_commands_length; i++) {
    command = this.pending_commands_queue.shift();
    this.send_command(command[0], command[1]);
  }
};

/*
 * Pop a line from the data buffer, or return false if no complete lines are
 * available.
 */
Agent.prototype.pop_line = function() {
  var line = false;
  var index;

  index = this.buffer.indexOf('\n');
  if (index >= 0) {
    line = misc.trim(this.buffer.slice(0, index));
    this.buffer = this.buffer.substr(index + 1);
  }
  return line;
};

/*
 * Push a line back into the data buffer.
 *
 * @param {String} line The line (excluding \n) to be pushed.
 */
Agent.prototype.push_line = function(line) {
  this.buffer = line + '\n' + this.buffer;
};

/*
 * Handler for incoming data.
 *
 * @param {String} data Incoming data (protocol is line orinted, so each command / message is on a
 *                      separate line).
 */
Agent.prototype.handle_data = function(data) {
  var i, line, next_line, line_split, command, brace_pos, run_check_payload;
  var command_data, command_arguments;

  this.buffer += data;

  while ((line = this.pop_line()) !== false) {
    if (line === '') {
      continue;
    }

    line_split = line.split(' ');
    command = line_split[0];

    if (!misc.in_array(command, Object.keys(constants.INCOMING_COMMAND_MAPPING))) {
      log.err(sprintf('Received invalid line: %s', line));
      continue;
    }

    // Special case for a run_check command - payload is on a separate line (separated by a \r\n)
    if (command === 'run_check') {
      // Next line is a check payload
      next_line = this.pop_line();

      // If the payload hasn't arrived yet, push the state back into the buffer
      // and go wait for it.
      if (!next_line) {
        this.push_line(line);
        break;
      }

      if (next_line.charAt(0) !== '{') {
        log.err('Missing payload for the run_check command');
        continue;
      }

      line = sprintf('%s %s', line, next_line);
    }

    command_data = constants.INCOMING_COMMAND_MAPPING[command];

    if (command_data.args_split) {
      // Only split commands where args_split property equals true (some commands receive a single string
      // argument which can contain spaces and commands like this are not split).
      command_arguments = line_split.splice(1);

      if (command === 'run_check') {
        // Special case for run_check commands, where a payload is JSON encoded string
        brace_pos = line.indexOf('{');
        run_check_payload = line.substr(brace_pos);
        command_arguments = command_arguments.concat(run_check_payload);
      }
    }
    else {
      command_arguments = [ misc.trim(line.replace(command, '')) ];
    }

    this.handle_command(command, command_arguments);
  }
};

/*
 * Run appropriate function for the incoming command.
 *
 * @param {String} command Command name.
 * @param {Array} command_arguments Command arguments.
 */
Agent.prototype.handle_command = function(command, command_arguments) {
  var argument_count, command_data;

  argument_count = command_arguments.length;
  command_data = constants.INCOMING_COMMAND_MAPPING[command];

  if (argument_count !== command_data.arg_count) {
    log.err('Invalid number for arguments (%s) for command %s', argument_count, command);
    return;
  }

  Agent.prototype.log_command(command, 'incoming', command_arguments);
  command_data.handler.apply(this, command_arguments);
};

/*
 * Outgoing command handlers
 */

/*
 * Send hello command to the endpoint.
 */
Agent.prototype.send_cmd_hello = function() {
  // @TODO: Read endpoint key and secret from the config?
  this.send_command('hello', [ version.toString(), '', '' ]);
};

/*
 * Send ping command to the endpoint.
 */
Agent.prototype.send_cmd_ping = function() {
  var current_time = misc.get_unix_timestamp();
  var time_diff = current_time - this.last_ping_time;

  if ((this.ping_sent_count - this.pong_got_count) >= constants.MAX_MISSED_PONGS) {
    log.info(sprintf('Failed to receive %s ping replies, restarting...',
             constants.MAX_MISSED_PONGS));
    this.reconnect_to_endpoint();
    return;
  }

  this.send_command('ping', [ misc.get_unix_timestamp() ]);
  this.last_ping_time = current_time;
  this.ping_sent_count++;
};

/*
 * Incoming command handlers
 */

/*
 * Reset the connection backoff timer and replay queued commands (if any);
 */
Agent.prototype.handle_cmd_accepted = function() {
  this.connect_backoff_delay = 0;

  this.replay_queued_commands();
};

/*
 * Increase the number of received pongs.
 *
 * @param {String} pong_value Pong value (Unix time stamp which client has sent to the endpoint with the
 *                                        ping command)
 */
Agent.prototype.handle_cmd_pong = function(pong_value) {
  var current_time = Math.round(new Date().getTime() / 1000);
  var time_difference = current_time - parseInt(pong_value, 10);

  this.pong_got_count++;
};

/*
 * Serializes the check result and prepares it to be sent over the wire.
 *
 * @param {Object} check_result Check result.
 * @return {Array} First item is JSON encoded result object and the second item is result length.
 */
Agent.prototype.prepare_result = function(check_result) {
  var result, result_len;

  try {
    result = JSON.stringify(check_result);
    result_len = result.length;
  }
  catch (err) {
    // @TODO: Create a new check result object and try to stringify it again
  }

  return [ result, result_len ];
};

/*
 * Run a check.
 *
 * @param {String} token Check token.
 * @param {String} check_name Check name.
 * @param {Number} payload_len Payload length.
 * @param {String} payload Check payload (JSON encoded string)
 */
Agent.prototype.handle_cmd_run_check = function(token, check_name, payload_len, payload) {
  var self = this;
  var check_arguments, parsed_payload, check_worker;
  var temp, result, result_len;

  try {
    parsed_payload = JSON.parse(payload);
  }
  catch (err) {
    log.err(sprintf('Failed to parse "%s" check payload: %s', check_name, err.toString()));
    return;
  }

  check_arguments = { 'check_name': check_name, 'payload': parsed_payload };
  this.worker_pool.run_in_pool(check_arguments, { timeout: constants.CHECK_TIMEOUT },
                               function(err, worker) {
    if (!err) {
       worker.addListener('result', function(check_result) {
        temp = self.prepare_result(check_result);
        result = temp[0];
        result_len = temp[1];

        self.send_command('result', [ check_name, token, result_len, result ]);
      });

      worker.addListener('error', function(err) {
        self.send_command('result', [ check_name, token, 0, '' ]);
      });

      worker.addListener('timeout', function() {
        self.send_command('result', [ check_name, token, 0, '' ]);
      });
    }
  });
};

/*
 * Log the error message
 *
 * @param {String} error_message Error message.
 */
Agent.prototype.handle_cmd_error = function(error_message) {
  log.err(sprintf('Got error: %s', error_message));
};

/*
 * Restart the agent service.
 */
Agent.prototype.handle_cmd_restart = function() {
  // @TODO: For now this just reconnects
  this.restarting = true;

  this.reconnect_to_endpoint(true);
};

var agent = new Agent();

var load = function() {
  function start_agent() {
    agent.start();

    ps.emit('cast.agent.services.agent.started');
    log.info('cloudkick agent service started');
  }

  function stop_agent() {
    agent.stop();

    ps.emit('cast.agent.services.agent.stopped');
    log.info('cloudkick agent service stopped');
  }

  ps.on(ps.AGENT_STATE_START, function() {
    if (!agent.is_running) {
      start_agent();
    }
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (agent.is_running) {
      stop_agent();
    }
  });
};

/*
 * Set incoming command handlers.
 */
constants.INCOMING_COMMAND_MAPPING.accepted.handler = Agent.prototype.handle_cmd_accepted;
constants.INCOMING_COMMAND_MAPPING.run_check.handler = Agent.prototype.handle_cmd_run_check;
constants.INCOMING_COMMAND_MAPPING.pong.handler = Agent.prototype.handle_cmd_pong;
constants.INCOMING_COMMAND_MAPPING.restart.handler = Agent.prototype.handle_cmd_restart;
constants.INCOMING_COMMAND_MAPPING.error.handler = Agent.prototype.handle_cmd_error;

exports.load = load;
exports.agent = agent;
