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

var sys = require('sys');
var path = require('path');

var async = require('async');
var sprintf = require('sprintf').sprintf;
var terminal = require('terminal');

var http = require('util/http');
var clientUtils = require('util/client');
var misc = require('util/misc');
var manifest = require('manifest/index');
var manifestConstants = require('manifest/constants');
var bundles = require('bundles');
var Errorf = misc.Errorf;

var initCmd = require('cast-client/commands/init').handleCommand;
var bundlesCreateCmd = require('cast-client/commands/bundles/create').handleCommand;
var bundlesUploadCmd = require('cast-client/commands/bundles/upload').handleCommand;
var instancesCreateCmd = require('cast-client/commands/instances/create').handleCommand;
var instancesUpgradeCmd = require('cast-client/commands/instances/upgrade').handleCommand;

var config = {
  shortDescription: 'Deploy an application.',
  longDescription: 'Deploy an application, if neccessary create a new instance or' +
                   ' upgrade an existing one',
  requiredArguments: [],
  optionalArguments: [['apppath', 'Path to folder containing the cast.json file and your application files']],
  options: [
    {
      names: ['--instance-name', '-i'],
      dest: 'instanceName',
      action: 'store',
      desc: 'Instance name.'
    },
    {
      names: ['--no-interactive', '-n'],
      dest: 'noInteractive',
      action: 'store_true',
      desc: 'Don\'t interact with the user, immediately exit on error.'
    }
  ],
  usesGlobalOptions: ['debug', 'remote']
};

/**
 * Wrapper around init client command.
 *
 * @param {String} applicationPath Path to the application root directory.
 * @param {CommandParser} CommandParser instance.
 * @param {Function} callback Callback called with (err, successMsg)
 */
function createManifestFile(applicationPath, parser, callback) {
  var cmdArgs = {
    'apppath': applicationPath
  };

  terminal.puts('Manifest file does not exist, creating it.');
  initCmd(cmdArgs, parser, callback);
}

/**
 * Wrapper around bundles create and bundles upload client command.
 *
 * @param {String} applicationPath Path to the application root directory.
 * @param {String} tarballName Name of the bundle tarball.
 * @param {String} version Application version.
 * @param {?String} remote The name of the remote to use.
 * @param {CommandParser} CommandParser instance.
 * @param {Function} callback Callback called with (err, successMsg)
 */
function createAndUploadBundle(applicationPath, version, tarballName, remote, parser, callback) {
  async.waterfall([
    function checkIfBundleExistsLocally(callback) {
      var bundlePath = path.join(applicationPath, '.cast-project/tmp',
                                 tarballName);
      path.exists(bundlePath, async.apply(callback, null));
   },

   function createBundleIfItDoesntExistLocally(existsLocally, callback) {
     var args;
     if (existsLocally) {
       // Already exists, locally no need to re-create it
       callback(null, null);
       return;
     }

     args = {
       'apppath': applicationPath
     };

     bundlesCreateCmd(args, parser, callback);
   },

   function uploadBundle(successMessage, callback) {
     var args = {
       'remote': remote,
       'apppath': applicationPath,
       'version': version
     };

     bundlesUploadCmd(args, parser, callback);
   }
  ], callback);
}

/**
 * Wrapper around bundles create and bundles upload client command.
 *
 * @param {String} instanceName name of the instance.
 * @param {?String} remote The name of the remote to use.
 * @param {Function} callback Callback called with (err, instancedata)
 */
function getInstanceData(instanceName, remote, callback) {
  var remotePath = sprintf('/instances/%s/', instanceName);
  http.getApiResponse(remotePath, 'GET', { 'remote': remote,
                                           'apiVersion': '1.0',
                                           'parseJson': true,
                                           'expectedStatusCodes': [200, 404]},
                      function(err, res) {
    var instance = null;

    if (err) {
      callback(err);
      return;
    }

    if (res.statusCode === 200) {
      instance = res.body;
    }

    callback(null, instance);
  });
}

function handleCommand(args, parser, callback) {
  var applicationName, version, bundleName, tarballName;
  var successMsg = null;
  var remote = args.remote;
  var interactive = !args.noInteractive;
  var instanceName = args.instanceName;
  var applicationPath = args.apppath || process.cwd();
  var manifestPath = path.join(applicationPath, manifestConstants.MANIFEST_FILENAME);
  var ops = [];

  /**
   * Create, enable and start a new instance (wrapper around instances create
   * command).
   */
  function createAndStartInstance(callback) {
    var args = {
      'remote': remote,
      'name': instanceName,
      'bundle': misc.getFullBundleName(bundleName, version),
      'enable': true
    };

    successMsg = sprintf('Application %s v%s has been successfully ' +
         'deployed (instance %s has been created). If the application ' +
         'did not start properly, you can ' + 'use the following command ' +
         'to view it\'s log file: cast services tail %s', applicationName,
         version, instanceName);
    instancesCreateCmd(args, parser, callback);
  }

  /**
   * Upgrade an instance (wrapper around instances upgrade command).
   */
  function upgradeInstance(callback) {
    var args = {
      'remote': remote,
      'name': instanceName,
      'version': version
    };

    successMsg = sprintf('Application %s %s has been successfully ' +
         'deployed (instance %s has been upgraded to v%s). If the ' +
         'application did not start properly, you can use the ' +
         'following command to view it\'s log file: ' +
         'cast services tail %s', applicationName, version, instanceName,
                                  version);
    instancesUpgradeCmd(args, parser, callback);
  }

  function applicationBundleExists(name, version, callback) {
    // @TODO: Perform filtering server-side
    var exists;

    async.waterfall([
      function getResponse(callback) {
        var remotePath = sprintf('/bundles');
        http.getApiResponse(remotePath, 'GET', { 'remote': remote,
                                                 'apiVersion': '1.0',
                                                 'parseJson': true,
                                                 'expectedStatusCodes': [200]},
                              function(err, res) {
          callback(err, res);
        });
      },

      function filterResponse(res, callback) {
        var app, appBundles, i, len, appBundleName;
        var apps = res.body;

        for (i = 0, len = apps.length; i < len; i++) {
          app = apps[i];
          bundleName = app.name;
          appBundles = app.bundles;

          exists = appBundles.filter(function(bundle) {
            var bundleVersion = bundles.getBundleVersion(bundleName, bundle);
            return (bundleName === name && bundleVersion === version);
          });

          if (exists.length === 1) {
            break;
          }
        }

        exists = (exists.length === 1);
        callback();
      }
    ],

    function(err) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, exists);
    });
  }

  async.series([
    // 1. Verify that the manifest file exists and if it doesn't ask the user
    // to create it
    function checkManifestFileExists(callback) {
      path.exists(manifestPath, function(exists) {
        var err;

        if (!exists) {
          if (!interactive) {
            err = new Errorf('Failed to find a manifest file %s in %s',
                            manifestConstants.MANIFEST_FILENAME,
                            applicationPath);
            callback(err);
          }
          else {
            createManifestFile(applicationPath, parser, callback);
          }
        }
        else {
          callback();
        }
      });
    },

    // 2. Validate the manifest and read the application name and version attribute
    function readAndValidateManifest(callback) {
      manifest.validateManifest(manifestPath, function(err, manifestObject) {
        if (err) {
          callback(new Error('Manifest validation failed: ' + err.message));
          return;
        }

        applicationName = manifestObject.name;
        instanceName = instanceName || misc.getInstanceName(applicationName);
        version = manifestObject.version;
        bundleName = misc.getValidBundleName(manifestObject.name);
        tarballName = sprintf('%s.tar.gz', misc.getFullBundleName(bundleName, version));

        callback();
      });
    },

    // 3. Check if the bundles exists on the server and if it doesn't, create and
    // upload it
    function checkBundleExistsOnTheServer(callback) {
      applicationBundleExists(bundleName, version, function onResponse(err, exists) {
        if (!exists) {
          // Bundle doesn't exist remotely, create it (if it doesn't
          // exist locally) and upload it
          ops.push(async.apply(createAndUploadBundle, applicationPath, version, tarballName, remote, parser));
        }

        callback();
      });
    },

    // 4. Check if the instance with the provided name and version already
    // exists on the server
    function checkInstanceExists(callback) {
      getInstanceData(instanceName, remote, function onData(err, instance) {
        if (err) {
          callback(err);
          return;
        }

        if (instance && instance['bundle_version'] === version) {
          // Instance for this application version already exists, bail out
          callback(new Errorf('Instance %s with version %s already exists on the server. If ' +
                              'you want to deploy a new version of your ' +
                              'application, you need to change the ' +
                              '"version" attribute in the %s file.',
                              instanceName, version, manifestConstants.MANIFEST_FILENAME));
        }
        else if (instance) {
          // Existing instance, preform upgrade
          ops.push(upgradeInstance);
          callback();
        }
        else {
          // No existing instances, this is the first one, create it
          ops.push(createAndStartInstance);
          callback();
        }
      });
    },

    // Execute all the pending operations
    function(callback) {
      async.series(ops, callback);
    }
  ],

  function(err) {
    callback(err, (err ? null : successMsg));
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
