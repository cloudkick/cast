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

require.paths.unshift('../lib');

var path = require('path');
var sys = require('sys');
var assert = require('assert');
var exec = require('child_process').exec;
var config = require('util/config');
var async = require('extern/async');

// Alias deepEqual as eql for complex equality

assert.eql = assert.deepEqual;

/**
 * Assert that `val` is null.
 *
 * @param {Mixed} val
 * @param {String} msg
 */

assert.isNull = function(val, msg) {
    assert.strictEqual(null, val, msg);
};

/**
 * Assert that `val` is not null.
 *
 * @param {Mixed} val
 * @param {String} msg
 */

assert.isNotNull = function(val, msg) {
    assert.notStrictEqual(null, val, msg);
};

/**
 * Assert that `val` is undefined.
 *
 * @param {Mixed} val
 * @param {String} msg
 */

assert.isUndefined = function(val, msg) {
    assert.strictEqual(undefined, val, msg);
};

/**
 * Assert that `val` is not undefined.
 *
 * @param {Mixed} val
 * @param {String} msg
 */

assert.isDefined = function(val, msg) {
    assert.notStrictEqual(undefined, val, msg);
};

/**
 * Assert that `obj` is `type`.
 *
 * @param {Mixed} obj
 * @param {String} type
 * @api public
 */

assert.type = function(obj, type, msg){
    var real = typeof obj;
    msg = msg || 'typeof ' + sys.inspect(obj) + ' is ' + real + ', expected ' + type;
    assert.ok(type === real, msg);
};

/**
 * Assert that `str` matches `regexp`.
 *
 * @param {String} str
 * @param {RegExp} regexp
 * @param {String} msg
 */

assert.match = function(str, regexp, msg) {
    msg = msg || sys.inspect(str) + ' does not match ' + sys.inspect(regexp);
    assert.ok(regexp.test(str), msg);
};

/**
 * Assert that `val` is within `obj`.
 *
 * Examples:
 *
 *    assert.includes('foobar', 'bar');
 *    assert.includes(['foo', 'bar'], 'foo');
 *
 * @param {String|Array} obj
 * @param {Mixed} val
 * @param {String} msg
 */

assert.includes = function(obj, val, msg) {
    msg = msg || sys.inspect(obj) + ' does not include ' + sys.inspect(val);
    assert.ok(obj.indexOf(val) >= 0, msg);
};

/**
 * Assert length of `val` is `n`.
 *
 * @param {Mixed} val
 * @param {Number} n
 * @param {String} msg
 */

assert.length = function(val, n, msg) {
    msg = msg || sys.inspect(val) + ' has length of ' + val.length + ', expected ' + n;
    assert.equal(n, val.length, msg);
};

process.nextTick(function() {
  if (process.argv.length !== 3) {
    sys.puts('No test file specified');
    process.exit(1);
  }

  config.config_files = [
    "~/.xxx_no_such_file",
    path.join(__dirname, "test.conf")
  ];

  async.series([
    async.apply(exec, 'rm -rf .tests'),
    async.apply(exec, 'mkdir .tests'),
    async.apply(config.setup_agent)
  ],
  function(err) {
    if (err) {
      throw new Error('Error during test configuration');
    }

    // Do a few basic sanity checks on the config to make sure its not broken
    var conf = config.get();
    assert.equal(49443, conf.port);
    assert.equal(".tests/data_root", conf.data_root);

    var tp = process.argv[2].replace(/\.js$/, '');
    require(tp);
  });
});
