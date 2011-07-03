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

var os = require('os');

var norris = require('norris');
var http = require('services/http');
var agent = require('cast-agent/entry');
var version = require('util/version');


/**
 * Retrieve information about the running cast agent.
 * @param {Function} callback A callback fired with (err, info).
 */
function getInfo(callback) {
  var dateStarted = agent.dateStarted;
  var currentDate = new Date();
  var uptime = (currentDate.getTime() / 1000) - (dateStarted.getTime() / 1000);

  norris.get(function(facts) {
    callback(null, {
      'agent_version': version.toString(),
      'node_version': process.version,
      'api_version': http.CURRENT_API_VERSION,
      'hostname': facts.hostname,
      'architecture': facts.arch,
      'os': os.release(),
      'memory': os.totalmem(),
      'os_uptime': os.uptime(),
      'agent_uptime': uptime
    });
  });
}


exports.getInfo = getInfo;
