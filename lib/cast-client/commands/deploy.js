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
  usesGlobalOptions: ['remote']
};

function handleCommand(args, parser, callback) {
  var version, bundleName, tarballName;
  var remote = args.remote;
  var interactive = !args.noInteractive;
  var instanceName = args.instanceName;
  var applicationPath = args.apppath || process.cwd();
  var manifestPath = path.join(applicationPath, manifestConstants.MANIFEST_FILENAME);
  var ops = [];

  function createManifestFile(callback) {
    var cmdArgs = {
      'apppath': applicationPath
    };

    terminal.puts('Manifest file does not exist, creating it.');
    initCmd(cmdArgs, parser, callback);
  }

  function createAndUploadBundle(callback) {
    async.waterfall([
     function checkIfBundleExistsLocally(callback) {
       var bundlePath = path.join(applicationPath, tarballName);

       path.exists(bundlePath, async.apply(callback, null));
     },

     function createBundleIfItDoesntExistLocally(existsLocally, callback) {
       var args;
       if (existsLocally) {
         // Already exists, locally no need to re-create it
         callback();
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

  function getInstanceData(instanceName, callback) {
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

  function createAndStartInstance(callback) {
    var args = {
      'remote': remote,
      'name': instanceName,
      'bundle': misc.getFullBundleName(bundleName, version),
      'enable': true
    };

    instancesCreateCmd(args, parser, callback);
  }

  function upgradeInstance(callback) {
    var args = {
      'remote': remote,
      'name': instanceName,
      'version': version
    };

    instancesUpgradeCmd(args, parser, callback);
  }

  function applicationBundleExists(bundleName, version, callback) {
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
        var bundles = res.body;
        exists = bundles.filter(function(bundle) {
          return (bundle.name === bundleName && bundle.version === version);
        });

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
            createManifestFile(callback);
          }
        }
        else {
          callback();
        }
      });
    },

    // 2. Validate the manifest and read the version attribute
    function readAndValidateManifest(callback) {
      manifest.validateManifest(manifestPath, function(err, manifestObject) {
        if (err) {
          callback(new Error('Manifest validation failed: ' + err.message));
          return;
        }

        version = manifestObject.version;
        bundleName = misc.getValidBundleName(manifestObject.name);
        tarballName = sprintf('%s.tar.gz', misc.getFullBundleName(bundleName, version));
        callback();
        return;
      });

    },

    function checkBundleExistsOnTheServer(callback) {
      applicationBundleExists(bundleName, version, function onResponse(err, exists) {
        if (!exists) {
          // Bundle doesn't exist remotely, create it (if it doesn't
          // exist locally) and upload it
          ops.push(createAndUploadBundle);
        }

        callback();
      });
    },

    function checkInstanceExists(callback) {
      getInstanceData(instanceName, function onData(err, instance) {
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
    callback(err, 'Done');
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
