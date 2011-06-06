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

var async = require('async');

var Errorf = require('util/misc').Errorf;
var config = require('util/config');
var fsutil = require('util/fs');
var norris = require('norris');
var certgen = require('security/certgen');
var jobs = require('jobs');
var managers = require('cast-agent/managers');


/**
 * Resource class for a Certificate Signing Request.
 * @extends {jobs.Resource}
 * @param {String} name The name of this CSR.
 */
function SigningRequest(name) {
  jobs.DirectoryResource.call(this, name);
  this._serializer = managers.getSerializer();
}

sys.inherits(SigningRequest, jobs.DirectoryResource);


/**
 * @inheritdoc
 */
SigningRequest.prototype.getSerializerDef = function() {
  return [
    ['name', {
      src: 'name',
      type: 'string'
    }],
    ['csr', {
      src: 'getRequestText',
      type: 'string'
    }],
    ['cert', {
      src: 'getCertificateText',
      type: 'string'
    }]
  ];
};


/**
 * @inheritdoc
 */
SigningRequest.prototype.getParentDir = function() {
  return config.get()['ssl_ca_outdir'];
};


/**
 * Get the hypothetical path to the CSR file.
 * @return {String} The path to CSR file (which may not exist).
 */
SigningRequest.prototype.getCSRPath = function() {
  return path.join(this.getRoot(), 'client.csr');
};


/**
 * Get the hypothetical path to the certificate file.
 * @return {String} The path to certificate file (which may not exist).
 */
SigningRequest.prototype.getCRTPath = function() {
  return path.join(this.getRoot(), 'client.crt');
};


/**
 * Retrieve the text of the CSR.
 * @param {Function} callback Callback fired with (err, text).
 */
SigningRequest.prototype.getRequestText = function(callback) {
  fs.readFile(this.getCSRPath(), 'utf8', callback);
};


/**
 * Retrieve the text of the certificate. If the certificate simply doesn't
 * exist, no error is bassed back, the text is simply null.
 * @param {Function} callback Callback fired with (err, text).
 */
SigningRequest.prototype.getCertificateText = function(callback) {
  fs.readFile(this.getCRTPath(), 'utf8', function(err, text) {
    // Ignore non-existant certificate text errors
    if (err && err.errno === constants.ENOENT) {
      err = undefined;
      text = null;
    }
    callback(err, text);
  });
};


/**
 * Create this request with the given CSR text. If an attempt to verify the CSR
 * fails the entire.
 * @param {String} csr Text of a PEM encoded CSR.
 * @param {Function} callback A callback fired with (err).
 */
SigningRequest.prototype.create = function(csr, callback) {
  var self = this;

  function createRoot(callback) {
    fs.mkdir(self.getRoot(), 0700, callback);
  }

  function writeCSR(callback) {
    fs.writeFile(self.getCSRPath(), csr, callback);
  }

  function verifyCSR(callback) {
    certgen.verifyCSR(self.getCSRPath(), callback);
  }

  async.series([createRoot, writeCSR, verifyCSR], function(err) {
    if (err) {
      fsutil.rmtree(self.getRoot(), function() {
        callback(err);
      });
    } else {
      callback();
    }
  });
};


/**
 * Sign this request. If this request has already been signed and 'overwrite'
 * is not specified this will fail.
 * @param {Boolean} overwrite Should an existing cert be overwritten?
 * @param {Function} callback A callback fired with (err).
 */
SigningRequest.prototype.sign = function(overwrite, callback) {
  var self = this;

  function verifyNoExist(callback) {
    path.exists(self.getCRTPath(), function(exists) {
      if (exists) {
        callback(new Errorf('Certificate already exists for %s', self.name));
      } else {
        callback();
      }
    });
  }

  function doSigning(callback) {
    var conf = config.get();
    var csr = self.getCSRPath();
    var cert = conf['ssl_ca_cert'];
    var key = conf['ssl_ca_key'];
    var serial = conf['ssl_ca_serial'];
    var outCert = self.getCRTPath();
    certgen.signCSR(csr, cert, key, serial, outCert, callback);
  }

  var operations = [doSigning];

  if (!overwrite) {
    operations.unshift(verifyNoExist);
  }

  async.series(operations, function(err, results) {
    callback(err);
  });
};


/**
 * Remove an unsigned request.
 * @param {Function} callback A callback fired with (err).
 */
SigningRequest.prototype.destroy = function(callback) {
  var self = this;

  function verifyNoExist(callback) {
    path.exists(self.getCRTPath(), function(exists) {
      if (exists) {
        callback(new Errorf('Certificate already exists for %s', self.name));
      } else {
        callback();
      }
    });
  }

  function destroy(callback) {
    fsutil.rmtree(self.getRoot(), callback);
  }

  async.series([verifyNoExist, destroy], function(err, results) {
    callback(err);
  });
};


/**
 * A certificate authority that mostly calls out to the openssl command line
 * utility via the certgen module.
 * @constructor
 */
function SigningRequestManager() {
  jobs.ResourceManager.call(this);
  this.resourceType = SigningRequest;

  var conf = config.get();
  this.root = conf['ca_dir'];
  this.cert = conf['ssl_ca_cert'];
  this.key = conf['ssl_ca_key'];
  this.serial = conf['ssl_ca_serial'];
  this.outdir = conf['ssl_ca_outdir'];
}
sys.inherits(SigningRequestManager, jobs.ResourceManager);

/**
 * Perform any necessary initialization, including on-disk initialization that
 * has not yet been performed.
 * @param {Function} callback A callback called with (err).
 */
SigningRequestManager.prototype.init = function(callback) {
  var self = this;

  // If the CA directory doesn't exist, create and chmod it
  function makeRoot(callback) {
    path.exists(self.root, function(exists) {
      if (exists) {
        callback();
        return;
      }

      fsutil.ensureDirectory(self.root, function(err) {
        if (err) {
          callback(err);
        } else {
          fs.chmod(self.root, 0700, callback);
        }
      });
    });
  }

  // Ensure the output directory
  function ensureOutdir(callback) {
    fsutil.ensureDirectory(self.outdir, callback);
  }

  // Create a CA key and cert if the cert is not present.
  function genPair(callback) {
    path.exists(self.cert, function(exists) {
      if (exists) {
        callback();
        return;
      }

      norris.get(function(facts) {
        var options = {
          hostname: facts.hostname
        };
        certgen.genSelfSigned(self.key, self.cert, options, callback);
      });
    });
  }

  // Initialize the serial number counter
  function initSerial(callback) {
    path.exists(self.serial, function(exists) {
      if (!exists) {
        certgen.initSerialFile(self.serial, callback);
      } else {
        callback();
      }
    });
  }

  async.series([makeRoot, ensureOutdir, genPair, initSerial], callback);
};


exports.SigningRequest = SigningRequest;
exports.SigningRequestManager = SigningRequestManager;
