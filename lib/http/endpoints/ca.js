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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var control = require('control');
var castHttp = require('util/http');
var route = require('services/http').route;


/**
 * Regex for matching request 'hostnames'. This isn't exactly a standard domain
 * name validator, as the specified 'hostnames' can be pretty arbitrary - our
 * main concern is making sure that the hostname string __never__ allows the
 * upload to write outside of the directory we direct it to.
 * @type {Regex}
 * @const
 */
var HOSTNAME_RE = /^([a-zA-Z0-9\-\_]+\.)*[a-zA-Z0-9\-\_]+$/;


/**
 * Maximum number of bytes accepable in a CSR request.
 * @type {Number}
 * @const
 */
var MAX_CSR_BYTES = 4096;


/**
 * Test the validity of a hostname.
 * @param {String} hostname Name to check.
 * @return {Boolean} Whether the hostname is valid.
 */
function validHostname(hostname) {
  return Boolean(hostname.match(HOSTNAME_RE));
}


function listRequests(req, res) {
  control.ca.listRequests(function(err, requests) {
    if (err) {
      castHttp.returnError(res, 500, err);
    } else {
      castHttp.returnJson(res, 200, requests);
    }
  });
}


function getRequest(req, res) {
  var hostname = req.params.hostname;

  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  control.ca.getRequest(hostname, function(err, request) {
    if (err) {
      castHttp.returnError(res, 500, err);
    } else {
      castHttp.returnJson(res, 200, request);
    }
  });
}


function createRequest(req, res) {
  var hostname = req.params.hostname;

  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  castHttp.acceptBodyString(req, MAX_CSR_BYTES, function(err, body) {
    if (err) {
      // Body too large
      castHttp.returnError(res, 413, err);
    } else {
      castHttp.returnReadyJob(res, control.ca.createRequest(hostname, body));
    }
  });
}


function signRequest(req, res) {
  var hostname = req.params.hostname;

  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  castHttp.returnReadyJob(res, control.ca.signRequest(hostname));
}


function deleteRequest(req, res) {
  var hostname = req.params.hostname;

  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  castHttp.returnReadyJob(res, control.ca.deleteRequest(hostname));
}


function register(app, apiVersion) {
  app.get('/', listRequests);
  app.get('/:hostname/', getRequest);
  app.put('/:hostname/', createRequest);
  app.post('/:hostname/sign/', signRequest);
  app.del('/:hostname/', deleteRequest);
}


exports.register = register;
