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

var log = require('util/log');
var config = require('util/config');
var fs = require('fs');
var sys = require('sys');
var crypto = require('crypto');

/**
 * Write a file from an HTTP stream and fire a callback on success or error.
 *
 * @param {String} dest The path to store the file to
 * @param {http.ServerRequest} istream The HTTP stream to read from
 * @param {Array} received  An array of buffers that have already been received
 * @param {Boolean} completed Whether the request has already ended
 * @param {Function} cb A callback that takes a possible error
 */
exports.pumpfilein = function(dest, istream, received, completed, cb) {
  var fstream = fs.createWriteStream(dest, {'flags': 'w', 'encoding': 'binary', 'mode': 0644});
  var sha1 = crypto.createHash('sha1');

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
      sha1.update(received[i]);
      fstream.write(received[i]);
    }
  }

  /* If the request has already been completed, we don't need to actually use
   * the pump.
   */
  if (completed) {
    fstream.on('close', function() {
      return cb(null, sha1);
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
    sha1.update(data);
  });

  write_received();

  sys.pump(istream, fstream, function() {
    cb(null, sha1);
  });
};

/**
 * Write a file to an HTTP stream. Does not write the headers.
 *
 * @param {String} source The path to read the file from
 * @param {http.ServerResponse} ostream The HTTP Stream to write the file to
 * @param {Function} tick An optional callback that is fired each time data is
 *                        written and takes the total number of bytes written.
 * @param {Function} cb A callback which takes a possible error
 */
exports.pumpfileout = function(source, ostream, tick, cb) {
  if (!cb) {
    cb = tick;
    tick = function() {};
  }

  var bytes = 0;
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

  fstream.on('data', function(data) {
    bytes += data.length;
    tick(bytes);
  });

  fstream.on('open', function() {
    sys.pump(fstream, ostream, function() {
      cb();
    });
  });
};
