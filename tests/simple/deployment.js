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
var assert = require('assert');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var tarball = require('util/tarball');
var config = require('util/config');
var constants = require('deployment/constants');

var deployment = require('deployment');
var deployFiles = require('deployment/files');
var helpers = require('../helpers');

// Decrease the delay so the tests run faster
constants.RUNIT_DELAY = 0;

var svcRootAvail, appRoot, extRoot;
var cwd = process.cwd();

exports['setUp'] = function(callback) {
  svcRootAvail = config.get()['service_dir_available'];
  appRoot = config.get()['app_dir'];
  extRoot = config.get()['extracted_dir'];

  callback();
};

function verifyInstance(name, bundle, version, versions, verifyServiceExists,
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

exports['test_deployment'] = function() {
  var curInstance;

  async.series([
    // Prepare data root layout
    async.apply(exec, 'mkdir -p .tests/data_root/applications'),
    async.apply(exec, 'mkdir -p .tests/data_root/services'),
    async.apply(exec, 'mkdir -p .tests/data_root/services-enabled'),
    async.apply(exec, 'mkdir -p .tests/data_root/extracted/fooapp'),

    // Prepare some extracted bundles
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var expath = path.join(process.cwd(), '.tests/data_root/extracted/fooapp/fooapp@v1.0');
      tarball.extractTarball(tbpath, expath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var expath = path.join(process.cwd(), '.tests/data_root/extracted/fooapp/fooapp@v1.5');
      tarball.extractTarball(tbpath, expath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var expath = path.join(process.cwd(), '.tests/data_root/extracted/fooapp/barapp@v1.0');
      tarball.extractTarball(tbpath, expath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Create an instance from that bundle
    function(callback) {
      deployment.createInstance('foo0', 'fooapp', 'v1.0', false, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify the instance
    async.apply(verifyInstance, 'foo0', 'fooapp', 'v1.0', null, true),

    // Create another instance, but this time with enable=true
    function(callback) {
      deployment.createInstance('foo1', 'fooapp', 'v1.0', true, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify that one too
    async.apply(verifyInstance, 'foo1', 'fooapp', 'v1.0', null, true),

    function (callback) {
      // Verify that the instance has been enabled
      var serviceName = sprintf('%s@%s', 'foo1', 'v1.0');
      var serviceEnabledPath = path.join(process.cwd(),
          sprintf('.tests/data_root/services-enabled/%s', serviceName));
      path.exists(serviceEnabledPath, function(exists) {
        callback();
        assert.ok(exists, 'Service is not enabled');
      });
    },

    // Try to create an instance that already exists
    function(callback) {
      deployment.createInstance('foo1', 'fooapp', 'v1.0', false, function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Try to get an instance that does not exist
    function(callback) {
      deployment.getInstance('foo2', function(err, instance) {
        assert.ok(err);
        callback();
      });
    },

    // Try to get an instance that does exist
    function(callback) {
      deployment.getInstance('foo0', function(err, instance) {
        assert.ifError(err);
        assert.ok(instance);
        assert.equal(instance.name, 'foo0');
        assert.equal(instance.root, path.join(appRoot, 'foo0'));
        curInstance = instance;
        callback();
      });
    },

    // Check Instance.exists
    function(callback) {
      curInstance.exists(function(exists) {
        assert.ok(exists);
        callback();
      });
    },

    // Check Instance.get_bundle_name
    function(callback) {
      curInstance.getBundleName(function(err, name) {
        assert.ifError(err);
        assert.equal(name, 'fooapp');
        callback();
      });
    },

    // Check Instance.get_bundle_version
    function(callback) {
      curInstance.getBundleVersion(function(err, version) {
        assert.ifError(err);
        assert.equal(version, 'v1.0');
        callback();
      });
    },

    // Check Instance.get_version_path for an existing version
    function(callback) {
      curInstance.getVersionPath('v1.0', function(err, vpath) {
        assert.ifError(err);
        assert.equal(vpath, path.join(appRoot, 'foo0', 'versions', 'fooapp@v1.0'));
        callback();
      });
    },

    // Check Instance.get_version path for a non-existant version
    function(callback) {
      curInstance.getVersionPath('v2.0', function(err, vpath) {
        assert.ifError(err);
        assert.equal(vpath, path.join(appRoot, 'foo0', 'versions', 'fooapp@v2.0'));
        callback();
      });
    },

    // Check Instance.get_bundle_version_path for an existing bundle
    function(callback) {
      curInstance.getBundleVersionPath('v1.0', function(err, bvpath) {
        assert.ifError(err);
        assert.equal(bvpath, path.join(extRoot, 'fooapp', 'fooapp@v1.0'));
        callback();
      });
    },

    // Check Instance.get_bundle_version_path for a non-existant bundle
    function(callback) {
      curInstance.getBundleVersionPath('v2.0', function(err, bvpath) {
        assert.ifError(err);
        assert.equal(bvpath, path.join(extRoot, 'fooapp', 'fooapp@v2.0'));
        callback();
      });
    },

    // Check Instance.prepare_version with a non-existant version
    function(callback) {
      curInstance.prepareVersion('v2.0', function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Verify nothing broke
    function(callback) {
      verifyInstance(curInstance.name, 'fooapp', 'v1.0', null, true, callback);
    },

    // Check Instance.activate_version on an existing but unprepared version
    function(callback) {
      curInstance.activateVersion('v1.5', function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Verify nothing broke
    function(callback) {
      verifyInstance(curInstance.name, 'fooapp', 'v1.0', null, true, callback);
    },

    // Check Instance.prepare_version with an existing version
    function(callback) {
      curInstance.prepareVersion('v1.5', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify the new version was prepared
    function(callback) {
      var versions = ['v1.0', 'v1.5'];
      verifyInstance(curInstance.name, 'fooapp', 'v1.0', versions, true, callback);
    },

    // Check Instance.activate_version on a prepared version
    function(callback) {
      curInstance.activateVersion('v1.5', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify the new version was activated
    function(callback) {
      var versions = ['v1.0', 'v1.5'];
      verifyInstance(curInstance.name, 'fooapp', 'v1.5', versions, false, callback);
    },

    // Get a list of instances
    function(callback) {
      var names = ['foo0', 'foo1'];
      deployment.getInstanceList(function(err, instanceList) {
        var i;
        assert.equal(instanceList.length, names.length);
        for (i = 0; i < instanceList.length; i++) {
          assert.ok(names.indexOf(instanceList[i].name) >= 0);
        }
        callback();
      });
    },

    // Destroy an instance
    function(callback) {
      curInstance.destroy(callback);
    },

    // Make sure its gone
    function(callback) {
      path.exists(path.join(appRoot, curInstance.name), function(exists) {
        assert.ok(!exists);
        callback();
      });
    },

    // Make sure the associated service is gone too
    function(callback) {
      path.exists(path.join(svcRootAvail, curInstance.name), function(exists) {
        assert.ok(!exists);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
  });
};

exports['test_resolveDataFiles'] = function() {
  var dataFiles1 = [ 'test1/', 'test2/', 'test3/foo.txt' ];

  async.series([
    // Prepare data root layout
    async.apply(exec, 'mkdir -p .tests/data_tmp'),
    async.apply(exec, 'mkdir -p .tests/data_root2/applications/app1'),
    async.apply(exec, 'mkdir -p .tests/data_root2/applications/app1'),
    async.apply(exec, 'mkdir -p .tests/data_root2/extracted/app1'),

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
      helpers.checkPath({
        path: '.tests/data_root2/applications/app1/test1',
        type: 'symlink.directory',
        target: '.tests/data_tmp/test1'
      });

      // A directory should have been created in the data directory and a
      // symlink to it created in the instance directory
      helpers.checkPath({
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
      helpers.checkPath({
        path: '.tests/data_tmp/test3',
        type: 'directory'
      });

      helpers.checkPath({
        path: '.tests/data_root2/applications/app1/test3',
        type: 'directory'
      });

      helpers.checkPath({
        path: '.tests/data_root2/applications/app1/test3/foo.txt',
        type: 'symlink.null',
        target: '.tests/data_tmp/test3/foo.txt'
      });

      callback();
    }
  ],

  function(err) {
    assert.ifError(err);
  });
};
