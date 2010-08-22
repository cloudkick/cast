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

var child = require('child_process');
var path = require('path');
var ps = require('util/pubsub');
var log = require('util/log');
var config = require('util/config');

exports.load = function()
{
  var conf = config.get();
  var runsvdir = null;
  var running = false;

  function start_runsvdir() {
    // TODO: Do we want to set a custom environment for this?
    runsvdir = child.spawn(conf.runsvdir_binary, [path.join(conf.servicedir, 'enabled')]);

    runsvdir.on('exit', function(code, signal) {
      var logstring = 'runsvdir process exited';
      if (code) {
        logstring += ' with code ' + code;
      }
      if (signal) {
        logstring += ' due to signal ' + signal;
      }
      log.info(logstring);

      if (code === 127) {
        log.err('Unable to start runsvdir, command not found');
      }
      else if (running) {
        start_runsvdir();
      }
    });

    ps.emit('cast.agent.services.runit.started');
    log.info('runsvdir process started');
  }

  ps.on(ps.AGENT_STATE_START, function() {
    running = true;
    start_runsvdir();
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    running = false;
    try {
      runsvdir.kill('SIGHUP');
    }
    catch (err) {
      log.info('Unable to kill runsvdir, was it started?');
    }
  });
};
