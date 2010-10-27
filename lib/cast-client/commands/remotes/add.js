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
var url = require('url');
var fs = require('fs');

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;
var Errorf = require('util/misc').Errorf;

var dotfiles = require('util/client_dotfiles');
var http = require('util/http');
var terminal = require('util/terminal');

exports.config = {
  short_description: 'Add a remote',
  long_description: 'Add a reference to a remote cast-agent',
  required_arguments: [
    ['name', 'A name for the remote'],
    ['url', 'The URL to the remote']
  ],
  optional_arguments: []
};

exports.handle_command = function(args) {
  var conf = require('util/config').get();

  var calls = [
  // Make sure ~/.cast exists
  function(callback) {
    dotfiles.ensure_dot_cast(callback);
  },

  // Get or create the current remotes object
  function(callback) {
    dotfiles.get_remotes(callback);
  },

  function(remotes, callback) {
    // Check if remote with this name already exists
    if (remotes[args.name]) {
      callback(new Errorf("Remote with name '%s' already exists", args.name));
      return;
    }

    callback(null, remotes);
  }];

  if (conf.ssl_enabled) {
    calls = calls.concat([
      function(remotes, callback) {
        // Fetch the server SSL certificate information
        http.get_server_ssl_cert_info(args.url, function(err, cert_info) {
          if (err) {
            callback(err);
            return;
          }
          callback(null, remotes, cert_info);
        });
      },

      function(remotes, cert_info, callback) {
        var url_object, hostname, port, fingerprint;

        // Show ertificate information to user and ask before accepting
        sys.puts('Certificate information\n');
        sys.puts(sprintf('Subject: %s', cert_info.subject));
        sys.puts(sprintf('Issuer: %s', cert_info.issuer));
        sys.puts(sprintf('Valid to: %s', cert_info.valid_to));
        sys.puts(sprintf('Finegrprint: %s', cert_info.fingerprint));

        terminal.prompt('Are you sure you want to accept this certificate?', ['y', 'n'], 'y', function(data) {
          if (data === 'y') {
           callback(null, remotes, cert_info.fingerprint);
           return;
          }

          callback(new Error('Certificate not accepted, remote not added'));
        });
      }]);
  }
  else {
    calls.push(function(remotes, callback) {
      callback(null, remotes, null);
    });
  }

  calls.push(function(remotes, fingerprint, callback) {
    // Insert the new remote
    var hostname, port, is_default;

    url_object = url.parse(args.url);

    hostname = url_object.hostname;
    port = url_object.port || 443;
    is_default = (Object.keys(remotes).length === 0) ? true : false;

    remotes[args.name] = {url: args.url, hostname: hostname, port: port,
                          fingerprint: fingerprint, is_default: is_default};
    callback(null, remotes);
  });

  calls.push(function(remotes, callback) {
    var fstream = fs.createWriteStream(dotfiles.dot_cast_remotes_path);

    fstream.write(JSON.stringify(remotes, null, 4));
    fstream.end();

    fstream.on('close', function() {
      return callback();
    });

    fstream.on('error', function(err) {
      fstream.removeAllListeners('end');
      return callback(new Error('Error writing remotes file: ' + err));
    });
  });




  async.waterfall(calls,
  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else {
      sys.puts('Remote added');
    }
  });
};
