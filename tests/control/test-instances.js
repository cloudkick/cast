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

var managers = require('cast-agent/managers');
var control = require('control');
var constants = require('deployment/constants');


// Decrease the delay so the tests run faster
constants.RUNIT_DELAY = 0;


exports['setUp'] = function(test, assert) {
  managers.initManagers(function(err) {
    assert.ifError(err);
    test.finish();
  });
};


exports['test_deployment'] = function(test, assert) {
  async.series([
    async.apply(exec, 'mkdir -p .tests/data_root/services'),
    async.apply(exec, 'mkdir -p .tests/data_root/services-enabled'),

    // Prepare some extracted bundles
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);
      control.bundles.addBundle('fooapp', '1.0', tbStream, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);
      control.bundles.addBundle('fooapp', '1.5', tbStream, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Create an instance from one of the bundles
    function(callback) {
      var j = control.instances.createInstance('foo0', 'fooapp', '1.0');
      j.on('success', callback);
      j.on('error', assert.fail.bind(assert));
    },

    // Verify the instance
    function(callback) {
      control.instances.getInstance('foo0', function(err, instance) {
        assert.ifError(err);
        assert.deepEqual(instance, {
          name: 'foo0',
          bundle_name: 'fooapp',
          bundle_version: '1.0',
          service: {
            name: 'foo0@1.0',
            enabled: false,
            status: null
          }
        });
        callback();
      });
    },

    // Verify the instance list
    function(callback) {
      control.instances.listInstances(function(err, instances) {
        assert.ifError(err);
        assert.equal(instances.length, 1);
        assert.deepEqual(instances[0], {
          name: 'foo0',
          bundle_name: 'fooapp',
          bundle_version: '1.0',
          service: {
            name: 'foo0@1.0',
            enabled: false,
            status: null
          }
        });
        callback();
      });
    },

    // Try to create an instance that already exists
    function(callback) {
      var j = control.instances.createInstance('foo0', 'fooapp', '1.0');
      j.on('error', function(err) {
        assert.equal(err.message, 'Instance \'foo0\' already exists.');
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // Try to create an instance using a bundle name that doesn't exist
    function(callback) {
      var j = control.instances.createInstance('foo1', 'barapp', '1.0');
      j.on('error', function(err) {
        assert.equal(err.message, 'Invalid bundle name or version');
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // Try to create an instance using a bundle version that doesn't exist
    function(callback) {
      var j = control.instances.createInstance('foo1', 'fooapp', '2.0');
      j.on('error', function(err) {
        assert.equal(err.message, 'Invalid bundle name or version');
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // Try to get an instance that does not exist
    function(callback) {
      control.instances.getInstance('foo1', function(err, instance) {
        assert.equal(err.message, 'Instance \'foo1\' does not exist.');
        callback();
      });
    },

    // Try to upgrade the instance to a version that doesn't exist
    function(callback) {
      var j = control.instances.upgradeInstance('foo0', '6.0');
      j.on('error', function(err) {
        assert.equal(err.message, 'Bundle fooapp version 6.0 doesn\'t exist');
        callback();
      });
      j.on('success', assert.fail.bind(assert));
    },

    // Upgrade the instance
    function(callback) {
      var j = control.instances.upgradeInstance('foo0', '1.5');
      j.on('success', callback);
      j.on('error', assert.fail.bind(assert));
    },

    // Verify the instance
    function(callback) {
      control.instances.getInstance('foo0', function(err, instance) {
        assert.ifError(err);
        assert.deepEqual(instance, {
          name: 'foo0',
          bundle_name: 'fooapp',
          bundle_version: '1.5',
          service: {
            name: 'foo0@1.5',
            enabled: false,
            status: null
          }
        });
        callback();
      });
    },

    // Destroy the instance
    function(callback) {
      var j = control.instances.deleteInstance('foo0');
      j.on('success', callback);
      j.on('error', assert.fail.bind(assert));
    },

    // Verify that there are no instances
    function(callback) {
      control.instances.listInstances(function(err, instances) {
        assert.ifError(err);
        assert.deepEqual(instances, []);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
