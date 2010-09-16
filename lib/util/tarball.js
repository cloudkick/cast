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

/**
 * The extract_tarball implementation is based heavily on code from NPM:
 *
 *   <http://github.com/isaacs/npm/blob/master/lib/utils/exec.js>
 *
 * Copyright 2009, 2010 Isaac Zimmitti Schlueter. All rights reserved.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */


var fs = require('fs');
var sys = require('sys');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var log = require('util/log');
var config = require('util/config');
var fsutil = require('util/fs');
var misc = require('util/misc');

exports.extract_tarball = function(tarball, target, mode, cb) {
  fs.mkdir(target, mode, function(err) {
    if (err) {
      return cb(err);
    }

    var completed = false;

    function on_error(err) {
      completed = true;
      fsutil.rmtree(target, function() {
        return cb(err);
      });
    }

    var gzip = spawn(config.get().gzip, ['--decompress', '--stdout', '-f', tarball]);
    var tar = spawn(config.get().tar, ['vx', '--strip-components=1', '-C', target]);

    gzip.on('exit', function(code) {
      if (code && !completed) {
        log.err('Error decompressing bundle, gzip exited with code: ' + code);
        try {
          tar.kill();
        }
        catch (err) {
          log.warn('Unable to kill tar: ' + err);
        }
        return on_error(new Error('Error decompressing bundle'));
      }
    });

    tar.on('exit', function(code) {
      if (!completed) {
        if (code) {
          return on_error(new Error('Error extracting tarball'));
        }
        else {
          completed = true;
          cb();
        }
      }
    });

    sys.pump(gzip.stdout, tar.stdin);
  });
};

/**
 * Create a tarball from the specified path.
 *
 * @param {String} source_path Path to the directory or the file you want to archive.
 * @param {String} destination_path Path to the directory where the tarball will be saved.
 * @param {String} tarball_name The name of the tarball.
 * @param {Object} options Options object.
 * @param {Function} callback A callback called with a possible error.
 *
 */
exports.create_tarball = function(source_path, target_path, tarball_name, options, callback) {
  var default_options = {
    'delete_if_exists': false,
    'ignore_file_changed_error': false,
    'exclude_pattern': '',
    'store_in_tarball_name_directory': true // If true, all the files inside the archive will be stored in a
                                            // directory named tarball_name minus the .tar.gz extension
  };

  options = misc.merge(default_options, options);
  var options_array = [];

  var tarball_path = path.join(target_path, tarball_name);

  async.parallel([function(callback) {
      path.exists(source_path, function(exists) {
        if (!exists) {
          return callback(new Error('Source path does not exist'));
        }

        callback();
      });
    },

    function(callback) {
       path.exists(target_path, function(exists) {
        if (!exists) {
          return callback(new Error('Target path does not exist'));
        }

        callback();
      });
    },

    function(callback) {
      path.exists(tarball_path, function(exists) {
        if (exists) {
          if (!options.delete_if_exists) {
            return callback(new Error(sprintf('Tarball already exists: %s', tarball_path)));
          }

          fs.unlink(tarball_path, function(error) {
            if (error) {
              return callback(error);
            }

            callback();
          });
        }

        callback();
      });
    }],

    function(error, results) {
      if (error) {
        return callback(error);
      }

      var base_name = tarball_name.replace('.tar.gz', '');

      function handle_error(error) {
        fs.unlink(tarball_path, function() {
          return callback(error);
        });
      }

      if (options.exclude_pattern) {
        options_array.push(sprintf('--exclude %s', options.exclude_pattern));
      }

      if (options.store_in_tarball_name_directory) {
        options_array.push(sprintf('--transform \'s,^./*,%s/,S\'', base_name));
      }

      var tarcmd = sprintf('%s czpf "%s" -C "%s" --exclude=%s %s .', config.get().tar, tarball_path, source_path, base_name, options_array.join(' '));
      var tar = exec(tarcmd, {}, function(error, stdout, stderr) {
        if (error && !(options.ignore_file_changed_error && error.code === 1 && stderr.match(/file changed as we read it/i))) {
          log.err(sprintf('Creating tarball failed: (%s) %s\nCommand was: %s', error.code, stderr, tarcmd));
          return handle_error(new Error(sprintf('Creating tarball failed: %s', stderr)));
        }

        log.info(sprintf('Successfully created tarball: %s', tarball_name));
        callback();
      });
    }
  );
};


/**
 * Return an array of files and directories in a tarball.
 *
 * @param {String} tarball_path Path to the tarball.
 * @param {Function} callback A callback called with a possible error as the first argument and an array
 *                            with all the files and directories in an archive as the second argument on success.
 *
 */
exports.get_tarball_file_list = function(tarball_path, callback) {
  var file_list = [];

  var tarcmd = sprintf('%s tvf "%s"', config.get().tar, tarball_path);
  var tar = exec(tarcmd, function(error, stdout, stderr) {
    var line, match;

    if (error) {
      return callback(error, null);
    }

    var lines = stdout.split(/\n\r?/g);

    for (var i = 0; i < lines.length; i++) {
      line = lines[i];
      match = line.match(/^.*\s(.*?)$/);

      if (match) {
        file_list.push(match[1].trim());
      }
    }

    callback(null, file_list);
  });
};
