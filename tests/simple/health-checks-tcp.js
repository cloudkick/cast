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

var testUtil = require('util/test');
var log = require('util/log');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var tcpCheck = require('health/checks/tcp');
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var responseDictionary = {
  'hello': {
    'type': 'string',
    'response': 'Hello World\nTesting server'
  },
  'stats (\\d+)': {
    'type': 'regexp',
    'response': function(matches) { return sprintf('KEYS %s\nEND', matches[1]); }
  }
};

exports['test_invalid_ip_address'] = function(test, assert) {
  var port = testUtil.getPort();
  var check = new tcpCheck.TCPCheck({'ip_address': '999.99.99.99', 'port': port, 'type': tcpCheck.config.types.CONNECTION_CHECK,
                                     'idle_timeout': 2000});

  check.run(function(result) {
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /domain name not found/i);

    test.finish();
  });
};

exports['test_check_connection_failure'] = function(test, assert) {
  var port = testUtil.getPort();
  var check = new tcpCheck.TCPCheck({'ip_address': '127.0.0.1', 'port': port, 'type': tcpCheck.config.types.CONNECTION_CHECK});

  check.run(function(result) {
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /(connection refused|connection timed out|ETIMEDOUT)/i);
    test.finish();
  });
};

exports['test_check_connection_timeout'] = function(test, assert) {
  var port = testUtil.getPort();
  var check = new tcpCheck.TCPCheck({'ip_address': '74.125.39.104', 'port': port, 'type': tcpCheck.config.types.CONNECTION_CHECK,
                                      'connect_timeout': 2000});

  check.run(function(result) {
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /connection timed out/i);
    test.finish();
  });
};

exports['test_check_connection_success'] = function(test, assert) {
  var port = testUtil.getPort();

  testUtil.runTestTcpServer('127.0.0.1', port, responseDictionary, true, function() {
    var self = this;
    var check = new tcpCheck.TCPCheck({'ip_address': '127.0.0.1', 'port': port, 'type': tcpCheck.config.types.CONNECTION_CHECK});

    check.run(function(result) {
      assert.equal(result.status, CheckStatus.SUCCESS);
      assert.match(result.details, /established connection to /i);

      self.close();
      test.finish();
    });
  });
};

exports['test_check_response_regex_match_error'] = function(test, assert) {
  var port = testUtil.getPort();

  var tcp_server = testUtil.runTestTcpServer('127.0.0.1', port, responseDictionary, true, function() {
    var self = this;
    var check = new tcpCheck.TCPCheck({'ip_address': '127.0.0.1', 'port': port, 'type': tcpCheck.config.types.RESPONSE_REGEX_MATCH,
                                        'match_value': /blah/i});

    check.run(function(result) {
      assert.equal(result.status, CheckStatus.ERROR);
      assert.match(result.details, /didn.?t match the regular/i);

      self.close();
      test.finish();
    });
  });
};

exports['test_check_response_regex_match_success_1'] = function(test, assert) {
  var port = testUtil.getPort();

  testUtil.runTestTcpServer('127.0.0.1', port, responseDictionary, true, function() {
    var self = this;
    var check = new tcpCheck.TCPCheck({'ip_address': '127.0.0.1', 'port': port, 'type': tcpCheck.config.types.RESPONSE_REGEX_MATCH,
                                       'command': 'hello', 'match_value': /.*hello world.*/i});

    check.run(function(result) {
      assert.equal(result.status, CheckStatus.SUCCESS);
      assert.match(result.details, /matched the regular/i);

      self.close();
      test.finish();
    });
  });
};

exports['test_check_response_regex_match_success_2'] = function(test, assert) {
  var port = testUtil.getPort();

  testUtil.runTestTcpServer('127.0.0.1', port, responseDictionary, true, function() {
    var self = this;
    var check = new tcpCheck.TCPCheck({'ip_address': '127.0.0.1', 'port': port, 'type': tcpCheck.config.types.RESPONSE_REGEX_MATCH,
                                       'command': 'stats 12345', 'match_value': /.*keys 12345.*/i});

    check.run(function(result) {
      assert.equal(result.status, CheckStatus.SUCCESS);
      assert.match(result.details, /matched the regular/i);

      self.close();
      test.finish();
    });
  });
};
