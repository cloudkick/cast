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

var fs = require('fs');
var path = require('path');
var constants = require('constants');
var assert = require('assert');

var lockManagers = {};

/**
 * Manages multiple named locks.
 */
function LockManager() {
  this.queues = {};
  this.locks = {};
}

/**
 * Asynchronously get a lock. The callback won't fire until the lock is
 * achieved. The callback is passed a 'release' callback which will release
 * the lock when called.
 *
 * @param {String} name The name of the lock.
 * @param {Function} cb A callback which takes as a single argument another
 * 'release' callback which will release the lock when called.
 */
LockManager.prototype.withLock = function(lockname, cb) {
  var self = this;
  function release() {
    if (self.queues[lockname].length === 0) {
      self.locks[lockname] = false;
      return;
    }
    else {
      process.nextTick(function() {
        var ncb = self.queues[lockname].shift();
        ncb(release);
      });
    }
  }

  if (!this.locks[lockname]) {
    this.locks[lockname] = true;
    if (!this.queues[lockname]) {
      this.queues[lockname] = [];
    }
    process.nextTick(function() {
      cb(release);
    });
  }
  else {
    this.queues[lockname].push(cb);
  }
};

/**
 * Get or instantiate a lock manager by name.
 */
exports.getLockManager = function(manager) {
  if (!lockManagers[manager]) {
    lockManagers[manager] = new LockManager();
  }
  return lockManagers[manager];
};

/**
 * Attempts to set a lock file at the specified path. If the lock file already
 * exists the callback returns with an error (as opposed to waiting for the
 * lock). On success the callback receives, as its second argument, a function
 * that will release the lock (which itself takes a callback with no args).
 *
 * @param {String} lockFilePath The path to the file to use for the lock.
 * @param {Function} callback A callback called with (err, releaseFn).
 */
exports.withFileLock = function(lockFilePath, callback) {
  fs.open(lockFilePath, constants.O_EXCL | constants.O_CREAT, 644, function(error, fd) {
    if (error) {
      callback(new Error('Error acquiring a lock'));
      return;
    }

    // Release a lock and call an optional callback
    function release(callback) {
      fs.close(fd, function(error) {
        fs.unlink(lockFilePath, function(error) {
          if (callback) {
            callback();
          }
        });
      });
    }

    // Try to remove the lock on SIGINT (if one exists)
    process.on('SIGINT', function()
    {
      release(function() {
        process.exit(0);
      });
    });

    callback(null, release);
  });
};
