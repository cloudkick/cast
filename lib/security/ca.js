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

var fs = require('fs');
var sys = require('sys');
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var log = require('/util/log');
var misc = require('util/misc');
var Errorf = require('util/misc').Errorf;
var config = require('util/config');
var fsutil = require('util/fs');
var locking = require('util/locking');
var norris = require('norris');
var certgen = require('security/certgen');

/**
 * Keeps a reference to the CA once its initialized.
 * @type {Object} The CA object.
 */
var currentCA = null;

/**
 * A certificate authority that mostly calls out to the openssl command line
 * utility via the certgen module.
 * @constructor
 * @extends {util.locking.Lockable}
 */
function CA() {
  locking.Lockable.call(this);
  var conf = config.get();
  this.root = conf['ca_dir'];
  this.cert = conf['ssl_ca_cert'];
  this.key = conf['ssl_ca_key'];
  this.serial = conf['ssl_ca_serial'];
  this.outdir = conf['ssl_ca_outdir'];
}
sys.inherits(CA, locking.Lockable);

/**
 * Perform any necessary initialization, including on-disk initialization that
 * has not yet been performed. This isn't in the constructor to avoid oddness
 * surrounding asynchronous constructors.
 * @param {Function} callback A callback called with (err).
 */
CA.prototype.init = function(callback) {
  var self = this;
  async.series([
    function(callback) {
      self.withLock(callback);
    },

    // If the CA directory doesn't exist, create and chmod it
    function(callback) {
      path.exists(self.root, function(exists) {
        if (!exists) {
          fsutil.ensureDirectory(self.root, function(err) {
            if (err) {
              callback(err);
            } else {
              fs.chmod(self.root, 0700, callback);
            }
          });
        } else {
          callback();
        }
      });
    },

    // Ensure the output directory
    function(callback) {
      fsutil.ensureDirectory(self.outdir, callback);
    },

    // Create a CA key and cert if the cert is not present.
    function(callback) {
      path.exists(self.cert, function(exists) {
        if (!exists) {
          norris.get(function(facts) {
            var options = {
              hostname: facts.hostname
            };
            certgen.genSelfSigned(self.key, self.cert, options, callback);
          });
        } else {
          callback();
        }
      });
    },

    // Initialize the serial number counter
    function(callback) {
      path.exists(self.serial, function(exists) {
        if (!exists) {
          certgen.initSerialFile(self.serial, callback);
        } else {
          callback();
        }
      });
    }
  ],
  function(err) {
    self.releaseLock();
    callback(err);
  });
};

/**
 * Get the hypothetical path to a CSR for a hostname.
 * @param {String} hostname The hostname the CSR is indexed by.
 * @return {String} The path to CSR file (which may not exist).
 */
CA.prototype._csrPath = function(hostname) {
  return path.join(this.outdir, sprintf('%s.csr', hostname));
};


/**
 * Get the hypothetical path to a certificate for a hostname.
 * @param {String} hostname The hostname the certificate is indexed by.
 * @return {String} The path to certificate file (which may not exist).
 */
CA.prototype._certPath = function(hostname) {
  return path.join(this.outdir, sprintf('%s.crt', hostname));
};

/**
 * Add a request to the CA. Requests are indexed by 'hostname', and cannot be
 * replaced, so if a request with the specified hostname already exists this
 * will pass an error to the callback.
 * @param {String} hostname A hostname to index the request by.
 * @param {String} csr Text of a PEM encoded CSR.
 * @param {Function} callback A callback fired with (err).
 */
CA.prototype.addRequest = function(hostname, csr, callback) {
  var self = this;
  var csrPath = this._csrPath(hostname);
  var csrWritten = false;
  async.series([
    // Lock the CA
    function(callback) {
      self.withLock(callback);
    },

    // Make sure no such request exists
    function(callback) {
      path.exists(csrPath, function(exists) {
        if (exists) {
          callback(new Errorf('CSR for %s already exists', hostname));
        } else {
          callback();
        }
      });
    },

    // Save this request
    function(callback) {
      fs.writeFile(csrPath, csr, function(err) {
        if (!err) {
          csrWritten = true;
        }
        callback(err);
      });
    },

    // Verify this request
    async.apply(certgen.verifyCSR, csrPath)
  ],
  function(err) {
    // Don't leave the CSR file lying around if there was an error
    if (err && csrWritten) {
      fs.unlink(csrPath, function(err) {
        if (err) {
          log.err(sprintf('Unable to remove invalid CSR: %s', csrPath));
        }
        self.releaseLock();
        callback();
      });
    } else {
      self.releaseLock();
      callback(err);
    }
  });
};

/**
 * Retrieve the CA object. To enforce locking there will only ever be one of
 * these objects.
 * @return {Obect} The CA object.
 * @export
 */
function getCA() {
  if (!currentCA) {
    currentCA = new CA();
  }
  return currentCA;
}

exports.getCA = getCA;
