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
var sprintf = require('extern/sprintf').sprintf;
var log = require('util/log');
var version = require('util/version');
var ps = require('util/pubsub');
var config = require('util/config');
var getopt = require('util/getopt');
var req = require('util/requirements');
var init = require('cast-agent/init');
var services = ['http', 'runit', 'health'];

var requirements = {
  'node_version': ['0.2.2', req.compare_versions, 'Minimum node version must be 0.2.2']
};

/**
 * Entry point to the Cast Agent Application
 */
exports.run = function() {
  if (process.env.hasOwnProperty('CAST_DEBUG')) {
    log.set_loglevel('debug');
  }
  else {
    log.set_loglevel('info');
  }

  var called_stop = false;

  var p = getopt.parser();
  p.banner = 'Usage: cast-agent [options]';
  p.parse(process.argv);

  ps.once(ps.AGENT_STATE_STOP, function() {
    called_stop = true;
  });

  ps.once(ps.AGENT_STATE_EXIT, function(args) {
    if (args && (args.why !== undefined && args.value !== undefined)) {
      log.info('Agent exited, stage: %s, reason: %s', args.why, args.value);
    }

    if (called_stop === false) {
      ps.emit(ps.AGENT_STATE_STOP);
      called_stop = true;
    }
  });

  ps.once(ps.AGENT_CONFIG_DONE, function() {

    process.addListener('SIGINT', function() {
      log.debug('Caught SIGINT, exiting....');
      ps.emit(ps.AGENT_STATE_EXIT, {'why': 'signal', 'value': 'SIGINT'});
      process.exit();
    });

    req.meets_requirements(requirements, function(err, meet_requirements) {
      if (err || !meet_requirements) {
        ps.emit(ps.AGENT_STATE_EXIT, {'why': 'requirements', 'value': err});
        return;
      }
      init.initialize(function(err) {
        if (err) {
          ps.emit(ps.AGENT_STATE_EXIT, {'why': 'intialization', 'value': err});
          return;
        }

        services.forEach(function(service) {
          require('services/' + service).load();
        });

        ps.emit(ps.AGENT_STATE_START);
      });
    });
  });

  config.setup(function(err) {
    if (err) {
      ps.emit(ps.AGENT_STATE_EXIT, {'why': 'config', 'value': err});
    }
    else {
      ps.emit(ps.AGENT_CONFIG_DONE);
    }
  });
};
