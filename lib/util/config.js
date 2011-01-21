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
var constants = require('util/constants');

var service_management = require('service_management');

var defaults = {
  'port': 49443, /* 49152 through 65535 are 'Private' Ports from IANA.
                  * It'd be nice to register one for Cast at somepoint... */

  'data_root': '/opt/cast/',

  'service_root': null, // Directory in which enabled runit services reside.
                        // This directory must be specified by the user and
                        // there must be a 'runsvdir' process running for this
                        // directory.

  // This directories are relative to the data root
  'data_dir': 'data', // Stores application data files
  'service_dir_available': 'services', // Directory in which the available runit services reside
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

  // These are used by a client
  'temp_directory': '.cast-temp',

  // Default service manager
  'service_manager': 'runit'
};

// Which two settings to join together to form a new absolute path.
// Both paths which are joined together are saved in the config_current object where the property name is the name
// of the second variable (basically, the value of the second variable gets replaced with the new joined value).
var paths_to_join = [['data_root', 'data_dir'],
                     ['data_root', 'service_dir_available'],
                     ['data_root', 'bundle_dir'],
                     ['data_root', 'extracted_dir'],
                     ['data_root', 'app_dir'],
                     ['data_root', 'ssl_cert'],
                     ['data_root', 'ssl_key']];

exports.config_files = ['~/.cast/config.json', '/etc/cast.conf'];
exports.config_current = {};

exports.setup = function(cb) {
  function join_paths(callback) {
    // Join the paths listed in paths_to_join together
    var path1_setting, path2_setting, path1, path2;

    paths_to_join.forEach(function(path_tuple) {
      path1_setting = path_tuple[0];
      path2_setting = path_tuple[1];

      path1 = exports.config_current[path1_setting];
      path2 = exports.config_current[path2_setting];

      exports.config_current[path2_setting] = path.join(path1, path2);
    });

    callback(null);
  }

  function validate_config(callback) {
    // Perform any necessary validation of the configuration.
    // It seems best to keep this async on the off-chance we ever need to hit
    // filesystem or network in the process
    var err = null;

    if (exports.config_current.ssl_enabled && !exports.config_current.secret) {
      err = new Error('SSL is enabled  but no \'secret\' has been provided.');
    }
    else if (!exports.config_current.service_root) {
      err = new Error('No service_root has been configured');
    }

    callback(err);
  }

  function merge_manager_config_defaults(callback) {
    // Merge the service manager default config values
    var manager_name = exports.config_current.service_manager;
    var manager = service_management.get_manager(manager_name).config_defaults;
    var manager_properties, property, value;

    exports.config_current[manager_name] = {};
    manager_properties = Object.keys(manager);

    for (var i = 0; i < manager_properties.length; i++) {
      property = manager_properties[i];
      value = manager[property];

      exports.config_current[manager_name][property] = value;
    }

    callback(null);
  }

  // Load the default configuration
  exports.config_current = merge(exports.config_current, defaults);

  // Load each config file on top of the default
  async.forEachSeries(exports.config_files, function(config_path, callback) {
    fsutil.json_file(expanduser(config_path), function(err, obj) {
      // Ignore missing config files
      if (err && err.errno === constants.ENOENT) {
        err = null;
      }

      if (!err) {
        exports.config_current = merge(exports.config_current, obj);
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
      validate_config,
      join_paths,
      merge_manager_config_defaults
    ], cb);
  });
};

exports.get = function() {
  return exports.config_current;
};
