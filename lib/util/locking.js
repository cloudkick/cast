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

/**
 * A 'class' for lockable objects. Locking is per-object.
 * @constructor
 * @export
 */
function Lockable() {
  this.__lock_requests = [];
}

/**
 * Get an exclusive lock on this object.
 * @param {Function} callback Callback fired when lock is achieved.
 */
Lockable.prototype.withLock = function(callback) {
  this.__lock_requests.push(callback);
  if (this.__lock_requests.length === 1) {
    callback();
  }
};

/**
 * Release the lock on this object. DO NOT CALL THIS unless you know that you
 * hold the lock. That is, once you get the lock, make sure that you call this
 * exactly once.
 */
Lockable.prototype.releaseLock = function() {
  this.__lock_requests.shift();
  if (this.__lock_requests.length > 0) {
    this.__lock_requests[0]();
  }
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
function withFileLock(lockFilePath, callback) {
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
    process.on('SIGINT', function() {
      release(function() {
        process.exit(0);
      });
    });

    callback(null, release);
  });
}

exports.Lockable = Lockable;
exports.withFileLock = withFileLock;
