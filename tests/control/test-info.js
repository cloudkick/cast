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
var agent = require('cast-agent/entry');
var control = require('control');


exports['setUp'] = function(test, assert) {
  managers.initManagers(function(err) {
    assert.ifError(err);
    agent.dateStarted = new Date();
    test.finish();
  });
};


exports['test_info'] = function(test, assert) {
  // Set a delay so the agent will have some uptime
  setTimeout(function() {
    control.info.getInfo(function(err, info) {
      assert.ifError(err);
      assert.ok(info['agent_version']);
      assert.ok(info['node_version']);
      assert.ok(info['api_version']);
      assert.ok(info['hostname']);
      assert.ok(info['architecture']);
      assert.ok(info['os']);
      assert.ok(info['memory']);
      assert.ok(info['os_uptime']);
      assert.ok(info['agent_uptime']);
      test.finish();
    });
  }, 1200);
};
