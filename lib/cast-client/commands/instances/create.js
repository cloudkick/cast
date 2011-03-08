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

var http = require('util/http');
var misc = require('util/misc');
var dotfiles = require('util/client_dotfiles');
var manifest = require('manifest');
var MANIFEST_FILENAME = require('manifest/constants').MANIFEST_FILENAME;

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');


var config = {
  'short_description': 'Create a new application instance',
  'long_description': 'Create a new application instance using a bundle specified in the format [[name@]version]. '   +
                      'If no bundle name is specified, the name will be inferred from the cast manifest in the '      +
                      'current working directory. If no version is specified the version will be inferred based on '  +
                      'the most recently created bundle for the cast project in the current working directory.',
  'required_arguments' : [
    ['name', 'Instance name']
  ],
  'optional_arguments': [
    ['bundle', 'Bundle specifier in the format [[name@]version]']
  ],
  'uses_global_options': ['remote']
};

function split_bundle_specifier(specifier) {
  if (specifier.indexOf('@') !== -1) {
    return specifier.split('@', 2);
  }
  else {
    return [undefined, specifier];
  }
}

function handle_command(args) {
  var chunks, bundle_name, bundle_version;
  var cwd = process.cwd();
  var manifest_path = path.join(cwd, MANIFEST_FILENAME);

  if (args.bundle) {
    chunks = split_bundle_specifier(args.bundle);
    bundle_name = chunks[0];
    bundle_version = chunks[1];
  }

  async.series([
    // Fill in missing bundle name/version
    function(callback) {
      if (bundle_name && !bundle_version) {
        callback(new Error('Bundle specifiers that contain a name must also include a version'));
        return;
      }
      else if (!bundle_version) {
        dotfiles.get_newest_bundle(cwd, function(err, bundle) {
          if (!err) {
            chunks = split_bundle_specifier(bundle);
            bundle_name = chunks[0];
            bundle_version = chunks[1];
            sys.puts('Using bundle \'' + bundle_name + '@' + bundle_version + '\'');
          }
          callback(err);
          return;
        });
      }
      else if (!bundle_name) {
        manifest.validate_manifest(manifest_path, function(err, app_manifest) {
          if (!err) {
            bundle_name = misc.get_valid_bundle_name(app_manifest.name);
            sys.puts('Using bundle \'' + bundle_name + '@' + bundle_version + '\'');
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
      var remote_path = sprintf('/instances/%s/', args.name);

      var body = querystring.stringify({
        bundle_name: bundle_name,
        bundle_version: bundle_version
      });

      var opts = {
        path: remote_path,
        method: 'PUT',
        headers: { 'content-length': body.length }
      };

      http.build_request(args.remote, opts, function(err, request) {
        request.end(body);

        request.on('error', callback);

        request.on('response', function(response) {
          var data = [];
          response.on('data', function(chunk) {
            data.push(chunk);
          });

          response.on('end', function() {
            try {
              var response_obj = JSON.parse(data.join(''));
              var msg, err;
              if (response.statusCode !== 200) {
                msg = response_obj.message || 'malformed response body';
                err = new Error(msg);
              }
              callback(err);
              return;
            }
            catch (e) {
              callback(new Error('invalid response'));
              return;
            }
          });
        });
      });
    }
  ],
  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else {
      sys.puts('Instance \'' + args.name + '\' created');
    }
  });
}

exports.config = config;
exports.handle_command = handle_command;
