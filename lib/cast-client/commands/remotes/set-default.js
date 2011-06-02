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

var fs = require('fs');
var sys = require('sys');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var Errorf = require('util/misc').Errorf;
var dotfiles = require('util/client_dotfiles');
var clientUtils = require('util/client');

var config = {
  shortDescription: 'Set a default remote',
  longDescription: 'Set a default remote which will be used with all the commands',
  requiredArguments: [
    ['name', 'Remote name']
  ],
  optionalArguments: [],
  usesGlobalOptions: ['debug']
};

function handleCommand(args, parser, callback) {
  var usingGlobals = false;
  var remotes;

  async.series([
    // Check for the specified remote in local remotes
    function(callback) {
      dotfiles.getLocalRemotes(function(err, localRemotes) {
        var name;

        if (err) {
          callback(err);
          return;
        }

        for (name in localRemotes) {
          if (localRemotes.hasOwnProperty(name) && name === args.name) {
            remotes = localRemotes;
            callback();
            return;
          }
        }

        // No local remote found
        callback(null, null);
      });
    },

    // If no local remote was found, search globals
    function(callback) {
      if (remotes) {
        callback();
        return;
      }

      dotfiles.getGlobalRemotes(function(err, globalRemotes) {
        var name;

        if (err) {
          callback(err);
          return;
        }

        for (name in globalRemotes) {
          if (globalRemotes.hasOwnProperty(name) && name === args.name) {
            remotes = globalRemotes;
            usingGlobals = true;
            callback();
            return;
          }
        }

        // No remote found locally or globally
        callback(new Errorf('Remote \'%s\' not found', args.name));
      });
    },

    // Make the specified remote the default and save
    function(callback) {
      var name, remote;

      for (name in remotes) {
        if (remotes.hasOwnProperty(name)) {
          remote = remotes[name];

          if (name === args.name) {
            remote.is_default = true;
          }
          else {
            remote.is_default = false;
          }
        }
      }

      if (usingGlobals) {
        dotfiles.saveGlobalRemotes(remotes, callback);
      }
      else {
        dotfiles.saveLocalRemotes(remotes, callback);
      }
    }
  ],

  function(err) {
    callback(err, sprintf('Remote %s set as default', args.name));
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
