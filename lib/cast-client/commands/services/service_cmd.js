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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var http = require('util/http');
var clientUtils = require('util/client');

function buildCommand(mod, action, actionPtense) {
  var actionCapped = action.charAt(0).toUpperCase() + action.slice(1);

  mod.exports.config = {
    shortDescription: sprintf('%s a service', actionCapped),
    longDescription: sprintf('%s a service on the specified remote', actionCapped),
    requiredArguments: [
      ['name', sprintf('The name of the service to %s', action)]
    ],
    optionalArguments: [],
    usesGlobalOptions: ['debug', 'remote']
  };

  mod.exports.handleCommand = function(args, parser, callback) {
    var actionPath = path.join('/', 'services', args.name, action, '/');
    http.executeRemoteJob(args.remote, actionPath, 'PUT', function(err) {
      var successMessage = sprintf('Service "%s" %s.', args.name, actionPtense);
      callback(err, successMessage);
    });
  };
}

exports.buildCommand = buildCommand;
