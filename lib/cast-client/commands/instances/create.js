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
var querystring = require('querystring');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var http = require('util/http');
var misc = require('util/misc');
var dotfiles = require('util/client_dotfiles');
var manifest = require('manifest');
var MANIFEST_FILENAME = require('manifest/constants').MANIFEST_FILENAME;
var clientUtils = require('util/client');

var Errorf = misc.Errorf;

var config = {
  shortDescription: 'Create a new application instance',
  longDescription: 'Create a new application instance using a bundle specified in the format [[name@]version]. ' +
                      'If no bundle name is specified, the name will be inferred from the cast manifest in the ' +
                      'current working directory. If no version is specified the version will be inferred based on ' +
                      'the most recently created bundle for the cast project in the current working directory.',
  requiredArguments: [
    ['name', 'Instance name']
  ],
  optionalArguments: [
    ['bundle', 'Bundle specifier in the format [[name@]version]']
  ],
  options: [
    {
      names: ['--enable'],
      dest: 'enable',
      action: 'store_true',
      desc: 'Enable and start the instance service after it has been created'
    }
  ],
  usesGlobalOptions: ['debug', 'remote']
};

function splitBundleSpecifier(specifier) {
  if (specifier.indexOf('@') !== -1) {
    return specifier.split('@', 2);
  }
  else {
    return [undefined, specifier];
  }
}

function handleCommand(args, parser, callback) {
  var chunks, bundleName, bundleVersion;
  var cwd = process.cwd();
  var manifestPath = path.join(cwd, MANIFEST_FILENAME);

  if (args.bundle) {
    chunks = splitBundleSpecifier(args.bundle);
    bundleName = chunks[0];
    bundleVersion = chunks[1];
  }

  async.series([
    // Fill in missing bundle name/version
    function(callback) {
      if (bundleName && !bundleVersion) {
        callback(new Error('Bundle specifiers that contain a name must also include a version'));
        return;
      }
      else if (!bundleVersion) {
        dotfiles.getNewestBundle(cwd, function(err, bundle) {
          if (!err) {
            chunks = splitBundleSpecifier(bundle);
            bundleName = chunks[0];
            bundleVersion = chunks[1];
            sys.puts('Using bundle \'' + bundleName + '@' + bundleVersion + '\'');
          }
          callback(err);
          return;
        });
      }
      else if (!bundleName) {
        manifest.validateManifest(manifestPath, function(err, appManifest) {
          if (!err) {
            bundleName = misc.getValidBundleName(appManifest.name);
            sys.puts('Using bundle \'' + bundleName + '@' + bundleVersion + '\'');
          }
          callback(err);
          return;
        });
      }
      else {
        callback();
        return;
      }
    },

    // Do the request
    function(callback) {
      var remotePath = sprintf('/instances/%s/', args.name);

      var body = querystring.stringify({
        bundle_name: bundleName,
        bundle_version: bundleVersion,
        enable_service: args.enable
      });

      http.executeRemoteJob(args.remote, remotePath, 'PUT', body, callback);
    }
  ],

  function(err) {
    var successMessage = sprintf('Instance "%s" created', args.name);
    callback(err, successMessage);
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
