var sys = require('sys');

var config = {
  shortDescription: 'Return hello world',
  longDescription: 'Return hello world long',
  requiredArguments : [],
  optionalArguments: [],
  options: []
};

function handleCommand(arg, commandParser) {
  return 'Hello world';
}

exports.config = config;
exports.handleCommand = handleCommand;
