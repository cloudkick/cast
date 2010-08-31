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

var GLOBAL_COMMANDS = ['version'];
var NORMAL_COMMANDS = {
};

var BANNER = 'Usage: cast command [sub-command]';
var COMMANDS_PATH = path.join('../cast-client/commands/');

/**
 * CommandParser class.
 *
 * @param {String} commands_path Path to the directory containing command modules and directories
 * @param {Array} global_commands Array of valid global commands (corresponding modules must be placed in the
 *                                                                commands_path/global/ directory)
 * @param {Object} normal_commands property name - command name, property value - Array of sub-command names
 *                                 (corresponding modules must be placed in the commands_path/command/ directory)
 * 
 * @constructor
 */
function CommandParser(commands_path, global_commands, normal_commands) {
  this.commands_path = commands_path || COMMANDS_PATH;
  
  this.global_commands = global_commands || GLOBAL_COMMANDS;
  this.normal_commands = normal_commands || NORMAL_COMMANDS;
  
  this.banner = BANNER;
  
  this._path_global = path.join(this.commands_path, 'global');
  this._path_commands = this.commands_path;
}

CommandParser.prototype.parse = function(argv) {
  var binary = argv.shift();
  var file = argv.shift();
  var command = argv.shift();
  
  var sub_command, config, handler, argument_name, i;
  var arguments_dictionary = {};
  
  if (!command || command === 'help') {
    if (argv.length == 1 && (this.normal_commands.hasOwnProperty(argv[0]))) {
      // Command help
      this.show_command_help(argv[0]);
      
      return;
    }
    else if (argv.length == 2 && (this.normal_commands.hasOwnProperty(argv[0])) && 
             misc.in_array(argv[1], this.normal_commands[argv[0]])) {
      // Sub-command help
      this.show_sub_command_help(argv[0], argv[1]);
      
      return;
    }
    
    // Global help
    this.show_global_help();
    
    return;
  }
  else if (!(misc.in_array(command, this.global_commands)) && !(this.normal_commands.hasOwnProperty(command))) {
    throw new Error('Invalid command. For a list of valid commands, run the help command');
  }
  
  if (misc.in_array(command, this.global_commands)) {
    config = require(path.join(this._path_global, command)).config;
    handler = require(path.join(this._path_global, command)).handle_command;
  }
  else {
    if (argv.length > 0) {
      // Sub-command
      sub_command = argv.shift();
      
      if (!misc.in_array(sub_command, this.normal_commands[command])) {
        throw new Error(sprintf('Invalid sub-command: %s', sub_command));
      }
      
      config = require(path.join(this._path_commands, command, sub_command)).config;
      handler = require(path.join(this._path_commands, command, sub_command)).handle_command;
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
  
  this.global_commands.forEach(function(command) {
    config = require(path.join(self._path_global, command)).config;
    
    sys.puts(misc.rpad(command, 40) + config.short_description);
  });
  
  for (var command in this.normal_commands) {
    sub_commands = sprintf('%s', this.normal_commands[command].join(' | '));
    sys.puts(misc.rpad(command, 40) + sub_commands);
  };
};

CommandParser.prototype.show_command_help = function(command) {
  var self = this;
  var config, descriptions, line;
  
  sys.puts(sprintf('Available sub-commands for command %s:\n', command));

  this.normal_commands[command].forEach(function(sub_command) {
    config = require(path.join(self._path_commands, command, sub_command)).config;
    
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
  
  config = require(path.join(self._path_commands, command, sub_command)).config;
  
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

CommandParser.prototype._format_command_arguments_for_display = function(required_arguments, optional_arguments) {
  config.required_arguments.forEach(function(arg) {
      arguments_list.push(sprintf('[%s]', arg[0].toUpperCase()));
      arguments_help.push(sprintf('%s - %s', arg[0].toUpperCase(), arg[1]));
    });
    
    config.optional_arguments.forEach(function(arg) {
      arguments_list.push(arg[0].toUpperCase());
      arguments_help.push(sprintf('%s - %s', arg[0].toUpperCase(), arg[1]));
    });
};

exports.CommandParser = CommandParser;
