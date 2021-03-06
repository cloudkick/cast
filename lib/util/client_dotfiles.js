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
var sprintf = require('sprintf').sprintf;

var clientConfig = require('util/config');
var misc = require('util/misc');
var Errorf = misc.Errorf;
var utilfs = require('util/fs');
var expanduser = require('util/misc').expanduser;
var fsutil = require('util/fs');
var certgen = require('security/certgen');
var constants = require('constants');

/**
 * Name of the file which contains patterns which are excluded from a bundle
 * when creating it.
 * @const
 * @type {String}
 */
var CAST_IGNORE_FILE = '.castignore';

/**
 * Name of the client private key file
 * @const
 * @type {String}
 */
var KEYFILE_NAME = 'cast.key';

/**
 * Name of the client x509 cert file
 * @const
 * @type {String}
 */
var CRTFILE_NAME = 'cast.crt';

/**
 * Name of the client cert/csr generation options file.
 * @const
 * @type {String}
 */
var CRTOPTSFILE_NAME = 'certopts.json';

/**
 * Name of the directory used to store remote-specific csrs and certs on the
 * client.
 * @const
 * @type {String}
 */
var CERTDIR_NAME = 'certs';

/**
 * The path to the dot cast directory (currently ~/.cast).
 * @const
 * @type {String}
 */
var DOT_CAST_PATH = misc.expanduser('~/.cast');

/**
 * The path to the remotes.json file in the dot cast directory
 * @const
 * @type {String}
 */
var DOT_CAST_REMOTES_PATH = path.join(DOT_CAST_PATH, 'remotes.json');

/**
 * The name reserved for the remote representing a local cast instance.
 * @const
 * @type {String}
 */
var LOCAL_REMOTE_NAME = 'local';

/**
 * A list of reserved remote names that may not be added or deleted by the
 * user.
 * @const
 * @type {Array}
 */
var RESERVED_REMOTE_NAMES = [
  LOCAL_REMOTE_NAME
];

/**
 * Get the path to the client private key
 * @return {String} Path to the client private key.
 */
function getClientKeyPath() {
  return path.join(DOT_CAST_PATH, KEYFILE_NAME);
}

/**
 * Get the path to the client x509 certificate
 * @return {String} Path to the client certificate.
 */
function getClientCertPath() {
  return path.join(DOT_CAST_PATH, CRTFILE_NAME);
}

/**
 * Get the path to a JSON file holding options related to certificate and CSR
 * generation on the client. This data will be obtained from the user the first
 * time a remote is added.
 * @return {String} Path to the certopts.json file.
 */
function getClientCertOptsPath() {
  return path.join(DOT_CAST_PATH, CRTOPTSFILE_NAME);
}

/**
 * Get the path to the cast project directory for a project
 *
 * @param {String} projectpath  The path to the root of the project.
 */
function dotCastProjectPath(projectpath) {
  projectpath = projectpath || process.cwd();
  return path.join(projectpath, '.cast-project');
}

/**
 * Get the path to a project's bundles directory
 * @param {String} projectRoot Path to the root of the project.
 * @return {String} Path to the project's bundles directory.
 */
function getProjectBundleRoot(projectRoot) {
  return path.join(dotCastProjectPath(projectRoot), 'tmp');
}

/**
 * The path to the remotes.json file for the current project
 */
function localRemotesPath(projectpath) {
  return path.join(dotCastProjectPath(projectpath), 'remotes.json');
}

/**
 * The path to the directory containing the cert and CSR for the given remote.
 * @param {Object} remote The remote to get the directory for.
 * @return {String} Path to the directory containing certs for remote.
 */
function getRemoteCertDirPath(remote) {
  if (remote.global) {
    return path.join(DOT_CAST_PATH, CERTDIR_NAME);
  } else {
    return path.join(dotCastProjectPath(), CERTDIR_NAME);
  }
}

/**
 * The path to the CSR for the given remote.
 * @param {Object} remote The remote to get a CSR path for.
 * @return {String} Path to a CSR for the given remote.
 */
function getRemoteCSRPath(remote) {
  var csrName = sprintf('%s.csr', remote.name);
  return path.join(getRemoteCertDirPath(remote), csrName);
}

/**
 * The path to the cert for the given remote.
 * @param {Object} remote The remote to get a cert path for.
 * @return {String} Path to a cert for the given remote.
 */
function getRemoteCertPath(remote) {
  var certName = sprintf('%s.crt', remote.name);
  return path.join(getRemoteCertDirPath(remote), certName);
}

/**
 * Create the user's ~/.cast directory if it doesn't exist.
 *
 * @param {Function} callback A callback fired with a possible error.
 */
function ensureDotCast(callback) {
  fsutil.ensureDirectory(DOT_CAST_PATH, callback);
}

/**
 * Creates a dot cast project directory if it doesn't exist.
 *
 * @param {String} projectpath The path to the project.
 * @param {Function} callback A callback fired upon completion with (err, dotCastProjectPath).
 */
function ensureDotCastProject(projectpath, callback) {
  var dotCastProjectPath_ = dotCastProjectPath(projectpath);
  fsutil.ensureDirectory(dotCastProjectPath_, function(err) {
    callback(err, dotCastProjectPath_);
    return;
  });
}

/**
 * Attempt to load remotes from the specified file
 *
 * @param {String} p  The path to the file to load from.
 * @param {Function} callback A callback taking (err, remotes).
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
function getGlobalRemotes(callback) {
  loadRemotes(DOT_CAST_REMOTES_PATH, function(err, remotes) {
    var name;

    if (err) {
      callback(err);
      return;
    }

    for (name in remotes) {
      if (remotes.hasOwnProperty(name)) {
        remotes[name].global = true;
        remotes[name].name = name;
      }
    }

    callback(null, remotes);
  });
}

/**
 * Load project remotes
 *
 * @param {Function} callback A callback taking (err, remotes).
 */
function getLocalRemotes(callback) {
  loadRemotes(localRemotesPath(), function(err, remotes) {
    var name;

    if (err) {
      callback(err);
      return;
    }

    for (name in remotes) {
      if (remotes.hasOwnProperty(name)) {
        remotes[name].global = false;
        remotes[name].name = name;
      }
    }

    callback(null, remotes);
  });
}

/**
 * Get the remotes object which will default to an empty object if the remotes
 * file doesn't exist. This will look in ~/.cast/remotes.json as well as in
 * .cast-project/remotes.json if they exist. If neither of these exists an
 * empty object will be returned.
 *
 * @param {Function} callback A callback fired with (err, remotes).
 */
function getRemotes(callback) {
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

    // Set the 'global' property to false on all local remotes
    for (name in localRemotes) {
      if (localRemotes.hasOwnProperty(name)) {
        remotes[name] = localRemotes[name];
      }
    }

    // Push global remotes, setting them as global
    callback(null, remotes);
  });
}

/*
 * Return a default remote.
 *
 * If a remotes file does not exist or there is a no default remote, callback
 * will be called with null as the second argument.
 *
 * @param {Function} callback Callback fired with (err, remote).
 */
function getDefaultRemote(callback) {
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
}

/**
 * Get a remote by name, or the default if the name evaluates to false.
 *
 * @param {String} remoteName The name of the remote to retrieve.
 * @param {Function} callback A callback called with (remote, err).
 */
function getRemote(remoteName, callback) {
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
}

/**
 * Store a remotes (that is, a name -> obj mapping of remotes) to the specified
 * path.
 *
 * @param {String} p The path to save the remotes to.
 * @param {Object} remotes The remotes object.
 * @callback {Function} callback Callback fired with (err) upon completion
 */
function saveRemotes(p, remotes, callback) {
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
}

/**
 * Store the provided local remotes object.
 *
 * @param {Object} remotes The remotes object.
 * @param {Function} callback Callback fired with (err).
 */
function saveLocalRemotes(remotes, callback) {
  saveRemotes(localRemotesPath(), remotes, callback);
}

/**
 * Store the provided global remotes object.
 *
 * @param {Object} remotes The remotes object.
 * @param {Function} callback Callback fired with (err).
 */
function saveGlobalRemotes(remotes, callback) {
  saveRemotes(DOT_CAST_REMOTES_PATH, remotes, callback);
}

/**
 * Given the name of a bundle and the root of a project, get the path to the
 * bundle.
 *
 * @param {String} projectRoot Path to the project root.
 * @param {String} bundleName  The name of the bundle.
 * @return {String} The path to the bundle file.
 */
function getBundlePath(projectRoot, bundleName) {
  var bundleFile = bundleName + '.tar.gz';
  return path.join(getProjectBundleRoot(projectRoot), bundleFile);
}

/**
 * Get a list of (presumably bundle) files in the tmp directory
 *
 * @param {String} projectRoot Path to the project root.
 * @param {Function} callback   A callback that takes (err, bundles).
 */
function listBundles(projectRoot, callback) {
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
}

/**
 * Get the name of the newest bundle in the tmp directory. Note that 'newest'
 * in this case is determined by mtime on the file, not the version string.
 *
 * @param {String} projectRoot The root of the project.
 * @param {Function} callback   A callback that takes (err, bundle).
 */
function getNewestBundle(projectRoot, callback) {
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
}

/**
 * Load the client's cert/CSR generation options. The options will be null if
 * the file does not exist.
 * @param {Function} callback A callback fired with (err, certOpts).
 */
function loadClientCertOpts(callback) {
  var certOptsPath = getClientCertOptsPath();
  fs.readFile(certOptsPath, 'utf8', function(err, text) {
    if (err && err.code === constants.EEXIST) {
      callback(null, null);
      return;
    } else if (err) {
      callback(err);
      return;
    }

    try {
      callback(null, JSON.parse(text));
    } catch (e) {
      callback(new Errorf('Error parsing %s: %s', certOptsPath, e.message));
    }
  });
}

/**
 * Save the client's cert/CSR generation options.
 * @param {Object} certOpts An object with 'hostname' and 'email'.
 * @param {Function} callback A callback fired with (err).
 */
function saveClientCertOpts(certOpts, callback) {
  var certOptsPath = getClientCertOptsPath();
  var certOptsJSON = JSON.stringify(certOpts, null, 4);
  fs.writeFile(certOptsPath, certOptsJSON, callback);
}

/**
 * Ensure a CSR exists for the provided remote, as well as a default key/cert
 * pair for use in establishing connections to it before a signed certificate
 * is received.
 * @param {Object} remote The remote to ensure the CSR for.
 * @param {Function} gatherClientCertOpts A function fired with (callback) to
 *     gather options for generating the client's certs and csrs. The callback
 *     should, in turn, be fired with (err, certOpts) where certOpts is
 *     an object with 'email' and 'hostname' properties.
 * @param {Function} callback A callback fired with (err).
 */
function ensureRemoteCSR(remote, gatherClientCertOpts, callback) {
  var certOptsPath = getClientCertOptsPath();
  var keyPath = getClientKeyPath();
  var certPath = getClientCertPath();
  var csrPath = getRemoteCSRPath(remote);
  async.waterfall([
    // Check for the existence of the client cert opts file
    function(callback) {
      path.exists(certOptsPath, function(exists) {
        callback(null, exists);
      });
    },

    // Load (from disk) or gather (from user) the cert opts
    function(certOptsExists, callback) {
      if (certOptsExists) {
        loadClientCertOpts(function(err, certOpts) {
          callback(err, certOptsExists, certOpts);
        });
      } else {
        gatherClientCertOpts(function(err, certOpts) {
          callback(err, certOptsExists, certOpts);
        });
      }
    },

    // If they don't exist on disk, save the cert opts
    function(certOptsExists, certOpts, callback) {
      if (!certOptsExists) {
        saveClientCertOpts(certOpts, function(err) {
          callback(err, certOpts);
        });
      } else {
        callback(null, certOpts);
      }
    },

    // Check for the existence of the client key
    function(certOpts, callback) {
      path.exists(keyPath, function(exists) {
        callback(null, exists, certOpts);
      });
    },

    // Generate the client key/cert pair if the key doesn't exist
    function(keyExists, certOpts, callback) {
      if (!keyExists) {
        certgen.genSelfSigned(keyPath, certPath, certOpts, function(err) {
          callback(err, certOpts);
        });
      } else {
        callback(null, certOpts);
      }
    },

    // Check for a CSR for the remote
    function(certOpts, callback) {
      path.exists(csrPath, function(exists) {
        callback(null, exists, certOpts);
      });
    },

    // Generate the CSR if it doesn't exist
    function(csrExists, certOpts, callback) {
      if (!csrExists) {
        fsutil.ensureDirectory(path.dirname(csrPath), function(err) {
          if (err) {
            callback(err);
            return;
          }
          certgen.genCSR(keyPath, csrPath, certOpts, callback);
        });
      } else {
        callback();
      }
    }
  ], callback);
}


/**
 * Save a certificate to disk.
 * @param {Object} remote The remote object.
 * @param {String} certText Text of the certificate to save.
 * @param {Function} callback A callback fired with (err).
 */
function saveRemoteCert(remote, certText, callback) {
  var certPath = getRemoteCertPath(remote);
  fs.writeFile(certPath, certText, callback);
}


/**
 * Load the CSR for a remote.
 * @param {Object} remote The remote object.
 * @param {Function} callback A callback fired with (err, csrBuf).
 */
function loadRemoteCSR(remote, callback) {
  var csrPath = getRemoteCSRPath(remote);
  fs.readFile(csrPath, callback);
}


/**
 * Load a certificate for a remote.
 *
 * We first attempt to load the certificate from disk and pass it back
 * directly. If that fails, we load the CSR and pass that to requestCert which
 * is provided by the caller and should attempt to retrieve a certificate
 * (presumably from the CA). Once we get the new certificate we store it then
 * pass it back to the caller as a Buffer via the callback.
 *
 * @param {Object} remote The remote.
 * @param {Function} requestCert A function which is called with
 *     (csrBuf, certOpts, callback) and should attempt to retrieve a
 *     certificate and pass it to callback as (err, certText). Pass back
 *     null as certText if the certificate was not available.
 * @param {Function} callback A callback fired with (err, certText).
 */
function loadRemoteCert(remote, requestCert, callback) {
  var certPath = getRemoteCertPath(remote);

  // TODO: These functions are declared in 'reverse' order compared to the
  // order in which they are executed. This is an absurd hack to keep jslint
  // happy - ditch jslint then fix this.

  // Store the received certificate before passing it back as a Buffer
  function onReceiveCert(err, certText) {
    if (err || !certText) {
      callback(err, certText);
      return;
    }
    saveRemoteCert(remote, certText, function(err) {
      if (err) {
        callback(err);
      } else {
        callback(null, new Buffer(certText));
      }
    });
  }

  // If the CSR loads, pass it to requestCert, otherwise error out
  function withCSR(err, csrBuf) {
    if (err) {
      callback(err);
      return;
    }

    loadClientCertOpts(function(err, certOpts) {
      if (err) {
        callback(err);
      } else {
        requestCert(csrBuf, certOpts, onReceiveCert);
      }
    });
  }

  // If the certificate did not exist, load the CSR, otherwise fire the
  // callback.
  function withCert(err, certBuf) {
    if (err && err.errno === constants.ENOENT) {
      loadRemoteCSR(remote, withCSR);
    } else {
      callback(err, certBuf);
    }
  }

  fs.readFile(certPath, withCert);
}


/**
 * Remove any CSR or cert that exists for the given remote. It is not an error
 * for either to not exist.
 * @param {Object} remote The remote to remove files for.
 * @param {Function} callback A callback fired with (err).
 */
function clearRemotePair(remote, callback) {
  var certPath = getRemoteCertPath(remote);
  var csrPath = getRemoteCSRPath(remote);
  async.series([
    function(callback) {
      fs.unlink(csrPath, function(err) {
        if (err && err.errno !== constants.ENOENT) {
          callback(err);
        } else {
          callback();
        }
      });
    },

    function(callback) {
      fs.unlink(certPath, function(err) {
        if (err && err.errno !== constants.ENOENT) {
          callback(err);
        } else {
          callback();
        }
      });
    }
  ], callback);
}

function setDotCastRemotesPath(dotCastRemotesPath) {
  // @TODO: Find a better way for overwriting this settings
  if (!dotCastRemotesPath) {
    throw new Error('Missing dotCastRemotesPath argument');
  }

  DOT_CAST_REMOTES_PATH = dotCastRemotesPath;
  exports.DOT_CAST_REMOTES_PATH = DOT_CAST_REMOTES_PATH;
}

function setDotCastPath(dotCastPath) {
  // @TODO: Find a better way for overwriting this settings
  DOT_CAST_PATH = dotCastPath;
  exports.DOT_CAST_PATH = DOT_CAST_PATH;
}

exports.CAST_IGNORE_FILE = CAST_IGNORE_FILE;
exports.DOT_CAST_PATH = DOT_CAST_PATH;
exports.DOT_CAST_REMOTES_PATH = DOT_CAST_REMOTES_PATH;
exports.LOCAL_REMOTE_NAME = LOCAL_REMOTE_NAME;
exports.RESERVED_REMOTE_NAMES = RESERVED_REMOTE_NAMES;
exports.localRemotesPath = localRemotesPath;

exports.setDotCastRemotesPath = setDotCastRemotesPath;
exports.setDotCastPath = setDotCastPath;

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
exports.ensureRemoteCSR = ensureRemoteCSR;
exports.loadRemoteCSR = loadRemoteCSR;
exports.loadRemoteCert = loadRemoteCert;
exports.clearRemotePair = clearRemotePair;
