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

var path = require('path');
var spawn = require('child_process').spawn;

var dotfiles = require('util/client_dotfiles');
var log = require('util/log');
var constants = require('deployment/constants');

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

/**
 * Execute a hook in a deployed instance
 * {Object} instance The instance on which to execute the hook
 * {String} version The version on which to execute the hook
 * {String} hook The name of the hook to execute
 * {Array} args Arguments to the specified hook
 * {Number} timeout Number of milliseconds after which hook is killed if it
 *                  hasn't exited yet.
 * {Function} callback A callback fired with (err, killed, stderr, stdout)
 */
exports.execute = function(instance, version, hook, timeout, args, callback) {
  var env = {};
  var k;

  // This whole thing is a dirty hack because process.env doesn't have a
  // hasOwnProperty() method - misc.merge won't work, and we need a condional
  // to keep jslint happy...
  for (k in process.env) {
    if (true) {
      env[k] = process.env[k];
    }
  }

  if (timeout === null) {
    timeout = constants.timeouts[hook];
  }

  env.CAST_INSTANCE_NAME = instance.name;

  var versionRoot;
  var hookPath;
  var hookExists = false;

  async.waterfall([
    // Get the version root
    function(callback) {
      instance.get_version_path(version, function(err, version) {
        versionRoot = version;
        hookPath = path.join(versionRoot, '.cast-project', 'hooks', hook);
        callback(err);
      });
    },

    // See if the hook exists
    function(callback) {
      path.exists(hookPath, function(exists) {
        hookExists = exists;
        callback();
      });
    },

    // If the hook does exist, execute it
    function(callback) {
      if (!hookExists) {
        callback();
        return;
      }
      var opts = {
        cwd: versionRoot,
        env: env
      };

      var stdout = '';
      var stderr = '';
      var hookRunning = false;

      log.info('executing hook: ' + hookPath);

      var hookProc = spawn(hookPath, args, opts);
      hookRunning = true;

      var hookTimeoutId = setTimeout(function() {
        if (hookRunning) {
          hookProc.kill('SIGTERM');
        }
      }, timeout);

      hookProc.stdout.on('data', function(chunk) {
        stdout += chunk;
      });

      hookProc.stderr.on('data', function(chunk) {
        stderr += chunk;
      });

      hookProc.on('exit', function(code) {
        var err = null;
        var killed = this.killed;

        if (!killed) {
          clearTimeout(hookTimeoutId);
        }

        if (killed) {
          err = new Error(sprintf('hook %s was killed because a timeout' +
                                  ' of %s ms was reached ', hook, timeout));
        }
        else if (code !== 0) {
          err = new Error('hook \'' + hook + '\' exited with status ' + code);
          log.info('hook exited with status ' + code + ':' + hookPath);
        }
        else {
          log.info('hook exited cleanly');
        }

        callback(err, killed, stdout, stderr);
      });
    }
  ],

  function(err, killed, stdout, stderr) {
    callback(err, killed, stdout, stderr);
  });
};
