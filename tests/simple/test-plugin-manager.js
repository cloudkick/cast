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

var async = require('async');

var config = require('util/config');
var manager = require('plugins').manager;

function loadConfig(callback) {
  config.configFiles = [
    path.join(__dirname, '../test.conf')
  ];

  config.setupAgent(callback);
}

/*
 * Utility function which loads the config before running the test.
 */
function runTest(testFunction, test) {
  async.series([
    async.apply(loadConfig),
    async.apply(testFunction)
  ],

  function(err) {
    test.finish();
  });
}

exports['test_getAvailablePlugins_success'] = function(test, assert) {
  var pluginManager = new manager.PluginManager();

  runTest(function test(callback) {
    assert.deepEqual(pluginManager._availablePlugins, {});
    pluginManager.getAvailablePlugins(function(err, availablePlugins) {
      assert.ifError(err);

      assert.ok(Object.keys(availablePlugins).length === 1);
      assert.ok(Object.keys(pluginManager._availablePlugins).length === 1);
      assert.ok(availablePlugins.hasOwnProperty('cast-github'));
      assert.ok(pluginManager._availablePlugins.hasOwnProperty('cast-github'));
      callback();
    });
  }, test);
};

exports['test_getAvailablePlugins_inexistent_directory'] = function(test,
                                                                    assert) {
  var pluginManager = new manager.PluginManager();

  runTest(function test(callback) {
    config.currentConfig['plugins']['root'] = '/some/nonexistent/directory';

    assert.deepEqual(pluginManager._availablePlugins, {});
    pluginManager.getAvailablePlugins(function(err, availablePlugins) {
      assert.ifError(err);

      assert.ok(Object.keys(availablePlugins).length === 0);
      assert.deepEqual(pluginManager._availablePlugins, {});
      callback();
    });
  }, test);
};

exports['test_getEnabledPlugins_one_enabled_plugin'] = function(test, assert) {
  var pluginManager = new manager.PluginManager();

  runTest(function test(callback) {
    pluginManager.getEnabledPlugins(function(err, enabledPlugins) {
      assert.ifError(err);

      assert.ok(Object.keys(enabledPlugins).length === 1);
      assert.ok(enabledPlugins.hasOwnProperty('cast-github'));
      assert.deepEqual(enabledPlugins, { 'cast-github': { 'foo': 'bar' }});
      callback();
    });
  }, test);
};

exports['test_getEnabledPlugins_no_enabled_plugins'] = function(test, assert) {
  var pluginManager = new manager.PluginManager();

  runTest(function test(callback) {
    config.currentConfig['plugins']['enabled'] = {};

    pluginManager.getEnabledPlugins(function(err, enabledPlugins) {
      assert.ifError(err);

      assert.ok(Object.keys(enabledPlugins).length === 0);
      callback();
    });
  }, test);
};

exports['test_getPluginManifest_plugin_does_not_exist'] = function(test, assert) {
  var pluginManager = new manager.PluginManager();

  runTest(function test(callback) {
    pluginManager.getPluginManifest('inexistent-plugin', function(err,
                                                                  pluginManifest) {
      assert.ok(err);
      assert.match(err.message, /does not exist/);
      callback();
    });
  }, test);
};

exports['test_getPluginSettings_success'] = function(test, assert) {
  var pluginManager = new manager.PluginManager();

  runTest(function test(callback) {
    pluginManager.getPluginSettings('cast-github', function(err, pluginSettings) {
      assert.ok(!err);
      assert.deepEqual(pluginSettings, { 'foo': 'bar' });
      callback();
    });
  }, test);
};

exports['test_getPluginSettings_not_enabled'] = function(test, assert) {
  var pluginManager = new manager.PluginManager();

  runTest(function test(callback) {
    pluginManager.getPluginSettings('some-not-enabled-plugins', function(err,
                                                                pluginSettings) {
      assert.ok(err);
      assert.match(err.message, /not enabled/i);
      callback();
    });
  }, test);
};
