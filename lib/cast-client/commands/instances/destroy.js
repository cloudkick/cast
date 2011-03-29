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

var http = require('util/http');
var misc = require('util/misc');
var term = require('util/terminal');

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var config = {
  shortDescription: 'Destroy an instance',
  longDescription: 'Destroy an instance and all of its data and services.',
  requiredArguments: [
    ['name', 'The name of the instance to be destroyed']
  ],
  optionalArguments: [],
  usesGlobalOptions: ['remote']
};

function DestroyDeclinedError() {
  this.message = 'User declined to destroy instance';
}

sys.inherits(DestroyDeclinedError, Error);

var handleCommand = function(args) {
  var instanceName = args.name;

  async.series([
    function(callback) {

      var promptStr = 'Are you sure you want to destroy \'' + instanceName + '\'?';
      term.prompt(promptStr, ['y', 'n'], 'n', function(resp) {
        if (resp !== 'y') {
          callback(new DestroyDeclinedError());
          return;
        }
        else {
          callback();
          return;
        }
      });
    },

    function(callback) {
      var remotePath = sprintf('/instances/%s/', instanceName);
      http.getApiResponse(args.remote, '1.0', remotePath, 'DELETE', true, function(err, response) {
        if (err) {
          callback(err);
        }
        else if (response.statusCode !== 200) {
          if (response.body.message) {
            callback(new Error(response.body.message));
          }
          else {
            callback(new Error('invalid response'));
          }
        }
        else {
          callback();
        }
      });
    }
  ],
  function(err) {
    if (err) {
      if (err instanceof DestroyDeclinedError) {
        sys.puts('Ok, destroy operation canceled');
      }
      else {
        sys.puts('Error: ' + err.message);
      }
    }
    else {
      sys.puts('Instance \'' + instanceName + '\' destroyed.');
    }
  });
};

exports.config = config;
exports.handleCommand = handleCommand;
