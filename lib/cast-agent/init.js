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

var async = require('async');
var config = require('util/config');
var fsutil = require('util/fs');
var certgen = require('security/certgen.js');
var norris = require('norris');

/*
 * Function which determines if this is the first start of the agent.
 *
 * @param {Function} callback Callback which is called with a possible error as the first
 *                            argument and true as the second one if this if the first run,
 *                            false otherwise.
 */
function isFirstRun(callback) {
  var p = path.join(config.get()['data_root'], '.cast-first-run');
  fs.open(p,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
          0600,
    function(err, fd) {
      if (err) {
        if (err.errno === constants.EEXIST) {
          // Ignore EEXIST, this simply means this is not first run
          callback(null, false);
          return;
        }
        else if (err.errno === constants.ENOENT) {
          // If the data_root directory does not exist, this means that this is a first run
          callback(null, true);
          return;
        }

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
  var conf = config.get();
  isFirstRun(function(err, firstRun) {
    if (err) {
      callback('Failed to determine if this is the first run: ' + err);
      return;
    }

    var ops = [];

    if (firstRun) {
      ops.push(function(callback) {
        var pathsToCreate;
         // Create the neccessary directories
        fsutil.ensureDirectory(conf['data_root'], function(err) {
          if (err) {
            callback(err);
            return;
          }

          pathsToCreate = [
            conf['data_dir'],
            conf['service_dir_available'],
            conf['bundle_dir'],
            conf['extracted_dir'],
            conf['app_dir']
          ];

          async.forEachSeries(pathsToCreate, fsutil.ensureDirectory, callback);
        });
      });
    }

    // If the server doesn't have an SSL certificate of its own, generate one
    ops.push(function(callback) {
      var key = conf['ssl_key'];
      var cert = conf['ssl_cert'];
      path.exists(conf['ssl_cert'], function(exists) {
        if (!exists) {
          norris.get(function(facts)  {
            certgen.genSelfSigned(facts.hostname, key, cert, callback);
          });
        } else {
          callback();
        }
      });
    });

    // If the CA directory doesn't exist, create and chmod it
    ops.push(function(callback) {
      path.exists(conf['ca_dir'], function(exists) {
        if (!exists) {
          fsutil.ensureDirectory(conf['ca_dir'], function(err) {
            if (err) {
              callback(err);
            } else {
              fs.chmod(conf['ca_dir'], 0700, callback);
            }
          });
        }
      });
    });

    // Create a CA key and cert if the cert is not present. We intentionally
    // don't require a key to be present in case the user wants to operate
    // their own CA infrastructure
    ops.push(function(callback) {
      var key = conf['ssl_ca_key'];
      var cert = conf['ssl_ca_cert'];
      path.exists(cert, function(exists) {
        if (!exists) {
          norris.get(function(facts) {
            certgen.genSelfSigned(facts.hostname, key, cert, callback);
          });
        } else {
          callback();
        }
      });
    });

    async.series(ops, callback);
  });
};
