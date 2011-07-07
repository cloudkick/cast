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
var managers = require('cast-agent/managers');
var control = require('control');


var TMPDIR = path.join('.tests', 'tmp');


exports['setUp'] = function(test, assert) {
  exec(sprintf('mkdir -p "%s"', TMPDIR), function(err) {
    assert.ifError(err);
    managers.initManagers(function(err) {
      assert.ifError(err);
      test.finish();
    });
  });
};


exports['test_control_ca'] = function(test, assert) {
  var reqHost = 'test.example.com';
  var badReqHost = 'bogushost.example.com';
  var keyPath = path.join(TMPDIR, 'test.key');
  var reqPath = path.join(TMPDIR, 'test.csr');
  var certPath = path.join('.tests', 'data_root', 'ca', 'out', reqHost,
                            'client.crt');
  var badReqText = '------BEGIN CERTIFICATE REQUEST------\n' +
                   'THISREQUESTISRIDICULOUSLYINVALIDSOHAA\n' +
                   '------END CERTIFICATE REQUEST------\n';
  var certText = null;
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
      var j = control.ca.createRequest(reqHost, reqText);
      j.on('success', callback);
      j.on('error', assert.fail.bind(assert));
    },

    // Try adding a bogus request
    function(callback) {
      var j = control.ca.createRequest(badReqHost, badReqText);
      j.on('error', function(err) {
        assert.equal(err.message, 'Invalid CSR received');
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // List requests (should be one unsigned request)
    function(callback) {
      control.ca.listRequests(function(err, requests) {
        assert.ifError(err);
        assert.equal(requests.length, 1);
        assert.deepEqual(requests[0], {
          name: reqHost,
          csr: reqText,
          cert: null
        });
        callback();
      });
    },

    // Retrieve the existing request directly
    function(callback) {
      control.ca.getRequest(reqHost, function(err, request) {
        assert.ifError(err);
        assert.deepEqual(request, {
          name: reqHost,
          csr: reqText,
          cert: null
        });
        callback();
      });
    },

    // Try to retrieve a nonexistant request
    function(callback) {
      control.ca.getRequest(badReqHost, function(err, request) {
        var msg = 'SigningRequest \'' + badReqHost + '\' does not exist.';
        assert.equal(err.message, msg);
        callback();
      });
    },

    // Sign the request
    function(callback) {
      var j = control.ca.signRequest(reqHost);
      j.on('success', callback);
      j.on('error', assert.fail.bind(assert));
    },

    // List requests (should be one signed request)
    function(callback) {
      fs.readFile(certPath, 'utf8', function(err, text) {
        certText = text;
        assert.ifError(err);
        control.ca.listRequests(function(err, requests) {
          assert.ifError(err);
          assert.equal(requests.length, 1);
          assert.deepEqual(requests[0], {
            name: reqHost,
            csr: reqText,
            cert: certText
          });
          callback();
        });
      });
    },

    // Try to re-add the request
    function(callback) {
      var j = control.ca.createRequest(reqHost, reqText);
      var msg = 'SigningRequest \'' + reqHost + '\' already exists.';
      j.on('error', function(err) {
        assert.equal(err.message, msg);
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // Verify the client cert
    function(callback) {
      var cmdpat = 'openssl verify -CAfile %s -verbose %s';
      var caCertPath = managers.getManager('SigningRequestManager').cert;
      exec(sprintf(cmdpat, caCertPath, certPath), function(err, stdout, stderr) {
        assert.ifError(err);
        assert.ok(!stderr);
        assert.match(stdout, /OK/);
        callback();
      });
    },

    // Delete a non-existant request
    function(callback) {
      var j = control.ca.deleteRequest(badReqHost);
      var msg = 'SigningRequest \'' + badReqHost + '\' does not exist.';
      j.on('error', function(err) {
        assert.equal(err.message, msg);
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // Try to delete the signed requests
    function(callback) {
      var j = control.ca.deleteRequest(reqHost);
      var msg = 'Certificate already exists for ' + reqHost;
      j.on('error', function(err) {
        assert.equal(err.message, msg);
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // List requests - should be one
    function(callback) {
      control.ca.listRequests(function(err, requests) {
        assert.ifError(err);
        assert.equal(requests.length, 1);
        assert.deepEqual(requests[0], {
          name: reqHost,
          csr: reqText,
          cert: certText
        });
        callback();
      });
    }
  ],
  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
