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

var async = require('async');
var sprintf = require('sprintf').sprintf;

var hooks = require('deployment/hooks');
var deployTemplates = require('deployment/templates');
var deployServices = require('deployment/services');
var deployFiles = require('deployment/files');
var deployConstants = require('deployment/constants');

var serviceManagement = require('service_management');
var manifest = require('manifest');
var manifestConstants = require('manifest/constants');
var config = require('util/config');
var fsutil = require('util/fs');
var flowctrl = require('util/flow_control');
var misc = require('util/misc');
var jobs = require('jobs');
var managers = require('cast-agent/managers');

var Errorf = misc.Errorf;

/**
 * Represents an instance.
 * @constructor
 *
 * @param {String} name Instance name.
 */
function Instance(name) {
  jobs.DirectoryResource.call(this, name);
  this._serializer = managers.getSerializer();
  this._bundleName = null;
}

util.inherits(Instance, jobs.DirectoryResource);


/**
 * @inheritdoc
 */
Instance.prototype.getSerializerDefs = function() {
  return {
    'Instance': [
      ['name', {
        src: 'name',
        type: 'string'
      }],
      ['bundle_name', {
        src: 'getBundleName',
        type: 'string'
      }],
      ['bundle_version', {
        src: 'getBundleVersion',
        type: 'string'
      }],
      ['service', {
        src: 'getSerializedService',
        type: 'Service'
      }]
    ],
    'Service': [
      ['name', {
        src: 'name',
        type: 'string'
      }],
      ['enabled', {
        src: 'isEnabledSer',
        type: 'boolean'
      }],
      ['status', {
        src: 'getStatus',
        type: 'object'
      }]
    ]
  };
};


/**
 * @inheritdoc
 */
Instance.prototype.getParentDir = function() {
  return config.get()['app_dir'];
};


/**
 * Get the name of the bundle used by an instance. This is probably the
 * nastiest part of this whole instance filesystem layout because it requires
 * reading a link. To keep things fast this gets cached on the Instance object.
 *
 * @param {Function} callback Callback which is called with (err, bundleName).
 */
Instance.prototype.getBundleName = function(callback) {
  var self = this;
  if (self._bundleName) {
    process.nextTick(function() {
      callback(null, self._bundleName);
    });
  }
  else {
    var bundleLinkPath = path.join(self.getRoot(), 'bundle');
    fs.readlink(bundleLinkPath, function(err, target) {
      if (!err) {
        self._bundleName = path.basename(target);
      }
      callback(err, self._bundleName);
      return;
    });
  }
};


/**
 * Get the version pointed to by the 'current' link.
 *
 * @param {Function} callback Callback which is called with (err, version).
 */
Instance.prototype.getBundleVersion = function(callback) {
  var self = this;
  var currentLinkPath = path.join(self.getRoot(), 'current');
  fs.readlink(currentLinkPath, function(err, target) {
    if (err) {
      callback(err);
      return;
    }
    else {
      callback(null, target.split('@', 2)[1]);
      return;
    }
  });
};


/**
 * Get the path at which a version of this instance would reside. This does
 * not guarantee that this version exists, merely returns the hypothetical
 * path at which it would reside.
 *
 * @param {String} version    The version to get the path to.
 * @param {Function} callback A callback that takes (err, versionPath).
 */
Instance.prototype.getVersionPath = function(version, callback) {
  var self = this;
  self.getBundleName(function(err, bundleName) {
    var bundleNameFull = misc.getFullBundleName(bundleName, version);
    var versionPath = path.join(self.getRoot(), 'versions', bundleNameFull);
    callback(err, versionPath);
    return;
  });
};


/**
 * Get the path at which the extracted bundle for the specified version would
 * reside. Again, this doesn't verify that the path actually exists.
 *
 * @param {String} version    The version to get the path to.
 * @param {Function} callback A callback that takes (err, bundleVersionPath).
 */
Instance.prototype.getBundleVersionPath = function(version, callback) {
  this.getBundleName(function(err, bundleName) {
    var bundleNameFull = misc.getFullBundleName(bundleName, version);
    var bundleVersionPath = path.join(config.get()['extracted_dir'], bundleName, bundleNameFull);
    callback(err, bundleVersionPath);
    return;
  });
};


/**
 * Retrieve the name of this instance's service.
 * @param {Function} callback A function taking (err, serviceName).
 */
Instance.prototype.getServiceName = function(callback) {
  var self = this;

  this.getBundleVersion(function(err, bundleVersion) {
    if (err) {
      callback(err);
    } else {
      callback(null, sprintf('%s@%s', self.name, bundleVersion));
    }
  });
};


/**
 * Retrieve this instance's service.
 * @param {Function} callback A callback fired with (err, service).
 */
Instance.prototype.getService = function(callback) {
  var self = this;
  var manager = serviceManagement.getDefaultManager().getManager();

  this.getServiceName(function(err, serviceName) {
    if (err) {
      callback(err);
    } else {
      manager.getService(serviceName, callback);
    }
  });
};


/**
 * Retrieve the serialized state of the instance's service.
 * @param {Function} callback A callback fired with (err, serviceState).
 */
Instance.prototype.getSerializedService = function(callback) {
  var self = this;

  this.getService(function(err, service) {
    if (err) {
      callback(err);
    } else {
      self._serializer.buildObject(service, callback);
    }
  });
};


/**
 * Tail this instance's service's log.
 * @param {Number} bytes The number of bytes to read from the existing log.
 * @param {Boolean} follow Whether or not to "follow" the log.
 * @param {Function} callback A callback fired with (err, data, unsubscribe).
 */
Instance.prototype.tailServiceLog = function(bytes, follow, callback) {
  var self = this;
  this.getService(function(err, service) {
    if (err) {
      callback(err);
    } else {
      service.tailLogFile(bytes, follow, callback);
    }
  });
};


/**
 * Perform a 'service action' on this service. See service managers for
 * available actions.
 * @param {String} action A service action name to be performed.
 * @param {Function} callback A callback fired with (err).
 */
Instance.prototype.serviceAction = function(action, callback) {
  var manager = serviceManagement.getDefaultManager().getManager();
  this.getServiceName(function(err, serviceName) {
    if (err) {
      callback(err);
    } else {
      manager.runAction(serviceName, action, callback);
    }
  });
};


/**
 * Remove all data related to an instance, including the instance, its data,
 * and any services. This performs very little validation (doesn't even check
 * that the instance exists first), it just starts deleting stuff.
 *
 * @param {Function} callback Callback which is called when the cleanup process has finished.
 */
Instance.prototype.destroy = function(callback) {
  var self = this;

  function destroyService(callback) {
    flowctrl.callIgnoringError(self.serviceAction, self, 'destroy', callback);
  }

  function destroyInstance(callback)  {
    flowctrl.callIgnoringError(fsutil.rmtree, null, self.getRoot(), callback);
  }

  var ops = [
    destroyService,
    destroyInstance
  ];

  async.series(ops, function() {
    callback();
  });
};


/**
 * Upgrade an instance to a new version.
 *
 * @param {String} bundleVersion Version of the bundle to which the instance
 *                               will be upgraded.
 * @param {Function} callback    Callback which is called with (err).
 */
Instance.prototype.upgrade = function(bundleVersion, callback) {
  var self = this;

  var bundleName, bundleNameFull, extractedBundleRoot, extractedBundlePath;
  var newInstanceVersionPath, oldServiceName, manifestObj, oldBundleVersionPath;
  var oldBundleVersion, oldBundleNameFull;
  var instancePath = path.join(config.get()['app_dir'], this.name);
  var instanceVersionsRoot = path.join(instancePath, 'versions');
  var serviceName = sprintf('%s@%s', this.name, bundleVersion);
  var serviceState = null;

  // This needs direct service manager access to deal with multiple versions
  var previousVersionLink = path.join(self.getRoot(), 'previous');
  var manager = serviceManagement.getDefaultManager().getManager();

  function saveServiceState(callback) {
    self.getSerializedService(function(err, state) {
      serviceState = state;
      callback(err);
    });
  }

  // Get currently active bundle name and populate some variables
  function getBundleName(callback) {
    self.getBundleName(function(err, _bundleName) {
      if (err) {
        callback(err);
        return;
      }

      bundleName = _bundleName;

      bundleNameFull = misc.getFullBundleName(bundleName, bundleVersion);
      extractedBundleRoot = path.join(config.get()['extracted_dir'], bundleName);
      extractedBundlePath = path.join(extractedBundleRoot, bundleNameFull);
      newInstanceVersionPath = path.join(instanceVersionsRoot, bundleNameFull);
      callback();
    });
  }

  // Verify that the bundle for the specified version exists
  function verifyBundleExists(callback) {
    path.exists(extractedBundlePath, function(exists) {
      var err = null;

      if (!exists) {
        err = new Errorf('Bundle %s version %s doesn\'t exist', bundleName, bundleVersion);
      }

      callback(err);
    });
  }

  // Get the currently active bundle version
  function getBundleVersion(callback) {
    self.getBundleVersion(function(err, version) {
      if (err) {
        callback(err);
        return;
      }

      oldBundleVersion = version;
      oldServiceName = misc.getFullBundleName(self.name, version);
      oldBundleNameFull = misc.getFullBundleName(bundleName, version);
      oldBundleVersionPath = path.join(self.getRoot(), 'versions', oldBundleNameFull);
      callback();
    });
  }

  // Verify that user is not upgrading to the current version
  function verifyDifferentVersion(callback) {
    var err = null;
    if (oldBundleVersion === bundleVersion) {
      err = new Errorf('Version %s is already active', bundleVersion);
    }

    callback(err);
  }

  // Prepare a new version
  function prepareVersion(callback) {
    self.prepareVersion(bundleVersion, callback);
  }

  // Retrieve the manifest object
  function retrieveManifestObject(callback) {
    var manifestPath = path.join(extractedBundlePath, manifestConstants.MANIFEST_FILENAME);
    manifest.getManifestObject(manifestPath, true, function(err, _manifestObj) {
      manifestObj = _manifestObj;
      callback(err);
    });
  }

  // Create a new service for this version
  function createNewService(callback) {
    deployServices.createService(serviceName, newInstanceVersionPath, manifestObj, callback);
  }

  // Activate a new version
  function activateNewVersion(callback) {
    self.activateVersion(bundleVersion, callback);
  }

  // Disable the old service
  function disableOldService(callback) {
    flowctrl.callIgnoringError(manager.runAction, manager, oldServiceName,
                               'disable', callback);
  }

  // Enable and start the new service
  function startNewService(callback) {
    if (!serviceState.enabled) {
      // Leave service disabled
      callback();
    } else if (serviceState.status.state !== 'running') {
      // Enable, but don't start the service
      manager.runAction(serviceName, 'enable', callback);
    } else {
      // Enable and start the service
      deployServices.enableAndStartService(serviceName, callback);
    }
  }

  // Create a previous symlink which points to the previous version bundle
  function symlinkOldToPrevious(callback) {
    function createSymlink() {
      fs.symlink(oldBundleVersionPath, previousVersionLink, callback);
    }

    flowctrl.callIgnoringError(fs.unlink, null, previousVersionLink, createSymlink);
  }

  function destroyOldService(callback) {
    // TODO: Do a rollback if a new service is still reported as down after x
    // milliseconds.
    manager.runAction(oldServiceName, 'destroy', callback);
  }

  var ops = [
    saveServiceState,
    getBundleName,
    verifyBundleExists,
    getBundleVersion,
    verifyDifferentVersion,
    prepareVersion,
    retrieveManifestObject,
    createNewService,
    activateNewVersion,
    disableOldService,
    startNewService,
    symlinkOldToPrevious,
    destroyOldService
  ];

  async.series(ops, function(err) {
    callback(err);
  });
};


/**
 * Given a bundle version, hard hard link all the files into place, render
 * any templates and resolve all data files.
 *
 * @param {String} version    The version of the bundle to prepare.
 * @param {Function} callback A callback fired with (err).
 */
Instance.prototype.prepareVersion = function(version, callback) {
  var self = this;
  var extractedBundlePath, bundleName, bundleNameFull, manifestObj;
  var instanceVersionPath, ignoredPaths;

  var bundleLinkPath = path.join(self.getRoot(), 'bundle');
  var hookEnv = { 'CAST_INSTANCE_NAME': self.name };

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
          err = new Errorf('Instance \'%s\' already has version \'%s\'', self.name, version);
        }
        callback(err);
        return;
      });
    },

    // Make sure an extracted bundle exists for the requested version
    function(callback) {
      fs.stat(extractedBundlePath, function(err, stats) {
        if (!err && !stats.isDirectory()) {
          err = new Errorf('No bundle for version \'%s\'', version);
        }
        callback(err);
        return;
      });
    },

    // Create the directory for the target version
    function(callback) {
      fsutil.ensureDirectory(instanceVersionPath, callback);
    },

    // Retrieve the manifest object
    function(callback) {
      var manifestPath = path.join(extractedBundlePath, manifestConstants.MANIFEST_FILENAME);
      manifest.getManifestObject(manifestPath, true, function(err, _manifestObj) {
        manifestObj = _manifestObj;
        ignoredPaths = manifestObj['template_files'].concat(manifestObj['data_files']);
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
      var instanceData = deployTemplates.getInstanceTemplateObject(self.name,
                                                                   instanceVersionPath,
                                                                    version);
      deployTemplates.realizeApplicationTemplates(manifestObj, instanceData, extractedBundlePath,
                                                     instanceVersionPath, callback);
    },

    // Hard-link all the files (except template and data files)
    function(callback) {
      fsutil.hardLinkFiles(extractedBundlePath, instanceVersionPath, ignoredPaths, callback);
    },

    // Resolve the data files
    function(callback) {
      var instanceDataRoot = path.join(self.getRoot(), 'data');
      deployFiles.resolveDataFiles(extractedBundlePath, instanceDataRoot, instanceVersionPath,
                                   manifestObj['data_files'], callback);
    },

    // Execute the 'post_prepare' hook
    function(callback) {
      var hook = new hooks.InstanceHook('post', 'post_prepare',
                                        instanceVersionPath, false, hookEnv);
      hook.execute(null, [version], callback);
    }
  ], callback);
};


/**
 * Point the 'current' symlink to the specified version. Will verify
 * that the specified version exists before taking action.
 *
 * @param {String} version    The version to activate.
 * @param {Function} callback A callback fired with (err).
 */
Instance.prototype.activateVersion = function(version, callback) {
  var self = this;
  var newVersionPath;

  var newVersionLink = path.join(self.getRoot(), 'new');
  var currentVersionLink = path.join(self.getRoot(), 'current');
  var hookEnv = { 'CAST_INSTANCE_NAME': self.name };

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
          err = new Errorf('Cannot activate nonexistent version \'%s\'', version);
        }

        callback(err);
        return;
      });
    },

    function(callback) {
      var hook = new hooks.InstanceHook('post', 'pre_version_activate',
                                        newVersionPath, false, hookEnv);
      hook.execute(null, [version, newVersionPath], callback);
    },

    // Create the new link
    function(callback) {
      fs.symlink(path.resolve(newVersionPath), newVersionLink, callback);
    },

    // Atomically move it into place
    async.apply(fs.rename, newVersionLink, currentVersionLink),

    function(callback) {
      var hook = new hooks.InstanceHook('post', 'post_version_activate',
                                        newVersionPath, false, hookEnv);
      hook.execute(null, [version, newVersionPath], callback);
    }
  ], callback);
};


/**
 * Create an instance with a specified name for the specified bundle. The
 * instance will initially use the specified version of the bundle.
 *
 * @param {String} bundleName    The name of the bundle to use.
 * @param {String} bundleVersion The version of the bundle to use.
 * @param {Function} callback    A callback fired with (err).
 */
Instance.prototype.create = function(bundleName, bundleVersion, callback) {
  var self = this;

  var manifestObj, ignoredPaths;
  var bundleNameFull = misc.getFullBundleName(bundleName, bundleVersion);

  // Get the paths to the extracted bundle and the manifest
  var extractedBundleRoot = path.join(config.get()['extracted_dir'], bundleName);
  var extractedBundlePath = path.join(extractedBundleRoot, bundleNameFull);

  var instancePath = path.join(config.get()['app_dir'], this.name);
  var instanceDataRoot = path.join(instancePath, 'data');
  var instanceVersionsRoot = path.join(instancePath, 'versions');
  var instanceBundleLink = path.join(instancePath, 'bundle');
  var instanceCurrentLink = path.join(instancePath, 'current');
  var instanceVersionPath = path.join(instanceVersionsRoot, bundleNameFull);
  var serviceName = sprintf('%s@%s', this.name, bundleVersion);
  var created = false;

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

    // Create the instance directory
    function(callback) {
      fsutil.ensureDirectory(instancePath, function(err) {
        if (!err) {
          created = true;
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
      self.prepareVersion(bundleVersion, callback);
    },

    // Retrieve the manifest object
    function(callback) {
      var manifestPath = path.join(extractedBundlePath, manifestConstants.MANIFEST_FILENAME);
      manifest.getManifestObject(manifestPath, true, function(err, _manifestObj) {
        manifestObj = _manifestObj;
        callback(err);
        return;
      });
    },

    // Create a runit service
    function(callback) {
      deployServices.createService(serviceName, instanceVersionPath, manifestObj, callback);
    },

    // Symlink instace bundle version to "current"
    function(callback) {
      self.activateVersion(bundleVersion, callback);
    }
  ],

  function(err) {
    if (err && created) {
      // If instance has been created but an error has been encountered, clean up
      // and remove the instance.
      self.destroy(function() {
        callback(err);
        return;
      });
    } else {
      callback(err);
    }
  });
};


/**
 * Manages instances.
 * @constructor
 */
function InstanceManager() {
  jobs.ResourceManager.call(this);
  this.resourceType = Instance;

  var conf = config.get();
  this.root = conf['app_dir'];
}

util.inherits(InstanceManager, jobs.ResourceManager);


/**
 * Initialize the instance manager.
 * @param {Function} callback A callback fired with (err).
 */
InstanceManager.prototype.init = function(callback) {
  fsutil.ensureDirectory(this.root, callback);
};


exports.Instance = Instance;
exports.InstanceManager = InstanceManager;
