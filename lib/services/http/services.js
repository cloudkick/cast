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
var tail_file = require('util/tail').tail_file;

var service_management = require('service_management');

function list_services(req, res) {
  var manager = service_management.get_default_manager().get_manager();

  manager.list_services_details(function(err, services) {
    if (err) {
      return http.return_error(res, 500, err.message);
    }
    http.return_json(res, 200, services);
  });
}

function get_service(req, res, service) {
  var manager = service_management.get_default_manager().get_manager();

  manager.get_service(service, function(err, svc) {
    if (err) {
      return http.return_error(res, 404, 'Service not found');
    }

    svc.get_details(function(err, details) {
      if (err) {
        return http.return_error(res, 500, err.message);
      }

      http.return_json(res, 200, details);
    });
  });
}

function tail_service(req, res, service, bytes_to_read) {
  var log_file;

  var manager = service_management.get_default_manager().get_manager();
  manager.get_service(service, function(err, svc) {
    if (err) {
      return http.return_error(res, 404, 'Service not found');
    }

    log_file = svc.get_log_path();
    tail_file(log_file, bytes_to_read, false, function(error, data, unsubscribe) {
      if (error) {
        return http.return_error(res, bytes_to_read, error.message);
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });

      res.end(data);
    });
  });
}

function tail_follow_service(req, res, service, bytes_to_read) {
  var log_file;
  var head_written = false;
  var listeners_set = false;

  var manager = service_management.get_default_manager().get_manager();
  manager.get_service(service, function(err, svc) {
    if (err) {
      return http.return_error(res, 404, 'Service not found');
    }

    res.connection.setTimeout(0);

    log_file = svc.get_log_path();
    tail_file(log_file, bytes_to_read, true, function(error, data, unsubscribe) {
      if (error) {
        return http.return_error(res, bytes_to_read, error.message);
      }

      if (!head_written) {
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Connection': 'keep-alive' });
        head_written = true;
      }

      res.write(data);

      if (!listeners_set) {
        res.on('error', unsubscribe);
        req.on('error', unsubscribe);
        req.connection.on('end', unsubscribe);

        listeners_set = true;
      }
    });
  });
}

function action_service(req, res, action, service) {
  var manager = service_management.get_default_manager().get_manager();

  manager.get_service(service, function(err, svc) {
    if (err) {
      return http.return_error(res, 404, 'Service not found');
    }
    svc[action](function(err) {
      if (err) {
        return http.return_error(res, 500, err.message);
      }
      // TODO: This doesn't make much sense
      http.return_json(res, 200, {
        service: service,
        method: action,
        result: 'success'
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
  ['GET /([^\/]*)/tail/([^\/]\\d+)/$', tail_service],
  ['GET /([^\/]*)/tail/([^\/]\\d+)/follow/$', tail_follow_service],
  ['PUT /([^\/]*)/enable/$', enable_service],
  ['PUT /([^\/]*)/disable/$', disable_service],
  ['PUT /([^\/]*)/start/$', start_service],
  ['PUT /([^\/]*)/stop/$', stop_service],
  ['PUT /([^\/]*)/restart/$', restart_service]
]);
