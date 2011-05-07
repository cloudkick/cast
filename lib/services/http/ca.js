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


/**
 * Wait for a job to emit a 'ready' or 'error' event then either serialize
 * the job to the response or return a 404.
 * @param {jobs.Job} job The job to wait on.
 * @param {http.ServerResponse} res The response to write to.
 */
function waitJob(job, res) {
  // TODO: Modify this to use swiz and put it in another file (or middleware?)

  function onError(err) {
    castHttp.returnError(res, 404, err.message);
  }

  function onReady() {
    job.removeListener('error', onError);
    castHttp.returnJson(res, 200, JSON.stringify(job));
  }

  job.once('ready', onReady);
  job.once('error', onError);
}


function listRequests(req, res) {
  castHttp.returnError(res, 404, 'Not Implemented');
}


function getRequest(req, res, hostname) {
  castHttp.returnError(res, 404, 'Not Implemented');
}


function addRequest(req, res, hostname) {
  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  castHttp.acceptBodyString(req, MAX_CSR_BYTES, function(err, body) {
    // Body too large
    if (err) {
      castHttp.returnError(res, 413, err.message);
      return;
    }

    var job = control.ca.createRequest(hostname, body);
    waitJob(job, res);
  });
}


function signRequest(req, res, hostname) {
  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  var job = control.ca.signRequest(hostname);
  waitJob(job, res);
}


function deleteRequest(req, res, hostname) {
  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
  }

  var job = control.ca.deleteRequest(hostname);
  waitJob(job, res);
}


var urls = route([
  ['GET /$', '1.0', listRequests],
  ['GET /(.+)/$', '1.0', getRequest],
  ['PUT /(.+)/$', '1.0', addRequest],
  ['POST /(.+)/sign/$', '1.0', signRequest],
  ['DELETE /(.+)/$', '1.0', deleteRequest]
]);


exports.urls = urls;
