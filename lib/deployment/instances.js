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

var hooks = require('deployment/hooks');
var deployTemplates = require('deployment/templates');
var deployServices = require('deployment/services');
var deployFiles = require('deployment/files');

var serviceManagement = require('service_management');
var manifest = require('manifest');
var manifestConstants = require('manifest/constants');
var config = require('util/config');
var fsutil = require('util/fs');
var flowctrl = require('util/flow_control');

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

function Instance(name) {
  this.name = name;
  this.root = path.join(config.get().app_dir, name);
  this._BundleName = null;
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
      callback(true);
      return;
    }

    callback(false);
    return;
  });
};

/**
 * Get the name of the bundle used by an instance. This is probably the
 * nastiest part of this whole instance filesystem layout because it requires
 * reading a link. To keep things fast this gets cached on the Instance object.
 *
 * @param {Function} callback Callback which is called with (err, bundle_name)
 */
Instance.prototype.getBundleName = function(callback) {
  var self = this;
  if (self._BundleName) {
    process.nextTick(function() {
      callback(null, self._BundleName);
    });
  }
  else {
    var bundleLinkPath = path.join(self.root, 'bundle');
    fs.readlink(bundleLinkPath, function(err, target) {
      if (!err) {
        self._BundleName = path.basename(target);
      }
      callback(err, self._BundleName);
      return;
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
Instance.prototype.getBundleVersion = function(callback) {
  var self = this;
  var currentLinkPath = path.join(self.root, 'current');
  fs.readlink(currentLinkPath, function(err, target) {
    if (err) {
      callback(null);
      return;
    }
    else {
      callback(target.split('@', 2)[1]);
      return;
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
Instance.prototype.getVersionPath = function(version, callback) {
  var self = this;
  self.getBundleName(function(err, bundleName) {
    var bundleNameFull = bundleName + '@' + version;
    var versionPath = path.join(self.root, 'versions', bundleNameFull);
    callback(err, versionPath);
    return;
  });
};

/**
 * Get the path at which the extracted bundle for the specified version would
 * reside. Again, this doesn't verify that the path actually exists.
 *
 * @param {String} version    The version to get the path to
 * @param {Function} callback A callback that takes (err, bundle_version_path)
 */
Instance.prototype.getBundleVersionPath = function(version, callback) {
  var self = this;
  self.getBundleName(function(err, bundleName) {
    var bundleNameFull = bundleName + '@' + version;
    var bundleVersionPath = path.join(config.get().extracted_dir, bundleName, bundleNameFull);
    callback(err, bundleVersionPath);
    return;
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
  var manager = serviceManagement.getDefaultManager().getManager();

  var ops = [
    async.apply(flowctrl.callIgnoringError, fsutil.rmtree, null, this.root)
  ];

  manager.getService(this.name, function (err, service) {
    if (!err) {
      ops.push(async.apply(flowctrl.callIgnoringError, service.destroy, service));
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
Instance.prototype.prepareVersion = function(version, callback) {
  var self = this;
  var extractedBundlePath, bundleName, bundleNameFull, manifestObj;
  var instanceVersionPath, ignoredPaths;

  var bundleLinkPath = path.join(self.root, 'bundle');

  async.series([
    // Resolve the path at which the version will reside
    function(callback) {
      self.getVersionPath(version, function(err, vp) {
        instanceVersionPath = vp;
        callback(err);
        return;
      });
    },

    // Resolve the path to the extracted bundle
    function(callback) {
      self.getBundleVersionPath(version, function(err, bvp) {
        extractedBundlePath = bvp;
        callback(err);
        return;
      });
    },

    // Make sure this version doesn't exist
    function(callback) {
      path.exists(instanceVersionPath, function(exists) {
        var err = null;
        if (exists) {
          err = new Error(sprintf('Instance \'%s\' already has version \'%s\'', self.name, version));
        }
        callback(err);
        return;
      });
    },

    // Make sure an extracted bundle exists for the requested version
    function(callback) {
      fs.stat(extractedBundlePath, function(err, stats) {
        if (!err && !stats.isDirectory()) {
          err = new Error('No bundle for version \'' + version + '\'');
        }
        callback(err);
        return;
      });
    },

    // Execute the 'post_prepare' hook
    function(callback) {
      hooks.execute(self, version, 'pre_prepare', null, [version], callback);
    },

    // Create the directory for the target version
    function(callback) {
      fsutil.ensureDirectory(instanceVersionPath, callback);
    },

    // Retrieve the manifest object
    function(callback) {
      var manifestPath = path.join(extractedBundlePath, manifestConstants.MANIFEST_FILENAME);
      manifest.getManifestObject(manifestPath, true, function(err, manifestObj) {
        manifestObj = manifestObj;
        ignoredPaths = manifestObj.template_files.concat(manifestObj.data_files);
        callback(err);
        return;
      });
    },

    // Mirror the directory structure from the extracted bundle in the instance directory
    function(callback) {
      fsutil.treeToTemplate(extractedBundlePath, ignoredPaths, function(err, templateObject) {
        if (err) {
          callback(err);
          return;
        }

        // No directories
        if (Object.keys(templateObject).length === 0) {
          callback();
          return;
        }

        fsutil.templateToTree(instanceVersionPath, templateObject, true, callback);
      });
    },

    // Realize (render and save) templates
    function(callback) {
      var instanceData = deployTemplates.getInstanceTemplateObject(self.name, instanceVersionPath);
      deployTemplates.realizeApplicationTemplates(manifestObj, instanceData, extractedBundlePath,
                                                     instanceVersionPath, callback);
    },

    // Hard-link all the files (except template and data files)
    function(callback) {
      fsutil.hardLinkFiles(extractedBundlePath, instanceVersionPath, ignoredPaths, callback);
    },

    // Resolve the data files
    function(callback) {
      var instanceDataRoot = path.join(self.root, 'data');
      deployFiles.resolveDataFiles(extractedBundlePath, instanceDataRoot, instanceVersionPath,
                                      manifestObj.data_files, callback);
    },

    // Execute the 'post_prepare' hook
    function(callback) {
      hooks.execute(self, version, 'post_prepare', null, [version], callback);
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
Instance.prototype.activateVersion = function(version, callback) {
  var self = this;
  var newVersionPath;
  var newVersionLink = path.join(self.root, 'new');
  var currentVersionLink = path.join(self.root, 'current');

  async.series([
    // Get the path to the specified version
    function(callback) {
      self.getVersionPath(version, function(err, vp) {
        newVersionPath = vp;
        callback(err);
        return;
      });
    },

    // Make sure the version exists
    function(callback) {
      path.exists(newVersionPath, function(exists) {
        var err = null;
        if (!exists) {
          err = new Error('Cannot activate nonexistent version \'' + version + '\'');
        }
        callback(err);
        return;
      });
    },

    function(callback) {
      hooks.execute(self, version, 'pre_version_activate', null, [version, newVersionPath],
                    callback);
    },

    // Create the new link
    function(callback) {
      fs.symlink(path.resolve(newVersionPath), newVersionLink, callback);
    },

    // Atomically move it into place
    async.apply(fs.rename, newVersionLink, currentVersionLink),

    function(callback) {
      hooks.execute(self, version, 'post_version_activate', null, [version, newVersionPath],
                    callback);
    }
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
exports.createInstance = function(instanceName, bundleName, bundleVersion, callback) {
  if (!INSTANCE_NAME_RE.exec(instanceName)) {
    callback(new Error('Invalid instance name'));
    return;
  }

  var manifestObj, ignoredPaths, instance;
  var bundleNameFull = bundleName + '@' + bundleVersion;

  // Get the paths to the extracted bundle and the manifest
  var extractedBundleRoot = path.join(config.get().extracted_dir, bundleName);
  var extractedBundlePath = path.join(extractedBundleRoot, bundleNameFull);

  var instancePath = path.join(config.get().app_dir, instanceName);
  var instanceDataRoot = path.join(instancePath, 'data');
  var instanceVersionsRoot = path.join(instancePath, 'versions');
  var instanceBundleLink = path.join(instancePath, 'bundle');
  var instanceCurrentLink = path.join(instancePath, 'current');
  var instanceVersionPath = path.join(instanceVersionsRoot, bundleNameFull);

  async.series([
    // Make sure that the extracted bundle path exists
    function(callback) {
      path.exists(extractedBundlePath, function(exists) {
        if (!exists) {
          callback(new Error('Invalid bundle name or version'));
          return;
        }

        callback();
      });
    },

    // Make sure there isn't already an instance with this name
    function(callback) {
      path.exists(instancePath, function(exists) {
        if (exists) {
          callback(new Error('Instance name already in use'));
          return;
        }
        callback();
      });
    },

    // Create the instance directory
    function(callback) {
      fsutil.ensureDirectory(instancePath, function(err) {
        if (!err) {
          instance = new Instance(instanceName);
        }
        callback(err);
      });
    },

    // Create the data and versions directories
    async.apply(fsutil.ensureDirectory, instanceDataRoot),
    async.apply(fsutil.ensureDirectory, instanceVersionsRoot),

    // Create the bundle symlink
    async.apply(fs.symlink, path.resolve(extractedBundleRoot), instanceBundleLink),

    // Prepare the specified version
    function(callback) {
      instance.prepareVersion(bundleVersion, callback);
    },

    // Symlink it
    function(callback) {
      instance.activateVersion(bundleVersion, callback);
    },

    // Retrieve the manifest object
    function(callback) {
      var manifestPath = path.join(extractedBundlePath, manifestConstants.MANIFEST_FILENAME);
      manifest.getManifestObject(manifestPath, true, function(err, manifestObj) {
        manifestObj = manifestObj;
        callback(err);
        return;
      });
    },

    // Create a runit service
    function(callback) {
      deployServices.createService(instanceName, instanceCurrentLink, manifestObj, callback);
    }
  ],

  function(error) {
    if (error && instance) {
      instance.destroy(function() {
        callback(error);
        return;
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
exports.getInstance = function(instanceName, callback) {
  var instance = new Instance(instanceName);
  instance.exists(function(exists) {
    if (!exists) {
      callback(new Error('Instance doesn\'t exist'));
      return;
    }
    else {
      callback(null, instance);
      return;
    }
  });
};

/**
 * Get a list of all instances (in the form of Instance objects).
 *
 * @param {Function} callback A callback that takes (err, instances)
 */
exports.getInstanceList = function(callback) {
  fs.readdir(config.get().app_dir, function(err, files) {
    if (err) {
      callback(err);
      return;
    }

    // Construct an Instance for each file in the app_dir
    var instanceList = files.map(function(file) {
      return new Instance(file);
    });

    // Make sure each instance actually exists (ie, isn't a non-directory of some sort)
    async.filter(instanceList, function(instance, callback) {
      instance.exists(callback);
    },
    function(instances) {
      callback(null, instances);
      return;
    });
  });
};

exports.Instance = Instance;
