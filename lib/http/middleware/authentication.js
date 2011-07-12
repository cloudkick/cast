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

var httpUtil = require('util/http');
var httpConstants = require('http/constants');
var config = require('util/config');
var log = require('util/log');

function attachMiddleware() {
  return function(req, res, next) {
    var conf = config.get();
    var isCSRUpload = ((req.method === httpConstants.CA_RETRIEVE_REQUEST_METHOD ||
                        req.method === httpConstants.CA_SUBMIT_REQUEST_METHOD) &&
                        req.url.match(httpConstants.CA_REQUEST_PATH_RE));
    var socket = conf['ssl_enabled'] ?
        req.client.pair.cleartext.socket : req.socket;
    var clientIP = socket.remoteAddress;
    var ct;

    if (conf['ssl_enabled']) {
      ct = req.client.pair.cleartext;

      if (isCSRUpload) {
        // CSR uploads are allowed through without a valid certificate
        log.info(sprintf('Received CSR request from %s', clientIP));
      } else if (conf['verify_client_cert'] && !ct.authorized) {
        // Other requests may not proceed with an invalid certificate
        log.info(sprintf('Invalid certificate from %s', clientIP));

        if (conf['warn_unauthorized']) {
          // Be nice, tell the client what went wrong
          httpUtil.returnJson(res, 401, {
            'message': sprintf('Certificate verification error: %s', ct.authorizationError)
          });
        } else {
          // Silent rejection
          req.destroy();
        }

        return;
      }
    }

    next();
  };
}

exports.attachMiddleware = attachMiddleware;
