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
 *
 *
 * The pump implementation contained herein is based on that in node:
 * <https://github.com/ry/node/blob/master/lib/util.js>
 *
 * Copyright 2009, 2010 Ryan Lienhart Dahl. All rights reserved.  Permission is
 * hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

var log = require('util/log');
var config = require('util/config');
var fs = require('fs');
var sys = require('sys');
var crypto = require('crypto');

/**
 * Write a file from an HTTP stream and fire a callback on success or error.
 *
 * @param {String} dest The path to store the file to.
 * @param {http.ServerRequest} istream The HTTP stream to read from.
 * @param {Array} received  An array of buffers that have already been received.
 * @param {Boolean} completed Whether the request has already ended.
 * @param {Function} cb A callback that takes (err, sha1).
 */
exports.pumpfilein = function(dest, istream, received, completed, cb) {
  var fstream = fs.createWriteStream(dest, {'flags': 'w', 'encoding': 'binary', 'mode': 0644});
  var sha1 = crypto.createHash('sha1');

  function closeFstream() {
    try {
      fstream.end();
    }
    catch (err) {
      log.err('Unable to close file: ' + err.message);
    }
  }

  fstream.on('error', function(err) {
    log.err('Error on file stream: ' + err.message);
    closeFstream();
    return cb(err);
  });

  function writeReceived() {
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
      cb(null, sha1);
      return;
    });

    writeReceived();
    fstream.end();
    return;
  }

  istream.on('end', function() {
    /* This is not ideal, but sys.pump and the HTTP request don't interact that
     * well together, so this emits a spurious and technically incorrect
     * 'close' event for when the HTTP request body has ended.
     */
    cb(null, sha1);
  });

  istream.on('data', function(data) {
    sha1.update(data);
  });

  writeReceived();
  istream.pipe(fstream, { end: false });
};

/**
 * Write a file to an HTTP stream. Does not write headers, trailers, etc.
 *
 * @param {String} source The path to read the file from.
 * @param {http.ServerResponse} ostream The HTTP Stream to write the file to.
 * @param {Function} tick An optional callback that is fired each time data is
 *                        written and takes the total number of bytes written.
 * @param {Function} callback A callback which takes (err, sha1);.
 */
exports.pumpfileout = function(source, ostream, tick, callback) {
  var conf = config.get();
  var completed = false;
  var sha1 = crypto.createHash('sha1');
  var fstream = fs.createReadStream(source, {'bufferSize': conf['fileread_buffer_size']});
  var bytes = 0;

  if (!callback) {
    callback = tick;
    tick = false;
  }

  /**
   * Call a 'tick' function every time we send something
   * TODO: It would be neat to follow the pipe chain down and only call this
   *       for data written to the socket. This could smooth out the https
   *       progress bar.
   */
  if (tick) {
    fstream.on('data', function(data) {
      bytes += data.length;
      sha1.update(data);
      tick(bytes);
    });
  }

  fstream.on('end', function() {
    completed = true;
    callback(null, sha1);
    return;
  });

  fstream.on('error', function(err) {
    completed = true;
    callback(err);
    return;
  });

  fstream.pipe(ostream, { end: false});
};
