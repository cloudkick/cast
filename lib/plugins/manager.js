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
var sprintf = require('sprintf').sprintf;
var express = require('express');

var config = require('util/config');
var log = require('util/log');
var fsUtil = require('util/fs');
var misc = require('util/misc');
var Errorf = misc.Errorf;

var constants = require('constants');
var httpServer = require('services/http').instance;
var pluginConstants = require('plugins/constants');
var pluginsHttpUtils = require('plugins/http');
var pluginServicesUtils = require('plugins/services');

function PluginManager() {
  this._availablePlugins = {};
  this._enabledPlugins = {};
}

/**
 * Return name of all the the available plugins (all the plugins which are located
 *  in the plugins directory).
 * @param {Function} callback Callback called with (err, availablePlugins)
 */
PluginManager.prototype.getAvailablePlugins = function(callback) {
  fsUtil.getMatchingFiles(config.get()['plugins']['root'], '.js$', null,
                          function(err, files) {
    if (err && err.errno !== constants.ENOENT) {
      callback(err);
      return;
    }

    files = files || [];
    files = files.map(function(file) {
      return file.replace(/\.js$/, '');
    });

    callback(null, files);
  });
};

/**
 * Return an object with the enabled plugins and their settings.
 * @param {Function} callback Callback called with (err, enabledPlugins)
 */
PluginManager.prototype.getEnabledPlugins = function(callback) {
  callback(null, config.get()['plugins']['enabled']);
};

/**
 * Read "plugins" part from the settings file and load all the enabled plugins.
 *
 * @param {Function} callback Callback called when the initialization completes.
 */
PluginManager.prototype._initialize = function(callback) {
  var self = this;
  var pluginName, pluginSettings;
  var confPlugins = config.get()['plugins'] || {};
  var enabledPlugins = confPlugins['enabled'];
  var enabledPluginNames = Object.keys(enabledPlugins);

  if (!enabledPlugins) {
    log.info('No plugins have been enabled');
    return;
  }

  async.forEach(enabledPluginNames, function(pluginName, callback) {
    var pluginSettings = enabledPlugins[pluginName];
    self._validatePluginSettings(pluginName, pluginSettings, function onValidated(err) {
      if (err) {
        log.error('Failed to validate plugin "%s" settings: %s', pluginName, err);
        callback();
        return;
      }

      // Load and enable the plugin
      log.info(sprintf('Enabling plugin "%s"', pluginName));
      self.enablePlugin(pluginName, callback);
    });
  }, callback);
};

/**
 * Validate plugin settings. Validation rules are defined by plugin author in
 * the plugin package.json file.
 *
 * @param {String} pluginName Plugin name.
 * @param {Object} pluginSettings Plugin settings.
 */
PluginManager.prototype.validatePluginSettings = function(pluginName,
                                                          pluginSettings,
                                                          callback) {
  // @TODO: Cache available plugins in this._availablePlugins dictionary
  var self = this;
  var pluginPath = path.join(config.get()['plugins']['root'], pluginName);

  async.waterfall([
    function readPluginManifest(callback) {
      self._readPluginManifest(pluginPath, callback);
    },

    function validatePluginSettings(manifest, callback) {
      var rules = manifest['settings'];
      // @TODO: Use validators from manifest/...
      callback();
    }
  ],

  function(err) {
    callback(err);
  });
};

/**
 * Read plugin manifest file.
 *
 * @param {String} pluginPath Path to the plugin directory.
 * @param {Function} callback Callback called with (err, data)
 */
PluginManager.prototype._readPluginManifest = function(pluginPath, callback) {
  var manifestPath = path.join(pluginPath, pluginConstants.PLUGIN_MANIFEST_NAME);
  fsUtil.jsonFile(manifestPath, callback);
};

/*
 * Enable a plugin and does the following;
 * - Register plugin HTTP endpoints
 * - Register and load plugin services
 * - Register plugin job manager
 * @param {String} pluginName Plugin name.
 * @param {Function} callback Callback called with (err)
 */
PluginManager.prototype.enablePlugin = function(pluginName, callback) {
  var self = this;
  var pluginEndpointPaths = [], pluginServices = [];
  var ops = [];

  var pluginPath = path.join(config.get()['plugins']['root'], pluginName);

  if (misc.inArray(pluginName, Object.keys(this._enabledPlugins))) {
    callback(new Errorf('Plugin "%s" is already enabled'));
    return;
  }

  // Register HTTP endpoints
  function registerHttpEndpoints(endpointRoutes, callback) {
    async.forEach(endpointRoutes, function(endpointRoute, callback) {
      var registeredPaths = self._registerPluginEndpoints(endpointRoute, callback);
      pluginEndpointPaths = pluginEndpointPaths.concat(registeredPaths);
    }, callback);
  }

  // Register and start services
  function registerAndStartServices(services, callback) {
    async.forEach(services, function(service, callback) {
      // pluginServices.push(service.name);
      service.start();
      callback();
    }, callback);
  }

  // Discover all the resources (endpoints, services, jobs) and decide what needs
  // to be done
  async.paralell([
    function discoverHttpEndpoints(callback) {
      pluginsHttpUtils.discoverEndpoints(pluginPath, function onDiscover(err, routes) {
        if (!err && routes) {
          ops.push(async.apply(registerHttpEndpoints, routes));
        }

        callback();
      });
    },

    function discoverServices(callback) {
      pluginServicesUtils.discoverServices(pluginPath, function onDiscover(err, services) {
        if (!err && services) {
          ops.push(async.apply(registerAndStartServices, services));
        }

        callback();
      });
    }

    // @TODO: Discover and register jobs
  ],

  function(err) {
    async.parallel(ops, callback);
  });

  this._enabledPlugins[pluginName] = {
    'endpoints': pluginEndpointPaths, // Store full paths of the plugin endpoints
    'services': pluginServices, // Store names of the plugin services
    'jobs': [] // Store names of the plugin jobs
  };
};

/**
 * Register plugin HTTP endpoint handler with the Cast HTTP server.
 *
 * @param {Array} endpointRoutes Routes array (method, path, middleware, ..., handler)
 * @return {Array} All the paths which have been successfully registered.
 */
PluginManager.prototype._registerPluginEndpoints = function(endpointRoutes) {
  var i, len, route, routeArgsLen, method, path, fullPath, middleware, handler;
  var registerMethod, args;
  var registeredPaths = [];

  for (i = 0, len = endpointRoutes.length; i < len; i++) {
    route = endpointRoutes[i];
    routeArgsLen = route.length;

    if (routeArgsLen < 3) {
      // Invalid route, should we throw?
      continue;
    }

    method = route[0].toLowerCase();
    path = route[1];
    fullPath = sprintf('%s/%s', pluginConstants.HTTP_ENDPOINT_PREFIX, path);

    // Actually register it
    args = [];
    if (routeArgsLen === 3) {
      // No middleware
      middleware = [];
    }
    else {
      middleware = route.splice(2, routeArgsLen - 1);
    }

    handler = route[3];
    registerMethod = httpServer[method];

    if (middleware) {
      args.push(path);
      args = args.concat(middleware);
      args.push(handler);
    }
    else {
      args = [ path, handler ];
    }

    // @TODO: Handle possible error
    registerMethod.apply(httpServer, args);
    registeredPaths.push(fullPath);
  }
};

/**
 * Disable a plugin.
 *
 * @param {String} pluginName Plugin name.
 * @param {Function} callback Callback called with ()
 */
PluginManager.prototype.disablePlugin = function(pluginName, callback) {
  var i, len;
  if (!misc.inArray(pluginName, Object.keys(this._enabledPlugins))) {
    callback(new Errorf('Plugin "%s" is not enabled'));
    return;
  }

  var plugin = this._enabledPlugins[pluginName];

  async.series([
    // Remove all the plugin HTTP endpoints
    function removeHttpEndpoints(callback) {
      var endpoint;
      var endpoints = plugin['endpoints'];

      for (i = 0, len = endpoints.length; i < len; i++) {
        endpoint = endpoints[i];
        httpServer.remove(endpoint);
      }

      callback();
    },

    // Stop all the services
    function stopAndUnregisterServices(callback) {
      var service;
      var services = plugin['services'];
      for (i = 0, len = services.length; i < len; i++) {
        service = services[i];
        service.stop();
      }
    },

    // Remove jobs. Note all the pending jobs will be canceled.
    function stopAndRemoveJobs(callback) {
      // @TODO:
      callback();
    }
  ], callback);
};

exports.PluginManager = PluginManager;
