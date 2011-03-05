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
var utilfs = require('util/fs');
var expanduser = require('util/misc').expanduser;
var fsutil = require('util/fs');

/**
 * Name of the client private key file
 * @type {String}
 */
var CLIENT_KEYFILE_NAME = 'cast.key';

/**
 * Name of the client x509 cert file
 * @type {String}
 */
var CLIENT_CRTFILE_NAME = 'cast.crt';

/**
 * Get the path to the client private key
 * @return {String} Path to the client private key
 */
exports.getClientKeyPath = function() {
  return path.join(exports.dot_cast_path, CLIENT_KEYFILE_NAME);
};

/**
 * Get the path to the client x509 certificate
 * @return {String} Path to the client certificate
 */
exports.getClientCertPath = function() {
  return path.join(exports.dot_cast_path, CLIENT_CRTFILE_NAME);
};

/**
 * The path to the dot cast directory (currently ~/.cast)
 */
var dot_cast = exports.dot_cast_path = misc.expanduser('~/.cast');

/**
 * The path to the remotes.json file in the dot cast directory
 */
var dot_cast_remotes_path = exports.dot_cast_remotes_path = path.join(dot_cast, 'remotes.json');

/**
 * The path to the remotes.json file for the current project
 */
var local_remotes_path = exports.local_remotes_path = function(projectpath) {
  projectpath = projectpath || process.cwd();
  return path.join(exports.dot_cast_project_path(projectpath), 'remotes.json');
};

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
 * Attempt to load remotes from the specified file
 *
 * @param {String} p  The path to the file to load from
 * @param {Function} callback A callback taking (err, remotes)
 */
function load_remotes(p, callback) {
  path.exists(p, function(exists) {
    if (!exists) {
      callback(null, {});
      return;
    }
    fs.stat(p, function(err, stats) {
      if (err) {
        callback(err);
        return;
      }
      else if (!stats.isFile()) {
        callback(new Error(p + ' exists but is not a file'));
        return;
      }
      utilfs.json_file(p, callback);
    });
  });
}

/**
 * Load global remotes
 *
 * @param {Function} callback A callback taking (err, remotes).
 */
exports.get_global_remotes = function(callback) {
  load_remotes(dot_cast_remotes_path, callback);
};

/**
 * Load project remotes
 *
 * @param {Function} callback A callback taking (err, remotes).
 */
exports.get_local_remotes = function(callback) {
  load_remotes(local_remotes_path(), callback);
};

/**
 * Get the remotes object which will default to an empty object if the remotes
 * file doesn't exist. This will look in ~/.cast/remotes.json as well as in
 * .cast-project/remotes.json if they exist. If neither of these exists an
 * empty object will be returned.
 *
 * @param {Function} callback A callback fired with (err, remotes).
 */
exports.get_remotes = function(callback) {
  var global_remotes;
  var local_remotes;

  async.parallel([
    // Get the 'global' remotes
    function(callback) {
      exports.get_global_remotes(function(err, remotes) {
        if (!err) {
          global_remotes = remotes;
        }
        callback(err);
      });
    },

    // Get the 'local' remotes
    function(callback) {
      exports.get_local_remotes(function(err, remotes) {
        if (!err) {
          local_remotes = remotes;
        }
        callback(err);
      });
    }
  ],
  function(err) {
    if (err) {
      callback(err);
      return;
    }

    var remotes = global_remotes;
    var name;

    // Set the 'global' property to true on all global remotes
    for (name in remotes) {
      if (remotes.hasOwnProperty(name)) {
        remotes[name].global = true;
      }
    }

    // Set the 'global' property to false on all local remotes
    for (name in local_remotes) {
      if (local_remotes.hasOwnProperty(name)) {
        remotes[name] = local_remotes[name];
        remotes[name].global = false;
      }
    }

    // Push global remotes, setting them as global

    callback(null, remotes);
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
  var global_default, local_default;
  exports.get_remotes(function(err, remotes) {
    if (err) {
      callback(err);
      return;
    }

    var remote, name;

    for (name in remotes) {
      if (remotes.hasOwnProperty(name)) {
        remote = remotes[name];

        if (remote.global && remote.is_default) {
          global_default = remote;
        }

        if (!remote.global && remote.is_default) {
          local_default = remote;
        }
      }
    }

    if (!local_default && !global_default) {
      callback(new Error('No default remote found'));
    }
    else {
      callback(null, local_default || global_default);
    }
  });
};


/**
 * Store a remotes (that is, a name -> obj mapping of remotes) to the specified
 * path.
 *
 * @param {String} p The path to save the remotes to
 * @param {Object} remotes The remotes object
 * @callback {Function} callback Callback fired with (err) upon completion
 */
exports.saveRemotes = function(p, remotes, callback) {
  var fstream = fs.createWriteStream(p);

  fstream.write(JSON.stringify(remotes, null, 4));
  fstream.end();

  fstream.on('close', function() {
    return callback();
  });

  fstream.on('error', function(err) {
    fstream.removeAllListeners('end');
    return callback(new Error('Error writing remotes file: ' + err));
  });
};

/**
 * Store the provided local remotes object.
 *
 * @param {Object} remotes The remotes object
 * @param {Function} callback Callback fired with (err)
 */
exports.saveLocalRemotes = function(remotes, callback) {
  exports.saveRemotes(local_remotes_path(), remotes, callback);
};

/**
 * Store the provided global remotes object.
 *
 * @param {Object} remotes The remotes object
 * @param {Function} callback Callback fired with (err)
 */
exports.saveGlobalRemotes = function(remotes, callback) {
  exports.saveRemotes(dot_cast_remotes_path, remotes, callback);
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
