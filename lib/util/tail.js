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

var sprintf = require('sprintf').sprintf;
var async = require('async');
var uuid = require('node-uuid');

var log = require('util/log');

/**
 * Return bytesToRead bytes of data from the end of the file and optionally calls the provided callback with the new data
 * as the file is modified and new data is available.
 *
 * @param  {String} filePath Absolute path to a file.
 * @param  {Number} bytesToRead How many bytes from the end of the file to read.
 * @param  {Boolean} follow If true, the provided callback will be continuously called (until un-subscribed) with the new data
 *                          as the file is modified and new data is available (aka tail -F).
 * @param  {Function} callback Callback which is called with an error as the first argument, data with as the second one
 *                              and the un-subscribe function as the third one.
 */
function tailFile(filePath, bytesToRead, follow, callback) {
  var stat, watchFileListener;

  function unsubscribe() {
    stat.removeListener('change', watchFileListener);

    if (Object.keys(stat._events).length === 0) {
      // No more listeners left, unwatch the file
      fs.unwatchFile(filePath);
    }
  }

  /**
   * Read a file.
   *
   * @param {Number} start Start offset.
   * @param {Number} end End offset.
   */
  function readFile(start, end) {
    var fileStream = fs.createReadStream(filePath, {start: start, end: end});

    fileStream.on('data', function(data) {
      callback(null, data, unsubscribe);
    });

    fileStream.on('error', function(err) {
      if (follow) {
        unsubscribe();
      }

      callback(err, null, null);
    });
  }

  watchFileListener = function(curr, prev) {
    var start, end;

    var inodeCurr = curr.ino;
    var inodePrev = prev.ino;

    var sizeCurr = curr.size;
    var sizePrev = prev.size;
    var sizeDiff = sizeCurr - sizePrev;

    var mtimeCurr = curr.mtime.valueOf();
    var mtimePrev = prev.mtime.valueOf();

    if ((inodeCurr !== inodePrev) || (sizeDiff < 0) || (sizeDiff === 0 && mtimeCurr !== mtimePrev)) {
      // Log file was rotated or truncated
      start = 0;
      end = (bytesToRead > sizeCurr) ? sizeCurr : bytesToRead;
    }
    else if (sizeDiff === 0) {
      // No change in the file size (probably file ownership or permissions were changed), ignore this event
      return;
    }
    else {
      start = sizePrev;
      end = sizeCurr;
    }

    readFile(start, end);
  };

  if (follow) {
    stat = fs.watchFile(filePath, watchFileListener);
  }

  fs.stat(filePath, function(err, stats) {
    var start, end;

    if (err) {
      if (follow) {
        unsubscribe();
      }

      callback(err, null, null);
      return;
    }

    start = (bytesToRead >= stats.size) ? 0 : (stats.size - bytesToRead);
    end = stats.size;

    if (end === 0) {
      // Empty file
      callback(null, '', (follow) ? unsubscribe : null);
      return;
    }

    readFile(start, end);
  });
}

exports.tailFile = tailFile;
