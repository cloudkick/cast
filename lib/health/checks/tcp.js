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
var log = require('util/log');

var Check = require('health').Check;
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var config = {
  name: 'TCP check',
  requiredArguments: ['ip_address', 'port', 'type'],
  optionalArguments: ['match_value', 'command', 'connect_timeout', 'idle_timeout'],
  defaultValues: {
    'connect_timeout': 5000,
    'idle_timeout': 3000
  },
  types: {
    CONNECTION_CHECK: 0,
    RESPONSE_REGEX_MATCH: 1
  }
};

/**
 * TCP check.
 *
 * @param {Object} checkArguments Provided check arguments.
 *
 * @constructor
 */
function TCPCheck(checkArguments) {
  Check.call(this, config.name, config.requiredArguments,
             config.optionalArguments, config.defaultValues, checkArguments);
}

// Inherit from the base Check class
sys.inherits(TCPCheck, Check);

TCPCheck.prototype.run = function(callback) {
  var connectTimeoutId;
  var gotResponse = false;

  log.info(sprintf('Running TCP check (IP: %s, port: %s)',
                   this.checkArguments['ip_address'], this.checkArguments.port));

  var self = this;
  var result = new CheckResult();

  var connection = net.createConnection(self.checkArguments.port, self.checkArguments['ip_address']);

  function connectTimeout() {
    // Node doesn't allow you to set connection timeout, so the underlying file description
    // is manually destroyed if the connection cannot be established after connectTimeout
    // milliseconds.
    if (!gotResponse) {
      gotResponse = true;

      result.status = CheckStatus.ERROR;
      result.details = sprintf('Check failed - connection timed out after %s seconds',
                               (self.checkArguments['connect_timeout'] / 1000));
      self.addResult(result, callback);

      connection.destroy();
    }
  }

  function clearConnectTimeout() {
    if (!gotResponse && connectTimeoutId) {
      gotResponse = true;
      clearTimeout(connectTimeoutId);
    }
  }

  connectTimeoutId = setTimeout(connectTimeout, self.checkArguments['connect_timeout']);

  connection.on('connect', function() {
    clearConnectTimeout();
    connection.setTimeout(self.checkArguments['idle_timeout']);

    if (self.checkArguments.type === config.types.CONNECTION_CHECK) {
      result.status = CheckStatus.SUCCESS;
      result.details = sprintf('Successfully established connection to IP %s port %s',
                               self.checkArguments['ip_address'],
                               self.checkArguments.port);

      self.addResult(result, callback);
      connection.end();
    }
    else if (self.checkArguments.type === config.types.RESPONSE_REGEX_MATCH) {
      var dataBuffer = [];

      if (self.checkArguments.command) {
        connection.end(self.checkArguments.command);
      }

      connection.on('data', function(chunk) {
        dataBuffer.push(chunk);
      });

      connection.on('end', function() {
        var body = dataBuffer.join('');

        if (body.match(self.checkArguments['match_value'])) {
          result.status = CheckStatus.SUCCESS;
          result.details = sprintf('The response body matched the regular expression: %s',
                                  self.checkArguments['match_value'].toString());
        }
        else {
          result.status = CheckStatus.ERROR;
          result.details = sprintf('The response body didn\'t match the regular expression: %s',
                                   self.checkArguments['match_value'].toString());
        }

        self.addResult(result, callback);
        connection.end();
      });
    }
  });

  connection.on('timeout', function() {
    connection.end();
  });

  connection.on('error', function(exception) {
    clearConnectTimeout();

    if (self.lastRunDate !== result.date) {
      result.status = CheckStatus.ERROR;
      result.details = sprintf('Check failed - returned exception: %s', exception);

      self.addResult(result, callback);
    }
  });
};

TCPCheck.prototype.formatArguments = function(requiredArguments, optionalArguments,
                                               defaultValues, checkArguments) {
  var formattedArguments = Check.prototype.formatArguments.call(this, requiredArguments,
                                                                  optionalArguments, defaultValues,
                                                                  checkArguments);

  if (formattedArguments.type !== config.types.CONNECTION_CHECK &&
      formattedArguments.type !== config.types.RESPONSE_REGEX_MATCH) {
    throw new Error(sprintf('Invalid check type: %s', formattedArguments.type));
  }

  if (formattedArguments.type === config.types.RESPONSE_REGEX_MATCH) {
    formattedArguments['match_value'] = new RegExp(formattedArguments['match_value']);
  }

  return formattedArguments;
};

exports.config = config;
exports.TCPCheck = TCPCheck;
