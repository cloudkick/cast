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
var express = require('express');

var http = require('services/http');
var httpUtil = require('util/http');
var testUtil = require('util/test');
var dotfiles = require('util/client_dotfiles');
var testConstants = require('./../constants');

var API_VERSION = testConstants.API_VERSION;
var REMOTE = testConstants.AVAILABLE_REMOTES['localhost_http1'];

exports['test_getApiResponse_invalid_remote'] = function(test, assert) {
  httpUtil.getApiResponse('some-inexistent-remote', API_VERSION, '/some-inextensitent-path', 'GET',
                          null, false, null, function onResponse(err, response) {
    assert.ok(err);
    assert.match(err.message, /no such remote/i);
    test.finish();
  });
};

exports['test_getApiResponse_no_api_version_arg'] = function(test, assert) {
  httpUtil.getApiResponse(REMOTE['name'], null, '/some-inextensitent-path', 'GET',
                          null, false, null, function onResponse(err, response) {
    assert.ok(err);
    assert.match(err.message, /missing value for/i);
    test.finish();
  });
};

exports['test_getApiResponse_invalid method'] = function(test, assert) {
  httpUtil.getApiResponse(REMOTE['name'], API_VERSION, '/some-inextensitent-path',
                          'INVALID-METHOD', null, false, null, function onResponse(err, response) {
    assert.ok(err);
    assert.match(err.message, /invalid method/i);
    test.finish();
  });
};

exports['test_getApiResponse'] = function(test, assert) {
  var server = null;

  async.series([
    function startTestServer(callback) {
      testUtil.getTestHttpServer(REMOTE['port'], '127.0.0.1', function(server_) {
        function reqHandler(req, res) {
          httpUtil.returnError(res, 500, 'Test error message');
        }

        server_.get('/1.0/test-url', reqHandler);

        server = server_;
        callback();
      });
    },

    function testSuccess(callback) {
      httpUtil.getApiResponse(REMOTE['name'], API_VERSION, '/test-url', 'GET',
                            null, false, [500], function onResponse(err, response) {
        assert.ifError(err);
        callback();
      });
    },

    function testUnexpectedStatusCode1(callback) {
      httpUtil.getApiResponse(REMOTE['name'], API_VERSION, '/some-inextensitent-path', 'GET',
                            null, false, [200], function onResponse(err, response) {
        assert.ok(err);
        assert.match(err.message, /unexpected status code/i);
        callback();
      });
    },

    function testUnexpectedStatusCode2(callback) {
      httpUtil.getApiResponse(REMOTE['name'], API_VERSION, '/test-url', 'GET',
                            null, true, [200], function onResponse(err, response) {
        assert.ok(err);
        assert.match(err.message, /test error message/i);
        callback();
      });
    },

  ],

  function(err) {
    if (server) {
      server.close();
    }

    test.finish();
  });
};
