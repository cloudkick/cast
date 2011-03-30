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

var fs =  require('fs');
var path = require('path');
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var ca = require('security/ca');
var certgen = require('security/certgen');
var assert = require('./../assert');

var TMPDIR = path.join('.tests', 'tmp');

exports['setUp'] = function(callback) {
  var testCA = ca.getCA();
  exec(sprintf('mkdir -p "%s"', TMPDIR), function(err) {
    if (err) {
      callback(err);
      return;
    }
    testCA.init(callback);
  });
};

exports['test_ca_basic_use'] = function(callback) {
  var testCA = ca.getCA();
  var reqHost = 'test.example.com';
  var keyPath = path.join(TMPDIR, 'test.key');
  var reqPath = path.join(TMPDIR, 'test.csr');
  var certPath = path.join(TMPDIR, 'test.crt');
  var badReqText = '------BEGIN CERTIFICATE REQUEST------\n' +
                   'THISREQUESTISRIDICULOUSLYINVALIDSOHAA\n' +
                   '------END CERTIFICATE REQUEST------\n';
  var reqOpts = {
    hostname: reqHost,
    email: 'foo@example.com'
  };
  var reqText;

  async.series([
    // Generate Key
    async.apply(certgen.genKey, keyPath),

    // Generate Request
    async.apply(certgen.genCSR, keyPath, reqPath, reqOpts),

    // Read in Request
    function(callback) {
      fs.readFile(reqPath, 'utf8', function(err, text) {
        reqText = text;
        callback(err);
      });
    },

    // Add Request to CA
    function(callback) {
      testCA.addRequest(reqHost, reqText, function(err, reqStatus) {
        assert.ifError(err);
        assert.ok(reqStatus);
        assert.equal(reqStatus.hostname, reqHost);
        assert.equal(reqStatus.signed, false);
        assert.equal(reqStatus.cert, null);
        callback();
      });
    },

    // Try adding a bogus request with the same name
    function(callback) {
      testCA.addRequest(reqHost, badReqText, function(err, cert) {
        assert.ok(err);
        assert.match(err.message, /does not match/);
        assert.equal(cert, null);
        callback();
      });
    },

    // Try adding a bogus request with a different name
    function(callback) {
      testCA.addRequest('bogushost.example.com', badReqText, function(err) {
        assert.ok(err);
        assert.match(err.message, /Invalid CSR received/);
        callback();
      });
    },

    // List requests (should be one unsigned request)
    function(callback) {
      testCA.listRequests(function(err, requests) {
        assert.ifError(err);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].hostname, reqHost);
        assert.equal(requests[0].signed, false);
        callback();
      });
    },

    // Sign the request
    function(callback) {
      testCA.signRequest(reqHost, false, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // List requests (should be one signed request)
    function(callback) {
      testCA.listRequests(function(err, requests) {
        assert.ifError(err);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].hostname, reqHost);
        assert.equal(requests[0].signed, true);
        callback();
      });
    },

    // Re-add the request to get the certificate text, save it
    function(callback) {
      testCA.addRequest(reqHost, reqText, function(err, reqStatus) {
        assert.ifError(err);
        assert.ok(reqStatus);
        assert.equal(reqStatus.hostname, reqHost);
        assert.equal(reqStatus.signed, true);
        assert.ok(reqStatus.cert);
        fs.writeFile(certPath, reqStatus.cert, callback);
      });
    },

    // Verify the client cert
    function(callback) {
      var cmdpat = 'openssl verify -CAfile %s -verbose %s';
      exec(sprintf(cmdpat, testCA.cert, certPath), function(err, stdout, stderr) {
        assert.ifError(err);
        assert.match(stdout, /OK/);
        assert.ok(!stderr);
        callback();
      });
    },

    // Delete a non-existant request
    function(callback) {
      testCA.removeRequest('bogushost.example.com', function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Delete the real request
    function(callback) {
      testCA.removeRequest(reqHost, callback);
    },

    // List requests (should be none)
    function(callback) {
      testCA.listRequests(function(err, requests) {
        assert.ifError(err);
        assert.equal(requests.length, 0);
        callback();
      });
    }
  ],
  function(err) {
    assert.ifError(err);
  });
};






