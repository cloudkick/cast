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

var fs =  require('fs');
var path = require('path');
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var config = require('util/config');
var dotfiles = require('util/client_dotfiles');
var init = require('cast-agent/init');

var testFolderPath = path.join(__dirname, '.tests');
var testDataRoot = path.join(testFolderPath, 'data_root');
var dotCastRoot = path.join(testFolderPath, 'dot_cast');


exports['setUp'] = function(test, assert) {
  // Set a temporary remotes.json
  dotfiles.setDotCastRemotesPath(path.join(dotCastRoot, 'remotes.json'));

  // Get a config with SSL enabled
  config.configFiles = [
    path.join(__dirname, '..', 'test-ssl.conf')
  ];

  // Create the temporary dot_cast dir and reconfigure using new config
  exec(sprintf('mkdir -p "%s"', dotCastRoot), function(err) {
    assert.ifError(err);
    config.setupAgent(function(err) {
      assert.ifError(err);
      test.finish();
    });
  });
};


exports['test_agent_init'] = function(test, assert) {
  init.initialize(function(err) {
    assert.ifError(err);
    test.finish();
  });
};
