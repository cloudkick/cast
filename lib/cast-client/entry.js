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

var sys = require("sys");
var path = require('path');

var ps = require('util/pubsub');
var config = require('util/config');
var log = require('util/log');
var version = require('util/version');
var CommandParser = require('util/command_parser').CommandParser;

exports.run = function() {
  // Don't show log messages
  log.set_loglevel('nothing');

  var p = new CommandParser(path.join(__dirname, 'commands'));

  p.binary = 'cast';
  p.banner = 'Usage: cast command [sub-command]';
  p.add_commands(['version']);
  p.add_commands(['bundles/create', 'bundles/validate-manifest', 'bundles/upload']);
  p.add_commands(['services/list', 'services/tail']);
  p.add_commands(['remotes/add']);

  ps.ensure(ps.CLIENT_CONFIG_DONE, function() {
    try {
      p.parse(process.ARGV);
   }
   catch (error) {
     sys.puts(error.toString());
   }
   });

  config.setup(function(err) {
    if (err) {
      ps.emit(ps.CLIENT_STATE_EXIT, {'why': 'config', 'value': err});
    }
    else {
      ps.emit(ps.CLIENT_CONFIG_DONE);
    }
  });
};
