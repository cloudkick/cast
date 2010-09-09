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

var sprintf = require('extern/sprintf').sprintf;

var cwd = process.cwd();
var data_path = path.join(cwd, 'tests/data');
var bundle_path = path.join(data_path, 'test foo bar');

var tarball_name1 = 'foo-bar-1.0.1.tar.gz';
var tarball_path1 = path.join(data_path, tarball_name1);

var tarball_name2 = 'foo-bar-1.0.2.tar.gz';
var tarball_path2 = path.join(data_path, tarball_name2);

var tarball_name3 = 'foo-bar-1.0.3.tar.gz';
var tarball_path3 = path.join(data_path, tarball_name3);

var tarball_name4 = 'foo-bar-1.0.4.tar.gz';
var tarball_path4 = path.join(data_path, tarball_name4);

exports['test invalid source path'] = function(assert, beforeExit) {
  var n = 0;

  extract.create_tarball('/invalid/source/path/', data_path, tarball_name1, false, function(error) {
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

  extract.create_tarball(bundle_path, '/invalid/path', tarball_name1, false, function(error) {
    n++;
    assert.notEqual(error, undefined);
    assert.match(error.message, /target path does not exist/i);
  });

  beforeExit(function() {
    assert.equal(n, 1, 'Callbacks called');
  });
};

exports['test create tarball'] = function(assert, beforeExit) {
  var n = 0;
  
  test.file_delete(tarball_path1);
  assert.equal(test.file_exists(tarball_path1), false);
  extract.create_tarball(bundle_path, data_path, tarball_name1, false, function(error) {
    n++;
    assert.equal(error, undefined);
    assert.equal(test.file_exists(tarball_path1), true);
  });

  beforeExit(function() {
    assert.equal(n, 1, 'Callbacks called');

    test.file_delete(tarball_path1);
  });
};

exports['test create tarball throws error upon existing file'] = function(assert, beforeExit) {
  var n = 0;

  test.file_delete(tarball_path2);
  assert.equal(test.file_exists(tarball_path2), false);
  extract.create_tarball(bundle_path, data_path, tarball_name2, false, function(error) {
    n++;
    assert.equal(error, undefined);
    assert.equal(test.file_exists(tarball_path2), true);

    extract.create_tarball(bundle_path, data_path, tarball_name2, false, function(error) {
      n++;
      assert.match(error, /tarball already exists/i);
      assert.equal(test.file_exists(tarball_path2), true);
    });
  });

  beforeExit(function() {
    assert.equal(n, 2, 'Callbacks called');

    test.file_delete(tarball_path2);
  });
};

exports['test create tarball delete_if_exists works'] = function(assert, beforeExit) {
  var n = 0;

  test.file_delete(tarball_path3);
  assert.equal(test.file_exists(tarball_path3), false);
  extract.create_tarball(bundle_path, data_path, tarball_name3, false, function(error) {
    n++;
    assert.equal(error, undefined);
    assert.equal(test.file_exists(tarball_path3), true);

    extract.create_tarball(bundle_path, data_path, tarball_name3, true, function(error) {
      n++;
      assert.equal(error, undefined);
      assert.equal(test.file_exists(tarball_path3), true);
    });
  });

  beforeExit(function() {
    assert.equal(n, 2, 'Callbacks called');

    test.file_delete(tarball_path3);
  });
};

exports['test all the files in archive are stored in a top-level directory with the same name as tarball'] = function(assert, beforeExit) {
   var n = 0;
   var root_directory_name = tarball_name4.replace('.tar.gz', '');

  test.file_delete(tarball_path4);
  assert.equal(test.file_exists(tarball_path4), false);
  extract.create_tarball(bundle_path, data_path, tarball_name4, false, function(error) {
    n++;
    assert.equal(error, undefined);
    assert.equal(test.file_exists(tarball_path4), true);
    
    extract.get_tarball_file_list(tarball_path4, function(error, file_list) {
      n++;
      
      var regexp = new RegExp(sprintf('%s/', root_directory_name));

      assert.equal(error, undefined);
      assert.length(file_list, 15); 
      
      for (var i = 0; i < file_list.length; i++) {
        assert.match(file_list[i], regexp);
      }
    });
  });

  beforeExit(function() {
    assert.equal(n, 2, 'Callbacks called');

    test.file_delete(tarball_path4);
  });
};

exports.setup = function(done) {
  require('util/pubsub').ensure("config", done);
};
