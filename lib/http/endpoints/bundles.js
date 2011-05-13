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
var url = require('url');
var constants = require('constants');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var log = require('util/log');
var crypto = require('crypto');
var manifest = require('manifest');
var config = require('util/config');
var misc = require('util/misc');
var http = require('util/http');
var fsutil = require('util/fs');
var extractTarball = require('util/tarball').extractTarball;
var pumpfile = require('util/http_pumpfile');
var route = require('services/http').route;

/**
 * Given a bundle name and a file name, return a validated and normalized path
 * to a (not necessarily existing) file. Return false on invalid paths.
 *
 * @param {String} bundle The name of the bundle.
 * @param {String} file The name of the file.
 *
 * @return {String|Boolean} The normalized file path, or false on invalid paths.
 */
function filePath(bundle, file) {
  if (file.indexOf(bundle) !== 0 || !file.match(/\.tar\.gz$/)) {
    return false;
  }

  var bundleroot = path.join(config.get()['bundle_dir']);
  var bpath = path.normalize(path.join(bundleroot, bundle));
  var fpath = path.normalize(path.join(bundleroot, bundle, file));

  if ((path.dirname(bpath) === bundleroot) && (path.dirname(fpath) === bpath)) {
    return fpath;
  }
  return false;
}

/**
 * Given a bundle name return a validated and normalized path to the (not
 * necessarily existing) bundle directory. Return false on invalid paths.
 *
 * @param {String} bundle The name of the bundle.
 *
 * @return {String|Boolean} The normalized bundle path, or false on invalid paths.
 */
function bundlePath(bundle) {
  var bundleroot = path.join(config.get()['bundle_dir']);
  var bpath = path.normalize(path.join(bundleroot, bundle));

  if (path.dirname(bpath) === bundleroot) {
    return bpath;
  }

  return false;
}

/**
 * Given a bundle tarball, find the path to which it should be extracted.
 *
 * @param {String} bundle The name of the bundle.
 * @param {String} file The name of the file.
 * @return {String} Path to extract into.
 */
function extractPath(bundle, file) {
  var exroot = path.join(config.get()['extracted_dir']);
  var extidx = file.lastIndexOf('.tar.gz');
  return path.join(exroot, bundle, file.slice(0, extidx));
}

/**
 * Get a temporary file name within the same directory as the provided filename
 *
 * @param {String} filename The name of the file to create a temporary name for.
 * @return {String} A path to a temporary file in the same directory as filename.
 */
function tempfileInDirectory(filename) {
  var randname;
  var dname = path.dirname(filename);
  randname = '.cast_tmp_' + misc.randstr(8) + path.extname(filename);
  return path.join(dname, randname);
}

/**
 * Stat a path and verify that it exists. Return a 404 if it doesn't. If it
 * does, fire the given callback with the stat object.
 *
 * @param {String} p  The path to verify.
 * @param {http.ServerResponse} res The response to potentially send the 404 to.
 * @param {Function} callback An optional callback which takes the stat object as
 *                      its only argument.
 */
function pathOr404(p, res, callback) {
  if (!p) {
    http.returnError(res, 404, 'File not found');
    return;
  }

  fs.stat(p, function(err, stats) {
    if (err) {
      http.returnError(res, 404, 'File not found');
      return;
    }
    callback(stats);
  });
}

/**
 * Stat a path and verify that it is a file which exists. Return a 404 if it
 * doesn't. If it does, fire the given callback with the stat object.
 *
 * @param {String} p  The path to verify.
 * @param {http.ServerResponse} res The response to potentially send the 404 to.
 * @param {Function} callback An optional callback which takes the stat object as
 *                      its only argument.
 */
function fileOr404(p, res, callback) {
  pathOr404(p, res, function(stats) {
    if (!stats.isFile()) {
      http.returnError(res, 404, 'File not found');
      return;
    }

    callback(stats);
    return;
  });
}

/**
 * Receive an uploaded bundle file and extract it. This attempts to be as asfe
 * as possible by performing all validation before any destructive actions are
 * taken against existing data, however failed rmtrees (which aren't all that
 * robust) can still cause data loss.
 *
 * @param {http.ServerRequest} req  The HTTP request to read from.
 * @param {http.ServerResponse} res The HTTP response to respond on.
 * @param {String} bundle The name of the bundle to store.
 * @param {String} file   The name of the file to store.
 */
function upload(req, res) {
  var bundle = req.params.bundle;
  var file = req.params.file;
  // We must pause the request until we decide what to do with it
  req.pause();

  // Some data will still arrive, so buffer it
  var received = [];
  var completed = false;

  function onData(data) {
    received.push(data);
  }
  req.on('data', onData);

  function onEnd() {
    completed = true;
  }
  req.on('end', onEnd);

  // Validate the path
  var p = filePath(bundle, file);
  if (!p) {
    http.returnError(res, '404', 'File not found');
    return;
  }

  // Figure out a bunch of path names
  var d = path.dirname(p);
  var extpath = extractPath(bundle, file);
  var tempf = tempfileInDirectory(p);
  var tempd = tempfileInDirectory(extpath);

  async.series([
    // Verify and if necessary create the bundle directory
    async.apply(fsutil.ensureDirectory, d),

    // Store the tarball to a temporary file
    function(callback) {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.resume();

      pumpfile.pumpfilein(tempf, req, received, completed, function(err, sha1) {
        if (!err) {
          // Check the specified sha1
          var ss1 = req.headers['x-content-sha1'] || req.trailers['x-content-sha1'];

          if (ss1 && ss1 !== sha1.digest('base64')) {
            err = new Error('SHA1 Mismatch');
            err.code = 400;
          }
        }
        callback(err);
        return;
      });
    },

    // Verify and if necessary create the bundle's extract directory
    async.apply(fsutil.ensureDirectory, path.dirname(extpath)),

    // Extract the tarball to a temporary directory
    async.apply(extractTarball, tempf, tempd, 0755),

    // Validate the manifest
    function(callback) {
      manifest.validateManifest(path.join(tempd, 'cast.json'), function(err, manifestObject) {
        if (err) {
          err.code = 400;
        }
        callback(err);
        return;
      });
    },

    // If a tarball already existed, remove it
    function(callback) {
      path.exists(p, function(exists) {
        if (exists) {
          return fs.unlink(p, callback);
        }
        else {
          callback();
          return;
        }
      });
    },

    // Swap the new one into its place
    async.apply(fs.rename, tempf, p),

    // If an extracted tree already existed, remove it
    function(callback) {
      path.exists(extpath, function(exists) {
        if (exists) {
          return fsutil.rmtree(extpath, callback);
        }
        else {
          callback();
          return;
        }
      });
    },

    // Swap the new tree into its place
    async.apply(fs.rename, tempd, extpath)
  ],

  // Respond
  function(err) {
    if (err) {
      log.err('Bundle upload error: ' + err.message);
      var code = err.code || 500;
      http.returnError(res, code, err.message);

      // Attempt to clean up after ourselves
      async.forEach([tempf, tempd], function(itempath, callback) {
        path.exists(itempath, function(exists) {
          if (!exists) {
            callback();
            return;
          }
          fsutil.rmtree(itempath, function(err) {
            if (err) {
              log.err('Upload cleanup error: ' + err.message);
            }
            callback();
          });
        });
      },
      function(err) {
        log.info('Completed upload cleanup');
      });
    }
    else {
      log.info('Successful upload of ' + file);
      res.writeHead(204, {});
      res.end();
    }
  });
}

/**
 * Send a requested bundle file
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to.
 * @param {http.ServerResponse} res The HTTP response to write to.
 * @param {String} bundle The name of the bundle to read.
 * @param {String} file   The name of the file to read.
 */
function download(req, res) {
  var bundle = req.params.bundle;
  var file = req.params.file;
  var fpath = filePath(bundle, file);

  fileOr404(fpath, res, function(stats) {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size
    });
   pumpfile.pumpfileout(fpath, res, function(err) {
      if (err) {
        // The header is already written, there isn't much we can do
        log.err('Error streaming file: ' + err);
      }
      // End the response in any case
      res.end();
    });
  });
}

/**
 * Remove a bundle file
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to.
 * @param {http.ServerResponse} res The HTTP response to respond to.
 * @param {String} application The name of the application to delete from.
 * @param {String} bundle The name of the bundle
 */
function remove(req, res) {
  var application = req.params.application;
  var bundle = req.params.bundle;
  var requiredParams = ['bundle_type'];
  var bundleName = sprintf('%s.tar.gz', bundle);
  var tarballPath = filePath(application, bundleName);
  var extractedPath = extractPath(application, bundleName);

  function deleteBundlePath(pathToDelete, callback) {
    var func;
    if (pathToDelete.indexOf('.tar.gz') === -1) {
      // A bundle tarball
      func = fsutil.rmtree;
    }
    else {
      // Extracted bundle directory
      func = fs.unlink;
    }

    func(pathToDelete, callback);
  }

  http.getParams(requiredParams, req, function(err, params) {
    var bundleType, errMsg, statusCode;
    var filePathsToDelete = [];

    if (err) {
      http.returnError(res, 400, err.message);
      return;
    }

    bundleType = params.bundle_type;
    if (bundleType === 'both') {
      filePathsToDelete.push(tarballPath);
      filePathsToDelete.push(extractedPath);
    }
    else if (bundleType === 'tarball') {
      filePathsToDelete.push(tarballPath);
    }
    else if (bundleType === 'extracted') {
      filePathsToDelete.push(extractedPath);
    }
    else {
      http.returnError(res, 400, sprintf('Invalid bundle type: %s', bundleType));
      return;
    }

    async.forEach(filePathsToDelete, deleteBundlePath, function(err) {
      if (err) {
        errMsg = err.message;
        statusCode = (err.errno === constants.ENOENT) ? 404 : 400;
        http.returnError(res, statusCode, err.message);
        return;
      }

      res.writeHead(204, {});
      res.end();
    });
  });
}

/**
 * List files within a bundle
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to.
 * @param {http.ServerResponse} res The HTTP response to respond to.
 * @param {String} bundle The name of the bundle to delete from.
 */
function listFiles(req, res) {
  var bundle = req.params.bundle;
  var bpath = bundlePath(bundle);

  if (!bpath) {
    http.returnError(res, 404, 'File not found');
    return;
  }
  fs.readdir(bpath, function(err, files) {
    if (err) {
      http.returnError(res, 404, 'File not found');
      return;
    }

    var filedata = [];

    // Build a list of files in this directory
    async.forEach(files, function(file, callback) {
      var fpath = filePath(bundle, file);

      if (!fpath) {
        callback();
        return;
      }

      fs.stat(fpath, function(err, stats) {
        if (err) {
          log.warning('Error stat-ing file: ' + err.message);
        }

        else if (stats.isFile()) {
          // TODO: Do we want anything besides the name of the file?
          filedata.push(file);
        }
        callback();
        return;
      });
    },

    // When all of the files have been checked, return the list
    function(err) {
      http.returnJson(res, 200, filedata);
    });
  });
}

/**
 * List available bundles
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to.
 * @param {http.ServerResponse} res The HTTP response to respond to.
 */
function listBundles(req, res) {
  var pathExtracted = config.get()['extracted_dir'];

  function getBundleVersions(bundleName, callback) {
    var bundlePath, splitted;
    var bundleVersions = [];

    bundlePath = path.join(pathExtracted, bundleName);

    fs.readdir(bundlePath, function(err, files) {
      if (err) {
        callback(err);
        return;
      }


      async.forEach(files, function(file, callback) {
        bundlePath = path.join(pathExtracted, bundleName);

        fs.stat(bundlePath, function(err, stats) {
          if (stats.isDirectory()) {
            // @TODO: Don't hard-code the version delimiter and store it in util/misc.js?
            splitted = file.split('@');

            if (splitted.length !== 2) {
              callback();
              return;
            }

            bundleVersions.push({
              'identifier': misc.getFullBundleName(bundleName, splitted[1]),
              'name': bundleName,
              'version': splitted[1]
            });

            callback();
            return;
          }

          callback();
        });
      },

      function(err) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, bundleVersions);
      });
    });
  }

  fs.readdir(pathExtracted, function(err, files) {
    if (err) {
      // This should NOT happen in the course of normal operations
      log.err('Error reading bundle directory: ' + err.message);
      http.returnError(res, 500, 'Error reading directory');
      return;
    }

    var bundles = [];

    // Build a list of directories in this directory
    async.forEach(files, function(file, callback) {
      var fpath = path.join(pathExtracted, file);

      fs.stat(fpath, function(err, stats) {
        if (err) {
          log.warning('Error stat-ing file: ' + err.message);
        }
        else if (stats.isDirectory()) {
          getBundleVersions(file, function(err, bundleVersions) {
            if (err) {
              // This bundle has no versions so it's not included in the result array.
              callback();
              return;
            }

            bundles = bundles.concat(bundleVersions);
            callback();
            return;
          });
        }
        else {
          callback();
        }
      });
    },

    // Return the list of bundles
    function(err) {
      http.returnJson(res, 200, bundles);
    });
  });
}

function register(app, apiVersion) {
  app.get('/', listBundles);
  app.get('/:bundle/', listFiles);
  app.get('/:bundle/:file', download);
  app.put('/:bundle/:file', upload);
  app.del('/:application/:bundle', remove);
}

exports.register = register;
