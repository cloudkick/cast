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

var sprintf = require('sprintf').sprintf;

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
 * @type {Date}
 */
exports.dateStarted = null;

/**
 * Exit code with which the client will exit.
 * @type {Number}
 */
var exitCode = 0;

/**
 * Object containing services which are started on the agent startup
 */
var services = {
  'http': 'services/http',
  'health': 'services/health',
  'plugin': 'services/plugins'
};

/**
 * Requirement which must be met so agent can be started.
 */
var requirements = {
  'node_version': ['0.4.0', req.compareVersions,
                    'Cast requires node version >= 0.4.0'],
  'runsvdir_running': [null, req.isDefined,
                       'runsvdir must be running in the configured ' +
                       'service_dir_enabled'],
  'gnutar': [null, req.isDefined, 'You need to have GNU tar installed to ' +
              'use Cast. On Mac OS X you can install "gnutar" port, on ' +
              'FreeBSD you can install "gtar" port and on Ubuntu you can ' +
              'install "gpg" package. For more detailed instruction please ' +
              'visit the documentation at http://www.cast-project.org/start/.']
};

/**
 * Entry point to the Cast Agent Application
 */
function run() {
  var p, options;
  var calledStop = false;

  if (misc.inArray('CAST_DEBUG', Object.keys(process.env))) {
    log.setLoglevel('debug');
  }
  else {
    log.setLoglevel('info');
  }

  p = getopt.getParser();
  p.banner = 'Usage: cast-agent [options]';
  p.parse(process.argv);

  options = getopt.getOptions();

  if (options.debug === true) {
    log.setLoglevel('debug');
  }

  ps.once(ps.AGENT_STATE_STOP, function() {
    calledStop = true;
  });

  ps.once(ps.AGENT_STATE_EXIT, function(args) {
    if (args.exitCode) {
      exitCode = args.exitCode;
    }

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
        ps.emit(ps.AGENT_STATE_EXIT, {'why': 'requirements', 'value': err,
                                      'exitCode': 2});
        return;
      }

      init.initialize(function(err) {
        var service, serviceModule;

        if (err) {
          ps.emit(ps.AGENT_STATE_EXIT, {'why': 'intialization', 'value': err,
                                        'exitCode': 4});
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
      ps.emit(ps.AGENT_STATE_EXIT, {'why': 'config', 'value': err, 'exitCode': 3});
    }
    else {
      ps.emit(ps.AGENT_CONFIG_DONE);
    }
  });
}

process.on('exit', function onExit() {
  process.reallyExit(exitCode);
});

exports.run = run;
