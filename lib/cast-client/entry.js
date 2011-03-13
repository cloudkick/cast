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
var CommandParser = require('util/command_parser').CommandParser;

var requirements = {
  'node_version': ['0.3.0', req.compareVersions, 'Minimum node version must be 0.3.0']
};

/*
 * Options which are available to any command that requests them
 */
var GLOBAL_OPTIONS = {
  'remote': {
    names: ['--remote', '-r'],
    dest: 'remote',
    title: 'remote',
    action: 'store',
    desc: 'The remote to use for this command'
  }
};

/**
 * Entry point to the Cast Client Application
 */
exports.run = function() {
  // Don't show log messages
  log.setLoglevel('nothing');

  var p = new CommandParser(path.join(__dirname, 'commands'));

  p.binary = 'cast';
  p.banner = 'Usage: cast command [sub-command]';
  p.addCommands(['info']);
  p.addCommands(['version']);
  p.addCommands(['init']);
  p.addCommands(['bundles/list', 'bundles/create', 'bundles/validate-manifest', 'bundles/upload']);
  p.addCommands([
    'instances/create',
    'instances/destroy',
    'instances/list'
  ]);
  p.addCommands([
    'services/list',
    'services/enable',
    'services/disable',
    'services/start',
    'services/stop',
    'services/restart',
    'services/tail'
  ]);
  p.addCommands(['remotes/add', 'remotes/delete', 'remotes/list', 'remotes/set-default']);
  p.addGlobalOptions(GLOBAL_OPTIONS);

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
        p.parse(process.ARGV);
      }
      catch (error) {
        throw error;
        sys.puts(error.toString());
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
};
