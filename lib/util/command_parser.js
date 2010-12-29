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
var term = require('util/terminal');
var Errorf = require('util/misc').Errorf;

/*
 * Special commands which are added upon initialization and don't have any required
 * or optional arguments.
 * This commands can take variable number of arguments so argument length check is
 * is skipped.
 */
var SPECIAL_COMMANDS = [ 'completion' ];

/*
 * Options which display help.
 */
var HELP_OPTIONS = [ '--help', '-h' ];

/**
 * CommandParser class.
 *
 * @param {String} commands_path Path to the directory containing command modules and directories.
 *
 * @constructor
 */
function CommandParser(commands_path, output_func) {
  this.binary = '';
  this.banner = '';

  this.puts = output_func;

  if (output_func === undefined) {
    this.puts = term.puts;
  }

  this._commands_path = commands_path;
  this._commands_modules = {};

  this._global_commands = []; // Holds an array of the available global commands
  this._normal_commands = {}; // Holds and object where a property is a command name and a value is an array of
                              // the available sub-commands
  this._global_options = {};

  this.add_commands(SPECIAL_COMMANDS);
}

/**
 * Return an array with the global commands.
 *
 * @return {Array} Array where a member is global command name.
 */ 
CommandParser.prototype.get_global_commands = function() {
  return this._global_commands;
};

/**
 * Return an object with the normal commands.
 *
 * @return {Object} Object where a key is the command name and the value
 *                  is an array of sub-command names.
 *                  For example: {'bundles': [ 'create', 'delete' ]}
 */ 
CommandParser.prototype.get_normal_commands = function() {
  return this._normal_commands;
};

/**
 * Return an object with the global command options.
 *
 * @return {Object} Object where the key is an option name and the value
 *                  is an object with the option settings.
 */ 
CommandParser.prototype.get_global_options = function() {
  return this._global_options;
};

/**
 * Add a command to the command parser.
 *
 * Global commands modules must be located inside a root of the <commands_path> directory and modules for the sub-commands
 * must be located inside a <commands_path>/<command name> directory.
 *
 * @param {String} command_name Command name.
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
 * @param {Array} commands Array of the command names.
 *
 */
CommandParser.prototype.add_commands = function(commands) {
  var i;
  if (!commands) {
    throw new Error('Missing commands argument');
  }
  else if (!(commands instanceof Array)) {
    throw new Error('commands argument must be an array');
  }

  for (i = 0; i < commands.length; i++) {
    this.add_command(commands[i]);
  }
};

/**
 * Add a global option.
 * 
 * Global options are available and get passed to all the commands and
 * sub_commands
 *
 * @param {Object} option_object Option object with the following keys: names,
 *                               dest, title, action, desc 
 */
CommandParser.prototype.add_global_option = function(option_object) {
  var option_name = option_object.names[0];
  var global_options = Object.keys(this._global_options);

  if (misc.in_array(option_name, global_options)) {
    throw new Errorf('Option %s already exists', option_name);
  }

  this._global_options[option_name] = option_object;
};

/**
 * Add multiple global options.
 *
 * @param {Array} option_objects Array of the option objects
 */
CommandParser.prototype.add_global_options = function(option_objects) {
  var i;
  if (!option_objects) {
    throw new Error('Missing option_objects argument');
  }
  else if (!(option_objects instanceof Array)) {
    throw new Error('option_object argument must be an array');
  }

  for (i = 0; i < option_objects.length; i++) {
    this.add_global_option(option_objects[i]);
  }
};

/**
 * Remove a command from the command parser.
 *
 * @param {String} command_name Command name.
 *
 */
CommandParser.prototype.remove_command = function(command_name) {
  var index, command, sub_command;

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
 * @param {Array} commands Array of the command names.
 *
 */
CommandParser.prototype.remove_commands = function(commands) {
  var i;
  if (!commands) {
    throw new Error('Missing commands argument');
  }
  else if (!(commands instanceof Array)) {
    throw new Error('Commands argument must be an array');
  }

  for (i = 0; i < commands.length; i++) {
    this.remove_command(commands[i]);
  }
};

CommandParser.prototype.parse = function(argv) {
  var binary = argv.shift();
  var file = argv.shift();
  var command = argv.shift();

  var sub_command, valid_sub_commands, module, config, handler, argument_name;
  var arguments_dictionary = {};

  if (!command || (command === 'help' || misc.in_array(command, HELP_OPTIONS))) {
    if (argv.length === 1) {
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
    else if (argv.length === 2 && (this._normal_commands.hasOwnProperty(argv[0])) &&
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
      valid_sub_commands = this._normal_commands[command].concat(HELP_OPTIONS);

      if (!(misc.in_array(sub_command, valid_sub_commands))) {
        throw new Error(sprintf('Invalid sub-command: %s', sub_command));
      }

      if (!misc.in_array(sub_command, HELP_OPTIONS)) {
        module = this._commands_modules[sprintf('%s/%s', command, sub_command)];

        config = module.config;
        handler = module.handle_command;
      }
    }
    else {
      // No sub-command specified, show all the available sub-commands
      this.show_command_sub_commands(command);

      return;
    }
  }

  var required_arguments, optional_arguments, all_arguments;
  var options, strings_options, key, value, option, dest;
  var i, j;
  var idx, splice, offset;
  var arguments_count = argv.length;
  var arguments_original = argv.slice(0);

  if ((arguments_count > 0) && (misc.in_array(arguments_original[0], HELP_OPTIONS)) ||
      misc.in_array(sub_command, HELP_OPTIONS)) {
    // Display help when --help or -h sub-command or option is used
    if (command && sub_command) {
      if (!misc.in_array(sub_command, HELP_OPTIONS)) {
        this.show_normal_command_help(command, sub_command);
      }
      else {
        this.show_command_sub_commands(command);
      }
    }
    else if (command) {
      this.show_global_command_help(command);
    }

    return;
  }

  required_arguments = config.required_arguments.map(function(item) { return item[0]; });
  optional_arguments = config.optional_arguments.map(function(item) { return item[0]; });

  all_arguments = required_arguments.concat(optional_arguments);

  strings_options = {};

  // Map option names -> options
  if (config.options) {
    for (i = 0; i < config.options.length; i++) {
      for (j = 0; j < config.options[i].names.length; j++) {
        key = config.options[i].names[j];
        strings_options[key] = config.options[i];
      }
    }
  }

  // Add global options to the string_options array
  if (Object.keys(this._global_options).length > 0) {
    for (key in this._global_options) {
      if (this._global_options.hasOwnProperty(key)) {
        option = this._global_options[key];
        strings_options[key] = option;
      }
    }
  }

  // Track the offset between argv and arguments_original
  offset = 0;

  // Parse and remove options from argv
  for (i = 0; i < arguments_count; i++) {
    key = arguments_original[i];
    idx = key.indexOf('=');
    splice = 1;

    if (idx !== -1) {
      value = key.slice(idx + 1);
      key = key.slice(0, idx);
    }
    else {
      value = null;
    }

    if (strings_options.hasOwnProperty(key)) {
      switch(strings_options[key].action) {
        case 'store':
          dest = strings_options[key].dest;
          // Use the next argument as the value if not in key=value form
          if (value === null) {
            value = arguments_original[i + 1];
            splice++;
            if (!value) {
              throw new Error("'" + key + "' requires an argument");
            }
          }
          arguments_dictionary[dest] = value;
          break;

        case 'append':
          // Use the next argument as the value if not in key=value form
          dest = strings_options[key].dest;
          if (value === null) {
            value = arguments_original[i + 1];
            splice++;
            if (!value) {
              throw new Error("'" + key + "' requires an argument");
            }
          }
          if (!arguments_dictionary.hasOwnProperty(dest)) {
            arguments_dictionary[dest] = [];
          }

          arguments_dictionary[dest].push(value);
          break;

        case 'store_true':
          dest = strings_options[key].dest;
          if (value !== null) {
            throw new Error("'" + key + "' does not take an argument");
          }
          arguments_dictionary[dest] = true;
          break;

        case 'store_false':
          dest = strings_options[key].dest;
          if (value !== null) {
            throw new Error("'" + key + "' does not take an argument");
          }
          arguments_dictionary[dest] = false;
          break;

        default:
          throw new Error("Unrecognized action for '" + key + "'");
      }

      // Remove the option and any of its arguments from argv
      argv.splice(i + offset, splice);
      offset -= splice;
      i += (splice - 1);
    }
  }

  for (i = 0; i < config.required_arguments.length; i++) {
    argument_name = config.required_arguments[i][0].toLowerCase();
    arguments_dictionary[argument_name] = argv.shift();
  }

  for (i = 0; i < config.optional_arguments.length; i++) {
    argument_name = config.optional_arguments[i][0].toLowerCase();
    arguments_dictionary[argument_name] = argv.shift();
  }

  if (!misc.in_array(command, SPECIAL_COMMANDS) && argv.length !== 0) {
    throw new Error('Too many arguments');
  }

  // Filter out the 'undefined' values
  for (key in arguments_dictionary) {
    if (arguments_dictionary[key] === undefined) {
      delete arguments_dictionary[key];
    }
  }

  // Make sure that all the required arguments are provided
  var missing_required_arguments = misc.array_difference(required_arguments,
                                      Object.getOwnPropertyNames(arguments_dictionary));
  if (missing_required_arguments.length) {
    throw new Error(sprintf('Missing required arguments: %s', missing_required_arguments.join(', ')));
  }

  return handler.call(null, arguments_dictionary, this);
};

CommandParser.prototype.show_help = function() {
  var self = this;
  var config, sub_commands;

  this.puts(this.banner);
  this.puts('');
  this.puts('Available commands:\n');
  this.puts('  ' + term.rpad('[bold]help[/bold]', 45) + 'Print this help');

  this._global_commands.forEach(function(command) {
    if (!misc.in_array(command, SPECIAL_COMMANDS)) {
      config = self._commands_modules[command].config;

      self.puts('  ' + term.rpad(sprintf('[bold]%s[/bold]', command), 45) + config.short_description);
    }
  });

  for (var command in this._normal_commands) {
    if (this._normal_commands.hasOwnProperty(command)) {
      sub_commands = sprintf('%s', self._normal_commands[command].join(' | '));
      self.puts('  ' + term.rpad(sprintf('[bold]%s[/bold]', command), 45) + sub_commands);
    }
  }

  this.puts("\nSee '" + this.binary + " help [bold]COMMAND[/bold]' for help on a specific command");
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

    self.puts(sprintf('  %s %s', term.rpad(sprintf('[bold]%s[/bold] %s', sub_command, arguments_string), 45),
                      config.short_description));
  });

  self.puts(sprintf("\nUse '%s help %s [bold]SUB-COMMAND[/bold]' to see help for a specific sub-command",
                    this.binary, command));
};

CommandParser.prototype.show_command_help = function(command, sub_command) {
  var self = this;
  var config = this.get_module_for_command(command, sub_command).config;

  this.puts('[bold]USAGE[/bold]');
  term.print_wrapped(this.get_command_usage_string(command, sub_command), null, null, this.puts);
  this.puts('');

  this.puts('[bold]DESCRIPTION[/bold]');
  term.print_wrapped(config.long_description);
  this.puts('');

  if (config.required_arguments.length > 0) {
    this.puts('[bold]REQUIRED ARGUMENTS[/bold]');
    config.required_arguments.forEach(function(arg) {
        self.puts(sprintf('  %s - %s', arg[0].toUpperCase(), arg[1]));
    });
    this.puts('');
  }

  if (config.optional_arguments.length > 0) {
    this.puts('[bold]OPTIONAL ARGUMENTS[/bold]');
    config.optional_arguments.forEach(function(arg) {
        self.puts(sprintf('  %s - %s', arg[0].toUpperCase(), arg[1]));
    });
    this.puts('');
  }

  if (config.options && config.options.length > 0) {
    this.puts('[bold]OPTIONS[/bold]');
    config.options.forEach(function(option) {
      var title = option.title || option.dest;
      // Print out the option format string, for example "--foo <bar>, -f <bar>"
      if (option.action === 'store' || option.action === 'append') {
        self.puts("  "  + option.names.map(function(name) {
          return sprintf('[bold]%s[/bold] <%s>', name, title);
        }).join(", "));
      }
      // Or "--foo, -f" for boolean options
      else {
        self.puts("  " + option.names.map(function(name) {
          return sprintf('[bold]%s[/bold]', name);
        }).join(", "));
      }

      term.print_wrapped(option.desc, 80, 6);
      self.puts("");
    });
  }
};

CommandParser.prototype.get_command_string = function(command, sub_command) {
  var command_string;
  if (sub_command) {
    command_string = sprintf('%s %s', command, sub_command);
  }
  else {
    command_string = sprintf('%s', command);
  }

  return command_string;
};

CommandParser.prototype.get_command_usage_string = function(command, sub_command) {
  var arguments_string, module_string, command_module, options_string, usage_string;
  var command_options;

  arguments_string = this.get_command_arguments_string(command, sub_command);

  if (command && sub_command) {
    module_string = sprintf('%s/%s', command, sub_command);
  }
  else {
    module_string = command;
  }

  command_module = this._commands_modules[module_string];
  command_options = command_module.config.options;

  if (command_options && command_options.length > 0) {
    options_string = ' [OPTIONS] ';
  }
  else {
    options_string = ' ';
  }

  usage_string = sprintf('%s %s%s%s', this.binary, this.get_command_string(command, sub_command),
                         options_string, arguments_string);

  return usage_string;
};

CommandParser.prototype.get_command_arguments_string = function(command, sub_command) {
  var i;
  var arguments_string = '';
  var terminator = ' ';
  var config = this.get_module_for_command(command, sub_command).config;

  for (i = 0; i < config.required_arguments.length; i++) {
    arguments_string += config.required_arguments[i][0].toUpperCase() + ' ';
  }

  for (i = 0; i < config.optional_arguments.length; i++) {
    arguments_string += '[' + config.optional_arguments[i][0].toUpperCase();
    if (i < (config.optional_arguments.length - 1)) {
      arguments_string += ' ';
    }
  }

  for (; i > 0; i--) {
    arguments_string += ']';
  }

  return arguments_string;
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
