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
var exec = require('child_process').exec;
var path = require('path');
var fsutil = require('util/fs');
var async = require('extern/async');
var assert = require('assert');

(function() {
  var completed = false;

  async.series([
    // Create some nested directories and files
    async.apply(exec, 'mkdir -p .tests/fs/a/b/c/d'),
    async.apply(exec, 'touch .tests/fs/a/bc'),
    async.apply(exec, 'mkdir .tests/fs/a/cd'),

    // Delete them all (with a relative path)
    function(callback) {
      fsutil.rmtree('.tests/fs/a', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Make sure they're gone
    function(callback) {
      fs.stat('.tests/fs/a', function(err, stats) {
        assert.ok(err);
        callback();
      });
    },

    // Create some nested directories and files
    async.apply(exec, 'mkdir -p .tests/fs/a/b/c/d'),
    async.apply(exec, 'touch .tests/fs/a/bc'),
    async.apply(exec, 'mkdir .tests/fs/a/cd'),

    // Delete them all (with an absolute path)
    function(callback) {
      fsutil.rmtree(path.join(process.cwd(), '.tests/fs/a'), function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Make sure they're gone
    function(callback) {
      fs.stat('.tests/fs/a', function(err, stats) {
        assert.ok(err);
        callback();
      });
    },

    // Create an empty directory
    async.apply(exec, 'mkdir -p .tests/fsutil/a'),

    // Delete it
    function(callback) {
      fsutil.rmtree('.tests/fsutil/a', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Make sure its gone
    function(callback) {
      fs.stat('.tests/fsutil/a', function(err, stats) {
        assert.ok(err);
        callback();
      });
    },

    // Try to delete it again (should fail)
    function(callback) {
      fsutil.rmtree('.tests/fsutil/a', function (err) {
        assert.ok(err);
        assert.match(err.message, /ENOENT/);
        callback();
      });
    }
  ],
  function(err) {
    assert.ifError(err);
    completed = true;
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed.');
  });
})();
