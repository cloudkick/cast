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

var init = require('cast-agent/init');
var dotfiles = require('util/client_dotfiles');


var testFolderPath = '.tests';
var dotCastRoot = path.join(testFolderPath, 'dot_cast');


exports['setUp'] = function(test, assert) {
  // Set a temporary remotes.json
  dotfiles.setDotCastPath(dotCastRoot);
  dotfiles.setDotCastRemotesPath(path.join(dotCastRoot, 'remotes.json'));

  // Create the temporary dot_cast dir
  fs.mkdir(dotCastRoot, 0755, function(err) {
    assert.ifError(err);
    test.finish();
  });
};


exports['test_agent_init'] = function(test, assert) {
  async.series([
    // Initialize the agent
    function(callback) {
      init.initialize(function(err) {
        assert.ifError(err);
        dotfiles.getDefaultRemote(function(err, remote) {
          assert.ifError(err);
          assert.deepEqual(remote, {
            url: 'http://0.0.0.0:49443',
            hostname: '0.0.0.0',
            port: 49443,
            fingerprint: null,
            is_default: true,
            global: true,
            name: 'local'
          });
          dotfiles.loadRemoteCSR(remote, function(err, csr) {
            assert.ok(err instanceof Error);
            callback();
          });
        });
      });
    },

    // Initialize the agent again
    function(callback) {
      init.initialize(function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Empty the data root, rename the remote, try again
    function(callback) {
      function wipe(callback) {
        exec('rm -rf .tests/data_root', function(err) {
          assert.ifError(err);
          fs.mkdir('.tests/data_root', 0755, function(err) {
            assert.ifError(err);
            callback();
          });
        });
      }

      function loadRemote(callback) {
        dotfiles.getGlobalRemotes(callback);
      }

      function renameRemote(remotes, callback) {
        remotes['local'].name = 'oldlocal';
        remotes['oldlocal'] = remotes['local'];
        delete remotes['local'];
        callback(null, remotes);
      }

      function saveRemote(remotes, callback) {
        dotfiles.saveGlobalRemotes(remotes, callback);
      }

      function doTest(callback) {
        init.initialize(function(err) {
          assert.ifError(err);
          dotfiles.getGlobalRemotes(callback);
        });
      }

      function checkRemotes(remotes, callback) {
        assert.equal(remotes['local'].is_default, false);
        assert.equal(remotes['oldlocal'].is_default, true);
        callback();
      }

      var ops = [wipe, loadRemote, renameRemote, saveRemote, doTest,
                  checkRemotes];

      async.waterfall(ops, callback);
    },

    // Nuke the data root and try again
    function(callback) {
      exec("rm -rf .tests", function(err) {
        assert.ifError(err);
        init.initialize(function(err) {
          assert.ok(err);
          assert.ok(err instanceof Error);
          callback();
        });
      });
    },

    // Replace the data root with a file
    function(callback) {
      exec("touch .tests", function(err) {
        assert.ifError(err);
        init.initialize(function(err) {
          assert.ok(err);
          assert.ok(err instanceof Error);
          callback();
        });
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
