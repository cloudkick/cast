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
var qs = require('querystring');
var querystring = require('querystring');
var config = require('util/config');
var http = require('util/http');
var locking = require('util/locking');
var async = require('extern/async');

var deplock = locking.get_lock_manager('deployment');

/**
 * Get the extract path.
 * @returns The path to the extract root
 */
function extract_path() {
  return path.join(config.get().data_root, config.get().extracted_dir);
}

/**
 * Given a deployment and a version name, return a validated and normalized
 * path to a (not necessarily existing) version directory. Return false on
 * invalid paths.
 * @param {String} deployment The name of the deployment
 * @param {String} version The name of the version
 * @returns The normalized version path, or false on invalid paths
 */
function version_path(deployment, version) {
  if (version.indexOf(deployment) !== 0) {
    return false;
  }
  var deproot = extract_path();
  var deppath = path.normalize(path.join(deproot, deployment));
  var verpath = path.normalize(path.join(deproot, deployment, version));
  if ((path.dirname(verpath) === deppath) && (path.dirname(deppath) === deproot)) {
    return verpath;
  }
  return false;
}

/**
 * Given a deployment name return a validated and normalized path to the (not
 * necessarily existing) deployment directory. Return false on invalid paths.
 * @param {String} dep  The name of the deployment
 * @returns The normalized deployment path, or false on invalid paths
 */
function deployment_path(deployment) {
  var deproot = extract_path();
  var deppath = path.normalize(path.join(deproot, deployment));
  if (path.dirname(deppath) === deproot) {
    return deppath;
  }
  return false;
}

/**
 * List available deployments (ie, bundles in the extracted directory)
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 */
function list_deployments(req, res) {
  var p = extract_path();
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

/**
 * Activate the specified version of the deployment.
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 * @param {String} deployment The name of the deployment
 * @param {Object} args The POST args
 */
function do_deploy(req, res, deployment, args) {
  if (!args.version) {
    return htt.return_error(res, 400, "Must specify a 'version' parameter");
  }

  var dpath = deployment_path(deployment);
  var vpath = version_path(deployment, args.version);
  var cpath = path.join(dpath, 'current');
  var ppath;
  var release;

  if (!vpath) {
    return http.return_error(res, 404, "File not found");
  }

  async.series([
    // Make sure the version to be deployed exists
    function(callback) {
      fs.stat(vpath, function(err, stats) {
        if (err || !stats.isDirectory()) {
          err = new Error("File not found");
          err.code = 404;
        }
        return callback(err);
      });
    },

    // Get the deployment lock
    function(callback) {
      deplock.with_lock(deployment, function(_release) {
        release = _release;
        return callback();
      });
    },

    // Figure out the path to the currently deployed version
    function(callback) {
      fs.realpath(cpath, function(err, realpath) {
        if (!err) {
          ppath = realpath;
        }
        callback();
      });
    },

    // Synchronously update the symlink
    function(callback) {
      path.exists(cpath, function(exists) {
        // Remove the existing 'current' symlink
        if (exists) {
          try {
            fs.unlinkSync(cpath);
          }
          catch (err) {
            return callback(err);
          }
        }

        // Replace it with the updated one
        try {
          fs.symlinkSync(vpath, cpath);
        }
        catch (err) {
          log.err("Deployment error: " + err.message);

          // Attempt to restore the previous symlink (if there was one)
          if (ppath) {
            try {
              fs.symlinkSync(ppath, cpath);
              log.err("Previous symlink restored");
              err = new Error("Error updating symlink, previous deployment restored");
            }
            catch (_err) {
              err = new Error("An unrecoverable deployment error occurred");
            }
          }
          else {
            err = new Error("Unable to create deployment symlink");
          }

          // Return the error
          err.code = 500;
          return callback(err);
        }
        return callback();
      });
    }
  ],
  function(err) {
    // Release the lock
    if (release) {
      release();
    }

    // Return
    if (err) {
      log.err("Deployment error: " + err.message);
      var code = err.code || 500;
      return http.return_error(res, code, err.message);
    }
    else {
      res.writeHead(204);
      res.end();
    }
  });
}

/**
 * Perform an action on a deployment. Requires a single 'action' parameter in
 * the POST body.
 *
 */
function deployment_action(req, res, deployment) {
  var max_length = 1024;
  var actions = {
    deploy: do_deploy
  };

  chunks = [];
  bytes = 0;

  function on_data(data) {
    bytes += data.length;
    if (bytes > max_length) {
      req.removeListener('end', on_end);
      erq.removeListener('data', on_data);
      return http.return_error(res, 413, "Body limited to " + max_length + " bytes");
    }
    chunks.push(data);
  }
  req.on('data', on_data);

  function on_end() {
    var params = qs.parse(chunks.join(''));
    var action = params['action'];
    if (!action) {
      return http.return_error(res, 400, "Must specify an 'action' parameter");
    }
    else if (!actions[action]) {
      log.debug(action);
      return http.return_error(res, 400, "Unrecognized action");
    }
    actions[action](req, res, deployment, params);
  }
  req.on('end', on_end);
}

exports.urls = clutch.route([
                              ['GET /(.+)/$', detail_deployment],
                              ['POST /(.+)/$', deployment_action],
                              ['GET /$', list_deployments]
                              ]);
