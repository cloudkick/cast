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

function get_service_dir() {
  return new RunitServiceDirectory(config.get()['servicedir']);
}

function list_services(req, res) {
  var dir = get_service_dir();
  dir.list_services_details(function(err, services) {
    if (err) {
      return http.return_error(res, 500, err.message);
    }
    http.return_json(res, 200, services);
  });
}

function get_service(req, res, service) {
  var dir = get_service_dir();
  dir.get_service(service, function(err, svc) {
    if (err) {
      return http.return_error(res, 404, "Service not found");
    }
    svc.get_details(function(err, details) {
      if (err) {
        return http.return_error(res, 500, err.message);
      }
      http.return_json(res, 200, details);
    });
  });
}

function action_service(req, res, action, service) {
  var dir = get_service_dir();
  dir.get_service(service, function(err, svc) {
    if (err) {
      return http.return_error(res, 404, "Service not found");
    }
    svc[action](function(err) {
      if (err) {
        return http.return_error(res, 500, err.message);
      }
      // TODO: This doesn't make much sense
      http.return_json(res, 200, {
        service: service,
        method: action,
        result: "success"
      });
    });
  });
}

function enable_service(req, res, service) {
  action_service(req, res, 'enable', service);
}

function disable_service(req, res, service) {
  action_service(req, res, 'disable', service);
}

function start_service(req, res, service) {
  action_service(req, res, 'start', service);
}

function stop_service(req, res, service) {
  action_service(req, res, 'stop', service);
}

function restart_service(req, res, service) {
  action_service(req, res, 'restart', service);
}

exports.urls = clutch.route([
  ['GET /$', list_services],
  ['GET /([^\/]*)/$', get_service],
  ['PUT /([^\/]*)/enable/$', enable_service],
  ['PUT /([^\/]*)/disable/$', disable_service],
  ['PUT /([^\/]*)/start/$', start_service],
  ['PUT /([^\/]*)/stop/$', stop_service],
  ['PUT /([^\/]*)/restart/$', restart_service]
]);
