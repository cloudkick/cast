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
var sys = require('sys');
var path = require('path');
var url = require('url');
var crypto = require('crypto');
var querystring = require('querystring');
var config = require('util/config');
var misc = require('util/misc');
var http = require('util/http');
var fsutil = require('util/fs');
var extract_tarball = require('util/tarball').extract_tarball;
var async = require('extern/async');

/**
 * Given a bundle name and a file name, return a validated and normalized path
 * to a (not necessarily existing) file. Return false on invalid paths.
 *
 * @param {String} bundle The name of the bundle
 * @param {String} file The name of the file
 *
 * @returns The normalized file path, or false on invalid paths
 */
function file_path(bundle, file) {
  if (file.indexOf(bundle) !== 0 || !file.match(/\.tar\.gz$/)) {
    return false;
  }
  var bundleroot = path.join(config.get().data_root, 'bundles');
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
 * @param {String} bundle The name of the bundle
 *
 * @returns The normalized bundle path, or false on invalid paths
 */
function bundle_path(bundle) {
  var bundleroot = path.join(config.get().data_root, 'bundles');
  var bpath = path.normalize(path.join(bundleroot, bundle));
  if (path.dirname(bpath) === bundleroot) {
    return bpath;
  }
  return false;
}

/**
 * Given a bundle tarball, find the path to which it should be extracted.
 *
 * @param {String} bundle The name of the bundle
 * @param {String} file The name of the file
 */
function extract_path(bundle, file) {
  var exroot = path.join(config.get().data_root, 'extracted');
  var extidx = file.lastIndexOf('.tar.gz');
  return path.join(exroot, bundle, file.slice(0, extidx));
}

/**
 * Make sure a directory exists, create it (non recursively) if not. The
 * callback takes an error which will occur if creation fails, the path
 * already exists and is not a directory, or stat-ing the file fails for
 * whatever reason.
 *
 * @param {String} p  The path to the directory to ensure.
 * @param {Function} cb The callback which takes a possible error.
 */
function ensure_directory(p, callback) {
  path.exists(p, function(exists) {
    if (exists) {
      fs.stat(p, function(err, stats) {
        if (err) {
          return callback(err);
        }
        else if (!stats.isDirectory()) {
          return callback(new Error("Path exists and is not a directory: " + p));
        }
        else {
          return callback();
        }
      });
    }
    else {
      fs.mkdir(p, 0755, callback);
    }
  });
}

/**
 * Get a temporary file name within the same directory as the provided filename
 *
 * @param {String} filename The name of the file to create a temporary name for
 * @returns A path to a temporary file in the same directory as filename.
 */
function tempfileInDirectory(filename) {
  dname = path.dirname(filename);
  randname = ".cast_tmp_" + misc.randstr(8) + path.extname(filename);
  return path.join(dname, randname);
}

/**
 * Stat a path and verify that it exists. Return a 404 if it doesn't. If it
 * does, fire the given callback with the stat object.
 *
 * @param {String} p  The path to verify
 * @param {http.ServerResponse} res The response to potentially send the 404 to
 * @param {Function} cb An optional callback which takes the stat object as
 *                      its only argument.
 */
function path_or_404(p, res, cb) {
  if (!p) {
    return http.return_error(res, 404, "File not found");
  }

  fs.stat(p, function(err, stats) {
    if (err) {
      return http.return_error(res, 404, "File not found");
    }
    return cb(stats);
  });
}

/**
 * Stat a path and verify that it is a file which exists. Return a 404 if it
 * doesn't. If it does, fire the given callback with the stat object.
 *
 * @param {String} p  The path to verify
 * @param {http.ServerResponse} res The response to potentially send the 404 to
 * @param {Function} cb An optional callback which takes the stat object as
 *                      its only argument.
 */
function file_or_404(p, res, cb) {
  path_or_404(p, res, function(stats) {
    if (!stats.isFile()) {
      return http.return_error(res, 404, "File not found");
    }
    return cb(stats);
  });
}

/**
 * Write a file from an HTTP stream and fire a callback on success or error.
 *
 * @param {String} dest The path to store the file to
 * @param {http.ServerRequest} istream The HTTP stream to read from
 * @param {Function} cb A callback that takes a possible error
 */
function pumpfilein(dest, istream, received, completed, cb) {
  var fstream = fs.createWriteStream(dest, {'flags': 'w', 'encoding': 'binary', 'mode': 0644});
  var md5 = crypto.createHash('md5');

  function close_fstream() {
    try {
      fstream.end();
    }
    catch (err) {
      log.err("Unable to close file: " + err.message);
    }
  }

  fstream.on('error', function(err) {
    log.err("Error on file stream: " + err.message);
    close_fstream();
    return cb(err);
  });

  function write_received() {
    for (var i = 0; i < received.length; i++) {
      md5.update(received[i]);
      fstream.write(received[i]);
    }
  }

  /* If the request has already been completed, we don't need to actually use
   * the pump.
   */
  if (completed) {
    fstream.on('close', function() {
      return cb(null, md5);
    });

    write_received();

    fstream.end();
    return;
  }

  istream.on('end', function() {
    /* This is not ideal, but sys.pump and the HTTP request don't interact that
     * well together, so this emits a spurious and technically incorrect
     * 'close' event for when the HTTP request body has ended.
     */
    istream.emit('close');
  });

  istream.on('data', function(data) {
    md5.update(data);
  });

  write_received();

  sys.pump(istream, fstream, function() {
    cb(null, md5);
  });
}

/**
 * Write a file to an HTTP stream. Does not write the headers.
 *
 * @param {String} source The path to read the file from
 * @param {http.ServerResponse} ostream The HTTP Stream to write the file to
 * @param {Function} cb A callback which takes a possible error
 */
function pumpfileout(source, ostream, cb) {
  var fstream = fs.createReadStream(source, {'bufferSize': config.get().fileread_buffer_size});

  function close_both() {
    (function() {
      try {
        ostream.end();
      }
      catch (err) {
        log.err("Unable to close outgoing HTTP stream: " + err.message);
      }
    })();

    (function() {
      try {
        fstream.end();
      }
      catch (err) {
        log.err("Unable to close file: " + err.message);
      }
    })();
  }

  fstream.on('error', function(err) {
    close_both();
    return cb(err);
  });

  sys.pump(fstream, ostream, function() {
    cb();
  });
}

/**
 * Receive an uploaded bundle file and extract it. This attempts to be as asfe
 * as possible by performing all validation before any destructive actions are
 * taken against existing data, however failed rmtrees (which aren't all that
 * robust) can still cause data loss.
 *
 * @param {http.ServerRequest} req  The HTTP request to read from
 * @param {http.ServerResponse} res The HTTP response to respond on
 * @param {String} bundle The name of the bundle to store
 * @param {String} file   The name of the file to store
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
    return http.return_error(res, "404", "File not found");
  }

  // Figure out a bunch of path names
  var d = path.dirname(p);
  var extpath = extract_path(bundle, file);
  var tempf = tempfileInDirectory(p);
  var tempd = tempfileInDirectory(extpath);

  async.series([
    // Verify and if necessary create the bundle directory
    async.apply(ensure_directory, d),

    // Store the tarball to a temporary file
    function(callback) {
      req.removeListener('data', on_data);
      req.removeListener('end', on_end);
      req.resume();

      if (req.headers.expect === '100-continue') {
        res.writeHead(100);
      }

      pumpfilein(tempf, req, received, completed, function(err, md5) {
        if (!err && req.headers['content-md5']) {
          if (req.headers['content-md5'] !== md5.digest('base64')) {
            err = new Error("MD5 Mismatch");
            err.code = 400;
          }
        }
        return callback(err);
      });
    },

    // Verify and if necessary create the bundle's extract directory
    async.apply(ensure_directory, path.dirname(extpath)),

    // Extract the tarball to a temporary directory
    async.apply(extract_tarball, tempf, tempd, 0755),

    // If a tarball already existed, remove it
    function(callback) {
      path.exists(p, function(exists) {
        if (exists) {
          return fs.unlink(p, callback);
        }
        else {
          return callback();
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
          return callback();
        }
      });
    },

    // Swap the new tree into its place
    async.apply(fs.rename, tempd, extpath)
  ],

  // Respond
  function(err) {
    if (err) {
      log.err("Bundle upload error: " + err.message);
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
              log.err("Upload cleanup error: " + err.message);
            }
            callback();
          });
        });
      },
      function(err) {
        log.info("Completed upload cleanup");
      });
    }
    else {
      res.writeHead(204, {});
      res.end();
    }
  });
}

/**
 * Send a requested bundle file
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to write to
 * @param {String} bundle The name of the bundle to read
 * @param {String} file   The name of the file to read
 */
function download(req, res, bundle, file) {
  var fpath = file_path(bundle, file);
  file_or_404(fpath, res, function(stats) {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size
    });
    pumpfileout(fpath, res, function(err) {
      if (err) {
        // The header is already written, there isn't much we can do
        log.err("Error streaming file: " + err);
      }
      // End the response in any case
      res.end();
    });
  });
}

/**
 * Remove a bundle file
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 * @param {String} bundle The name of the bundle to delete from
 * @param {String} file   The name of the file to delete
 */
function remove(req, res, bundle, file) {
  var fpath = file_path(bundle, file);
  file_or_404(fpath, res, function() {
    fs.unlink(fpath, function(err) {
      if (err) {
        return http.return_error(res, 500, "Error removing bundle file: " + err.message);
      }
      res.writeHead(204, {});
      res.end();
    });
  });
}

/**
 * List files within a bundle
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 * @param {String} bundle The name of the bundle to delete from
 */
function list_files(req, res, bundle) {
  var bpath = bundle_path(bundle);
  if (!bpath) {
    return http.return_error(res, 404, "File not found");
  }
  fs.readdir(bpath, function(err, files) {
    if (err) {
      return http.return_error(res, 404, "File not found");
    }

    var filedata = [];

    // Build a list of files in this directory
    async.forEach(files, function(file, callback) {
      var fpath = file_path(bundle, file);

      if (!fpath) {
        return callback();
      }

      fs.stat(fpath, function(err, stats) {
        if (err) {
          log.warning("Error stat-ing file: " + err.message);
        }

        else if (stats.isFile()) {
          // TODO: Do we want anything besides the name of the file?
          filedata.push(file);
        }
        return callback();
      });
    },

    // When all of the files have been checked, return the list
    function(err) {
      return http.return_json(res, 200, filedata);
    });
  });
}

/**
 * List available bundles
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 */
function list_bundles(req, res) {
  var p = path.join(config.get().data_root, "bundles");
  fs.readdir(p, function(err, files) {
    if (err) {
      // This should NOT happen in the course of normal operations
      log.err("Error reading bundle directory: " + err.message);
      return http.return_error(res, 500, "Error reading directory");
    }

    var dirs = [];

    // Build a list of directories in this directory
    async.forEach(files, function(file, callback) {
      var fpath = path.join(p, file);

      fs.stat(fpath, function(err, stats) {
        if (err) {
          log.warning("Error stat-ing file: " + err.message);
        }

        else if (stats.isDirectory()) {
          // TODO: Do we want anything besides the name of the bundle?
          dirs.push(file);
        }
        return callback();
      });
    },

    // Return the list of bundles
    function(err) {
      return http.return_json(res, 200, dirs);
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
