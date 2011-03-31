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

var async = require('async');

var fsutil = require('util/fs');
var assert = require('./../assert');

var PATH1 = '.tests/utilfs/foo';
var PATH1_SUBDIR = '.tests/utilfs/foo/bar';
var PATH2 = '.tests/utilfs/bar/baz';
var PATH3 = '.tests/utilfs/baz/buz';
var PATH4 = '.tests/utilfs/whammy';

exports['test_mkdir_file_exists'] = function() {
  async.series([
  function(callback) {
    fs.mkdir, '.tests/utilfs', 0700, function(err) {
      callback();
    }
  },

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
  }],

  function(err) {
   // assert.ifError(err);
  });
};

exports['test_recursive_mkdir_relative_path'] = function() {
  async.series([
  async.apply(fsutil.mkdir, PATH2, 0700),

  // Make sure it worked
  function(callback) {
    fs.stat(PATH2, function(err, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      callback();
    });
  }],

  function(err) {
    assert.ifError(err);
  });
};

exports['test_recursive_mkdir_absolute_path'] = function() {
  async.series([
  async.apply(fsutil.mkdir, path.join(process.cwd(), PATH3), 0700),

  // Make sure it worked
  function(callback) {
    fs.stat(PATH3, function(err, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      callback();
    });
  }],

  function(err) {
    assert.ifError(err);
  });
};

exports['test_mkdir_implicit_perms'] = function() {
  async.series([
  async.apply(fsutil.mkdir, PATH4),

  // Make sure it worked
  function(callback) {
    fs.stat(PATH4, function(err, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      //assert.equal(stats.mode & 0777, 0755);
      callback();
    });
  }],

  function(err) {
    assert.ifError(err);
  });
};
