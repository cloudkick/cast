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

/*
 * TODO: Expand these tests
 *
 * In order to test the cast client properly we need to have a way to give it
 * custom remotes. Putting them in ~/.cast/remotes.json isn't an appropriate
 * solution, so we should either make that location configurable or (and I this
 * is probably a good idea one way or another) allow per-project remotes. This
 * way we could test the command for adding remotes as well.
 */

var sys = require('sys');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var port = parseInt((Math.random() * (65500 - 2000) + 2000), 10);

function getServer() {
  return require('services/http').getAndConfigureServer();
}

exports['test_remotes'] = function(test, assert) {
  var cbin = path.normalize(path.join(process.cwd(), '..', 'bin', 'cast'));
  var aroot = path.join(process.cwd(), '.tests');
  var croot = path.join(process.cwd(), '.tests/fooserv');
  var tbp = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var server = getServer();
  server.listen(port);

  var copts = {
    cwd: croot
  };

  function cexec(args, doChecks, callback) {
    if (doChecks !== false) {
      callback = doChecks;
      doChecks = true;
    }

    args.unshift(sprintf('"%s"', cbin));
    exec(args.join(' '), copts, function(err, stdout, stderr) {
      if (doChecks) {
        assert.ifError(err);
        assert.equal(stderr.length, 0);
      }
      callback(err, stdout, stderr);
    });
  }

  async.series([
    async.apply(exec, 'mkdir -p ' + aroot),

    async.apply(exec, 'tar -C "' + aroot + '" -xf "' + tbp + '"'),

    // Add a remote
    function(callback) {
      var addr = 'http://localhost:' + port + '/';
      var args = ['remotes', 'add', '-p', '-y', 'test', addr];
      cexec(args, function(err, stdout, stderr) {
        assert.match(stdout, /Remote added/);
        callback();
      });
    },

    // List remotes
    function(callback) {
      cexec(['remotes', 'list'], function(err, stdout, stderr) {
        assert.match(stdout, /test\n/);
        callback();
      });
    },

    // Set a default remote
    function(callback) {
      cexec(['remotes', 'set-default', 'test'], function(err, stdout, stderr) {
        callback();
      });
    },

    // Try to set an inexistent remote as a default
    function(callback) {
      cexec(['remotes', 'set-default', 'test-inexistent'], false, function(err, stdout, stderr) {
        assert.ok(err);
        assert.equal(err.code, 1);
        callback();
      });
    },

    // List remotes again to check the default
    function(callback) {
      cexec(['remotes', 'list'], function(err, stdout, stderr) {
        assert.match(stdout, /test \(default\)\n/);
        callback();
      });
    },

    // Create a bundle
    function(callback) {
      cexec(['bundles', 'create', 'v1.0'], function(err, stdout, stderr) {
        assert.match(stdout, /validation succeeded/);
        assert.match(stdout, /Bundle created/);
        callback();
      });
    },
  ],

  function(err) {
    server.close();
    assert.ifError(err);
    test.finish();
  });
};
