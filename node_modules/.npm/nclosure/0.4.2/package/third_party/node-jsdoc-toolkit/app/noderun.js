#!/usr/bin/node

exports.jsdoctoolkit = {
  initialised:false,
  init: function (args) {
    global.internal_args = args || [];

    if (this.initialised) {
      global.arguments = global.internal_args;
      main();
    }
    else {
      this.initialised = true;
      require('./run');
    }
  }
};