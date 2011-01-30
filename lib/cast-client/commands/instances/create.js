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

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var http = require('util/http');
var misc = require('util/misc');

var enable_commands = require('cast-client/commands/instances/enable');

var config = {
  'short_description': 'Create a new application instance',
  'long_description': 'Create a new application instance.',
  'required_arguments' : [
    ['name', 'Instance name'],
    ['bundle', 'Bundle name'],
    ['version', 'Bundle version number']
  ],
  'optional_arguments': [],
  'uses_global_options': ['remote']
};

function handle_command(args) {
  var remote_path = sprintf('/instances/%s/', args.name);

  http.client(args.remote, function(err, client) {
    client.on('error', function() {
      sys.puts('A connection error occurred');
      process.exit();
    });

    var body = querystring.stringify({
      bundle_name: args.bundle,
      bundle_version: args.version
    });

    var headers = client.headers;
    headers['content-length'] = body.length;

    var request = client.request('PUT', remote_path, headers);
    request.end(body);
    request.on('response', function(response) {
      var data = [];
      response.on('data', function(chunk) {
        data.push(chunk);
      });

      response.on('end', function() {
        try {
          var response_obj = JSON.parse(data.join(''));
          if (response.statusCode !== 200) {
            sys.puts('Error: ' + response_obj.message);
          }
          else {
            sys.puts('Instance \'' + args.name + '\' created');
          }
        }
        catch (e) {
          sys.puts('Error: invalid response');
        }
      });
    });
  });
}

exports.config = config;
exports.handle_command = handle_command;
