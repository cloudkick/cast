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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var http = require('services/http');
var dotfiles = require('util/client_dotfiles');
var testUtil = require('util/test');
var testConstants = require('./../constants');

var getServer = http.getAndConfigureServer;
var DEFAULT_REMOTE = testConstants.AVAILABLE_REMOTES['localhost_http1'];

exports['test_ca_http_endpoint'] = function(test, assert) {
  var remote = {
      'url': sprintf('%s://%s:%s', DEFAULT_REMOTE.protocol, DEFAULT_REMOTE.ip,
                                   DEFAULT_REMOTE.port),
      'hostname': DEFAULT_REMOTE.hostname,
      'port': DEFAULT_REMOTE.port,
      'name': 'test-ca',
      'fingerprint': 'abcd',
      'is_default': true,
      'global': true
    };

    var certOpts = {
      'hostname': 'localhost',
      'email': 'test@localhost.dev'
    };

  async.waterfall([
    function generateAgentCaCert(callback) {
      ca.getCA().init(callback);
    },

    function testListRequestsIsEmpty(callback) {
      var req = testUtil.getReqObject('/ca', 'GET', testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        // At the beginning there should be no requests
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, []);
        callback();
      });
    },

    function testAddRequestInvalidHostname(callback) {
      var req = testUtil.getReqObject('/ca/localhost.$/', 'PUT', testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        // At the beginning there should be no requests
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /invalid hostname/i);
        callback();
      });
    },

    function testAddRequestInvalidCSR(callback) {
      var req = testUtil.getReqObject('/ca/localhost.test/', 'PUT', testConstants.API_VERSION);
      req.body = 'invalidcsr';

      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 500);
        assert.match(res.body.message, /invalid csr/i);
        callback();
      });
    },

    function createTestCSR(callback) {
      function getherCertOpts(callback) {
        callback(null, certOpts);
      }

      dotfiles.ensureRemoteCSR(remote, getherCertOpts, callback);
    },

    function onCertGenerated(callback) {
      // Read the csr file
      dotfiles.loadRemoteCSR(remote, callback);
    },

    function testAddRequestValidCSR(csrBuf, callback) {
      var req = testUtil.getReqObject('/ca/localhost.test/', 'PUT', testConstants.API_VERSION);
      req.body = csrBuf.toString('utf8');

      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 202);
        assert.match(res.body.status, /awaiting approval/i);
        callback();
      });
    },

    function testSignRequestInvalidHostname(callback) {
      var req = testUtil.getReqObject('/ca/localhost.test.$/sign/', 'POST', testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /invalid hostname/i);
        callback();
      });
    },

  function testSignRequestSuccess(callback) {
      var req = testUtil.getReqObject('/ca/localhost.test/sign/', 'POST', testConstants.API_VERSION);

      assert.responseJson(getServer(), req, function(res) {
        assert.equal(res.statusCode, 200);
        assert.match(res.body.signed, /true/i);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
