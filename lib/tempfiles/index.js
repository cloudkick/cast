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
var constants = require('constants');

var async = require('async');

var config = require('util/config');
var fsutil = require('util/fs');
var misc = require('util/misc');


/**
 * Manages a directory for temporary files.
 * @constructor
 */
function TempFileManager() {
  var conf = config.get();
  this.root = conf['temp_dir'];
  this.used = {};
}


/**
 * Initialize the temporary file manager. This will remove any existing
 * files in the tmp directory, so it should generally only be called during
 * initialization.
 * @param {Function} callback A callback fired with (err).
 */
TempFileManager.prototype.init = function(callback) {
  var self = this;

  function removeExisting(callback) {
    path.exists(self.root, function(exists) {
      if (exists) {
        fsutil.rmtree(self.root, callback);
      } else {
        callback();
      }
    });
  }

  function recreate(callback) {
    fs.mkdir(self.root, 0700, callback);
  }

  async.series([removeExisting, recreate], callback);
};


/**
 * Retrieve a path for a temporary file.
 * @param {String} extension An optional extension to use for the path.
 * @returns {String} 
 */
TempFileManager.prototype.allocate = function(extension) {
  extension = extension || '';
  var name = '.cast_tmp_' + misc.randstr(8) + extension;

  if (this.used[name]) {
    return this.allocate(extension);
  } else {
    this.used[name] = true;
    return path.join(this.root, name);
  }
};


/**
 * Remove a temporary file (or directory) and free its name for (potential)
 * re-use. You should call this when you are done with a temporary file, even
 * if you have manually deleted or moved the file. Errors aren't practically
 * actionable, so this takes no callback.
 * @param {String} tmpPath The path to the file to remove.
 */
TempFileManager.prototype.free = function(tmpPath) {
  var self = this;
  var name = path.basename(tmpPath);
  fsutil.rmtree(tmpPath, function(err) {
    if (!err) {
      delete this.used[name];
    } else if (err.errno !== constants.EEXIST) {
      log.warn('error delting temporary file: ' + err.message);
    }
  });
};

exports.TempFileManager = TempFileManager;
