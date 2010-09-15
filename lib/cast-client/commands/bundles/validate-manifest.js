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
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;

var manifest = require('manifest/index');
var manifest_constants = require('manifest/constants');

/** Configuration options for validate-manifest subcommand */
exports.config = {
  'short_description': 'Validates the cast.json manifest',
  'long_description': 'Validates that the cast.json manifest files contains all the required fields.',
  'required_arguments' : [['path', 'Path to the directory containing the cast.json file']],
  'optional_arguments': [],
  'switches': []
};

/**
 * Handler for creating a bundle.
 * @param {Object} args Command line arguments
 * @param {String} args.version Application version number to create
 * @param {String} [args.apppath=process.cwd()] Application path to operate on
 */
exports.handle_command = function (args)
{
   if (!args.path || args.path === '.') {
    application_path = process.cwd();
  }
  else {
    application_path = args.path;
  }

  var manifest_file = path.join(application_path, manifest_constants.MANIFEST_FILENAME);

  // Check that the manifest file exists
  path.exists(manifest_file, function(exists) {
    if (!exists) {
      sys.puts(sprintf('Failed to find a manifest file %s in the directory %s, quitting', manifest_constants.MANIFEST_FILENAME, application_path));

      return;
    }

    manifest.validate_manifest(manifest_file, function(error, manifest_object) {
      if (error) {
        sys.puts(sprintf('Manifest file validation failed: %s', error.message));

        return;
      }

      sys.puts('Manifest file is valid.');
   });
 });
};
