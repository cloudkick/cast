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

var sprintf = require('sprintf').sprintf;
var async = require('async');

var testUtil = require('util/test');
var extract = require('util/tarball');
var misc = require('util/misc');


var cwd = process.cwd();
var dataPath = path.join(cwd, 'data');
var bundlePath = path.join(dataPath, 'test foo bar');
var bundlePath2 = path.join(dataPath, 'folder_with_symlink');

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

var tarballName8 = 'foo-bar-1.0.8.tar.gz';
var tarballPath8 = path.join(dataPath, tarballName8);

var tarballName9 = 'foo-bar-1.0.9.tar.gz';
var tarballPath9 = path.join(dataPath, tarballName9);

exports['test_invalid_source_path'] = function(test, assert) {
  extract.createTarball('/invalid/source/path/', dataPath, tarballName1, {deleteIfExists: false}, function(err) {
    assert.ok(err);
    assert.match(err.message, /source path does not exist/i);
    test.finish();
  });
};

exports['test_invalid_target_path'] = function(test, assert) {
  extract.createTarball(bundlePath, '/invalid/path', tarballName1, {deleteIfExists: false}, function(err) {
    assert.ok(err);
    assert.match(err.message, /target path does not exist/i);
    test.finish();
  });
};

exports['test_create_tarball_success'] = function(test, assert) {
  testUtil.fileDelete(tarballPath1);
  assert.equal(testUtil.fileExists(tarballPath1), false);

  extract.createTarball(bundlePath, dataPath, tarballName1, {deleteIfExists: false}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath1), true);
    testUtil.fileDelete(tarballPath1);
    test.finish();
  });
};

exports['test_create_tarball_throws_err_upon_existing_file'] = function(test, assert) {
  testUtil.fileDelete(tarballPath2);
  assert.equal(testUtil.fileExists(tarballPath2), false);

  extract.createTarball(bundlePath, dataPath, tarballName2, {deleteIfExists: false}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath2), true);

    extract.createTarball(bundlePath, dataPath, tarballName2, {deleteIfExists: false}, function(err) {
      assert.match(err, /tarball already exists/i);
      assert.equal(testUtil.fileExists(tarballPath2), true);
      testUtil.fileDelete(tarballPath2);
      test.finish();
    });
  });
};

exports['test_dele_if_exists_option'] = function(test, assert) {
  testUtil.fileDelete(tarballPath3);
  assert.equal(testUtil.fileExists(tarballPath3), false);

  extract.createTarball(bundlePath, dataPath, tarballName3, {deleteIfExists: false}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath3), true);

    extract.createTarball(bundlePath, dataPath, tarballName3, {deleteIfExists: true}, function(err) {
      assert.ifError(err);
      assert.equal(testUtil.fileExists(tarballPath3), true);
      testUtil.fileDelete(tarballPath3);
      test.finish();
    });
  });
};

exports['test_store_in_tarball_name_directory_is_false'] = function(test, assert) {
  testUtil.fileDelete(tarballPath4);
  assert.equal(testUtil.fileExists(tarballPath4), false);

  extract.createTarball(bundlePath, dataPath, tarballName4, {storeInTarballNameDirectory: false}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath4), true);

    extract.getTarballFileList(tarballPath4, function(err, fileList) {
      assert.ifError(err);
      assert.length(fileList, 16);

      for (var i = 0; i < fileList.length; i++) {
        assert.match(fileList[i], /\.\//);
      }

      testUtil.fileDelete(tarballPath4);
      test.finish();
    });
  });
};

exports['test_store_in_tarball_name_directory_is_true'] = function(test, assert) {
  var rootDirectoryName = tarballName5.replace('.tar.gz', '');
  testUtil.fileDelete(tarballPath5);
  assert.equal(testUtil.fileExists(tarballPath5), false);

  extract.createTarball(bundlePath, dataPath, tarballName5, {storeInTarballNameDirectory: true}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath5), true);

    extract.getTarballFileList(tarballPath5, function(err, fileList) {
      var regexp = new RegExp(sprintf('%s/', rootDirectoryName));
      assert.ifError(err);
      assert.length(fileList, 16);

      for (var i = 0; i < fileList.length; i++) {
        assert.match(fileList[i], regexp);
      }

      testUtil.fileDelete(tarballPath5);
      test.finish();
    });
  });
};

exports['test_exclude_pattern'] = function(test, assert) {
  testUtil.fileDelete(tarballPath6);
  assert.equal(testUtil.fileExists(tarballPath6), false);

  extract.createTarball(bundlePath, dataPath, tarballName6, {deleteIfExists: false, excludePattern: '*.sh'}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath6), true);

    extract.getTarballFileList(tarballPath6, function(err, fileList) {
      assert.ifError(err);
      assert.length(fileList, 14);
      testUtil.fileDelete(tarballPath6);
      test.finish();
    });
  });
};

exports['test_ignore_file_changed_err'] = function(test, assert) {
  testUtil.fileDelete(tarballPath7);
  assert.equal(testUtil.fileExists(tarballPath7), false);
  extract.createTarball(dataPath, dataPath, tarballName7, {deleteIfExists: false, ignoreFileChangedError: true}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath7), true);
    testUtil.fileDelete(tarballPath7);
    test.finish();
  });
};

exports['test_excludeFile'] = function(test, assert) {
  testUtil.fileDelete(tarballPath8);
  assert.equal(testUtil.fileExists(tarballPath8), false);

  extract.createTarball(bundlePath, dataPath, tarballName8, {deleteIfExists: false,
                                                             ignoreFileChangedError: true,
                                                             excludeFile: 'data/exclude_file'}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath8), true);

    extract.getTarballFileList(tarballPath8, function(err, fileList) {
      assert.ifError(err);
      assert.length(fileList, 3);
      assert.ok(misc.inArray('foo-bar-1.0.8/', fileList));
      assert.ok(misc.inArray('foo-bar-1.0.8/osx-pkg-dmg-create.sh', fileList));
      assert.ok(misc.inArray('foo-bar-1.0.8/updateAuthors.awk', fileList));
      testUtil.fileDelete(tarballPath8);
      test.finish();
    });
 });
};

exports['test_create_tarball_with_symlinks'] = function(test, assert) {
  testUtil.fileDelete(tarballPath9);

  extract.createTarball(bundlePath2, dataPath, tarballName9, {}, function(err) {
    assert.ifError(err);
    assert.equal(testUtil.fileExists(tarballPath9), true);

    extract.getTarballFileList(tarballPath9, function(err, fileList) {
      assert.ifError(err);
      // Verify that the symlink path was not trasnformed
      assert.ok(fileList.indexOf('../b/file') !== -1);
      assert.length(fileList, 5);
      testUtil.fileDelete(tarballPath9);
      test.finish();
    });
  });
};
