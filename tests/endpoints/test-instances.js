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

var querystring = require('querystring');

var path = require('path');
var sprintf = require('sprintf').sprintf;
var async = require('async');

var jobs = require('jobs');
var control = require('control');
var http = require('services/http');
var testUtil = require('util/test');
var testConstants = require('./../constants');
var mockjobs = require('./mockjobs');
var getServer = http.getAndConfigureServer;


var instanceList = [
  {
    name: 'foo',
    bundle_name: 'fooapp',
    bundle_version: '1.0',
    service: {
      name: 'foo@1.0',
      enabled: false,
      status: null
    }
  },
  {
    name: 'bar',
    bundle_name: 'barapp',
    bundle_version: '1.0',
    service: {
      name: 'bar@1.0',
      enabled: false,
      status: null
    }
  }
];

var enabled = false;
var started = false;

control.instances = {
  listInstances: function(callback) {
    callback(null, instanceList);
  },

  getInstance: function(name, callback) {
    var instance = instanceList.filter(function(instance) {
      return instance.name === name;
    })[0];

    if (!instance) {
      callback(new jobs.NotFoundError('Instance', name));
    } else {
      callback(null, instance);
    }
  },

  createInstance: function(name, bundleName, bundleVersion) {
    if (name === 'baz') {
      return new mockjobs.SuccessfulJob({
        name: name,
        bundleName: bundleName,
        bundleVersion: bundleVersion
      });
    } else {
      return new mockjobs.ResourceExistsJob('Instance', name);
    }
  },

  upgradeInstance: function(name, bundleVersion) {
    if (name === 'baz') {
      return new mockjobs.SuccessfulJob({
        name: name,
        bundleVersion: bundleVersion
      });
    } else {
      return new mockjobs.ResourceNotFoundJob('Instance', name);
    }
  },

  deleteInstance: function(name) {
    if (name === 'baz') {
      return new mockjobs.SuccessfulJob({
        name: name
      });
    } else {
      return new mockjobs.ResourceNotFoundJob('Instance', name);
    }
  }
};


control.services = {
  enableService: function(name) {
    enabled = true;
    return new mockjobs.SuccessfulJob({
      name: name
    });
  },

  startService: function(name) {
    started = true;
    return new mockjobs.SuccessfulJob({
      name: name
    });
  }
};


exports['test_list'] = function(test, assert) {
  var req = testUtil.getReqObject('/instances/', 'GET', testConstants.API_VERSION);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, instanceList);
    test.finish();
  });
};


exports['test_get_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/instances/foo/', 'GET', testConstants.API_VERSION);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, instanceList[0]);
    test.finish();
  });
};


exports['test_get_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/instances/baz/', 'GET', testConstants.API_VERSION);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Instance \'baz\' does not exist.');
    test.finish();
  });
};


exports['test_create_success'] = function(test, assert) {
  var params = {
    'bundle_name': 'fooapp',
    'bundle_version': '1.0'
  };
  var req = testUtil.getReqObject('/instances/baz/', 'PUT', params);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'baz',
        bundleName: 'fooapp',
        bundleVersion: '1.0'
      }
    });
    test.finish();
  });
};


exports['test_create_enable_success'] = function(test, assert) {
  var params = {
    'bundle_name': 'fooapp',
    'bundle_version': '1.0',
    'enable_service': 'true'
  };
  var req = testUtil.getReqObject('/instances/baz/', 'PUT', params);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'baz',
        bundleName: 'fooapp',
        bundleVersion: '1.0'
      }
    });

    assert.ok(enabled);
    assert.ok(started);
    test.finish();
  });
};


exports['test_create_409'] = function(test, assert) {
  var params = {
    'bundle_name': 'fooapp',
    'bundle_version': '1.0'
  };
  var req = testUtil.getReqObject('/instances/foo/', 'PUT', params);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 409);
    var msg = 'Instance \'foo\' already exists.';
    assert.equal(res.body.message, msg);
    test.finish();
  });
};


exports['test_upgrade_success'] = function(test, assert) {
  var params = {
    'bundle_version': '2.0'
  };
  var req = testUtil.getReqObject('/instances/baz/upgrade/', 'POST', params);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'baz',
        bundleVersion: '2.0'
      }
    });
    test.finish();
  });
};


exports['test_upgrade_404'] = function(test, assert) {
  var params = {
    'bundle_version': '2.0'
  };
  var req = testUtil.getReqObject('/instances/foo/upgrade/', 'POST', params);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    var msg = 'Instance \'foo\' does not exist.';
    assert.deepEqual(res.body.message, msg);
    test.finish();
  });
};


exports['test_delete_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/instances/baz/', 'DELETE');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'baz'
      }
    });
    test.finish();
  });
};


exports['test_delete_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/instances/foo/', 'DELETE');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    var msg = 'Instance \'foo\' does not exist.';
    assert.deepEqual(res.body.message, msg);
    test.finish();
  });
};
