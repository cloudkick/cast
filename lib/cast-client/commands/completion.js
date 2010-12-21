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

var sprintf = require('extern/sprintf');

var misc = require('util/misc');

var config = {
  'short_description': 'Bash completion',
  'long_description': 'Bash completion',
  'required_arguments' : [],
  'optional_arguments': [],
  'options': []
};

/*
 * Get a list of all the available commands.
 *
 * @param {CommandParser} command_parser CommandParser instance.
 * @return {Array} Array where the first member is an array with the global
 *                 commands and the second one is an array with normal commands.
 */
var get_commands = function(command_parser) {
  var command, completion_index;
  var global_commands, normal_commands;

  global_commands = command_parser._global_commands;

  completion_index = global_commands.indexOf('completion');

  if (completion_index !== -1) {
    global_commands.splice(completion_index, 1);
  }

  normal_commands = Object.keys(command_parser._normal_commands);

  return [ global_commands, normal_commands ];
};

/*
 * Return available options for a given command.
 *
 * @param {String} command Command name.
 * @param {String} sub_command Sub command name (optional).
 * @param {CommandParser} command_parser CommandParser instance.
 *
 * @return {Object} Object with the following keys: required_arguments, optional
 *                  arguments, options
 */
var get_command_options = function(command, sub_command, command_parser) {
  var commands_path, module_path, command_module;
  var required_arguments, optional_arguments;

  commands_path = command_parser._commands_path;

  if (!sub_command) {
    command_module = path.join(commands_path, command);
  }
  else {
    command_module = path.join(commands_path, command, sub_command);
  }

  command_module = require(command_module);

  return { 'required_arguments': command_module.config.required_arguments,
           'optional_arguments': command_module.config.optional_arguments,
           'options': command_module.config.options };
};

/*
 * Output the completion string to standard output.
 *
 * @param {Array/String} value Completion value.
 */
var output_completion = function(value) {
  var to_output;

  if (!value || (value instanceof Array) && value.length === 0) {
    return;
  }

  if (value instanceof Array) {
    to_output = value.join(' ');
  }
  else {
    to_output = value;
  }

  sys.puts(to_output);
};

/*
 * Remove all the option values from the input array.
 *
 * @param {Array} input_array Program arguments excluding the script name.
 */
var filter_input = function(input_array) {
  input_array = input_array.map(function(input) {
    if (input.indexOf('=') !== -1) {
      return input.substr(0, input.indexOf('='));
    }

    return input;
  });

  return input_array;
};

/*
 * Remove options which are already used or not applicable to the current input.
 *
 * @param {Array} input Array of input arguments (anything after the command
 *                      and sub command name)
 * @param {String} current_input User input which is being completed
 * @param {Object} options Option object.
 */
var filter_completion_options = function(input, current_input, options) {
  var i, option_names, options_len, option_name, option_name_alt, alias_name, option_options;
  var available_options = [];

  option_names = Object.keys(options);
  options_len = option_names.length;

  for (i = 0; i < options_len; i++) {
    option_name = option_names[i];
    option_options = options[option_name];
    alias_name = option_options.alias;

    if (option_options.action === 'store' || option_options.action === 'append') {
      option_name_alt = option_name + '=';
    }
    else {
      option_name_alt = null;
    }

    if ((misc.in_array(option_name, input) || misc.in_array(alias_name, input)) &&
        (option_options.action !== 'append')) {
      // Note: Commands with action 'append' can be used multiple times
      continue;
    }

    if (option_name.indexOf(current_input) !== 0) {
      // No match.
      continue;
    }

    if (option_name_alt) {
      option_name = option_name_alt;
    }

    available_options.push(option_name);
  }

  return available_options;
};


/*
 * Return an object with available options for a given command.
 *
 * @param {Object} options Options object with the following keys: required_arguments,
 *                         optional_arguments, options
 * @return {Object} Object where the key is the option name (e.g. '--app', '-a')
 *                  and the value is option with the following keys: names, action
 */
var format_command_options = function(options) {
  var i, j, options_len, option, option_object, names, names_len, name, alias;
  var options_object = {};


  options = options.options;

  if (!options) {
    return options_object;
  }

  options_len = options.length;
  for (i = 0; i < options_len; i++) {
    option = options[i];
    names = option.names;

    names_len = names.length;
    for (j = 0; j < names_len; j++) {
      // Storing separate object for a command and command alias takes extra space,
      // but the overhead is neglecatable
      name = names[j];

      if (names_len === 2) {
        alias = (names.indexOf(name) === 0) ? names[1] : names[0];
      }
      else {
        alias = null;
      }

      option_object = { 'action': option.action, 'alias': alias };
      options_object[name] = option_object;
    }
  }

  return options_object;
};

/*
 * Complete the options for a given input.
 *
 * @param {Array} input Array of input arguments (anything after the command
 *                      and sub-command name)
 * @param {Object} options Option object with the following keys: required_arguments,
 *                         optional_arguments, options
 */
var complete_options = function(input, options) {
  var option, current_input, options_array, available_options;
  var input_filtered, input_len = input.length;

  if (input_len === 0) {
    return;
  }

  input_filtered = filter_input(input);

  // User input which is being completed (a.k.a. the last argument)
  current_input = input[input.length - 1];

  if (current_input.indexOf('-') !== 0) {
    // Nothing to complete
    return;
  }

  // @TODO: option-aware completion
  options_array = format_command_options(options);
  available_options = filter_completion_options(input_filtered, current_input, options_array);
  output_completion(available_options);
};

/*
 * Remove commads which do not match the current input string.
 *
 * @param {String} current_input Current input string.
 * @param {Array} commands Array containing the available commands.
 */
var filter_completion_commands = function(current_input, commands) {
  var i, commands_len;
  var available_commands = [];

  available_commands = commands.filter(function(command) {
    if ((command.indexOf(current_input) !== 0) || command === current_input) {
      return false;
    }

    return true;
  });

  return available_commands;
};

/*
 * Complete the command.
 *
 * @param {Array} argv Program arguments excluding the script name.
 * @param {CommandParser} command_parser Command parser instance.
 */
var complete = function(argv, command_parser) {
  var commands, global_commands, normal_commands, all_commands, sub_commands;
  var in_global, in_normal, command, sub_command;
  var current_input, options, completion;

  commands = get_commands(command_parser);
  global_commands = commands[0];
  normal_commands = commands[1];
  all_commands = global_commands.concat(normal_commands);

  if (argv.length === 0 || (argv.length === 1 && argv[0] === '')) {
    // Output all the commands
    output_completion(all_commands);
    return;
  }

  if (argv.length === 1) {
    // Complete the command name
    completion = filter_completion_commands(argv[0], all_commands);

    if (completion.length > 0) {
      output_completion(completion);
      return;
    }
  }

  if (argv.length >= 1) {
    // Complete command
    command = argv[0];
    in_global = misc.in_array(command, global_commands);
    in_normal = misc.in_array(command, normal_commands);

    if (!in_global && !in_normal) {
      return;
    }

    if (in_global) {
      options = get_command_options(command, null, command_parser);
      complete_options(argv.slice(1), options, command_parser);
      return;
    }

    if (in_normal) {
      // Complete sub-command names and options
      sub_command = argv[1];
      sub_commands = command_parser._normal_commands[command];

      if (argv.length <= 2) {
        completion = filter_completion_commands(argv[argv.length - 1], sub_commands);

        if (completion.length > 0) {
          output_completion(completion);
          return;
        }
      }

      if (!misc.in_array(sub_command, sub_commands)) {
        return;
      }

      options = get_command_options(command, sub_command, command_parser);
      complete_options(argv.slice(2), options, command_parser);
      return;
    }
  }
};

function handle_command(args, command_parser) {
  var argv = process.argv;

  if (argv.length > 0 && argv[0].indexOf('cast') !== -1) {
    argv.splice(0, 1);
  }

  complete(argv, command_parser);
}

exports.config = config;
exports.handle_command = handle_command;
