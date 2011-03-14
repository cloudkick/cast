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
 * @param {String} commandsPath Path to the directory containing command modules and directories.
 *
 * @constructor
 */
function CommandParser(commandsPath, outputFunc) {
  this.binary = '';
  this.banner = '';

  this.puts = outputFunc;

  if (outputFunc === undefined) {
    this.puts = term.puts;
  }

  this._CommandsPath = commandsPath;
  this._CommandsModules = {};

  this._GlobalCommands = []; // Holds an array of the available global commands
  this._NormalCommands = {}; // Holds and object where a property is a command name and a value is an array of
                              // the available sub-commands
  this._GlobalOptions = {};

  this.addCommands(SPECIAL_COMMANDS);
}

/**
 * Return an array with the global commands.
 *
 * @return {Array} Array where a member is global command name.
 */ 
CommandParser.prototype.getGlobalCommands = function() {
  return this._GlobalCommands;
};

/**
 * Return an object with the normal commands.
 *
 * @return {Object} Object where a key is the command name and the value
 *                  is an array of sub-command names.
 *                  For example: {'bundles': [ 'create', 'delete' ]}
 */ 
CommandParser.prototype.getNormalCommands = function() {
  return this._NormalCommands;
};

/**
 * Return an object with the global command options.
 *
 * @return {Object} Object where the key is an option name and the value
 *                  is an object with the option settings.
 */ 
CommandParser.prototype.getGlobalOptions = function() {
  return this._GlobalOptions;
};

/**
 * Add a command to the command parser.
 *
 * Global commands modules must be located inside a root of the <commandsPath> directory and modules for the sub-commands
 * must be located inside a <commandsPath>/<command name> directory.
 *
 * @param {String} commandName Command name.
 *
 */
CommandParser.prototype.addCommand = function(commandName) {
  var modulePath, module, command, subCommand;

  if (commandName.indexOf('/') === -1) {
    // Global command
    try {
      command = commandName;
      modulePath = path.join(this._CommandsPath, commandName);
      module = require(modulePath);

      this._GlobalCommands.push(command);
    }
    catch (error) {
      throw new Error(sprintf('Module for command "%s" does not exist', command));
    }
  }
  else {
    // Normal command
    var splitted = commandName.split('/');
    command = splitted[0];
    subCommand = splitted[1];

    modulePath = path.join(this._CommandsPath, command, subCommand);
    module = require(modulePath);

    if (!this._NormalCommands.hasOwnProperty(command)) {
      this._NormalCommands[command] = [];
    }

    this._NormalCommands[command].push(subCommand);
  }

  this._CommandsModules[commandName] = module;
};

/**
 * Add multiple commands to the command parser.
 *
 * @param {Array} commands Array of the command names.
 *
 */
CommandParser.prototype.addCommands = function(commands) {
  var i;
  if (!commands) {
    throw new Error('Missing commands argument');
  }
  else if (!(commands instanceof Array)) {
    throw new Error('commands argument must be an array');
  }

  for (i = 0; i < commands.length; i++) {
    this.addCommand(commands[i]);
  }
};

/**
 * Add a global option.
 * 
 * Global options are available and get passed to all the commands and
 * subCommands
 *
 * @param {Object} optionObject Option object with the following keys: names,
 *                               dest, title, action, desc 
 */
CommandParser.prototype.addGlobalOption = function(optionName, optionObject) {
  if (this._GlobalOptions.hasOwnProperty(optionName)) {
    throw new Errorf('Option %s already exists', optionName);
  }

  this._GlobalOptions[optionName] = optionObject;
};

/**
 * Add multiple global options.
 *
 * @param {Object} optionsMap Mapping of global option names to objects
 */
CommandParser.prototype.addGlobalOptions = function(optionMap) {
  var optionName;
  for (optionName in optionMap) {
    if (optionMap.hasOwnProperty(optionName)) {
      this.addGlobalOption(optionName, optionMap[optionName]);
    }
  }
};

/**
 * Remove a command from the command parser.
 *
 * @param {String} commandName Command name.
 *
 */
CommandParser.prototype.removeCommand = function(commandName) {
  var index, command, subCommand;

  if (!this._CommandsModules.hasOwnProperty(commandName)) {
    throw new Error(sprintf('Command %s does not exist', commandName));
  }

  if (commandName.indexOf('/') === -1) {
    command = commandName;
    index = this._GlobalCommands.indexOf(command);

    this._GlobalCommands.splice(index, 1);
  }
  else {
    var splitted = commandName.split('/');
    command = splitted[0];
    subCommand = splitted[1];

    index = this._NormalCommands[command].indexOf(subCommand);
    this._NormalCommands[command].splice(index, 1);

    if (this._NormalCommands[command].length === 0) {
      delete this._NormalCommands[command];
    }
  }

  delete this._CommandsModules[commandName];
};

/**
 * Remove multiple commands from the command parser.
 *
 * @param {Array} commands Array of the command names.
 *
 */
CommandParser.prototype.removeCommands = function(commands) {
  var i;
  if (!commands) {
    throw new Error('Missing commands argument');
  }
  else if (!(commands instanceof Array)) {
    throw new Error('Commands argument must be an array');
  }

  for (i = 0; i < commands.length; i++) {
    this.removeCommand(commands[i]);
  }
};

CommandParser.prototype.mergeGlobalOptions = function(config) {
  var i, optionName;
  if (config.usesGlobalOptions) {
    if (!config.options) {
      config.options = [];
    }
    for (i = 0; i < config.usesGlobalOptions.length; i++) {
      optionName = config.usesGlobalOptions[i];
      if (!this._GlobalOptions[optionName]) {
        throw new Error("Global option '" + optionName + "' is undefined");
      }
      config.options.push(this._GlobalOptions[optionName]);
    }
  }
};

CommandParser.prototype.parse = function(argv) {
  var binary = argv.shift();
  var file = argv.shift();
  var command = argv.shift();

  var subCommand, validSubCommands, module, config, handler, argumentName;
  var argumentsDictionary = {};

  if (!command || (command === 'help' || misc.inArray(command, HELP_OPTIONS))) {
    if (argv.length === 1) {
      // Command help
      if (misc.inArray(argv[0], this._GlobalCommands)) {
        this.showGlobalCommandHelp(argv[0]);

        return;
      }
      else if (this._NormalCommands.hasOwnProperty(argv[0]))
      {
        this.showNormalCommandHelp(argv[0], null);

        return;
      }
    }
    else if (argv.length === 2 && (this._NormalCommands.hasOwnProperty(argv[0])) &&
             misc.inArray(argv[1], this._NormalCommands[argv[0]])) {
      // Sub-command help
      this.showNormalCommandHelp(argv[0], argv[1]);

      return;
    }

    // Help
    this.showHelp();

    return;
  }
  else if (!(misc.inArray(command, this._GlobalCommands)) && !(this._NormalCommands.hasOwnProperty(command))) {
    throw new Error('Invalid command. For a list of valid commands, run the help command');
  }

  if (misc.inArray(command, this._GlobalCommands)) {
    module = this._CommandsModules[command];

    config = module.config;
    handler = module.handleCommand;
  }
  else {
    if (argv.length > 0) {
      // Sub-command
      subCommand = argv.shift();
      validSubCommands = this._NormalCommands[command].concat(HELP_OPTIONS);

      if (!(misc.inArray(subCommand, validSubCommands))) {
        throw new Error(sprintf('Invalid sub-command: %s', subCommand));
      }

      if (!misc.inArray(subCommand, HELP_OPTIONS)) {
        module = this._CommandsModules[sprintf('%s/%s', command, subCommand)];

        config = module.config;
        handler = module.handleCommand;
      }
    }
    else {
      // No sub-command specified, show all the available sub-commands
      this.showCommandSubCommands(command);

      return;
    }
  }

  var requiredArguments, optionalArguments, allArguments;
  var options, stringsOptions, key, value, option, dest, optionName;
  var i, j;
  var idx, splice, offset;
  var argumentsCount = argv.length;
  var argumentsOriginal = argv.slice(0);

  if ((argumentsCount > 0) && (misc.inArray(argumentsOriginal[0], HELP_OPTIONS)) ||
      misc.inArray(subCommand, HELP_OPTIONS)) {
    // Display help when --help or -h sub-command or option is used
    if (command && subCommand) {
      if (!misc.inArray(subCommand, HELP_OPTIONS)) {
        this.showNormalCommandHelp(command, subCommand);
      }
      else {
        this.showCommandSubCommands(command);
      }
    }
    else if (command) {
      this.showGlobalCommandHelp(command);
    }

    return;
  }

  requiredArguments = config.requiredArguments.map(function(item) { return item[0]; });
  optionalArguments = config.optionalArguments.map(function(item) { return item[0]; });

  allArguments = requiredArguments.concat(optionalArguments);

  stringsOptions = {};

  this.mergeGlobalOptions(config);

  // Map option names -> options
  if (config.options) {
    for (i = 0; i < config.options.length; i++) {
      for (j = 0; j < config.options[i].names.length; j++) {
        key = config.options[i].names[j];
        stringsOptions[key] = config.options[i];
      }
    }
  }

  // Track the offset between argv and arguments_original
  offset = 0;

  // Parse and remove options from argv
  for (i = 0; i < argumentsCount; i++) {
    key = argumentsOriginal[i];
    idx = key.indexOf('=');
    splice = 1;

    if (idx !== -1) {
      value = key.slice(idx + 1);
      key = key.slice(0, idx);
    }
    else {
      value = null;
    }

    if (stringsOptions.hasOwnProperty(key)) {
      switch(stringsOptions[key].action) {
        case 'store':
          dest = stringsOptions[key].dest;
          // Use the next argument as the value if not in key=value form
          if (value === null) {
            value = argumentsOriginal[i + 1];
            splice++;
            if (!value) {
              throw new Error("'" + key + "' requires an argument");
            }
          }
          argumentsDictionary[dest] = value;
          break;

        case 'append':
          // Use the next argument as the value if not in key=value form
          dest = stringsOptions[key].dest;
          if (value === null) {
            value = argumentsOriginal[i + 1];
            splice++;
            if (!value) {
              throw new Error("'" + key + "' requires an argument");
            }
          }
          if (!argumentsDictionary.hasOwnProperty(dest)) {
            argumentsDictionary[dest] = [];
          }

          argumentsDictionary[dest].push(value);
          break;

        case 'store_true':
          dest = stringsOptions[key].dest;
          if (value !== null) {
            throw new Error("'" + key + "' does not take an argument");
          }
          argumentsDictionary[dest] = true;
          break;

        case 'store_false':
          dest = stringsOptions[key].dest;
          if (value !== null) {
            throw new Error("'" + key + "' does not take an argument");
          }
          argumentsDictionary[dest] = false;
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

  for (i = 0; i < config.requiredArguments.length; i++) {
    argumentName = config.requiredArguments[i][0].toLowerCase();
    argumentsDictionary[argumentName] = argv.shift();
  }

  for (i = 0; i < config.optionalArguments.length; i++) {
    argumentName = config.optionalArguments[i][0].toLowerCase();
    argumentsDictionary[argumentName] = argv.shift();
  }

  if (!misc.inArray(command, SPECIAL_COMMANDS) && argv.length !== 0) {
    throw new Error('Too many arguments');
  }

  // Filter out the 'undefined' values
  for (key in argumentsDictionary) {
    if (argumentsDictionary[key] === undefined) {
      delete argumentsDictionary[key];
    }
  }

  // Make sure that all the required arguments are provided
  var missingRequiredArguments = misc.arrayDifference(requiredArguments,
                                      Object.getOwnPropertyNames(argumentsDictionary));
  if (missingRequiredArguments.length) {
    throw new Error(sprintf('Missing required arguments: %s', missingRequiredArguments.join(', ')));
  }

  return handler.call(null, argumentsDictionary, this);
};

CommandParser.prototype.showHelp = function() {
  var self = this;
  var config, subCommands;

  this.puts(this.banner);
  this.puts('');
  this.puts('Available commands:\n');
  this.puts('  ' + term.rpad('[bold]help[/bold]', 45) + 'Print this help');

  this._GlobalCommands.forEach(function(command) {
    if (!misc.inArray(command, SPECIAL_COMMANDS)) {
      config = self._CommandsModules[command].config;

      self.puts('  ' + term.rpad(sprintf('[bold]%s[/bold]', command), 45) + config.shortDescription);
    }
  });

  for (var command in this._NormalCommands) {
    if (this._NormalCommands.hasOwnProperty(command)) {
      subCommands = sprintf('%s', self._NormalCommands[command].join(' | '));
      self.puts('  ' + term.rpad(sprintf('[bold]%s[/bold]', command), 45) + subCommands);
    }
  }

  this.puts("\nSee '" + this.binary + " help [bold]COMMAND[/bold]' for help on a specific command");
};

CommandParser.prototype.showGlobalCommandHelp = function(command) {
  this.showCommandHelp(command, null);
};

CommandParser.prototype.showNormalCommandHelp = function(command, subCommand) {
  if (!subCommand) {
    this.showCommandSubCommands(command);
  }
  else {
    this.showCommandHelp(command, subCommand);
  }
};

CommandParser.prototype.showCommandSubCommands = function(command) {
  var self = this;
  var config, argumentsString, descriptions;

  this.puts(sprintf('Available sub-commands for command %s:\n', command));

  this._NormalCommands[command].forEach(function(subCommand) {
    config = self.getModuleForCommand(command, subCommand).config;
    argumentsString = self.getCommandArgumentsString(command, subCommand);

    self.puts(sprintf('  %s %s', term.rpad(sprintf('[bold]%s[/bold] %s', subCommand, argumentsString), 45),
                      config.shortDescription));
  });

  self.puts(sprintf("\nUse '%s help %s [bold]SUB-COMMAND[/bold]' to see help for a specific sub-command",
                    this.binary, command));
};

CommandParser.prototype.showCommandHelp = function(command, subCommand) {
  var self = this;
  var config = this.getModuleForCommand(command, subCommand).config;

  this.mergeGlobalOptions(config);

  this.puts('[bold]USAGE[/bold]');
  term.printWrapped(this.getCommandUsageString(command, subCommand), null, null, this.puts);
  this.puts('');

  this.puts('[bold]DESCRIPTION[/bold]');
  term.printWrapped(config.longDescription);
  this.puts('');

  if (config.requiredArguments.length > 0) {
    this.puts('[bold]REQUIRED ARGUMENTS[/bold]');
    config.requiredArguments.forEach(function(arg) {
        self.puts(sprintf('  %s - %s', arg[0].toUpperCase(), arg[1]));
    });
    this.puts('');
  }

  if (config.optionalArguments.length > 0) {
    this.puts('[bold]OPTIONAL ARGUMENTS[/bold]');
    config.optionalArguments.forEach(function(arg) {
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

      term.printWrapped(option.desc, 80, 6);
      self.puts("");
    });
  }
};

CommandParser.prototype.getCommandString = function(command, subCommand) {
  var commandString;
  if (subCommand) {
    commandString = sprintf('%s %s', command, subCommand);
  }
  else {
    commandString = sprintf('%s', command);
  }

  return commandString;
};

CommandParser.prototype.getCommandUsageString = function(command, subCommand) {
  var argumentsString, moduleString, commandModule, optionsString, usageString;
  var commandOptions;

  argumentsString = this.getCommandArgumentsString(command, subCommand);

  if (command && subCommand) {
    moduleString = sprintf('%s/%s', command, subCommand);
  }
  else {
    moduleString = command;
  }

  commandModule = this._CommandsModules[moduleString];
  commandOptions = commandModule.config.options;

  if (commandOptions && commandOptions.length > 0) {
    optionsString = ' [OPTIONS] ';
  }
  else {
    optionsString = ' ';
  }

  usageString = sprintf('%s %s%s%s', this.binary, this.getCommandString(command, subCommand),
                         optionsString, argumentsString);

  return usageString;
};

CommandParser.prototype.getCommandArgumentsString = function(command, subCommand) {
  var i;
  var argumentsString = '';
  var terminator = ' ';
  var config = this.getModuleForCommand(command, subCommand).config;

  for (i = 0; i < config.requiredArguments.length; i++) {
    argumentsString += config.requiredArguments[i][0].toUpperCase() + ' ';
  }

  for (i = 0; i < config.optionalArguments.length; i++) {
    argumentsString += '[' + config.optionalArguments[i][0].toUpperCase();
    if (i < (config.optionalArguments.length - 1)) {
      argumentsString += ' ';
    }
  }

  for (; i > 0; i--) {
    argumentsString += ']';
  }

  return argumentsString;
};

CommandParser.prototype.getModuleForCommand = function(command, subCommand) {
  var commandName;

  if (subCommand) {
    commandName = sprintf('%s/%s', command, subCommand);
  }
  else {
    commandName = command;
  }

  return this._CommandsModules[commandName];
};

exports.CommandParser = CommandParser;
