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
    async.apply(exec, 'mkdir -p .fstests/a/b/c/d'),
    async.apply(exec, 'touch .fstests/a/bc'),
    async.apply(exec, 'mkdir .fstests/a/cd'),
    function(callback) {
      fsutil.rmtree('.fstests/a', function(err) {
        assert.ifError(err);
        n++;
        fs.stat('.fstests/a', function(err, stats) {
          n++;
          assert.ok(err);
          callback();
        });
      });
    }
  ],
  function() {
    n++;
  });

  beforeExit(function() {
    assert.equal(3, n);
  });
};

exports['rmtree absolute path'] = function(assert, beforeExit) {
  var n = 0;
  async.series([
    async.apply(exec, 'mkdir -p .fstests/b/b/c/d'),
    async.apply(exec, 'touch .fstests/b/c'),
    async.apply(exec, 'mkdir .fstests/b/d'),
    function(callback) {
      var abspath = path.join(process.cwd(), '.fstests/b');
      fsutil.rmtree(abspath, function(err) {
        assert.ifError(err);
        n++;
        fs.stat('.fstests/b', function(err, stats) {
          assert.ok(err);
          n++;
          callback();
        });
      });
    }
  ],
  function() {
    n++;
  });

  beforeExit(function() {
    assert.equal(3, n);
  });
};

exports['rmtree empty directory'] = function(assert, beforeExit) {
  var n = 0;
  async.series([
    async.apply(exec, 'mkdir .fstests/c'),
    function(callback) {
      fsutil.rmtree('.fstests/c', function(err) {
        assert.ifError(err);
        n++;
        fs.stat('.fstests/c', function(err, stats) {
          assert.ok(err);
          n++;
          callback();
        });
      });
    }
  ],
  function() {
    n++;
  });

  beforeExit(function() {
    assert.equal(3, n);
  });
};

exports['rmtree nonexistant path'] = function(assert, beforeExit) {
  var n = 0;
  fsutil.rmtree('.fstests/d', function(err) {
    assert.match(err.message, /ENOENT/);
    n++;
  });
  beforeExit(function() {
    assert.equal(1, n);
  });
};

exports['rmtree no path'] = function(assert, beforeExit) {
  var n = 0;
  fsutil.rmtree('', function(err) {
    assert.match(err.message, /nothing/);
    n++;
  });
  beforeExit(function() {
    assert.equal(1, n);
  });
};

exports['mkdir path has regular file'] = function(assert, beforeExit) {
  var n = 0;
  fs.writeFile('.fstests/baz', 'test', function(err) {
    assert.ifError(err);
    n++;
    fsutil.mkdir('.fstests/baz/foo', 0700, function(err) {
      assert.match(err.message, /File exists/);
      n++;
      fs.stat('.fstests/baz', function(err, stats) {
        assert.ok(!stats.isDirectory());
        n++;
      });
    });
  });
  fs.writeFile('.fstests/fuz', 'test', function(err) {
    assert.ifError(err);
    n++;
    fsutil.mkdir('.fstests/fuz', 0700, function(err) {
      assert.match(err.message, /File exists/);
      n++;
      fs.stat('.fstests/baz', function(err, stats) {
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
  fsutil.mkdir('.fstests/foo/bar/foozle', 0700, function(err) {
    assert.ifError(err);
    n++;
    fs.stat('.fstests/foo', function(err0, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.fstests/foo/bar', function(err1, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.fstests/foo/bar/foozle', function(err2, stats) {
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
  var abspath = path.join(process.cwd(), '.fstests/bar/foo/bazzle');
  fsutil.mkdir(abspath, 0700, function(err) {
    assert.ifError(err);
    n++;
    fs.stat('.fstests/bar', function(err0, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.fstests/bar/foo', function(err1, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0700);
      n++;
    });
    fs.stat('.fstests/bar/foo/bazzle', function(err2, stats) {
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
  fsutil.mkdir('.fstests/whammy/bar', function(err) {
    assert.ifError(err);
    n++;
    fs.stat('.fstests/whammy', function(err0, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      assert.equal(stats.mode & 0777, 0755);
      n++;
    });
    fs.stat('.fstests/whammy/bar', function(err1, stats) {
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
    async.apply(require('util/pubsub').ensure, "config"),
    async.apply(exec, 'rm -rf .fstests'),
    async.apply(fs.mkdir, '.fstests', 0700)
  ],
  done);
};
