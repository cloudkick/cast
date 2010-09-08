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
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;

var log = require('util/log');
var misc = require('util/misc');

/**
 * CommandParser class.
 *
 * @param {String} commands_path Path to the directory containing command modules and directories
 *
 * @constructor
 */
function CommandParser(commands_path, output_func) {
  this.binary  = '';
  this.banner = '';

  this.puts = output_func;
  if (output_func === undefined) {
    this.puts = sys.puts;
  }

  this._commands_path = commands_path;
  this._commands_modules = {};

  this._global_commands = []; // Holds an array of the available global commands
  this._normal_commands = {}; // Holds and object where a property is a command name and a value is an array of
                              // the available sub-commands
}

/**
 * Add a command to the command parser.
 *
 * Global commands modules must be located inside a root of the <commands_path> directory and modules for the sub-commands
 * must be located inside a <commands_path>/<command name> directory.
 *
 * @param {String} command_name Command name
 *
 */
CommandParser.prototype.add_command = function(command_name) {
  var module_path, module, command, sub_command;

  if (command_name.indexOf('/') === -1) {
    // Global command
    try {
      command = command_name;
      module_path = path.join(this._commands_path, command_name);
      module = require(module_path);

      this._global_commands.push(command);
    }
    catch (error) {
      throw new Error(sprintf('Module for command "%s" does not exist', command));
    }
  }
  else {
    // Normal command
    var splitted = command_name.split('/');
    command = splitted[0];
    sub_command = splitted[1];

    module_path = path.join(this._commands_path, command, sub_command);

    try {
      module = require(module_path);

      if (!this._normal_commands.hasOwnProperty(command)) {
        this._normal_commands[command] = [];
      }

      this._normal_commands[command].push(sub_command);
    }
    catch (error2) {
      throw new Error(sprintf('Module for command "%s" does not exist', command));
    }
  }

  this._commands_modules[command_name] = module;
};

/**
 * Add multiple commands to the command parser.
 *
 * @param {Array} commands Array of the command names
 *
 */
CommandParser.prototype.add_commands = function(commands) {
  if (!commands) {
    throw new Error('Missing commands argument');
  }
  else if (!(commands instanceof Array)) {
    throw new Error('Commands argument must be an array');
  }

  for (var i = 0; i < commands.length; i++) {
    this.add_command(commands[i]);
  }
};

/**
 * Remove a command from the command parser.
 *
 * @param {String} command_name Command name
 *
 */
CommandParser.prototype.remove_command = function(command_name) {
  var index;

  if (!this._commands_modules.hasOwnProperty(command_name)) {
    throw new Error(sprintf('Command %s does not exist', command_name));
  }

  if (command_name.indexOf('/') === -1) {
    command = command_name;
    index = this._global_commands.indexOf(command);

    this._global_commands.splice(index, 1);
  }
  else {
    var splitted = command_name.split('/');
    command = splitted[0];
    sub_command = splitted[1];

    index = this._normal_commands[command].indexOf(sub_command);
    this._normal_commands[command].splice(index, 1);

    if (this._normal_commands[command].length === 0) {
      delete this._normal_commands[command];
    }
  }

  delete this._commands_modules[command_name];
};

/**
 * Remove multiple commands from the command parser.
 *
 * @param {Array} commands Array of the command names
 *
 */
CommandParser.prototype.remove_commands = function(commands) {
  if (!commands) {
    throw new Error('Missing commands argument');
  }
  else if (!(commands instanceof Array)) {
    throw new Error('Commands argument must be an array');
  }

  for (var i = 0; i < commands.length; i++) {
    this.remove_command(commands[i]);
  }
};

CommandParser.prototype.parse = function(argv) {
  var binary = argv.shift();
  var file = argv.shift();
  var command = argv.shift();

  var sub_command, module, config, handler, i;
  var arguments_dictionary = {};

  if (!command || (command === 'help' || command === '--help' || command === '-h')) {
    if (argv.length == 1) {
      // Command help
      if (misc.in_array(argv[0], this._global_commands)) {
        this.show_global_command_help(argv[0]);

        return;
      }
      else if (this._normal_commands.hasOwnProperty(argv[0]))
      {
        this.show_normal_command_help(argv[0], null);

        return;
      }
    }
    else if (argv.length == 2 && (this._normal_commands.hasOwnProperty(argv[0])) &&
             misc.in_array(argv[1], this._normal_commands[argv[0]])) {
      // Sub-command help
      this.show_normal_command_help(argv[0], argv[1]);

      return;
    }

    // Help
    this.show_help();

    return;
  }
  else if (!(misc.in_array(command, this._global_commands)) && !(this._normal_commands.hasOwnProperty(command))) {
    throw new Error('Invalid command. For a list of valid commands, run the help command');
  }

  if (misc.in_array(command, this._global_commands)) {
    module = this._commands_modules[command];

    config = module.config;
    handler = module.handle_command;
  }
  else {
    if (argv.length > 0) {
      // Sub-command
      sub_command = argv.shift();

      if (!misc.in_array(sub_command, this._normal_commands[command])) {
        throw new Error(sprintf('Invalid sub-command: %s', sub_command));
      }

      module = this._commands_modules[sprintf('%s/%s', command, sub_command)];

      config = module.config;
      handler = module.handle_command;
    }
    else {
      // No sub-command specified, show all the available sub-commands
      this.show_command_sub_commands(command);

      return;
    }
  }

  var using_key_value_format = false;
  var required_arguments, optional_arguments, all_arguments, switches, value, argument_name, argument_value;

  var arguments_count = argv.length;
  var arguments_original = argv.slice(0);

  required_arguments = config.required_arguments.map(function(item) { return item[0]; });
  optional_arguments = config.optional_arguments.map(function(item) { return item[0]; });

  all_arguments = required_arguments.concat(optional_arguments);
  switches = config.switches.map(function(item) { return item[0]; });

  // Check for the switches and arguments passed in the --key=value format
  for (i = 0; i < arguments_count; i++) {
    value = arguments_original[i];

    if (value.substr(0, 2) === '--') {
      switch_name = value.substr(2).toLowerCase();

      if (value.indexOf('=') === -1) {
        // Switch
        if (!misc.in_array(switch_name, switches)) {
          throw new Error(sprintf('Unrecognized switch %s for command %s', value, command));
        }

        arguments_dictionary[switch_name] = true;
        argv.splice(argv.indexOf(value), 1);
      }
      else {
        // Argument passed in the key=value format
        argument_name = switch_name.substr(0, switch_name.indexOf('=')).toLowerCase();
        argument_value = value.substr(value.indexOf('=') + 1);

        if (!misc.in_array(argument_name, all_arguments)) {
          throw new Error(sprintf('Invalid argument %s for command %s', argument_name, command));
        }

        arguments_dictionary[argument_name] = argument_value;
        argv.splice(argv.indexOf(value), 1);
        using_key_value_format = true;
      }
    }
  }

  // User is trying to mix arguments passed in the --key=value format and the positional arguments
  if (using_key_value_format && argv.length !== 0) {
    throw new Error('Mixing positional and arguments passed in the key=value format is not allowed');
  }

  if (!using_key_value_format) {
    if (config.required_arguments.length > 0) {
      for (i = 0; i < config.required_arguments.length; i++) {
        argument_name = config.required_arguments[i][0].toLowerCase();
        arguments_dictionary[argument_name] = argv.shift();
      }
    }

    for (i = 0; i < config.optional_arguments.length; i++) {
      argument_name = config.optional_arguments[i][0].toLowerCase();

      arguments_dictionary[argument_name] = argv.shift();
    }
  }

  // Filter out the 'undefined' values
  for (var key in arguments_dictionary) {
    if (arguments_dictionary[key] === undefined) {
      delete arguments_dictionary[key];
    }
  }

  // Make sure that all the required arguments are provided
  var missing_required_arguments = misc.array_difference(required_arguments, Object.getOwnPropertyNames(arguments_dictionary));
  if (missing_required_arguments.length) {
    throw new Error(sprintf('Missing required arguments: %s', missing_required_arguments.join(', ')));
  }

  return handler.call(null, arguments_dictionary);
};

CommandParser.prototype.show_help = function() {
  var self = this;
  var config, sub_commands;

  this.puts(this.banner);
  this.puts('Available commands:\n');
  this.puts(misc.rpad('help', 45) + 'Print this help');
  this.puts(misc.rpad('help COMMAND [SUB-COMMAND]', 45) + 'Print the help for the specified command');

  this._global_commands.forEach(function(command) {
    config = self._commands_modules[command].config;

    self.puts(misc.rpad(command, 45) + config.short_description);
  });

  for (var command in this._normal_commands) {
    if (this._normal_commands.hasOwnProperty(command)) {
      sub_commands = sprintf('%s', self._normal_commands[command].join(' | '));
      self.puts(misc.rpad(command, 45) + sub_commands);
    }
  }
};

CommandParser.prototype.show_global_command_help = function(command) {
  this.show_command_help(command, null);
};

CommandParser.prototype.show_normal_command_help = function(command, sub_command) {
  if (!sub_command) {
    this.show_command_sub_commands(command);
  }
  else {
    this.show_command_help(command, sub_command);
  }
};

CommandParser.prototype.show_command_sub_commands = function(command) {
  var self = this;
  var config, arguments_string, descriptions;

  this.puts(sprintf('Available sub-commands for command %s:\n', command));

  this._normal_commands[command].forEach(function(sub_command) {
    config = self.get_module_for_command(command, sub_command).config;
    arguments_string = self.get_command_arguments_string(command, sub_command);

    self.puts(sprintf('%s %s', misc.rpad(sub_command + ' ' + arguments_string, 45), config.short_description));
  });
};

CommandParser.prototype.show_command_help = function(command, sub_command) {
  var self = this;
  var command_string;
  var config = this.get_module_for_command(command, sub_command).config;

 command_string = this.get_command_string(command, sub_command);

  this.puts(sprintf('Help for %s\n', command_string));

  this.puts(sprintf('Usage: %s', this.get_command_usage_string(command, sub_command)));
  this.puts(sprintf('Description: %s\n', config.long_description));

  this.puts('Required arguments:');
   config.required_arguments.forEach(function(arg) {
      self.puts(sprintf('  %s - %s', arg[0].toUpperCase(), arg[1]));
  });

  this.puts('\nOptional arguments:');
  config.optional_arguments.forEach(function(arg) {
      self.puts(sprintf('  %s - %s', arg[0].toUpperCase(), arg[1]));
  });

  this.puts('\nOptions:');
  config.switches.forEach(function(switch_name) {
      self.puts(sprintf('  --%s - %s', switch_name[0].toLowerCase(), switch_name[1]));
  });
};

CommandParser.prototype.get_command_string = function(command, sub_command) {
   if (sub_command) {
    command_string = sprintf('%s %s', command, sub_command);
  }
  else {
    command_string = sprintf('%s', command);
  }

  return command_string;
};

CommandParser.prototype.get_command_usage_string = function(command, sub_command) {
  var arguments_string, usage_string;

  arguments_string = this.get_command_arguments_string(command, sub_command);
  usage_string = sprintf('%s %s %s', this.binary, this.get_command_string(command, sub_command), arguments_string);

  return usage_string;
};

CommandParser.prototype.get_command_arguments_string = function(command, sub_command) {
  var arguments_string, config;
  var arguments_list = [];

  config = this.get_module_for_command(command, sub_command).config;

  arguments_list = config.required_arguments.map(function(arg) { return sprintf('%s', arg[0].toUpperCase()); });
  arguments_list = arguments_list.concat(config.optional_arguments.map(function(arg) { return sprintf('[%s]', arg[0].toUpperCase()); }));
  arguments_list = arguments_list.join(' ');

  return arguments_list;
};

CommandParser.prototype.get_module_for_command = function(command, sub_command) {
  var command_name;

  if (sub_command) {
    command_name = sprintf('%s/%s', command, sub_command);
  }
  else {
    command_name = command;
  }

  return this._commands_modules[command_name];
};

exports.CommandParser = CommandParser;
