var constants = require('./constants')

var WORKER_PARAS = constants.WORKER_PARAS;

exports.get_worker = function(process_argv, worker_class) {
  var argv_len = process_argv.length;

  if (len = argv_len < 4) {
    return null;
  }

  for (var i = 2, len = argv_len; i < len; ++i) {
    var arg = process_argv[i];
    if (arg != WORKER_PARAS[i-2]) {
      return null;
    }
  }

  // if we are here, we are a worker
  return new worker_class();
};
