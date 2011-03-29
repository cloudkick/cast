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
var misc = require('util/misc');
var req = require('util/requirements');
var init = require('cast-agent/init');

/**
 * Variable which holds agent start date.
 */
exports.dateStarted = null;

/**
 * Object containing services which are started on the agent startup
 */
var services = {
  'http': 'services/http',
  'health': 'services/health'
};


/**
 * Requirement which must be met so agent can be started.
 */
var requirements = {
  'node_version': ['0.4.0', req.compareVersions, 'Minimum node version must be 0.4.0'],
  'runsvdir_running': [
    null,
    req.isDefined,
    'runsvdir must be running in the configured service_dir_enabled'
  ]
};

/**
 * Entry point to the Cast Agent Application
 */
exports.run = function() {
  if (misc.inArray('CAST_DEBUG', Object.keys(process.env))) {
    log.setLoglevel('debug');
  }
  else {
    log.setLoglevel('info');
  }

  var calledStop = false;

  var p = getopt.parser();
  p.banner = 'Usage: cast-agent [options]';
  p.parse(process.argv);

  ps.once(ps.AGENT_STATE_STOP, function() {
    calledStop = true;
  });

  ps.once(ps.AGENT_STATE_EXIT, function(args) {
    if (args && (args.why !== undefined && args.value !== undefined)) {
      log.info('Agent exited, stage: %s, reason: %s', args.why, args.value);
    }

    if (calledStop === false) {
      ps.emit(ps.AGENT_STATE_STOP);
      calledStop = true;
    }
  });

  ps.once(ps.AGENT_CONFIG_DONE, function() {

    process.addListener('SIGINT', function() {
      log.debug('Caught SIGINT, exiting....');
      ps.emit(ps.AGENT_STATE_EXIT, {'why': 'signal', 'value': 'SIGINT'});
      process.exit();
    });

    req.meetsRequirements(requirements, function(err, meetRequirements) {
      if (err || !meetRequirements) {
        ps.emit(ps.AGENT_STATE_EXIT, {'why': 'requirements', 'value': err});
        return;
      }

      init.initialize(function(err) {
        var service, serviceModule;

        if (err) {
          ps.emit(ps.AGENT_STATE_EXIT, {'why': 'intialization', 'value': err});
          return;
        }

        // Run all the activated services
        for (service in services) {
          if (services.hasOwnProperty(service)) {
            serviceModule = services[service];
            require(serviceModule).load();
          }
        }

        exports.dateStarted = new Date();
        ps.emit(ps.AGENT_STATE_START);
      });
    });
  });

  config.setupAgent(function(err) {
    if (err) {
      ps.emit(ps.AGENT_STATE_EXIT, {'why': 'config', 'value': err});
    }
    else {
      ps.emit(ps.AGENT_CONFIG_DONE);
    }
  });
};
