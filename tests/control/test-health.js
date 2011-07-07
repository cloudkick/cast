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

var managers = require('cast-agent/managers');
var control = require('control');
var jobs = require('jobs');


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
