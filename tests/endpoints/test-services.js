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
  },

  tailServiceLog: function(name, bytes, follow, callback) {
    var i, id;
    var initial = '';
    var errorLater = false;
  
    function unsubscribe() {
      clearInterval(id);
    }

    if (name === 'baz') {
      errorLater = true;
    }

    if (name === 'bar') {
      callback(new jobs.NotFoundError('Instance', name));
    } else {
      for (i = 0; i < bytes; i++) {
        initial += i % 10;
      }

      if (follow) {
        callback(null, initial, unsubscribe);
        id = setInterval(function() {
          callback(null, 'abcd\n', unsubscribe);
          if (errorLater) {
            callback(new Error('file is gone, etc'));
          }
        }, 10);
      } else {
        callback(null, initial);
      }
    }
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
      },
      last_emitted: 'ready'
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
      },
      last_emitted: 'ready'
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
      },
      last_emitted: 'ready'
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
      },
      last_emitted: 'ready'
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
      },
      last_emitted: 'ready'
    });

    assert.ok(restarted);
    test.finish();
  });
};


exports['test_tail_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/tail/10/', 'GET');
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '0123456789');
    test.finish();
  });
};


exports['test_tail_invalidnumber'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/tail/helloworld/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid byte length');
    test.finish();
  });
};


exports['test_tail_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/bar/tail/10/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Instance \'bar\' does not exist.');
    test.finish();
  });
};


exports['test_tail_follow_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/tail/10/follow/', 'GET');
  var received = 0;
  var series = ['a', 'b', 'c', 'd', '\n'];
  req.streamResponse = true;

  function verifyByte(b) {
    if (received < 10) {
      assert.equal(received, parseInt(b));
    } else {
      assert.equal(series[(received - 10) % 5], b);
    }
    received++;
  }

  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      for (var i = 0; i < chunk.length; i++) {
        verifyByte(chunk.charAt(i));

        if (received === 20) {
          res.destroy();
          res.emit('end');
          test.finish();
        }
      }
    });
  });
};


exports['test_tail_follow_invalidnumber'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/foo/tail/helloworld/follow/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid byte length');
    test.finish();
  });
};


exports['test_tail_follow_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/bar/tail/10/follow/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Instance \'bar\' does not exist.');
    test.finish();
  });
};


exports['test_tail_follow_errlater'] = function(test, assert) {
  var req = testUtil.getReqObject('/services/baz/tail/10/follow/', 'GET');


  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, '0123456789abcd\n');
    test.finish();
  });
};
