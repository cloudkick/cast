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
  'optional_arguments': ['timeout'],
  'default_values': {
    'timeout': 500
  },
  'types': {
    STATUS_CODE_MATCH: 0,
    BODY_REGEX_MATCH: 1
  }
}

function HTTPCheck(check_arguments) {
  Check.call(this, config.name, config.required_arguments, config.optional_arguments, check_arguments);
  
  this.check_arguments = this.format_arguments(check_arguments);
}

// Inherit from the base Check class
HTTPCheck.prototype = new Check;

HTTPCheck.prototype.run = function(callback) {
  log.info('Running HTTP check');

  var self = this;
  var result = new CheckResult();
  var timeout = false;
  
  var client = http.createClient(self.check_arguments.port, self.check_arguments.host, self.check_arguments.secure);
  client.setTimeout(self.check_arguments.timeout);
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

HTTPCheck.prototype.format_arguments = function(check_arguments) {
  var url_object = url.parse(check_arguments.url);
  
  check_arguments.host = url_object.hostname;
  check_arguments.path = url_object.pathname || '/';

  check_arguments.secure = (url_object.protocol === 'https:') || false;
  check_arguments.port = url_object.port || (check_arguments.secure === true ? 443 : 80);

  if (check_arguments.type === config.types.STATUS_CODE_MATCH) {
    check_arguments.match_value = parseInt(check_arguments.match_value, 10);
  }
  else if (check_arguments.type === config.types.BODY_REGEX_MATCH) {
    check_arguments.match_value = new RegExp(check_arguments.match_value);
  }
  
  return check_arguments;
};

exports.config = config;
exports.HTTPCheck = HTTPCheck;
