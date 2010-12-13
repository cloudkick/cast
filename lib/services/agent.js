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
var worker = require('extern/node-worker');

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

  this.connection = null;
  this.restarting = false;

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
    this.connection.end();
  }
  else {
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

    // Clear the restarting flag and set connected to true
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
 * Handler for incoming data.
 *
 * @param {String} data Incoming data (protocol is line orinted, so each command / message is on a
 *                      separate line).
 */
Agent.prototype.handle_data = function(data) {
  var i, line, next_line, line_split, command;
  var command_data, command_arguments;
  var data_split = data.split('\n');
  var data_split_count = data_split.length;

  for (i = 0; i < data_split_count; i++) {
    line = misc.trim(data_split[i]);

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
      next_line = data_split[i + 1];

      if ((i + 1) >= (data_split_count - 1) || next_line.charAt(0) !== '{') {
        log.err('Missing payload for the run_check command');
        continue;
      }

      next_line = misc.trim(next_line);
      line = sprintf('%s %s', line, next_line);
      i++;
    }

    command_data = constants.INCOMING_COMMAND_MAPPING[command];

    if (command_data.args_split) {
      // Only split commands where args_split property equals true (some commands receive a single string
      // argument which can contain spaces and commands like this are not split).
      line_split = line.split(' ');
      command_arguments = line_split.splice(1);
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
 * Reset the connection backoff timer.
 */
Agent.prototype.handle_cmd_accepted = function() {
  this.connect_backoff_delay = 0;
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

  try {
    parsed_payload = JSON.parse(payload);
  }
  catch (err) {
    log.err(sprintf('Failed to parse "%s" check payload: %s', check_name, err.toString()));
    return;
  }

  // @TODO: Should probably limit the maximum number of active workers
  check_worker = worker.getWorker(constants.WORKER_CHECK_SCRIPT, { 'timeout': constants.CHECK_TIMEOUT });
  check_arguments = { 'check_name': check_name, 'payload': parsed_payload };

  check_worker.postMessage(check_arguments);

  var terminate_worker = function() {
    if (!check_worker.isTerminated()) {
      check_worker.terminate();
    }
  };

  var on_result = function(result) {
    // @TODO: send check result
    terminate_worker();
    // self.send_command('result', []);
  };

  var on_error = function(err) {
    // @TODO: send error
    terminate_worker();
    // self.send_command('result', []);
  };

  check_worker.on('message', on_result);
  check_worker.on('error', on_error);
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