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

var misc = require('util/misc');


exports['object merge'] = function(assert, beforeExit) {
  var a = {foo: 1};
  var b = {bar: 2};
  var c = {foo: 1, bar: 2};
  var out = misc.merge(a, b);
  assert.deepEqual(c, out);
  out = misc.merge(out, {});
  assert.deepEqual(c, out);
  out = misc.merge({}, out);
  assert.deepEqual(c, out);
};

exports['empty merge'] = function(assert, beforeExit) {
  var a = {};
  var b = {};
  var c = {};
  var out = misc.merge(a, b);
  assert.deepEqual(c, out);
};

exports['empty expanduser'] = function(assert, beforeExit) {
  var out = misc.expanduser("/foo/bar");
  assert.equal("/foo/bar", out);
};

exports['expanduser on self'] = function(assert, beforeExit) {
  var out = misc.expanduser("~/foo/bar");
  assert.equal(process.env.HOME+"/foo/bar", out);
};

exports['expanduser on nothing'] = function(assert, beforeExit) {
  var path = require('path');
  var out = misc.expanduser("~");
  assert.equal(path.join(process.env.HOME, "/"), out);
};

exports['expanduser with HOME unset hack'] = function(assert, beforeExit) {
  beforeExit(function() {
    var n = 0;
    var orig = process.env.HOME;
    process.env.HOME = undefined;
    try {
      var out = misc.expanduser("~");
    }
    catch (e1) {
      n++;
      assert.match(e1, /was undefined/);
    }
    process.env.HOME = orig;
    assert.equal(1, n, 'Exceptions thrown');
  });
};


exports['missing getpwnam for expanduser'] = function(assert, beforeExit) {
  var n = 0;
  var out;
  try {
    out = misc.expanduser("~root/foo/bar");
  }
  catch (e1) {
    n++;
    assert.match(e1, /getpwnam/);
  }

  try {
    out = misc.expanduser("~root");
  }
  catch (e2) {
    n++;
    assert.match(e2, /getpwnam/);
  }

  beforeExit(function() {
    assert.equal(2, n, 'Exceptions thrown');
  });
};

exports.setup = function(done) {
  require('util/pubsub').ensure("config", done);
};
