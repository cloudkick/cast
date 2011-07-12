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

var bodySizeLimiter = require('http/middleware/body-size-limiter').attachMiddleware;


/**
 * Maximum number of bytes accepable in a CSR request.
 * @type {Number}
 * @const
 */
var MAX_CSR_BYTES = 4096;


var listRequests = castHttp.wrapCall(control.ca.listRequests);
var getRequest = castHttp.wrapCall(control.ca.getRequest, ['name']);


function createRequest(req, res) {
  var name = req.params.name;

  if (!req.buffer) {
    castHttp.returnError(res, new Error('Missing data'));
    return;
  }

  castHttp.returnReadyJob(res, control.ca.createRequest(name, req.buffer));
}


function signRequest(req, res) {
  var name = req.params.name;
  castHttp.returnReadyJob(res, control.ca.signRequest(name));
}


function deleteRequest(req, res) {
  var name = req.params.name;
  castHttp.returnReadyJob(res, control.ca.deleteRequest(name));
}


function register(app, apiVersion) {
  app.get('/', listRequests);
  app.get('/:name/', getRequest);
  app.put('/:name/', bodySizeLimiter(MAX_CSR_BYTES), createRequest);
  app.post('/:name/sign/', signRequest);
  app.del('/:name/', deleteRequest);
}


exports.register = register;
