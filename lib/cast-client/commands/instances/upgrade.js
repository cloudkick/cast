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
var querystring = require('querystring');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var http = require('util/http');
var misc = require('util/misc');
var dotfiles = require('util/client_dotfiles');

var Errorf = misc.Errorf;

var config = {
  shortDescription: 'Upgrade an existing instance',
  longDescription: 'Upgrade an existing instance to a new version.',

  requiredArguments: [
    ['name', 'Instance name'],
    ['version', 'Bundle version']
  ],

  optionalArguments: [],

  usesGlobalOptions: ['remote']
};

function handleCommand(args) {
  async.series([
    function(callback) {
      var remotePath = sprintf('/instances/%s/upgrade/', args.name);

      var body = querystring.stringify({
        bundle_version: args.version
      });

      http.getApiResponse(args.remote, '1.0', remotePath, 'POST', body,
                          true, function(err, response) {
        if (err) {
          callback(err);
          return;
        }

        if (response.statusCode !== 200) {
          err = new Errorf(response.body.message);
        }

        callback(err);
      });
    }
  ],

  function(err) {
    if (err) {
        sys.puts(sprintf('Error: %s', err.message));
      }
      else {
        sys.puts(sprintf('Instance "%s" has been upgraded to version %s', args.name, args.version));
      }
   });
}

exports.config = config;
exports.handleCommand = handleCommand;
