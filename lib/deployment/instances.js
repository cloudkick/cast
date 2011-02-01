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

var deploy_templates = require('deployment/templates');
var deploy_services = require('deployment/services');
var deploy_files = require('deployment/files');

var service_management = require('service_management');
var manifest = require('manifest');
var manifest_constants = require('manifest/constants');
var config = require('util/config');
var fsutil = require('util/fs');
var flowctrl = require('util/flow_control');

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

function Instance(name) {
  this.name = name;
  this.root = path.join(config.get().app_dir, name);
  this._bundle_name = null;
}

/**
 * Check if an instance exists
 *
 * @param {String} instance_name The name of the instance
 * @param {Function} callback Callback which is called with a boolean 'exists'
 */
Instance.prototype.exists = function(callback) {
  fs.stat(this.root, function(err, stats) {
    if (!err && stats.isDirectory()) {
      return callback(true);
    }
    return callback(false);
  });
};

/**
 * Get the name of the bundle used by an instance. This is probably the
 * nastiest part of this whole instance filesystem layout because it requires
 * reading a link. To keep things fast this gets cached on the Instance object.
 *
 * @param {Function} callback Callback which is called with (err, bundle_name)
 */
Instance.prototype.get_bundle_name = function(callback) {
  var self = this;
  if (self._bundle_name) {
    process.nextTick(function() {
      callback(null, self._bundle_name);
    });
  }
  else {
    var bundle_link_path = path.join(self.root, 'bundle');
    fs.readlink(bundle_link_path, function(err, target) {
      if (!err) {
        self._bundle_name = path.basename(target);
      }
      return callback(err, self._bundle_name);
    });
  }
};

/**
 * Get the version pointed to by the 'current' link. This will give a value of
 * 'null' if the current link doesn't exist (currently it should always exist
 * but we may want to introduce situations where it won't in the future).
 *
 * @param {Function} callback Callback which is called with (version)
 */
Instance.prototype.get_bundle_version = function(callback) {
  var self = this;
  var current_link_path = path.join(self.root, 'current');
  fs.readlink(current_link_path, function(err, target) {
    if (err) {
      return callback(null);
    }
    else {
      return callback(target.split('@', 2)[1]);
    }
  });
};

/**
 * Get the path at which a version of this instance would reside. This does
 * not guarantee that this version exists, merely returns the hypothetical
 * path at which it would reside.
 *
 * @param {String} version    The version to get the path to
 * @param {Function} callback A callback that takes (err, version_path)
 */
Instance.prototype.get_version_path = function(version, callback) {
  var self = this;
  self.get_bundle_name(function(err, bundle_name) {
    var bundle_name_full = bundle_name + '@' + version;
    var version_path = path.join(self.root, 'versions', bundle_name_full);
    return callback(err, version_path);
  });
};

/**
 * Get the path at which the extracted bundle for the specified version would
 * reside. Again, this doesn't verify that the path actually exists.
 *
 * @param {String} version    The version to get the path to
 * @param {Function} callback A callback that takes (err, bundle_version_path)
 */
Instance.prototype.get_bundle_version_path = function(version, callback) {
  var self = this;
  self.get_bundle_name(function(err, bundle_name) {
    var bundle_name_full = bundle_name + '@' + version;
    var bundle_version_path = path.join(config.get().extracted_dir, bundle_name, bundle_name_full);
    return callback(err, bundle_version_path);
  });
};

/**
 * Remove all data related to an instance, including the instance, its data,
 * and any services. This performs very little validation (doesn't even check
 * that the instance exists first), it just starts deleting stuff.
 *
 * @param {Function} callback Callback which is called when the cleanup process has finished
 */
Instance.prototype.destroy = function(callback) {
  var manager = service_management.get_default_manager().get_manager();

  var ops = [
    async.apply(flowctrl.call_ignoring_error, fsutil.rmtree, null, this.root)
  ];

  manager.get_service(this.name, function (err, service) {
    if (!err) {
      ops.push(async.apply(flowctrl.call_ignoring_error, service.destroy, service));
    }

    async.parallel(ops, function(err) {
      callback();
    });
  });
};

/**
 * Given a bundle version, hard hard link all the files into place, render
 * any templates and resolve all data files.
 *
 * @param {String} version    The version of the bundle to prepare
 * @param {Function} callback A callback fired with (err)
 */
Instance.prototype.prepare_version = function(version, callback) {
  var self = this;
  var extracted_bundle_path, bundle_name, bundle_name_full, manifest_obj;
  var instance_version_path, ignored_paths;

  var bundle_link_path = path.join(self.root, 'bundle');

  async.series([
    // Resolve the path at which the version will reside
    function(callback) {
      self.get_version_path(version, function(err, vp) {
        instance_version_path = vp;
        return callback(err);
      });
    },

    // Resolve the path to the extracted bundle
    function(callback) {
      self.get_bundle_version_path(version, function(err, bvp) {
        extracted_bundle_path = bvp;
        return callback(err);
      });
    },

    // Make sure this version doesn't exist
    function(callback) {
      path.exists(instance_version_path, function(exists) {
        var err = null;
        if (exists) {
          err = new Error(sprintf('Instance \'%s\' already has version \'%s\'', self.name, version));
        }
        return callback(err);
      });
    },

    // Make sure an extracted bundle exists for the requested version
    function(callback) {
      fs.stat(extracted_bundle_path, function(err, stats) {
        if (!err && !stats.isDirectory()) {
          err = new Error('No bundle for version \'' + version + '\'');
        }
        return callback(err);
      });
    },

    // Create the directory for the target version
    function(callback) {
      fsutil.ensure_directory(instance_version_path, callback);
    },

    // Retrieve the manifest object
    function(callback) {
      var manifest_path = path.join(extracted_bundle_path, manifest_constants.MANIFEST_FILENAME);
      manifest.get_manifest_object(manifest_path, true, function(err, manifest_obj_) {
        manifest_obj = manifest_obj_;
        ignored_paths = manifest_obj.template_files.concat(manifest_obj.data_files);
        return callback(err);
      });
    },

    // Mirror the directory structure from the extracted bundle in the instance directory
    function(callback) {
      fsutil.tree_to_template(extracted_bundle_path, ignored_paths, function(err, template_object) {
        if (err) {
          return callback(err);
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
      var instance_data = deploy_templates.get_instance_template_object(self.name, instance_version_path);
      deploy_templates.realize_application_templates(manifest_obj, instance_data, extracted_bundle_path,
                                                     instance_version_path, callback);
    },

    // Hard-link all the files (except template and data files)
    function(callback) {
      fsutil.hard_link_files(extracted_bundle_path, instance_version_path, ignored_paths, callback); 
    },

    // Resolve the data files
    function(callback) {
      var instance_data_root = path.join(self.root, 'data');
      deploy_files.resolve_data_files(extracted_bundle_path, instance_data_root, instance_version_path,
                                      manifest_obj.data_files, callback);
    }
  ], callback);
};

/**
 * Point the 'current' symlink to the specified version. Will verify
 * that the specified version exists before taking action.
 *
 * @param {String} version    The version to activate
 * @param {Function} callback A callback fired with (err)
 */
Instance.prototype.activate_version = function(version, callback) {
  var self = this;
  var new_version_path;
  var new_version_link = path.join(self.root, 'new');
  var current_version_link = path.join(self.root, 'current');

  async.series([
    // Get the path to the specified version
    function(callback) {
      self.get_version_path(version, function(err, vp) {
        new_version_path = vp;
        return callback(err);
      });
    },

    // Make sure the version exists
    function(callback) {
      path.exists(new_version_path, function(exists) {
        var err = null;
        if (!exists) {
          err = new Error('Cannot activate nonexistent version \'' + version + '\'');
        }
        return callback(err);
      });
    },

    // Create the new link
    function(callback) {
      fs.symlink(new_version_path, new_version_link, callback);
    },

    // Atomically move it into place
    async.apply(fs.rename, new_version_link, current_version_link)
  ], callback);
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

  var manifest_obj, ignored_paths, instance;
  var bundle_name_full = bundle_name + '@' + bundle_version;

  // Get the paths to the extracted bundle and the manifest
  var extracted_bundle_root = path.join(config.get().extracted_dir, bundle_name);
  var extracted_bundle_path = path.join(extracted_bundle_root, bundle_name_full);

  var instance_path = path.join(config.get().app_dir, instance_name);
  var instance_data_root = path.join(instance_path, 'data');
  var instance_versions_root = path.join(instance_path, 'versions');
  var instance_bundle_link = path.join(instance_path, 'bundle');
  var instance_current_link = path.join(instance_path, 'current');
  var instance_version_path = path.join(instance_versions_root, bundle_name_full);

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

    // Create the instance directory
    function(callback) {
      fsutil.ensure_directory(instance_path, function(err) {
        if (!err) {
          instance = new Instance(instance_name);
        }
        callback(err);
      });
    },

    // Create the data and versions directories
    async.apply(fsutil.ensure_directory, instance_data_root),
    async.apply(fsutil.ensure_directory, instance_versions_root),

    // Create the bundle symlink
    async.apply(fs.symlink, extracted_bundle_root, instance_bundle_link),

    // Prepare the specified version
    function(callback) {
      instance.prepare_version(bundle_version, callback);
    },

    // Symlink it
    function(callback) {
      instance.activate_version(bundle_version, callback);
    },

    // Retrieve the manifest object
    function(callback) {
      var manifest_path = path.join(extracted_bundle_path, manifest_constants.MANIFEST_FILENAME);
      manifest.get_manifest_object(manifest_path, true, function(err, manifest_obj_) {
        manifest_obj = manifest_obj_;
        return callback(err);
      });
    },

    // Create a runit service
    function(callback) {
      deploy_services.create_service(instance_name, instance_current_link, manifest_obj, callback);
    }
  ],

  function(error) {
    if (error && instance) {
      instance.destroy(function() {
        return callback(error);
      });
    }
    else {
      callback(error);
    }
  });
};

/**
 * Get an Instance object for an instance whose existence is verified.
 *
 * @param {String} instance_name  The name of the instance to retrieve
 * @param {Function} callback     A callback that takes (err, instance)
 */
exports.get_instance = function(instance_name, callback) {
  var instance = new Instance(instance_name);
  instance.exists(function(exists) {
    if (!exists) {
      return callback(new Error('Instance doesn\'t exist'));
    }
    else {
      return callback(null, instance);
    }
  });
};

/**
 * Get a list of all instances (in the form of Instance objects).
 *
 * @param {Function} callback A callback that takes (err, instances)
 */
exports.get_instance_list = function(callback) {
  fs.readdir(config.get().app_dir, function(err, files) {
    if (err) {
      return callback(err);
    }

    // Construct an Instance for each file in the app_dir
    var instance_list = files.map(function(file) {
      return new Instance(file);
    });

    // Make sure each instance actually exists (ie, isn't a non-directory of some sort)
    async.filter(instance_list, function(instance, callback) {
      instance.exists(callback);
    },
    function(instances) {
      return callback(null, instances);
    });
  });
};
