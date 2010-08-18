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


exports['rmtree relative path'] = function(assert, beforeExit) {
  var n = 0;
  async.series([
    async.apply(exec, 'mkdir -p .tests/a/b/c/d'),
    async.apply(exec, 'touch .tests/a/bc'),
    async.apply(exec, 'mkdir .tests/a/cd'),
    function(callback) {
      console.log('HERE');
      fsutil.rmtree('.tests/a', function(err) {
        console.log('THERE');
        assert.ifError(err);
        fs.stat('.tests/a', function(err, stats) {
          n++;
          assert.ok(err);
        });
      });
    }
  ],
  function() {
    n++;
  });

  beforeExit(function() {
    assert.equal(2, n);
  });
};

exports['mkdir path has regular file'] = function(assert, beforeExit) {
  var n = 0;
  fs.writeFile('.tests/baz', 'test', function(err) {
    assert.ifError(err);
    n++;
    fsutil.mkdir('.tests/baz/foo', 0700, function(err) {
      assert.match(err.message, /File exists/);
      n++;
      fs.stat('.tests/baz', function(err, stats) {
        assert.ok(!stats.isDirectory());
        n++;
      });
    });
  });
  fs.writeFile('.tests/fuz', 'test', function(err) {
    assert.ifError(err);
    n++;
    fsutil.mkdir('.tests/fuz', 0700, function(err) {
      assert.match(err.message, /File exists/);
      n++;
      fs.stat('.tests/baz', function(err, stats) {
        assert.ok(!stats.isDirectory());
        n++;
      });
    });
  });
  beforeExit(function() {
    assert.equal(6, n);
  });
};

exports['mkdir relative path'] = function(assert, beforeExit) {
  var n = 0;
  fsutil.mkdir('.tests/foo/bar/foozle', 0700, function(err) {
    assert.ifError(err);
    n++;
    fs.stat('.tests/foo', function(err0, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.tests/foo/bar', function(err1, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.tests/foo/bar/foozle', function(err2, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
  });
  beforeExit(function() {
    assert.equal(4, n);
  });
};

exports['mkdir absolute path'] = function(assert, beforeExit) {
  var n = 0;
  var abspath = path.join(process.cwd(), '.tests/bar/foo/bazzle');
  fsutil.mkdir(abspath, 0700, function(err) {
    assert.ifError(err);
    n++
    fs.stat('.tests/bar', function(err0, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.tests/bar/foo', function(err1, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.tests/bar/foo/bazzle', function(err2, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
  });
  beforeExit(function() {
    assert.equal(4, n);
  });
};

exports['mkdir implicit perms'] = function(assert, beforeExit) {
  var n = 0;
  fsutil.mkdir('.tests/whammy/bar', function(err) {
    assert.ifError(err);
    n++;
    fs.stat('.tests/whammy', function(err0, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0755);
      n++;
    });
    fs.stat('.tests/whammy/bar', function(err1, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0755);
      n++;
    });
  });
  beforeExit(function() {
    assert.equal(3, n);
  });
};

exports.setup = function(done) {
  async.series([
    async.apply(exec, 'rm -rf .tests'),
    async.apply(fs.mkdir, '.tests', 0700)
  ],
  done);
};
