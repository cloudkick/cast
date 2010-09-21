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

var async = require('extern/async');

var config = require('util/config');
var fsutil = require('util/fs');

var constants = null;
try {
  /* This was renamed in Node 0.2 -> 0.3 */
  constants = process.binding('constants');
}
catch (err) {
  constants = process;
}

/*
 * Function which determines if this is the first start of the agent.
 *
 * @param {Function} callback Callback which is called with a possible error as the first
 *                            argument and true as the second one if this if the first run,
 *                            false otherwise.
 */
function is_first_run(callback) {
  var p = path.join(config.get().data_root, '.cast-first-run');
  fs.open(p,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
          0600,
    function(err, fd) {
      if (err) {
        callback(err, false);
        return;
      }
      fs.closeSync(fd);
      callback(null, true);
  });
}

/*
 * This function preforms the initialization process.
 *
 * @param {Function} callback Callback which is called with a possible error.
 */
exports.initialize = function(callback) {
  is_first_run(function(err, first_run) {
    if (err) {
      callback('Failed to determine if this is the first run: ' + err);
      return;
    }

    var ops = [];

    if (first_run) {
      ops.push(function(callback) {
         // Create the neccessary directories
        fsutil.ensure_directory(config.get().data_root, function(err) {
          if (err) {
            callback(err);
            return;
          }

          paths_to_create = [config.get().data_dir, config.get().service_dir, config.get().bundle_dir,
                              config.get().extracted_dir, config.get().app_dir];

          async.forEach(paths_to_create,
            function(path_, callback) {
              fsutil.ensure_directory(path_, callback);
            },
            function(err) {
              if (err) {
                callback(err);
                return;
              }
              callback();
          });
        });
      });
    }

    async.series(ops,
      function(err, results) {
        callback(err);
      });
  });
};
