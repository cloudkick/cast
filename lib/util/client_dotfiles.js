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
var client_config = require('util/config');
var misc = require('util/misc');
var expanduser = require('util/misc').expanduser;
var fsutil = require('util/fs');


/**
 * The path to the dot cast directory (currently ~/.cast)
 */
var dot_cast = exports.dot_cast_path = misc.expanduser('~/.cast');

/**
 * The path to the remotes.json file in the dot cast directory
 */
var dot_cast_remotes = exports.dot_cast_remotes_path = path.join(dot_cast, 'remotes.json');

/**
 * Get the path to the cast project directory for a project
 *
 * @param {String} projectpath  The path to the root of the project.
 */
exports.dot_cast_project_path = function(projectpath) {
  return path.join(projectpath, '.cast-project');
};

/**
 * Create the user's ~/.cast directory if it doesn't exist.
 *
 * @param {Function} callback A callback fired with a possible error.
 */
exports.ensure_dot_cast = function(callback) {
  fsutil.ensure_directory(dot_cast, callback);
};

/**
 * Creates a dot cast project directory if it doesn't exist.
 *
 * @param {String} projectpath The path to the project.
 * @param {Function} callback A callback fired upon completion with (err, dot_cast_project_path).
 */
exports.ensure_dot_cast_project = function(projectpath, callback) {
  var dot_cast_project_path = exports.dot_cast_project_path(projectpath);
  fsutil.ensure_directory(dot_cast_project_path, function(err) {
    return callback(err, dot_cast_project_path);
  });
};

/**
 * Get the remotes object which will default to an empty object if
 * the remotes file doesn't exist.
 *
 * @param {Function} callback A callback fired with (err, remotes).
 */
exports.get_remotes = function(callback) {
  path.exists(dot_cast_remotes, function(exists) {
    if (!exists) {
      return callback(null, {});
    }
    fs.stat(dot_cast_remotes, function(err, stats) {
      if (err) {
        return callback(err);
      }
      else if (!err && !stats.isFile()) {
        return callback(new Error(dot_cast_remotes + ' exists but is not a file'));
      }

      var fstream = fs.createReadStream(dot_cast_remotes, {
        bufferSize: client_config.get().fileread_buffer_size
      });
      var chunks = [];

      fstream.on('data', function(data) {
        chunks.push(data);
      });

      fstream.on('error', function(err) {
        fstream.removeAllListeners('data');
        fstream.removeAllListeners('end');
        fstream.removeAllListeners('error');
        return callback(new Error('Error reading ' + dot_cast_remotes));
      });

      fstream.on('end', function() {
        try {
          var remotes = JSON.parse(chunks.join(''));
          return callback(null, remotes);
        }
        catch (err2) {
          return callback(new Error('Unable to parse remotes file'));
        }
      });
    });
  });
};
