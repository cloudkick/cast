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

var async = require('async');

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
 * The path to the dot cast directory (currently ~/.cast)
 */
var dotCastPath = misc.expanduser('~/.cast');

/**
 * The path to the remotes.json file in the dot cast directory
 */
var dotCastRemotesPath = path.join(dotCastPath, 'remotes.json');

/**
 * Get the path to the client private key
 * @return {String} Path to the client private key.
 */
var getClientKeyPath = function() {
  return path.join(dotCastPath, CLIENT_KEYFILE_NAME);
};

/**
 * Get the path to the client x509 certificate
 * @return {String} Path to the client certificate.
 */
var getClientCertPath = function() {
  return path.join(dotCastPath, CLIENT_CRTFILE_NAME);
};

/**
 * Get the path to the cast project directory for a project
 *
 * @param {String} projectpath  The path to the root of the project.
 */
var dotCastProjectPath = function(projectpath) {
  return path.join(projectpath, '.cast-project');
};

/**
 * Get the path to a project's bundles directory
 * @param {String} projectRoot Path to the root of the project.
 * @return {String} Path to the project's bundles directory.
 */
var getProjectBundleRoot = function(projectRoot) {
  return path.join(dotCastProjectPath(projectRoot), 'tmp');
};

/**
 * The path to the remotes.json file for the current project
 */
var localRemotesPath = function(projectpath) {
  projectpath = projectpath || process.cwd();
  return path.join(dotCastProjectPath(projectpath), 'remotes.json');
};

/**
 * Create the user's ~/.cast directory if it doesn't exist.
 *
 * @param {Function} callback A callback fired with a possible error.
 */
var ensureDotCast = function(callback) {
  fsutil.ensureDirectory(dotCastPath, callback);
};

/**
 * Creates a dot cast project directory if it doesn't exist.
 *
 * @param {String} projectpath The path to the project.
 * @param {Function} callback A callback fired upon completion with (err, dotCastProjectPath).
 */
var ensureDotCastProject = function(projectpath, callback) {
  var dotCastProjectPath_ = dotCastProjectPath(projectpath);
  fsutil.ensureDirectory(dotCastProjectPath_, function(err) {
    callback(err, dotCastProjectPath_);
    return;
  });
};

/**
 * Attempt to load remotes from the specified file
 *
 * @param {String} p  The path to the file to load from.
 * @param {Function} callback A callback taking (err, remotes).
 */
var loadRemotes = function(p, callback) {
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
};

/**
 * Load global remotes
 *
 * @param {Function} callback A callback taking (err, remotes).
 */
var getGlobalRemotes = function(callback) {
  loadRemotes(dotCastRemotesPath, callback);
};

/**
 * Load project remotes
 *
 * @param {Function} callback A callback taking (err, remotes).
 */
var getLocalRemotes = function(callback) {
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
var getRemotes = function(callback) {
  var globalRemotes;
  var localRemotes;

  async.parallel([
    // Get the 'global' remotes
    function(callback) {
      getGlobalRemotes(function(err, remotes) {
        if (!err) {
          globalRemotes = remotes;
        }
        callback(err);
      });
    },

    // Get the 'local' remotes
    function(callback) {
      getLocalRemotes(function(err, remotes) {
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

/*
 * Return a default remote.
 *
 * If a remotes file does not exist or there is a no default remote, callback will be called with null as
 * the second argument.
 *
 * @param {Function} callback Callback which is called with an error as the first argument and remote object
 *                            as the second one if a default remote is found.
 */
var getDefaultRemote = function(callback) {
  var globalDefault, localDefault;
  getRemotes(function(err, remotes) {
    if (err) {
      callback(err);
      return;
    }

    var remote, name;

    for (name in remotes) {
      if (remotes.hasOwnProperty(name)) {
        remote = remotes[name];

        if (remote.global && remote['is_default']) {
          globalDefault = remote;
        }

        if (!remote.global && remote['is_default']) {
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
 * Get a remote by name, or the default if the name evaluates to false.
 *
 * @param {String} remoteName The name of the remote to retrieve.
 * @param {Function} callback A callback called with (remote, err).
 */
var getRemote = function(remoteName, callback) {
  if (remoteName) {
    getRemotes(function(err, remotes) {
      if (err) {
        callback(err);
      }
      else if (!remotes.hasOwnProperty(remoteName)) {
        callback(new Error('No such remote: ' + remoteName));
      }
      else {
        callback(null, remotes[remoteName]);
      }
    });
  }
  else {
    getDefaultRemote(callback);
  }
};

/**
 * Store a remotes (that is, a name -> obj mapping of remotes) to the specified
 * path.
 *
 * @param {String} p The path to save the remotes to.
 * @param {Object} remotes The remotes object.
 * @callback {Function} callback Callback fired with (err) upon completion
 */
var saveRemotes = function(p, remotes, callback) {
  // Make a copy of each remote containing only fields that should be saved
  var name, remote;
  var remotesData = {};

  for (name in remotes) {
    if (remotes.hasOwnProperty(name)) {
      remote = remotes[name];
      remotesData[name] = {
        'url': remote['url'],
        'hostname': remote['hostname'],
        'port': remote['port'],
        'fingerprint': remote['fingerprint'],
        'is_default': remote['is_default']
      };
    }
  }

  var fstream = fs.createWriteStream(p);

  fstream.write(JSON.stringify(remotesData, null, 4));
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
 * @param {Object} remotes The remotes object.
 * @param {Function} callback Callback fired with (err).
 */
var saveLocalRemotes = function(remotes, callback) {
  saveRemotes(localRemotesPath(), remotes, callback);
};

/**
 * Store the provided global remotes object.
 *
 * @param {Object} remotes The remotes object.
 * @param {Function} callback Callback fired with (err).
 */
var saveGlobalRemotes = function(remotes, callback) {
  saveRemotes(dotCastRemotesPath, remotes, callback);
};

/**
 * Given the name of a bundle and the root of a project, get the path to the
 * bundle.
 *
 * @param {String} projectRoot Path to the project root.
 * @param {String} bundleName  The name of the bundle.
 * @return {String} The path to the bundle file.
 */
var getBundlePath = function(projectRoot, bundleName) {
  var bundleFile = bundleName + '.tar.gz';
  return path.join(getProjectBundleRoot(projectRoot), bundleFile);
};

/**
 * Get a list of (presumably bundle) files in the tmp directory
 *
 * @param {String} projectRoot Path to the project root.
 * @param {Function} callback   A callback that takes (err, bundles).
 */
var listBundles = function(projectRoot, callback) {
  var bundledir = getProjectBundleRoot(projectRoot);

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
 * @param {String} projectRoot The root of the project.
 * @param {Function} callback   A callback that takes (err, bundle).
 */
var getNewestBundle = function(projectRoot, callback) {
  listBundles(projectRoot, function(err, bundles) {
    var newestbundle;
    var newestmtime;
    var size;

    if (err) {
      callback(err);
      return;
    }

    async.forEach(bundles, function(bundle, callback) {
      var bundlepath = getBundlePath(projectRoot, bundle);
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

exports.dotCastPath = dotCastPath;
exports.dotCastRemotesPath = dotCastRemotesPath;
exports.localRemotesPath = localRemotesPath;

exports.getClientKeyPath = getClientKeyPath;
exports.getClientCertPath = getClientCertPath;
exports.getProjectBundleRoot = getProjectBundleRoot;
exports.dotCastProjectPath = dotCastProjectPath;
exports.ensureDotCast = ensureDotCast;
exports.ensureDotCastProject = ensureDotCastProject;
exports.getGlobalRemotes = getGlobalRemotes;
exports.getLocalRemotes = getLocalRemotes;
exports.getRemotes = getRemotes;
exports.getRemote = getRemote;
exports.getDefaultRemote = getDefaultRemote;
exports.saveRemotes = saveRemotes;
exports.saveLocalRemotes = saveLocalRemotes;
exports.saveGlobalRemotes = saveGlobalRemotes;
exports.getBundlePath = getBundlePath;
exports.listBundles = listBundles;
exports.getNewestBundle = getNewestBundle;
