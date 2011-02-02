var config = {
  'short_description': 'Restart service',
  'long_description': 'Restart service long',
  'required_arguments' : [['name', 'service name']],
  'optional_arguments': [['wait', 'number of seconds to wait before starting the service']],
  'switches': []
}

function handle_command(args) {
  return args.name, args.wait;
}

exports.config = config;
exports.handle_command = handle_command;
