var sys = require('sys');
var version = require('util/version');

var config = {
  'short_description': 'Print the version',
  'long_description': 'Print the version',
  'required_arguments' : [],
  'optional_arguments': []
}

function handle_command(arguments) {
  sys.puts(version.toString());
}

exports.config = config;
exports.handle_command = handle_command;
