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

var clutch = require('extern/clutch');
var log = require('util/log');
var config = require('util/config');
var http = require('util/http');
var sys = require('sys');
var path = require('path');
var RunitServiceDirectory = require('runit/services').RunitServiceDirectory;

var SERVICE_DIR = config.get()['servicedir'];

function list_services(req, res) {
  var dir = new RunitServiceDirectory(SERVICE_DIR);
  dir.list_services_details(function(err, services) {
    if (err) {
      return http.return_error(res, 500, err);
    }
    http.return_json(res, 200, services);
  });
}

exports.urls = clutch.route([
  ['GET /$', list_services],
]);
