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

var exec = require('child_process').exec;
var sprintf = require('extern/sprintf').sprintf;
var log = require('util/log');

/**
 * Generates a Self signed X509 Certificate.
 *
 * @param {String} Hostname to generate the certficate for.
 * @param {String} Path to write the private key to.
 * @param {String} Path to write the certificate to.
 * @param {Function} Callback, first parameter is null on success, contains an error otherwise.
 */
exports.selfsigned = function(hostname, output_key, output_cert, cb)
{
  var cmd =  sprintf("openssl req -x509 -nodes -days 365 -subj '/CN=%s' -newkey rsa:2048 -keyout %s -out %s", 
                     hostname, output_key, output_cert);
  exec(cmd, function(err, stdout, stderr) {
    if (err) {
      log.err("openssl command failed: "+ cmd, err, stdout, stderr);
      cb(err);
    }
    cb(null);
  });
};
