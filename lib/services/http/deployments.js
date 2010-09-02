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

var clutch = require('extern/clutch');
var log = require('util/log');
var fs = require('fs');
var path = require('path');
var querystring = require('querystring');
var config = require('util/config');
var http = require('util/http');
var async = require('extern/async');

/**
 * Given a deployment name return a validated and normalized path to the (not
 * necessarily existing) deployment directory. Return false on invalid paths.
 *
 * @param {String} dep  The name of the deployment
 *
 * @returns The normalized deployment path, or false on invalid paths
 */
function deployment_path(deployment) {
  var deproot = path.join(config.get().data_root, 'extracted');
  var deppath = path.normalize(path.join(deproot, deployment));
  if (path.dirname(deppath) === deproot) {
    return deppath;
  }
  return false;
}


/**
 * List available deployments (ie, bundles in the extracted directory)
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 */
function list_deployments(req, res) {
  var p = path.join(config.get().data_root, "extracted");
  fs.readdir(p, function(err, files) {
    if (err) {
      // This should NOT happen in the course of normal operations
      log.err("Error reading extract directory: " + err.message);
      return http.return_error(res, 500, "Error reading directory");
    }

    var dirs = [];

    async.forEach(files, function(file, callback) {
      var fpath = path.join(p, file);
      fs.stat(fpath, function(err, stats) {
        if (err) {
          log.warning("Error stat-ing file: " + err.message);
          return callback();
        }
        else if (!stats.isDirectory()) {
          log.warning("Non-directory in extract path: " + fpath);
          return callback();
        }
        fs.realpath(path.join(fpath, "current"), function(err, realpath) {
          var dep = {
            name: file,
            active: false
          };
          if (!err) {
            dep.active = path.basename(realpath);
          }
          dirs.push(dep);
          return callback();
        });
      });
    },

    function(err) {
      return http.return_json(res, 200, dirs);
    });
  });
}

/**
 * Return details about a deployment.
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 * @param {String} deployment The name of the deployment
 */
function detail_deployment(req, res, deployment) {
  var dpath = deployment_path(deployment);
  if (!dpath) {
    return http.return_error(res, 404, "File not found");
  }

  fs.readdir(dpath, function(err, files) {
    if (err) {
      return http.return_error(res, 404, "File not found");
    }

    var data = {
      name: deployment,
      available: [],
      active: false,
    };

    async.parallel([
      // Grab the currently deployed version (if there is one)
      function(callback) {
        fs.realpath(path.join(dpath, "current"), function(err, realpath) {
          if (!err) {
            data.active = path.basename(realpath);
          }
          callback();
        });
      },

      // Get the list of available versions
      function(callback) {
        async.forEach(files, function(file, callback) {
          if (file === 'current') {
            return callback();
          }

          var fpath = path.join(dpath, file);

          fs.stat(fpath, function(err, stats) {
            if (err) {
              log.warning("Error stat-ing file: " + err.message);
            }

            else if (stats.isDirectory()) {
              data.available.push(file);
            }
            return callback();
          });
        }, callback);
      }
    ],

    // Return the data
    function(err) {
      return http.return_json(res, 200, data);
    });
  });
}

exports.urls = clutch.route([
                              ['GET /(.+)/$', detail_deployment],
                              ['GET /$', list_deployments]
                              ]);
