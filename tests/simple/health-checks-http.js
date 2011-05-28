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

var async = require('async');

var testUtil = require('util/test');

var httpCheck = require('health/checks/http');
var CheckResult = require('health').CheckResult;
var CheckStatus = require('health').CheckStatus;

var routes = {
  '/': {'statusCode': 200, 'body': ''},
  '/test1': {'statusCode': 200, 'body': 'test hello world'},
  '/test2': {'statusCode': 404, 'body': 'Not found'},
  '/test3': {'statusCode': 202, 'body': '...<p>test 12345 content</p>...'}
};

exports['test invalid hostname'] = function(test, assert) {
  var check = new httpCheck.HTTPCheck({'url': 'http://non.exis-te.nt.123', 'type': httpCheck.config.types.STATUS_CODE_MATCH,
                                        'match_value': 200});

  check.run(function(result) {
    assert.equal(result.status, CheckStatus.ERROR);
    assert.match(result.details, /returned exception/i);
    test.finish();
  });
};

// @TODO: Update the test when the SSL support is added to the http streams.
/*exports['test secure on non ssl'] = function(test, assert) {
  var port = testUtil.getPort();

  testUtil.runTestHttpServer('127.0.0.1', port, routes, function() {
    var self = this;
    var check = new httpCheck.HTTPCheck({'url': 'https://127.0.0.1:'+port, 'type': httpCheck.config.types.STATUS_CODE_MATCH,
                                          'match_value': 200});

    check.run(function(result) {
      assert.equal(result.status, CheckStatus.ERROR);
      assert.match(result.details, /unknown/i);

    self.close();
    test.finish();
    });
  });
};*/

exports['test check status codes match'] = function(test, assert) {
  var port = testUtil.getPort();

  testUtil.runTestHttpServer('127.0.0.1', port, routes, function() {
    var self = this;

    var check1 = new httpCheck.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test1', 'type': httpCheck.config.types.STATUS_CODE_MATCH,
                                          'match_value': 200});
    var check2 = new httpCheck.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test1', 'type': httpCheck.config.types.STATUS_CODE_MATCH,
                                          'match_value': 404});

    async.parallel([
      function runCheck1(callback) {
        check1.run(function(result) {
          assert.equal(result.status, CheckStatus.SUCCESS);
          assert.match(result.details, /returned status code/i);

          callback();
        });
      },

      function runCheck2(callback) {
        check2.run(function(result) {
          assert.equal(result.status, CheckStatus.ERROR);
          assert.match(result.details, /returned status code/i);

          callback();
        });
      }
    ],

    function(error) {
      self.close();
      test.finish();
    });
  });
};

exports['test check response body match'] = function(test, assert) {
  var port = testUtil.getPort();

  testUtil.runTestHttpServer('127.0.0.1', port, routes, function() {
    var self = this;

    var check1 = new httpCheck.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test3', 'type': httpCheck.config.types.BODY_REGEX_MATCH,
                                          'match_value': 'some text which wont match'});
    var check2 = new httpCheck.HTTPCheck({'url': 'http://127.0.0.1:'+port+'/test3', 'type': httpCheck.config.types.BODY_REGEX_MATCH,
                                          'match_value': /.*test \d+ CONTENT.*/i});

    async.parallel([
      function runCheck1(callback) {
        check1.run(function(result) {
          assert.equal(result.status, CheckStatus.ERROR);
          assert.match(result.details, /didn\'t match/i);

         callback();
        });
      },

      function runCheck2(callback) {
        check2.run(function(result) {
          assert.equal(result.status, CheckStatus.SUCCESS);
          assert.match(result.details, /matched/i);

         callback();
        });
      }
    ],

    function(error) {
      self.close();
      test.finish();
    });
  });
};
