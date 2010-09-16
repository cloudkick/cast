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
var exec = require('child_process').exec;
var async = require('extern/async');
var fs =  require('fs');
var test = require('util/test');

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

exports['templating to a tree'] = function(assert, beforeExit)
{
  var n = 0;

  var tmpl = {
    afile: "simple file",
    subdir: {
      "subfile": "subfile contents"
    }
  };

  misc.template_to_tree(".tests/misc/template", tmpl, false, function(error) {
    assert.equal(error, undefined);

    fs.stat('.tests/misc/template', function(err, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      n++;
    });

    fs.stat('.tests/misc/template/subdir', function(err, stats) {
      assert.ifError(err);
      assert.ok(stats.isDirectory());
      n++;
    });
  });

  beforeExit(function() {
    assert.equal(2, n, 'Checks ran');
  });
};

exports['templating to a tree throws exception on existing directory'] = function(assert, beforeExit)
{
  var n = 0;

  var tmpl = {
    afile: "simple file",
    subdir: {
      "subfile": "subfile contents"
    }
  };

  misc.template_to_tree(".tests/misc/template1", tmpl, false, function(error) {
    n++;
    assert.equal(error, undefined);

    misc.template_to_tree(".tests/misc/template1", tmpl, false, function(error) {
      n++;
      assert.equal(error.errno, 17);
      assert.match(error.message, /eexist/i);

      misc.template_to_tree(".tests/misc/template1", tmpl, true, function(error) {
        n++;
        assert.equal(error, undefined);
      });
    });
  });

  beforeExit(function() {
    assert.equal(3, n, 'Callbacks called');
  });
};

exports['trimming whitespace'] = function(assert, beforeExit)
{
  assert.equal("foo", misc.trim("foo"));
  assert.equal("foo", misc.trim(" foo"));
  assert.equal("foo", misc.trim("foo "));
  assert.equal("foo", misc.trim(" foo "));
  assert.equal("fo o", misc.trim(" fo o "));
  assert.equal("foo", misc.trim(" foo\n"));
};

exports['in array'] = function(assert, beforeExit ) {
  var haystack = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.equal(misc.in_array('item 2', haystack), true);
  assert.equal(misc.in_array('not in array', haystack), false);
};

exports['in array compare function'] = function(assert, beforeExit ) {
  var haystack = [ ['item 1', 'a'], ['item 2', 'b'], ['item 3', 'c'], ['item 4', 'd'] ];
  var compare_function = function(item, needle) {
    return item[1] === needle;
  };

  assert.equal(misc.in_array('a', haystack, null, compare_function), true);
  assert.equal(misc.in_array('not in array', haystack, null, compare_function), false);
};

exports['array find'] = function(assert, beforeExit ) {
  var haystack = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.equal(misc.array_find('item 2', haystack), 1);
  assert.equal(misc.array_find('not in array', haystack), false);
};

exports['arrays contains same elements'] = function(assert, beforeExit) {
  var array1 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];
  var array2 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];
  var array3 = [ 'item 4', 'item 3', 'item 2', 'item 1' ];
  var array4 = [ 'item 1', 'item 2' ];

  assert.equal(misc.arrays_contains_same_elements(array1, array2, true), true);
  assert.equal(misc.arrays_contains_same_elements(array1, array3, true), false);
  assert.equal(misc.arrays_contains_same_elements(array1, array3, false), true);
  assert.equal(misc.arrays_contains_same_elements(array1, array4), false);
};

exports['array is subset of'] = function(assert, beforeExit) {
  var array1 = [ 'item 1', 'item 2' ];
  var array2 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];
  var array3 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.equal(misc.array_is_subset_of(array1, array2, true), true);
  assert.equal(misc.array_is_subset_of(array2, array1, true), false);
  assert.equal(misc.array_is_subset_of(array2, array1, false), false);

  assert.equal(misc.array_is_subset_of(array2, array3, true), false);
  assert.equal(misc.array_is_subset_of(array2, array3, false), true);
  assert.equal(misc.array_is_subset_of(array3, array2, false), true);
  assert.equal(misc.array_is_subset_of(array3, array2, true), false);
};

exports['array difference'] = function(assert, beforeExit) {
  var array1 = [ 'item 1', 'item 2' ];
  var array2 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.deepEqual(misc.array_difference(array1, array2), []);
  assert.deepEqual(misc.array_difference(array2, array1), [ 'item 3', 'item 4' ]);
};

exports['filter paths'] = function(assert, beforeExit) {
  var paths1 = [ 'foo/', 'bar/', 'foo.txt', 'bar/file.tar.gz', 'bar', 'foo/bar', 'foo/test.ini', 'dir/file.tar.gz' ];
  var paths2 = [ 'foo/1.txt', 'foo/', 'foo.txt', 'bar/file.tar.gz', 'bar', 'bar', 'bar/', 'foo/bar', 'foo/test.ini',
                'dir/file.tar.gz', 'dir/file.tar.gz', 'foo/', 'foo/bar/1' ];
  var paths_filtered = [ 'bar', 'bar/', 'dir/file.tar.gz', 'foo.txt', 'foo/' ];

  assert.deepEqual(misc.filter_repeated_paths(paths1), paths_filtered);
  assert.deepEqual(misc.filter_repeated_paths(paths2), paths_filtered);
};

exports['get valid bundle name'] = function(assert, beforeExit) {
  assert.equal(misc.get_valid_bundle_name('ABC DEFG HIJ'), 'abc_defg_hij');
  assert.equal(misc.get_valid_bundle_name('test-app-name 1.0'), 'test-app-name_10');
  assert.equal(misc.get_valid_bundle_name('NodeJS Test app'), 'nodejs_test_app');
};

exports['is valid bundle version'] = function(assert, beforeExit) {
  assert.equal(misc.is_valid_bundle_version('1.0.1'), true);
  assert.equal(misc.is_valid_bundle_version('20100810'), true);
  assert.equal(misc.is_valid_bundle_version('20100912.d261151fad5b2ce95a2281a70fed2c6dab221731'), true);
  assert.equal(misc.is_valid_bundle_version('1.0'), false);
  assert.equal(misc.is_valid_bundle_version('a.b.c'), false);
};

exports.setup = function(done) {
  async.series([
    async.apply(require('util/pubsub').ensure, "config"),
    async.apply(fs.mkdir, '.tests/misc', 0700)
  ],
  done);
};
