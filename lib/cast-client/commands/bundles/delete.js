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

var tarball = require('util/tarball');
var misc = require('util/misc');
var locking = require('util/locking');
var dotfiles = require('util/client_dotfiles');
var http = require('util/http');
var term = require('util/terminal');

var Errorf = misc.Errorf;

/**
 * A list of valid bundle types which can be deleted.
 * @const
 * @type {Array}
 */
var VALID_TYPES = ['tarball', 'extracted', 'both'];

var config = {
  shortDescription: 'Delete an existing bundle',
  longDescription: 'Delete an existing bundle from the remotes server,',
  requiredArguments: [['identifier', 'Bundle identifier']],
  optionalArguments: [],
  options: [
    {
        names: ['--type', '-t'],
        dest: 'type',
        action: 'store',
        desc: sprintf('A type of bundle to delete. Valid options are: %s.', VALID_TYPES.join(', '))
    }
  ]
};

function getBundleIdentifier(instance) {
  var bundleIdentifier;

  bundleIdentifier = misc.getFullBundleName(instance.bundle_name,
                                            instance.bundle_version);
  return bundleIdentifier;
}

/**
 * Handler for creating a bundle.
 * @param {Object} args Command line arguments.
 * @param {String} args.version Application version number to create.
 */
function handleCommand(args) {
  var bundleType = args.type || 'both';
  var identifier = args.identifier;

  async.waterfall([

    // Verify the command arguments
    function(callback) {
      var applicationName;
      var err = null;
      var split = identifier.split('@');

      if (split.length !== 2) {
        err = new Errorf('Invalid application name: %s', identifier);
      }
      else if (!misc.inArray(bundleType, VALID_TYPES)) {
        err = new Errorf('Invalid bundle type: %s', bundleType);
      }

      applicationName = split[0];
      callback(err, applicationName);
    },

    // Retrieve the list of all the active instances
    function(applicationName, callback) {
      var instances, bundleIdentifierList;
      http.getApiResponse(args.remote, '1.0', '/instances/', 'GET', null,
                          true, function(err, response) {
        if (err) {
          callback(err);
          return;
        }

        instances = response.body;
        bundleIdentifierList = instances.map(getBundleIdentifier);
        callback(null, applicationName, bundleIdentifierList);
        return;
      });
    },

    // Check if bundles which is being deleted is currently being used by an
    // instance
    function(applicationName, bundleIdentifierList, callback) {
      var promptStr;
      if (!misc.inArray(identifier, bundleIdentifierList)) {
        callback(null, applicationName);
        return;
      }

      promptStr = sprintf('Bundle "%s" is currently used by an istance. ' +
                          'Deleting it will cause instance to not function ' +
                          'properly. Are you sure you want to delete it?',
                          identifier);

      term.prompt(promptStr, ['y', 'n'], 'n', function(resp) {
        if (resp !== 'y') {
          callback(new Error('Bundle deletion has been aborted by the user.'));
          return;
        }

        callback(null, applicationName);
      });
    },

    // Perform the request
    function(applicationName, callback) {
      var remotePath, body, opts;
      var err, msg;

      remotePath = path.join('/1.0', 'bundles', applicationName, identifier);

      body = querystring.stringify({
        bundle_type: bundleType
      });

      opts = {
        path: remotePath,
        method: 'DELETE',
        headers: { 'content-length': body.length }
      };

      http.buildRequest(args.remote, opts, function(err, request) {
        request.end(body);

        request.on('error', callback);

        request.on('response', function(response) {
          var data = [];
          response.on('data', function(chunk) {
            data.push(chunk);
          });

          response.on('end', function() {
            if (response.statusCode === 404) {
              err = new Errorf('Bundle "%s" does not exist', identifier);
            }
            else if (response.statusCode !== 204) {
              err = new Error(data.join(''));
            }

            callback(err);
            return;
          });
        });
      });
    }
  ],

  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
      return;
    }

    sys.puts(sprintf('Bundle "%s" has been deleted.', identifier));
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
