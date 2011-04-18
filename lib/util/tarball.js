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
 * The extractTarball implementation is based heavily on code from NPM:
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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var log = require('util/log');
var config = require('util/config');
var fsutil = require('util/fs');
var misc = require('util/misc');
var norris = require('norris');

exports.extractTarball = function(tarball, target, mode, cb) {
  fs.mkdir(target, mode, function(err) {
    if (err) {
      return cb(err);
    }

    var completed = false;

    function onError(err) {
      completed = true;
      fsutil.rmtree(target, function() {
        return cb(err);
      });
    }

    norris.get(function(facts) {
      var gzip = spawn(config.get()['gzip'], ['--decompress', '--stdout', '-f', tarball]);
      var tar = spawn(facts.gnutar, ['vx', '--file=-', '--strip-components=1', '-C', target]);

      gzip.on('exit', function(code) {
        if (code && !completed) {
          log.err('Error decompressing bundle, gzip exited with code: ' + code);
          try {
            tar.kill();
          }
          catch (err) {
            log.warn('Unable to kill tar: ' + err);
          }
          return onError(new Error('Error decompressing bundle'));
        }
      });

      tar.on('exit', function(code) {
        if (!completed) {
          if (code) {
            return onError(new Error('Error extracting tarball. tar exited with code: ' + code));
          }
          else {
            completed = true;
            cb();
          }
        }
      });

      sys.pump(gzip.stdout, tar.stdin);
    });
  });
};

/**
 * Create a tarball from the specified path.
 *
 * @param {String} sourcePath Path to the directory or the file you want to archive.
 * @param {String} destinationPath Path to the directory where the tarball will be saved.
 * @param {String} tarballName The name of the tarball.
 * @param {Object} options Options object.
 * @param {Function} callback A callback called with a possible error.
 *
 */
exports.createTarball = function(sourcePath, targetPath, tarballName, options, callback) {
  var defaultOptions = {
    deleteIfExists: false,
    ignoreFileChangedError: false,
    excludePattern: '',
    excludeFile: null,
    storeInTarballNameDirectory: true // If true, all the files inside the archive will be stored in a
                                            // directory named tarball_name minus the .tar.gz extension
  };

  options = misc.merge(defaultOptions, options);
  var optionsArray = [];

  var tarballPath = path.join(targetPath, tarballName);

  async.parallel([function(callback) {
      path.exists(sourcePath, function(exists) {
        if (!exists) {
          callback(new Error('Source path does not exist'));
          return;
        }

        callback();
      });
    },

    function(callback) {
       path.exists(targetPath, function(exists) {
        if (!exists) {
          callback(new Error('Target path does not exist'));
          return;
        }

        callback();
      });
    },

    function(callback) {
      path.exists(tarballPath, function(exists) {
        if (exists) {
          if (!options.deleteIfExists) {
            callback(new Error(sprintf('Tarball already exists: %s', tarballPath)));
            return;
          }

          fs.unlink(tarballPath, function(err) {
            if (err) {
              callback(err);
              return;
            }

            callback();
          });
        }

        callback();
      });
    }],

    function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      var baseName = tarballName.replace('.tar.gz', '');

      function handleError(err) {
        fs.unlink(tarballPath, function() {
          callback(err);
          return;
        });
      }

      if (options.excludePattern) {
        optionsArray.push(sprintf('--exclude=%s', options.excludePattern));
      }

      if (options.excludeFile) {
        optionsArray.push(sprintf('--exclude-from=%s', options.excludeFile));
      }

      if (options.storeInTarballNameDirectory) {
        optionsArray.push(sprintf('--transform \'s,^./*,%s/,\'', baseName));
      }

      norris.get(function(facts) {
        var tarcmd = sprintf('%s czpf "%s" -C "%s" --exclude=%s %s .',
                             facts.gnutar, tarballPath, sourcePath, baseName,
                             optionsArray.join(' '));
        var tar = exec(tarcmd, {}, function(err, stdout, stderr) {
          if (err && !(options.ignoreFileChangedError && err.code === 1 && stderr.match(/file changed as we read it/i))) {
            log.err(sprintf('Creating tarball failed: (%s) %s\nCommand was: %s', err.code, stderr, tarcmd));
            return handleError(new Error(sprintf('Creating tarball failed: %s', stderr)));
          }

          log.info(sprintf('Successfully created tarball: %s', tarballName));
          setTimeout(callback, 100);
        });
      });
    }
  );
};


/**
 * Return an array of files and directories in a tarball.
 *
 * @param {String} tarballPath Path to the tarball.
 * @param {Function} callback A callback called with a possible error as the first argument and an array
 *                            with all the files and directories in an archive as the second argument on success.
 *
 */
exports.getTarballFileList = function(tarballPath, callback) {
  var fileList = [];

  norris.get(function(facts) {
    var tarcmd = sprintf('%s tvf "%s"', facts.gnutar, tarballPath);
    var tar = exec(tarcmd, function(err, stdout, stderr) {
      var line, match;

      if (err) {
        callback(err, null);
        return;
      }

      var lines = stdout.split(/\n\r?/g);

      for (var i = 0; i < lines.length; i++) {
        line = lines[i];
        match = line.match(/^.*\s(.*?)$/);

        if (match) {
          fileList.push(match[1].trim());
        }
      }

      callback(null, fileList);
    });
  });
};
