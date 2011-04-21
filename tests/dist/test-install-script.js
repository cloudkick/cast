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
var assert = require('assert');
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var test = require('util/test');
var tarball = require('util/tarball');
var misc = require('util/misc');
var version = require('util/version');
var flowctrl = require('util/flow_control');

var cwd = process.cwd();

exports['test_scons_install'] = function() {
  var versionString = version.toString().replace('-dev', '');
  var tarballname = sprintf('%s.tar.gz', versionString);
  var tarballPath = path.join(cwd, 'dist', tarballname);
  var extractPath = path.join(cwd, 'tmp');
  var installCmd = sprintf('sudo scons install PREFIX=%s --use-system-node',
                            path.join(cwd, 'tmp'));

  var expectedFilesAbsolute = [ '/usr/local/bin/cast',
                                '/usr/local/bin/cast-agent' ];

  async.series([
    // Create distribution tarball
    function(callback) {
      exec('scons dist', function(err, stdout, stderr) {
        assert.ifError(err);
        callback();
      });
    },

    // Extract the tarball
    function(callback) {
      // Make sure the distribution tarball has been created
      assert.ok(test.fileExists(tarballPath));
      tarball.extractTarball(tarballPath, extractPath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Run install script
    function(callback) {
      // TODO: Verify that files which should be installed dont exist yet
      exec(sprintf('cd tmp ; %s', installCmd), function(err, stdout, stderr) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify that all the folders and files were created
    function(callback) {
      // Verify that client and agent symlinks have been created
      assert.ok(test.fileExists(expectedFilesAbsolute[0]));
      assert.ok(test.fileExists(expectedFilesAbsolute[1]));

      // Verify that the config file has been created
      assert.ok(test.fileExists(path.join(misc.expanduser('~'),
                                '.cast/config.json')));

      // TODO: Very config content
    }
  ],

  function(err) {
    assert.ifError(err);
  });
};
