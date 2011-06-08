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
    async.apply(fs.readdir, endpointsPath),

    function discoverModuleEndpoints(files, callback) {
      async.forEach(files, function(file, callback) {
        var modulePath = path.join(endpointsPath, file);
        misc.getExportedMember(modulePath, 'routes', function onEnd(err, routes) {
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
    callback(err, endpointRoutes);
  });
}

exports.discoverEndpoints = discoverEndpoints;
