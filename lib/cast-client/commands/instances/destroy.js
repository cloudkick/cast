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
  'short_description': 'Destroy an instance',
  'long_description': 'Destroy an instance and all of its data and services.',
  'required_arguments' : [
    ['name', 'The name of the instance to be destroyed']
  ],
  'optional_arguments': [],
  'uses_global_options': ['remote']
};

function DestroyDeclinedError() {
  this.message = 'User declined to destroy instance';
}
sys.inherits(DestroyDeclinedError, Error);

function handle_command(args) {
  var instance_name = args.name;

  async.series([
    function(callback) {

      var prompt_str = 'Are you sure you want to destroy \'' + instance_name + '\'?';
      term.prompt(prompt_str, ['y', 'n'], 'n', function(resp) {
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
      var remote_path = sprintf('/instances/%s/', instance_name);
      http.get_response(args.remote, remote_path, 'DELETE', true, function(err, response) {
        if (err) {
          callback(err);
        }
        else if (response.status_code !== 200) {
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
      sys.puts('Instance \'' + instance_name + '\' destroyed.');
    }
  });
}

exports.config = config;
exports.handle_command = handle_command;
