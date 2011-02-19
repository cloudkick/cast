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
var path = require('path');
var http = require('util/http');

var sprintf = require('extern/sprintf').sprintf;

var config = {
  'short_description': 'Print log file for a specified service',
  'long_description': 'Print a log file for a specified service. ' +
                      'If a --follow switch is provided, new data is ' +
                      'printed as soon as it is available.',
  'required_arguments' : [['name', 'Service name']],
  'optional_arguments': [['bytes', 'How many bytes from the end of the log file to print']],
  'options': [
    {
      names: ['--follow', '-F'],
      dest: 'follow',
      action: 'store_true',
      desc: 'Output new data as some as it is available (aka tail -F)'
    }
  ],
  'uses_global_options': ['remote']
};

function handle_command(args) {
  var service_name, remote_path, bytes;

  service_name = args.name;

  if (args.bytes) {
    bytes = args.bytes;
  }
  else {
    // Return 500 bytes from the end of the log file by default
    bytes = 500;
  }

  if (args.follow) {
    remote_path = path.join('/services/', service_name, '/tail/', bytes, '/follow/');
  }
  else {
    remote_path = path.join('/services/', service_name, '/tail/', bytes, '/');
  }

  service_name = args.name;

  http.client(args.remote, function(err, client) {
    if (err) {
      sys.puts(sprintf('Error: %s', err.message));
      return;
    }

    client.on('error', function(err) {
      sys.puts(sprintf('Error: %s', err.message));
    });

    var request = client.request('GET', remote_path, {
      'host': 'localhost'
    });

    function on_data(chunk) {
      sys.print(chunk);
    }

    request.on('response', function(response) {
      if (response.statusCode !== 200) {
        var body = '';
        response.on('data', function(chunk) {
          body += chunk;
        });
        response.on('end', function() {
          try {
            var error = JSON.parse(body);
            sys.puts(sprintf('Error: %s', error.message));
          }
          catch (e) {
            sys.puts('Error: invalid response');
          }
        });
      }
      else {
        response.setEncoding('ascii');
        response.on('data', on_data);
      }
    });

    // Send the request
    request.end();
  });
}

exports.config = config;
exports.handle_command = handle_command;
