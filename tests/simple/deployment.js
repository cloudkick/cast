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
var exec = require('child_process').exec;
var path = require('path');
var async = require('extern/async');
var tarball = require('util/tarball');
var config = require('util/config');
var assert = require('assert');
var deployment = require('deployment');

var svc_root_avail = config.get().service_dir_available;
var app_root = config.get().app_dir;
var ext_root = config.get().extracted_dir;

function verify_instance(name, bundle, version, versions, callback) {
  // TODO: More in-depth verification of data files, templated files
  // and templated services
  if (!callback) {
    callback = versions;
    versions = [ version ];
  }
  async.parallel([
    function(callback) {
      fs.readdir(path.join(app_root, name, 'versions'), function(err, files) {
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
      fs.stat(path.join(app_root, name, 'data'), function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        callback();
      });
    },

    function(callback) {
      fs.readlink(path.join(app_root, name, 'bundle'), function(err, target) {
        var bdir = path.resolve(path.join(ext_root, 'fooapp'));
        assert.ifError(err);
        assert.equal(target, bdir);
        callback();
      });
    },

    function(callback) {
      fs.readlink(path.join(app_root, name, 'current'), function(err, target) {
        var vdir = path.resolve(path.join(app_root, name, 'versions', bundle + '@' + version));
        assert.ifError(err);
        assert.equal(target, vdir);
        callback();
      });
    },

    function(callback) {
      fs.stat(path.join(svc_root_avail, name), function(err, stats) {
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

(function() {
  var completed = false;
  var cur_instance;

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
      tarball.extract_tarball(tbpath, expath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var expath = path.join(process.cwd(), '.tests/data_root/extracted/fooapp/fooapp@v1.5');
      tarball.extract_tarball(tbpath, expath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var expath = path.join(process.cwd(), '.tests/data_root/extracted/fooapp/barapp@v1.0');
      tarball.extract_tarball(tbpath, expath, 0755, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Create an instance from that bundle
    function(callback) {
      deployment.create_instance('foo0', 'fooapp', 'v1.0', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify the instance
    async.apply(verify_instance, 'foo0', 'fooapp', 'v1.0'),

    // Create another instance
    function(callback) {
      deployment.create_instance('foo1', 'fooapp', 'v1.0', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify that one too
    async.apply(verify_instance, 'foo1', 'fooapp', 'v1.0'),
    
    // Try to create an instance that already exists
    function(callback) {
      deployment.create_instance('foo1', 'fooapp', 'v1.0', function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Try to get an instance that does not exist
    function(callback) {
      deployment.get_instance('foo2', function(err, instance) {
        assert.ok(err);
        callback();
      });
    },

    // Try to get an instance that does exist
    function(callback) {
      deployment.get_instance('foo0', function(err, instance) {
        assert.ifError(err);
        assert.ok(instance);
        assert.equal(instance.name, 'foo0');
        assert.equal(instance.root, path.join(app_root, 'foo0'));
        cur_instance = instance;
        callback();
      });
    },

    // Check Instance.exists
    function(callback) {
      cur_instance.exists(function(exists) {
        assert.ok(exists);
        callback();
      });
    },

    // Check Instance.get_bundle_name
    function(callback) {
      cur_instance.get_bundle_name(function(err, name) {
        assert.ifError(err);
        assert.equal(name, 'fooapp');
        callback();
      });
    },

    // Check Instance.get_bundle_version
    function(callback) {
      cur_instance.get_bundle_version(function(version) {
        assert.equal(version, 'v1.0');
        callback();
      });
    },

    // Check Instance.get_version_path for an existing version
    function(callback) {
      cur_instance.get_version_path('v1.0', function(err, vpath) {
        assert.ifError(err);
        assert.equal(vpath, path.join(app_root, 'foo0', 'versions', 'fooapp@v1.0'));
        callback();
      });
    },

    // Check Instance.get_version path for a non-existant version
    function(callback) {
      cur_instance.get_version_path('v2.0', function(err, vpath) {
        assert.ifError(err);
        assert.equal(vpath, path.join(app_root, 'foo0', 'versions', 'fooapp@v2.0'));
        callback();
      });
    },

    // Check Instance.get_bundle_version_path for an existing bundle
    function(callback) {
      cur_instance.get_bundle_version_path('v1.0', function(err, bvpath) {
        assert.ifError(err);
        assert.equal(bvpath, path.join(ext_root, 'fooapp', 'fooapp@v1.0'));
        callback();
      });
    },

    // Check Instance.get_bundle_version_path for a non-existant bundle
    function(callback) {
      cur_instance.get_bundle_version_path('v2.0', function(err, bvpath) {
        assert.ifError(err);
        assert.equal(bvpath, path.join(ext_root, 'fooapp', 'fooapp@v2.0'));
        callback();
      });
    },

    // Check Instance.prepare_version with a non-existant version
    function(callback) {
      cur_instance.prepare_version('v2.0', function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Verify nothing broke
    function(callback) {
      verify_instance(cur_instance.name, 'fooapp', 'v1.0', callback);
    },

    // Check Instance.activate_version on an existing but unprepared version
    function(callback) {
      cur_instance.activate_version('v1.5', function(err) {
        assert.ok(err);
        callback();
      });
    },

    // Verify nothing broke
    function(callback) {
      verify_instance(cur_instance.name, 'fooapp', 'v1.0', callback);
    },

    // Check Instance.prepare_version with an existing version
    function(callback) {
      cur_instance.prepare_version('v1.5', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify the new version was prepared
    function(callback) {
      var versions = ['v1.0', 'v1.5'];
      verify_instance(cur_instance.name, 'fooapp', 'v1.0', versions, callback);
    },

    // Check Instance.activate_version on a prepared version
    function(callback) {
      cur_instance.activate_version('v1.5', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Verify the new version was activated
    function(callback) {
      var versions = ['v1.0', 'v1.5'];
      verify_instance(cur_instance.name, 'fooapp', 'v1.5', versions, callback);
    },

    // Get a list of instances
    function(callback) {
      var names = ['foo0', 'foo1'];
      deployment.get_instance_list(function(err, instance_list) {
        var i;
        assert.equal(instance_list.length, names.length);
        for (i = 0; i < instance_list.length; i++) {
          assert.ok(names.indexOf(instance_list[i].name) >= 0);
        }
        callback();
      });
    },

    // Destroy an instance
    function(callback) {
      cur_instance.destroy(callback);
    },

    // Make sure its gone
    function(callback) {
      path.exists(path.join(app_root, cur_instance.name), function(exists) {
        assert.ok(!exists);
        callback();
      });
    },

    // Make sure the associated service is gone too
    function(callback) {
      path.exists(path.join(svc_root_avail, cur_instance.name), function(exists) {
        assert.ok(!exists);
        callback();
      });
    }
  ],
  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
