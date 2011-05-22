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
var async = require('async');
var terminal = require('terminal');

var http = require('util/http');
var clientUtils = require('util/client');

var config = {
  shortDescription: 'Sign the specified Certificate Signing Request.',
  longDescription: 'Sign the Certificate Signing Request for the specified ' +
      'hostname. Use this with care, signing this request will allow ' +
      'the requester to control cast as soon as they retrieve the resulting ' +
      'certificate.',
  requiredArguments: [
    ['hostname', 'Hostname identifying the CSR to sign']
  ],
  optionalArguments: [],
  options: [],
  usesGlobalOptions: ['remote']
};

function handleCommand(args) {
  async.series([
    function(callback) {
      var remotePath = sprintf('/ca/%s/sign/', args.hostname);
      http.getApiResponse(args.remote, '1.0', remotePath, 'POST', null, true,
                          [200], function(err, response) {
        if (err) {
          callback(err);
          return;
        }

        var req = response.body;
        sys.puts(sprintf('CSR for \'%s\': %s', req.hostname, req.status));
      });
    }
  ],

  function(err) {
    if (err) {
      clientUtils.printErrorAndExit(err, 1);
      return;
    }
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
