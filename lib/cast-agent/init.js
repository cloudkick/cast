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
var url = require('url');
var constants = require('constants');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var config = require('util/config');
var misc = require('util/misc');
var flowctrl = require('util/flow_control');
var fsutil = require('util/fs');
var certgen = require('security/certgen.js');
var norris = require('norris');
var dotfiles = require('util/client_dotfiles');
var managers = require('cast-agent/managers');
var control = require('control');

/*
 * Function which determines if this is the first start of the agent.
 *
 * @param {Function} callback Callback which is called with a possible error as the first
 *                            argument and true as the second one if this if the first run,
 *                            false otherwise.
 */
function isFirstRun(callback) {
  var p = path.join(config.get()['data_root'], '.cast-first-run');
  var flags = constants.OWRONLY | constants.O_CREAT | constants.O_EXCL;
  fs.open(p, flags, 0600, function(err, fd) {
    if (err) {
      if (err.errno === constants.EEXIST) {
        // The file exists (see open(2)), this is not a first run
        callback(null, false);
      } else if (err.errno === constants.ENOENT) {
        // The data_root directory does not exist, this is a first run
        callback(null, true);
      } else {
        // Some other error occurred
        callback(err, false);
      }
      return;
    }

    fs.close(fd, function(err) {
      callback(err, true);
    });
  });
}


function installLocalRemote(callback) {
  var remote;
  var conf = config.get();

  async.waterfall([
    async.apply(dotfiles.ensureDotCast),

    async.apply(dotfiles.getGlobalRemotes),

    // If SSL is enabled, get a fingerprint for cast's cert
    function(remotes, callback) {
      if (conf['ssl_enabled']) {
        certgen.getCertFingerprint(conf['ssl_cert'], function(err, fingerprint) {
          callback(err, remotes, fingerprint);
        });
      } else {
        callback(null, remotes, null);
      }
    },

    // Construct and install a remote
    function(remotes, fingerprint, callback) {
      var name;
      var isDefault = true;

      // Search for a pre-existing default
      for (name in remotes) {
        if (remotes.hasOwnProperty(name) && remotes[name]['is_default']) {
          // If a pre-existing local remote is default, maintain that
          if (name !== dotfiles.LOCAL_REMOTE_NAME) {
            isDefault = false;
          }
          break;
        }
      }

      // Construct the remote's URL
      var urlObj = {
        hostname: conf['ip'],
        port: conf['port'],
        protocol: conf['ssl_enabled'] ? 'https:' : 'http:',
        path: '/'
      };

      // Construct the remote
      remote = {
        'url': url.format(urlObj),
        'hostname': urlObj.hostname,
        'port': urlObj.port,
        'fingerprint': fingerprint,
        'is_default': isDefault
      };

      remote.global = true;
      remote.name = dotfiles.LOCAL_REMOTE_NAME;

      // Save the remote
      remotes[remote.name] = remote;
      dotfiles.saveGlobalRemotes(remotes, callback);
    },

    // Generate a CSR (if SSL is enabled)
    function generateCSR(callback) {
      if (!conf['ssl_enabled']) {
        callback();
        return;
      }

      function reportCertOpts(callback) {
        norris.get(function(facts) {
          var certOpts = {
            hostname: 'localhost',
            email: sprintf('%s@localhost', facts.username)
          };
          callback(null, certOpts);
        });
      }

      dotfiles.ensureRemoteCSR(remote, reportCertOpts, callback);

    },

    // Load the CSR (if SSL is enabled)
    function loadCSR(callback) {
      if (!conf['ssl_enabled']) {
        callback(null, null);
      } else {
        dotfiles.loadRemoteCSR(remote, callback);
      }
    },

    // Submit and sign the CSR (if SSL is enabled)
    function addAndSign(csrBuf, callback) {
      if (!conf['ssl_enabled']) {
        callback();
        return;
      }

      callback = flowctrl.fireOnce(callback);

      var a = control.ca.createRequest('localhost', csrBuf.toString('utf8'));
      var s = control.ca.signRequest('localhost');

      a.on('error', callback);
      s.on('error', callback);
      s.on('success', function(results) {
        callback();
      });
    }
  ], callback);
}


/*
 * This function preforms the initialization process.
 *
 * @param {Function} callback Callback which is called with a possible error.
 */
function initialize(callback) {
  var conf = config.get();
  isFirstRun(function(err, firstRun) {
    if (err) {
      callback(new Error('Failed to determine if this is the first run: ' +
                          err.message));
      return;
    }

    var ops = [];

    if (firstRun) {
      ops.push(function(callback) {
        var pathsToCreate;
         // Create the neccessary directories
        fsutil.ensureDirectory(conf['data_root'], function(err) {
          if (err) {
            callback(err);
            return;
          }

          pathsToCreate = [
            conf['data_dir'],
            conf['service_dir_available']
          ];

          async.forEachSeries(pathsToCreate, fsutil.ensureDirectory, callback);
        });
      });
    }

    // If the server doesn't have an SSL certificate of its own, generate one
    ops.push(function(callback) {
      var key = conf['ssl_key'];
      var cert = conf['ssl_cert'];
      path.exists(conf['ssl_cert'], function(exists) {
        if (!exists) {
          norris.get(function(facts)  {
            var options = {hostname: facts.hostname};
            certgen.genSelfSigned(key, cert, options, callback);
          });
        } else {
          callback();
        }
      });
    });

    // Initialize job managers
    ops.push(managers.initManagers);

    // Install a remote for local use on the first run
    if (firstRun) {
      ops.push(installLocalRemote);
    }

    async.series(ops, callback);
  });
}


exports.initialize = initialize;
