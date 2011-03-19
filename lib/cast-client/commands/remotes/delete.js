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

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var Errorf = require('util/misc').Errorf;
var dotfiles = require('util/client_dotfiles');
var terminal = require('util/terminal');

exports.config = {
  shortDescription: 'Delete an existing remote',
  longDescription: 'Delete an existing remote.',
  requiredArguments: [
    ['name', 'A name for the remote']
  ],
  optionalArguments: [],
  options: [
    {
      names: ['--project', '-p'],
      dest: 'project',
      action: 'store_true',
      desc: 'Add the remote only to the current project. This will override ' +
            'any global remote with the same name, and a default project ' +
            'remote, if one exists, will take precedent over the global one.'
    }
  ]
};

exports.handleCommand = function(args) {
  async.waterfall([
    function(callback) {
      if (args.project) {
        dotfiles.getLocalRemotes(callback);
      }
      else {
        dotfiles.getGlobalRemotes(callback);
      }
    },

    function(remotes, callback) {
      var err = null;
      if (!remotes.hasOwnProperty(args.name)) {
          err = new Errorf('Remote with name "%s" does not exist', args.name);
      }

      callback(err, remotes);
    },

    function(remotes, callback) {
      var err = null;
      var defaultString = (remotes[args.name].is_default) ? ' default ' : ' ';
      var typeString = (args.project) ? 'project ' : 'global ';

      var answer = terminal.prompt(sprintf('Are you sure you want to delete%s%sremote "%s"?',
                                           defaultString, typeString, args.name),
                                   ['y', 'n'], 'n', function(data) {
         if (data !== 'y') {
           err = new Error('Deletition aborted.');
         }

         callback(err, remotes);
      });
    },

    function(remotes, callback) {
      delete remotes[args.name];

      if (args.project) {
        dotfiles.saveLocalRemotes(remotes, callback);
      }
      else {
        dotfiles.saveGlobalRemotes(remotes, callback);
      }
    }
  ],

  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
      return;
    }

    sys.puts(sprintf('Remote %s deleted.', args.name));
  });
};
