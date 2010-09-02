var sys = require('sys');

var config = {
  'short_description': 'Return hello world',
  'long_description': 'Return hello world long',
  'required_arguments' : [],
  'optional_arguments': []
}

function handle_command(arguments) {
  return 'Hello world';
}

exports.config = config;
exports.handle_command = handle_command;
