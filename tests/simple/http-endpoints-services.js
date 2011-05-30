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

var path = require('path');
var fs = require('fs');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var http = require('services/http');
var testUtil = require('util/test');
var testConstants = require('./../constants');
var ca = require('security/ca');
var fsUtil = require('util/fs');

var getServer = http.getAndConfigureServer;
var cwd = process.cwd();
var DEFAULT_REMOTE = testConstants.AVAILABLE_REMOTES['localhost_http1'];

exports['test_services_http_endpoint'] = function(test, assert) {
  var servicesPath = path.join(cwd, '.tests', 'data_root', 'services');
  var servicesEnabledPath = path.join(cwd, '.tests', 'data_root', 'services-enabled');

  async.series([
    function testListServicesReturnsError(callback) {
      // Services directory does not exist so an error should be returned
      var req = testUtil.getReqObject('/services/', 'GET', testConstants.API_VERSION);
      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 500);
        assert.match(res.body.message, /enoent/i);
        callback();
      });
    },

    function createServicesDirectories(callback) {
      async.forEachSeries([servicesPath, servicesEnabledPath], function(directory, callback) {
        fs.mkdir(directory, 0755, callback);
      }, callback);
    },

    function testListServicesIsEmpty(callback) {
      var req = testUtil.getReqObject('/services/', 'GET', testConstants.API_VERSION);
      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, []);
        callback();
      });
    },

    function testGetServiceDoesNotExist(callback) {
      var req = testUtil.getReqObject('/services/does-not-exist/', 'GET', testConstants.API_VERSION);
      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 404);
        assert.match(res.body.message, /not found/i);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
