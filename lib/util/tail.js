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

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');
var uuid = require('extern/uuid');

var log = require('util/log');

/**
 * Return bytes_to_read bytes of data from the end of the file and optionally calls the provided callback with the new data
 * as the file is modified and new data is available.
 *
 * @param  {String} file_path Absolute path to a file.
 * @param  {Number} bytes_to_read How many bytes from the end of the file to read.
 * @param  {Boolean} follow If true, the provided callback will be continuously called (until un-subscribed) with the new data
 *                          as the file is modified and new data is available (aka tail -F).
 * @param  {Function} callback Callback which is called with an error as the first argument, data with as the second one
 *                              and the un-subscribe function as the third one.
 */
tail_file = function(file_path, bytes_to_read, follow, callback) {
  var watch_file_listener = function(curr, prev) {
    var start, end;

    var inode_curr = curr.ino;
    var inode_prev = prev.ino;

    var size_curr = curr.size;
    var size_prev = prev.size;
    var size_diff = size_curr - size_prev;

    var mtime_curr = curr.mtime.valueOf();
    var mtime_prev = prev.mtime.valueOf();

    if ((inode_curr !== inode_prev) || (size_diff < 0) || (size_diff === 0 && mtime_curr !== mtime_prev)) {
      // Log file was rotated or truncated
      start = 0;
      end = (bytes_to_read > size_curr) ? size_curr : bytes_to_read;
    }
    else if (size_diff === 0) {
      // No change in the file size (probably file ownership or permissions were changed), ignore this event
      return;
    }
    else {
      start = size_prev;
      end = size_curr;
    }

    read_file(start, end);
  };

  if (follow) {
    var stat = fs.watchFile(file_path, watch_file_listener);
  }

  var unsubscribe = function() {
    stat.removeListener('change', watch_file_listener);

    if (Object.keys(stat._events).length === 0) {
      // No more listeners left, unwatch the file
      fs.unwatchFile(file_path);
    }
  };

  /**
   * Read a file.
   *
   * @param {Number} start Start offset.
   * @param {Number} end End offset.
   */
  var read_file = function(start, end) {
    file_stream = fs.createReadStream(file_path, {start: start, end: end});

    file_stream.on('data', function(data) {
      callback(null, data, unsubscribe);
    });

    file_stream.on('error', function(error) {
      if (follow) {
        unsubscribe();
      }
      callback(error, null, null);
    });
  };

  fs.stat(file_path, function(error, stats) {
    if (error) {
      return callback(error, null, null);
    }

    start = (bytes_to_read >= stats.size) ? 0 : (stats.size - bytes_to_read);
    end = stats.size;

    read_file(start, end);
  });
};

exports.tail_file = tail_file;
