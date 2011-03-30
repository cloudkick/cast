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

var sprintf = require('sprintf').sprintf;

var http = require('util/http');
var terminal = require('util/terminal');

var config = {
  shortDescription: 'Print a list of instances',
  longDescription: 'Print a list of instances that exist on the remote.',
  requiredArguments: [],
  optionalArguments: [],
  usesGlobalOptions: ['remote']
};

var formatStatus = function(value) {
  if (!value) {
    return 'service is disabled';
  }

  return sprintf('pid: %s, state: %s', value.pid, value.state);
};

function handleCommand(args) {
  http.getApiResponse(args.remote, '1.0', '/instances/', 'GET', true, function(err, response) {
    if (err) {
      sys.puts('Error: ' + err.message);
      return;
    }

    if (response.statusCode !== 200) {
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
    terminal.printTable([
      {
        title: 'Name',
        valueProperty: 'name',
        paddingRight: 30
      },
      {
        title: 'Bundle',
        valueProperty: 'bundle_name',
        paddingRight: 40
      },
      {
        title: 'Version',
        valueProperty: 'bundle_version'
      }
    ], instances, 'No instances exist');
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
