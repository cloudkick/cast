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

var async = require('async');

var misc = require('util/misc');

exports['test_object_merge'] = function(test, assert) {
  var a = {foo: 1};
  var b = {bar: 2};
  var c = {foo: 1, bar: 2};
  var out = misc.merge(a, b);
  assert.deepEqual(c, out);
  out = misc.merge(out, {});
  assert.deepEqual(c, out);
  out = misc.merge({}, out);
  assert.deepEqual(c, out);
  test.finish();
};

exports['test_empty_object_merge'] = function(test, assert) {
  var a = {};
  var b = {};
  var c = {};
  var out = misc.merge(a, b);
  assert.deepEqual(c, out);
  test.finish();
};

exports['test_empty_expanduser'] = function(test, assert) {
  var out = misc.expanduser("/foo/bar");
  assert.equal("/foo/bar", out);
  test.finish();
};

exports['test_expanduser_on_self'] = function(test, assert) {
  var out = misc.expanduser("~/foo/bar");
  assert.equal(process.env.HOME+"/foo/bar", out);
  test.finish();
};

exports['test_expanduser_on_nothing'] = function(test, assert) {
  var path = require('path');
  var out = misc.expanduser("~");
  assert.equal(path.join(process.env.HOME, "/"), out);
  test.finish();
};

exports['test_expanduser_with_home_unset_hack'] = function(test, assert) {
  var n = 0;
  var orig = process.env.HOME;
  delete process.env.HOME;
  try {
    var out = misc.expanduser("~");
  }
  catch (e1) {
    n++;
    assert.match(e1, /was undefined/);
  }
  process.env.HOME = orig;
  assert.equal(1, n, 'Exceptions thrown');
  test.finish();
};

exports['test_expanduser_missing_getpwnam'] = function(test, assert) {
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

  assert.equal(2, n, 'Exceptions thrown');
  test.finish();
};

exports['test_trim_whitespace'] = function(test, assert) {
  assert.equal("foo", misc.trim("foo"));
  assert.equal("foo", misc.trim(" foo"));
  assert.equal("foo", misc.trim("foo "));
  assert.equal("foo", misc.trim(" foo "));
  assert.equal("fo o", misc.trim(" fo o "));
  assert.equal("foo", misc.trim(" foo\n"));
  test.finish();
};

exports['test_inArray_simple'] = function(test, assert) {
  var haystack = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.equal(misc.inArray('item 2', haystack), true);
  assert.equal(misc.inArray('not in array', haystack), false);
  test.finish();
};

exports['test_in_array_compare_function'] = function(test, assert) {
  var haystack = [ ['item 1', 'a'], ['item 2', 'b'], ['item 3', 'c'], ['item 4', 'd'] ];
  function compareFunction(item, needle) {
    return item[1] === needle;
  }

  assert.equal(misc.inArray('a', haystack, null, compareFunction), true);
  assert.equal(misc.inArray('not in array', haystack, null, compareFunction), false);
  test.finish();
};

exports['test_arrayFind'] = function(test, assert) {
  var haystack = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.equal(misc.arrayFind('item 2', haystack), 1);
  assert.equal(misc.arrayFind('not in array', haystack), false);
  test.finish();
};

exports['test_arrayContaintsSameElements'] = function(test, assert) {
  var array1 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];
  var array2 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];
  var array3 = [ 'item 4', 'item 3', 'item 2', 'item 1' ];
  var array4 = [ 'item 1', 'item 2' ];

  assert.equal(misc.arraysContainsSameElements(array1, array2, true), true);
  assert.equal(misc.arraysContainsSameElements(array1, array3, true), false);
  assert.equal(misc.arraysContainsSameElements(array1, array3, false), true);
  assert.equal(misc.arraysContainsSameElements(array1, array4), false);
  test.finish();
};

exports['test_arrayisSubsetOf'] = function(test, assert) {
  var array1 = [ 'item 1', 'item 2' ];
  var array2 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];
  var array3 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.equal(misc.arrayIsSubsetOf(array1, array2, true), true);
  assert.equal(misc.arrayIsSubsetOf(array2, array1, true), false);
  assert.equal(misc.arrayIsSubsetOf(array2, array1, false), false);

  assert.equal(misc.arrayIsSubsetOf(array2, array3, true), false);
  assert.equal(misc.arrayIsSubsetOf(array2, array3, false), true);
  assert.equal(misc.arrayIsSubsetOf(array3, array2, false), true);
  assert.equal(misc.arrayIsSubsetOf(array3, array2, true), false);
  test.finish();
};

exports['test_difference'] = function(test, assert) {
  var array1 = [ 'item 1', 'item 2' ];
  var array2 = [ 'item 1', 'item 2', 'item 3', 'item 4' ];

  assert.deepEqual(misc.arrayDifference(array1, array2), []);
  assert.deepEqual(misc.arrayDifference(array2, array1), [ 'item 3', 'item 4' ]);
  test.finish();
};

exports['test_filterRepeatedPaths'] = function(test, assert) {
  var paths1 = [ 'foo/', 'bar/', 'foo.txt', 'bar/file.tar.gz', 'bar', 'foo/bar', 'foo/test.ini', 'dir/file.tar.gz' ];
  var paths2 = [ 'foo/1.txt', 'foo/', 'foo.txt', 'bar/file.tar.gz', 'bar', 'bar', 'bar/', 'foo/bar', 'foo/test.ini',
                'dir/file.tar.gz', 'dir/file.tar.gz', 'foo/', 'foo/bar/1' ];
  var pathsFiltered = [ 'bar', 'bar/', 'dir/file.tar.gz', 'foo.txt', 'foo/' ];

  assert.deepEqual(misc.filterRepeatedPaths(paths1), pathsFiltered);
  assert.deepEqual(misc.filterRepeatedPaths(paths2), pathsFiltered);
  test.finish();
};

exports['test_getValidBundleName'] = function(test, assert) {
  assert.equal(misc.getValidBundleName('ABC DEFG HIJ'), 'abc_defg_hij');
  assert.equal(misc.getValidBundleName('test-app-name 1.0'), 'test-app-name_10');
  assert.equal(misc.getValidBundleName('NodeJS Test app'), 'nodejs_test_app');
  test.finish();
};

exports['test_isValidBundleVersion'] = function(test, assert) {
  assert.equal(misc.isValidBundleVersion('1.0.1'), true);
  assert.equal(misc.isValidBundleVersion('20100810'), true);
  assert.equal(misc.isValidBundleVersion('20100912.d261151fad5b2ce95a2281a70fed2c6dab221731'), true);
  assert.equal(misc.isValidBundleVersion('1.0'), true);
  assert.equal(misc.isValidBundleVersion('a.b.c'), true);
  assert.equal(misc.isValidBundleVersion('a.b@c'), false);
  test.finish();
};

exports['test_getExportedMember'] = function(test, assert) {
  var modulePath = __filename;

  async.parallel([
    function testGetFailedToLoadModule(callback) {
      misc.getExportedMember('/some/unknown/path-foo-bar', 'member', function(err, value) {
        assert.ok(err);
        assert.match(err.message, /failed to load module/i);
        callback();
      });
    },

    function testGetNull(callback) {
      misc.getExportedMember(modulePath, 'member', function(err, value) {
        assert.ifError(err);
        assert.equal(value, null);
        callback();
      });
    },

    function testGetSuccess(callback) {
      misc.getExportedMember(modulePath, 'test_getExportedMember', function(err, value) {
        assert.ifError(err);
        assert.ok((typeof value === 'function'));
        callback();
      });
    },

    function testGetRelativePath(callback) {
      misc.getExportedMember('simple/util-misc.js', 'test_getExportedMember', function(err, value) {
        assert.ifError(err);
        assert.ok((typeof value === 'function'));
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

exports['test_filterObjectValues'] = function(test, assert) {
  var obj = {
    'foo': 'bar',
    'bar': null,
    'bar1': undefined,
    'bar2': '',
    'bar3': 3
  };

  var expectedObj = {
    'foo': 'bar',
    'bar2': '',
    'bar3': 3
  };

  assert.deepEqual(misc.filterObjectValues(obj, [null, undefined]),
                   expectedObj);
  test.finish();
};

exports['test_filterList'] = function(test, assert) {
  var i, len, item;
  var values = [
    [
      [ {'a': 1}, {'a': 1}, {'c': 2}, {'d': '1'}, {'a': '1'} ],
      [ {'a': 1}, {'a': 1} ],
      [ 'a', 1]
    ],
    [
      [ {'a': 'a'}, {'a': 'b'}, {'a': 2}],
      [ {'a': 'a'} ],
      [ 'a', 'a' ]
    ]
  ];

  for (i = 0, len = values.length; i < len; i++) {
    item = values[i];
    assert.deepEqual(misc.filterList(item[0], item[2][0], item[2][1]),
                     item[1]);
  }

  test.finish();
};
