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

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var http = require('util/http');
var misc = require('util/misc');

var enable_commands = require('cast-client/commands/instances/enable');

var config = {
  'short_description': 'Create a new application instance',
  'long_description': 'Create a new application instance.',
  'required_arguments' : [['appname', 'Application name'], ['version', 'Application version number']],
  'optional_arguments': [],
  'switches': [['enable', 'Enable and start the instance after it has been created']]
};

function handle_command(args) {
  var instance_number;

  var bundle_name = misc.get_valid_bundle_name(args.appname);
  var bundle_name_full = misc.get_full_bundle_name(bundle_name, args.version);

  http.get_response(undefined, sprintf('/instances/%s/', bundle_name_full), 'POST', true,
                    function(error, response) {
    if (error) {
      return sys.puts(sprintf('Error: %s', error.message));
    }

    if (response.status_code !== 200) {
      return sys.puts(sprintf('HTTP Error, status code: %d, returned body: %s', response.status_code,
                                                                                response.body.message));
    }

    instance_number = response.body.instance_number;

    sys.puts(sprintf('New instance for application %s has been successfully created.', args.appname));
    sys.puts(sprintf('Instance number: %s', instance_number));

    if (args.enable) {
      enable_commands.handle_command({appname: args.appname, version: args.version,
                                       number: instance_number});
    }
  });
}

exports.config = config;
exports.handle_command = handle_command;
