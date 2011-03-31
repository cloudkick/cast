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
var util = require('util');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var dotfiles = require('util/client_dotfiles');
var log = require('util/log');
var constants = require('deployment/constants');
var misc = require('util/misc');
var Errorf = misc.Errorf;

/**
 * Base hook class.
 * @constructor
 *
 * {String} type Hook type (pre / post).
 * {String} name Hook name.
 * {String} hookPath Path to the hook file.
 * {String} cwd Hook working directory.
 * {Boolean} errOnInexistent Throw an error if the hook file doesn't exist
 *                           (defaults to False)
 * {Object} baseEnv Base environment which is set for the hook.
 */
function Hook(type, name, hookPath, cwd, errOnInexistent, baseEnv) {
  this.type = type;
  this.path = hookPath;
  this.cwd = cwd;
  this.errOnInexistent = errOnInexistent || false;
  this.baseEnv = baseEnv || {};
}

/**
 * Execute a hook script.
 * {Number} timeout Number of milliseconds after which hook is killed if it
 *                  hasn't exited yet.
 * {Array} args Arguments to the specified hook
 * {Function} callback A callback fired with (err, killed, stderr, stdout)
 */
Hook.prototype.execute = function(timeout, args, callback) {
  var self = this;
  var env = this._getEnvironment(this.baseEnv);
  var timeout_ = timeout || constants.timeouts[this.hookName];

  var hookExists = false;

  async.waterfall([
    // See if the hook exists
    function(callback) {
      path.exists(self.path, function(exists) {
        hookExists = exists;
        callback();
      });
    },

    // If the hook does exist, execute it
    function(callback) {
      if (!hookExists) {
        var err = null;

        if (self.errOnInexistent) {
          err = new Errorf('hook %s does not exist', self.path);
        }

        callback(err, false, null, null);
        return;
      }

      var opts = {
        cwd: self.cwd,
        env: env
      };

      var stdout = '';
      var stderr = '';
      var hookRunning = false;

      log.info(sprintf('executing hook: %s', self.path));

      var hookProc = spawn(self.path, args, opts);
      hookRunning = true;

      var hookTimeoutId = setTimeout(function() {
        if (hookRunning) {
          hookProc.kill('SIGTERM');
        }
      }, timeout_);

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
          err = new Errorf('hook %s was killed because a timeout' +
                           ' of %s ms was reached ', self.path, timeout);
        }
        else if (code !== 0) {
          var err_msg = sprintf('hook %s exited with status %s', self.path, code);
          err = new Error(err_msg);
          log.info(err_msg);
        }
        else {
          log.info(sprintf('hook %s exited cleanly', self.path));
        }

        callback(err, killed, stdout, stderr);
      });
    }
  ],

  function(err, killed, stdout, stderr) {
    callback(err, killed, stdout, stderr);
  });
};

Hook.prototype._getEnvironment = function(baseEnv) {
  var env = misc.merge({}, baseEnv);
  var k;

  // This whole thing is a dirty hack because process.env doesn't have a
  // hasOwnProperty() method - misc.merge won't work, and we need a condional
  // to keep jslint happy...
  for (k in process.env) {
    if (true) {
      env[k] = process.env[k];
    }
  }

  return env;
};

/**
 * Instance hook class.
 * @constructor
 *
 * {String} type Hook type (pre / post).
 * {String} name Hook name.
 * {String} instanceVersionPath Path to the instance version root.
 * {Boolean} errOnInexistent Throw an error if the hook file doesn't exist
 *                           (defaults to False)
 * {Object} baseEnv Base environment which is set for the hook.
 */
function InstanceHook(type, name, instanceVersionPath, errOnInexistent, baseEnv) {
  var hookPath = path.join(instanceVersionPath, '.cast-project', 'hooks',
                           name);
  Hook.call(this, type, name, hookPath, instanceVersionPath, errOnInexistent,
            baseEnv);
  this.instanceVersionPath = instanceVersionPath;
}

util.inherits(InstanceHook, Hook);

exports.Hook = Hook;
exports.InstanceHook = InstanceHook;
