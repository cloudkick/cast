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


var instances = require('./test-instances');

var serviceList = [
  {
    name: 'foo@1.0',
    enabled: false,
    status: null
  },
  {
    name: 'bar@1.0',
    enabled: false,
    status: null
  }
];
var instanceList = instances.instanceList;

var enabled = false;
var disabled = false;
var started = false;
var stopped = false;
var restarted = false;

control.services = {
  listServices: function(callback) {
    callback(null, serviceList);
  },

  getService: function(name, callback) {
    var service;
    var instance = instanceList.filter(function(instance) {
      return instance.name === name;
    })[0];

    if (!instance) {
      callback(new jobs.NotFoundError('Service', name));
    } else {
      service = instance.service;
      callback(null, service);
    }
  },

  enableService: function(name) {
    enabled = true;
    return new mockjobs.SuccessfulJob({
      name: name
    });
  },

  disableService: function(name) {
    disabled = true;
    return new mockjobs.SuccessfulJob({
      name: name
    });
  },

  startService: function(name) {
    started = true;
    return new mockjobs.SuccessfulJob({
      name: name
    });
  },

  stopService: function(name) {
    stopped = true;
    return new mockjobs.SuccessfulJob({
      name: name
    });
  },

  restartService: function(name) {
    restarted = true;
    return new mockjobs.SuccessfulJob({
      name: name
    });
  }
};


exports['test_list'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, serviceList);
    test.finish();
  });
};


exports['test_get_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, serviceList[0]);
    test.finish();
  });
};


exports['test_get_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/baz/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Service \'baz\' does not exist.');
    test.finish();
  });
};


exports['test_enable_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/enable/', 'PUT');
  assert.ok(!enabled);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'foo',
      }
    });

    assert.ok(enabled);
    test.finish();
  });
};


exports['test_disable_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/disable/', 'PUT');
  assert.ok(!disabled);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'foo',
      }
    });

    assert.ok(disabled);
    test.finish();
  });
};


exports['test_start_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/start/', 'PUT');
  assert.ok(!started);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'foo',
      }
    });

    assert.ok(started);
    test.finish();
  });
};


exports['test_stop_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/stop/', 'PUT');
  assert.ok(!stopped);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'foo',
      }
    });

    assert.ok(stopped);
    test.finish();
  });
};


exports['test_restart_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/restart/', 'PUT');
  assert.ok(!restarted);
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'foo',
      }
    });

    assert.ok(restarted);
    test.finish();
  });
};
