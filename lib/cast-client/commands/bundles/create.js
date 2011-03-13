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

var sys = require('sys');
var fs = require('fs');
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var tarball = require('util/tarball');
var misc = require('util/misc');
var locking = require('util/locking');
var spinner = require('util/spinner');
var dotfiles = require('util/client_dotfiles');
var fsutil = require('util/fs');

var uploadCommand = require('cast-client/commands/bundles/upload');

var manifest = require('manifest/index');
var manifestConstants = require('manifest/constants');

/** Configuration options for create subcommand */
exports.config = {
  shortDescription: 'Create an save the application bundle',
  longDescription: 'Create an application bundle. If you don\'t specify the app or ' +
                      'bundle path, the current working directory is used.',
  requiredArguments : [['version', 'Application version number']],
  optionalArguments: [['apppath', 'Path to folder containing the cast.json file and your application files']],
  options: [
    {
      names: ['--upload', '-u'],
      dest: 'upload',
      action: 'store_true',
      desc: 'Upload a bundle to the server after it is created'
    }
  ]
};

/**
 * Handler for creating a bundle.
 * @param {Object} args Command line arguments.
 * @param {String} args.version Application version number to create.
 * @param {String} [args.apppath=process.cwd()] Application path to operate on.
 */
exports.handleCommand = function(args)
{
  var applicationPath = args.apppath || process.cwd();
  var manifestFile = path.join(applicationPath, manifestConstants.MANIFEST_FILENAME);
  var dotCastProject;
  var bundleDirPath;
  var bundleName;
  var tarballName;

  async.waterfall([
    // Check that user provided a valid version
    function(callback) {
      if (!misc.isValidBundleVersion(args.version)) {
        callback(new Error('Provided version string is invalid'));
        return;
      }

      callback();
    },

    // Check that the manifest file exists
    function(callback) {
      path.exists(manifestFile, function(exists) {
        if (!exists) {
          var msg = sprintf('Failed to find a manifest file %s in %s',
                      manifestConstants.MANIFEST_FILENAME,
                      applicationPath);
          callback(new Error(msg));
          return;
        }
        callback();
        return;
      });
    },

    // Validate the manifest
    function(callback) {
      manifest.validateManifest(manifestFile, function(err, manifestObject) {
        if (err) {
          callback(new Error('Manifest validation failed: ' + err.message));
          return;
        }

        bundleName = misc.getValidBundleName(manifestObject.name);
        tarballName = sprintf('%s.tar.gz', misc.getFullBundleName(bundleName, args.version));
        callback();
        return;
      });
    },

    // Make sure the dot cast project directory exists
    function(callback) {
      dotfiles.ensureDotCastProject(applicationPath, callback);
    },

    // Make sure the temp directory exists within it
    function(dotCastProjectPath, callback) {
      dotCastProject = dotCastProjectPath;
      bundleDirPath = path.join(dotCastProjectPath, 'tmp');
      fsutil.ensureDirectory(bundleDirPath, callback);
    },

    // Get the lock
    function(callback) {
      var lockPath = path.join(bundleDirPath, sprintf('%s.lock', tarballName));
      locking.withFileLock(lockPath, function(err, release) {
        if (err) {
          err = new Error('Failed to acquire a lock, probably someone is already creating a bundle with the same name');
        }
        callback(err, release);
        return;
      });
    },

    // Create the tarball
    function(release, callback) {
      var progressSpinner = spinner.spinner('Manifest validation succeeded, creating a bundle ');
      var timeoutId = setInterval(function() {
        progressSpinner.tick();
      }, 100);
      progressSpinner.start();

      tarball.createTarball(applicationPath, bundleDirPath, tarballName, {
        deleteIfExists: true,
        excludePattern: path.basename(dotfiles.getProjectBundleRoot(applicationPath))
      },
      function(err) {
        release();
        clearInterval(timeoutId);
        progressSpinner.end();
        callback(err);
        return;
      });
    }
  ],
  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else if (args.upload) {
      uploadCommand.handleCommand({version: args.version});
    }
    else {
      sys.puts('Bundle created');
    }
  });
};
