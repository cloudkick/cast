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


exports['setUp'] = function(test, assert) {
  managers.initManagers(function(err) {
    assert.ifError(err);
    test.finish();
  });
};


exports['test_facts'] = function(test, assert) {
  control.facts.getFacts(function(err, facts) {
    assert.ifError(err);
    assert.ok(facts.hostname);
    assert.ok(facts.arch);
    assert.ok(facts.gnutar);
    assert.ok(facts.username);
    test.finish();
  });
};
