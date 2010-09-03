var sys = require('sys');

var config = {
  'short_description': 'Return hello world',
  'long_description': 'Return hello world long',
  'required_arguments' : [],
  'optional_arguments': [],
  'switches': []
}

function handle_command(arg) {
  return 'Hello world';
}

exports.config = config;
exports.handle_command = handle_command;
