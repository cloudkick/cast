var config = {
  'short_description': 'List services',
  'long_description': 'List services long',
  'required_arguments' : [],
  'optional_arguments': [['server', 'only list services on this server']]
}

function handle_command(arguments) {
  if (arguments.server) {
    return 'Listing services for server ' + arguments.server;
  }
  else {
    return 'Listing services for all servers'
  }
}

exports.config = config;
exports.handle_command = handle_command;
