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

var sprintf = require('extern/sprintf').sprintf;

var test = require('util/test');
var Agent = require('services/agent')._Agent;
var agent_constants = require('agent/constants');
var async = require('extern/async');
var assert = require('assert');

// Dirty hack to make the tests run much faster
agent_constants.PING_INTERVAL = 1000;

var response_dictionary = {
  'hello (\\d) (.*?) ([a-zA-Z0-9]+) ([a-zA-Z0-9]+)': {
    'type': 'regexp',
    'response': 'accepted\n'
  },

  'ping (\\d+)': {
    'type': 'regexp',
    'response': function(matches) { return sprintf('pong %s\n', matches[1]); }
  }
};

/* Special case of the Agent service class which saves log messages to an
 * internal array instead of using log function and printing them to
 * stdout / stderr.
 */
function AgentTest() {
  Agent.call(this);

  this._log_buffer = [];
}

sys.inherits(AgentTest, Agent);

AgentTest.prototype.log_command = function(command, type, command_arguments) {
  this._log_buffer.push([ command, type, command_arguments ]);
};

AgentTest.prototype.log_buffer_contains = function(command, type) {
  var i, item, item_command, item_type;

  for (i = 0; i < this._log_buffer.length; i++) {
    item = this._log_buffer[i];
    item_command = item[0];
    item_type = item[1];

    if (item_command === command && item_type === type) {
      return true;
    }
  }

  return false;
};

(function() {
  var completed = false;

  async.parallel([
    // Test agent connection
    function(callback) {
      var port = test.get_port();
      var agent = new AgentTest();
      test.run_test_tcp_server('127.0.0.1', port, {}, false, function() {
        var self = this;
        agent.start(port, '127.0.0.1');

        setTimeout(function() {
          assert.ok(agent._connected);
          agent.stop();
          self.close();
          callback();
        }, 500);
      });
    },

    // Test Agent 'hello' and 'ping'
    function(callback) {
      var n = 0;
      var port = test.get_port();
      var agent = new AgentTest();
      test.run_test_tcp_server('127.0.0.1', port, response_dictionary, false, function(connection) {
        var self = this;
        agent.start(port, '127.0.0.1');

        setTimeout(function() {
          n++;
          assert.ok(agent._connected);
        }, 500);

        var interval_id = setInterval(function() {
          if (agent._pong_got_count >= 2) {
            clearInterval(interval_id);
            assert.equal(n, 1);
            assert.equal(agent._ping_sent_count, agent._pong_got_count);
            agent.stop();
            self.close();
            callback();
          }
        }, 500);
      });
    },

    /*
    TODO: This is failing for reasons that remain unclear
    // Test command queing
    function(callback) {
      var n = 0;
      var port = test.get_port();
      var agent = new AgentTest();

      test.run_test_tcp_server('127.0.0.1', port, response_dictionary, false, function(connection) {
        var self = this;
        agent.start(port, '127.0.0.1');

        setTimeout(function() {
          n++;
          var stream;
          assert.ok(agent._connected);

          stream = self._streams[0];
          stream.write('run_check foobar12345 test_check 0\r\n');
          stream.write('{}\n');

          agent._connection.end();
        }, 500);

        setTimeout(function() {
          n++;
          var pending_commands = agent._pending_commands_queue;

          assert.ok(pending_commands.length > 0);
          assert.equal(pending_commands[0][0], 'result');
        }, 2000);

        setTimeout(function() {
          agent.stop();
          self.close();
          assert.equal(n, 2);
          callback();
        }, 4000);
      });
    }
    */

    // Test incoming error command
    function(callback) {
      var n = 0;
      var log_buffer = [];
      var port = test.get_port();
      var agent = new AgentTest();

      test.run_test_tcp_server('127.0.0.1', port, response_dictionary, false, function(connection) {
        var self = this;
        agent.start(port, '127.0.0.1');

        setTimeout(function() {
          var stream;
          n++;
          assert.ok(agent._connected);
          assert.equal(agent.log_buffer_contains('error', 'incoming'), false);

          stream = self._streams[0];
          stream.write('error Test error reason.\n');
        }, 500);

        setTimeout(function() {
          assert.equal(n, 1);
          agent.stop();
          self.close();
          callback();
        }, 3000);
      });
    },

    // Test incoming restart command
    function(callback) {
      var n = 0;
      var log_buffer = [];
      var port = test.get_port();
      var agent = new AgentTest();

      test.run_test_tcp_server('127.0.0.1', port, response_dictionary, false, function(connection) {
        var self = this;
        agent.start(port, '127.0.0.1');

        setTimeout(function() {
          var stream;
          n++;
          assert.ok(agent._connected);
          assert.equal(agent.log_buffer_contains('restart', 'incoming'), false);

          stream = self._streams[0];
          stream.write('restart\n');
        }, 500);

        setTimeout(function() {
          assert.equal(n, 1);
          agent.stop();
          self.close();
          callback();
        }, 2500);
      });
    }
  ],
  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
