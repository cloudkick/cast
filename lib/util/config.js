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

var merge = require('util/misc').merge;
var expanduser = require('util/misc').expanduser;
var norris = require('norris');

var defaults = {
  'port': 49443, /* 49152 through 65535 are 'Private' Ports from IANA.
                  * It'd be nice to register one for Cast at somepoint... */

  'data_root': '/opt/cast/',

  // This directories are relative to the data root
  'data_dir': 'data', // Stores application data files
  'service_dir': 'services', // Runit services directory
  'bundle_dir': 'bundles', // Stores bundle tarballs
  'extracted_dir': 'extracted', // Stores extracted bundles
  'app_dir': 'applications', // Stores application instances
  'ssl_cert': 'agent.crt',
  'ssl_key': 'agent.key',

  'fileread_buffer_size': (1024 * 64),
  'runsvdir_binary': 'runsvdir',
  'gzip': 'gzip',
  'tar': null,
  'norris_ttl': (60 * 10),

  // These are used by a client
  'temp_directory': '.cast-temp',

  // Runit defaults
  'runit': {
    'service_user': 'root',
    'svlogd_daemon_user': 'syslog',
    'log_directory': 'main',
    'max_log_size': 10 * 1024 * 1024,
    'max_log_num': 10
  }
};

// Which two settings to join together to form a new absolute path.
// Both paths which are joined together are saved in the config_current object where the property name is the name
// of the second variable (basically, the value of the second variable gets replaced with the new joined value).
var paths_to_join = [['data_root', 'data_dir'],
                     ['data_root', 'service_dir'],
                     ['data_root', 'bundle_dir'],
                     ['data_root', 'extracted_dir'],
                     ['data_root', 'app_dir'],
                     ['data_root', 'ssl_cert'],
                     ['data_root', 'ssl_key']];

var poffset = 0;

exports.config_files = ['~/.cast/config.json', '/etc/cast.conf'];
exports.config_current = {};

exports.setup = function(cb) {
  function join_paths(callback) {
    var path1_settings, path2_settings, path1, path2;

    paths_to_join.forEach(function(path_tuple) {
      path1_setting = path_tuple[0];
      path2_setting = path_tuple[1];

      path1 = exports.config_current[path1_setting];
      path2 = exports.config_current[path2_setting];

      exports.config_current[path2_setting] = path.join(path1, path2);
    });

    callback(null);
  }

  function resolve_via_norris(cb, err) {
    if (err) {
      cb(err);
    }
    norris.get(function(facts) {
      if (exports.config_current.tar === null) {
        exports.config_current.tar = facts.gnutar;
      }

      join_paths(cb);
    });
  }

  exports.config_current = merge(exports.config_current, defaults);
  function dostep() {
    var p = expanduser(exports.config_files[poffset]);
    fs.readFile(p, function(err, data) {
      if (!err) {
        var parsed = {};
        try {
          parsed = JSON.parse(data.toString());
        } catch (eerr) {
          cb(eerr);
        }
        exports.config_current = merge(exports.config_current, parsed);
      }

      poffset++;
      if (exports.config_files.length == poffset) {
        resolve_via_norris(cb, null);
      }
      else {
        dostep();
      }
    });
  }
  dostep();
};

exports.get = function() {
  return exports.config_current;
};
