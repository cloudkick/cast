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
 * Configuration subsytem, providing a set of defaults, and merging of a
 * configuration JSON file.
 */

var fs = require('fs');
var path = require('path');

var async = require('async');

var log = require('util/log');
var fsutil = require('util/fs');
var merge = require('util/misc').merge;
var expanduser = require('util/misc').expanduser;
var constants = require('constants');

var serviceManagement = require('service_management');

var defaults = {
  /* Cast API Port and IP */
  'port': 49443,
  'ip': '0.0.0.0',

  /* Cast Data Root */
  'data_root': '/opt/cast/',

  /* Subdirectories of the Data Root */
  'data_dir': 'data',                         // Application data files
  'service_dir_available': 'services',        // All available services
  'service_dir_enabled': 'services-enabled',  // All enabled services
  'bundle_dir': 'bundles',                    // Bundle tarballs
  'extracted_dir': 'extracted',               // Extracted bundles
  'app_dir': 'applications',                  // Application instances
  'ca_dir': 'ca',                             // CA related files

  /* SSL Configuration */
  'ssl_enabled': true,          // Whether SSL is enabled
  'certgen_days': 1825,         // Days issued certificates remain valid
  'certgen_size': 2048,         // Size in bits of generated keys
  'ssl_cert': 'agent.crt',      // Relative path to agent ssl certificate
  'ssl_key': 'agent.key',       // Relative path to agent ssl private key
  'ssl_ca_cert': 'ca.crt',      // Relative path to agent ssl CA certificate
  'verify_client_cert': true,   // Should client certificates be validated?
  'warn_unauthorized': false,   // Tell unauthorized clients what went wrong?
  'ssl_ciphers': 'RC4-SHA:AES128-SHA:AES256-SHA', // Enabled ciphers for SSL

  /* CA Configuration, Relative to ca_dir */
  'ssl_ca_key': 'ca.key',       // CA key
  'ssl_ca_serial': 'ca.srl',    // CA serial number file
  'ssl_ca_outdir': 'out',       // CA output directory

  /* Shared Secret Configuration */
  'hmac_algorithm': 'sha256',
  'warn_nosecret': true,
  'secret': '',

  /* Miscellaneous Configuration */
  'fileread_buffer_size': (1024 * 64),  // Buffer size when reading files
  'runsvdir_binary': 'runsvdir',        // runsvdir binary
  'gzip': 'gzip',                       // gzip binary
  'tar': null,                          // tar binary (TODO: deprecated?)
  'norris_ttl': (60 * 10),              // TTL of norris cache
  'pretty_json': false,                 // Output pretty JSON

  /* Service Manager Related Configuration */
  'service_manager': 'runit'
};

// Which two settings to join together to form a new absolute path.  Both paths
// which are joined together are saved in the config_current object where the
// property name is the name of the second variable (basically, the value of
// the second variable gets replaced with the new joined value).
var pathsToJoin = [
  ['data_root', 'data_dir'],
  ['data_root', 'service_dir_available'],
  ['data_root', 'service_dir_enabled'],
  ['data_root', 'bundle_dir'],
  ['data_root', 'extracted_dir'],
  ['data_root', 'app_dir'],
  ['data_root', 'ssl_cert'],
  ['data_root', 'ssl_key'],
  ['data_root', 'ssl_ca_cert'],
  ['data_root', 'ca_dir'],
  ['ca_dir', 'ssl_ca_key'],
  ['ca_dir', 'ssl_ca_serial'],
  ['ca_dir', 'ssl_ca_outdir']
];

exports.configFiles = ['~/.cast/config.json', '/etc/cast.conf'];
exports.currentConfig = {};

function setup(validationCb, callback) {
  function joinPaths(callback) {
    // Join the paths listed in paths_to_join together
    var path1Setting, path2Setting, path1, path2;

    pathsToJoin.forEach(function(pathTuple) {
      path1Setting = pathTuple[0];
      path2Setting = pathTuple[1];

      path1 = exports.currentConfig[path1Setting];
      path2 = exports.currentConfig[path2Setting];

      exports.currentConfig[path2Setting] = path.join(path1, path2);
    });

    callback(null);
  }

  function validateConfig(callback) {
    callback();
  }

  function mergeManagerConfigDefaults(callback) {
    // Merge the service manager default config values
    var managerName = exports.currentConfig['service_manager'];
    var manager = serviceManagement.getManager(managerName).configDefaults;
    var managerProperties, property, value;

    if (!exports.currentConfig[managerName]) {
      exports.currentConfig[managerName] = {};
    }
    managerProperties = Object.keys(manager);

    for (var i = 0; i < managerProperties.length; i++) {
      property = managerProperties[i];
      if (!exports.currentConfig[managerName][property]) {
        value = manager[property];
        exports.currentConfig[managerName][property] = value;
      }
    }

    callback(null);
  }

  // Load the default configuration
  exports.currentConfig = merge(exports.currentConfig, defaults);

  // Load each config file on top of the default
  async.forEachSeries(exports.configFiles, function(configPath, callback) {
    fsutil.jsonFile(expanduser(configPath), function(err, obj) {
      // Ignore missing config files
      if (err && err.errno === constants.ENOENT) {
        err = null;
      }

      if (!err) {
        exports.currentConfig = merge(exports.currentConfig, obj);
      }
      callback(err);
    });
  },

  // Validate and perform final config manipulations
  function(err) {
    if (err) {
      callback(err);
      return;
    }

    async.series([
      joinPaths,
      validateConfig,
      validationCb,
      mergeManagerConfigDefaults
    ], callback);
  });
}

exports.setupAgent = function(callback) {
  function validateAgentConfig(callback) {
    var err = null;
    var conf = exports.currentConfig;

    if (!conf['secret'] && conf['warn_nosecret']) {
      log.warn('WARNING: No \'secret\' has been configured.');
    }

    callback(err);
  }

  setup(validateAgentConfig, callback);
};

exports.get = function() {
  return exports.currentConfig;
};
