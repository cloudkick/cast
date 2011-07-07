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

var fs = require('fs');
var path = require('path');
var constants = require('constants');

var async = require('async');
var sprintf = require('sprintf').sprintf;
var express = require('express');
var semver = require('semver');

var config = require('util/config');
var version = require('util/version');
var log = require('util/log');
var fsUtil = require('util/fs');
var misc = require('util/misc');
var Errorf = misc.Errorf;

var validators = require('manifest/validators');
var httpServerService = require('services/http').instance;
var httpConstants = require('http/constants');
var pluginConstants = require('plugins/constants');
var pluginsHttpUtils = require('plugins/http');
var pluginServicesUtils = require('plugins/services');

/**
 * Plugin manager.
 * @constructor
 */
function PluginManager() {
  /* Stores pluginName to plugin manifest mappings */
  this._availablePlugins = {};

  /* Stores enabled plugins and their configuration (https endpoints,
   * services, etc) */
  this._enabledPlugins = {};
}

/**
 * Return name of all the the available plugins (all the plugins which are located
 *  in the plugins directory).
 * @param {Function} callback Callback called with (err, availablePlugins)
 */
PluginManager.prototype.getAvailablePlugins = function(callback) {
  var self = this;
  var pluginsDir = config.get()['plugins']['root'];

  async.waterfall([
    function listPluginFiles(callback) {
      fs.readdir(pluginsDir, function(err, files) {
        if (err && err.errno !== constants.ENOENT) {
          callback(err);
          return;
        }

        files = files || [];
        callback(null, files);
      });
    },

    function readPluginsManifest(files, callback) {
      async.forEach(files, function(file, callback) {
        var pluginPath = path.join(pluginsDir, file);
        var pluginName = file;

        if (self._availablePlugins.hasOwnProperty(pluginName)) {
          // Manifest for this file is already cached
          callback();
          return;
        }

        fs.stat(pluginPath, function(err, stats) {
          if (err) {
            log.err(sprintf('Error while stating plugin file / directory: %s',
                              err.message));
            callback();
            return;
         }

         if (!stats.isDirectory()) {
           // Plugin must be a directory
           callback();
           return;
         }

         self._readPluginManifest(pluginPath, function(err, manifestObj) {
           if (err) {
             log.err(sprintf('Error while reading plugin manifest: %s',
                               err.message));
             callback();
             return;
           }

           self._availablePlugins[pluginName] = manifestObj;
           callback();
          });
        });
      }, callback);
    }
  ],

  function(err) {
    callback(err, ((err) ? null : self._availablePlugins));
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
 * Return settings object for the specified plugin.
 *
 * @param {String} pluginName Plugin name.
 * @param {Function} callback Callback called with (err, pluginSettings) where
 *                   pluginSettings is an {Object}
 */
PluginManager.prototype.getPluginSettings = function(pluginName, callback) {
  var self = this;
  var pluginSettings = null;

  async.waterfall([
    async.apply(self.getEnabledPlugins.bind(self)),

    function getPluginSettings(enabledPlugins, callback) {
      if (!enabledPlugins.hasOwnProperty(pluginName)) {
        callback(new Errorf('Plugin "%s" is not enabled', pluginName));
        return;
      }

      pluginSettings = enabledPlugins[pluginName];
      callback();
    }
  ],

  function(err) {
    callback(err, pluginSettings);
  });
};

/**
 * Return manifest object for the specified plugin.
 *
 * @param {String} pluginName Plugin name.
 * @param {Function} callback Callback called with (err, pluginManifest) where
 *                   pluginManifest is an {Object}
 */
PluginManager.prototype.getPluginManifest = function(pluginName, callback) {
  var self = this;
  var pluginManifest = null;

  async.waterfall([
    async.apply(self.getAvailablePlugins.bind(self)),

    function getPluginSettings(availablePlugins, callback) {
      if (!availablePlugins.hasOwnProperty(pluginName)) {
        callback(new Errorf('Plugin "%s" does not exist', pluginName));
        return;
      }

      pluginManifest = availablePlugins[pluginName];
      callback();
    }
  ],

  function(err) {
    callback(err, pluginManifest);
  });
};

/**
 * Read "plugins" part from the settings file and load all the enabled plugins.
 *
 * @param {Function} callback Callback called when the initialization completes.
 */
PluginManager.prototype.init = function(callback) {
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
    var pluginPath = path.join(config.get()['plugins']['root'], pluginName);

    async.waterfall([
      // 1. Read plugin manifest
      async.apply(self._readPluginManifest.bind(self, pluginPath)),

      function validatePluginSettings(pluginManifest, callback) {
        self.validatePluginSettings(pluginManifest, pluginSettings, function onValidated(err) {
          if (err) {
            err = new Error('Failed to validate plugin "%s" settings: %s',
                            pluginName, err);
            callback(err);
            return;
          }

          // Load and enable the plugin
          log.info(sprintf('Enabling plugin "%s"', pluginName));
          self.enablePlugin(pluginName, callback);
        });
      }
    ],

    function(err) {
      if (err) {
        log.info('Failed to enable plugin "%s": %s', pluginName, err.message);
      }

      callback();
    });
  }, callback);
};

/**
 * Check if the current version of the agent is supported by the plugin.
 *
 * @param {Object} pluginManifest Plugin manifest (parsed plugin package.json).
 * @return {Bool} true if the version is supported, false otherwise.
 */
PluginManager.prototype.isSupported = function(pluginManifest) {
  var agentVersionConstrain = pluginManifest['agent_version'];
  if (!agentVersionConstrain) {
    return true;
  }

  return semver.satisfies(sprintf('%s.%s.%s', version.MAJOR, version.MINOR,
                                  version.PATCH), agentVersionConstrain);
};

/*
 * Validate plugin settings. Validation rules are defined by the plugin author
 * in the plugin package.json file.
 *
 * @param {Object} pluginManifest Plugin manifest.
 * @param {Object} pluginSettings Plugin settings.
 * @param {Function} callback Callback called with (err)
 */
PluginManager.prototype.validatePluginSettings = function(pluginManifest,
                                                          pluginSettings,
                                                          callback) {
  var self = this;
  var attribute, rule, type, value, validatorName, validator;
  var rules = pluginManifest['settings'];
  var attributes = Object.keys(pluginSettings);

  async.forEach(attributes, function(attribute, callback) {
    // @TODO: Also use custom validators if specified
    if (pluginSettings.hasOwnProperty(attribute) &&
        rules.hasOwnProperty(attribute)) {
      rule = rules[attribute];
      type = rule['type'];
      value = pluginSettings[attribute];

      if (!validators.TYPE_VALIDATORS.hasOwnProperty(type)) {
        // Unknown type specified
        callback();
        return;
      }

      // Perform the type validation
      validatorName = validators.TYPE_VALIDATORS[type];
      validators.validateValue(value, validatorName, null, callback);
      return;
    }

    // No validator specified for this attribute
    callback();
  }, callback);
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
 * Enable a plugin and do the following;
 * - Register plugin HTTP endpoints
 * - Register and load plugin services
 * - Register plugin job manager
 * @param {String} pluginName Plugin name.
 * @param {Function} callback Callback called with (err)
 */
PluginManager.prototype.enablePlugin = function(pluginName, callback) {
  var self = this;
  var pluginEndpointPaths = [], pluginServices = [], pluginSettings;
  var ops = [];

  var pluginPath = path.join(config.get()['plugins']['root'], pluginName);
  if (misc.inArray(pluginName, Object.keys(this._enabledPlugins))) {
    callback(new Errorf('Plugin "%s" is already enabled'));
    return;
  }

  // Register HTTP endpoints
  function registerHttpEndpoints(endpointRoutes, callback) {
    var key;
    var keys = Object.keys(endpointRoutes);

    async.forEach(keys, function(key, callback) {
      var endpointRoute = endpointRoutes[key];
      var registeredPaths = self._registerPluginEndpoints(pluginName,
                                                          endpointRoute);
      pluginEndpointPaths = pluginEndpointPaths.concat(registeredPaths);
      callback();
    }, callback);
  }

  // Register and start services
  function registerAndStartServices(services, callback) {
    var key;
    var keys = Object.keys(services);

    async.forEach(keys, function(key, callback) {
      var service = services[key];
      pluginServices.push(service);
      service.start();
      callback();
    }, callback);
  }

  function addPluginToEnabled(callback) {
    self._enabledPlugins[pluginName] = {
      'endpoints': pluginEndpointPaths, // Store full paths of the plugin endpoints
      'services': pluginServices, // Store references to the plugin services
      'jobs': [], // Store names of the plugin jobs
      'settings': pluginSettings // Store plugin settings
    };

    callback();
  }

  // Discover all the resources (endpoints, services, jobs) and decide what needs
  // to be done
  async.parallel([
    function getPluginSettings(callback) {
      self.getPluginSettings(pluginName, function(err, settings) {
        if (err) {
          callback(err);
          return;
        }

        pluginSettings = settings;
        callback();
      });
    },

    function discoverHttpEndpoints(callback) {
      pluginsHttpUtils.discoverEndpoints(pluginPath, function onDiscover(err, routes) {
        if (!err) {
          routes = misc.filterObjectValues(routes, [ null ]);

          if (Object.keys(routes).length > 0) {
            ops.push(async.apply(registerHttpEndpoints, routes));
          }
        }

        callback();
      });
    },

    function discoverServices(callback) {
      pluginServicesUtils.discoverServices(pluginPath, function onDiscover(err, services) {
        if (!err) {
          services = misc.filterObjectValues(services, [ null ]);

          if (Object.keys(services).length > 0) {
            ops.push(async.apply(registerAndStartServices, services));
          }
        }

        callback();
      });
    }

    // @TODO: Discover and register jobs
  ],

  function(err) {
    if (err) {
      callback(err);
      return;
    }

    async.parallel(ops, function onEnd(err) {
      if (err) {
        callback(err);
        return;
      }

      addPluginToEnabled(callback);
    });
  });
};

/**
 * Register plugin HTTP endpoint handler with the Cast HTTP server.
 *
 * @param {Array} endpointRoutes Routes array (method, path, middleware, ..., handler)
 * @return {Array} All the paths which have been successfully registered.
 */
PluginManager.prototype._registerPluginEndpoints = function(pluginName,
                                                            endpointRoutes) {
  var i, len, route, routeArgsLen, method, routePath, fullPath, middleware;
  var handler, registerMethod, args;
  var registeredPaths = [];
  var httpServer = httpServerService.getServer();

  for (i = 0, len = endpointRoutes.length; i < len; i++) {
    route = endpointRoutes[i];
    routeArgsLen = route.length;

    if (routeArgsLen < 3) {
      // Invalid route, should we throw?
      continue;
    }

    method = route[0].toLowerCase();
    routePath = route[1];
    fullPath = sprintf('/%s', path.join(httpConstants.CURRENT_API_VERSION,
                       pluginConstants.HTTP_ENDPOINT_PREFIX, pluginName,
                       routePath));

    // Actually register it
    args = [];
    if (routeArgsLen === 3) {
      // No middleware
      middleware = [];
    }
    else {
      middleware = route.slice(2, routeArgsLen - 1);
    }

    handler = route[routeArgsLen - 1];
    registerMethod = httpServer[method];

    if (middleware.length > 0) {
      args.push(fullPath);
      args = args.concat(middleware);
      args.push(handler);
    }
    else {
      args = [ fullPath, handler ];
    }

    // @TODO: Handle possible error
    registerMethod.apply(httpServer, args);
    registeredPaths.push({'path': fullPath, 'method': method});
  }

  return registeredPaths;
};

/**
 * Disable a plugin.
 *
 * @param {String} pluginName Plugin name.
 * @param {Function} callback Callback called with ()
 */
PluginManager.prototype.disablePlugin = function(pluginName, callback) {
  var i, len;
  var httpServer = httpServerService.getServer();

  if (!misc.inArray(pluginName, Object.keys(this._enabledPlugins))) {
    callback(new Errorf('Plugin "%s" is not enabled', pluginName));
    return;
  }

  var plugin = this._enabledPlugins[pluginName];

  async.parallel([
    // Remove all the plugin HTTP endpoints
    function removeHttpEndpoints(callback) {
      var endpoint, endpointPath, endpointMethod, removeMethod;
      var endpoints = plugin['endpoints'];

      for (i = 0, len = endpoints.length; i < len; i++) {
        endpoint = endpoints[i];
        endpointPath = endpoint['path'];
        endpointMethod = endpoint['method'];

        httpServer[endpointMethod].call(httpServer, endpointPath).remove();
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

      callback();
    },

    // Remove jobs. Note: all the pending jobs will be canceled.
    function stopAndRemoveJobs(callback) {
      // @TODO:
      callback();
    }
  ], callback);
};

var pluginManager = new PluginManager();

exports.pluginManager = pluginManager;
exports.PluginManager = PluginManager;
