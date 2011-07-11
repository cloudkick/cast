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

var util = require('util');

var sprintf = require('sprintf').sprintf;

var control = require('control');
var bundles = require('bundles');
var castHttp = require('util/http');
var requiredParams = require('http/middleware/required-params').attachMiddleware;


var listApplications = castHttp.wrapCall(control.bundles.listApplications);
var getApplication = castHttp.wrapCall(control.bundles.getApplication, ['app']);


function InvalidPathError() {
  Error.captureStackTrace(this, InvalidPathError);
  this.name = 'InvalidPathError';
  this.message = 'Invalid bundle path';
  this.responseCode = 404;
}

util.inherits(InvalidPathError, Error);


function addBundle(req, res) {
  var app = req.params.app;
  var file = req.params.file;
  var version = bundles.getBundleVersion(app, file);
  var getSHA1 = null;

  if (!version) {
    castHttp.returnError(res, new InvalidPathError());
    return;
  }

  if (req.headers['trailer'] === 'x-content-sha1') {
    getSHA1 = function(callback) {
      if (!req.trailers['x-content-sha1']) {
        callback(new Error('Missing x-content-sha1 trailer'));
      } else {
        callback(null, req.trailers['x-content-sha1']);
      }
    };
  } else if (req.headers['x-content-sha1']) {
    getSHA1 = function(callback) {
      callback(null, req.headers['x-content-sha1']);
    };
  }

  control.bundles.addBundle(app, version, req, getSHA1, function(err) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      res.writeHead(204);
      res.end();
    }
  });
}


function getBundle(req, res) {
  var app = req.params.app;
  var file = req.params.file;
  var version = bundles.getBundleVersion(app, file);

  if (!version) {
    castHttp.returnError(res, new InvalidPathError());
    return;
  }

  control.bundles.getBundle(app, version, function(err, bundleStream) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream'
      });
      bundleStream.pipe(res);
    }
  });
}


function removeBundle(req, res) {
  var app = req.params.app;
  var file = req.params.file;
  var version = bundles.getBundleVersion(app, file);

  if (!version) {
    castHttp.returnError(res, new InvalidPathError());
    return;
  }

  control.bundles.removeBundle(app, version, function(err) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      res.writeHead(204);
      res.end();
    }
  });
}


function register(app, apiVersion) {
  app.get('/', listApplications);
  app.get('/:app/', getApplication);
  app.put('/:app/:file', addBundle);
  app.get('/:app/:file', getBundle);
  app.del('/:app/:file', removeBundle);
}


exports.register = register;
