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

var async = require('extern/async');

var CommandParser = require('util/command_parser').CommandParser;
var assert = require('./../assert');

var COMMANDS_PATH = path.join(process.cwd(), 'data/commands');

exports['test_initialization'] = function() {
  var completed = false;
  var parser = new CommandParser(COMMANDS_PATH);

  assert.deepEqual(parser._globalCommands, ['completion']);
  assert.deepEqual(parser._normalCommands, {});
  assert.equal(parser.banner, '');
};

exports['test_command_additional_and_removal'] = function() {
    // Test command addition and removal
  var parser = new CommandParser(COMMANDS_PATH);

  assert.deepEqual(parser._globalCommands, ['completion']);
  parser.addCommand('hello');
  assert.deepEqual(parser._globalCommands, ['completion', 'hello']);
  parser.removeCommand('hello');

  assert.deepEqual(parser._normalCommands, {});
  parser.addCommands(['services/list', 'services/restart']);
  assert.deepEqual(parser._normalCommands, { 'services': ['list', 'restart'] });
  parser.removeCommands(['services/list', 'services/restart']);
  assert.deepEqual(parser._normalCommands, {});
};

exports['test_exception_is_thrown_on_append_with_no_value'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'list', '--filter']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /requires an argument/i);
  }

  parser.parse(['bin', 'file', 'services', 'list', '--display-disabled']);
  assert.equal(1, n, 'Exceptions thrown');
};

exports['test_exception_is_thrown_when_store_true_is_given_key_value'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'list', '--display-disabled=foo']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /does not take an argument/i);
  }

  assert.equal(1, n, 'Exceptions thrown');
};

exports['test_exception_is_thrown_upon_invalid_command_name'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.addCommand('invalid name');
  }
  catch (e) {
    n++;
  }
  try {
    parser.addCommands(['invalid name']);
  }
  catch (e2) {
    n++;
  }

  try {
    parser.removeCommand(['invalid name']);
  }
  catch (e3) {
    n++;
  }

  assert.equal(3, n, 'Exceptions thrown');
};

exports['test_exception_is_thrown_upon_invalid_argument_or_type'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.addCommands('hello');
  }
  catch (e) {
    n++;
    assert.match(e.message, /must be an array/i);
  }
  try {
    parser.removeCommands('hello');
  }
  catch (e2) {
    n++;
    assert.match(e2.message, /must be an array/i);
  }

  assert.equal(2, n, 'Exceptions thrown');
};

exports['test_exception_is_thrown_on_invalid_command'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'invalid command']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /invalid command/i);
  }

  assert.equal(1, n, 'Exceptions thrown');
};

exports['test_exception_is_thrown_on_too_many_arguments'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'list', 'localhost', '--foo=bar']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /too many/i);
  }

  assert.equal(1, n, 'Exceptions thrown');
};

exports['test_exception_is_thrown_on_missing_required_argument'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'restart']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /missing required argument/i);
  }

  assert.equal(1, n, 'Exceptions thrown');
};

exports['test_global_help'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  assert.equal(stdoutData.length, 0);
  parser.parse(['bin', 'file', 'help']);
  assert.match(stdoutData.join(''), /.*available commands.*/i);
};

exports['test_command_help'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  assert.equal(stdoutData.length, 0);
  parser.parse(['bin', 'file', 'help', 'services']);
  assert.match(stdoutData.join(''), /.*available sub-commands for command.*/i);
};

exports['test_sub_command_help'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  assert.equal(stdoutData.length, 0);
  parser.parse(['bin', 'file', 'help', 'services', 'list']);
  assert.match(stdoutData.join(''), /.*services list.*/i);
};

exports['test_global_command'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var value = parser.parse(['bin', 'file', 'hello']);

  assert.match(value, /hello world/i);
};

exports['test_command_services_list'] = function() {
  var stdoutData = [];
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['hello', 'services/list', 'services/restart']);

  var value1 = parser.parse(['bin', 'file', 'services', 'list']);
  var value2 = parser.parse(['bin', 'file', 'services', 'list', 'server1']);

  assert.match(value1, /listing services for all servers/i);
  assert.match(value2, /listing services for server server1/i);
};

exports['test_command_services_list'] = function() {
  var stdoutData = [], value, m;
  var captureWrite = function (string) {
    stdoutData.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, captureWrite);
  parser.addCommands(['with_color']);

  try {
    parser.parse(['bin', 'file', 'with_color', '--colors']);
  }
  catch (e) {
    m = e.message;
  }
  assert.match(m, /colors' is undefined/i);

  parser.addGlobalOptions({
    'colors': {
      names: ['--colors'],
      dest: 'colors',
      action: 'store_true',
      desc: 'Test option.'
    }
  });

  value = parser.parse(['bin', 'file', 'with_color', '--colors']);
  assert.deepEqual(value, { 'colors': true });
};
