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

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var tarball = require('util/tarball');
var config = require('util/config');
var fsUtil = require('util/fs');
var constants = require('deployment/constants');

var deployment = require('deployment');
var deployFiles = require('deployment/files');
var helpers = require('../helpers');

// Decrease the delay so the tests run faster
constants.RUNIT_DELAY = 0;

var svcRootAvail, appRoot, extRoot;
var cwd = process.cwd();

exports['setUp'] = function(test, assert) {
  svcRootAvail = config.get()['service_dir_available'];
  appRoot = config.get()['app_dir'];
  extRoot = config.get()['extracted_dir'];

  test.finish();
};

function verifyInstance(assert, name, bundle, version, versions, verifyServiceExists,
                        callback) {
  // TODO: More in-depth verification of data files, templated files
  // and templated services
  if (!callback) {
    callback = versions;
    versions = [ version ];
  }
  else if (!versions) {
    versions = [ version ];
  }

  async.parallel([
    function(callback) {
      fs.readdir(path.join(appRoot, name, 'versions'), function(err, files) {
        var i;
        assert.ifError(err);
        assert.equal(files.length, versions.length);
        for (i = 0; i < versions.length; i++) {
          assert.ok(files.indexOf(bundle + '@' + versions[i]) >= 0);
        }
        callback();
      });
    },

    function(callback) {
      fs.stat(path.join(appRoot, name, 'data'), function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        callback();
      });
    },

    function(callback) {
      fs.readlink(path.join(appRoot, name, 'bundle'), function(err, target) {
        var bdir = path.resolve(path.join(extRoot, 'fooapp'));
        assert.ifError(err);
        assert.equal(target, bdir);
        callback();
      });
    },

    function(callback) {
      fs.readlink(path.join(appRoot, name, 'current'), function(err, target) {
        var vdir = path.resolve(path.join(appRoot, name, 'versions', bundle + '@' + version));
        assert.ifError(err);
        assert.equal(target, vdir);
        callback();
      });
    },

    function(callback) {
      if (!verifyServiceExists) {
        callback();
        return;
      }

      var serviceName = sprintf('%s@%s', name, version);
      fs.stat(path.join(svcRootAvail, serviceName), function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        callback();
      });
    }
  ],
  function(err) {
    assert.ifError(err);
    callback();
  });
}


exports['test_resolveDataFiles'] = function(test, assert) {
  var dataFiles1 = [ 'test1/', 'test2/', 'test3/foo.txt' ];
  var dataFiles2 = [ 'data/archive.tar.gz', 'data/README', 'data/file3.txt',
                     'dbdata/' ];

  async.series([
    // Prepare data root layout
    async.apply(exec, 'mkdir -p .tests/data_tmp'),
    async.apply(exec, 'mkdir -p .tests/data_root2/applications/app1'),
    async.apply(exec, 'mkdir -p .tests/data_root2/applications/app1'),
    async.apply(exec, 'mkdir -p .tests/data_root2/extracted/app1'),

    // Do a first level of assertions - simple resolving, no files already exist
    function(callback) {
      deployFiles.resolveDataFiles(path.join(cwd, '.tests/data_root2/extracted/app1'),
                                   path.join(cwd, '.tests/data_tmp'),
                                   path.join(cwd, '.tests/data_root2/applications/app1'),
                                   dataFiles1,
                                   callback);
    },

    function(callback) {
      // A directory should have been created in the data directory and a
      // symlink to it created in the instance directory
      helpers.checkPath(assert, {
        path: '.tests/data_root2/applications/app1/test1',
        type: 'symlink.directory',
        target: '.tests/data_tmp/test1'
      });

      // A directory should have been created in the data directory and a
      // symlink to it created in the instance directory
      helpers.checkPath(assert, {
        path: '.tests/data_root2/applications/app1/test2',
        type: 'symlink.directory',
        target: '.tests/data_tmp/test2'
      });

      // The 'test3' directory should have been created in both the data root
      // and the instance root, and a symlink should have been created from
      // 'test3/foo.txt' in the instance root to 'test3/foo.txt' in the data
      // root. However, the latter path should not actually exist (creating the
      // data file is up to the application) so the symlink should be broken at
      // this point.
      helpers.checkPath(assert, {
        path: '.tests/data_tmp/test3',
        type: 'directory'
      });

      helpers.checkPath(assert, {
        path: '.tests/data_root2/applications/app1/test3',
        type: 'directory'
      });

      helpers.checkPath(assert, {
        path: '.tests/data_root2/applications/app1/test3/foo.txt',
        type: 'symlink.null',
        target: '.tests/data_tmp/test3/foo.txt'
      });

      callback();
    },

    // Do a second level of assertions - this time the data files already exist
    // and we verify that they were copied correctly.
    async.apply(fsUtil.copyTree, path.join(cwd, 'data/data_root'),
                path.join(cwd, '.tests/data_root3')),

    async.apply(deployFiles.resolveDataFiles, path.join(cwd, '.tests/data_root3/extracted/app1'),
                path.join(cwd, '.tests/data_tmp2'),
                path.join(cwd, '.tests/data_root3/applications/app1'),
                dataFiles2),

    function(callback) {
      helpers.checkPath(assert, {
        path: '.tests/data_root3/applications/app1/data/archive.tar.gz',
        type: 'symlink.file',
        target: '.tests/data_tmp2/data/archive.tar.gz'
      });

      helpers.checkPath(assert, {
        path: '.tests/data_root3/applications/app1/data/README',
        type: 'symlink.file',
        target: '.tests/data_tmp2/data/README'
      });

      helpers.checkPath(assert, {
        path: '.tests/data_root3/applications/app1/data/file3.txt',
        type: 'symlink.file',
        target: '.tests/data_tmp2/data/file3.txt'
      });

      helpers.checkPath(assert, {
        path: '.tests/data_root3/applications/app1/dbdata',
        type: 'symlink.directory',
        target: '.tests/data_tmp2/dbdata'
      });

      callback();
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
