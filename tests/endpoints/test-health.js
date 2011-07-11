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

var async = require('async');

var jobs = require('jobs');
var control = require('control');
var testUtil = require('util/test');
var http = require('services/http');
var getServer = http.getAndConfigureServer;


var checks = [
  {
    id: 'AD768E6F-7F12-48C1-B65C-D52C9EEF9BA0',
      check: {
      name: 'HTTP check',
      checkArguments: {
        url: 'http://127.0.0.1/c1',
        type: 0,
        match_value: 1,
        host: '127.0.0.1',
        path: '/c1',
        secure: false,
        port: 80
      },
      resultHistory: [],
      lastRunDate: null
    },
    interval: 10000000,
    timeoutId: null,
    isPaused: false,
    isScheduled: false,
    lastRunDate: null
  },
  {
    id: '7047AAC4-2956-41D0-B418-F990FA87D1FB',
      check: {
      name: 'HTTP check',
      checkArguments: {
        url: 'http://127.0.0.1/c1',
        type: 0,
        match_value: 1,
        host: '127.0.0.1',
        path: '/c2',
        secure: false,
        port: 80
      },
      resultHistory: [],
      lastRunDate: null
    },
    interval: 10000000,
    timeoutId: null,
    isPaused: false,
    isScheduled: true,
    lastRunDate: null
  }
];


control.health = {
  listChecks: function(callback) {
    callback(null, checks);
  },
  
  listScheduledChecks: function(callback) {
    callback(null, [checks[1]]);
  },

  getCheck: function(id, callback) {
    var check = checks.filter(function(check) {
      return check.id === id;
    })[0];

    if (check) {
      callback(null, check);
    } else {
      callback(new jobs.NotFoundError('Check', id));
    }
  }
};


exports['test_list'] = function(test, assert) {
  var req = testUtil.getReqObject('/health/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, checks);
    test.finish();
  });
};


exports['test_scheduled_list'] = function(test, assert) {
  var req = testUtil.getReqObject('/health/scheduled/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [checks[1]]);
    test.finish();
  });
};


exports['test_get_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/health/AD768E6F-7F12-48C1-B65C-D52C9EEF9BA0/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, checks[0]);
    test.finish();
  });
};


exports['test_get_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/health/AD768E6F-7F12-48C1-B65C-D52C9EEF9BA9/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Check \'AD768E6F-7F12-48C1-B65C-D52C9EEF9BA9\' does not exist.');
    test.finish();
  });
};
