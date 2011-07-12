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

var async = require('async');

var pluginManager = require('plugins/manager').pluginManager;
var control = require('control');
var castHttp = require('util/http');

function listPlugins(req, res) {
  var availablePlugins = [];
  var enabledPlugins = [];

  async.parallel([
    function readAvailablePlugins(callback) {
      control.plugins.getAvailablePlugins(function(err, availablePlugins) {
        if (err) {
          callback(err);
          return;
        }

        availablePlugins = Object.keys(availablePlugins);
        callback();
      });
    },

    function readEnabledPlugins(callback) {
      control.plugins.getEnabledPlugins(function(err, enabledPlugins) {
        if (err) {
          callback(err);
          return;
        }

        enabledPlugins = Object.keys(enabledPlugins);
        callback();
      });
    }
  ],

  function(err) {
    if (err) {
      castHttp.returnError(res, err);
      return;
    }

    castHttp.returnJson(res, 200, {
      'available': availablePlugins,
      'enabled': enabledPlugins
    });

  });
}

function register(app, apiVersion) {
  app.get('/', listPlugins);
  //app.get('/:plugin/manifest', pluginDetails);
 // app.get('/:plugin/settings', pluginSettings);
}

exports.register = register;
