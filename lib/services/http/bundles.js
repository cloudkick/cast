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
var url = require('url');
var crypto = require('crypto');
var querystring = require('querystring');
var manifest = require('manifest');
var config = require('util/config');
var misc = require('util/misc');
var http = require('util/http');
var fsutil = require('util/fs');
var extract_tarball = require('util/tarball').extract_tarball;
var pumpfile = require('util/http_pumpfile');
var async = require('extern/async');

/**
 * Given a bundle name and a file name, return a validated and normalized path
 * to a (not necessarily existing) file. Return false on invalid paths.
 *
 * @param {String} bundle The name of the bundle.
 * @param {String} file The name of the file.
 *
 * @return {String|Boolean} The normalized file path, or false on invalid paths.
 */
function file_path(bundle, file) {
  if (file.indexOf(bundle) !== 0 || !file.match(/\.tar\.gz$/)) {
    return false;
  }
  var bundleroot = path.join(config.get().bundle_dir);
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
function bundle_path(bundle) {
  var bundleroot = path.join(config.get().bundle_dir);
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
function extract_path(bundle, file) {
  var exroot = path.join(config.get().extracted_dir);
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
 * @param {Function} cb An optional callback which takes the stat object as
 *                      its only argument.
 */
function path_or_404(p, res, cb) {
  if (!p) {
    http.return_error(res, 404, 'File not found');
    return;
  }

  fs.stat(p, function(err, stats) {
    if (err) {
      http.return_error(res, 404, 'File not found');
      return;
    }
    cb(stats);
  });
}

/**
 * Stat a path and verify that it is a file which exists. Return a 404 if it
 * doesn't. If it does, fire the given callback with the stat object.
 *
 * @param {String} p  The path to verify.
 * @param {http.ServerResponse} res The response to potentially send the 404 to.
 * @param {Function} cb An optional callback which takes the stat object as
 *                      its only argument.
 */
function file_or_404(p, res, cb) {
  path_or_404(p, res, function(stats) {
    if (!stats.isFile()) {
      http.return_error(res, 404, 'File not found');
      return;
    }
    cb(stats);
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
function upload(req, res, bundle, file) {
  // We must pause the request until we decide what to do with it
  req.pause();

  // Some data will still arrive, so buffer it
  var received = [];
  var completed = false;

  function on_data(data) {
    received.push(data);
  }
  req.on('data', on_data);

  function on_end() {
    completed = true;
  }
  req.on('end', on_end);

  // Validate the path
  var p = file_path(bundle, file);
  if (!p) {
    http.return_error(res, '404', 'File not found');
    return;
  }

  // Figure out a bunch of path names
  var d = path.dirname(p);
  var extpath = extract_path(bundle, file);
  var tempf = tempfileInDirectory(p);
  var tempd = tempfileInDirectory(extpath);

  async.series([
    // Verify and if necessary create the bundle directory
    async.apply(fsutil.ensure_directory, d),

    // Store the tarball to a temporary file
    function(callback) {
      req.removeListener('data', on_data);
      req.removeListener('end', on_end);
      req.resume();

      if (req.headers.expect === '100-continue') {
        res.writeHead(100);
      }

      pumpfile.pumpfilein(tempf, req, received, completed, function(err, sha1) {
        if (!err && req.headers['x-content-sha1']) {
          if (req.headers['x-content-sha1'] !== sha1.digest('base64')) {
            err = new Error('SHA1 Mismatch');
            err.code = 400;
          }
        }
        return callback(err);
      });
    },

    // Verify and if necessary create the bundle's extract directory
    async.apply(fsutil.ensure_directory, path.dirname(extpath)),

    // Extract the tarball to a temporary directory
    async.apply(extract_tarball, tempf, tempd, 0755),

    // Validate the manifest
    function(callback) {
      manifest.validate_manifest(path.join(tempd, 'cast.json'), function(err, manifest_object) {
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
      http.return_error(res, code, err.message);

      // Attempt to clean up after ourselves
      async.forEach([tempf, tempd], function(itempath, callback) {
        path.exists(itempath, function(exists) {
          if (!exists) {
            return callback();
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
function download(req, res, bundle, file) {
  var fpath = file_path(bundle, file);
  file_or_404(fpath, res, function(stats) {
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
 * @param {String} bundle The name of the bundle to delete from.
 * @param {String} file   The name of the file to delete.
 */
function remove(req, res, bundle, file) {
  var fpath = file_path(bundle, file);
  file_or_404(fpath, res, function() {
    fs.unlink(fpath, function(err) {
      if (err) {
        http.return_error(res, 500, 'Error removing bundle file: ' + err.message);
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
function list_files(req, res, bundle) {
  var bpath = bundle_path(bundle);
  if (!bpath) {
    http.return_error(res, 404, 'File not found');
    return;
  }
  fs.readdir(bpath, function(err, files) {
    if (err) {
      http.return_error(res, 404, 'File not found');
      return;
    }

    var filedata = [];

    // Build a list of files in this directory
    async.forEach(files, function(file, callback) {
      var fpath = file_path(bundle, file);

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
      http.return_json(res, 200, filedata);
    });
  });
}

/**
 * List available bundles
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to.
 * @param {http.ServerResponse} res The HTTP response to respond to.
 */
function list_bundles(req, res) {
  var path_extracted = config.get().extracted_dir;

  var get_bundle_versions = function(bundle_name, callback) {
    var bundle_path, splitted;
    var bundle_versions = [];

    bundle_path = path.join(path_extracted, bundle_name);

    fs.readdir(bundle_path, function(err, files) {
      if (err) {
        callback(err);
        return;
      }


      async.forEach(files, function(file, callback) {
        bundle_path = path.join(path_extracted, bundle_name);

        fs.stat(bundle_path, function(err, stats) {
          if (stats.isDirectory()) {
            // @TODO: Don't hard-code the version delimiter and store it in util/misc.js?
            splitted = file.split('@');

            if (splitted.length !== 2) {
              callback();
              return;
            }

            bundle_versions.push({
              'name': bundle_name,
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

        callback(null, bundle_versions);
      });
    });
  };

  fs.readdir(path_extracted, function(err, files) {
    if (err) {
      // This should NOT happen in the course of normal operations
      log.err('Error reading bundle directory: ' + err.message);
      http.return_error(res, 500, 'Error reading directory');
      return;
    }

    var bundles = [];

    // Build a list of directories in this directory
    async.forEach(files, function(file, callback) {
      var fpath = path.join(path_extracted, file);

      fs.stat(fpath, function(err, stats) {
        if (err) {
          log.warning('Error stat-ing file: ' + err.message);
        }
        else if (stats.isDirectory()) {
          get_bundle_versions(file, function(err, bundle_versions) {
            if (err) {
              // This bundle has no versions so it's not included in the result array.
              callback();
              return;
            }

            bundles = bundles.concat(bundle_versions);
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
      http.return_json(res, 200, bundles);
    });
  });
}

exports.urls = clutch.route([
                              ['PUT /(.+)/(.+)$', upload],
                              ['GET /(.+)/(.+)$', download],
                              ['DELETE /(.+)/(.+)$', remove],
                              ['GET /(.+)/$', list_files],
                              ['GET /$', list_bundles]
                              ]);
