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

var path = require('path');
var crypto = require('crypto');
var fs = require('fs');

var test = require('util/test');
var extract = require('util/tarball');

var cwd = process.cwd();
var data_path = path.join(cwd, 'tests/data');
var bundle_path = path.join(data_path, 'test foo bar');
var tarball_name = 'foo-bar-1.0.tar.gz';
var tarball_path = path.join(data_path, tarball_name);

exports['test invalid source path'] = function(assert, beforeExit) {
  var n = 0;
  
  extract.create_tarball('/invalid/source/path/', data_path, tarball_name, function(error) {
    n++;
    assert.notEqual(error, undefined);
    assert.match(error.message, /source path does not exist/i);
  });
  
  beforeExit(function() {
    assert.equal(n, 1, 'Callbacks called');
  });
};

exports['test invalid target path'] = function(assert, beforeExit) {
  var n = 0;
  
  extract.create_tarball(bundle_path, '/invalid/path', tarball_name, function(error) {
    n++;
    assert.notEqual(error, undefined);
    assert.match(error.message, /target path does not exist/i);
  });
  
  beforeExit(function() {
    assert.equal(n, 1, 'Callbacks called');
  });
};

exports.setup = function(done) {
  require('util/pubsub').ensure("config", done);
};

exports['test create tarball'] = function(assert, beforeExit) {
  var n = 0;
  
  test.file_delete(tarball_path);
  assert.equal(test.file_exists(tarball_path), false);
  extract.create_tarball(bundle_path, data_path, tarball_name, function(error) {
    n++;
    assert.equal(error, undefined);
    assert.equal(test.file_exists(tarball_path), true);
  });
  
  beforeExit(function() {
    assert.equal(n, 1, 'Callbacks called');
    
    test.file_delete(tarball_path);
  });
};

exports['test create tarball overwrites existing file'] = function(assert, beforeExit) {
  var n = 0;
  
  test.file_delete(tarball_path);
  assert.equal(test.file_exists(tarball_path), false);
  extract.create_tarball(bundle_path, data_path, tarball_name, function(error) {
    n++;
    assert.equal(error, undefined);
    assert.equal(test.file_exists(tarball_path), true);
    
    extract.create_tarball(bundle_path, data_path, tarball_name, function(error) {
      n++;
      assert.equal(error, undefined);
      assert.equal(test.file_exists(tarball_path), true);
    });
  });
  
  beforeExit(function() {
    assert.equal(n, 2, 'Callbacks called');
    
    test.file_delete(tarball_path);
  });
};

exports.setup = function(done) {
  require('util/pubsub').ensure("config", done);
};
