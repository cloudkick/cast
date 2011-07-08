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

var config = require('util/config');
var managers = require('cast-agent/managers');
var control = require('control');
var testUtil = require('util/test');

exports['setUp'] = function(test, assert) {
  // Set up agent to use the mock service manager
  config.configFiles = [
    'test-mock-service-manager.conf'
  ];

  async.parallel([
    managers.initManagers.bind(null),
    config.setupAgent.bind(null)
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};

function verifyServiceAttributes(instanceName, attributes, statusAttribute,
                                 assert, callback) {
  statusAttribute = statusAttribute || false;
  control.services.getService(instanceName, function(err, service) {
    var actualValue, expectedValue;
    assert.ifError(err);

    for (var key in attributes) {
      if (attributes.hasOwnProperty(key)) {
        expectedValue = attributes[key];

        if (statusAttribute) {
          actualValue = service['status'][key];
        }
        else {
          actualValue = service[key];
        }

        assert.deepEqual(actualValue, expectedValue);
      }
    }

    callback();
  });
}

exports['test_services'] = function(test, assert) {
  var instanceName = 'foo0';

  async.series([
    async.apply(exec, 'mkdir -p .tests/data_root/services'),
    async.apply(exec, 'mkdir -p .tests/data_root/services-enabled'),

    function listServicesIsEmpty(callback) {
      control.services.listServices(function(err, services) {
        assert.ifError(err);
        assert.deepEqual(services, []);
        callback();
      });
    },

    // Prepare some extracted bundles
    function prepareBundle(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);
      control.bundles.addBundle('fooapp', '1.0', tbStream, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Create instance
    testUtil.runJobMethod.bind(null, control.instances.createInstance, null,
                              [instanceName, 'fooapp', '1.0'], assert),

    function listServicesHasOneService(callback) {
      var expected = [ { name: 'foo0@1.0', enabled: false, status: null } ];
      control.services.listServices(function(err, services) {
        assert.ifError(err);
        assert.deepEqual(services, expected);
        callback();
      });
    },

    // getService
    function getService(callback) {
      control.services.getService(function(err, service) {
        assert.ifError(err);
        assert.equal(service.name, 'foo@1.0');
        callback();
      });
    },

    // Enable service
    testUtil.runJobMethod.bind(null, control.services.enableService, null,
                              [instanceName], assert),
    verifyServiceAttributes.bind(null, instanceName, {'enabled': true}, false,
                                 assert),

    // Start service
    testUtil.runJobMethod.bind(null, control.services.startService, null,
                              [instanceName], assert),
    verifyServiceAttributes.bind(null, instanceName, {'state': 'running'}, true,
                                 assert),

    // Stop service
    testUtil.runJobMethod.bind(null, control.services.stopService, null,
                              [instanceName], assert),
    verifyServiceAttributes.bind(null, instanceName, {'state': 'down'}, true,
                                 assert),

    // Restart service
    testUtil.runJobMethod.bind(null, control.services.restartService, null,
                              [instanceName], assert),
    verifyServiceAttributes.bind(null, instanceName, {'state': 'running'}, true,
                                 assert),

    // Disable service
    testUtil.runJobMethod.bind(null, control.services.disableService, null,
                              [instanceName], assert),
    verifyServiceAttributes.bind(null, instanceName, {'enabled': false}, false,
                                assert),
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
