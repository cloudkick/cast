// An implementation of the web worker API for node.js

var sys = require('sys');
var child_process = require('child_process');

var constants = require('./constants');
var common = require('./common');

var workerIndex = 0;

var MESSAGE_SPLITTER = constants.MESSAGE_SPLITTER;
var WORKER_PARAS = constants.WORKER_PARAS;
var HANDSHAKE = constants.HANDSHAKE;
var DEBUG = constants.DEBUG;

function debug(msg) {
  if (DEBUG) {
    sys.error("debug "+process.pid+" - "+msg)
  }
}

exports.importScripts = function () {
  for (var i = 0, len = arguments.length; i < len; ++i) {
    require(arguments[i]);
  }
};

exports.getWorker = function(file_name, options) {
  return new Worker(file_name, null, options);
};

var Worker = function (filename, impl, options) {
  var self = this;
  process.EventEmitter.call(this);
  this.addListener("message", function (message) {
    if (self.onmessage) {
      self.onmessage(message);
    }
  });

  this.addListener("error", function (message) {
    if (self.onerror) {
      self.onerror(message);
    } else {
      if(self.listeners("error").length === 1) {
        throw new Error(message)
      }
    }
  });

  if(!impl) impl = WorkerChild;
  this.impl = new impl(this, filename, options);
  this.workerIndex = workerIndex++;
};

sys.inherits(Worker, process.EventEmitter);
Worker.prototype.postMessage =  function (payload) {
  var message = JSON.stringify(payload);
  this.impl.postMessage(message);
};

Worker.prototype.terminate = function () {
  this.impl.terminate();
};

Worker.prototype.isTerminated = function () {
  return this.impl.isTerminated();
};

exports.Worker = Worker;

function WorkerChild (eventDest, filename, options) {
  var timeout_id;
  var options = options || {};
  var self = this;
  this.eventDest  = eventDest;
  this.filename = filename;
  this.child = child_process.spawn("node", [this.filename].concat(WORKER_PARAS));
  this.child.stdout.addListener("data", function (data) {
    debug("From worker " + data);
    self.handleData(data);
  });

  this.child.stderr.addListener("data", function (data) {
    if(data !== null) {
      if((data+"").match("SyntaxError")) { // highly depends on node's error reporting behavior
        self.eventDest.emit("error", new SyntaxError(data));
      }
    }
  });

  this.child.addListener("exit", function (code) {
    if (!this.terminated) {
      this.terminated = true;
    }

    if (self.timeout_id) {
      clearTimeout(self.timeout_id);
    }

    self.eventDest.emit("exit", code);
    debug(self.child.pid + ": exit "+code);
  });

  if (options.timeout) {
    // Set a timeout handler which kills the process if it has not finished
    // executing after options.timeout number of milliseconds.
    timeout_id = setTimeout(function() {
                              self.timeoutHandler();
                            }, options.timeout);
  }
  else {
    timeout_id = null;
  }

  this.buffer = "";
  this.active = false;
  this.terminated = false;
  this.queue  = [];

  this.options = options;
  this.timeout_id = timeout_id;
}

WorkerChild.prototype = {

  timeoutHandler: function() {
    if (!this.terminated) {
      this.child.kill('SIGTERM');

      err = new Error('Child killed, because it did not finish after '
                      + this.options.timeout + ' milliseconds');
      this.eventDest.emit("error", err);
    }
  },

  postMessage: function (message) {
    if (!this.active && this.terminated) {
      throw new Error('Cannot post message to a terminated child');
    }

    if(this.active) {
      debug("Sending data "+message);
      this.write(message+MESSAGE_SPLITTER);
    } else {
      this.queue.push(message);
    }
  },

  postQueue: function () {
    for(var i = 0, len = this.queue.length; i < len; ++i) {
      this.postMessage(this.queue[i]);
    }
    this.queue = [];
  },

  handleData: function (data, handle_message_function) {
    var self = this;
    var handle_function;
    this.buffer += (data || "");
    debug("Received data "+this.buffer);

    if (handle_message_function) {
      handle_function = handle_message_function;
    }
    else {
      handle_function = this.handleMessage;
    }

    if(this.buffer !== "") {
      var parts = this.buffer.split(MESSAGE_SPLITTER);
      while (parts.length > 1) {
        var message = parts.shift();
        if (message !== "") {
          if(message === HANDSHAKE) {
            this.active = true;
            this.postQueue();
            self.write(MESSAGE_SPLITTER);
          } else {
            handle_function.call(this, message);
          }

          this.buffer = parts.join(MESSAGE_SPLITTER);
          if(this.buffer !== "") {
            this.handleData("");
            return;
          }
        }
      }
    }
  },

  write: function (msg) {
    if (this.terminated) {
      return;
    }

    this.child.stdin.write(msg, "utf8")
  },

  handleMessage: function (message) {
    debug("Emit event "+message);

    try {
      var obj = JSON.parse(message);
    }
    catch (err) {
      this.eventDest.emit("error", err);
      return;
    }

    if (obj.__exception__) {
      this.eventDest.emit("error", obj.__exception__)
    } else {
      this.eventDest.emit("message", obj)
    }
  },

  terminate: function () {
    this.active = false;
    this.terminated = true;
    this.child.stdin.end();
  },

  isTerminated: function() {
    return this.terminated;
  },
};

var workerProcess;
var i = 0;
function WorkerProcess(eventDest) {
  sys.print(HANDSHAKE+MESSAGE_SPLITTER);
  var self = this;
  this.eventDest = eventDest;
  var stdin = process.openStdin();
  stdin.addListener("data", function (data) {
    debug("Process receiving data "+data);
    self.handleData(data);
  });
  this.buffer = "";
}

WorkerProcess.prototype = {
  postMessage: function (message) {
    //debug("Process posting message "+message);
    sys.print(message+MESSAGE_SPLITTER);
  },

  handleData:    WorkerChild.prototype.handleData,
  handleMessage: WorkerChild.prototype.handleMessage
};

function WorkerNode (impl, options) {
  var self = this;
  if(!impl) impl = WorkerProcess;
  this.impl = new impl(this, options);

  process.EventEmitter.call(this);
  this.addListener("message", function (message) {
    if (self.onmessage) {
      self.onmessage(message);
    }
  });

  process.addListener("uncaughtException", function (exception) {
    debug("Exception in Worker "+exception)
    self.postMessage({
      __exception__: exception
    });
  })
}
sys.inherits(WorkerNode, process.EventEmitter);

WorkerNode.prototype.postMessage = function (payload) {
  this.impl.postMessage(JSON.stringify(payload));
};

// only for inheritance
exports._Worker   = Worker;
exports._WorkerChild   = WorkerChild;
exports._WorkerProcess = WorkerProcess;
exports._WorkerNode = WorkerNode;

if (module.parent && module.parent.filename.indexOf('worker_pool') === -1) {
  // This is only exported if this module is not included from the worker pool
  // module and if it is run by a child.
  exports.worker = common.get_worker(process.ARGV.slice(), WorkerNode);
}
