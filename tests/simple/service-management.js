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

var serviceManagement = require('service_management');
var runitTemplates = require('service_management/runit/templates/base');

var manager = serviceManagement.getManager('runit').getManager();

exports['test_run_action_invalid_action'] = function(test, assert) {
  manager.runAction('service1', 'invalidAction', function(err) {
    assert.ok(err);
    assert.match(err.message, /invalid action/i);
    test.finish();
  });
};

exports['test_runit_buildRunFile'] = function(test, assert) {
  var result1 = runitTemplates.buildRunFile('/usr/bin/node server.js', '/opt/test', true);
  var result2 = runitTemplates.buildRunFile('/usr/bin/node server.js', '/opt/test', false);
  var result3 = runitTemplates.buildRunFile('/usr/bin/node server.js', null, false);

  assert.equal(result1, '#!/bin/bash\ncd "/opt/test" ; exec /usr/bin/node server.js 2>&1');
  assert.equal(result2, '#!/bin/bash\ncd "/opt/test" ; exec /usr/bin/node server.js');
  assert.equal(result3, '#!/bin/bash\nexec /usr/bin/node server.js');
  test.finish();
};
