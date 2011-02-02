var sys = require('sys');

var config = {
  'short_description': 'Bash completion',
  'long_description': 'Bash completion',
  'required_arguments' : [],
  'optional_arguments': [],
  'options': []
}

function handle_command(arg, command_parser) {
  return '';
}

exports.config = config;
exports.handle_command = handle_command;
