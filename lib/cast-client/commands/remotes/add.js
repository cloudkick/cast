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

var sys = require('sys');
var fs = require('fs');
var path = require('path');
var http = require('http');
var crypto = require('crypto');
var pumpfile = require('util/http_pumpfile');
var client_config = require('util/config');
var misc = require('util/misc');
var spinner = require('util/spinner');
var manifest = require('manifest/index');
var MANIFEST_FILENAME = require('manifest/constants').MANIFEST_FILENAME;
var async = require('extern/async');

exports.config = {
  short_description: 'Add a remote',
  long_description: 'Add a reference to a remote cast-agent',
  required_arguments: [
    ['name', 'A name for the remote'],
    ['url', 'The URL to the remote']
  ],
  optional_arguments: [],
  switches: []
};

exports.handle_command = function(args) {
  // TODO: Make this available to all commands
  var dot_cast = misc.expanduser('~/.cast');
  var dot_cast_remotes = path.join(dot_cast, 'remotes.json');
  var read_stream_opts = {
    bufferSize: client_config.get().fileread_buffer_size
  };

  async.waterfall([
    // Make sure ~/.cast exists
    function(callback) {
      path.exists(dot_cast, function(exists) {
        if (!exists) {
          fs.mkdir(dot_cast, 0644, function(err) {
            return callback(err);
          });
        }
        else {
          fs.stat(dot_cast, function(err, stats) {
            if (!err && !stats.isDirectory()) {
              err = new Error(dot_cast + " exists but is not a directory");
            }
            return callback(err);
          });
        }
      });
    },

    // Get or create the current remotes object
    function(callback) {
      path.exists(dot_cast_remotes, function(exists) {
        if (!exists) {
          return callback(null, {});
        }
        fs.stat(dot_cast_remotes, function(err, stats) {
          if (err) {
            return callback(err);
          }
          else if (!err && !stats.isFile()) {
            return callback(new Error(dot_cast_remotes + " exists but is not a file"));
          }

          var fstream = fs.createReadStream(dot_cast_remotes, read_stream_opts);
          var chunks = [];

          fstream.on('data', function(data) {
            chunks.push(data);
          });

          fstream.on('error', function(err) {
            fstream.removeAllListeners('data');
            fstream.removeAllListeners('end');
            fstream.removeAllListeners('error');
            return callback(new Error("Error reading " + dot_cast_remotes));
          });

          fstream.on('end', function() {
            try {
              var remotes = JSON.parse(chunks.join(''));
              return callback(null, remotes);
            }
            catch (err) {
              return callback(new Error("Unable to parse remotes file"));
            }
          });
        });
      });
    },

    // Insert the new remote
    function(remotes, callback) {
      if (remotes[args.name]) {
        return callback(new Error("Remote with name '" + args.name + "' already exists"));
      }
      remotes[args.name] = {url: args.url};
      return callback(null, remotes);
    },

    // Save the remotes
    function(remotes, callback) {
      var fstream = fs.createWriteStream(dot_cast_remotes);

      fstream.write(JSON.stringify(remotes, null, 4));

      fstream.on('end', function() {
        return callback();
      });

      fstream.on('error', function(err) {
        fstream.removeAllListeners('end');
        return callback(new Error("Error writing remotes file"));
      });
    }
  ],
  function(err) {
    if (err) {
      sys.puts("Error: " + err.message);
    }
    else {
      sys.puts("Remote added");
    }
  });
};
