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

function listPlugins(req, res) {
}

function pluginDetails(req, res) {
}

/**
 * A special handler function for /plugins/<plugin_name>/settings endpoint which
 * available and currently configured plugin settings.
 */
function pluginSettings(req, res) {
}

function enablePlugin(req, res) {
}

function disablePlugin(req, res) {
}

function register(app, apiVersion) {
  app.get('/', listPlugins);
  app.get('/:plugin', pluginDetails);
  app.get('/:plugin/settings', pluginSettings);
  app.put('/:pluginName/enable', enablePlugin);
  app.put('/:pluginName/disable', disablePlugin);
}

exports.register = register;
