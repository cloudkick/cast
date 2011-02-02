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

var http_check = require('health/checks/http');
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var routes = {
  '/': {'status_code': 200, 'body': ''},
  '/test1': {'status_code': 200, 'body': 'test hello world'},
  '/test2': {'status_code': 404, 'body': 'Not found'},
  '/test3': {'status_code': 202, 'body': '...<p>test 12345 content</p>...'}
};

exports['test invalid hostname'] = function(assert, beforeExit) {
  var n = 0;
  var check = new http_check.HTTPCheck({'url': 'http://non.exis-te.nt.123', 'type': http_check.config.types.STATUS_CODE_MATCH,
                                        'match_value': 200});

  check.run(function(result) {
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /returned exception/i);
    n++;
  });

  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};

// @TODO: Update the test when the SSL support is added to the http streams.
/*exports['test secure on non ssl'] = function(assert, beforeExit) {
  var port = test.get_port();
  var n = 0;

  test.run_test_http_server('127.0.0.1', port, routes, function() {
    var self = this;
    var check = new http_check.HTTPCheck({'url': 'https://127.0.0.1:'+port, 'type': http_check.config.types.STATUS_CODE_MATCH,
                                          'match_value': 200});

    check.run(function(result) {
      assert.equal(result.status, CheckStatus.ERROR);
      assert.match(result.details, /unknown/i);
      n++;

      self.close();
    });
  });

  beforeExit(function() {
    assert.equal(1, n, 'Check run callback called');
  });
};*/

exports['test check status codes match'] = function(assert, beforeExit) {
  var port = test.get_port();
  var n = 0;

  test.run_test_http_server('127.0.0.1', port, routes, function() {
    var self = this;

    var check1 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test1', 'type': http_check.config.types.STATUS_CODE_MATCH,
                                          'match_value': 200});
    var check2 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test1', 'type': http_check.config.types.STATUS_CODE_MATCH,
                                          'match_value': 404});

    async.parallel([
    function(callback) {
      check1.run(function(result) {
        assert.equal(result.status, CheckStatus.SUCCESS);
        assert.match(result.details, /returned status code/i);
        n++;

       callback();
      });
    },
    function(callback) {
      check2.run(function(result) {
        assert.equal(result.status, CheckStatus.ERROR);
        assert.match(result.details, /returned status code/i);
        n++;

       callback();
      });
    }],
    function(error) {
      self.close();
    });
  });

  beforeExit(function() {
    assert.equal(2, n, 'Check run callback called');
  });
};

exports['test check response body match'] = function(assert, beforeExit) {
  var port = test.get_port();
  var n = 0;

  test.run_test_http_server('127.0.0.1', port, routes, function() {
    var self = this;

    var check1 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test3', 'type': http_check.config.types.BODY_REGEX_MATCH,
                                          'match_value': 'some text which wont match'});
    var check2 = new http_check.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test3', 'type': http_check.config.types.BODY_REGEX_MATCH,
                                          'match_value': /.*test \d+ CONTENT.*/i});

    async.parallel([
    function(callback) {
      check1.run(function(result) {
        assert.equal(result.status, CheckStatus.ERROR);
        assert.match(result.details, /didn\'t match/i);
        n++;

       callback();
      });
    },
    function(callback) {
      check2.run(function(result) {
        assert.equal(result.status, CheckStatus.SUCCESS);
        assert.match(result.details, /matched/i);
        n++;

       callback();
      });
    }],
    function(error) {
      self.close();
    });
  });

  beforeExit(function() {
    assert.equal(2, n, 'Check run callback called');
  });
};
