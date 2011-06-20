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

var querystring = require('querystring');

var async = require('async');

var control = require('control');
var castHttp = require('util/http');
var requiredParams = require('http/middleware/required-params').attachMiddleware;

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;


function listInstances(req, res) {
  control.instances.listInstances(function(err, instances) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      castHttp.returnJson(res, 200, instances);
    }
  });
}


function getInstance(req, res) {
  control.instances.getInstance(function(err, instance) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      castHttp.returnJson(res, 200, instance);
    }
  });
}


function createInstance(req, res) {
  var name = req.params.instanceName;
  var params = req.body;
  var bundleName = params['bundle_name'];
  var bundleVersion = params['bundle_version'];
  var enableService = params['enable_service'];
  var job = control.instances.createInstance(name, bundleName, bundleVersion);
  castHttp.returnReadyJob(res, job);
  // TODO: enable service
}


function upgradeInstance(req, res) {
  var name = req.params.instanceName;
  var params = req.body;
  var bundleVersion = params['bundle_version'];
  var job = control.instances.upgradeInstance(name, bundleVersion);
  castHttp.returnReadyJob(res, job);
}


function deleteInstance(req, res) {
  var name = req.params.instanceName;
  castHttp.returnReadyJob(res, control.instances.deleteInstance(name));
}


function register(app, apiVersion) {
  app.get('/', listInstances);
  app.get('/:instanceName/', getInstance);
  app.put('/:instanceName/', requiredParams(['bundle_name', 'bundle_version']), createInstance);
  app.post('/:instanceName/upgrade/', requiredParams(['bundle_version']), upgradeInstance);
  app.del('/:instanceName/', deleteInstance);
}


exports.register = register;
