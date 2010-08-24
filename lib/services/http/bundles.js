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
var config = require('util/config');
var misc = require('util/misc');
var http = require('util/http');

/**
 * Get the path to a bundle and optional file within the data root. Normalizes
 * the path and verifies that it is within the data root.
 *
 * @param {String} bundle The name of the bundle
 * @param {String} file   The (optional) name of the file
 * @returns The normalized path to the bundle (or file if specified) or null if
 *          the path is not within the data root
 */
function toPath(bundle, file) {
  /* TODO: move the core of this to utils */
  var p;
  var root = config.get().data_root;
  if (bundle && file) {
    p = path.join(root, 'bundles', bundle, file);
  }
  else {
    p = path.join(root, 'bundles', bundle);
  }

  p = path.normalize(p);

  if (p.indexOf(root) !== 0 ) {
    return null;
  }

  return p;
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
 * Stat a path and verify that it is a file which exists. Return a 404 if it
 * doesn't. If it does, fire the given callback with the stat object.
 *
 * @param {String} p  The path to verify
 * @param {http.ServerResponse} res The response to potentially send the 404 to
 * @param {Function} cb An optional callback which takes the stat object as
 *                      its only argument.
 */
function file_or_404(p, res, cb) {
  if (p === null) {
    return http.return_error(res, 404, "File not found");
  }

  fs.stat(p, function (err, stats) {
    if (err || !stats.isFile()) {
      return http.return_error(res, 404, "File not found");
    }
    else if (cb) {
      return cb(stats);
    }
  });
}

/**
 * Write a file from an HTTP stream and fire a callback on success or error.
 *
 * @param {String} dest The path to store the file to
 * @param {http.ServerRequest} istream The HTTP stream to read from
 * @param {Function} cb A callback that takes a possible error
 */
function pumpfilein(dest, istream, cb) {
  var fstream = fs.createWriteStream(dest, {'flags': 'w', 'encoding': 'binary', 'mode': 0644});

  /* We don't want to actually end the HTTP request (the client is supposed to
   * retry the request if that happens), rather we want to simply stop
   * accepting data while we send an error to make the client stop.
   */
  function close_fstream() {
    try {
      fstream.end();
    }
    catch (err) {
      log.err("Unable to close file: " + err.message);
    }
  }

  istream.on('error', function(err) {
    log.err("Error on HTTP stream: " + err.message);
    close_fstream();
    return cb(err);
  });

  fstream.on('error', function(err) {
    log.err("Error on file stream: " + err.message);
    close_fstream();
    return cb(err);
  });

  istream.on('end', function() {
    /* This is not ideal, but sys.pump and the HTTP request don't interact that
     * well together, so this emits a spurious and technically incorrect
     * 'close' event for when the HTTP request body has ended.
     */
    istream.emit('close');
  });

  sys.pump(istream, fstream, function() {
    cb();
  });
}

/**
 * Write a file from an HTTP stream via a temporary file.
 *
 * @param {String} dest The final path to store the file to
 * @param {http.ServerRequest} istream  The HTTP stream to read from
 * @param {Function} cb A callback which takes a possible error
 */
function pumpfilein_via_tempfile(dest, istream, cb) {
  var temp = tempfileInDirectory(dest);
  pumpfilein(temp, istream, function(err) {
    if (err) {
      return cb(err);
    }
    fs.rename(temp, dest, cb);
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
  /* TODO: global configuration of the bufferSize setting */
  var fstream = fs.createReadStream(source, {'bufferSize': 1024 * 64});

  function close_both() {
    try {
      ostream.end();
    }
    catch (err) {
      log.err("Unable to close outgoing HTTP stream: " + err.message);
    }

    try {
      fstream.end();
    }
    catch (err) {
      log.err("Unable to close file: " + err.message);
    }
  }

  ostream.on('error', function(err) {
    close_both();
    return cb(err);
  });

  fstream.on('error', function(err) {
    close_both();
    return cb(err);
  });

  sys.pump(fstream, ostream, function() {
    cb();
  });
}

/**
 * Receive an uploaded bundle file and store it.
 *
 * @param {http.ServerRequest} req  The HTTP request to read from
 * @param {http.ServerResponse} res The HTTP response to respond on
 * @param {String} bundle The name of the bundle to store
 * @param {String} file   The name of the file to store
 */
function upload(req, res, bundle, file) {
  var p = toPath(bundle, file);
  pumpfilein_via_tempfile(p, req, function(err) {
    if (err) {
      return http.return_error(res, 500, "Error storing file: " + err.message);
    }
    res.writeHead(204, {});
    res.end();
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
  var p = toPath(bundle, file);
  return file_or_404(p, res, function(stats) {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stats.size
    });
    pumpfileout(p, res, function(err) {
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
  var p = toPath(bundle, file);
  return file_or_404(p, res, function() {
    fs.unlink(p, function(err) {
      if (err) {
        return http.return_error(res, 500, "Error removing bundle: " + err.message);
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
  res.writeHead(204, {});
  res.end();
}

/**
 * List available bundles
 *
 * @param {http.ServerRequest} req  The HTTP request to respond to
 * @param {http.ServerResponse} res The HTTP response to respond to
 */
function list_bundles(req, res) {
  res.writeHead(204, {});
  res.end();
}

exports.urls = clutch.route([
                              ['PUT /(.+)/(.+)$', upload],
                              ['GET /(.+)/(.+)$', download],
                              ['DELETE /(.+)/(.+)$', remove],
                              ['GET /(.+)/$', list_files],
                              ['GET /$', list_bundles]
                              ]);
