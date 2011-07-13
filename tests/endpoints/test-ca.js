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
var misc = require('util/misc');
var getServer = http.getAndConfigureServer;

var reqList = [
  {
    "name":"localhost",
    "csr":"csr1",
    "cert":"cert1"
  },
  {
    "name":"localhost.bar",
    "csr":"csr2",
    "cert":"cert2"
  }
];

exports.mock = control.ca = {
  listRequests: function(callback) {
    callback(null, reqList);
  },

  getRequest: function(name, callback) {
    var req = misc.filterList(reqList, 'name', name)[0];

    if (!req) {
      callback(new jobs.NotFoundError('SigningRequest', name));
    } else {
      callback(null, req);
    }
  },

  signRequest: function(name, overwrite) {
    var req = misc.filterList(reqList, 'name', name)[0];

    if (!req) {
      return new mockjobs.ResourceNotFoundJob('SigningRequest', name);
    } else {
      return new mockjobs.SuccessfulJob({
        name: name
      });
    }
  },

  deleteRequest: function(name) {
    var req = misc.filterList(reqList, 'name', name)[0];

    if (!req) {
      return new mockjobs.ResourceNotFoundJob('SigningRequest', name);
    } else {
      return new mockjobs.SuccessfulJob({
        name: name
      });
    }
  }
};


exports['test_list'] = function(test, assert) {
  var req = testUtil.getReqObject('/ca/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, reqList);
    test.finish();
  });
};

exports['test_get_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/ca/localhost/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, reqList[0]);
    test.finish();
  });
};

exports['test_get_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/ca/inexistent/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body.message, 'SigningRequest \'inexistent\' does not exist.');
    test.finish();
  });
};

exports['test_sign_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/ca/localhost/sign/', 'POST');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    test.finish();
  });
};


exports['test_sign_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/ca/inexistent/sign/', 'POST');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body.message, 'SigningRequest \'inexistent\' does not exist.');
    test.finish();
  });
};

exports['test_delete_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/ca/localhost/', 'DELETE');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      id: 'this-is-a-mock-job',
      cparams: {
        name: 'localhost'
      },
      last_emitted: 'ready'
    });
    test.finish();
  });
};

exports['test_delete_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/ca/inexistent/', 'DELETE');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body.message, 'SigningRequest \'inexistent\' does not exist.');
    test.finish();
  });
};
