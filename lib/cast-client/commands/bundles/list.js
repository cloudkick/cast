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

var terminal = require('util/terminal');
var http = require('util/http');

var config = {
  'short_description': 'List all the bundles which are currently deployed.',
  'long_description': 'List all the bundles which are currently deployed.',
  'required_arguments' : [],
  'optional_arguments': [],
  'uses_global_options': ['remote']
};

var handle_command = function(args) {
  http.get_api_response(args.remote, '1.0', '/bundles/', 'GET', true,
                    function(error, response) {
    if (error) {
      return sys.puts(sprintf('Error: %s', error.message));
    }

    if (response.status_code !== 200) {
      return sys.puts(sprintf('HTTP Error, status code: %d, returned body: %s', response.status_code,
                                                                                response.body.message));
    }

    var bundles = response.body;
    terminal.print_table([{'title': 'Name', 'value_property': 'name', 'padding_right': 30},
                          {'title': 'Version', 'value_property': 'version', 'padding_right': 20}],
                          bundles,
                          'No bundles available');
  });
};

exports.config = config;
exports.handle_command = handle_command;
