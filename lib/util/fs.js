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
 * The mkdir and rm-rf implementations are based on the ones in NPM:
 *   <http://github.com/isaacs/npm/blob/master/lib/utils/mkdir-p.js>
 *   <http://github.com/isaacs/npm/blob/master/lib/utils/rm-rf.js>
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

var sys = require('sys');
var fs = require('fs');
var path = require('path');
var constants = require('constants');

var async = require('extern/async');

var misc = require('util/misc');

/**
 * Recursively create a directory.
 *
 * @param {String} ensure  The path to recursively create.
 * @param {number} chmod  File permissions to use when creating directories.
 * @param {Function} callback     Callback, taking a possible error.
 */
exports.mkdir = function(ensure, chmod, callback)
{
  if (ensure.charAt(0) !== '/') {
    ensure = path.join(process.cwd(), ensure);
  }

  var dirs = ensure.split('/');
  var walker = [];

  if (arguments.length < 3) {
    callback = chmod;
    chmod = 0755;
  }

  // gobble the "/" first
  walker.push(dirs.shift());

  (function S(d) {

    if (d === undefined) {
      callback();
      return;
    }

    walker.push(d);
    var dir = walker.join('/');

    fs.stat(dir, function(er, s) {

      if (er) {
        fs.mkdir(dir, chmod, function(er, s) {
          if (er && er.message.indexOf('EEXIST') === 0) {
            // When multiple concurrent actors are trying to ensure the same directories,
            // it can sometimes happen that something doesn't exist when you do the stat,
            // and then DOES exist when you try to mkdir.  In this case, just go back to
            // the stat to make sure it's a dir and not a file.
            S('');
            return;
          }
          else if (er) {
            callback(new Error('Failed to make ' + dir + ' while ensuring ' + ensure + '\n' + er.message));
            return;
          }
          S(dirs.shift());
        });
      }
      else {
        if (s.isDirectory()) {
          S(dirs.shift());
        }
        else {
          callback(new Error('Failed to mkdir ' + dir + ': File exists'));
        }
      }
    });
  })(dirs.shift());
};

/**
 * Recursively remove a directory tree. Note that on error this returns
 *
 * @param path  The path to remove (ie, 'rm -rf <path>')
 * @param callback  A callback to be called upon completion with (err)
 */
exports.rmtree = function(p, callback) {
  fs.lstat(p, function(err, stats) {
    if (err) {
      callback(err);
      return;
    }

    // Recursively delete every path within a directory, them rmdir it
    if (stats.isDirectory()) {
      fs.readdir(p, function(err, files) {
        if (err) {
          callback(err);
          return;
        }

        function recurse(file, callback) {
          exports.rmtree(path.join(p, file), callback);
        }

        async.forEach(files, recurse, function(err) {
          if (err) {
            callback(err);
            return;
          }
          fs.rmdir(p, callback);
        });
      });
    }

    // Otherwise just unlink the file
    else {
      fs.unlink(p, callback);
    }
  });
};

var copyTree = function(sourcePath, destinationPath, callback_, errorContext) {
   if (errorContext === undefined) {
    errorContext = {};
    errorContext.hasError = false;
  }

  function callback(err) {
    if (err) {
      errorContext.hasError = true;
    }

    callback_(err);
  }

  fs.lstat(sourcePath, function(err, stats) {
    if (errorContext.hasError) {
      return;
    }

    if (err) {
      callback(new Error('Failed to lstat: ' + err));
      return;
    }

    if (stats.isDirectory()) {
      fs.mkdir(destinationPath, 0755, function(err) {
        if (err && err.errno !== constants.EEXIST) {
          callback(err);
          return;
        }

        fs.readdir(sourcePath, function(err, files) {
          if (errorContext.hasError) {
            return;
          }

          if (err) {
            callback(err);
            return;
          }

          var count = files.length;
          var n = 0;
          function dirdone(err) {
            if (errorContext.hasError) {
              return;
            }

            if (err) {
              callback(err);
            }
            else {
              n++;
              if (n >= count) {
                callback(err);
              }
            }
          }

          if (count === 0) {
            dirdone();
          }
          else {
            files.forEach(function(file) {
              if (errorContext.hasError) {
                return;
              }

              copyTree(path.join(sourcePath, file), path.join(destinationPath, file), dirdone, errorContext);
            });
          }
        });
      });
    }
    else {
      exports.copyFile(sourcePath, destinationPath, function(err) {
        if (errorContext.hasError) {
          return;
        }

        callback(err);
        return;
      });
    }
  });
};

/**
 * Recursivly copy a directory.
 *
 * @param {String} source_path Source path.
 * @param {String} target_path Target path.
 * @param {Function} callback Callback which is called with a possible error.
 */
exports.copyTree = function(sourcePath, destinationPath, callback) {
  sourcePath = (sourcePath.charAt(sourcePath.length - 1) === '/') ? sourcePath : sourcePath + '/';
  destinationPath = (destinationPath.charAt(destinationPath.length - 1) === '/') ? destinationPath :
                      destinationPath + '/';

  if (destinationPath.indexOf(sourcePath) === 0) {
    callback(new Error('Destination path is inside a source path'));
    return;
  }

  fs.stat(sourcePath, function(err, stats) {
    if (err) {
      callback(err);
      return;
    }

    if (!stats.isDirectory()) {
      callback(new Error('Source path must be a directory'));
      return;
    }

    copyTree(sourcePath, destinationPath, callback);
  });
};

/**
 * Copy a file.
 *
 * @param {String} source_path Source path.
 * @param {String} destination_path Destination path.
 * @param {Function} callback Callback which is called with a possible error.
 */
exports.copyFile = function(sourcePath, destinationPath, callback) {
  var config = require('util/config');

  fs.stat(sourcePath, function(err, stats) {
    if (err) {
      callback(err);
      return;
    }

    if (stats.isDirectory()) {
      callback(new Error('Source path must be a file'));
      return;
    }

    var reader = fs.createReadStream(sourcePath, { 'bufferSize': config.get()['fileread_buffer_size'] });
    var writer = fs.createWriteStream(destinationPath);

    sys.pump(reader, writer, callback);
  });
};

/**
 * Return an array of files and directories matching a provided pattern.
 *
 * @param {String} directory_path Full path to a directory.
 * @param {String} match_pattern Regular expression match pattern.
 * @param {Boolean} exclude_directories If true, directories will not be included in the result.
 * @param {Function} callback Callback which is called with a possible error as the first argument and
 *                            array of files matching a pattern as the second one on success.
 */
exports.getMatchingFiles = function(directoryPath, matchPattern, excludeDirectories, callback) {
  var filterRegex;
  var files = [];

  try {
    filterRegex = new RegExp(matchPattern);
  }
  catch (err) {
    callback(err);
    return;
  }

  var filterFile = function(file, callback) {
    var filePath = path.join(directoryPath, file);

    fs.lstat(filePath, function(err, stats) {
      if (err) {
        callback(false);
        return;
      }

      if (excludeDirectories && stats.isDirectory()) {
        callback(false);
        return;
      }

      if (!file.match(filterRegex)) {
        callback(false);
        return;
      }

      callback(true);
      return;
    });
  };

  fs.readdir(directoryPath, function(err, files) {
    if (err) {
      callback(err);
      return;
    }

    async.filter(files, filterFile, function(results) {
      callback(null, results);
    });
  });
};

/**
 * Converts an object to a directory tree, where objects are treated as
 * directories and anything else is dumped to a regular file as a string.
 *
 * @param {String} basedir  The path to the tree's (not-yet-existing) root.
 * @param {Object} template  The object to use as a template.
 * @param {Boolean} ignore_existing If true, function won't return callback
 *                                  with an error when encountering
 *                                  a directory which already exists.
 * @param {Function} cb     Callback, taking a possible error.
 */
exports.templateToTree = function(basedir, template, ignoreExisting, cb) {
  fs.mkdir(basedir, 0700, function(err) {
    if (err) {
      if (!(ignoreExisting && err.errno === constants.EEXIST)) {
        return cb(err);
      }
    }

    var actions = [];

    function recurseAction(basedir, key) {
      var curpath = path.join(basedir, key);
      return function(callback) {
        // Recurse on sub-templates
        if (typeof(template[key]) === 'object') {
          exports.templateToTree(curpath, template[key], ignoreExisting, callback);
        }
        // Render anything else to files
        else {
          fs.open(curpath, 'w', 0700, function(err, fd) {
            if (err) {
              callback(err);
            }
            else {
              fs.write(fd, template[key].toString(), null, 'ascii', function(err, written) {
                fs.close(fd);
                callback(err);
              });
            }
          });
        }
      };
    }

    // Build a list of actions to fill in this level of the tree
    for (var key in template) {
      if (template.hasOwnProperty(key)) {
        actions.push(recurseAction(basedir, key));
      }
    }

    // Execute the action sequence
    async.parallel(actions, function(err) {
      cb(err);
    });
  });
};


/**
 * Return object with all the directory names as keys which can be used with the template_to_tree function.
 *
 * @param {String} source_path Full path to a directory.
 * @param {Array} ignored_paths Which paths relative to the source_path to skip (path name must contain a trailing
 *                               slash).
 * @param {Function} callback Callback which is called with a possible error as the first argument and
 *                            template object as the second one on success.
 */
exports.treeToTemplate = function(sourcePath, ignoredPaths, callback) {
  var directoryTreeObject = {};

  function walkDirectory(directoryPath, ref, callback_) {
    fs.readdir(directoryPath, function(err, files) {
      if (err) {
        callback_(err);
        return;
      }

      async.forEach(files, function(file, callback) {
        var currentPath = path.join(directoryPath, file);
        var relativePath = currentPath.replace(sourcePath + '/', '');
        var currRef;

        fs.stat(currentPath, function(err, stats) {
          if (err) {
            callback(err);
            return;
          }

          if (!stats.isDirectory()) {
            callback();
            return;
          }

          // Skip ignored path
          if (misc.inArray(relativePath + '/', ignoredPaths)) {
            callback();
            return;
          }

          ref[file] = {};
          currRef = ref[file];

          walkDirectory(currentPath, currRef, callback);
        });
      },

      function(err) {
        if (err) {
          callback_(err);
          return;
        }

        callback_();
      });
    });
  }

  walkDirectory(sourcePath, directoryTreeObject, function(err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, directoryTreeObject);
  });
};

/**
 * Create a hardlink in the target path to a file in the source path for all the files in the source path file tree.
 *
 * @param {String} source_path Source path.
 * @param {String} target_path Target path.
 * @param {Array} ignored_paths Which paths relative to the source_path to skip (if a path is a directory, it must
 *                              include a trailing slash).
 * @param {Function} callback Callback which is called with a possible error as a first argument.
 */
exports.hardLinkFiles = function(sourcePath, targetPath, ignoredPaths, callback) {
  function walkDirectory(directoryPath, callback_) {
    fs.readdir(directoryPath, function(err, files) {
      if (err) {
        callback_(err);
        return;
      }

      async.forEach(files, function(file, callback) {
        var sourceFilePath = path.join(directoryPath, file);

        var currentDirectory = directoryPath.replace(sourcePath, '');
        var currentPath = path.join(currentDirectory, file).substr(1);
        var targetFilePath = path.join(targetPath, currentDirectory, file);

        fs.stat(sourceFilePath, function(err, stats) {
          if (err) {
            callback(err);
            return;
          }

          if (stats.isDirectory()) {
            currentPath = currentPath + '/';
          }

          // Skip ignored paths
          if (misc.inArray(currentPath, ignoredPaths)) {
            callback();
            return;
          }

          if (stats.isDirectory()) {
            return walkDirectory(sourceFilePath, callback);
          }

          fs.link(sourceFilePath, targetFilePath, function(err) {
            if (err) {
              callback(err);
              return;
            }

            callback();
          });
        });
      },

      function(err) {
        if (err) {
          callback_(err);
          return;
        }

        callback_();
      });
    });
  }

  walkDirectory(sourcePath, function(err) {
    callback(err);
  });
};

/**
 * Create a symbolic links for the specified paths.
 *
 * @param {Array} paths Array of tuples where the first item is a source path and the second one is a destination path.
 * @param {Boolean} create_missing_paths true to create the missing paths.
 * @param {Function} callback Callback which is called with a possible error.
 */
exports.symbolicLinkFiles = function(paths, createMissingPaths, callback) {
  async.forEach(paths, function(filePath, callback) {
    var destinationDirectory;

    var sourcePath = filePath[0];
    var destinationPath = filePath[1];

    // Remove trailing slash (if it exists)
    if (destinationPath.charAt(destinationPath.length - 1) === '/') {
      destinationPath = destinationPath.substr(0, (destinationPath.length - 1));
    }

    destinationDirectory = path.dirname(destinationPath);

    path.exists(destinationDirectory, function(exists) {
      if (!exists) {
        if (!createMissingPaths) {
          callback(new Error('Cannot create a symbolic link, because a destination directory does not exist'));
        }
        else {
          exports.mkdir(destinationDirectory, 0755, function(err) {
            if (err) {
              callback(err);
              return;
            }

            fs.symlink(sourcePath, destinationPath, callback);
          });
        }
      }
      else {
        fs.symlink(sourcePath, destinationPath, callback);
      }
    });
  },

  function(err) {
    if (err) {
      callback(err);
      return;
    }

    callback();
  });
};

/**
 * Change the owner for the specified paths.
 *
 * @oaram {Array} Array of triples where the first item is the full path to a file / directory,
 *                second one is a user id and the third one is a group id
 * @param {Function} callback Callback which is called with a possible error.
 *
 */
exports.chownPaths = function(paths, callback) {
  var filePath, uid, gid;

  async.forEach(paths, function(item, callback) {
    filePath = item[0];
    uid = item[1];
    gid = item[2];

    fs.chown(filePath, uid, gid, callback);
  },

  function(error) {
    callback(error);
  });
};

/**
 * Make sure a directory exists, create it (non recursively) if not. The
 * callback takes an error which will occur if creation fails, the path
 * already exists and is not a directory, or stat-ing the file fails for
 * whatever reason.
 *
 * @param {String} p  The path to the directory to ensure.
 * @param {Function} callback The callback which takes a possible error.
 */
exports.ensureDirectory = function(p, callback) {
  path.exists(p, function(exists) {
    if (exists) {
      fs.stat(p, function(err, stats) {
        if (err) {
          callback(err);
          return;
        }
        else if (!stats.isDirectory()) {
          callback(new Error('Path exists and is not a directory: ' + p));
          return;
        }
        else {
          callback();
          return;
        }
      });
    }
    else {
      fs.mkdir(p, 0755, function(err) {
        if (err && err.errno === constants.EEXIST) {
          exports.ensureDirectory(p, callback);
        }
        else {
          callback(err);
        }
      });
    }
  });
};

/**
 * Reads a JSON format file off of disk.
 *
 * @param {String} path The path to read from.
 * @param {Function} callback The callback which takes a possible error, second parameter is the json object.
 */
exports.jsonFile = function(path, callback)
{
  var readStream = fs.createReadStream(path);
  var dataBuffer = [];

  function endCallback()
  {
    var data = dataBuffer.join('');
    var obj = null;
    try {
      obj = JSON.parse(data);
    }
    catch (err) {
      callback(new Error('File ' + path + ' contains invalid JSON: ' + err), null);
      return;
    }
    callback(null, obj);
    return;
  }

  readStream.on('data', function(chunk) {
    dataBuffer.push(chunk);
  });

  readStream.on('error', function(error) {
    readStream.removeAllListeners('data');
    readStream.removeAllListeners('end');
    readStream.removeAllListeners('error');
    callback(error, null);
  });

  readStream.on('end', endCallback);
};
