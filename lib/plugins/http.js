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
var fs = require('fs');

var async = require('async');

var config = require('util/config');
var misc = require('util/misc');
var Errorf = misc.Errorf;

var pluginConstants = require('plugins/constants');

/**
 * Get routes defined in the plugin endpoint module.
 *
 * @param {String} modulePath Path to the module file.
 * @param {Function} callback Callback called with (err, routes)
 */
function getEndpointRoutes(modulePath, callback) {
  var exported, routes;

  try {
    exported = require(modulePath);
  }
  catch (err) {
    callback(new Errorf('Failed to load module "%s": %s', modulePath, err));
    return;
  }

  routes = (exported.routes) ? exported.routes : null;
  callback(null, routes);
}

/**
 * Discover all the HTTP endpoints exposed by the plugin.
 *
 * @param {String} pluginPath Path to the plugin root directory.
 * @param {Function} callback Callback called with (err, routes) .Routes is an
 * object where the key is the endpoint module name and the value is an Array
 * with routes as defined by the plugin.
 */
function discoverEndpoints(pluginPath, callback) {
  var endpointRoutes = {};
  var endpointsPath = path.join(pluginPath, pluginConstants.HTTP_ENDPOINTS_DIRECTORY);

  async.waterfall([
    function pathExists(callback) {
      path.exists(endpointsPath, function onExists(exists) {
        if (!exists) {
          callback(new Error('Endpoints directory does not exist'));
          return;
        }

        callback();
      });
    },

    function listFiles(callback) {
      fs.readdir(endpointsPath, function(err, files) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, files);
      });
    },

    function discoverModuleEndpoints(files, callback) {
      async.forEach(files, function(file, callback) {
        var modulePath = path.join(endpointsPath, file);
        getEndpointRoutes(modulePath, function onEnd(err, routes) {
          if (err) {
            callback();
            return;
          }

          endpointRoutes[file] = routes;
        });
      }, callback);
    }
  ],

  function(err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, endpointRoutes);
  });
}

exports.discoverEndpoints = discoverEndpoints;
