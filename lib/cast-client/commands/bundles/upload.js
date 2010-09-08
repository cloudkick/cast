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

var config = {
  short_description: 'Upload an application bundle.',
  long_description: 'Upload an application bundle to a remote server.',
  required_arguments: [],
  optional_arguments: [['version', 'The bundle version to upload, defaults to the newest available']],
  switches: []
};

function handle_command(args) {
  var manifest_path = path.join(process.cwd(), MANIFEST_FILENAME);
  var bundledir = path.join(process.cwd(), client_config.get().temp_directory);
  var version = args.version;
  var bundlename;
  var fpath;
  var sha1;
  var size = 0;

  async.series([
    function(callback) {
      // If no version was specified then look up the most recently modified bundle
      if (!version) {
        fs.readdir(bundledir, function(err, files) {
          var msg;

          if (err) {
            msg = "Unable to read " + bundledir + ", have you created a bundle yet?";;
            return callback(new Error(msg));
          }

          var newestfile;
          var newestmtime;

          async.forEach(files, function(file, callback) {
            fs.stat(path.join(bundledir, file), function(err, stats) {
              if (!err && stats.isFile() && (!newestmtime || stats.mtime > newestmtime)) {
                newestmtime = stats.mtime;
                newestfile = file;
              }
              return callback();
            });
          },
          function(err) {
            if (!err && !newestfile) {
              msg = "No bundles found in " + bundledir + " have you created one yet?";
              err = new Error(msg);
            }
            else {
              fpath = path.join(bundledir, newestfile);
            }
            return callback(err);
          });
        });
      }

      // If a version was specified, make sure it exists
      else {
        fpath = path.join(bundledir, version + '.tar.gz');
        fs.stat(fpath, function(err, stats) {
          if (err || !stats.isFile()) {
            err = new Error("Specified version does not exist.");
          }
          return callback(err);
        });
      }
    },

    // Validate the manifest and get the bundle name
    function(callback) {
      manifest.validate_manifest(manifest_path, function(err, app_manifest) {
        if (!err) {
          bundlename = misc.get_valid_bundle_name(app_manifest.name);
        }
        return callback(err);
      });
    },

    // Calculate the SHA1
    function(callback) {
      sha1 = crypto.createHash('sha1');
      var fstream = fs.createReadStream(fpath, {'bufferSize': client_config.get().fileread_buffer_size});
      var errstate = false;

      fstream.on('data', function(data) {
        sha1.update(data);
        size += data.length;
      });

      fstream.on('error', function(err) {
        errstate = true;
        return callback(new Error("Error reading bundle file."));
      });

      fstream.on('end', function() {
        if (!errstate) {
          return callback();
        }
      });
    },

    function(callback) {
      var remotepath = path.join('/', 'bundles', bundlename, path.basename(fpath));
      var pbar = spinner.percentbar("Uploading " + path.basename(fpath), size);
      var completed = false;

      pbar.start();
      // TODO: Allow custom remotes
      var client = http.createClient(8010, 'localhost');

      client.on('error', function(err) {
        completed = true;
        return callback(new Error("A connection error occurred"));
      });

      var bytes = 0;

      var request = client.request('PUT', remotepath, {
        'host': 'localhost',
        'content-length': size,
        'transfer-encoding': 'chunked',
        'x-content-sha1': sha1.digest('base64')
      });

      var fstream = fs.createReadStream(fpath, {'bufferSize': client_config.get().fileread_buffer_size});

      pumpfile.pumpfileout(fpath, request,
        function(bytes) {
          if (!completed) {
            pbar.tick(bytes);
          }
        },
        function(err) {
          if (!completed) {
            completed = true;

            if (err) {
              return callback(new Error("Error uploading bundle file"));
            }
            pbar.end();
            sys.puts("Waiting for response...");
            request.on('response', function(response) {
              if (response.statusCode === 204) {
                return callback();
              }
              var chunks = [];

              response.on('data', function(data) {
                chunks.push(data);
              });

              response.on('end', function() {
                try {
                  var err = JSON.parse(chunks.join(''));
                  return callback(new Error(err.message));
                }
                catch (err) {
                  return callback(new Error("Unexpected response from agent"));
                }
              });
            });
          }
        }
      );
    },
  ],
  function(err) {
    if (err) {
      sys.puts("Error: " + err.message);
    }
    else {
      sys.puts("Upload Successful");
    }
  });
}

exports.config = config;
exports.handle_command = handle_command;
