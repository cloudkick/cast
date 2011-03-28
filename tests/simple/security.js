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
var certgen = require('security/certgen');
var exec = require('child_process').exec;

var async = require('extern/async');

var misc = require('util/misc');
var assert = require('./../assert');

exports['setUp'] = function(callback) {
  fs.mkdir('.tests/certs', 0700, callback);
};

exports['test_openssl_cert_generation'] = function() {
  var hostname = 'testhostnamerare' + misc.randstr(5);
  var keypath = '.tests/certs/t.key';
  var crtpath = '.tests/certs/t.crt';
  certgen.genSelfSigned(hostname, keypath, crtpath, function(err) {
    assert.ifError(err);
    exec('openssl x509 -noout -subject -in .tests/certs/t.crt', function(err, stdout, stderr) {
      assert.ifError(err);
      assert.equal('subject= /CN=' + hostname, misc.trim(stdout));
    });
  });
};

exports['test_openssl_key_generation'] = function() {
  var keypath = '.tests/certs/t2.key';
  certgen.genKey(keypath, function(err) {
    assert.ifError(err);
    fs.readFile(keypath, 'utf8', function(err, text) {
      assert.ifError(err);
      assert.match(text, /BEGIN RSA PRIVATE KEY/);
      assert.match(text, /END RSA PRIVATE KEY/);
    })
  });
};

exports['test_openssl_csr_generation'] = function() {
  var keypath = '.tests/certs/t3.key';
  certgen.genKey(keypath, function(err) {
    assert.ifError(err);
    certgen.getCSR('foo.example.com', keypath, function(err, csr) {
      assert.ifError(err);
      assert.match(csr, /BEGIN CERTIFICATE REQUEST/);
      assert.match(csr, /END CERTIFICATE REQUEST/);
    });
  });
};
