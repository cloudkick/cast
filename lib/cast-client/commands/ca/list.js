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
  shortDescription: 'Print a list of pending Certificate Signing Requests',
  longDescription: 'Print a list of Certificate Signing Requests that are ' +
      'currently pending (or specify --all to list all requests) on the ' +
      'specified remote.',
  requiredArguments: [],
  optionalArguments: [],
  options: [
    {
      names: ['--all', '-a'],
      dest: 'listAll',
      action: 'store_true',
      desc: 'List CSRs, even if they are already signed.'
    }
  ],
  usesGlobalOptions: ['debug', 'remote']
};

function handleCommand(args, parser, callback) {
  async.series([
    function(callback) {
      http.getApiResponse('/ca/', 'GET', { 'remote': args.remote,
                                           'apiVersion': '1.0',
                                           'parseJson': true,
                                           'expectedStatusCodes': [200]},
                          function(err, response) {
      if (err) {
        callback(err);
        return;
      }

      var requests = response.body;
      var headingDesc;

      requests = requests.map(function(request) {
        request.signed = request.cert ? true : false;
        return request;
      });

      if (!args.listAll) {
        requests = requests.filter(function(request) {
          return !request.signed;
        });
        headingDesc = 'unsigned';
      } else {
        headingDesc = 'all';
      }

      sys.puts(sprintf('Certificate Signing Requests (%s): \n', headingDesc));
      terminal.printTable([
        {
          title: 'Hostname',
          valueProperty: 'name',
          paddingRight: 50
        },
        {
          title: 'Signed',
          valueProperty: 'signed',
          paddingRight: 10
        }
      ], requests, 'No CSRs');
      });
    }
  ], callback);
}

exports.config = config;
exports.handleCommand = handleCommand;
