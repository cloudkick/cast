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

var ca = require('security/ca');
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
 * Content-Type header to use when transferring a client certificate.
 * @type {String}
 * @const
 */
var CLIENT_CRT_CONTENT_TYPE = 'application/x-x509-user-cert';

/**
 * Test the validity of a hostname.
 * @param {String} hostname Name to check.
 * @return {Boolean} Whether the hostname is valid.
 */
function validHostname(hostname) {
  return Boolean(hostname.match(HOSTNAME_RE));
}

/**
 * Assign a human-readable 'status' property to a request returned from the
 * CA based on whether the request has been signed or not. The 'status' is
 * assigned to the request, and the request is returned.
 * @param {Object} request A request object from the CA.
 * @return {Object} The modified request.
 */
function assignStatus(request) {
  if (request.signed) {
    request['status'] = 'Approved';
  } else {
    request['status'] = 'Awaiting Approval';
  }
  return request;
}

var listRequests = function(req, res) {
  var castCA = ca.getCA();
  castCA.getRequests(function(err, requests) {
    if (err) {
      castHttp.returnError(res, 500, err.message);
      return;
    }

    requests.forEach(assignStatus);

    requests.sort(function(a, b) {
      return (a.hostname > b.hostname);
    });

    castHttp.returnJson(res, 200, requests);
  });
};

var getRequest = function(req, res, hostname) {
  castHttp.returnError(res, 404, 'Not Implemented');
};

var addRequest = function(req, res, hostname) {
  var castCA = ca.getCA();
  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  castHttp.acceptBodyString(req, MAX_CSR_BYTES, function(err, body) {
    if (err) {
      // Body too large
      castHttp.returnError(res, 413, err.message);
      return;
    }

    castCA.addRequest(hostname, body, function(err, certText) {
      if (err) {
        castHttp.returnError(res, 500, err.message);
      } else if (certText) {
        // A certificate is ready!
        castHttp.returnText(res, 200, CLIENT_CRT_CONTENT_TYPE, certText);
      } else {
        // CSR accepted, awaiting signing
        castHttp.returnJson(res, 202, assignStatus({
          'hostname': hostname,
          'signed': false
        }));
      }
    });
  });
};

var signRequest = function(req, res, hostname) {
  var castCA = ca.getCA();
  if (!validHostname(hostname)) {
    castHttp.returnError(res, 400, 'Invalid hostname');
    return;
  }

  castCA.signRequest(hostname, function(err) {
    if (err) {
      castHttp.returnError(res, 500, err.message);
      return;
    }
    castHttp.returnJson(res, 200, assignStatus({
      'hostname': hostname,
      'signed': true
    }));
  });
};

var removeRequest = function(req, res, hostname) {
  var castCA = ca.getCA();
  castCA.removeRequest(hostname, function(err) {
    if (err) {
      castHttp.returnError(res, 500, err.message);
      return;
    }
    castHttp.returnJson(res, 200, {
      'hostname': hostname,
      'status': 'Deleted'
    });
  });
};

exports.urls = route([
  ['GET /$', '1.0', listRequests],
  ['GET /(.+)/$', '1.0', getRequest],
  ['PUT /(.+)/$', '1.0', addRequest],
  ['POST /(.+)/sign/$', '1.0', signRequest],
  ['DELETE /(.+)/$', '1.0', removeRequest]
]);
