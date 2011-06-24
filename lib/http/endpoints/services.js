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

var control = require('control');
var castHttp = require('util/http');
var requiredParams = require('http/middleware/required-params').attachMiddleware;


function listServices(req, res) {
  control.services.listServices(function(err, services) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      castHttp.returnJson(res, 200, services);
    }
  });
}


function getService(req, res) {
  var name = req.params.serviceName;
  control.services.getService(name, function(err, service) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      castHttp.returnJson(res, 200, service);
    }
  });
}


function enableService(req, res) {
  var name = req.params.serviceName;
  castHttp.returnReadyJob(res, control.services.enableService(name));
}


function disableService(req, res) {
  var name = req.params.serviceName;
  castHttp.returnReadyJob(res, control.services.disableService(name));
}


function startService(req, res) {
  var name = req.params.serviceName;
  castHttp.returnReadyJob(res, control.services.startService(name));
}


function stopService(req, res) {
  var name = req.params.serviceName;
  castHttp.returnReadyJob(res, control.services.stopService(name));
}


function restartService(req, res) {
  var name = req.params.serviceName;
  castHttp.returnReadyJob(res, control.services.restartService(name));
}


/*
function tailService(req, res) {
  var service = req.params.service;
  var bytesToRead = req.params.bytesToRead;
  var logFile;
  var manager = serviceManagement.getDefaultManager().getManager();

  manager.getService(service, function(err, svc) {
    if (err) {
      http.returnError(res, 404, err, 'Service not found');
      return;
    }

    logFile = svc.getLogPath();
    tailFile(logFile, bytesToRead, false, function(err, data, unsubscribe) {
      if (err) {
        http.returnError(res, 500, err);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(data);
    });
  });
}


function tailFollowService(req, res) {
  var service = req.params.service;
  var bytesToRead = req.params.bytesToRead;
  var logFile;
  var headWritten = false;
  var listenersSet = false;
  var manager = serviceManagement.getDefaultManager().getManager();

  manager.getService(service, function(err, svc) {
    if (err) {
      http.returnError(res, 404, err, 'Service not found');
      return;
    }

    res.connection.setTimeout(0);

    logFile = svc.getLogPath();
    tailFile(logFile, bytesToRead, true, function(err, data, unsubscribe) {
      if (err) {
        http.returnError(res, bytesToRead, err);
        return;
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
*/


function register(app, apiVersion) {
  // @TODO: verify bytesToRead is Number
  app.get('/', listServices);
  app.get('/:serviceName/', getService);
  /*
  app.get('/:serviceName/tail/:bytesToRead/', tailService);
  app.get('/:serviceName/tail/:bytesToRead/follow/', tailFollowService);
  */
  app.put('/:serviceName/enable/', enableService);
  app.put('/:serviceName/disable/', disableService);
  app.put('/:serviceName/start/', startService);
  app.put('/:serviceName/stop/', stopService);
  app.put('/:serviceName/restart/', restartService);
}


exports.register = register;
