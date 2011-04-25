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
var constants = require('constants');

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
      http.returnError(res, 500, err.message);
      return;
    }
    http.returnJson(res, 200, services);
  });
}

function getService(req, res, service) {
  var manager = serviceManagement.getDefaultManager().getManager();

  manager.getService(service, function(err, svc) {
    if (err) {
      http.returnError(res, 404, 'Service not found');
      return;
    }

    svc.getDetails(function(err, details) {
      if (err) {
        http.returnError(res, 500, err.message);
        return;
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
      http.returnError(res, 404, 'Service not found');
      return;
    }

    logFile = svc.getLogPath();
    tailFile(logFile, bytesToRead, false, function(error, data, unsubscribe) {
      if (error) {
        http.returnError(res, bytesToRead, error.message);
        return;
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
      http.returnError(res, 404, 'Service not found');
      return;
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

function actionService(req, res, action, serviceName) {
  var statusCode, errMessage;
  var manager = serviceManagement.getDefaultManager().getManager();

  manager.runAction(serviceName, action, function(err) {
    if (err) {
      if (err.errno === constants.ENOENT) {
        statusCode = 404;
        errMessage = 'Service does not exist';
      }
      else {
        statusCode = 500;
        errMessage = err.message;
      }

      http.returnError(res, statusCode, errMessage);
      return;
    }

    http.returnJson(res, 200, {
      'service': serviceName,
      'method': action,
      'result': 'success'
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

var urls = route([
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

exports.urls = urls;
