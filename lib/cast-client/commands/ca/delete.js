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
  shortDescription: 'Delete a pending Certificate Signing Request.',
  longDescription: 'Delete a pending Certificate Signing Request. This will ' +
      'remove the request from the remote filesystem and prevent it from ' +
      'being signed or included in listings of requests.',
  requiredArguments: [
    ['hostname', 'Hostname identifying the CSR to delete']
  ],
  optionalArguments: [],
  options: [],
  usesGlobalOptions: ['debug', 'remote']
};

function handleCommand(args, parser, callback) {
  var remotePath = sprintf('/ca/%s/', args.hostname);
  http.executeRemoteJob(args.remote, remotePath, 'DELETE', function(err, result) {
    if (err) {
      callback(err);
    } else {
      callback(null, 'SigningRequest deleted');
    }
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
