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
var misc = require('util/misc');
var clientUtils = require('util/client');

var config = {
  shortDescription: 'List all the bundles which are currently deployed.',
  longDescription: 'List all the bundles which are currently deployed.',
  requiredArguments: [],
  optionalArguments: [],
  usesGlobalOptions: ['remote']
};

function handleCommand(args) {
  async.series([
    function(callback) {
      http.getApiResponse('/bundles/', 'GET', { 'remote': args.remote,
                                                'apiVersion': '1.0',
                                                'parseJson': true },
                          function(err, response) {
        if (err) {
          callback(err);
          return;
        }

        if (response.statusCode !== 200) {
          callback(new misc.Errorf('HTTP Error, status code: %d, returned body: %s', 
                                   response.statusCode,
                                   response.body.message));
          return;
        }

        var bundles = response.body;
        terminal.printTable([
          {
            title: 'Name',
            valueProperty: 'name',
            paddingRight: 30
          },
          {
            title: 'Version',
            valueProperty: 'version',
            paddingRight: 20
          },
          {
            title: 'Identifier',
            valueProperty: 'identifier'
          }
        ], bundles, 'No bundles available');
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
