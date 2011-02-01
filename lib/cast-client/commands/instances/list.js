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

var http = require('util/http');
var terminal = require('util/terminal');

var config = {
  'short_description': 'Print a list of instances',
  'long_description': 'Print a list of instances that exist on the remote.',
  'required_arguments' : [],
  'optional_arguments': [],
  'uses_global_options': ['remote']
};

var format_status = function(value) {
  if (!value) {
    return 'service is disabled';
  }

  return sprintf('pid: %s, state: %s', value.pid, value.state);
};

function handle_command(args) {
  http.get_response(args.remote, '/instances/', 'GET', true, function(err, response) {
    if (err) {
      sys.puts('Error: ' + err.message);
      return;
    }

    if (response.status_code !== 200) {
      if (response.body.message) {
        sys.puts('Error: ' + response.body.message);
      }
      else {
        sys.puts('Error: invalid response');
      }
      return;
    }

    var instances = response.body;

    sys.puts('Instances: \n');
    terminal.print_table([{'title': 'Name', 'value_property': 'name', 'padding_right': 30},
                          {'title': 'Bundle', 'value_property': 'bundle_name', 'padding_right': 40},
                          {'title': 'Version', 'value_property': 'bundle_version'}],
                          instances, 'No instances exist');
  });
}

exports.config = config;
exports.handle_command = handle_command;
