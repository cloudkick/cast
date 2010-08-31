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
 
var path = require('path');

var CommandParser = require('util/command_parser').CommandParser;

var COMMANDS_PATH = path.join(__dirname, 'data/commands');

var GLOBAL_COMMANDS = ['hello'];
var NORMAL_COMMANDS = {
  'services': ['list', 'restart']
}

var stdout_data = [];
global.process.stdout.write = function (string) {
  stdout_data.push(string);
};

var parser = new CommandParser(COMMANDS_PATH, GLOBAL_COMMANDS, NORMAL_COMMANDS);
parser.banner = 'moo';

exports['test initialization'] = function(assert, beforeExit) {
  assert.equal(parser.global_commands, GLOBAL_COMMANDS);
  assert.equal(parser.normal_commands, NORMAL_COMMANDS);
  assert.equal(parser.banner, 'moo');
};

exports['test exception is thrown on invalid command'] = function(assert, beforeExit) {
  var n = 0;
  
  try {
    parser.parse(['bin', 'file', 'invalid command']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /invalid command/i)
  }
  
  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
};

exports['test exception is thrown on invalid number of arguments'] = function(assert, beforeExit) {
  var n = 0;
  
  try {
    parser.parse(['bin', 'file', 'services', 'list', 'arg1', 'arg2']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /invalid number of arguments/i);
  }
  
  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
};

exports['test global help'] = function(assert, beforeExit) {
  stdout_data = [];
  
  assert.equal(stdout_data.length, 0);
  parser.parse(['bin', 'file', 'help']);
  assert.match(stdout_data.join(''), /.*available commands.*/i)
};

exports['test command help'] = function(assert, beforeExit) {
  stdout_data = [];
  
  assert.equal(stdout_data.length, 0);
  parser.parse(['bin', 'file', 'help', 'services']);
  assert.match(stdout_data.join(''), /.*available sub-commands for command.*/i)
  
  beforeExit(function() {
    stdout_data = [];
  });
};

exports['test sub-command help'] = function(assert, beforeExit) {
  stdout_data = [];
  
  assert.equal(stdout_data.length, 0);
  parser.parse(['bin', 'file', 'help', 'services', 'list']);
  assert.match(stdout_data.join(''), /.*help for services list.*/i)
  
  beforeExit(function() {
    stdout_data = [];
  });
};
exports['test global command'] = function(assert, beforeExit) {
  var value = parser.parse(['bin', 'file', 'hello']);
  
  assert.match(value, /hello world/i);
};

exports['test command services list'] = function(assert, beforeExit) {
  var value1 = parser.parse(['bin', 'file', 'services', 'list']);
  var value2 = parser.parse(['bin', 'file', 'services', 'list', 'server1']);
  
  assert.match(value1, /listing services for all servers/i);
  assert.match(value2, /listing services for server server1/i)
};
