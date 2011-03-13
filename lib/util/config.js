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

/**
 * Configuration subsytem, providing a set of defaults, and merging of a configuration
 * JSON file.
 */

var fs = require('fs');
var path = require('path');

var async = require('extern/async');

var fsutil = require('util/fs');
var merge = require('util/misc').merge;
var expanduser = require('util/misc').expanduser;
var constants = require('constants');

var serviceManagement = require('service_management');

var defaults = {
  'port': 49443, /* 49152 through 65535 are 'Private' Ports from IANA.
                  * It'd be nice to register one for Cast at somepoint... */

  'data_root': '/opt/cast/',

  // This directories are relative to the data root
  'data_dir': 'data', // Stores application data files
  'service_dir_available': 'services', // Directory in which the available runit services reside
  'service_dir_enabled': 'services-enabled',  // Directory in which runsvdir is running
  'bundle_dir': 'bundles', // Stores bundle tarballs
  'extracted_dir': 'extracted', // Stores extracted bundles
  'app_dir': 'applications', // Stores application instances

  /* TODO: Enable SSL again */
  'ssl_enabled': false,
  'ssl_cert': 'agent.crt', // Relative path to agent ssl certificate
  'ssl_key': 'agent.key', // Relative path to agent ssl private key
  'ssl_ciphers': 'RC4-SHA:AES128-SHA:AES256-SHA', // enabled ciphers for SSL

  'hmac_algorithm': 'sha256',

  /* TODO: make this a client certificate? */
  'secret': null,

  'fileread_buffer_size': (1024 * 64),
  'runsvdir_binary': 'runsvdir',
  'gzip': 'gzip',
  'tar': null,
  'norris_ttl': (60 * 10),

  // Default service manager
  'service_manager': 'runit'
};

// Which two settings to join together to form a new absolute path.
// Both paths which are joined together are saved in the config_current object where the property name is the name
// of the second variable (basically, the value of the second variable gets replaced with the new joined value).
var pathsToJoin = [['data_root', 'data_dir'],
                     ['data_root', 'service_dir_available'],
                     ['data_root', 'service_dir_enabled'],
                     ['data_root', 'bundle_dir'],
                     ['data_root', 'extracted_dir'],
                     ['data_root', 'app_dir'],
                     ['data_root', 'ssl_cert'],
                     ['data_root', 'ssl_key']];

exports.configFiles = ['~/.cast/config.json', '/etc/cast.conf'];
exports.configCurrent = {};

function setup(validationCb, cb) {
  function joinPaths(callback) {
    // Join the paths listed in paths_to_join together
    var path1Setting, path2Setting, path1, path2;

    pathsToJoin.forEach(function(pathTuple) {
      path1Setting = pathTuple[0];
      path2Setting = pathTuple[1];

      path1 = exports.configCurrent[path1Setting];
      path2 = exports.configCurrent[path2Setting];

      exports.configCurrent[path2Setting] = path.join(path1, path2);
    });

    callback(null);
  }

  function validateConfig(callback) {
    // Perform any necessary validation of the configuration.
    // It seems best to keep this async on the off-chance we ever need to hit
    // filesystem or network in the process
    var err = null;

    if (exports.configCurrent['ssl_enabled'] && !exports.configCurrent.secret) {
      err = new Error('SSL is enabled  but no \'secret\' has been provided.');
    }

    callback(err);
  }

  function mergeManagerConfigDefaults(callback) {
    // Merge the service manager default config values
    var managerName = exports.configCurrent['service_manager'];
    var manager = serviceManagement.getManager(managerName).configDefaults;
    var managerProperties, property, value;

    if (!exports.configCurrent[managerName]) {
      exports.configCurrent[managerName] = {};
    }
    managerProperties = Object.keys(manager);

    for (var i = 0; i < managerProperties.length; i++) {
      property = managerProperties[i];
      if (!exports.configCurrent[managerName][property]) {
        value = manager[property];
        exports.configCurrent[managerName][property] = value;
      }
    }

    callback(null);
  }

  // Load the default configuration
  exports.configCurrent = merge(exports.configCurrent, defaults);

  // Load each config file on top of the default
  async.forEachSeries(exports.configFiles, function(configPath, callback) {
    fsutil.jsonFile(expanduser(configPath), function(err, obj) {
      // Ignore missing config files
      if (err && err.errno === constants.ENOENT) {
        err = null;
      }

      if (!err) {
        exports.configCurrent = merge(exports.configCurrent, obj);
      }
      callback(err);
    });
  },

  // Validate and perform final config manipulations
  function(err) {
    if (err) {
      cb(err);
      return;
    }

    async.series([
      validateConfig,
      validationCb,
      joinPaths,
      mergeManagerConfigDefaults
    ], cb);
  });
}

exports.setupAgent = function(cb) {
  function validateAgentConfig(callback) {
    callback();
  }

  setup(validateAgentConfig, cb);
};

exports.setupClient = function(cb) {
  function validateClientConfig(callback) {
    callback();
  }

  setup(validateClientConfig, cb);
};

exports.get = function() {
  return exports.configCurrent;
};
