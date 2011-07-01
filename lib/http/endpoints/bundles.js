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

var control = require('control');
var castHttp = require('util/http');
var requiredParams = require('http/middleware/required-params').attachMiddleware;


/**
 * Given the name of an application and the name of a bundle file, verify that
 * they match and return the version of the bundle file if so.
 * @param {String} app The name of the bundle application.
 * @param {String} file The name of the file.
 * @returns {String|Boolean} The version of the bundle, or false if the name
 *    and file do not match.
 */
function getBundleVersion(app, file) {
  var pattern = sprintf('^%s@(.*).tar.gz$', app);
  var result = file.match(pattern);

  if (!result) {
    return false;
  } else {
    return result[1];
  }
}


/**
 * Receive an uploaded bundle file and extract it. This attempts to be as asfe
 * as possible by performing all validation before any destructive actions are
 * taken against existing data, however failed rmtrees (which aren't all that
 * robust) can still cause data loss.
 *
 * @param {http.ServerRequest} req  The HTTP request to read from.
 * @param {http.ServerResponse} res The HTTP response to respond on.
 */
function upload(req, res) {
  var app = req.params.app;
  var file = req.params.file;
  var version = getBundleVersion(app, file);
  var getSHA1 = null;

  if (req.headers['trailer'] === 'x-content-sha1') {
    getSHA1 = function(callback) {
      if (!req.trailers['x-content-sha1']) {
        callback(new Error('Missing x-content-sha1 trailer'));
      } else {
        callback(null, req.trailers['x-content-sha1']);
      }
    };
  } else if (req.header['x-content-sha1']) {
    getSHA1 = function(callback) {
      callback(null, req.headers['x-content-sha1']);
    };
  }

  control.bundles.addBundle(app, version, req, getSHA1, function(err) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      res.writeHead(204, {});
      res.end();
    }
  });
}


function register(app, apiVersion) {
  //app.get('/', listBundles);
  //app.get('/:app/', listFiles);
  //app.get('/:app/:file', download);
  app.put('/:app/:file', upload);
  //app.del('/:app/:file', requiredParams(['bundle_type']), remove);
}

exports.register = register;
