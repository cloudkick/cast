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
  var options = {
    'remote': 'some-inexistent-remote',
    'apiVersion': API_VERSION,
    'parseJson': false,
    'expectedStatusCodes': null,
  };

  httpUtil.getApiResponse('/some-inextensitent-path', 'GET', null, options,
                          function onResponse(err, response) {
    assert.ok(err);
    assert.match(err.message, /no such remote/i);
    test.finish();
  });
};

exports['test_getApiResponse_no_api_version_arg'] = function(test, assert) {
  var options = {
    'remote': REMOTE['name'],
    'apiVersion': null,
    'parseJson': false,
    'expectedStatusCodes': null,
  };

  httpUtil.getApiResponse('/', 'GET', options, function onResponse(err, response) {
    assert.ok(err);
    assert.match(err.message, /missing value for/i);
    test.finish();
  });
};

exports['test_getApiResponse_invalid_method'] = function(test, assert) {
  var options = {
    'remote': REMOTE['name'],
    'apiVersion': API_VERSION,
    'parseJson': false,
    'expectedStatusCodes': null,
  };

  httpUtil.getApiResponse('/some-inextensitent-path', 'INVALID-METHOD', options,
                          function onResponse(err, response) {
    assert.ok(err);
    assert.match(err.message, /invalid method/i);
    test.finish();
  });
};

exports['test_getApiResponse'] = function(test, assert) {
  var server = null;
  var options = {
    'remote': REMOTE['name'],
    'apiVersion': API_VERSION,
    'parseJson': false,
    'expectedStatusCodes': null,
  };

  async.series([
    function startTestServer(callback) {
      testUtil.getTestHttpServer(REMOTE['port'], '127.0.0.1', function(server_) {
        function reqHandlerError(req, res) {
          httpUtil.returnError(res, 500, 'Test error message');
        }

        function reqHandlerBody(req, res) {
          httpUtil.returnJson(res, 200, req.body);
        }

        server_.get('/1.0/test-url', reqHandlerError);
        server_.get('/1.0/test-url-body', reqHandlerBody);
        http.configureErrorHandlers(server_);

        server = server_;
        callback();
      });
    },

    function testSuccess(callback) {
      options.parseJson = false;
      options.expectedStatusCodes = [500];

      httpUtil.getApiResponse('/test-url', 'GET', options, function onResponse(err, response) {
        assert.ifError(err);
        callback();
      });
    },

    function testUnsupportedApiVersion(callback) {
      options.apiVersion = '5.5';
      options.parseJson = false;
      options.expectedStatusCodes = null;

      httpUtil.getApiResponse('/test-url', 'GET', options, function onResponse(err, response) {
        assert.ok(err);
        assert.match(err.message, /does not support api version/i);
        callback();
      });
    },

    function testSuccessBody(callback) {
      var body = 'foo=bar';
      options.apiVersion = API_VERSION;
      options.parseJson = true;
      options.expectedStatusCodes = [200];

      httpUtil.getApiResponse('test-url-body', 'GET', body, options,
                              function onResponse(err, response) {
        assert.ifError(err);
        // @TODO @FIXME: Figure out why body parser middleware doesn't seem to
        // be working properly
        //assert.deepEqual(response.body, { 'foo': 'bar'});
        callback();
      });
    },

    function testUnexpectedStatusCode1(callback) {
      options.apiVersion = API_VERSION;
      options.parseJson = false;
      options.expectedStatusCodes = [200];

      httpUtil.getApiResponse('/some-inextensitent-path', 'GET', options,
                              function onResponse(err, response) {
        assert.ok(err);
        assert.match(err.message, /unexpected status code/i);
        callback();
      });
    },

    function testUnexpectedStatusCode2(callback) {
      options.apiVersion = API_VERSION;
      options.parseJson = true;
      options.expectedStatusCodes = [200];

      httpUtil.getApiResponse('/test-url', 'GET', options, function onResponse(err, response) {
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
