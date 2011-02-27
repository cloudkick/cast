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
 * Configuration subsytem, providing a set of defaults, and merging of a configuration
 * JSON file.
 */

var fs = require('fs');
var path = require('path');

var async = require('extern/async');

var client_config = require('util/config');
var misc = require('util/misc');
var ufs = require('util/fs');
var expanduser = require('util/misc').expanduser;
var fsutil = require('util/fs');


/**
 * The path to the dot cast directory (currently ~/.cast)
 */
var dot_cast = exports.dot_cast_path = misc.expanduser('~/.cast');

/**
 * The path to the remotes.json file in the dot cast directory
 */
var dot_cast_remotes = exports.dot_cast_remotes_path = path.join(dot_cast, 'remotes.json');

/**
 * Get the path to the cast project directory for a project
 *
 * @param {String} projectpath  The path to the root of the project.
 */
exports.dot_cast_project_path = function(projectpath) {
  return path.join(projectpath, '.cast-project');
};

/**
 * Create the user's ~/.cast directory if it doesn't exist.
 *
 * @param {Function} callback A callback fired with a possible error.
 */
exports.ensure_dot_cast = function(callback) {
  fsutil.ensure_directory(dot_cast, callback);
};

/**
 * Creates a dot cast project directory if it doesn't exist.
 *
 * @param {String} projectpath The path to the project.
 * @param {Function} callback A callback fired upon completion with (err, dot_cast_project_path).
 */
exports.ensure_dot_cast_project = function(projectpath, callback) {
  var dot_cast_project_path = exports.dot_cast_project_path(projectpath);
  fsutil.ensure_directory(dot_cast_project_path, function(err) {
    return callback(err, dot_cast_project_path);
  });
};

/**
 * Get the remotes object which will default to an empty object if
 * the remotes file doesn't exist.
 *
 * @param {Function} callback A callback fired with (err, remotes).
 */
exports.get_remotes = function(callback) {
  path.exists(dot_cast_remotes, function(exists) {
    if (!exists) {
      return callback(null, {});
    }
    fs.stat(dot_cast_remotes, function(err, stats) {
      if (err) {
        return callback(err);
      }
      else if (!err && !stats.isFile()) {
        return callback(new Error(dot_cast_remotes + ' exists but is not a file'));
      }

      ufs.json_file(dot_cast_remotes, function(err, remotes) {
        if (err) {
          callback(err);
        }
        else {
          callback(null, remotes);
        }
      });
    });
  });
};

/**
 * Get a remote by name, or the default if the name evaluates to false.
 *
 * @param {String} remote_name The name of the remote to retrieve
 * @param {Function} callback A callback called with (remote, err)
 */
exports.get_remote = function(remote_name, callback) {
  if (remote_name) {
    exports.get_remotes(function(err, remotes) {
      if (err) {
        callback(err);
      }
      else if (!remotes.hasOwnProperty(remote_name)) {
        callback(new Error("No such remote: " + remote_name));
      }
      else {
        callback(null, remotes[remote_name]);
      }
    });
  }
  else {
    exports.get_default_remote(callback);
  }
};

/*
 * Return a default remote.
 *
 * If a remotes file does not exist or there is a no default remote, callback will be called with null as
 * the second argument.
 *
 * @param {Function} callback Callback which is called with an error as the first argument and remote object
 *                            as the second one if a default remote is found.
 */
exports.get_default_remote = function(callback) {
  var remote, default_remote;
  exports.get_remotes(function(err, remotes) {
    if (err) {
      callback(err);
      return;
    }

    if (Object.keys(remotes) === 0) {
      callback(null, null);
      return;
    }

    function is_default(item, callback) {
      remote = remotes[item];

      if (remote.is_default === true) {
        callback(true);
        return;
      }

      callback(false);
    }

    async.filter(Object.keys(remotes), is_default, function(results) {
      if (!results) {
        // No default remote found
        return callback(new Error('No default remote found'));
      }

      // In case there are multi default remotes found, always return only one
      default_remote = results[0];
      callback(null, remotes[default_remote]);
    });
  });
};

/**
 * Given the name of a bundle and the root of a project, get the path to the
 * bundle.
 *
 * @param {String} project_root Path to the project root
 * @param {String} bundle_name  The name of the bundle
 * @return {String} The path to the bundle file
 */
exports.get_bundle_path = function(project_root, bundle_name) {
  var dot_cast_project_path = exports.dot_cast_project_path(project_root);
  var bundle_file = bundle_name + '.tar.gz';
  return path.join(dot_cast_project_path, 'tmp', bundle_file);
};

/**
 * Get a list of (presumably bundle) files in the tmp directory
 *
 * @param {String} project_root Path to the project root
 * @param {Function} callback   A callback that takes (err, bundles)
 */
exports.list_bundles = function(project_root, callback) {
  var dot_cast_project_path = exports.dot_cast_project_path(project_root);
  var bundledir = path.join(dot_cast_project_path, 'tmp');

  fs.readdir(bundledir, function(err, files) {
    var msg, bundles;

    if (err) {
      msg = 'Unable to read ' + bundledir + ', have you created a bundle yet?';
      return callback(new Error(msg));
    }

    // Eliminate anything that doesn't look right
    files = files.filter(function(file) {
      return file.match(/.*@.*\.tar\.gz$/);
    });

    // Strip extensions
    bundles = files.map(function(file) {
      return path.basename(file, '.tar.gz');
    });

    return callback(null, bundles);
  });
};

/**
 * Get the name of the newest bundle in the tmp directory. Note that 'newest'
 * in this case is determined by mtime on the file, not the version string.
 *
 * @param {String} project_root The root of the project
 * @param {Function} callback   A callback that takes (err, bundle)
 */
exports.get_newest_bundle = function(project_root, callback) {
  exports.list_bundles(project_root, function(err, bundles) {
    var newestbundle;
    var newestmtime;
    var size;

    if (err) {
      return callback(err);
    }

    async.forEach(bundles, function(bundle, callback) {
      var bundlepath = exports.get_bundle_path(project_root, bundle);
      fs.stat(bundlepath, function(err, stats) {
        if (!err && stats.isFile() && (!newestmtime || stats.mtime > newestmtime)) {
          newestmtime = stats.mtime;
          newestbundle = bundle;
          size = stats.size;
        }
        return callback();
      });
    },
    function(err) {
      var msg;
      if (!err && !newestbundle) {
        msg = 'No bundles found, have you created one yet?';
        err = new Error(msg);
      }
      return callback(err, newestbundle);
    });
  });
};
