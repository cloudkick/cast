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
var exec = require('child_process').exec;

var sprintf = require('sprintf').sprintf;
var async = require('async');

var config = require('util/config');
var fsUtil = require('util/fs');
var dotfiles = require('util/client_dotfiles');

var cwd = process.cwd();

function setUp(callback) {
  var testFolderPath = path.join(__dirname, '.tests');
  var testDataRoot = path.join(testFolderPath, 'data_root');
  var caPath = path.join(testDataRoot, 'ca');
  var caOutPath = path.join(caPath, 'out');

  var directoriesToCreate = [testFolderPath, testDataRoot, caOutPath];

  async.series([
    function mockDefaultRemotesPath(callback) {
      // Mock the default remotes path
      dotfiles.setDotCastRemotesPath(path.join(cwd, 'data/remotes.json'));
      callback();
    },

    function setConfigFiles(callback) {
      config.configFiles = [
        path.join(__dirname, 'test.conf')
      ];

      callback();
    },

    function removeTestDirectories(callback) {
      fsUtil.rmtree(testFolderPath, function(err) {
        callback();
      });
    },

    function createTestDirectories(callback) {
      async.forEachSeries(directoriesToCreate, function(directory, callback) {
        console.log(directory);
        exec(sprintf('mkdir -p "%s"', directory), function(err) {
          callback();
        });
      }, callback);
    },

    function setUpAgentConfig(callback) {
      config.setupAgent(callback);
    }
  ],

  function(err) {
    callback();
  });
}

exports.setUp = setUp;
