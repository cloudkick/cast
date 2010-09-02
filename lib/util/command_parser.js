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
function CommandParser(commands_path) {
  this.banner = '';

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
  
  var sub_command, module, config, handler, argument_name, i;
  var arguments_dictionary = {};
  
  if (!command || (command === 'help' || command === '--help' || command === '-h')) {
    if (argv.length == 1 && (this._normal_commands.hasOwnProperty(argv[0]))) {
      // Command help
      this.show_command_help(argv[0]);
      
      return;
    }
    else if (argv.length == 2 && (this._normal_commands.hasOwnProperty(argv[0])) && 
             misc.in_array(argv[1], this._normal_commands[argv[0]])) {
      // Sub-command help
      this.show_sub_command_help(argv[0], argv[1]);
      
      return;
    }
    
    // Global help
    this.show_global_help();
    
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
      this.show_command_help(command);
      
      return;
    }
  }
  
  if (argv.length != config.required_arguments.length && (argv.length !== config.required_arguments.length + 
      config.optional_arguments.length)) {
    throw new Error(sprintf('Invalid number of arguments for command %s', command));
  }

  if (config.required_arguments.length > 0) {
    for (i = 0; i < argv.length; i++) {
      argument_name = config.required_arguments[i][0].toLowerCase();
      arguments_dictionary[argument_name] = argv.shift();
    }
  }

  for (i = 0; i < argv.length; i++) {
    argument_name = config.optional_arguments[i][0].toLowerCase();
    
    arguments_dictionary[argument_name] = argv.shift();
  }

  return handler.call(this, arguments_dictionary);
};

CommandParser.prototype.show_global_help = function() {
  var self = this;
  var config, sub_commands;
  
  sys.puts(this.banner);
  sys.puts('Available commands:\n');
  sys.puts(misc.rpad('help', 40) + 'Print this help');
  sys.puts(misc.rpad('help COMMAND', 40) + 'Print the help for the specified command');
  
  this._global_commands.forEach(function(command) {
    config = self._commands_modules[command].config;
    
    sys.puts(misc.rpad(command, 40) + config.short_description);
  });
  
  for (var command in this._normal_commands) {
    if (this._normal_commands.hasOwnProperty(command)) {
      sub_commands = sprintf('%s', self._normal_commands[command].join(' | '));
      sys.puts(misc.rpad(command, 40) + sub_commands);
    }
  }
};

CommandParser.prototype.show_command_help = function(command) {
  var self = this;
  var command_name, config, descriptions, line;
  
  sys.puts(sprintf('Available sub-commands for command %s:\n', command));

  this._normal_commands[command].forEach(function(sub_command) {
    command_name = sprintf('%s/%s', command, sub_command);
    config = self._commands_modules[command_name].config;
    
    arguments_list = [];
    arguments_help = [];
    config.required_arguments.forEach(function(arg) {
      arguments_list.push(sprintf('[%s]', arg[0].toUpperCase()));
      arguments_help.push(sprintf('%s - %s', arg[0].toUpperCase(), arg[1]));
    });
    
    config.optional_arguments.forEach(function(arg) {
      arguments_list.push(arg[0].toUpperCase());
      arguments_help.push(sprintf('%s - %s', arg[0].toUpperCase(), arg[1]));
    });

    arguments_list = arguments_list.join(' ');
    arguments_help = arguments_help.join(', ');
    if (arguments_help) {
      line = sprintf('%s %s (%s)', misc.rpad(sub_command + ' ' + arguments_list, 40), config.short_description, arguments_help);
    }
    else {
      line = sprintf('%s %s', misc.rpad(sub_command + ' ' + arguments_list, 40), config.short_description);
    }
    
    sys.puts(line);
  });
};

CommandParser.prototype.show_sub_command_help = function(command, sub_command) {
  var self = this;
  
  config = this._commands_modules[sprintf('%s/%s', command, sub_command)].config;
  
  sys.puts(sprintf('Help for %s %s\n', command, sub_command));
  
  sys.puts(sprintf('Description: %s\n', config.long_description));
  
  sys.puts('Required arguments:');
   config.required_arguments.forEach(function(arg) {
      sys.puts(sprintf('- %s - %s', arg[0].toUpperCase(), arg[1]));
  });
    
  sys.puts('\nOptional arguments:');
  config.optional_arguments.forEach(function(arg) {
      sys.puts(sprintf('- %s - %s', arg[0].toUpperCase(), arg[1]));
  });
};

exports.CommandParser = CommandParser;
