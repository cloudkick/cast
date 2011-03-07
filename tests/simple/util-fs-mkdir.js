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
var fsutil = require('util/fs');
var async = require('extern/async');
var assert = require('assert');

(function() {
  var PATH1 = '.tests/utilfs/foo';
  var PATH1_SUBDIR = '.tests/utilfs/foo/bar';
  var PATH2 = '.tests/utilfs/bar/baz';
  var PATH3 = '.tests/utilfs/baz/buz';
  var PATH4 = '.tests/utilfs/whammy';
  var completed = false;

  async.series([
    async.apply(fs.mkdir, '.tests/utilfs', 0700),

    // Create a file
    async.apply(fs.writeFile, PATH1, 'test'),

    // Attempt to create a directory at the same path
    function(callback) {
      fsutil.mkdir(PATH1, function(err) {
        assert.ok(err);
        assert.match(err.message, /File exists/);
        callback();
      });
    },

    // Make sure the file still exists
    function(callback) {
      fs.stat(PATH1, function(err, stats) {
        assert.ifError(err);
        assert.ok(!stats.isDirectory());
        callback();
      });
    },

    // Attempt to create a directory within the file
    function(callback) {
      fsutil.mkdir(PATH1_SUBDIR, function(err) {
        assert.ok(err);
        assert.match(err.message, /File exists/);
        callback();
      });
    },

    // Make sure the file still exists
    function(callback) {
      fs.stat(PATH1, function(err, stats) {
        assert.ifError(err);
        assert.ok(!stats.isDirectory());
        callback();
      });
    },

    // Recursive mkdir at a relative path
    async.apply(fsutil.mkdir, PATH2, 0700),

    // Make sure it worked
    function(callback) {
      fs.stat(PATH2, function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        assert.equal(stats.mode & 0777, 0700);
        callback();
      });
    },

    // Recursive mkdir at an absolute path
    async.apply(fsutil.mkdir, path.join(process.cwd(), PATH3), 0700),

    // Make sure it worked
    function(callback) {
      fs.stat(PATH3, function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        assert.equal(stats.mode & 0777, 0700);
        callback();
      });
    },

    // Mkdir with implicit perms
    async.apply(fsutil.mkdir, PATH4),

    // Make sure it worked
    function(callback) {
      fs.stat(PATH4, function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        //assert.equal(stats.mode & 0777, 0755);
        callback();
      });
    }
  ],

  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
