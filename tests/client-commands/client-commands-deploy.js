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

var path = require('path');
var fs = require('fs');
var constants = require('constants');

var async = require('async');

var fsUtil = require('util/fs');
var testUtil = require('util/test');
var config = require('util/config');
var manifestConstants = require('manifest/constants');
var deployCmd = require('cast-client/commands/deploy').handleCommand;
var testConstants = require('./../constants');
var managers = require('cast-agent/managers');

var cwd = process.cwd();

var DEFAULT_REMOTE = testConstants.AVAILABLE_REMOTES['localhost_http1'];
exports['setUp'] = function(test, assert) {
  // Set up agent to use the mock service manager
  config.configFiles = [
    'test-mock-service-manager.conf'
  ];

  config.setupAgent(function(err) {
    assert.ifError(err);
    managers.initManagers(function(err) {
      assert.ifError(err);
      test.finish();
    });
  });
};

exports['test_manifest_file_doesnt_exist_no_interactive'] = function(test, assert) {
  var args = {
    'insanceName': 'foobar-1',
    'noInteractive': true
  };

  deployCmd(args, null, function onResult(err, successMsg) {
    assert.ok(err);
    assert.match(err.message, /Failed to find a manifest file/i);
    test.finish();
  });
};

exports['test_manifest_file_doesnt_exist_interactive'] = function(test, assert) {
  // @TODO: Find a way to test this case without spawning a child
  var args = {
    'insanceName': 'foobar-2',
    'noInteractive': false
  };

  test.skip('TODO');
  deployCmd(args, null, function onResult(err, successMsg) {
    test.finish();
  });
};

exports['test_instance_create_and_upgrade'] = function(test, assert) {
  var testServer = null;

  var testApp1Path = path.join(cwd, 'data/test_cast_app');
  var testApp1DestPath = path.join(cwd, '.tests', 'test_cast_app-111');
  var testApp2DestPath = path.join(cwd, '.tests', 'test_app_two-2222');
  var testApp1ManifestPath = path.join(testApp1DestPath, manifestConstants.MANIFEST_FILENAME);
  var testApp2ManifestPath = path.join(testApp2DestPath, manifestConstants.MANIFEST_FILENAME);
  var testApp2BundlePath = path.join(testApp2DestPath, '.cast-project/tmp/test_app_two@1.1.0.tar.gz');

  var directoriesToCreate = [
    testApp1DestPath,
    testApp2DestPath,
    path.join(testApp2DestPath, '.cast-project/'),
    path.join(testApp2DestPath, '.cast-project/tmp/'),
    '.tests/data_root/services',
    '.tests/data_root/bundles/test_cast_app'
  ];


  var args = {
    'apppath': testApp1DestPath,
    'instanceName': 'foobar',
    'noInteractive': false
  };

  async.series([
    // Create necessary directories
    function createDirectories(callback) {
      async.forEachSeries(directoriesToCreate, function(directory, callback) {
        fs.mkdir(directory, 0750, callback);
      }, callback);
    },

    function writeDummyManifestFile(callback) {
      fs.writeFile(testApp1ManifestPath, 'ponnies!', 'utf8', callback);
    },

    function callDeployCommandInvalidManifest(callback) {
      deployCmd(args, null, function onResult(err, successMsg) {
        assert.ok(err);
        assert.match(err.message, /manifest validation failed/i);
        callback();
      });
    },

    function copyTestAppData(callback) {
      fsUtil.copyTree(testApp1Path, testApp1DestPath, function onCopyComplete() {
        fsUtil.copyTree(testApp1Path, testApp2DestPath, callback);
      });
    },

    function callDeployCommandConnRefused(callback) {
      // Manifest file exists and it's valid but server is not started yet so
      // the upload command should fail.
      deployCmd(args, null, function onResult(err, message) {
        assert.ok(err);
        assert.ok((err.errno === constants.ECONNREFUSED || err.errno === constants.ETIMEDOUT));
        callback();
      });
    },

    function startCastTestHttpServer(callback) {
      testUtil.getTestHttpServer(DEFAULT_REMOTE.port, DEFAULT_REMOTE.ip,
                                 function onBound(server) {
        testServer = server;
        callback();
      });
    },

    // Create new instance test
    function callDeployCmdCreateSuccess(callback) {
      deployCmd(args, null, function onResult(err, successMsg) {
        assert.ifError(err);
        assert.ok(successMsg);
        assert.match(successMsg, /has been successfully deployed/i);
        assert.match(successMsg, /instance foobar has been created/i);
        callback();
      });
    },

    // Bump application version number so upgrade can be tested
    function bumpVersionNumber(callback) {
      fs.readFile(testApp1ManifestPath, 'utf8', function(err, data) {
        assert.ifError(err);

        data = data.replace('1.0.0', '1.1.0');
        fs.writeFile(testApp1ManifestPath, data, 'utf8', callback);
      });
    },

    // Upgrade an existing instance test
    function callDeployCmdUpgradeSuccess(callback) {
      deployCmd(args, null, function onResult(err, successMsg) {
        assert.ifError(err);
        assert.ok(successMsg);
        assert.match(successMsg, /has been successfully deployed/i);
        assert.match(successMsg, /instance foobar has been upgraded to v1\.1\.0/i);
        callback();
      });
    },

    function callDeployCmdAlreadyExists(callback) {
      // Try to deploy an app without updating the version, should throw an error
      deployCmd(args, null, function onResult(err, successMsg) {
        assert.ok(err);
        callback();
      });
    },

    /*
     * Test when a bundle already exists locally so it only needs to be
     * uploaded, not created.
     */
    function changeTestApptwoName(callback) {
      fs.readFile(testApp2ManifestPath, 'utf8', function(err, data) {
        assert.ifError(err);

        data = data.replace('Test Cast App', 'Test App Two');
        data = data.replace('1.0.0', '1.1.0');
        fs.writeFile(testApp2ManifestPath, data, 'utf8', callback);
      });
    },

    function corruptBundleFile(callback) {
      testUtil.fileCreate(testApp2BundlePath, callback);
    },

    function callDeployCmdBundleExistsLocally(callback) {
      // This time bundle should not be created because it already exists
      // locally in .cast-project/tmp/
      var args2 = {
        'apppath': testApp2DestPath,
        'instanceName': 'barfoo',
        'noInteractive': false
      };

      deployCmd(args2, null, function onResult(err, successMsg) {
        // Err should be set because we have created fake bundle archive and the
        // extraction should fail server side
        assert.ok(err);
        assert.match(err.message, /error extracting tarball/i);
        callback();
      });
    },

    /*
    function testInstanceNameIsDerivedFromApplicationname(callback) {
      // this should work because the instance name is derived from the
      // application name if it's not specified
      var args3 = {
        'apppath': testApp1DestPath,
        'noInteractive': false
      };

      deployCmd(args3, null, function onResult(err, successMsg) {
        // Err should be set because we have created fake bundle archive and the
        // extraction should fail server side
        assert.ok(successMsg);
        assert.match(successMsg, /has been successfully deployed/i);
        assert.match(successMsg, /instance test_cast_app has been created/i);
        callback();
      });
    }
    */
  ],

  function(err) {
    if (testServer) {
      testServer.close();
    }

    assert.ifError(err);
    test.finish();
  });
};
