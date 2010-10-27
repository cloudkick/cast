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

var sprintf = require('extern/sprintf').sprintf;

var dotfiles = require('util/client_dotfiles');
var terminal = require('util/terminal');

exports.config = {
  short_description: 'Print a list of saved remotes',
  long_description: 'Print a list of saved remotes.',
  required_arguments: [],
  optional_arguments: []
};

exports.handle_command = function(args) {
  dotfiles.get_remotes(function(err, remotes) {
    var remote;

    if (err) {
      sys.puts('Failed to read remotes file');
      return;
    }

    if (Object.keys(remotes).length === 0) {
      sys.puts('No remotes exist yet. You can add one by calling "remotes add" command');
      return;
    }

    sys.puts('Available remotes:\n');
    for (var remote_name in remotes) {
      if (remotes.hasOwnProperty(remote_name)) {
        remote = remotes[remote_name];

        is_default = (remote.is_default === true) ? '(default)' : '';
        sys.puts(sprintf('Name: %s %s', remote_name, is_default));
        sys.puts(sprintf('URL: %s', remote.url));
        sys.puts(sprintf('Certificate fingerprint: %s\n', remote.fingerprint ? remote.fingerprint : '[none]'));
      }
    }
  });
};
