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

var control = require('control');
var testUtil = require('util/test');
var http = require('services/http');
var jobs = require('jobs');
var mockjobs = require('./mockjobs');
var getServer = http.getAndConfigureServer;


var listed = false;


exports.mock = control.jobs = {
  listJobs: function(callback) {
    if (!listed) {
      var j = new mockjobs.SuccessfulJob({});
      j.on('ready', function() {
        listed = true;
        callback(null, [j]);
      });
    } else {
      callback(new Error('Random server error'));
    }
  },

  getJob: function(id, callback) {
    if (id ===  'foo') {
      var j = new mockjobs.SuccessfulJob({
        id: id
      });
      j.on('ready', function() {
        callback(null, j);
      });
    } else if (id === 'bar'){
      callback(new jobs.NotFoundError('Job', id));
    } else {
      callback(null, new mockjobs.EventuallyFailingJob('oops'));
    }
  }
};


exports['test_list_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/jobs/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [
      {
        id: 'this-is-a-mock-job',
        cparams: {},
        last_emitted: 'ready'
      }
    ]);
    test.finish();
  });
};


exports['test_list_error'] = function(test, assert) {
  var req = testUtil.getReqObject('/jobs/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Random server error');
    test.finish();
  });
};


exports['test_get_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/jobs/foo/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        id: 'foo'
      },
      last_emitted: 'ready'
    });
    test.finish();
  });
};


exports['test_get_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/jobs/bar/');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body.message, 'Job \'bar\' does not exist.');
    test.finish();
  });
};


exports['test_wait_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/jobs/foo/wait/');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        id: 'foo'
      },
      last_emitted: 'success'
    });
    test.finish();
  });
};


exports['test_wait_error'] = function(test, assert) {
  var req = testUtil.getReqObject('/jobs/baz/wait/');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: null,
      last_emitted: 'error'
    });
    test.finish();
  });
};


exports['test_wait_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/jobs/bar/wait/');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Job \'bar\' does not exist.');
    test.finish();
  });
};
