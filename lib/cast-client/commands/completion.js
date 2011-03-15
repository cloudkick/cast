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
  shortDescription: 'Bash completion',
  longDescription: 'Bash completion',
  requiredArguments: [],
  optionalArguments: [],
  options: []
};

/*
 * Get a list of all the available commands.
 *
 * @param {CommandParser} commandParser CommandParser instance.
 * @return {Array} Array where the first member is an array with the global
 *                 commands and the second one is an array with normal commands.
 */
var getCommands = function(commandParser) {
  var command, completionIndex;
  var globalCommands, normalCommands;

  globalCommands = commandParser.getGlobalCommands();

  completionIndex = globalCommands.indexOf('completion');

  if (completionIndex !== -1) {
    globalCommands.splice(completionIndex, 1);
  }

  normalCommands = Object.keys(commandParser.getNormalCommands());
  return [globalCommands, normalCommands];
};

/*
 * Return available options for a given command.
 *
 * @param {String} command Command name.
 * @param {String} subCommand Sub command name (optional).
 * @param {CommandParser} commandParser CommandParser instance.
 *
 * @return {Object} Object with the following keys: requiredArguments, optional
 *                  arguments, options
 */
var getCommandOptions = function(command, subCommand, commandParser) {
  var commandsPath, modulePath, commandModule;

  commandsPath = commandParser._commandsPath;

  if (!subCommand) {
    commandModule = path.join(commandsPath, command);
  }
  else {
    commandModule = path.join(commandsPath, command, subCommand);
  }

  commandModule = require(commandModule);

  return {
    requiredArguments: commandModule.config.requiredArguments,
    optionalArguments: commandModule.config.optionalArguments,
    options: commandModule.config.options
  };
};

/*
 * Output the completion string to standard output.
 *
 * @param {Array/String} value Completion value.
 */
var outputCompletion = function(value) {
  var toOutput;

  if (!value || (value instanceof Array) && value.length === 0) {
    return;
  }

  if (value instanceof Array) {
    toOutput = value.join(' ');
  }
  else {
    toOutput = value;
  }

  sys.puts(toOutput);
};

/*
 * Remove all the option values from the input array.
 *
 * @param {Array} inputArray Program arguments excluding the script name.
 */
var filterInput = function(inputArray) {
  inputArray = inputArray.map(function(input) {
    if (input.indexOf('=') !== -1) {
      return input.substr(0, input.indexOf('='));
    }

    return input;
  });

  return inputArray;
};

/*
 * Remove options which are already used or not applicable to the current input.
 *
 * @param {Array} input Array of input arguments (anything after the command
 *                      and sub command name)
 * @param {String} currentInput User input which is being completed
 * @param {Object} options Option object.
 */
var filterCompletionOptions = function(input, currentInput, options) {
  var i, optionNames, optionsLen, optionName, optionNameAlt, aliasName, optionOptions;
  var availableOptions = [];

  optionNames = Object.keys(options);
  optionsLen = optionNames.length;

  for (i = 0; i < optionsLen; i++) {
    optionName = optionNames[i];
    optionOptions = options[optionName];
    aliasName = optionOptions.alias;

    if (optionOptions.action === 'store' || optionOptions.action === 'append') {
      optionNameAlt = optionName + '=';
    }
    else {
      optionNameAlt = null;
    }

    if ((misc.inArray(optionName, input) || misc.inArray(aliasName, input)) &&
        (optionOptions.action !== 'append')) {
      // Note: Commands with action 'append' can be used multiple times
      continue;
    }

    if (optionName.indexOf(currentInput) !== 0) {
      // No match.
      continue;
    }

    if (optionNameAlt) {
      optionName = optionNameAlt;
    }

    availableOptions.push(optionName);
  }

  return availableOptions;
};


/*
 * Return an object with available options for a given command.
 *
 * @param {Object} options Options object with the following keys: requiredArguments,
 *                         optionalArguments, options
 * @return {Object} Object where the key is the option name (e.g. '--app', '-a')
 *                  and the value is option with the following keys: names, action
 */
var formatCommandOptions = function(options) {
  var i, j, optionsLen, option, optionObject, names, namesLen, name, alias;
  var optionsObject = {};


  options = options.options;

  if (!options) {
    return optionsObject;
  }

  optionsLen = options.length;
  for (i = 0; i < optionsLen; i++) {
    option = options[i];
    names = option.names;

    namesLen = names.length;
    for (j = 0; j < namesLen; j++) {
      // Storing separate object for a command and command alias takes extra space,
      // but the overhead is neglecatable
      name = names[j];

      if (namesLen === 2) {
        alias = (names.indexOf(name) === 0) ? names[1] : names[0];
      }
      else {
        alias = null;
      }

      optionObject = { 'action': option.action, 'alias': alias };
      optionsObject[name] = optionObject;
    }
  }

  return optionsObject;
};

/*
 * Complete the options for a given input.
 *
 * @param {Array} input Array of input arguments (anything after the command
 *                      and sub-command name)
 * @param {Object} options Option object with the following keys: requiredArguments,
 *                         optionalArguments, options
 */
var completeOptions = function(input, options) {
  var option, currentInput, optionsArray, availableOptions;
  var inputFiltered, inputLen = input.length;

  if (inputLen === 0) {
    return;
  }

  inputFiltered = filterInput(input);

  // User input which is being completed (a.k.a. the last argument)
  currentInput = input[input.length - 1];

  if (currentInput.indexOf('-') !== 0) {
    // Nothing to complete
    return;
  }

  // @TODO: option-aware completion
  optionsArray = formatCommandOptions(options);
  availableOptions = filterCompletionOptions(inputFiltered, currentInput, optionsArray);
  outputCompletion(availableOptions);
};

/*
 * Remove commads which do not match the current input string.
 *
 * @param {String} currentInput Current input string.
 * @param {Array} commands Array containing the available commands.
 */
var filterCompletionCommands = function(currentInput, commands) {
  var i, commandsLen;
  var availableCommands = [];

  availableCommands = commands.filter(function(command) {
    if ((command.indexOf(currentInput) !== 0) || command === currentInput) {
      return false;
    }

    return true;
  });

  return availableCommands;
};

/*
 * Complete the command.
 *
 * @param {Array} argv Program arguments excluding the script name.
 * @param {CommandParser} commandParser Command parser instance.
 */
var complete = function(argv, commandParser) {
  var commands, globalCommands, normalCommands, allCommands, subCommands;
  var inGlobal, inNormal, command, subCommand;
  var currentInput, options, completion;

  commands = getCommands(commandParser);
  globalCommands = commands[0];
  normalCommands = commands[1];
  allCommands = globalCommands.concat(normalCommands);

  if (argv.length === 0 || (argv.length === 1 && argv[0] === '')) {
    // Output all the commands
    outputCompletion(allCommands);
    return;
  }

  if (argv.length === 1) {
    // Complete the command name
    completion = filterCompletionCommands(argv[0], allCommands);

    if (completion.length > 0) {
      outputCompletion(completion);
      return;
    }
  }

  if (argv.length >= 1) {
    // Complete command
    command = argv[0];
    inGlobal = misc.inArray(command, globalCommands);
    inNormal = misc.inArray(command, normalCommands);

    if (!inGlobal && !inNormal) {
      return;
    }

    if (inGlobal) {
      options = getCommandOptions(command, null, commandParser);
      completeOptions(argv.slice(1), options, commandParser);
      return;
    }

    if (inNormal) {
      // Complete sub-command names and options
      subCommand = argv[1];
      subCommands = commandParser._normalCommands[command];

      if (argv.length <= 2) {
        completion = filterCompletionCommands(argv[argv.length - 1], subCommands);

        if (completion.length > 0) {
          outputCompletion(completion);
          return;
        }
      }

      if (!misc.inArray(subCommand, subCommands)) {
        return;
      }

      options = getCommandOptions(command, subCommand, commandParser);
      completeOptions(argv.slice(2), options, commandParser);
      return;
    }
  }
};

function handleCommand(args, commandParser) {
  var argv = process.argv;

  if (argv.length > 0 && argv[0].indexOf('cast') !== -1) {
    argv.splice(0, 1);
  }

  complete(argv, commandParser);
}

exports.config = config;
exports.handleCommand = handleCommand;
