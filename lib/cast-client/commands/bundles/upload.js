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
var http = require('util/http');
var crypto = require('crypto');
var pumpfile = require('util/http_pumpfile');
var clientConfig = require('util/config');
var dotfiles = require('util/client_dotfiles');
var misc = require('util/misc');
var spinner = require('util/spinner');
var manifest = require('manifest/index');
var MANIFEST_FILENAME = require('manifest/constants').MANIFEST_FILENAME;
var async = require('extern/async');

/** Configuration options for upload subcommand */
exports.config = {
  shortDescription: 'Upload an application bundle.',
  longDescription: 'Upload an application bundle to a remote server.',
  requiredArguments: [],
  optionalArguments: [['version', 'The bundle version to upload, defaults to the newest available']],
  usesGlobalOptions: ['remote']
};

/**
 * Handler for uploading a bundle.
 * @param {Object} args Command line arguments.
 * @param {String} args.version Application version number to create.
 */
exports.handleCommand = function(args) {
  var cwd = process.cwd();
  var manifestPath = path.join(cwd, MANIFEST_FILENAME);
  var version = args.version;
  var bundlename;
  var fpath;
  var size = 0;
  var pbar;
  var sha1;
  var request;

  async.series([
    // Validate the manifest and get the bundle name
    function(callback) {
      manifest.validateManifest(manifestPath, function(err, appManifest) {
        if (!err) {
          bundlename = misc.getValidBundleName(appManifest.name);
        }
        callback(err);
        return;
      });
    },

    function(callback) {
      // If no version was specified then look up the most recently modified bundle
      if (!version) {
        dotfiles.getNewestBundle(cwd, function(err, bundle) {
          fpath = dotfiles.getBundlePath(cwd, bundle);
          callback(err);
        });
      }

      // If a version was specified, make sure it exists
      else {
        var fullBundlename = misc.getFullBundleName(bundlename, version);
        fpath = dotfiles.getBundlePath(cwd, fullBundlename);
        callback();
      }
    },

    // Get the bundles size
    function(callback) {
      fs.stat(fpath, function(err, stats) {
        if (err || !stats.isFile()) {
          err = new Error('Specified version does not exist.');
        }
        else {
          size = stats.size;
        }
        callback(err);
        return;
      });
    },

    function(callback) {
      var remotepath = path.join('/', 'bundles', bundlename, path.basename(fpath));
      pbar = spinner.percentbar('Uploading ' + path.basename(fpath) + ' (' + size + ' bytes)', size);

      var opts = {
        method: 'PUT',
        path: remotepath,
        headers: { trailer: 'x-content-sha1' }
      };

      pbar.start();

      http.buildRequest(args.remote, opts, function(err, _request) {
        request = _request;
        callback(err);
      });
    },

    function(callback) {
      function tick(bytes) {
        pbar.tick(bytes);
      }

      pumpfile.pumpfileout(fpath, request, tick, function(err, _sha1) {
        sha1 = _sha1;
        callback(err);
      });
    },

    function(callback) {
      pbar.end();
      request.addTrailers({'x-content-sha1': sha1.digest('base64')});

      request.on('response', function(response) {
        // We *should* get a 204
        if (response.statusCode === 204) {
          callback();
          return;
        }
        var chunks = [];

        response.on('data', function(data) {
          chunks.push(data);
        });

        response.on('end', function() {
          try {
            var err = JSON.parse(chunks.join(''));
            callback(new Error(err.message));
            return;
          }
          catch (err2) {
            callback(new Error('Unexpected response from agent'));
            return;
          }
        });
      });

      request.end();
      sys.puts('Waiting for response...');
    }
  ],
  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else {
      sys.puts('Upload Successful');
    }
  });
};
