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
  shortDescription: 'Print a list of jobs',
  longDescription: 'Print a list of jobs.',
  requiredArguments: [],
  optionalArguments: [],
  usesGlobalOptions: ['debug', 'remote']
};


function handleCommand(args, parser, callback) {
  var reqOpts = {
    remote: args.remote,
    apiVersion: '1.0',
    parseJson: true,
    expectedStatusCodes: [200]
  };

  function onResponse(err, response) {
    if (err) {
      callback(err);
      return;
    }

    terminal.printTable([
      {
        title: 'Job ID',
        valueProperty: 'id',
        paddingRight: 40
      },
      {
        title: 'Status',
        valueProperty: 'status',
        paddingRight: 15
      },
      {
        title: 'Queued At',
        valueProperty: 'queued_at',
        paddingRight: 30
      }
    ], response.body, 'No jobs available');

    callback();
  }

  http.getApiResponse('/jobs/', 'GET', reqOpts, onResponse);
}

exports.config = config;
exports.handleCommand = handleCommand;
