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
var async = require('extern/async');
var assert = require('assert');

var COMMANDS_PATH = path.join(process.cwd(), 'data/commands');

(function() {
  var completed = false;

  async.series([
    // Test initialization
    function(callback) {
      var parser = new CommandParser(COMMANDS_PATH);

      assert.deepEqual(parser._global_commands, ['completion']);
      assert.deepEqual(parser._normal_commands, {});
      assert.equal(parser.banner, '');
      callback();
    },

    // Test command addition and removal
    function(callback) {
      var parser = new CommandParser(COMMANDS_PATH);

      assert.deepEqual(parser._global_commands, ['completion']);
      parser.add_command('hello');
      assert.deepEqual(parser._global_commands, ['completion', 'hello']);
      parser.remove_command('hello');

      assert.deepEqual(parser._normal_commands, {});
      parser.add_commands(['services/list', 'services/restart']);
      assert.deepEqual(parser._normal_commands, { 'services': ['list', 'restart'] });
      parser.remove_commands(['services/list', 'services/restart']);
      assert.deepEqual(parser._normal_commands, {});
      callback();
    },

    // Test exception is thrown on 'append' option with no value
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
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
      assert.equal(1, n, 'Exceptions thrown');
      callback();
    },

    // Test exception is thrown when 'store_true' action is given key=value
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
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

      assert.equal(1, n, 'Exceptions thrown');
      callback();
    },

    // Test exception is thrown upon invalid command name
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
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

      assert.equal(3, n, 'Exceptions thrown');
      callback();
    },

    // Test exception is thrown upon invalid argument or argument type
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
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

      assert.equal(2, n, 'Exceptions thrown');
      callback();
    },

    // Test exception is thrown on invalid command
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
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

      assert.equal(1, n, 'Exceptions thrown');
      callback();
    },

    // Test exception is thrown on too many arguments
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
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

      assert.equal(1, n, 'Exceptions thrown');
      callback();
    },

    // Test exception is thrown on missing required argument
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
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

      assert.equal(1, n, 'Exceptions thrown');
      callback();
    },

    // Test global help
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
        stdout_data.push(string);
      };

      var parser = new CommandParser(COMMANDS_PATH, capture_write);
      parser.add_commands(['hello', 'services/list', 'services/restart']);

      assert.equal(stdout_data.length, 0);
      parser.parse(['bin', 'file', 'help']);
      assert.match(stdout_data.join(''), /.*available commands.*/i);
      callback();
    },

    // Test command help
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
        stdout_data.push(string);
      };

      var parser = new CommandParser(COMMANDS_PATH, capture_write);
      parser.add_commands(['hello', 'services/list', 'services/restart']);

      assert.equal(stdout_data.length, 0);
      parser.parse(['bin', 'file', 'help', 'services']);
      assert.match(stdout_data.join(''), /.*available sub-commands for command.*/i);
      callback();
    },

    // Test sub-command help
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
        stdout_data.push(string);
      };

      var parser = new CommandParser(COMMANDS_PATH, capture_write);
      parser.add_commands(['hello', 'services/list', 'services/restart']);

      assert.equal(stdout_data.length, 0);
      parser.parse(['bin', 'file', 'help', 'services', 'list']);
      assert.match(stdout_data.join(''), /.*services list.*/i);
      callback();
    },

    // Test global command
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
        stdout_data.push(string);
      };

      var parser = new CommandParser(COMMANDS_PATH, capture_write);
      parser.add_commands(['hello', 'services/list', 'services/restart']);

      var value = parser.parse(['bin', 'file', 'hello']);

      assert.match(value, /hello world/i);
      callback();
    },

    // Test command services list
    function(callback) {
      var stdout_data = [];
      var capture_write = function (string) {
        stdout_data.push(string);
      };

      var parser = new CommandParser(COMMANDS_PATH, capture_write);
      parser.add_commands(['hello', 'services/list', 'services/restart']);

      var value1 = parser.parse(['bin', 'file', 'services', 'list']);
      var value2 = parser.parse(['bin', 'file', 'services', 'list', 'server1']);

      assert.match(value1, /listing services for all servers/i);
      assert.match(value2, /listing services for server server1/i);
      callback();
    },

    // Test global_options
    function(callback) {
      var stdout_data = [], value, m;
      var capture_write = function (string) {
        stdout_data.push(string);
      };

      var parser = new CommandParser(COMMANDS_PATH, capture_write);
      parser.add_commands(['with_color']);

      try {
        parser.parse(['bin', 'file', 'with_color', '--colors']);
      }
      catch (e) {
        m = e.message;
      }
      assert.match(m, /colors' is undefined/i);

      parser.add_global_options({
        'colors': {
          names: ['--colors'],
          dest: 'colors',
          action: 'store_true',
          desc: 'Test option.'
        }
      });

      value = parser.parse(['bin', 'file', 'with_color', '--colors']);
      assert.deepEqual(value, { 'colors': true });
      callback();
    }
  ],
  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests complete');
  });
})();
