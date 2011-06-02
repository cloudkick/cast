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

var cwd = process.cwd();

var DEFAULT_REMOTE = testConstants.AVAILABLE_REMOTES['localhost_http1'];
exports['setUp'] = function(test, assert) {
  // Set up agent to use the mock service manager
  config.configFiles = [
    'test-mock-service-manager.conf'
  ];

  config.setupAgent(function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_manifest_file_doesnt_exist_no_interactive'] = function(test, assert) {
  var args = {
    'insanceName': 'foobar',
    'noInteractive': true
  };

  deployCmd(args, null, function onResult(err, successMsg) {
    assert.ok(err);
    assert.match(err.message, /Failed to find a manifest file/i);
    test.finish();
  });
};

exports['test_manifest_file_exists_but_is_invalid'] = function(test, assert) {
  var testServer = null;
  var testAppPath = path.join(cwd, 'data/test_cast_app');
  var testAppDestPath = path.join(cwd, '.tests', 'test_cast_app-5432');
  var testAppManifestPath = path.join(testAppDestPath, manifestConstants.MANIFEST_FILENAME);

  var args = {
    'apppath': testAppDestPath,
    'instanceName': 'foobar',
    'noInteractive': false
  };

  async.series([
    // Create necessary directories
    async.apply(fs.mkdir, testAppDestPath, 0750),
    async.apply(fs.mkdir, '.tests/data_root/extracted', 0750),
    async.apply(fs.mkdir, '.tests/data_root/applications', 0750),
    async.apply(fs.mkdir, '.tests/data_root/services', 0750),
    async.apply(fs.mkdir, '.tests/data_root/bundles', 0750),
    async.apply(fs.mkdir, '.tests/data_root/bundles/test_cast_app', 0750),

    // Create service directory manually because runit manager insting running
    // and this directory doesn't get created
    async.apply(fs.mkdir, '.tests/data_root/services/foobar@1.0.0', 0750),

    function writeDummyManifestFile(callback) {
      fs.writeFile(testAppManifestPath, 'ponnies!', 'utf8', callback);
    },

    function callDeployCommandInvalidManifest(callback) {
      deployCmd(args, null, function onResult(err, successMsg) {
        assert.ok(err);
        assert.match(err.message, /manifest validation failed/i);
        callback();
      });
    },

    function copyTestAppData(callback) {
      fsUtil.copyTree(testAppPath, testAppDestPath, callback);
    },

    function callDeployCommandConnRefused(callback) {
      // Manifest file exists and it's valid but server is not started yet so
      // the upload command should fail.
      deployCmd(args, null, function onResult(err, message) {
        assert.ok(err);
        assert.equal(err.errno, constants.ECONNREFUSED);
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

    function callDeployCmdSuccess(callback) {
      deployCmd(args, null, function onResult(err, successMsg) {
        assert.ifError(err);
        // @TODO: Verify successMsg content
        assert.ok(successMsg);
        callback();
      });
    }
  ],

  function(err) {
    if (testServer) {
      testServer.close();
    }

    assert.ifError(err);
    test.finish();
  });
};
