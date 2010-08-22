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
var exec = require('child_process').exec;
var ps = require('util/pubsub');
var misc = require('util/misc');
var async = require('extern/async');
var runit = require('lib/runit');

var completed = 0;
var total = 0;

// Is there a way to do this automagically?
function has_paths(count) {
  total += count;
}

function finish_path() {
  if (--total === 0) {
    ps.emit(ps.AGENT_STATE_STOP);
  }
}

function getServer()
{
  return require('services/http')._serverOnly();
}



// For now these need to all be in the same test, this blows
has_paths(1);
exports["service management"] = function(assert, beforeExit) {
  var n = 0;
  var tasks = [];
  var svcdir = new runit.RunitServiceDirectory('.tests/services');

  // Add a bunch of tasks
  // These all happen serially in the order they are added

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
        assert.equal(typeof(data), 'array');
        assert.equal(data.length, 0);
      }
      finally {
        finish_path();
        callback();
      }
    });
  });

  tasks.push(function(callback) {
    svcdir.create_service_layout('foo', function() {
      

    });
    

  });


  async.series(tasks, function() {
    n++;
  });

  // Execute the tasks
  beforeExit(function(){
    assert.equal(2, n, 'Tests Completed');
  });
};

exports.setup = function(done) {
  async.series([
    async.apply(ps.ensure, "config"),
    async.apply(exec, "mkdir .tests/services"),
    async.apply(exec, "mkdir .tests/services-available"),
    function(callback) {
      require('services/runit').load();
      ps.emit(ps.AGENT_STATE_START);
      callback();
    },
    async.apply(ps.ensure, "cast.agent.services.runit.started")
  ],
  done);
};
