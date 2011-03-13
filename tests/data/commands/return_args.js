var sys = require('sys');

var config = {
  shortDescription: 'Return passed args',
  longDescription: 'Return passed args',
  requiredArguments : [],
  optionalArguments: [],
  options: []
};

function handleCommand(args, commandParser) {
  return args;
}

exports.config = config;
exports.handleCommand = handleCommand;
