var config = {
  shortDescription: 'Restart service',
  longDescription: 'Restart service long',
  requiredArguments : [['name', 'service name']],
  optionalArguments: [['wait', 'number of seconds to wait before starting the service']],
  switches: []
}

function handleCommand(args) {
  return args.name, args.wait;
}

exports.config = config;
exports.handleCommand = handleCommand;
