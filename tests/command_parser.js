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

exports['test initialization'] = function(assert, beforeExit) {
  var parser = new CommandParser(COMMANDS_PATH);

  assert.deepEqual(parser._global_commands, []);
  assert.deepEqual(parser._normal_commands, {});
  assert.equal(parser.banner, '');
};

exports['test command addition and removal works properly'] = function(assert, beforeExit) {
  var parser = new CommandParser(COMMANDS_PATH);

  assert.deepEqual(parser._global_commands, []);
  parser.add_command('hello');
  assert.deepEqual(parser._global_commands, ['hello']);
  parser.remove_command('hello');

  assert.deepEqual(parser._normal_commands, {});
  parser.add_commands(['services/list', 'services/restart']);
  assert.deepEqual(parser._normal_commands, { 'services': ['list', 'restart'] });
  parser.remove_commands(['services/list', 'services/restart']);
  assert.deepEqual(parser._normal_commands, {});
};

exports['test exception is thrown on "append" option with no value'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'list', '--filter']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /requires an argument/i);
  }

  parser.parse(['bin', 'file', 'services', 'list', '--display-disabled']);

  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
};

exports['test exception is thrown when "store_true" action is given key=value'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'list', '--display-disabled=foo']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /does not take an argument/i);
  }

  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
}

exports['test exception is thrown upon invalid command name'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.add_command('invalid name');
  }
  catch (e) {
    n++;
  }
  try {
    parser.add_commands(['invalid name']);
  }
  catch (e2) {
    n++;
  }

  try {
    parser.remove_command(['invalid name']);
  }
  catch (e3) {
    n++;
  }

  beforeExit(function() {
    assert.equal(3, n, 'Exceptions thrown');
  });
};

exports['test exception is thrown upon invalid argument or argument type'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.add_commands('hello');
  }
  catch (e) {
    n++;
    assert.match(e.message, /must be an array/i);
  }
  try {
    parser.remove_commands('hello');
  }
  catch (e2) {
    n++;
    assert.match(e2.message, /must be an array/i);
  }

  beforeExit(function() {
    assert.equal(2, n, 'Exceptions thrown');
  });
};

exports['test exception is thrown on invalid command'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'invalid command']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /invalid command/i);
  }

  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
};

exports['test exception is thrown on too many arguments'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'list', 'localhost', '--foo=bar']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /too many/i);
  }

  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
};

exports['test exception is thrown on missing required argument'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var n = 0;

  try {
    parser.parse(['bin', 'file', 'services', 'restart']);
  }
  catch (error) {
    n++;
    assert.match(error.message, /missing required argument/i);
  }

  beforeExit(function() {
    assert.equal(1, n, 'Exceptions thrown');
  });
};

exports['test global help'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  assert.equal(stdout_data.length, 0);
  parser.parse(['bin', 'file', 'help']);
  assert.match(stdout_data.join(''), /.*available commands.*/i);
};

exports['test command help'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  assert.equal(stdout_data.length, 0);
  parser.parse(['bin', 'file', 'help', 'services']);
  assert.match(stdout_data.join(''), /.*available sub-commands for command.*/i);

  beforeExit(function() {
    stdout_data = [];
  });
};

exports['test sub-command help'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  assert.equal(stdout_data.length, 0);
  parser.parse(['bin', 'file', 'help', 'services', 'list']);
  assert.match(stdout_data.join(''), /.*services list.*/i);

  beforeExit(function() {
    stdout_data = [];
  });
};
exports['test global command'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var value = parser.parse(['bin', 'file', 'hello']);

  assert.match(value, /hello world/i);
};

exports['test command services list'] = function(assert, beforeExit) {
  var stdout_data = [];
  capture_write = function (string) {
    stdout_data.push(string);
  };

  var parser = new CommandParser(COMMANDS_PATH, capture_write);
  parser.add_commands(['hello', 'services/list', 'services/restart']);

  var value1 = parser.parse(['bin', 'file', 'services', 'list']);
  var value2 = parser.parse(['bin', 'file', 'services', 'list', 'server1']);

  assert.match(value1, /listing services for all servers/i);
  assert.match(value2, /listing services for server server1/i);
};
