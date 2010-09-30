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
var lock = require('util/lock');
var spinner = require('util/spinner');
var dotfiles = require('util/client_dotfiles');
var fsutil = require('util/fs');

var upload_command = require('cast-client/commands/bundles/upload');

var manifest = require('manifest/index');
var manifest_constants = require('manifest/constants');

/** Configuration options for create subcommand */
exports.config = {
  'short_description': 'Create an save the application bundle',
  'long_description': 'Create an application bundle. If you don\'t specify the app or ' +
                      'bundle path, the current working directory is used.',
  'required_arguments' : [['version', 'Application version number']],
  'optional_arguments': [['apppath', 'Path to folder containing the cast.json file and your application files']],
  'switches': [['upload', 'Upload a bundle to the server after it is created']]
};

/**
 * Handler for creating a bundle.
 * @param {Object} args Command line arguments.
 * @param {String} args.version Application version number to create.
 * @param {String} [args.apppath=process.cwd()] Application path to operate on.
 */
exports.handle_command = function(args)
{
  var application_path = args.apppath || process.cwd();
  var manifest_file = path.join(application_path, manifest_constants.MANIFEST_FILENAME);
  var dot_cast_project;
  var bundle_dir_path;
  var bundle_name;
  var tarball_name;

  async.waterfall([
    // Check that user provided a valid version
    function(callback) {
      if (!misc.is_valid_bundle_version(args.version)) {
        return callback(new Error('Provided version string is invalid'));
      }

      callback();
    },

    // Check that the manifest file exists
    function(callback) {
      path.exists(manifest_file, function(exists) {
        if (!exists) {
          var msg = sprintf('Failed to find a manifest file %s in %s',
                      manifest_constants.MANIFEST_FILENAME,
                      application_path);
          return callback(new Error(msg));
        }
        return callback();
      });
    },

    // Validate the manifest
    function(callback) {
      manifest.validate_manifest(manifest_file, function(err, manifest_object) {
        if (err) {
          return callback(new Error('Manifest validation failed: ' + err.message));
        }

        bundle_name = misc.get_valid_bundle_name(manifest_object.name);
        tarball_name = sprintf('%s.tar.gz', misc.get_full_bundle_name(bundle_name, args.version));
        return callback();
      });
    },

    // Make sure the dot cast project directory exists
    function(callback) {
      dotfiles.ensure_dot_cast_project(application_path, callback);
    },

    // Make sure the temp directory exists within it
    function(dot_cast_project_path, callback) {
      dot_cast_project = dot_cast_project_path;
      bundle_dir_path = path.join(dot_cast_project_path, 'tmp');
      fsutil.ensure_directory(bundle_dir_path, callback);
    },

    // Get the lock
    function(callback) {
      var lock_path = path.join(bundle_dir_path, sprintf('%s.lock', tarball_name));
      lock.with_lock(lock_path, function(err, release) {
        if (err) {
          err = new Error('Failed to acquire a lock, probably someone is already creating a bundle with the same name');
        }
        return callback(err, release);
      });
    },

    // Create the tarball
    function(release, callback) {
      var progress_spinner = spinner.spinner('Manifest validation succeeded, creating a bundle ');
      var timeout_id = setInterval(function() {
        progress_spinner.tick();
      }, 100);
      progress_spinner.start();

      tarball.create_tarball(application_path, bundle_dir_path, tarball_name, {
        delete_if_exists: true,
        exclude_pattern: path.basename(dot_cast_project)
      },
      function(err) {
        release();
        clearInterval(timeout_id);
        progress_spinner.end();
        return callback(err);
      });
    }
  ],
  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else if (args.upload) {
      upload_command.handle_command({version: args.version});
    }
    else {
      sys.puts('Bundle created');
    }
  });
};
