var sys = require('sys');

var config = {
  'short_description': 'Return passed args',
  'long_description': 'Return passed args',
  'required_arguments' : [],
  'optional_arguments': [],
  'options': [],
  'uses_global_options': ['colors']
};

function handle_command(args, command_parser) {
  return args;
}

exports.config = config;
exports.handle_command = handle_command;
