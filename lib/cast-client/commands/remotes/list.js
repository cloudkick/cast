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

var sprintf = require('sprintf').sprintf;
var async = require('async');
var terminal = require('terminal');

var dotfiles = require('util/client_dotfiles');
var clientUtils = require('util/client');

var PROJECT_HEADER = 'Project Remotes (override globals):';
var GLOBAL_HEADER = 'Global Remotes:';

var config = {
  shortDescription: 'Print a list of saved remotes',
  longDescription: 'Print a list of saved remotes.',
  requiredArguments: [],
  optionalArguments: []
};

function printRemoteList(head, remotes) {
  var name, remote, defaultStr, i;
  var names = Object.keys(remotes);
  names = names.sort();

  sys.puts(head);
  for (i = 0; i < names.length; i++) {
    name = names[i];
    if (remotes.hasOwnProperty(name)) {
      remote = remotes[name];
      if (remote.is_default) {
        defaultStr = '';
      }
      else {
        defaultStr = ' ';
      }

      sys.puts(sprintf('  %s%s', name, (remote.is_default ? ' (default)' : '')));
      sys.puts(sprintf('    %s', remote.url));
      if (remote.fingerprint) {
        sys.puts(sprintf('    %s', remote.fingerprint));
      }
    }
  }
}

function handleCommand(args, parser, callback) {
  var hadRemotes = false;

  async.series([
    function(callback) {
      dotfiles.getLocalRemotes(function(err, remotes) {
        if (!err && Object.keys(remotes).length > 0) {
          hadRemotes = true;
          printRemoteList(PROJECT_HEADER, remotes);
        }
        callback(err);
      });
    },

    function(callback) {
      dotfiles.getGlobalRemotes(function(err, remotes) {
        if (!err && Object.keys(remotes).length > 0) {
          if (hadRemotes) {
            sys.puts('');
          }
          hadRemotes = true;
          printRemoteList(GLOBAL_HEADER, remotes);
        }
        callback(err);
      });
    }
  ],

  function(err) {
    var successMessage = null;

    if (!hadRemotes) {
      successMessage = 'No remotes exist yet. You can add one by calling "remotes add" command';
      callback(err, successMessage);
    }
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
