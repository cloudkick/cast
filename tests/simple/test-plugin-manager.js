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
var constants = require('constants');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var config = require('util/config');
var version = require('util/version');

var plugins = require('plugins');
var httpServerService = require('services/http').instance;
var mocks = require('../mocks');

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
  var pluginManager = new plugins.manager.PluginManager();

  runTest(function test(callback) {
    assert.deepEqual(pluginManager._availablePlugins, {});
    pluginManager.getAvailablePlugins(function(err, availablePlugins) {
      assert.ifError(err);

      assert.ok(Object.keys(availablePlugins).length === 2);
      assert.ok(Object.keys(pluginManager._availablePlugins).length === 2);
      assert.ok(availablePlugins.hasOwnProperty('cast-github'));
      assert.ok(pluginManager._availablePlugins.hasOwnProperty('cast-github'));
      callback();
    });
  }, test);
};

exports['test_getAvailablePlugins_inexistent_directory'] = function(test,
                                                                    assert) {
  var pluginManager = new plugins.manager.PluginManager();

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
  var pluginManager = new plugins.manager.PluginManager();

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
  var pluginManager = new plugins.manager.PluginManager();

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
  var pluginManager = new plugins.manager.PluginManager();

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
  var pluginManager = new plugins.manager.PluginManager();

  runTest(function test(callback) {
    pluginManager.getPluginSettings('cast-github', function(err, pluginSettings) {
      assert.ok(!err);
      assert.deepEqual(pluginSettings, { 'foo': 'bar' });
      callback();
    });
  }, test);
};

exports['test_getPluginSettings_not_enabled'] = function(test, assert) {
  var pluginManager = new plugins.manager.PluginManager();

  runTest(function test(callback) {
    pluginManager.getPluginSettings('some-not-enabled-plugins', function(err,
                                                                pluginSettings) {
      assert.ok(err);
      assert.match(err.message, /not enabled/i);
      callback();
    });
  }, test);
};

exports['test_isSupported'] = function(test, assert) {
  var currentVersion = sprintf('%s.%s.%s', version.MAJOR, version.MINOR,
                                version.PATCH);
  var constraint1 = {};
  var constraint2 = { 'agent_version': '> 0.1.0'};
  var constraint3 = { 'agent_version': currentVersion };
  var constraint4 = { 'agent_version': '> 999.999.0'};

  var pluginManager = new plugins.manager.PluginManager();

  assert.ok(pluginManager.isSupported(constraint1));
  assert.ok(pluginManager.isSupported(constraint2));
  assert.ok(pluginManager.isSupported(constraint3));
  assert.ok(!pluginManager.isSupported(constraint4));

  test.finish();
};

exports['test_discoverServices_inexistent_plugins_directory'] = function(test,
                                                                         assert) {
  plugins.services.discoverServices('/some/inexistent/dir', function(err,
                                                                     services) {
    assert.ok(err);
    assert.ok(err.errno, constants.ENOENT);
    test.finish();
  });
};

exports['test_discoverServices_inexistent_services_directory'] = function(test,
                                                                          assert) {
  var pluginPath = path.join(__dirname, '../data/plugins/cast-broken');

  plugins.services.discoverServices(pluginPath, function(err, services) {
    assert.ifError(err);
    assert.deepEqual(services, {});
    test.finish();
  });
};

exports['test_discoverServices_success'] = function(test, assert) {
  var pluginPath = path.join(__dirname, '../data/plugins/cast-github');

  plugins.services.discoverServices(pluginPath, function(err, services) {
    assert.ifError(err);
    assert.ok(services.hasOwnProperty('foo'));
    test.finish();
  });
};

exports['test_discoverEndpoints_inexistent_plugins_directory'] = function(test,
                                                                        assert) {
  plugins.http.discoverEndpoints('/some/inexistent/dir', function(err,
                                                                  routes) {
    assert.ok(err);
    assert.ok(err.errno, constants.ENOENT);
    test.finish();
  });
};

exports['test_discoverEndpoints_inexistent_services_directory'] = function(test,
                                                                           assert) {
  var pluginPath = path.join(__dirname, '../data/plugins/cast-broken');

  plugins.http.discoverEndpoints(pluginPath, function(err, routes) {
    assert.ifError(err);
    assert.deepEqual(routes, {});
    test.finish();
  });
};

exports['test_discoverEndpoints_success'] = function(test, assert) {
  var pluginPath = path.join(__dirname, '../data/plugins/cast-github');

  plugins.http.discoverEndpoints(pluginPath, function(err, routes) {
    assert.ifError(err);
    assert.ok(routes.hasOwnProperty('route1'));
    assert.equal(routes['route1'].length, 1);
    assert.equal(routes['route1'][0].length, 3); // Each route must be a triple
    test.finish();
  });
};

exports['test_validatePluginSettings'] = function(test, assert) {
  var pluginManager = new plugins.manager.PluginManager();

  var manifest = {
    'settings': {
      'username': {
        'type': 'string'
      },

      'retry_delay': {
        'type': 'number'
      }
    }
  };

  var validSettings = [
    { 'username': 'foobar',
      'retry_delay': 100 },
    { 'username': 'foobar',
      'retry_delay': new Number(100) }
  ];

  var invalidSettings = [
    { 'username': 1111,
      'retry_delay': 100 },
    { 'username': [],
      'retry_delay': 100 },
    { 'username': 'test',
      'retry_delay': {} },
  ];

  async.parallel([
    function testValidSettings(callback) {
      async.forEach(validSettings, function(settings, callback) {
        pluginManager.validatePluginSettings(manifest, settings, function(err) {
          assert.ifError(err);
          callback();
        });
      }, callback);
    },

    function testInvalidSettings(callback) {
      async.forEach(invalidSettings, function(settings, callback) {
        pluginManager.validatePluginSettings(manifest, settings, function(err) {
          assert.ok(err);
          callback();
        });
      }, callback);
    }
  ],

  function(err) {
    test.finish();
  });
};

exports['test_enablePlugin_already_enabled'] = function(test, assert) {
  var pluginManager = new plugins.manager.PluginManager();

  pluginManager._enabledPlugins = { 'foobar': {} };
  pluginManager.enablePlugin('foobar', function(err) {
    assert.ok(err);
    assert.match(err.message, /already enabled/i);
    test.finish();
  });
};

exports['test_enablePlugin_plugin_does_not_exist'] = function(test, assert) {
  var pluginManager = new plugins.manager.PluginManager();

  pluginManager.enablePlugin('barfoodoesntexist', function(err) {
    assert.ok(err);
    assert.match(err.message, /is not enabled/i);
    test.finish();
  });
};

exports['test_enablePlugin_with_endpoints_and_services_success'] =
                                                       function(test, assert) {
  test.skip('todo');
  var pluginManager = new plugins.manager.PluginManager();

  pluginManager.enablePlugin('cast-github', function(err) {
    console.log('err: ' + err);
    console.log(pluginManager._enabledPlugins);
    test.finish();
  });

  test.finish();
};

exports['test__registerPluginEndpoints'] = function(test, assert) {
  var httpServerRegisteredPaths = [];
  var expectedRegisteredPaths = [
    path.join(plugins.constants.HTTP_ENDPOINT_PREFIX, '/foo/bar1'),
    path.join(plugins.constants.HTTP_ENDPOINT_PREFIX, '/foo/bar2'),
    path.join(plugins.constants.HTTP_ENDPOINT_PREFIX, '/foo/bar3'),
  ];

  function middleware(next) {
    next();
  }

  function handler(path, req, res) {
    res.writeHead(200, {});
    res.end(path);
  }

  function registerHandler(path, middleware, handler) {
    httpServerRegisteredPaths.push(path[0]);
  }

  httpServerService._server = mocks.getMockHttpServer(registerHandler);

  var routes = [
    [''], // Invalid route, should be ignored
    ['get', '/foo/bar1', async.apply('/foo/bar1') ],
    ['get', '/foo/bar2', async.apply('/foo/bar2') ],
    // route with middleware
    ['get', '/foo/bar3', middleware, async.apply('/foo/bar3') ]
  ];

  var pluginManager = new plugins.manager.PluginManager();
  var registeredPaths = pluginManager._registerPluginEndpoints(routes);
  assert.deepEqual(registeredPaths, expectedRegisteredPaths);

  test.finish();
};

exports['test_disablePlugin_plugin_does_not_exist'] = function(test, assert) {
  var pluginManager = new plugins.manager.PluginManager();

  pluginManager.disablePlugin('barfoodoesntexist', function(err) {
    assert.ok(err);
    assert.match(err.message, /is not enabled/i);
    test.finish();
  });
};
