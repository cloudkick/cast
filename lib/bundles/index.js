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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var crypto = require('crypto');
var manifest = require('manifest');
var config = require('util/config');
var Errorf = require('util/misc').Errorf;
var fsutil = require('util/fs');
var extractTarball = require('util/tarball').extractTarball;
var HashedStream = require('util/hashedstream').HashedStream;
var jobs = require('jobs');
var managers = require('cast-agent/managers');


/**
 * Manage application bundles.
 * @constructor
 */
function BundleManager() {
  var conf = config.get();
  this.bundleRoot = conf['bundle_dir'];
  this.extractedRoot = conf['extracted_dir'];
  this.inProgress = {};
}


/**
 * Initialize directories used by the BundleManager.
 * @param {Function} callback A callback fired with (err).
 */
BundleManager.prototype.init = function(callback) {
  async.parallel([
    async.apply(fsutil.ensureDirectory, this.bundleRoot),
    async.apply(fsutil.ensureDirectory, this.extractedRoot)
  ], callback);
};


/**
 * Retrieve an application's bundle path.
 * @param {String} name The name of the application.
 * @returns {String} The application's bundle path.
 */
BundleManager.prototype.getAppBundlePath = function(name) {
  return path.join(this.bundleRoot, name);
};


/**
 * Retrieve an application's extracted path.
 * @param {String} name The name of the application.
 * @returns {String} The application's extracted path.
 */
BundleManager.prototype.getAppExtractedPath = function(name) {
  return path.join(this.extractedRoot, name);
};


/**
 * Retrieve the name of a bundle.
 * @param {String} name The name of the application.
 * @param {String} version The version of the bundle.
 * @returns {String} The name of the bundle.
 */
BundleManager.prototype.getBundleName = function(name, version) {
  return sprintf('%s@%s', name, version);
};


/**
 * Retrieve the file name of a bundle.
 * @param {String} name The name of the application.
 * @param {String} version The version of the bundle.
 * @returns {String} The name of the bundle file.
 */
BundleManager.prototype.getBundleFileName = function(name, version) {
  return sprintf('%s.tar.gz', this.getBundleName(name, version));
};


/**
 * Retrieve the path to a bundle file.
 * @param {String} name The name of the application.
 * @param {String} version The version of the bundle.
 * @returns {String} The path to the bundle file.
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
 * @returns {String} The path to the extracted bundle.
 */
BundleManager.prototype.getExtractedDirPath = function(name, version) {
  var appExtractedPath = this.getAppExtractedPath(name);
  var bundleName = this.getBundleName(name, version);
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
 * Add a bundle from a streamed tarball.
 * @param {String} name The name of the bundle's application.
 * @param {String} version The version of the bundle.
 * @param {Object} opts An (optional) object that may contain a 'getSHA1'
 *    'getSHA1' property, which is a function taking a callback that takes
 *    (err, sha1) - make sense?
 * @param {stream.Stream} iStream A stream to read the bundle from.
 */
BundleManager.prototype.add = function(name, version, iStream, opts, callback) {
  if (!callback) {
    callback = opts;
    opts = {};
  }

  var self = this;
  var tmpFileManager = managers.getManager('TempFileManager');
  var bundleName = this.getBundleName(name, version);

  if (this.inProgress[bundleName]) {
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

  this.inProgress[bundleName] = true;

  // Pipe the incoming stream to a paused HashedStream
  var hs = new HashedStream('sha1');
  hs.pause();
  iStream.pipe(hs);

  async.series([
    // Make sure the application directories exist
    self.ensureApplication.bind(self, name),

    // Make sure no such bundle already exists
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
              err.code = 400;
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
          err.code = 400;
        }
        callback(err);
        return;
      });
    },

    // Swap the new tarball into place
    async.apply(fs.rename, tmpBundle, bundleFilePath),

    // Swap the new extracted directory into place
    async.apply(fs.rename, tmpExtracted, extractedDirPath)
  ],
  function(err) {
    tmpFileManager.free(tmpBundle);
    tmpFileManager.free(tmpExtracted);
    delete self.inProgress[bundleName];
    callback(err);
  });
};


exports.BundleManager = BundleManager;
