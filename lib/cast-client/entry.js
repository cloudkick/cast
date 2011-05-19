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

var term = require('terminal');

var ps = require('util/pubsub');
var config = require('util/config');
var log = require('util/log');
var version = require('util/version');
var req = require('util/requirements');
var parser = require('./parser');

var requirements = {
  'node_version': ['0.4.0', req.compareVersions, 'Minimum node version must be 0.4.0']
};

/**
 * Entry point to the Cast Client Application
 */
function run() {
  // Don't show log messages
  log.setLoglevel('nothing');

  var p = parser.getParser();

  ps.once(ps.CLIENT_STATE_EXIT, function(args) {
    if (args && (args.why !== undefined && args.value !== undefined)) {
      sys.puts(args.value);
    }
  });

  ps.ensure(ps.CLIENT_CONFIG_DONE, function() {
    req.meetsRequirements(requirements, function(err, meetRequirements) {
      if (err || !meetRequirements) {
        ps.emit(ps.CLIENT_STATE_EXIT, {'why': 'requirements', 'value': err});
        return;
      }

      try {
        p.parse(process.argv);
      }
      catch (error) {
        term.puts(error.toString());
      }
    });
  });

  config.setupClient(function(err) {
    if (err) {
      ps.emit(ps.CLIENT_STATE_EXIT, {'why': 'config', 'value': err});
    }
    else {
      ps.emit(ps.CLIENT_CONFIG_DONE);
    }
  });
}

exports.run = run;
