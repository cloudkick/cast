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

var dotfiles = require('util/client_dotfiles');
var http = require('util/http');

exports.config = {
  short_description: 'Add a remote',
  long_description: 'Add a reference to a remote cast-agent',
  required_arguments: [
    ['name', 'A name for the remote'],
    ['url', 'The URL to the remote']
  ],
  optional_arguments: [],
  switches: []
};

exports.handle_command = function(args) {
  async.waterfall([
    // Make sure ~/.cast exists
    function(callback) {
      dotfiles.ensure_dot_cast(callback);
    },

    // Get or create the current remotes object
    function(callback) {
      dotfiles.get_remotes(callback);
    },

    function(remotes, callback) {
      // Fetch the server SSL certificate information
      http.get_server_ssl_cert_info(args.url, function (err, cert_info) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, remotes, cert_info);
      });
    },

    // Insert the new remote
    function(remotes, cert_info, callback) {
      var url_object, hostname, port, fingerprint;

      // @TODO: Show user certificate information and ask before accepting
      if (remotes[args.name]) {
        callback(new Error("Remote with name '" + args.name + "' already exists"));
        return;
      }

      url_object = url.parse(args.url);

      hostname = url_object.hostname;
      port = url_object.port || 443;
      fingerprint = cert_info.fingerprint;

      remotes[args.name] = {url: args.url, hostname: hostname, port: port,
                            fingerprint: fingerprint};
      return callback(null, remotes);
    },

    // Save the remotes
    function(remotes, callback) {
      var fstream = fs.createWriteStream(dotfiles.dot_cast_remotes_path);

      fstream.write(JSON.stringify(remotes, null, 4));

      fstream.on('end', function() {
        return callback();
      });

      fstream.on('error', function(err) {
        fstream.removeAllListeners('end');
        return callback(new Error('Error writing remotes file: ' + err));
      });
    }
  ],
  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else {
      sys.puts('Remote added');
    }
  });
};
