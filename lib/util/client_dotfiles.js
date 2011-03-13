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

var clientConfig = require('util/config');
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
  return path.join(exports.dotCastPath, CLIENT_KEYFILE_NAME);
};

/**
 * Get the path to the client x509 certificate
 * @return {String} Path to the client certificate
 */
exports.getClientCertPath = function() {
  return path.join(exports.dotCastPath, CLIENT_CRTFILE_NAME);
};

/**
 * Get the path to a project's bundles directory
 * @param {String} projectRoot Path to the root of the project
 * @return {String} Path to the project's bundles directory
 */
exports.getProjectBundleRoot = function(projectRoot) {
  return path.join(exports.dotCastProjectPath(projectRoot), 'tmp');
};

/**
 * The path to the dot cast directory (currently ~/.cast)
 */
var dotCast = exports.dotCastPath = misc.expanduser('~/.cast');

/**
 * The path to the remotes.json file in the dot cast directory
 */
var dotCastRemotesPath = exports.dotCastRemotesPath = path.join(dotCast, 'remotes.json');

/**
 * The path to the remotes.json file for the current project
 */
var localRemotesPath = exports.localRemotesPath = function(projectpath) {
  projectpath = projectpath || process.cwd();
  return path.join(exports.dotCastProjectPath(projectpath), 'remotes.json');
};

/**
 * Get the path to the cast project directory for a project
 *
 * @param {String} projectpath  The path to the root of the project.
 */
exports.dotCastProjectPath = function(projectpath) {
  return path.join(projectpath, '.cast-project');
};

/**
 * Create the user's ~/.cast directory if it doesn't exist.
 *
 * @param {Function} callback A callback fired with a possible error.
 */
exports.ensureDotCast = function(callback) {
  fsutil.ensureDirectory(dotCast, callback);
};

/**
 * Creates a dot cast project directory if it doesn't exist.
 *
 * @param {String} projectpath The path to the project.
 * @param {Function} callback A callback fired upon completion with (err, dot_cast_project_path).
 */
exports.ensureDotCastProject = function(projectpath, callback) {
  var dotCastProjectPath = exports.dotCastProjectPath(projectpath);
  fsutil.ensureDirectory(dotCastProjectPath, function(err) {
    callback(err, dotCastProjectPath);
    return;
  });
};

/**
 * Attempt to load remotes from the specified file
 *
 * @param {String} p  The path to the file to load from
 * @param {Function} callback A callback taking (err, remotes)
 */
function loadRemotes(p, callback) {
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
      utilfs.jsonFile(p, callback);
    });
  });
}

/**
 * Load global remotes
 *
 * @param {Function} callback A callback taking (err, remotes).
 */
exports.getGlobalRemotes = function(callback) {
  loadRemotes(dotCastRemotesPath, callback);
};

/**
 * Load project remotes
 *
 * @param {Function} callback A callback taking (err, remotes).
 */
exports.getLocalRemotes = function(callback) {
  loadRemotes(localRemotesPath(), callback);
};

/**
 * Get the remotes object which will default to an empty object if the remotes
 * file doesn't exist. This will look in ~/.cast/remotes.json as well as in
 * .cast-project/remotes.json if they exist. If neither of these exists an
 * empty object will be returned.
 *
 * @param {Function} callback A callback fired with (err, remotes).
 */
exports.getRemotes = function(callback) {
  var globalRemotes;
  var localRemotes;

  async.parallel([
    // Get the 'global' remotes
    function(callback) {
      exports.getGlobalRemotes(function(err, remotes) {
        if (!err) {
          globalRemotes = remotes;
        }
        callback(err);
      });
    },

    // Get the 'local' remotes
    function(callback) {
      exports.getLocalRemotes(function(err, remotes) {
        if (!err) {
          localRemotes = remotes;
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

    var remotes = globalRemotes;
    var name;

    // Set the 'global' property to true on all global remotes
    for (name in remotes) {
      if (remotes.hasOwnProperty(name)) {
        remotes[name].global = true;
      }
    }

    // Set the 'global' property to false on all local remotes
    for (name in localRemotes) {
      if (localRemotes.hasOwnProperty(name)) {
        remotes[name] = localRemotes[name];
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
exports.getRemote = function(remoteName, callback) {
  if (remoteName) {
    exports.getRemotes(function(err, remotes) {
      if (err) {
        callback(err);
      }
      else if (!remotes.hasOwnProperty(remoteName)) {
        callback(new Error("No such remote: " + remoteName));
      }
      else {
        callback(null, remotes[remoteName]);
      }
    });
  }
  else {
    exports.getDefaultRemote(callback);
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
exports.getDefaultRemote = function(callback) {
  var globalDefault, localDefault;
  exports.getRemotes(function(err, remotes) {
    if (err) {
      callback(err);
      return;
    }

    var remote, name;

    for (name in remotes) {
      if (remotes.hasOwnProperty(name)) {
        remote = remotes[name];

        if (remote.global && remote.isDefault) {
          globalDefault = remote;
        }

        if (!remote.global && remote.isDefault) {
          localDefault = remote;
        }
      }
    }

    if (!localDefault && !globalDefault) {
      callback(new Error('No default remote found'));
    }
    else {
      callback(null, localDefault || globalDefault);
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
    callback();
    return;
  });

  fstream.on('error', function(err) {
    fstream.removeAllListeners('end');
    callback(new Error('Error writing remotes file: ' + err));
    return;
  });
};

/**
 * Store the provided local remotes object.
 *
 * @param {Object} remotes The remotes object
 * @param {Function} callback Callback fired with (err)
 */
exports.saveLocalRemotes = function(remotes, callback) {
  exports.saveRemotes(localRemotesPath(), remotes, callback);
};

/**
 * Store the provided global remotes object.
 *
 * @param {Object} remotes The remotes object
 * @param {Function} callback Callback fired with (err)
 */
exports.saveGlobalRemotes = function(remotes, callback) {
  exports.saveRemotes(dotCastRemotesPath, remotes, callback);
};

/**
 * Given the name of a bundle and the root of a project, get the path to the
 * bundle.
 *
 * @param {String} project_root Path to the project root
 * @param {String} bundle_name  The name of the bundle
 * @return {String} The path to the bundle file
 */
exports.getBundlePath = function(projectRoot, bundleName) {
  var bundleFile = bundleName + '.tar.gz';
  return path.join(exports.getProjectBundleRoot(projectRoot), bundleFile);
};

/**
 * Get a list of (presumably bundle) files in the tmp directory
 *
 * @param {String} project_root Path to the project root
 * @param {Function} callback   A callback that takes (err, bundles)
 */
exports.listBundles = function(projectRoot, callback) {
  var dotCastProjectPath = exports.dotCastProjectPath(projectRoot);
  var bundledir = exports.getProjectBundleRoot(projectRoot);

  fs.readdir(bundledir, function(err, files) {
    var msg, bundles;

    if (err) {
      msg = 'Unable to read ' + bundledir + ', have you created a bundle yet?';
      callback(new Error(msg));
      return;
    }

    // Eliminate anything that doesn't look right
    files = files.filter(function(file) {
      return file.match(/.*@.*\.tar\.gz$/);
    });

    // Strip extensions
    bundles = files.map(function(file) {
      return path.basename(file, '.tar.gz');
    });

    callback(null, bundles);
    return;
  });
};

/**
 * Get the name of the newest bundle in the tmp directory. Note that 'newest'
 * in this case is determined by mtime on the file, not the version string.
 *
 * @param {String} project_root The root of the project
 * @param {Function} callback   A callback that takes (err, bundle)
 */
exports.getNewestBundle = function(projectRoot, callback) {
  exports.listBundles(projectRoot, function(err, bundles) {
    var newestbundle;
    var newestmtime;
    var size;

    if (err) {
      callback(err);
      return;
    }

    async.forEach(bundles, function(bundle, callback) {
      var bundlepath = exports.getBundlePath(projectRoot, bundle);
      fs.stat(bundlepath, function(err, stats) {
        if (!err && stats.isFile() && (!newestmtime || stats.mtime > newestmtime)) {
          newestmtime = stats.mtime;
          newestbundle = bundle;
          size = stats.size;
        }
        callback();
        return;
      });
    },
    function(err) {
      var msg;
      if (!err && !newestbundle) {
        msg = 'No bundles found, have you created one yet?';
        err = new Error(msg);
      }
      callback(err, newestbundle);
      return;
    });
  });
};
