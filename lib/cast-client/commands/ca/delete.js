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
var terminal = require('terminal');

var http = require('util/http');

var config = {
  shortDescription: 'Delete a pending Certificate Signing Request.',
  longDescription: 'Delete a pending Certificate Signing Request. This will ' +
      'remove the request from the remote filesystem and prevent it from ' +
      'being signed or included in listings of requests.',
  requiredArguments: [
    ['hostname', 'Hostname identifying the CSR to delete']
  ],
  optionalArguments: [],
  options: [],
  usesGlobalOptions: ['remote']
};

function handleCommand(args) {
  var remotePath = sprintf('/ca/%s/', args.hostname);
  http.getApiResponse(args.remote, '1.0', remotePath, 'DELETE', null, true,
                      function(err, response) {
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

    var req = response.body;

    sys.puts(sprintf('CSR for \'%s\': %s', req.hostname, req.status));
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
