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
var assert = require('assert');
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var testUtil = require('util/test');
var tarball = require('util/tarball');
var misc = require('util/misc');
var version = require('util/version');
var flowctrl = require('util/flow_control');

var cwd = process.cwd();

exports['test_scons_install_and_uninstall'] = function(test, assert) {
  var versionString = version.toString().replace('-dev', '').replace('-release', '');
  var tarballname = sprintf('%s.tar.gz', versionString);
  var tarballPath = path.join(cwd, 'dist', tarballname);
  var extractPath = path.join(cwd, 'tmp');

  var castDataRoot = path.join(cwd, 'tmp-install');
  var castBinPath = path.join(cwd, 'tmp-bin');
  var castSettingsPath = path.join(cwd, 'tmp-settings');

  var installCmd = sprintf('scons install PREFIX="%s" CASTPREFIX="%s" ' +
                           '--settings-path="%s" --use-system-node',
                           castBinPath, castDataRoot, castSettingsPath);
  var uninstallCmd = sprintf('scons uninstall PREFIX="%s" CASTPREFIX="%s" ' +
                             '--settings-path="%s" --remove-settings',
                             castBinPath, castDataRoot, castSettingsPath);

  var configPath = path.join(castSettingsPath, 'config.json');
  var expectedFilePaths = [ 'tmp-bin/cast', 'tmp-bin/cast-agent',
                            'tmp-install/cast', 'tmp-install/data',
                            castSettingsPath, configPath ];
  var expectedConfigLines = [
    sprintf('"data_root": "%s/data",', castDataRoot),
    '"service_dir_enabled": "services-enabled"'
  ];

  async.series([
    // Create distribution tarball
    function(callback) {
      exec('scons dist --no-deps', function(err, stdout, stderr) {
        assert.ifError(err);
        callback();
      });
    },

    // Extract the tarball
    function(callback) {
      // Make sure the distribution tarball has been created
      assert.ok(testUtil.fileExists(tarballPath));
      tarball.extractTarball(tarballPath, extractPath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Run install script
    function(callback) {
      // TODO: Verify that files which should be installed dont exist yet
      exec(sprintf('cd tmp ; %s', installCmd), function(err, stdout,
                                                        stderr) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify that all the folders and files were created
    function(callback) {
      var i, filePath, configContent, configLine;
      // Verify that client and agent symlinks have been created
      // Verify that the config file has been created
      for (i = 0; i < expectedFilePaths.length; i++) {
        filePath = expectedFilePaths[i];

        if (filePath.charAt(0) !== '/') {
          filePath = path.join(cwd, filePath);
        }

        assert.ok(testUtil.fileExists(filePath), filePath);
      }

      // Very config file content
      configContent = fs.readFileSync(configPath, 'utf8');
      for (i = 0; i < expectedConfigLines.length; i++) {
        configLine = expectedConfigLines[i];
        assert.ok(configContent.indexOf(configLine) !== -1);
      }

      // Verify that Cast client can be called
      exec('./tmp-install/cast/bin/cast', function(err, stdout, stderr) {
        assert.ifError(err);
        assert.ok(!stderr);
        assert.ok(stdout);
        callback();
      });
    },

    // Run uninstall
    function(callback) {
      exec(sprintf('cd tmp/ ; %s', uninstallCmd), function(err, stdout, stderr) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify that all the files including config were removed
    function(callback) {
      var i, filePath;

      for (i = 0; i < expectedFilePaths.length; i++) {
        filePath = expectedFilePaths[i];

        if (filePath.charAt(0) !== '/') {
          filePath = path.join(cwd, filePath);
        }

        assert.ok(!testUtil.fileExists(filePath), filePath);
      }

      callback();
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
