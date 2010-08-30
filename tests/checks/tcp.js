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
 
var test = require('util/test');
var log = require('util/log');

var async = require('extern/async');

var tcp_check = require('health/checks/tcp');
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var response_dictionary = {
  'hello': 'Hello World\nTesting server',
  'stats': 'KEYS 5\nKEYSIZE 2058\nEND'
};

exports['test invalid ip address'] = function(assert, beforeExit) {
  var n = 0;
  var check = new tcp_check.TCPCheck({'ip_address': '999.99.99.99', 'port': 1234, 'type': tcp_check.config.types.CONNECTION_CHECK,
                                     'timeout': 2000});
                                        
  check.run(function(result) {
    n++;
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /domain name not found/i);
  });
  
  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

exports['test check connection failure'] = function(assert, beforeExit) {
  var n = 0;
  var check = new tcp_check.TCPCheck({'ip_address': '127.0.0.1', 'port': 12314, 'type': tcp_check.config.types.CONNECTION_CHECK});
                                        
  check.run(function(result) {
    n++;
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /connection refused/i);
  });
  
  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

exports['test check connection success'] = function(assert, beforeExit) {
  var n = 0;
  
  test.run_test_tcp_server('127.0.0.1', 1212, response_dictionary, function() {
    var self = this;
    var check = new tcp_check.TCPCheck({'ip_address': '127.0.0.1', 'port': 1212, 'type': tcp_check.config.types.CONNECTION_CHECK});
                                          
    check.run(function(result) {
      n++;
      assert.equal(result.status, CheckStatus.SUCCESS);
      assert.match(result.details, /successfully established/i);
      
      self.close();
    });
  });
    
  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

exports['test check response regex match error'] = function(assert, beforeExit) {
  var n = 0;
  
  var tcp_server = test.run_test_tcp_server('127.0.0.1', 1213, response_dictionary, function() {
    var self = this;
    var check = new tcp_check.TCPCheck({'ip_address': '127.0.0.1', 'port': 1213, 'type': tcp_check.config.types.RESPONSE_REGEX_MATCH,
                                        'match_value': /blah/i});
                                          
    check.run(function(result) {
      n++;
      assert.equal(result.status, CheckStatus.ERROR);
      assert.match(result.details, /didn.?t match the regular/i);

      self.close();
    });
  });
    
  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

exports['test check response regex match success'] = function(assert, beforeExit) {
  var n = 0;
  
  test.run_test_tcp_server('127.0.0.1', 1214, response_dictionary, function() {
    var self = this;
    var check = new tcp_check.TCPCheck({'ip_address': '127.0.0.1', 'port': 1214, 'type': tcp_check.config.types.RESPONSE_REGEX_MATCH,
                                       'command': 'hello', 'match_value': /.*hello world.*/i});
                                          
    check.run(function(result) {
      n++;
      assert.equal(result.status, CheckStatus.SUCCESS);
      assert.match(result.details, /matched the regular/i);

      self.close();
    });
  });
    
  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

