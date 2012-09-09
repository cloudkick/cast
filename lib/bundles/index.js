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
var path = require('path');
var util = require('util');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var crypto = require('crypto');
var manifest = require('manifest');
var config = require('util/config');
var Errorf = require('util/misc').Errorf;
var fsutil = require('util/fs');
var locking = require('util/locking');
var extractTarball = require('util/tarball').extractTarball;
var HashedStream = require('util/hashedstream').HashedStream;
var jobs = require('jobs');
var managers = require('cast-agent/managers');


/**
 * Given the name of an application and the name of a bundle file, verify that
 * they match and return the version of the bundle file if so.
 * @param {String} app The name of the bundle application.
 * @param {String} file The name of the file.
 * @return {String|Boolean} The version of the bundle, or false if the name
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
 * Retrieve the name of a bundle.
 * @param {String} name The name of the application.
 * @param {String} version The version of the bundle.
 * @return {String} The name of the bundle.
 */
function getBundleName(name, version) {
  return sprintf('%s@%s', name, version);
}


/**
 * Manage application bundles.
 * @constructor
 */
function BundleManager() {
  locking.Lockable.call(this);
  var conf = config.get();
  this._bundleRoot = conf['bundle_dir'];
  this._extractedRoot = conf['extracted_dir'];
  this._inProgress = {};
}

util.inherits(BundleManager, locking.Lockable);


/**
 * Initialize directories used by the BundleManager.
 * @param {Function} callback A callback fired with (err).
 */
BundleManager.prototype.init = function(callback) {
  async.parallel([
    async.apply(fsutil.ensureDirectory, this._bundleRoot),
    async.apply(fsutil.ensureDirectory, this._extractedRoot)
  ], callback);
};


/**
 * Retrieve an application's bundle path.
 * @param {String} name The name of the application.
 * @return {String} The application's bundle path.
 */
BundleManager.prototype.getAppBundlePath = function(name) {
  return path.join(this._bundleRoot, name);
};


/**
 * Retrieve an application's extracted path.
 * @param {String} name The name of the application.
 * @return {String} The application's extracted path.
 */
BundleManager.prototype.getAppExtractedPath = function(name) {
  return path.join(this._extractedRoot, name);
};


/**
 * Retrieve the file name of a bundle.
 * @param {String} name The name of the application.
 * @param {String} version The version of the bundle.
 * @return {String} The name of the bundle file.
 */
BundleManager.prototype.getBundleFileName = function(name, version) {
  return sprintf('%s.tar.gz', getBundleName(name, version));
};


/**
 * Retrieve the path to a bundle file.
 * @param {String} name The name of the application.
 * @param {String} version The version of the bundle.
 * @return {String} The path to the bundle file.
 */
BundleManager.prototype.getBundleFilePath = function(name, version) {
  var appBundlePath = this.getAppBundlePath(name);
  var bundleFileName = this.getBundleFileName(name, version);
  return path.join(appBundlePath, bundleFileName);
};


/**
 * Retrieve the path to an extracted bundle.
 * @param {String} name The name of the application.
 * @param {String} version The version of the bundle.
 * @return {String} The path to the extracted bundle.
 */
BundleManager.prototype.getExtractedDirPath = function(name, version) {
  var appExtractedPath = this.getAppExtractedPath(name);
  var bundleName = getBundleName(name, version);
  return path.join(appExtractedPath, bundleName);
};


/**
 * Check whether a bundle exists.
 * @param {String} name The name of the application to check.
 * @param {String} version The version of the bundle to check.
 * @param {Function} callback A callback fired with (exists).
 */
BundleManager.prototype.bundleExists = function(name, version, callback) {
  path.exists(this.getBundleFilePath(name, version), callback);
};


/**
 * Ensure the directories necessary to accept bundles for an application
 * with the specified name.
 * @param {String} name The name of the application to ensure.
 * @param {Function} callback A callback fired with (err).
 */
BundleManager.prototype.ensureApplication = function(name, callback) {
  var self = this;

  function ensureAppBundleDir(callback) {
    fsutil.ensureDirectory(self.getAppBundlePath(name), callback);
  }

  function ensureAppExtractedDir(callback) {
    fsutil.ensureDirectory(self.getAppExtractedPath(name), callback);
  }

  async.parallel([ensureAppBundleDir, ensureAppExtractedDir], callback);
};


/**
 * Remove an application's directories if they are empty.
 * @param {String} name The name of the application to clean.
 * @param {Function} callback A callback fired with (err).
 */
BundleManager.prototype.cleanApplication = function(name, callback) {
  var self = this;

  function cleanAppBundleDir(callback) {
    fs.rmdir(self.getAppBundlePath(name), function(err) {
      if (err && err.code === 'ENOTEMPTY') {
        err = undefined;
      }
      callback(err);
    });
  }

  function cleanAppExtractedDir(callback) {
    fs.rmdir(self.getAppExtractedPath(name), function(err) {
      if (err && err.code === 'ENOTEMPTY') {
        err = undefined;
      }
      callback(err);
    });
  }

  // TODO: This is liable to cause problems on Windows
  async.parallel([cleanAppBundleDir, cleanAppExtractedDir], callback);
};


/**
 * Add a bundle from a streamed tarball.
 * @param {String} name The name of the bundle's application.
 * @param {String} version The version of the bundle.
 * @param {stream.Stream} iStream A stream to read the bundle from.
 * @param {Object} opts An (optional) object that may contain a 'getSHA1'
 *    'getSHA1' property, which is a function taking a callback that takes
 *    (err, sha1) - make sense?
 * @param {Function} callback A callback fired with (err).
 */
BundleManager.prototype.add = function(name, version, iStream, opts, callback) {
  if (!callback) {
    callback = opts;
    opts = {};
  }

  var self = this;
  var tmpFileManager = managers.getManager('TempFileManager');
  var bundleName = getBundleName(name, version);

  if (this._inProgress[bundleName]) {
    callback(new Errorf('Upload already in progress for %s', bundleName));
    return;
  }

  // Permanent paths for bundle and extracted
  var bundleFilePath = this.getBundleFilePath(name, version);
  var extractedDirPath = this.getExtractedDirPath(name, version);

  // Temporary paths for bundle and extracted
  var tmpBundle = tmpFileManager.allocate('.tar.gz');
  var tmpExtracted = tmpFileManager.allocate('');
  var tmpManifest = path.join(tmpExtracted, 'cast.json');

  this._inProgress[bundleName] = true;

  // Pipe the incoming stream to a paused HashedStream
  var hs = new HashedStream('sha1');
  hs.pause();
  iStream.pipe(hs);

  async.series([
    // Make sure no such bundle already exists
    // Note: by this point we have an in-memory lock on this bundle name
    function checkExists(callback) {
      self.bundleExists(name, version, function(exists) {
        if (exists) {
          callback(new jobs.AlreadyExistsError('Bundle', bundleName));
        } else {
          callback();
        }
      });
    },

    // Receive the actual stream
    function receiveStream(callback) {
      var fstream = fs.createWriteStream(tmpBundle);
      var received;

      hs.on('hash', function(sha1) {
        received = sha1.digest('base64');
      });

      fstream.on('error', function(err) {
        callback(err);
      });

      fstream.on('close', function() {
        if (opts.getSHA1) {
          opts.getSHA1(function(err, expected) {
            if (!err && received !== expected) {
              err = new Error('SHA1 mismatch');
              err.responseCode = 400;
            }
            callback(err);
            return;
          });
        } else {
          callback();
        }
      });

      hs.pipe(fstream);
      hs.resume();
    },

    // Extract the tarball to a temporary directory
    async.apply(extractTarball, tmpBundle, tmpExtracted, 0755),

    // Validate the manifest
    function(callback) {
      manifest.validateManifest(tmpManifest, function(err, manifestObject) {
        if (err) {
          err.responseCode = 400;
        }
        callback(err);
        return;
      });
    },

    // Lock the BundleManager while we operate on the actual bundle directories
    self.withLock.bind(self),

    // Make sure the application directories exist
    self.ensureApplication.bind(self, name),

    // Swap the new tarball into place
    async.apply(fs.rename, tmpBundle, bundleFilePath),

    // Swap the new extracted directory into place
    async.apply(fs.rename, tmpExtracted, extractedDirPath)
  ],
  function(err) {
    tmpFileManager.free(tmpBundle);
    tmpFileManager.free(tmpExtracted);
    delete self._inProgress[bundleName];
    self.cleanApplication(name, function() {
      // Release the BundleManager lock
      self.releaseLock();
      callback(err);
    });
  });
};


/**
 * Retrieve a stream containing a bundle file.
 * @param {String} name The name of the application.
 * @param {String} version The version of the application.
 * @param {Function} callback A callback fired with (err, version).
 */
BundleManager.prototype.getBundle = function(name, version, callback) {
  var bundleName = getBundleName(name, version);
  var bundleFilePath = this.getBundleFilePath(name, version);
  var oStream = fs.createReadStream(bundleFilePath);

  function onError(err) {
    if (err && err.code === 'ENOENT') {
      err = new jobs.NotFoundError('Bundle', bundleName);
    }
    callback(err);
  }

  oStream.on('error', onError);

  oStream.on('open', function() {
    oStream.removeListener('error', callback);
    callback(null, oStream);
  });
};


/**
 * Remove a bundle.
 * @param {String} name The name of the application to remove the bundle for.
 * @param {String} version The version of the bundle to remove.
 * @param {Function} callback A callback fired with (err).
 */
BundleManager.prototype.remove = function(name, version, callback) {
  var self = this;
  var locked = false;
  var tmpFileManager = managers.getManager('TempFileManager');
  var tmpExtractedPath = tmpFileManager.allocate('');
  var bundleName = getBundleName(name, version);
  var bundleFilePath = this.getBundleFilePath(name, version);
  var extractedDirPath = this.getExtractedDirPath(name, version);

  // Note: we rename() the extracted bundle into the temporary directory before
  // we remove it so that there will never be a half-removed extracted bundle.
  async.series([
    // Lock the BundleManager while we operate on live bundle directories
    self.withLock.bind(self),

    // Move extracted bundle to temporary directory
    function(callback) {
      locked = true;
      fs.rename(extractedDirPath, tmpExtractedPath, function(err) {
        if (err && err.code === 'ENOENT') {
          err = new jobs.NotFoundError('Bundle', bundleName);
        }
        callback(err);
      });
    },

    // Remove bundle file
    async.apply(fs.unlink, bundleFilePath),

    // Clean bundle directories, unlock
    function(callback) {
      self.cleanApplication(name, function(err) {
        self.releaseLock();
        locked = false;
        callback(err);
      });
    },

    // Remove the extracted bundle from tmp at our leisure
    async.apply(fsutil.rmtree, tmpExtractedPath)
  ],
  function(err) {
    if (locked) {
      self.releaseLock();
    }
    callback(err);
  });
};


/**
 * Retrieve data about an application.
 *   {
 *     'name: 'foo',
 *     'bundles': [
 *       'foo@v1.0.tar.gz',
 *       'foo@v2.0.tar.gz'
 *     ]
 *   }
 * @param {String} name The name of the application.
 * @param {Function} callback A callback fired with (err, files).
 */
BundleManager.prototype.getApplication = function(name, callback) {
  var bundlePath = this.getAppBundlePath(name);
  fs.readdir(bundlePath, function(err, files) {
    if (err && err.code === 'ENOENT') {
      callback(new jobs.NotFoundError('BundleApplication', name));
    } else if (err) {
      callback(err);
    } else {
      
      // readdir is unsorted on some OSs (Debian/Ubuntu)
      callback(null, {
        name: name,
        bundles: files.sort() 
      });
    }
  });
};


/**
 * Retrieve a list of data for all applications.
 * @param {Function} callback A callback fired with (err, apps).
 */
BundleManager.prototype.listApplications = function(callback) {
  var self = this;

  fs.readdir(this._bundleRoot, function(err, files) {
    async.map(files, self.getApplication.bind(self), callback);
  });
};


exports.getBundleVersion = getBundleVersion;
exports.getBundleName = getBundleName;
exports.BundleManager = BundleManager;
