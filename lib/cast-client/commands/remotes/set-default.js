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

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;
var Errorf = require('util/misc').Errorf;

var dotfiles = require('util/client_dotfiles');

exports.config = {
  short_description: 'Set a default remote',
  long_description: 'Set a default remote which will be used with all the commands',
  required_arguments: [
    ['name', 'Remote name']
  ],
  optional_arguments: []
};

exports.handle_command = function(args) {
  async.waterfall([
    // Get or create the current remotes object
    function(callback) {
      dotfiles.get_remotes(callback);
    },

    function(remotes, callback) {
      var remote;

      if (Object.keys(remotes).length === 0) {
        callback(new Error('No remotes exist yet. You can add one by calling "remotes add" command'));
        return;
      }

      // Check if remote with this exists
      if (!remotes.hasOwnProperty(args.name)) {
        callback(new Errorf('Remote with name "%s" does not exist', args.name));
        return;
      }

      for (var remote_name in remotes) {
        if (remotes.hasOwnProperty(remote_name)) {
          remote = remotes[remote_name];

          if (remote_name === args.name) {
            remote.is_default = true;
          }
          else {
            remote.is_default = false;
          }
        }
      }

      callback(null, remotes);
    },

    // Save the remotes
    function(remotes, callback) {
      var fstream = fs.createWriteStream(dotfiles.dot_cast_remotes_path);

      fstream.write(JSON.stringify(remotes, null, 4));
      fstream.end();

      fstream.on('close', function() {
        return callback();
      });

      fstream.on('error', function(err) {
        fstream.removeAllListeners('end');
        return callback(new Errorf('Error writing remotes file: %s', err));
      });
    }
  ],

  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else {
      sys.puts(sprintf('Remote %s set as default', args.name));
    }
  });
};
