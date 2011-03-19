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
var path = require('path');

var log = require('util/log');
var config = require('util/config');
var http = require('util/http');
var tailFile = require('util/tail').tailFile;
var serviceManagement = require('service_management');
var route = require('services/http').route;

function listServices(req, res) {
  var manager = serviceManagement.getDefaultManager().getManager();

  manager.listServicesDetails(function(err, services) {
    if (err) {
      return http.returnError(res, 500, err.message);
    }
    http.returnJson(res, 200, services);
  });
}

function getService(req, res, service) {
  var manager = serviceManagement.getDefaultManager().getManager();

  manager.getService(service, function(err, svc) {
    if (err) {
      return http.returnError(res, 404, 'Service not found');
    }

    svc.getDetails(function(err, details) {
      if (err) {
        return http.returnError(res, 500, err.message);
      }

      http.returnJson(res, 200, details);
    });
  });
}

function tailService(req, res, service, bytesToRead) {
  var logFile;

  var manager = serviceManagement.getDefaultManager().getManager();
  manager.getService(service, function(err, svc) {
    if (err) {
      return http.returnError(res, 404, 'Service not found');
    }

    logFile = svc.getLogPath();
    tailFile(logFile, bytesToRead, false, function(error, data, unsubscribe) {
      if (error) {
        return http.returnError(res, bytesToRead, error.message);
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });

      res.end(data);
    });
  });
}

function tailFollowService(req, res, service, bytesToRead) {
  var logFile;
  var headWritten = false;
  var listenersSet = false;

  var manager = serviceManagement.getDefaultManager().getManager();
  manager.getService(service, function(err, svc) {
    if (err) {
      return http.returnError(res, 404, 'Service not found');
    }

    res.connection.setTimeout(0);

    logFile = svc.getLogPath();
    tailFile(logFile, bytesToRead, true, function(error, data, unsubscribe) {
      if (error) {
        return http.returnError(res, bytesToRead, error.message);
      }

      if (!headWritten) {
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Connection': 'keep-alive' });
        headWritten = true;
      }

      res.write(data);

      if (!listenersSet) {
        res.on('error', unsubscribe);
        req.on('error', unsubscribe);
        req.connection.on('end', unsubscribe);

        listenersSet = true;
      }
    });
  });
}

function actionService(req, res, action, service) {
  var manager = serviceManagement.getDefaultManager().getManager();

  manager.getService(service, function(err, svc) {
    if (err) {
      return http.returnError(res, 404, 'Service not found');
    }
    svc[action](function(err) {
      if (err) {
        return http.returnError(res, 500, err.message);
      }
      // TODO: This doesn't make much sense
      http.returnJson(res, 200, {
        'service': service,
        'method': action,
        'result': 'success'
      });
    });
  });
}

function enableService(req, res, service) {
  actionService(req, res, 'enable', service);
}

function disableService(req, res, service) {
  actionService(req, res, 'disable', service);
}

function startService(req, res, service) {
  actionService(req, res, 'start', service);
}

function stopService(req, res, service) {
  actionService(req, res, 'stop', service);
}

function restartService(req, res, service) {
  actionService(req, res, 'restart', service);
}

exports.urls = route([
  ['GET /$', '1.0', listServices],
  ['GET /([^\/]*)/$', '1.0', getService],
  ['GET /([^\/]*)/tail/([^\/]\\d+)/$', '1.0', tailService],
  ['GET /([^\/]*)/tail/([^\/]\\d+)/follow/$', '1.0', tailFollowService],
  ['PUT /([^\/]*)/enable/$', '1.0', enableService],
  ['PUT /([^\/]*)/disable/$', '1.0', disableService],
  ['PUT /([^\/]*)/start/$', '1.0', startService],
  ['PUT /([^\/]*)/stop/$', '1.0', stopService],
  ['PUT /([^\/]*)/restart/$', '1.0', restartService]
]);
