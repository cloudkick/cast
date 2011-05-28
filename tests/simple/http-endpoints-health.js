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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var http = require('services/http');
var testUtil = require('util/test');
var testConstants = require('./../constants');
var health = require('services/health');
var Health = health.health;
var ScheduledCheck = health.ScheduledCheck;
var HTTPCheck = require('health/checks/http').HTTPCheck;

var getServer = http.getAndConfigureServer;
var DEFAULT_REMOTE = testConstants.AVAILABLE_REMOTES['localhost_http1'];

exports['test_health_http_endpoint'] = function(test, assert) {
  async.waterfall([
    function testListAllChecks(callback) {
      // No checks, should be empty
      var req = testUtil.getReqObject('/health', 'GET', testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        // At the beginning there should be no requests
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, []);
        callback();
      });
    },

    function testListScheduledChecks(callback) {
      // No checks, should be empty
      var req = testUtil.getReqObject('/health/scheduled/', 'GET',
                                      testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        // At the beginning there should be no requests
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, []);
        callback();
      });
    },

    function addNewCheck(callback) {
      var check = new HTTPCheck({'url': 'http://127.0.0.1/c1', 'type': 0,
                                 'match_value': 1});
      var scheduledCheck = new ScheduledCheck(check, 10000000);
      Health.addCheck(scheduledCheck, false);
      callback();
    },

    function testListAllChecksAddedCheckExists(callback) {
      var checkId;
      var req = testUtil.getReqObject('/health', 'GET', testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        // At the beginning there should be no requests
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.length, 1);
        assert.equal(res.body[0].check.checkArguments.url, 'http://127.0.0.1/c1');

        checkId = res.body[0].id;
        callback(null, checkId);
      });
    },

    function testListScheduledChecks(checkId, callback) {
      // Scheduled checks list should still, but empty because we have just
      // added a check, not schedule it yet
      var req = testUtil.getReqObject('/health/scheduled/', 'GET',
                                      testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, []);
        callback(null, checkId);
      });
    },

    function scheduleCheck(checkId, callback) {
      // Schedule our added but unscheduled check
      Health.scheduleCheck(checkId);
      callback(null, checkId);
    },

    function testCheckHasBeenScheduled(checkId, callback) {
      var req = testUtil.getReqObject('/health/scheduled/', 'GET',
                                      testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.length, 1);
        assert.equal(res.body[0].check.checkArguments.url, 'http://127.0.0.1/c1');
        callback(null, checkId);
      });
    },

    function testCheckDetails(checkId, callback) {
      var req = testUtil.getReqObject(sprintf('/health/%s/', checkId), 'GET',
                                      testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.check.checkArguments.url, 'http://127.0.0.1/c1');

        // @TODO: Expose this functionality over http
        Health.removeCheck(checkId);
        callback(null, checkId);
      });
    },

    function testCheckDetailsNotExist(checkId, callback) {
      // Verify that the check has been removed
      var req = testUtil.getReqObject(sprintf('/health/%s/', checkId), 'GET',
                                      testConstants.API_VERSION);
      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 404);
        assert.match(res.body.message, /invalid check id/i);
        callback();
      });
    },

    function testListCheckCheckHasBeenRemoved(callback) {
      var req = testUtil.getReqObject('/health', 'GET', testConstants.API_VERSION);

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
