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

var agent = require('cast-agent/entry');
var norris = require('norris');
var http = require('services/http');
var httputil = require('util/http');
var version = require('util/version');

var route = http.route;

function info(req, res) {
  var date_started = agent.date_started;
  var current_date = new Date();
  var uptime = (current_date.getTime() / 1000) - (date_started.getTime() / 1000);

  norris.get(function(facts) {
    var info = {
      'agent_version': version.toString(),
      'node_version': process.version,
      'api_version': http.CURRENT_API_VERSION,
      'hostname': facts.hostname,
      'architecture': facts.arch,
      'os': os.release(),
      'memory': os.totalmem(),
      'os_uptime': os.uptime(),
      'agent_uptime': uptime
    };

    httputil.return_json(res, 200, info);
  });
}

exports.urls = route([
   ['GET /$', '1.0', info]
]);
