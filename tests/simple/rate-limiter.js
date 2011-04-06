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

var misc = require('util/misc');
var rateLimiter = require('util/rate-limiter');

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
};

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
  var limiter = new rateLimiter.RateLimiter();

  try {
    limiter.removeLimit(/test-inexistent-path/, 'get', 10, 100, false);
  } catch(err) {
    assert.match(err, /does not exist/);
    return;
  }

  assert.ok(false, 'exception was not thrown');
};

exports['test_addLimit_throws_exception_on_invalid_limit_values'] = function() {
  var limiter = new rateLimiter.RateLimiter();

  try {
    limiter.addLimit(/test/, 'get', -1, 1, false);
  } catch(err) {
    assert.match(err.message, /must be bigger or equal to 1/);
    return;
  }

  try {
    limiter.addLimit(/test/, 'get', 1, -1, false);
  } catch(err2) {
    assert.match(err2.message, /must be bigger or equal to 1/);
    return;
  }

  assert.ok(false, 'exception was not thrown');
};

exports['test_resetIpAddressAccessCounter_success'] = function() {
  var key;
  var path = '/test-path/';
  var method = 'GET';
  var ipAddress = '127.0.0.4';

  var limiter = new rateLimiter.RateLimiter();
  limiter.addLimit(path, method, 2, 500);

  key = limiter._getKeyForLimit(path, method);

  limiter._limitsData[key][ipAddress] = {
    'access_count': 5,
    'expire': misc.getUnixTimestamp() + 100
  };

  assert.equal(limiter._limitsData[key][ipAddress]['access_count'], 5);
  limiter.resetIpAddressAccessCounter(path, method, ipAddress);
  assert.equal(limiter._limitsData[key][ipAddress]['access_count'], 0);
};

exports['test_resetIpAddressAccessCounter_no_recorded_data'] = function() {
  var path = '/test-path/';
  var method = 'GET';
  var ipAddress = '127.0.0.4';

  var limiter = new rateLimiter.RateLimiter();
  limiter.addLimit(path, method, 2, 500);

  try {
    limiter.resetIpAddressAccessCounter(path, method, ipAddress);
  } catch(err) {
    assert.match(err.message, /no recorded data/i);
    return;
  }

  assert.ok(false, 'exception was not thrown');
};

exports['test_processLimit_no_drop'] = function() {
  var wroteHeaders = [];
  var wroteResponses = [];
  var callbackCalled = false;
  var key;

  var limiter = new rateLimiter.RateLimiter();

  var mockRequest = {
    'url': '/test',
    'method': 'GET',
    'socket': { 'remoteAddress': '127.0.0.2' }
  };

  function writeHead(code, headers) {
    wroteHeaders.push([code, headers]);
  }

 function end(body) {
   wroteResponses.push(body);
 }

 function callback() {
   callbackCalled = true;
 }

  var mockResponse = {
    'writeHead': writeHead,
    'end': end
  };

  key = limiter._getKeyForLimit('/test', 'GET');

  limiter.processRequest(mockRequest, mockResponse, callback);
  assert.ok(callbackCalled);
};

exports['test_processLimit_request_dropped'] = function() {
  var wroteHeaders = [];
  var wroteResponses = [];
  var callbackCalledCount = 0;
  var key1, key2;
  var now, methods, methodsLen, method;

  var limiter = new rateLimiter.RateLimiter();
  limiter.addLimit('/test-path/', 'GET', 2, 500);
  limiter.addLimit('/test-path-all/', 'all', 2, 500);

  var mockRequest1 = {
    'url': '/test-path/',
    'method': 'GET',
    'socket': { 'remoteAddress': '127.0.0.2' }
  };

  var mockRequest2 = {
    'url': '/test-path/',
    'method': 'POST',
    'socket': { 'remoteAddress': '127.0.0.3' }
  };

  var mockRequest3 = {
    'url': '/test-path/',
    'method': 'POST',
    'socket': { 'remoteAddress': '127.0.0.2' }
  };

  var mockRequest4 = {
    'url': '/test-path-all/',
    'method': null,
    'socket': { 'remoteAddress': '127.0.0.2' }
  };

  function writeHead(code, headers) {
    wroteHeaders.push([code, headers]);
  }

 function end(body) {
   wroteResponses.push(body);
 }

 function callback() {
   callbackCalledCount++;
 }

  var mockResponse = {
    'writeHead': writeHead,
    'end': end
  };

  var methods = ['head', 'post', 'delete', 'get', 'put'];

  key1 = limiter._getKeyForLimit('/test-path/', 'GET');
  key2 = limiter._getKeyForLimit('/test-path-all/', 'all');

  assert.equal(Object.keys(limiter._limitsData[key1]).length, 0);
  for (var i = 0; i < 5; i++) {
    limiter.processRequest(mockRequest1, mockResponse, callback);

    assert.equal(limiter._limitsData[key1]['127.0.0.2']['access_count'], i + 1);
    if (i < 2) {
      assert.equal(callbackCalledCount, i + 1);
      assert.equal(Object.keys(limiter._limitsData[key1]).length, 1);
    }
    else {
      assert.equal(callbackCalledCount, 2);
    }
  }

  assert.equal(wroteHeaders.length, 3);
  assert.equal(wroteHeaders[0][0], 403);
  assert.equal(wroteResponses.length, 3);

  // Verify that method is checked correctly
  assert.equal(callbackCalledCount, 2);
  limiter.processRequest(mockRequest3, mockResponse, callback);
  assert.equal(callbackCalledCount, 3);

  assert.equal(callbackCalledCount, 3);
  limiter.processRequest(mockRequest2, mockResponse, callback);
  assert.equal(Object.keys(limiter._limitsData[key1]).length, 2);
  assert.equal(callbackCalledCount, 4);

  now = misc.getUnixTimestamp();
  assert.ok((limiter._limitsData[key1]['127.0.0.2']['expire'] - now) > 50);

  limiter.processRequest(mockRequest1, mockResponse, callback);
  assert.equal(callbackCalledCount, 4);

  limiter.resetIpAddressAccessCounter('/test-path/', 'GET', '127.0.0.2');
  limiter.processRequest(mockRequest1, mockResponse, callback);
  assert.equal(callbackCalledCount, 5);

  // Verify that 'all' matches all the HTTP methods
  methodsLen = methods.length;
  for (i = 0; i < methodsLen; i++) {
    method = methods[i];
    mockRequest4['method'] = method;
    limiter.processRequest(mockRequest4, mockResponse, callback);
    assert.equal(limiter._limitsData[key2]['127.0.0.2']['access_count'], i + 1);
  }
};
