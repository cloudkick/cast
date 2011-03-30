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
var async = require('extern/async');

var assert = require('./../assert');
var test = require('util/test');
var Agent = require('services/agent')._agent;
var agentConstants = require('agent/constants');

// Dirty hack to make the tests run much faster
agentConstants.PING_INTERVAL = 300;

var responseDictionary = {
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

  this._logBuffer = [];
}

sys.inherits(AgentTest, Agent);

AgentTest.prototype.logCommand = function(command, type, commandArguments) {
  this._logBuffer.push([ command, type, commandArguments ]);
};

AgentTest.prototype.logBufferContains = function(command, type) {
  var i, item, itemCommand, itemType;

  for (i = 0; i < this._logBuffer.length; i++) {
    item = this._logBuffer[i];
    itemCommand = item[0];
    itemType = item[1];

    if (itemCommand === command && itemType === type) {
      return true;
    }
  }

  return false;
};

exports['test_agent_connection'] = function() {
// Test agent connection
  var port = test.getPort();
  var agent = new AgentTest();

  test.runTestTcpServer('127.0.0.1', port, {}, false, function() {
    var self = this;
    agent.start(port, '127.0.0.1');

    setTimeout(function() {
      agent.stop();
      self.close();
      assert.ok(agent._connected);
    }, 200);
  });
};

exports['test_agent_hello_and_ping'] = function() {
  var n = 0;
  var port = test.getPort();
  var agent = new AgentTest();
  test.runTestTcpServer('127.0.0.1', port, responseDictionary, false, function(connection) {
    var self = this;
    agent.start(port, '127.0.0.1');

    setTimeout(function() {
      n++;
      assert.ok(agent._connected);
    }, 200);

    var intervalId = setInterval(function() {
      if (agent._pongGotCount >= 2) {
        clearInterval(intervalId);
        agent.stop();
        self.close();
        assert.equal(n, 1);
        assert.equal(agent._pingSentCount, agent._pongGotCount);
      }
    }, 200);
  });
};

exports['test_command_queuing'] = function() {
  var n = 0;
  var port = test.getPort();
  var agent = new AgentTest();

  test.runTestTcpServer('127.0.0.1', port, responseDictionary, false, function(connection) {
    var self = this;
    agent.start(port, '127.0.0.1');

    setTimeout(function() {
      n++;
      var stream;
      agent._connected = false;
      assert.ok(!agent._connected);

      agent.sendCommand('run_check', {});
    }, 200);

    setTimeout(function() {
      n++;
      var pendingCommands = agent._pendingCommandsQueue;

      assert.ok(pendingCommands.length > 0);
      assert.equal(pendingCommands[0][0], 'run_check');
    }, 800);

    setTimeout(function() {
      agent.stop();
      self.close();
      assert.equal(n, 2);
    }, 900);
  });
};

exports['test_incoming_error_command'] = function() {
  var n = 0;
  var logBuffer = [];
  var port = test.getPort();
  var agent = new AgentTest();

  test.runTestTcpServer('127.0.0.1', port, responseDictionary, false, function(connection) {
    var self = this;
    agent.start(port, '127.0.0.1');

    setTimeout(function() {
      var stream;
      n++;
      assert.ok(agent._connected);
      assert.equal(agent.logBufferContains('error', 'incoming'), false);

      stream = self._streams[0];
      stream.write('error Test error reason.\n');
    }, 300);

    setTimeout(function() {
      agent.stop();
      self.close();
      assert.equal(n, 1);
    }, 400);
  });
};

exports['test_incoming_restart_command'] = function() {
  var n = 0;
  var logBuffer = [];
  var port = test.getPort();
  var agent = new AgentTest();

  test.runTestTcpServer('127.0.0.1', port, responseDictionary, false, function(connection) {
    var self = this;
    agent.start(port, '127.0.0.1');

    setTimeout(function() {
      var stream;
      n++;
      assert.ok(agent._connected);
      assert.equal(agent.logBufferContains('restart', 'incoming'), false);

      stream = self._streams[0];
      stream.write('restart\n');
    }, 300);

    setTimeout(function() {
      agent.stop();
      self.close();
      assert.equal(n, 1);
    }, 700);
  });
};
