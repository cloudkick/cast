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

var fs = require('fs');
var path = require('path');

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
      return callback();
    }

    walker.push(d);
    var dir = walker.join('/');

    fs.stat(dir, function(er, s) {

      if (er) {
        fs.mkdir(dir, chmod, function(er, s) {
          if (er) {
            return callback(new Error('Failed to make ' + dir + ' while ensuring ' + ensure + '\n' + er.message));
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


function rmtree_(p, callback_, error_context) {
  if (!p) {
    return callback_(new Error('Trying to rm nothing?'));
  }

  if (error_context === undefined) {
    error_context = {};
    error_context.has_error = false;
  }

  function callback(err) {
    if (err) {
      error_context.has_error = true;
    }
    callback_(err);
  }

  fs.lstat(p, function(er, s) {
    if (error_context.has_error) {
      return;
    }

    if (er) {
      return callback(new Error('Failed to lstat: ' + er));
    }

    if (s.isDirectory()) {
      fs.readdir(p, function(er, files) {
        if (error_context.has_error) {
          return;
        }

        if (er) {
          return callback(er);
        }

        var count = files.length;
        var n = 0;
        function dirdone(err) {
          if (error_context.has_error) {
            return;
          }
          if (err) {
            callback(err);
          }
          else {
            n++;
            if (n >= count) {
              fs.rmdir(p, function(err) {
                if (error_context.has_error) {
                  return;
                }
                callback(err);
              });
            }
          }
        }

        if (count === 0) {
          dirdone();
        }
        else {
          files.forEach(function(file) {
            if (error_context.has_error) {
              return;
            }
            rmtree_(path.join(p, file), dirdone, error_context);
          });
        }
      });
    }
    else {
      fs.unlink(p, function(er) {
        if (error_context.has_error) {
          return;
        }
        return callback(er);
      });
    }
  });
}

/**
 * Deletes an entire tree off the filesystem, first removing all files,
 * and then deleting the directories.
 *
 * @param {String} p  The path to recursively delete.
 * @param {Function} callback_     Callback on finish, taking a possible error.
 * @return {Undefined} No return value, uses callack.
 */
exports.rmtree = function(p, callback_) {
  return rmtree_(p, callback_);
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
exports.get_matching_files = function(directory_path, match_pattern, exclude_directories, callback) {
  var files = [];

  try {
    var filter_regex = new RegExp(match_pattern);
  }
  catch (err) {
    callback(err);
    return;
  }

  var filter_file = function(file, callback) {
    var file_path = path.join(directory_path, file);

    fs.lstat(file_path, function(err, stats) {
      if (err) {
        callback(false);
        return;
      }

      if (exclude_directories && stats.isDirectory()) {
        callback(false);
        return;
      }

      if (!file.match(filter_regex)) {
        callback(false);
        return;
      }

      callback(true);
      return;
    });
  };

  fs.readdir(directory_path, function(err, files) {
    if (err) {
      callback(err);
      return;
    }

    async.filter(files, filter_file, function(results) {
      callback(null, results);
    });
  });
};

/**
 * Return object with all the directory names as keys which can be used with the template_to_tree function.
 *
 * @param {String} source_path Full path to a directory.
 * @param {Function} callback Callback which is called with a possible error as the first argument and
 *                            template object as the second one on success.
 */
exports.get_directory_tree_as_template_object = function(source_path, callback) {
  var directory_tree_object = {};

  function walk_directory(directory_path, ref, callback_) {
    fs.readdir(directory_path, function(err, files) {
      if (err) {
        callback_(err);
        return;
      }

      async.forEach(files, function(file, callback) {
        var current_path = path.join(directory_path, file);
        var curr_ref;

        fs.stat(current_path, function(err, stats) {
          if (err) {
            callback(err);
            return;
          }

          if (!stats.isDirectory()) {
            callback();
            return;
          }

          ref[file] = {};
          curr_ref = ref[file];

          walk_directory(current_path, curr_ref, callback);
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

  walk_directory(source_path, directory_tree_object, function(err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, directory_tree_object);
  });
};

/**
 * Create a hardlink in the target path to a file in the source path for all the files in the source path file tree.
 *
 * @param {String} source_path Source path.
 * @param {String} target_path Target path.
 * @param {Array} ignored_paths Which paths to skip.
 * @param {Function} callback Callback which is called with a possible error as a first argument.
 */
exports.hard_link_files = function(source_path, target_path, ignored_paths, callback) {
  function walk_directory(directory_path, callback_) {
    fs.readdir(directory_path, function(err, files) {
      if (err) {
        return callback_(err);
      }

      async.forEach(files, function(file, callback) {
        var source_file_path = path.join(directory_path, file);

        var current_directory = directory_path.replace(source_path, '');
        var current_path = path.join(current_directory, file).substr(1);
        var target_file_path = path.join(target_path, current_directory, file);

        if (misc.in_array(current_path, ignored_paths)) {
          return callback();
        }

        fs.stat(source_file_path, function(err, stats) {
          if (err) {
            return callback(err);
          }

          if (stats.isDirectory()) {
            return walk_directory(source_file_path, callback);
          }

          fs.link(source_file_path, target_file_path, function(err) {
            if (err) {
              return callback(err);
            }

            callback();
          });
        });
      },

      function(err) {
        if (err) {
          return callback_(err);
        }

        callback_();
      });
    });
  }

  walk_directory(source_path, function(err) {
    callback(err);
  });
};

/**
 * Create a symbolic links for the specified paths.
 *
 * @param {Array} paths Array of tuples where the first item is a source path and the second one is
 *                      a destination path.
 * @param {Function} callback Callback which is called with a possible error.
 */
exports.symbolic_link_files = function(paths, callback) {
  var source_path, destination_path;

  async.forEach(paths, function(path, callback) {
    source_path = path[0];
    destination_path = path[1];

    fs.symlink(source_path, destination_path, callback);
  },

  function(err) {
    if (err) {
      return callback(err);
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
exports.chown_paths = function(paths, callback) {
  var file_path, uid, guid;

  async.forEach(paths, function(item, callback) {
    file_path = item[0];
    uid = item[1];
    gid = item[2];

    fs.chown(file_path, uid, gid, callback);
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
exports.ensure_directory = function(p, callback) {
  path.exists(p, function(exists) {
    if (exists) {
      fs.stat(p, function(err, stats) {
        if (err) {
          return callback(err);
        }
        else if (!stats.isDirectory()) {
          return callback(new Error('Path exists and is not a directory: ' + p));
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
};
