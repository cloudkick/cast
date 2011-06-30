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
var constants = require('constants');

var async = require('async');

var config = require('util/config');
var misc = require('util/misc');
var Errorf = misc.Errorf;

var pluginConstants = require('plugins/constants');

/**
 * Discover all the HTTP services exposed by the plugin.
 *
 * Service is a module which is located in the plugin SERVICES_DIRECTORY
 * directory and exports a member with name instance.
 * Service must also inherit from the base Service class and implement all the
 * required methods, but we currently don't check this.
 *
 * @param {String} pluginPath Path to the plugin root directory.
 * @param {Function} callback Callback called with (err, services).
 */
function discoverServices(pluginPath, callback) {
  var services = {};
  var servicesPath = path.join(pluginPath, 'lib',
                               pluginConstants.SERVICES_DIRECTORY);

  async.waterfall([
    // Make sure plugin directory exists
    async.apply(fs.stat, pluginPath),

    function readServicesDirectory(_, callback) {
      fs.readdir(servicesPath, function(err, files) {
        // Missing services directory is not fatal
        if (err && err.errno === constants.ENOENT) {
          err = null;
          files = [];
        }

        callback(err, files);
      });
    },

    function discoverServices(files, callback) {
      async.forEach(files, function(file, callback) {
        var name = file.replace(/\.js$/, '');
        var modulePath = path.join(servicesPath, file);

        misc.getExportedMember(modulePath, 'instance', function onEnd(err, instance) {
          if (err) {
            callback();
            return;
           }

           services[name] = instance;
           callback();
        });
      }, callback);
    }
  ],

  function(err) {
    callback(err, services);
  });
}

exports.discoverServices = discoverServices;
