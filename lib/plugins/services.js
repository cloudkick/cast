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
 * Discover all the HTTP services exposed by the plugin.
 *
 * @param {String} pluginPath Path to the plugin root directory.
 * @param {Function} callback Callback called with (err, services).
 */
function discoverServices(pluginPath, callback) {
  var services = {};
  var servicesPath = path.join(pluginPath, pluginConstants.SERVICES_DIRECTORY);

  async.waterfall([
    async.apply(fs.readdir, servicesPath),

    function discoverServices(files, callback) {
      async.forEach(files, function(file, callback) {
          var modulePath = path.join(servicesPath, file);
          misc.getExportedMember(modulePath, 'instance', function onEnd(err, instance) {
            if (err) {
              callback();
              return;
             }

            services[file] = instance;
          });
        }, callback);
    }
  ],

  function(err) {
    callback(err, services);
  });
}

exports.discoverServices = discoverServices;
