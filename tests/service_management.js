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

var sys = require('sys');
var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var ps = require('util/pubsub');
var misc = require('util/misc');
var async = require('extern/async');
var runit = require('runit/services');

function getServer()
{
  return require('services/http')._serverOnly();
}

// For now these need to all be in the same test, this blows
exports["service management"] = function(assert, beforeExit) {
  var n = 0;
  var tasks = [];
  var svcdir = new runit.RunitServiceDirectory('.tests/services');

  // Add a bunch of tasks
  // These all happen serially in the order they are added

  // Make sure the list call works and returns an empty array
  tasks.push(function(callback) {
    assert.response(getServer(), {
      url: '/services/',
      method: 'GET'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
        var data = JSON.parse(res.body);
        assert.ok(data instanceof Array);
        assert.equal(data.length, 0);
      }
      catch (err) {
        return callback(err);
      }
      return callback();
    });
  });

  // Create a basic services layout
  tasks.push(function(callback) {
    svcdir.create_service_layout('foo', function(err) {
      n++;
      if (err) {
        return callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    var fakerun_path = path.join(__dirname, 'fake_service', 'run');
    exec('cp ' + fakerun_path + ' .tests/services/available/foo/run', function(err) {
      n++;
      if (err) {
        return callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    assert.response(getServer(), {
      url: '/services/',
      method: 'GET'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
        var data = JSON.parse(res.body);
        assert.ok(data instanceof Array);
        assert.equal(data.length, 1);
      }
      catch (err) {
        return callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    assert.response(getServer(), {
      url: '/services/foo/',
      method: 'GET'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
        var data = JSON.parse(res.body);
        assert.ok(data instanceof Object);
        assert.equal(data.name, "foo");
        assert.equal(data.enabled, false);
        assert.equal(data.normally, "down");
      }
      catch (err) {
        return callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    assert.response(getServer(), {
      url: '/services/foo/restart/',
      method: 'PUT'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 500);
        var data = JSON.parse(res.body);
        assert.ok(data instanceof Object);
        assert.equal(data.code, 500);
        assert.ok(data.message);
      }
      catch (err) {
        return callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    assert.response(getServer(), {
      url: '/services/foo/enable/',
      method: 'PUT'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
      }
      catch (err) {
        callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    assert.response(getServer(), {
      url: '/services/foo/',
      method: 'GET'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
        var data = JSON.parse(res.body);
        assert.ok(data instanceof Object);
        assert.equal(data.name, "foo");
        assert.equal(data.enabled, true);
        assert.equal(data.normally, "down");
      }
      catch (err) {
        return callback(err);
      }
      return callback();
    });
  });

  // TODO: Actually check that these are happening
  tasks.push(function(callback) {
    assert.response(getServier(), {
      url: '/services/foo/stop/',
      method: 'PUT'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
      }
      catch (err) {
        callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    assert.response(getServier(), {
      url: '/services/foo/start/',
      method: 'PUT'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
      }
      catch (err) {
        callback(err);
      }
      return callback();
    });
  });

  tasks.push(function(callback) {
    assert.response(getServier(), {
      url: '/services/foo/restart/',
      method: 'PUT'
    },
    function(res) {
      n++;
      try {
        assert.equal(res.statusCode, 200);
      }
      catch (err) {
        callback(err);
      }
      return callback();
    });
  });

  // Execute the tasks
  async.series(tasks, function(err) {
    ps.emit(ps.AGENT_STATE_STOP);
    assert.ifError(err);
  });

  beforeExit(function(){
    assert.equal(6, n, 'Tests Completed');
  });
};

exports.setup = function(done) {
  async.series([
    async.apply(ps.ensure, "config"),
    async.apply(exec, "mkdir .tests/services"),
    async.apply(exec, "mkdir .tests/services/available"),
    async.apply(exec, "mkdir .tests/services/enabled"),
    function(callback) {
      require('services/runit').load();
      ps.emit(ps.AGENT_STATE_START);
      callback();
    },
    async.apply(ps.ensure, "cast.agent.services.runit.started")
  ],
  done);
};
