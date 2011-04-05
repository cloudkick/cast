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

var assert = require('assert');

var rateLimiter = require('util/rate-limiter');
var limiter;

exports['test_add_new_limit_success'] = function() {
  var limiter = new rateLimiter.RateLimiter();
  var path1 = /\/foo bar/, path2 = /\/foo bar\/test\//;
  var method1 = 'GET', method2 = 'all';
  var key1, key2;

  limiter.addLimit(path1, method1, 10, 100, false);
  limiter.addLimit(path2, method2, 10, 60, false);

  key1 = limiter._getKeyForLimit(path1, method1);
  key2 = limiter._getKeyForLimit(path2, method2);

  assert.ok(limiter._limits.hasOwnProperty(key1));
  assert.ok(limiter._limits.hasOwnProperty(key2));
  assert.ok(limiter._limitsData.hasOwnProperty(key1));
  assert.ok(limiter._limitsData.hasOwnProperty(key2));
};

exports['test_new_limit_already_exists'] = function() {
  var limiter = new rateLimiter.RateLimiter();
  var path1 = /\/foo bar/;
  var method1 = 'GET';

  limiter.addLimit(path1, method1, 10, 100, false);
  try {
    limiter.addLimit(path1, method1, 10, 100, false);
  } catch(err) {
    assert.ok(true);
    return;
  }

  assert.ok(false, 'Exception was not thrown');
};

exports['test_new_limit_invalid_method'] = function() {
  var limiter = new rateLimiter.RateLimiter();
  var path1 = /\/foo bar/;
  var method1 = 'invalid-method';

  try {
    limiter.addlimit(path1, method1, 10, 100, false);
  } catch(err) {
    assert.ok(true);
    return;
  }

  assert.ok(false, 'exception was not thrown');
}

exports['test_remove_limit_succcess'] = function() {
  var limiter = new rateLimiter.RateLimiter();
  var path1 = /\/foo bar/;
  var method1 = 'put';
  var key1;

  key1 = limiter._getKeyForLimit(path1, method1);

  limiter.addLimit(path1, method1, 10, 100, false);
  assert.ok(limiter._limits.hasOwnProperty(key1));
  assert.ok(limiter._limitsData.hasOwnProperty(key1));

  limiter.removeLimit(path1, method1);
  assert.ok(!limiter._limits.hasOwnProperty(key1));
  assert.ok(!limiter._limitsData.hasOwnProperty(key1));
};

exports['test_remove_limit_does_not_exist'] = function() {
  try {
    limiter.removeLimit(/test-inexistent-path/, 'get', 10, 100, false);
  } catch(err) {
    assert.ok(true);
    return;
  }

  assert.ok(false, 'exception was not thrown');
};

exports['test_processLimit_no_drop'] = function() {
  var mockRequest = {
    'url': '/test',
    'method': 'GET',
    'socket': { 'remoteAddress': '127.0.0.2' }
  };

  var mockResponse = {
  };
};
