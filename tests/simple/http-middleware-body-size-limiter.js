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

var http = require('services/http');
var testUtil = require('util/test');

var bodySizeLimiter = require('http/middleware/body-size-limiter').attachMiddleware;

exports['test_body_size_limiter_middleware'] = function(test, assert) {
  var maxContentLength = 100;
  var handlerCalledCount = 0;
  var server = http.getAndConfigureServer();

  function handler(req, res) {
    handlerCalledCount++;
    if (res.socket) {
      res.writeHead(200, {});
      res.end();
    }
  }

  server.get('/test-content-length', bodySizeLimiter(100), handler);
  server.get('/test-body-size', bodySizeLimiter(5), handler);

  async.series([
    function testContentLengthTooLarge(callback) {
      var headers = {
        'Content-Length': 101
      };

      var req = {
        url: '/test-content-length',
        method: 'GET',
        headers: headers
      };

      assert.response(server, req, function(res) {
        assert.equal(res.statusCode, 413);
        assert.equal(handlerCalledCount, 0);
        callback();
      });
    },

    function testContentLengthNotTooLarge(callback) {
      var headers = {
        'Content-Length': 1
      };

      var req = {
        url: '/test-content-length',
        method: 'GET',
        headers: headers,
        body: 'a'
      };

      assert.response(server, req, function(res) {
        assert.equal(res.statusCode, 200);
        assert.equal(handlerCalledCount, 1);
        callback();
      });
    },

    function testBodyTooLarge(callback) {
      var req = {
        url: '/test-body-size',
        method: 'GET',
        headers: {'Transfer-Encoding': 'chunked'},
        body: 'foobarbarfoobarfoo'
      };

      assert.response(server, req, function(res) {
        assert.equal(res.statusCode, 413);
        assert.equal(handlerCalledCount, 2);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
