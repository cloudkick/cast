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
var misc = require('util/misc');
var path = require('path');
var client_config = require('util/config');
var expanduser = require('util/misc').expanduser;

/**
 * The path to the dot cast directory (currently ~/.cast)
 */
var dot_cast = exports.dot_cast_path = misc.expanduser("~/.cast");

/**
 * The path to the remotes.json file in the dot cast directory
 */
var dot_cast_remotes = exports.dot_cast_remotes_path = path.join(dot_cast, 'remotes.json');

/**
 * Create the user's ~/.cast directory if it doesn't exist.
 *
 * @param {Function} cb A callback fired with a possible error
 */
exports.ensure_dot_cast = function(cb) {
  var dot_cast = misc.expanduser("~/.cast");
  path.exists(dot_cast, function(exists) {
    if (!exists) {
      fs.mkdir(dot_cast, 0755, function(err) {
        return cb(err);
      });
    }
    else {
      fs.stat(dot_cast, function(err, stats) {
        if (!err && !stats.isDirectory()) {
          err = new Error(dot_cast + " exists but is not a directory");
        }
        return cb(err);
      });
    }
  });
};

/**
 * Get the remotes object which will default to an empty object if
 * the remotes file doesn't exist.
 *
 * @param {Function} cb A callback fired with (err, remotes)
 */
exports.get_remotes = function(cb) {
  path.exists(dot_cast_remotes, function(exists) {
    if (!exists) {
      return cb(null, {});
    }
    fs.stat(dot_cast_remotes, function(err, stats) {
      if (err) {
        return cb(err);
      }
      else if (!err && !stats.isFile()) {
        return cb(new Error(dot_cast_remotes + " exists but is not a file"));
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
        return cb(new Error("Error reading " + dot_cast_remotes));
      });

      fstream.on('end', function() {
        try {
          var remotes = JSON.parse(chunks.join(''));
          return cb(null, remotes);
        }
        catch (err2) {
          return cb(new Error("Unable to parse remotes file"));
        }
      });
    });
  });
};
