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
var constants = require('util/constants');

exports.with_lock = function(lock_file_path, callback) {
  fs.open(lock_file_path, constants.O_EXCL | constants.O_CREAT, 644, function(error, fd) {
    if (error) {
      return callback(new Error('Error acquiring a lock'));
    }

    // Release a lock and call an optional callback
    function release(callback) {
      fs.close(fd, function(error) {
        fs.unlink(lock_file_path, function(error) {
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
