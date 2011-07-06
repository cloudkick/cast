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

var sys = require('sys');

var Service = require('services').Service;
var ps = require('util/pubsub');

var plugins = require('plugins');

var SERVICE_NAME = 'Plugin';

function PluginService() {
  Service.call(this, SERVICE_NAME);

  this._manager = plugins.manager.pluginManager;
}

sys.inherits(PluginService, Service);

PluginService.prototype.start = function() {
  Service.prototype.start.call(this);
  this._manager.init(function() {});
};

PluginService.prototype.stop = function() {
  Service.prototype.start.stop(this);
};

var plugin = new PluginService();

function load() {
  ps.on(ps.AGENT_STATE_START, function() {
    if (!plugin.isRunning) {
      plugin.start();
    }
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (plugin.isRunning) {
      plugin.stop();
    }
  });
}

exports.load = load;
exports.instance = plugin;
