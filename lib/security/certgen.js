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

var sprintf = require('sprintf').sprintf;

var log = require('util/log');
var config = require('util/config');

/**
 * Construct an x509 -subj argument from an options object.
 * @param {Object} options An options object with optional email and hostname.
 * @return {String} A string suitable for use with x509 as a -subj argument.
 */
function buildSubj(options) {
  var attrMap = {
    hostname: 'CN',
    email: 'emailAddress'
  };
  var subject = '';
  var key;

  for (key in attrMap) {
    if (attrMap.hasOwnProperty(key) && options.hasOwnProperty(key)) {
      subject = sprintf('%s/%s=%s', subject, attrMap[key], options[key]);
    }
  }

  return subject;
}

/**
 * Generates a Self signed X509 Certificate.
 *
 * @param {String} outputKey Path to write the private key to.
 * @param {String} outputCert Path to write the certificate to.
 * @param {Object} options An options object with optional email and hostname.
 * @param {Function} callback fired with (err).
 */
exports.genSelfSigned = function(outputKey, outputCert, options, callback) {
  var conf = config.get();
  var reqArgs = [
    '-batch',
    '-x509',
    '-nodes',
    sprintf('-days %d', conf['certgen_days']),
    sprintf('-subj "%s"', buildSubj(options)),
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
 * @param {String} outputKey Location to output the key to.
 * @param {Function} callback Callback fired with (err).
 */
exports.genKey = function(outputKey, callback) {
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
 * @param {String} inputKey File to read the key from.
 * @param {Object} options An options object with optional email and hostname.
 * @param {Function} callback Callback fired with (err, csrText).
 */
exports.getCSR = function(inputKey, options, callback) {
  var conf = config.get();
  var args = [
    '-batch',
    '-new',
    '-nodes',
    sprintf('-subj "%s"', buildSubj(options)),
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

/**
 * Initialize an openssl '.srl' file for serial number tracking.
 * @param {String} srlPath Path to use for the srl file.
 * @param {Function} callback Callback fired with (err).
 */
exports.initSerialFile = function(srlPath, callback) {
  fs.writeFile(srlPath, '00', callback);
};

/**
 * Sign a CSR and store the resulting certificate to the specified location
 * @param {String} csrPath Path to the CSR file.
 * @param {String} caCertPath Path to the CA certificate.
 * @param {String} caKeyPath Path to the CA key.
 * @param {String} caSerialPath Path to the CA serial number file.
 * @param {String} outputCert Path at which to store the certificate.
 * @param {Function} callback Callback fired with (err).
 */
exports.signCSR = function(csrPath, caCertPath, caKeyPath, caSerialPath, outputCert, callback) {
  var conf = config.get();
  var args = [
    '-req',
    sprintf('-days %s', conf['certgen_days']),
    sprintf('-CA "%s"', caCertPath),
    sprintf('-CAkey "%s"', caKeyPath),
    sprintf('-CAserial "%s"', caSerialPath),
    sprintf('-in %s', csrPath),
    sprintf('-out %s', outputCert)
  ];
  var cmd = sprintf('openssl x509 %s', args.join(' '));
  exec(cmd, function(err, stdout, stderr) {
    if (err) {
      log.err(sprintf('openssl command failed: %s', cmd), stdout, stderr);
    }
    callback(err);
  });
};
