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

var manager = require('plugins').manager;

exports['test_getAvailablePlugins_success'] = function(test, assert) {
  var pluginManager = new manager.PluginManager();

  assert.deepEqual(pluginManager._availablePlugins, {});
  pluginManager.getAvailablePlugins(function(err, availablePlugins) {
    assert.ok(!err);

    assert.ok(Object.keys(availablePlugins).length === 1);
    assert.ok(availablePlugins.hasOwnProperty('cast-github'));
    test.finish();
  });
};

exports['test_getAvailablePlugins_no_plugins'] = function(test, assert) {
  test.skip();
};

exports['test_getEnabledPlugins'] = function(test, assert) {
  test.skip();
};

exports['test_getPluginSettings'] = function(test, assert) {
  test.skip();
};
