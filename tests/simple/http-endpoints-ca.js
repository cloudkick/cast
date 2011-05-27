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

var http = require('services/http');
var testUtil = require('util/test');
var testConstants = require('./../constants');

var getServer = http.getAndConfigureServer;

exports['test_ca_http_endpoint'] = function(test, assert) {
  async.series([
    function testListRequestsIsEmpty(callback) {
      var req = testUtil.getReqObject('/ca', 'GET', testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        // At the beginning there should be no requests
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, []);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
