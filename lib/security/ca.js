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
var constants = require('constants');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var log = require('util/log');
var misc = require('util/misc');
var Errorf = require('util/misc').Errorf;
var config = require('util/config');
var fsutil = require('util/fs');
var locking = require('util/locking');
var norris = require('norris');
var certgen = require('security/certgen');

/**
 * Note: Make __very__ sure that no one can ever upload to (or retrieve from) a
 * path outside of the 'outdir' or overwrite anything in it. The first two of
 * these might be best implemented with a more robust URL handler on the REST
 * API, as we run into this in a few places.
 */

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
 * Get the hypothetical path to the directory that CSRs and certificates are
 * stored in for a given hostname.
 * @param {String} hostname The hostname to lookup.
 * @return {String} Path to the directory output is stored in for the host.
 */
CA.prototype._getHostDir = function(hostname) {
  return path.join(this.outdir, hostname);
};

/**
 * Get the hypothetical path to a CSR for a hostname.
 * @param {String} hostname The hostname the CSR is indexed by.
 * @return {String} The path to CSR file (which may not exist).
 */
CA.prototype._getCSRPath = function(hostname) {
  return path.join(this._getHostDir(hostname), 'client.csr');
};


/**
 * Get the hypothetical path to a certificate for a hostname.
 * @param {String} hostname The hostname the certificate is indexed by.
 * @return {String} The path to certificate file (which may not exist).
 */
CA.prototype._getCRTPath = function(hostname) {
  return path.join(this._getHostDir(hostname), 'client.crt');
};


/**
 * Check whether a request exists for the given hostname.
 * @param {String} hostname The hostname to check for.
 * @param {Function} callback A callback fired with (exists).
 */
CA.prototype._hasRequest = function(hostname, callback) {
  var hostDir = this._getHostDir(hostname);
  path.exists(hostDir, callback);
};

/**
 * Get a list of request objects that include a hostname and a 'signed'
 * boolean.
 * @param {Function} callback A callback fired with (err, requests).
 */
CA.prototype.listRequests = function(callback) {
  var self = this;
  var requests = [];
  async.waterfall([
    // Lock the CA.
    function(callback) {
      self.withLock(callback);
    },

    // List all host directories
    function(callback) {
      fs.readdir(self.outdir, callback);
    },

    // Check for a certificate for each host
    function(files, callback) {
      function checkRequest(hostname, callback) {
        var crtPath = self._getCRTPath(hostname);
        path.exists(crtPath, function(exists) {
          requests.push({
            hostname: hostname,
            signed: exists
          });
          callback();
        });
      }

      async.forEach(files, checkRequest, callback);
    }
  ],
  function(err) {
    self.releaseLock();
    callback(err, requests);
  });
};

/**
 * Retrieve the text of a CSR.
 * @param {String} hostname Hostname to retrieve the CSR for.
 * @param {Function} callback Callback fired with (err, text).
 */
CA.prototype._getRequestText = function(hostname, callback) {
  var csrPath = this._getCSRPath(hostname);
  fs.readFile(csrPath, 'utf8', callback);
};

/**
 * Retrieve the text of a certificate. If the certificate simply doesn't
 * exist, no error is bassed back, the text is simply null.
 * @param {String} hostname Hostname to retrieve the certificate for.
 * @param {Function} callback Callback fired with (err, text).
 */
CA.prototype._getCertificateText = function(hostname, callback) {
  var crtPath = this._getCRTPath(hostname);
  fs.readFile(crtPath, 'utf8', function(err, text) {
    // Ignore non-existant certificate text errors
    if (err && err.errno === constants.ENOENT) {
      err = undefined;
      text = null;
    }
    callback(err, text);
  });
};

/**
 * Add a request to the CA. Requests are indexed by 'hostname', and cannot be
 * replaced, so if a request with the specified hostname already exists and the
 * text doesn't match that provided, an error will be passed back. If an
 * identical request already exists and has been signed, the text of the cert
 * will be passed back to the callback.
 * @param {String} hostname A hostname to index the request by.
 * @param {String} csr Text of a PEM encoded CSR.
 * @param {Function} callback A callback fired with (err, reqStatus).
 */
CA.prototype.addRequest = function(hostname, csr, callback) {
  var self = this;
  var hostDir = this._getHostDir(hostname);
  var csrPath = this._getCSRPath(hostname);
  var certText = null;
  var mustStore = true;
  var dirCreated = false;
  var EUNREADABLE = 'CSR for %s already exists but cannot be read: %s';
  var EMISMATCH = 'CSR for %s already exists but does not match provided one';
  async.waterfall([
    // Lock the CA
    function(callback) {
      self.withLock(callback);
    },

    // See if a request already exists for this host
    function(callback) {
      self._hasRequest(hostname, function(exists) {
        callback(null, exists);
      });
    },

    // If a request already exists, see if it matches this one
    function(exists, callback) {
      if (exists) {
        self._getRequestText(hostname, function(err, existingCSR) {
          if (err) {
            // Error reading existing CSR
            callback(new Errorf(EUNREADABLE, hostname, err.message));
          } else if (csr !== existingCSR) {
            // Mismatch with existing CSR
            callback(new Errorf(EMISMATCH, hostname));
          } else {
            // CSR matches existing
            mustStore = false;
            callback();
          }
        });
      } else {
        callback();
      }
    },

    // Create the host directory
    function(callback) {
      if (mustStore) {
        fs.mkdir(hostDir, 0700, function(err) {
          if (!err) {
            dirCreated = true;
          }
          callback(err);
        });
      } else {
        callback();
      }
    },

    // Save this request
    function(callback) {
      if (mustStore) {
        fs.writeFile(csrPath, csr, callback);
      } else {
        callback();
      }
    },

    // Verify this request
    function(callback) {
      if (mustStore) {
        certgen.verifyCSR(csrPath, callback);
      } else {
        callback();
      }
    },

    // Read back the certificate if one exists
    function(callback) {
      self._getCertificateText(hostname, function(err, text) {
        certText = text;
        callback(err);
      });
    }
  ],
  function(err) {
    // Don't leave the CSR file lying around if there was an error
    if (err && dirCreated) {
      fsutil.rmtree(hostDir, function(cleanupErr) {
        if (cleanupErr) {
          log.err(sprintf('Error removing invalid CSR: %s', hostDir));
        }
        self.releaseLock();
        callback(err);
      });
    } else if (err) {
      self.releaseLock();
      callback(err);
    } else {
      self.releaseLock();
      callback(null, {
        hostname: hostname,
        signed: Boolean(certText),
        cert: certText
      });
    }
  });
};

/**
 * Remove a request (and certificate, if one exists) from the CA.
 * @param {String} hostname The hostname to remove the request for.
 * @param {Function} callback A callback fired with (err).
 */
// @TODO: Why do we have remove signed here?
CA.prototype.removeRequest = function(hostname, removeSigned, callback) {
  var self = this;
  var hostDir = this._getHostDir(hostname);
  var crtPath = this._getCRTPath(hostname);

  async.series([
    // Lock the CA
    function(callback) {
      self.withLock(callback);
    },

    // Make sure the request exists
    function(callback) {
      path.exists(hostDir, function(exists) {
        if (!exists) {
          callback(new Errorf('No request for \'%s\'', hostname));
        } else {
          callback();
        }
      });
    },

    // Check whether the request was signed
    function(callback) {
      path.exists(crtPath, function(exists) {
        if (!removeSigned && exists) {
          callback(new Errorf('Request for \'%s\' is already signed',
                              hostname));
        } else {
          callback();
        }
      });
    },

    // Remove the request directory and its contents
    function(callback) {
      fsutil.rmtree(hostDir, callback);
    }
  ],
  function(err) {
    self.releaseLock();
    callback(err);
  });
};

/**
 * Sign a request for a specified hostname.
 * @param {String} hostname The hostname to sign the request for.
 * @param {Boolean} overwrite Whether to overwrite an existing certificate.
 * @param {Function} callback A callback fired with (err).
 */
CA.prototype.signRequest = function(hostname, overwrite, callback) {
  var self = this;
  var csrPath = this._getCSRPath(hostname);
  var crtPath = this._getCRTPath(hostname);
  async.series([
    // Lock the CA
    function(callback) {
      self.withLock(callback);
    },

    // Verify that the CSR exists
    function(callback) {
      path.exists(csrPath, function(exists) {
        if (!exists) {
          callback(new Errorf('No CSR exists for %s', hostname));
        } else {
          callback();
        }
      });
    },

    // Verify the certificate doesn't already exist, unless 'overwrite' is set
    function(callback) {
      if (!overwrite) {
        path.exists(crtPath, function(exists) {
          if (exists) {
            callback(new Errorf('Certificate already exists for %s', hostname));
          } else {
            callback();
          }
        });
      } else {
        callback();
      }
    },

    // Sign the request
    function(callback) {
      certgen.signCSR(csrPath, self.cert, self.key, self.serial, crtPath,
                      callback);
    }
  ],
  function(err) {
    self.releaseLock();
    callback(err);
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
