var config = {
  'short_description': 'List services',
  'long_description': 'List services long',
  'required_arguments' : [],
  'optional_arguments': [['server', 'only list services on this server']],
  'options': [
    {
      names: ['--display-disabled'],
      dest: 'display-disabled',
      action: 'store_true',
      desc: 'Display disabled services'
    },
    {
      names: ['--filter'],
      dest: 'filter',
      action: 'append',
      desc: 'Apply a filter to the list of displayed services'
    }
  ]
}

function handle_command(args) {
  if (args.server) {
    return 'Listing services for server ' + args.server;
  }
  else {
    return 'Listing services for all servers'
  }
}

exports.config = config;
exports.handle_command = handle_command;
