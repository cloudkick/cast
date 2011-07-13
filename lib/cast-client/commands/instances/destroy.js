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

var sprintf = require('sprintf').sprintf;
var async = require('async');
var term = require('terminal');

var http = require('util/http');
var misc = require('util/misc');
var clientUtils = require('util/client');

var config = {
  shortDescription: 'Destroy an instance',
  longDescription: 'Destroy an instance and all of its data and services.',
  requiredArguments: [
    ['name', 'The name of the instance to be destroyed']
  ],
  optionalArguments: [],
  usesGlobalOptions: ['debug', 'remote']
};

function DestroyDeclinedError() {
  this.message = 'User declined to destroy instance';
}

sys.inherits(DestroyDeclinedError, Error);

function handleCommand(args, parser, callback) {
  var instanceName = args.name;

  async.series([
    function(callback) {
      var promptStr = 'Are you sure you want to destroy \'' + instanceName + '\'?';
      term.prompt(promptStr, ['y', 'n'], 'n', null, function(resp) {
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
      http.executeRemoteJob(args.remote, remotePath, 'DELETE', callback);
    }
  ],

  function(err) {
    var successMessage = null;

    if (err) {
      if (err instanceof DestroyDeclinedError) {
        err = null;
        successMessage = 'Ok, destroy operation canceled';
      }
    }
    else {
      successMessage = sprintf('Instance "%s" destroyed.', instanceName);
    }

    callback(err, successMessage);
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
