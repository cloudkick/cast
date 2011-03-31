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
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var fsutil = require('util/fs');
var assert = require('./../assert');

var createTestDirectories = function(rootName, callback) {
  // Create some nested directories and files
  async.series([
    async.apply(exec, sprintf('mkdir -p .tests/fs/%s/b/c/d', rootName)),
    async.apply(exec, sprintf('touch .tests/fs/%s/bc', rootName)),
    async.apply(exec, sprintf('mkdir .tests/fs/%s/cd', rootName)),
  ],

  // Delete them all (with a relative path)
  function(err) {
    callback();
  });
};

exports['test_rmtree_relative_path'] = function() {
  async.series([
    async.apply(createTestDirectories, 'a'),

    // Delete them all (with a relative path)
    function(callback) {
      fsutil.rmtree('.tests/fs/a', function(err) {
        assert.ifError(err);
        callback();
      });
    }],

    // Make sure they're gone
    function(err) {
      assert.ifError(err);

      fs.stat('.tests/fs/a', function(err, stats) {
        assert.ok(err);
      });
    });
};

exports['test_rmtree_absolute_path'] = function() {
  async.series([
    async.apply(createTestDirectories, 'b'),

    // Delete them all (with a absolute path)
    function(callback) {
      fsutil.rmtree(path.join(process.cwd(), '.tests/fs/b'), function(err) {
        assert.ifError(err);
        callback();
      });
    }],

    function(err) {
      assert.ifError(err);

      fs.stat('.tests/fs/b', function(err, stats) {
        assert.ok(err);
      });
    });
};

exports['test_rmtree_try_deleting_twice'] = function() {
  async.series([
    // Create an empty directory
    async.apply(exec, 'mkdir -p .tests/fsutil/c'),

    // Delete it
    function(callback) {
      fsutil.rmtree('.tests/fsutil/c', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Make sure its gone
    function(callback) {
      fs.stat('.tests/fsutil/c', function(err, stats) {
        assert.ok(err);
        callback();
      });
    },

    // Try to delete it again (should fail)
    function(callback) {
      fsutil.rmtree('.tests/fsutil/c', function (err) {
        assert.ok(err);
        assert.match(err.message, /ENOENT/);
        callback();
      });
    }],

    function(err) {
      assert.ifError(err);
    });
};

exports['test_deleting_no_path_throws_error'] = function() {
  fsutil.rmtree('', function(err) {
    assert.ok(err);
    assert.match(err.message, /ENOENT/);
  });
};
