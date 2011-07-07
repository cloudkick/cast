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

var managers = require('cast-agent/managers');
var control = require('control');
var jobs = require('jobs');

var health = require('services/health');
var Health = health.health;
var ScheduledCheck = health.ScheduledCheck;
var HTTPCheck = require('health/checks/http').HTTPCheck;


exports['setUp'] = function(test, assert) {
  managers.initManagers(function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_listChecks'] = function(test, assert) {
  control.health.listChecks(function(err, checks) {
    assert.ifError(err);
    assert.deepEqual(checks, []);
    test.finish();
  });
};

exports['test_listScheduledChecks'] = function(test, assert) {
  control.health.listScheduledChecks(function(err, checks) {
    assert.ifError(err);
    assert.deepEqual(checks, []);
    test.finish();
  });
};

exports['test_getCheck_not_found'] = function(test, assert) {
  control.health.getCheck('some-id-inexistent-id', function(err, checks) {
    assert.ok(err);
    assert.ok(err instanceof jobs.NotFoundError);
    test.finish();
  });
};

exports['test_resumeCheck_does_not_exist'] = function(test, assert) {
  control.health.resumeCheck('some-inexistent-id', function(err) {
    assert.ok(err);
    test.finish();
  });
};

exports['test_pauseCheck_does_not_exist'] = function(test, assert) {
  control.health.pauseCheck('some-inexistent-id', function(err) {
    assert.ok(err);
    test.finish();
  });
};

exports['test_addCheck_removeCheck'] = function(test, assert) {
  var check = new HTTPCheck({'url': 'http://127.0.0.1/c1', 'type': 0,
                             'match_value': 1});
  var scheduledCheck = new ScheduledCheck(check, 10000000);

  async.series([
    function addCheck(callback) {
      control.health.addCheck(scheduledCheck, false, callback);
    },

    function listChecks(callback) {
      control.health.listChecks(function(err, checks) {
        assert.equal(checks.length, 1);
        assert.equal(checks[0].id, scheduledCheck.id);
        assert.ok(!checks[0].isScheduled);
        callback();
      });
    },

    function removeCheck(callback) {
      control.health.removeCheck(scheduledCheck.id, function(err, removed) {
        assert.ifError(err);
        assert.ok(removed);
        callback();
      });
    },

    function listChecks(callback) {
      control.health.listChecks(function(err, checks) {
        assert.equal(checks.length, 0);
        callback();
      });
    },
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
