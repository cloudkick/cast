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


function tailService(req, res) {
  var service = req.params.service;
  var bytes = parseInt(req.params.bytes, 10);

  if (isNaN(bytes)) {
    castHttp.returnError(res, 400, new Error('Invalid byte length'));
    return;
  }

  function onData(err, data, unsubscribe) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(data);
    }
  }

  control.services.tailServiceLog(name, bytes, false, onData);
}


function tailFollowService(req, res) {
  var service = req.params.service;
  var bytes = parseInt(req.params.bytes, 10);
  var firstChunk = true;

  if (isNaN(bytes)) {
    castHttp.returnError(res, 400, new Error('Invalid byte length'));
    return;
  }

  function onData(err, data, unsubscribe) {
    if (err) {
      if (firstChunk) {
        castHttp.returnError(res, err);
      } else {
        unsubscribe();
      }
      return;
    }

    if (firstChunk) {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Connection': 'keep-alive'
      });
      res.on('error', unsubscribe);
      req.on('error', unsubscribe);
      req.connection.on('end', unsubscribe);
      firstChunk = false;
    }

    res.write(data);
  }

  res.connection.setTimeout(0);
  control.services.tailServiceLog(name, bytes, true, onData);
}


function register(app, apiVersion) {
  app.get('/', listServices);
  app.get('/:serviceName/', getService);
  app.get('/:serviceName/tail/:bytes/', tailService);
  app.get('/:serviceName/tail/:bytes/follow/', tailFollowService);
  app.put('/:serviceName/enable/', enableService);
  app.put('/:serviceName/disable/', disableService);
  app.put('/:serviceName/start/', startService);
  app.put('/:serviceName/stop/', stopService);
  app.put('/:serviceName/restart/', restartService);
}


exports.register = register;
