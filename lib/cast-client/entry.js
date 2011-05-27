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

var ps = require('util/pubsub');
var config = require('util/config');
var log = require('util/log');
var version = require('util/version');
var req = require('util/requirements');
var parser = require('./parser');
var clientUtils = require('util/client');

var requirements = {
  'node_version': ['0.4.0', req.compareVersions, 'Minimum node version must be 0.4.0'],
  'gnutar': [null, req.isDefined, 'You need to have GNU tar installed to ' +
              'use Cast. On Mac OS X you can install "gnutar" port, on ' +
              'FreeBSD you can install "gtar" port and on Ubuntu you can ' +
              'install "gpg" package. For more detailed instruction please ' +
              'visit the documentation at http://www.cast-project.org/start/.']
};

/**
 * Exit code with which the client will exit.
 * @type {Number}
 */
var exitCode = 0;

/**
 * Entry point to the Cast Client Application
 */
function run() {
  // Don't show log messages
  log.setLoglevel('nothing');

  var p = parser.getParser();

  ps.once(ps.CLIENT_STATE_EXIT, function(args) {
    if (args.exitCode) {
      exitCode = args.exitCode;
    }

    if (args && (args.why !== undefined && args.value !== undefined)) {
      sys.puts(args.value);
    }
  });

  ps.ensure(ps.CLIENT_CONFIG_DONE, function() {
    req.meetsRequirements(requirements, function(err, meetRequirements) {
      if (err || !meetRequirements) {
        ps.emit(ps.CLIENT_STATE_EXIT, {'why': 'requirements', 'value': err,
                                       'exitCode': 2});
        return;
      }

      try {
        p.parse(process.argv);
      }
      catch (err2) {
        clientUtils.printErrorAndExit(err2, 1);
      }
    });
  });

  config.setupClient(function(err) {
    if (err) {
      ps.emit(ps.CLIENT_STATE_EXIT, {'why': 'config', 'value': err, 'exitCode': 3});
    }
    else {
      ps.emit(ps.CLIENT_CONFIG_DONE);
    }
  });
}

process.on('exit', function onExit() {
  process.reallyExit(exitCode);
});

exports.run = run;
