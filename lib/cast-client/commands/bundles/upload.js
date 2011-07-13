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
var crypto = require('crypto');

var async = require('async');
var sprintf = require('sprintf').sprintf;
var terminal = require('terminal');

var http = require('util/http');
var pumpfile = require('util/http_pumpfile');
var clientConfig = require('util/config');
var dotfiles = require('util/client_dotfiles');
var misc = require('util/misc');
var manifest = require('manifest/index');
var clientUtils = require('util/client');
var MANIFEST_FILENAME = require('manifest/constants').MANIFEST_FILENAME;

/** Configuration options for upload subcommand */
var config = {
  shortDescription: 'Upload an application bundle.',
  longDescription: 'Upload an application bundle to a remote server.',
  requiredArguments: [],
  optionalArguments: [
    ['apppath', 'Path to folder containing the cast.json file and your application files'],
    ['version', 'The bundle version to upload, defaults to the newest available']
  ],
  usesGlobalOptions: ['debug', 'remote']
};

/**
 * Handler for uploading a bundle.
 * @param {Object} args Command line arguments.
 * @param {String} args.version Application version number to create.
 */
function handleCommand(args, parser, callback) {
  var applicationPath = args.apppath || process.cwd();
  var manifestPath = path.join(applicationPath, MANIFEST_FILENAME);
  var version = args.version;
  var bundlename;
  var fpath;
  var size = 0;
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
        dotfiles.getNewestBundle(applicationPath, function(err, bundle) {
          fpath = dotfiles.getBundlePath(applicationPath, bundle);
          callback(err);
        });
      }

      // If a version was specified, make sure it exists
      else {
        var fullBundlename = misc.getFullBundleName(bundlename, version);
        fpath = dotfiles.getBundlePath(applicationPath, fullBundlename);
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
      var completed = false;
      var remotepath = path.join.apply(null, [
        '/',
        '1.0',
        'bundles',
        bundlename,
        path.basename(fpath)
      ]);
      var opts = {
        method: 'PUT',
        path: remotepath,
        headers: {
          'trailer': 'x-content-sha1',
          'expect': '100-continue'
        }
      };
      var pbarString = sprintf('Uploading %s (%d bytes)', path.basename(fpath), size);
      var pbar = terminal.percentBarSpinner(pbarString, size);

      http.buildRequest(args.remote, opts, function(err, request) {
        if (err) {
          callback(err);
          return;
        }

        function tick(bytes) {
          if (pbar.canBeUsed()) {
            pbar.tick(bytes);
          }
        }

        // In case of an error server-side we can get a response before the
        // pump finishes.  Because we only want to have a single response
        // handler, we go ahead and add the handler here in order to catch
        // things that occur either during or after pumping.
        request.on('response', function(response) {
          if (completed) {
            return;
          }

          process.nextTick(function() {
            request.abort();
          });

          completed = true;

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
              callback(new Error('Invalid response from agent'));
              return;
            }
          });
        });

        request.on('error', function(err) {
          if (!completed) {
            completed = true;
            callback(err);
          }
        });

        function afterPump(err, sha1) {
          if (completed) {
            return;
          }

          if (pbar.canBeUsed()) {
            pbar.end();
          }

          // Only fire the callback if an error occurred, otherwise we wait for
          // a response
          if (err) {
            completed = true;
            callback(err);
          } else {
            sys.puts('Waiting for response...');
            request.addTrailers({'x-content-sha1': sha1.digest('base64')});
            request.end();
          }
        }

        function startPump() {
          if (pbar.canBeUsed()) {
            pbar.start();
          }
          pumpfile.pumpfileout(fpath, request, tick, afterPump);
        }

        request.on('continue', startPump);
      });
    }
  ],

  function(err) {
    callback(err, 'Upload Successful');
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
