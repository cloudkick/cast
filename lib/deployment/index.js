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
var constants = require('constants');

var config = require('util/config');
var templates = require('util/templates');
var misc = require('util/misc');
var fsutil = require('util/fs');

var manifest = require('manifest');
var manifest_constants = require('manifest/constants');

var async = require('extern/async');

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

exports.create_instance = function(instance_name, bundle_name, bundle_version, callback) {
  if (!INSTANCE_NAME_RE.exec(instance_name)) {
    return callback(new Error('Invalid instance name'));
  }

  var manifest_object, ignored_paths;
  var bundle_name_full = bundle_name + '@' + bundle_version;

  // Get the paths to the extracted bundle and the manifest
  var extracted_bundle_root = path.join(config.get().extracted_dir, bundle_name);
  var extracted_bundle_path = path.join(extracted_bundle_path, bundle_name_full);
  var manifest_path = path.join(extracted_bundle_path, manifest_constants.MANIFEST_FILENAME);

  var instance_path = path.join(config.get().app_dir, instance_name);
  var instance_data_root = path.join(instance_path, 'data');
  var instance_versions_root = path.join(instance_path, 'versions');
  var instance_bundle_link = path.join(instance_path, 'bundle');
  var instance_current_link = path.join(instance_path, 'current');
  var instance_version_path = path.join(instance_versions_root, bundle_name_full);

  var dir_created = false;

  async.series([
    // Make sure that the extracted bundle path exists
    function(callback) {
      path.exists(extracted_bundle_path, function(exists) {
        if (!exists) {
          return callback(new Error('Invalid bundle name or version'));
        }

        callback();
      });
    },

    // Make sure there isn't already an instance with this name
    function(callback) {
      path.exists(instance_path, function(exists) {
        if (exists) {
          return callback(new Error('Instance name already in use'));
        }
        callback();
      });
    },

    // Retrieve the manifest data object
    function(callback) {
      manifest.get_manifest_data_as_object(manifest_path, true, function(error, manifest_object_) {
        if (error) {
          return callback(error);
        }

        manifest_object = manifest_object_;
        ignored_paths = manifest_object.template_files.concat(manifest_object.data_files);
        callback();
      });
    },

    // Create the instance directory
    function(callback) {
      fsutil.ensure_directory(instance_path, function(err) {
        if (!err) {
          dir_created = true;
        }
        callback(err);
      });
    },

    // Create the data and versions directories
    async.apply(fsutil.ensure_directory, instance_data_root),
    async.apply(fsutil.ensure_directory, instance_versions_root),
    async.apply(fsutil.ensure_directory, instance_version_path),

    // Create the bundle and current symlinks
    async.apply(fs.symlink, instance_bundle_link, extracted_bundle_root),
    async.apply(fs.symlink, instance_current_link, instance_version_path),

    // Mirror the directory structure from the extracted bundle in the instance directory
    function(callback) {
      fsutil.tree_to_template(extracted_bundle_path, ignored_paths, function(error, template_object) {
        if (error) {
          return callback(error);
        }

        // No directories
        if (Object.keys(template_object).length === 0) {
          return callback();
        }

        misc.template_to_tree(instance_version_path, template_object, true, callback);
      });
    },

    // Realize (render and save) templates
    function(callback) {
      var instance_data = templates.get_instance_template_object(instance_name, instance_version_path);
      exports.realize_application_templates(manifest_object, instance_data, extracted_bundle_path,
                                               instance_version_path, callback);
    },

    // Hard-link all the files (except template and data files)
    function(callback) {
      fsutil.hard_link_files(extracted_bundle_path, instance_version_path, ignored_paths, callback); 
    },

    // 5. Resolve the data files
    function(callback) {
      exports.resolve_data_files(extracted_bundle_path, instance_data_root, instance_version_path,
                                    manifest_object.data_files, callback);
    },

    // 6. Create a runit service
    function(callback) {
      exports.create_service(instance_name, instance_version_path, manifest_object.entry_file, manifest_object.type,
                                callback);
    }
  ],

  function(error) {
    if (error && dir_created) {
      fsutil.rmtree(instance_path, function() {
        return callback(error);
      });
    }
    else {
      callback(error);
    }
  });
};

exports.create_service = require('deployment/services').create_service;
exports.get_available_instances = require('deployment/instances').get_available_instances;
exports.cleanup = require('deployment/instances').cleanup;
exports.resolve_data_files = require('deployment/files').resolve_data_files;
exports.realize_application_templates = require('deployment/templates').realize_application_templates;
