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
var path = require('path');

var service_management = require('service_management');
var manifest = require('manifest');
var manifest_constants = require('manifest/constants');
var config = require('util/config');
var templates = require('util/templates');
var misc = require('util/misc');
var fsutil = require('util/fs');
var flowctrl = require('util/flow_control');

var async = require('extern/async');

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

/*
 * Return the path to an instance, given its name
 *
 * @param {String} instance_name The name of the instance
 * @return {String} The path to the instance
 */
exports.get_instance_path = function(instance_name) {
  return path.join(config.get().app_dir, instance_name);
};

/**
 * Check if an instance exists
 *
 * @param {String} instance_name The name of the instance
 * @param {Function} callback Callback which is called with a boolean 'exists'
 */
exports.instance_exists = function(instance_name, callback) {
  var instance_path = exports.get_instance_path(instance_name);
  path.exists(instance_path, callback);
};

/**
 * Create an instance with a specified name for the specified bundle. The
 * instance will initially use the specified version of the bundle.
 *
 * @param {String} instance_name  A name to give to the instance
 * @param {String} bundle_name    The name of the bundle to use
 * @param {String} bundle_version The version of the bundle to use
 * @param {Function} callback     A callback fired with (err)
 */
exports.create_instance = function(instance_name, bundle_name, bundle_version, callback) {
  if (!INSTANCE_NAME_RE.exec(instance_name)) {
    return callback(new Error('Invalid instance name'));
  }

  var manifest_object, ignored_paths;
  var bundle_name_full = bundle_name + '@' + bundle_version;

  // Get the paths to the extracted bundle and the manifest
  var extracted_bundle_root = path.join(config.get().extracted_dir, bundle_name);
  var extracted_bundle_path = path.join(extracted_bundle_root, bundle_name_full);
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
    async.apply(fs.symlink, extracted_bundle_root, instance_bundle_link),
    async.apply(fs.symlink, instance_version_path, instance_current_link),

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

        fsutil.template_to_tree(instance_version_path, template_object, true, callback);
      });
    },

    // Realize (render and save) templates
    function(callback) {
      var instance_data = get_instance_template_object(instance_name, instance_version_path);
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
      exports.create_service(instance_name, instance_current_link, manifest_object, callback);
    }
  ],

  function(error) {
    if (error && dir_created) {
      exports.delete_instance(instance_name, function() {
        return callback(error);
      });
    }
    else {
      callback(error);
    }
  });
};

/*
 * Remove all data related to an instance, including the instance, its data,
 * and any services. This performs very little validation (doesn't even check
 * that the instance exists first), it just starts deleting stuff.
 *
 * @param {String} instance_name Instance name
 * @param {Function} callback Callback which is called when the cleanup process has finished
 */
exports.delete_instance = function(instance_name, callback) {
  var instance_path = exports.get_instance_path(instance_name);
  var manager = service_management.get_default_manager().get_manager();

  var ops = [
    async.apply(flowctrl.call_ignoring_error, fsutil.rmtree, null, instance_path)
  ];

  manager.get_service(instance_name, function (err, service) {
    if (!err) {
      ops.push(async.apply(flowctrl.call_ignoring_error, service.destroy, service));
    }

    async.parallel(ops, function(err) {
      callback();
    });
  });
};

/*
 * Realize (render and save) application templates.
 *
 * @param {Object} manifest_object
 * @param {Object} instance_data
 * @param {String} templates_path
 * @oaram {String} target_path
 * @param {Function} callback
 *
 */
var realize_application_templates = function(manifest_object, instance_data, templates_path, target_path, callback) {
  var context;

  context = { 'manifest': manifest_object };
  if (instance_data) {
    context.instance = instance_data;
  }

  if (manifest_object.hasOwnProperty('template_variables')) {
    // Assign "template_variables" property value to the property named "user_defined" on the
    // context object and delete it from the context.manifest
    context.user_defined = manifest_object.template_variables;
    delete context.manifest.template_variables;
  }

  templates.get_template_context(true, context, function(error, context) {
    if (error) {
      return callback(error);
    }

    templates.render_and_save_templates(templates_path, manifest_object.template_files, target_path, context,
                                        function(error) {
      if (error) {
        return callback(error);
      }

      callback();
    });
  });
};

/**
 * Creates an instance of a service, building out the runit application directory.
 * @param {String} instance_name  Name of the instance.
 * @param {String} instance_path  The path to the version instance
 * @param {Object} manifest_obj   The manifest object of the instance
 * @param {Function} callback Callback on completion, first parameter if present is an error.
 */
function create_service(instance_name, instance_path, manifest_obj, callback) {
  var manager = service_management.get_default_manager().get_manager();
  var template_args = {
    service_name: instance_name,
    instance_path: instance_path,
    entry_file: manifest.entry_file,
    type: manifest.type
  };

  manager.get_service_template(template_args, function(err, template) {
    if (err) {
      return callback(err);
    }

    manager.create_service(instance_name, template, function(err) {
      callback(err);
    });
  });
};

/**
 * Return object with instance data which can be used when rendering a template.
 *
 * @param {String} instance_name Instance name.
 * @param {String} instance_path Instance path.
 * @return {Object}
 */
function get_instance_template_object(instance_name, instance_path) {
  var instance_object = {
    'name': instance_name,
    'path': instance_path
  };

  return instance_object;
};
