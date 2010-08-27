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
var http = require('http');
var url = require('url');

var sprintf = require('extern/sprintf').sprintf;
var log = require('util/log');

var Check = require('health').Check;
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var config = {
  'name': 'HTTP check',
  'required_arguments': ['url', 'type', 'match_value'],
  'optional_arguments': [],
  'default_values': {},
  'types': {
    STATUS_CODE_MATCH: 0,
    BODY_REGEX_MATCH: 1
  }
};

function HTTPCheck(check_arguments) {
  Check.call(this, config.name, config.required_arguments, config.optional_arguments, config.default_values, check_arguments);
}

// Inherit from the base Check class
sys.inherits(HTTPCheck, Check);

HTTPCheck.prototype.run = function(callback) {
  log.info(sprintf('Running HTTP check (URL: %s, type: %s, match_value: %s)', this.check_arguments.url, this.check_arguments.type,
                                                                              this.check_arguments.match_value));

  var self = this;
  var result = new CheckResult();
  var timeout = false;
  
  var client = http.createClient(self.check_arguments.port, self.check_arguments.host, self.check_arguments.secure);
  var request = client.request('GET', self.check_arguments.path, {'host': self.check_arguments.host});

  function error_handler(exception) {
    result.status = CheckStatus.ERROR;
    result.details = sprintf('Check failed - returned exception: %s', exception);
    
    self.add_result(result, callback);  
  }
  
  // Register generic error event handlers
  client.on('error', error_handler);
  request.on('error', error_handler);
  
  client.on('timeout', function() {
    timeout = true;
    // Close the connection, the check status is set in the client end event handler
    client.end();
  });
  
  client.on('end', function() {
    if (self.last_run_date !== result.date) {
      // If the result hasn't been added yet at this stage this means that the check has failed
      result.status = CheckStatus.ERROR;
      
      if (timeout === true) {
        result.details = sprintf('Timeout after %s seconds', self.check_arguments.timeout / 1000);
      }
      else {
        result.details = sprintf('Unknown error');
      }
      
       self.add_result(result, callback);
    }
  });
  
  // Send the request
  request.end();
  
  request.on('response', function(response) {
    if (self.check_arguments.type === config.types.STATUS_CODE_MATCH) {
      var status_code = response.statusCode;
    
      if (status_code === self.check_arguments.match_value) {
        result.status = CheckStatus.SUCCESS;
        result.details = sprintf('Returned status code: %s', status_code);
      }
      else {
        result.status = CheckStatus.ERROR;
        result.details = sprintf('Returned status code:  %s', status_code);
      }
    
      self.add_result(result, callback);
    }
    else if (self.check_arguments.type === config.types.BODY_REGEX_MATCH) {
      // We only care about the content if it's a body regex match check
      var data_buffer = [];
      
      response.on('data', function(chunk) {
        data_buffer.push(chunk);
      });
    
      response.on('end', function() {
        var body = data_buffer.join('');

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
      });
    }
  });
};

HTTPCheck.prototype.format_arguments = function(required_arguments, optional_arguments, default_values, check_arguments) {
  var formatted_arguments = Check.prototype.format_arguments.call(this, required_arguments, optional_arguments, default_values,
                                                                  check_arguments);
  var url_object = url.parse(formatted_arguments.url);
  
  formatted_arguments.host = url_object.hostname;
  formatted_arguments.path = url_object.pathname || '/';

  formatted_arguments.secure = (url_object.protocol === 'https:') || false;
  formatted_arguments.port = url_object.port || (formatted_arguments.secure === true ? 443 : 80);

  if (formatted_arguments.type === config.types.STATUS_CODE_MATCH) {
    formatted_arguments.match_value = parseInt(formatted_arguments.match_value, 10);
  }
  else if (check_arguments.type === config.types.BODY_REGEX_MATCH) {
    formatted_arguments.match_value = new RegExp(formatted_arguments.match_value);
  }
  
  return formatted_arguments;
};

exports.config = config;
exports.HTTPCheck = HTTPCheck;
