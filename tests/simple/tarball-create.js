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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var assert = require('./../assert');

var cwd = process.cwd();
var dataPath = path.join(cwd, 'data');
var bundlePath = path.join(dataPath, 'test foo bar');

var tarballName1 = 'foo-bar-1.0.1.tar.gz';
var tarballPath1 = path.join(dataPath, tarballName1);

var tarballName2 = 'foo-bar-1.0.2.tar.gz';
var tarballPath2 = path.join(dataPath, tarballName2);

var tarballName3 = 'foo-bar-1.0.3.tar.gz';
var tarballPath3 = path.join(dataPath, tarballName3);

var tarballName4 = 'foo-bar-1.0.4.tar.gz';
var tarballPath4 = path.join(dataPath, tarballName4);

var tarballName5 = 'foo-bar-1.0.5.tar.gz';
var tarballPath5 = path.join(dataPath, tarballName5);

var tarballName6 = 'foo-bar-1.0.6.tar.gz';
var tarballPath6 = path.join(dataPath, tarballName6);

var tarballName7 = 'foo-bar-1.0.7.tar.gz';
var tarballPath7 = path.join(dataPath, tarballName7);

exports['test_invalid_source_path'] = function() {
  extract.createTarball('/invalid/source/path/', dataPath, tarballName1, {deleteIfExists: false}, function(error) {
    assert.ok(error);
    assert.match(error.message, /source path does not exist/i);
  });
};

exports['test_invalid_target_path'] = function() {
  extract.createTarball(bundlePath, '/invalid/path', tarballName1, {deleteIfExists: false}, function(error) {
    assert.ok(error);
    assert.match(error.message, /target path does not exist/i);
  });
};

exports['test_create_tarball_success'] = function() {
  test.fileDelete(tarballPath1);
  assert.equal(test.fileExists(tarballPath1), false);

  extract.createTarball(bundlePath, dataPath, tarballName1, {deleteIfExists: false}, function(error) {
    assert.ifError(error);
    assert.equal(test.fileExists(tarballPath1), true);
    test.fileDelete(tarballPath1);
  });
};

exports['test_create_tarball_throws_error_upon_existing_file'] = function() {
  test.fileDelete(tarballPath2);
  assert.equal(test.fileExists(tarballPath2), false);

  extract.createTarball(bundlePath, dataPath, tarballName2, {deleteIfExists: false}, function(error) {
    assert.ifError(error);
    assert.equal(test.fileExists(tarballPath2), true);

    extract.createTarball(bundlePath, dataPath, tarballName2, {deleteIfExists: false}, function(error) {
      assert.match(error, /tarball already exists/i);
      assert.equal(test.fileExists(tarballPath2), true);
      test.fileDelete(tarballPath2);
    });
  });
};

exports['test_dele_if_exists_option'] = function() {
  test.fileDelete(tarballPath3);
  assert.equal(test.fileExists(tarballPath3), false);

  extract.createTarball(bundlePath, dataPath, tarballName3, {deleteIfExists: false}, function(error) {
    assert.ifError(error);
    assert.equal(test.fileExists(tarballPath3), true);

    extract.createTarball(bundlePath, dataPath, tarballName3, {deleteIfExists: true}, function(error) {
      assert.ifError(error);
      assert.equal(test.fileExists(tarballPath3), true);
      test.fileDelete(tarballPath3);
    });
  });
};

exports['test_store_in_tarball_name_directory_is_false'] = function() {
  test.fileDelete(tarballPath4);
  assert.equal(test.fileExists(tarballPath4), false);

  extract.createTarball(bundlePath, dataPath, tarballName4, {storeInTarballNameDirectory: false}, function(error) {
    assert.ifError(error);
    assert.equal(test.fileExists(tarballPath4), true);

    extract.getTarballFileList(tarballPath4, function(error, fileList) {
      assert.ifError(error);
      assert.length(fileList, 16);
      for (var i = 0; i < fileList.length; i++) {
        assert.match(fileList[i], /\.\//);
      }
      test.fileDelete(tarballPath4);
    });
  });
};

exports['test_store_in_tarball_name_directory_is_true'] = function() {
  var rootDirectoryName = tarballName5.replace('.tar.gz', '');
  test.fileDelete(tarballPath5);
  assert.equal(test.fileExists(tarballPath5), false);

  extract.createTarball(bundlePath, dataPath, tarballName5, {storeInTarballNameDirectory: true}, function(error) {
    assert.ifError(error);
    assert.equal(test.fileExists(tarballPath5), true);

    extract.getTarballFileList(tarballPath5, function(error, fileList) {
      var regexp = new RegExp(sprintf('%s/', rootDirectoryName));
      assert.ifError(error);
      assert.length(fileList, 16);
      for (var i = 0; i < fileList.length; i++) {
        assert.match(fileList[i], regexp);
      }
      test.fileDelete(tarballPath5);
    });
  });
};

exports['test_exclude_pattern'] = function() {
  test.fileDelete(tarballPath6);
  assert.equal(test.fileExists(tarballPath6), false);

  extract.createTarball(bundlePath, dataPath, tarballName6, {deleteIfExists: false, excludePattern: '*.sh'}, function(error) {
    assert.ifError(error);
    assert.equal(test.fileExists(tarballPath6), true);

    extract.getTarballFileList(tarballPath6, function(error, fileList) {
      assert.ifError(error);
      assert.length(fileList, 14);
      test.fileDelete(tarballPath6);
    });
  });
};

exports['test_ignore_file_changed_error'] = function() {
  test.fileDelete(tarballPath7);
  assert.equal(test.fileExists(tarballPath7), false);
  extract.createTarball(dataPath, dataPath, tarballName7, {deleteIfExists: false, ignoreFileChangedError: true}, function(error) {
    assert.ifError(error);
    assert.equal(test.fileExists(tarballPath7), true);
    test.fileDelete(tarballPath7);
  });
};
