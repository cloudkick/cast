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
var fs = require('fs');

var sprintf = require('extern/sprintf').sprintf;

var log = require('util/log');
var config = require('util/config');

/**
 * Generates a Self signed X509 Certificate.
 *
 * @param {String} hostname Hostname to generate the certficate for.
 * @param {String} outputKey Path to write the private key to.
 * @param {String} outputCert Path to write the certificate to.
 * @param {Function} callback fired with (err).
 */
var genSelfSigned = function(hostname, outputKey, outputCert, callback) {
  var conf = config.get();
  var reqArgs = [
    '-batch',
    '-x509',
    '-nodes',
    sprintf('-days %d', conf['certgen_days']),
    sprintf('-subj "/CN=%s"', hostname),
    '-sha1',
    sprintf('-newkey rsa:%d', conf['certgen_size']),
    sprintf('-keyout "%s"', outputKey),
    sprintf('-out "%s"', outputCert)
  ];
  var cmd = 'openssl req ' + reqArgs.join(' ');
  exec(cmd, function(err, stdout, stderr) {
    if (err) {
      log.err('openssl command failed: ' + cmd, err, stdout, stderr);
    }
    callback(err);
  });
};

/**
 * Generate an RSA key.
 *
 * @param {String} outputKey Location to output the key to.
 * @param {Function} callback Callback fired with (err).
 */
var genKey = function(outputKey, callback) {
  var conf = config.get();
  var args = [
    sprintf('-out "%s"', outputKey),
    conf['certgen_size']
  ];
  var cmd = 'openssl genrsa ' + args.join(' ');
  exec(cmd, function(err, stdout, stderr) {
    if (err) {
      log.err('openssl command failed: ' + cmd, stdout, stderr);
    }
    callback(err);
  });
};

/**
 * Generate a CSR for the specified key, and pass it back as a string through
 * a callback.
 *
 * @param {String} hostname Hostname to be used as CN.
 * @param {String} inputKey File to read the key from.
 * @param {Function} callback Callback fired with (err, csrText).
 */
var getCSR = function(hostname, inputKey, callback) {
  var conf = config.get();
  var args = [
    '-batch',
    '-new',
    '-nodes',
    sprintf('-subj "/CN=%s"', hostname),
    sprintf('-key "%s"', inputKey)
  ];
  var cmd = 'openssl req ' + args.join(' ');
  exec(cmd, function(err, stdout, stderr) {
    if (err) {
      log.err('openssl command failed: ' + cmd, stdout, stderr);
      callback(err);
    } else {
      callback(null, stdout);
    }
  });
};

exports.genSelfSigned = genSelfSigned;
exports.genKey = genKey;
exports.getCSR = getCSR;
