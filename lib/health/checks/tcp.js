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
var log = require('util/log');

var Check = require('health').Check;
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var config = {
	'name': 'TCP check',
	'required_arguments': ['ip_address', 'port', 'type'],
	'optional_arguments': ['match_value', 'command', 'timeout'],
	'default_values': {
	  'timeout': 3000
	},
	'types': {
		CONNECTION_CHECK: 0,
		RESPONSE_REGEX_MATCH: 1
	}
};

function TCPCheck(check_arguments) {
	Check.call(this, config.name, config.required_arguments, config.optional_arguments, config.default_values, check_arguments);
}

// Inherit from the base Check class
sys.inherits(TCPCheck, Check);

TCPCheck.prototype.run = function(callback) {
  log.info(sprintf('Running TCP check (IP: %s, port: %s)', this.check_arguments.ip_address, this.check_arguments.port));

	var self = this;
	var result = new CheckResult();

	connection = net.createConnection(self.check_arguments.port, self.check_arguments.ip_address);

	connection.on('connect', function() {
	  connection.setTimeout(self.check_arguments.timeout);

		if (self.check_arguments.type === config.types.CONNECTION_CHECK) {
			result.status = CheckStatus.SUCCESS;
			result.details = sprintf('Successfully established connection to IP %s port %s', self.check_arguments.ip_address,
			                  self.check_arguments.port);

			self.add_result(result, callback);
			connection.end();
		}
		else if (self.check_arguments.type === config.types.RESPONSE_REGEX_MATCH) {
			var data_buffer = [];

			if (self.check_arguments.command) {
			  connection.end(self.check_arguments.command);
			}

			connection.on('data', function(chunk) {
			  data_buffer.push(chunk);
			});

			connection.on('end', function() {
				body = data_buffer.join('');

				if (body.match(self.check_arguments.match_value)) {
          result.status = CheckStatus.SUCCESS;
          result.details = sprintf('The response body matched the regular expression: %s',
                                  self.check_arguments.match_value.toString());
        }
        else {
          result.status = CheckStatus.ERROR;
          result.details = sprintf('The response body didn\'t match the regular expression: %s',
                                   self.check_arguments.match_value.toString());
        }

        self.add_result(result, callback);
        connection.end();
			});
		}
	});

	connection.on('timeout', function() {
    connection.end();
  });

	connection.on('error', function(exception) {
	  if (self.last_run_date !== result.date) {
      result.status = CheckStatus.ERROR;
      result.details = sprintf('Check failed - returned exception: %s', exception);

      self.add_result(result, callback);
    }
  });
};

TCPCheck.prototype.format_arguments = function(required_arguments, optional_arguments, default_values, check_arguments) {
  var formatted_arguments = Check.prototype.format_arguments.call(this, required_arguments, optional_arguments, default_values,
                                                                  check_arguments);

  if (formatted_arguments.type !== config.types.CONNECTION_CHECK && formatted_arguments.type !== config.types.RESPONSE_REGEX_MATCH) {
    throw new Error(sprintf('Invalid check type: %s', formatted_arguments.type));
  }

  if (formatted_arguments.type === config.types.RESPONSE_REGEX_MATCH) {
    formatted_arguments.match_value = new RegExp(formatted_arguments.match_value);
  }

  return formatted_arguments;
};

exports.config = config;
exports.TCPCheck = TCPCheck;
