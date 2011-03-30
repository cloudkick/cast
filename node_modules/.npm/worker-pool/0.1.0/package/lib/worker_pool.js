// Worker pool

CHECK_PENDING_JOBS_INTERVAL = 200; // How often to check for pending jobs
KILL_ACTIVE_WORKER_TIMEOUT = (30 * 60 * 1000); // 30 minutes by default

var sys = require('util');
var events = require('events');

var constants = require('./constants');
var common = require('./common');
var worker_lib = require('./worker');

var Worker = worker_lib._Worker;
MESSAGE_SPLITTER = constants.MESSAGE_SPLITTER;

/*
 * Worker job class.
 *
 * @param {Object} msg Message object.
 * @param {Options} options Worker options.
 * @param {Function} callback Callback which is called with an optional error
 *                            as the first argument and the worker object as the
 *                            second one.
 */
function WorkerJob(msg, options, callback) {
  this.msg = msg || {};
  this.options = options || {};
  this.callback = callback;
}

/*
 * Pool worker class.
 */
function WorkerPoolChild(eventDest, filename, options) {
  worker_lib._WorkerChild.call(this, eventDest, filename, options);

  this._finished = false;
}

sys.inherits(WorkerPoolChild, worker_lib._WorkerChild);

/*
 * Create a new pool of workers which run script file_name.
 *
 * @param {Number} pool_size Pool size.
 * @param {String} file_name Name of the script which workers will run.
 */
function WorkerPool(pool_size, file_name) {
  events.EventEmitter.call(this);

  this._pool_size = pool_size;
  this._file_name = file_name;

  this._workers = []; // All the available workers
  this._active_workers = []; // Active workers
  this._idle_workers = []; // Idle workers
  this._pending_removal_workers = []; // Workers which are pending to be removed

  this._pending_jobs = [];
  this._is_terminated = false;
  this._pending_jobs_timeout_id = null;

  this._initialize();
}

sys.inherits(WorkerPool, events.EventEmitter);

/*
 * Initialize the pool (start the requested number of worker processes).
 */
WorkerPool.prototype._initialize = function() {
  var self = this;

  this._add_workers(this._pool_size);

  this._pending_jobs_timeout_id = setInterval(function() {
                                                self._run_pending_jobs();
                                              }, CHECK_PENDING_JOBS_INTERVAL);

  process.nextTick(function() {
    self.emit('ready');
  });
};

/*
 * Return pool size.
 *
 * @return {Number} pool size.
 */
WorkerPool.prototype.get_size = function() {
  return this._pool_size;
};

/*
 * Ensures that the pool always contains exactly _pool_size number of workers.
 *
 * @param {Boolean} forcefully If false and there are no idle workers to be removed,
 *                             wait before one becomes inactive, otherwise kill
 *                             a random active worker.
 */
WorkerPool.prototype._ensure_pool_size = function(forcefully) {
  var forcefully_ = forcefully || false;
  var diff = (this._pool_size - this._workers.length);

  if (diff === 0) {
    return;
  }
  else if (diff > 0) {
    this._add_workers(diff);
  }
  else if (diff < 0) {
    this._remove_workers(Math.abs(diff), forcefully_);
  }
};

/*
 * Add workers to the pool.
 *
 * @param {Number} count Number of workers to add.
 */
WorkerPool.prototype._add_workers = function(count) {
  var i, worker;

  for (i = 0; i < count; i++) {
    worker = new Worker(this._file_name, WorkerPoolChild, {});

    this._workers.push(worker);
    this._idle_workers.push(worker);
  }
};

/*
 * Remove workers from the pool.
 *
 * @param {Number} count How many workers to remove.
 * @param {Boolean} forcefully If true and there are not idle workers, kill random
 *                             active worker, otherwise wait for it to become idle.
 */
WorkerPool.prototype._remove_workers = function(count, forcefully) {
  var self = this;
  var forcefully_ = forcefully || false;
  var i, worker, idle_workers_count, active_workers, count, removed = 0;

  idle_workers_count = this._idle_workers.length;

  for (i = 0; i < idle_workers_count && removed < count; i++) {
    worker = this._idle_workers[idle_workers_count - i - 1];

    this._kill_worker(worker);
    removed++;
  }

  if (removed === count) {
    // We are done
    return;
  }

  active_workers_count = this._active_workers.length;
  for (i = 0; i < active_workers_count && removed < count; i++) {
    worker = this._active_workers[active_workers_count - i - 1];

    if (forcefully_) {
      this._kill_worker(worker);
      removed++;
    }
    else {
      // Worker is removed from the list of the active workers, but will actually
      // be killed after is has finished processing or it has been killed because
      // of a timeout.
      this._remove_worker(worker);
      this._pending_removal_workers.push(worker);
      worker.on('result', function() {
        self._kill_worker(this);
      });

      removed++;
    }
  }
};

/*
 * Return a worker object if any idle worker are available, false otherwise.
 *
 * @return {WorkerPoolChild/Boolean} Worker object if any idle workers are
 *                                          available, false otherwise.
 */
WorkerPool.prototype._get_idle_worker = function() {
  var worker;
  var idle_len = this._idle_workers.length;

  if (idle_len > 0) {
    worker = this._idle_workers.shift();
    this._active_workers.push(worker);

    return worker;
  }

  return false;
};

/*
 * Send the message to the idle worker and run it in the pool.
 * Worker is returned back to the pool, when it emits an result event or if a
 * terminated function is called.
 *
 * @oaram {Object} msg Message (payload).
 * @param {Object} options Worker options.
 * @param {Function} callback Callback which is called with a possible error as
 *                            the first argument and Worker object as the second
 *                            one.
 */
WorkerPool.prototype.run_in_pool = function(msg, options, callback) {
  var job;

  if (this._terminated) {
    // Pool has been terminated - not accepting new tasks
    callback(new Error('Worker pool has been terminated, not accepting new jobs'));
    return;
  }

  job = new WorkerJob(msg, options, callback);
  this._pending_jobs.push(job);
};

/*
 * This function is called periodically and runs pending jobs if there are any
 * idle workers available.
 */
WorkerPool.prototype._run_pending_jobs = function() {
  var worker, job;

  if (this._pending_jobs.length === 0 || this.is_terminated()) {
    // No pending jobs or pool has been terminated
    return;
  }

  worker = this._get_idle_worker();

  if (!worker) {
    // No idle workers
    return;
  }

  job = this._pending_jobs.shift();
  this._run_in_worker(worker, job);
};

/*
 * Run job in the provided worker.
 *
 * @param {WorkerPoolChild} worker Worker in which the job will run.
 * @param {WorkerJob} job Job to run.
 */
WorkerPool.prototype._run_in_worker = function(worker, job) {
  var self = this;
  var callback, msg, timeout, timeout_id;

  callback = job.callback;
  timeout = job.options.timeout || KILL_ACTIVE_WORKER_TIMEOUT;
  msg = job.msg;

  // Pass worker handle to the caller
  callback(null, worker);

  timeout_id = this._add_kill_timeout(worker, timeout);
  worker._timeout_id = timeout_id;

  // Free a worker after it has finished processing
  worker.on('result', function() {
    self._free_worker(worker);
  });

  // Send worker a message
  worker.postMessage(msg);
};

/*
 * Add a timeout after which the worker is killed if it has not finished processing.
 *
 * @param {Object} worker Worker object.
 * @param {Number} timeout Timeout (in milliseconds).
 */
WorkerPool.prototype._add_kill_timeout = function(worker, timeout) {
  var timeout_id;
  var self = this;

  // Automatically kill the worker if it has not finished processing after
  // timeout number of milliseconds.
  // This prevents bugs in a worker script to exhaust all the active workers.
  timeout_id = setTimeout(function() {
                            worker.emit('timeout');
                            self._kill_worker(worker);
                          }, timeout);

  return timeout_id;
};

/*
 * Add worker back to the available workers.
 * This is called after the worker has finished processing.
 *
 * @param {Object} worker Worker object.
 */
WorkerPool.prototype._free_worker = function(worker) {
  var index = this._active_workers.indexOf(worker);

  this._active_workers.splice(index, 1);
  this._idle_workers.push(worker);

  if (worker._timeout_id) {
    // Clear the timeout
    clearTimeout(worker._timeout_id);
    worker._timeout_id = null;
  }

  // Remove all the listeners
  worker.removeAllListeners('result');
  worker.removeAllListeners('error');
  worker.removeAllListeners('timeout');

  this.emit('worker_freed', worker);
};

/*
 * Remove a worker from the pool.
 *
 * @param {Worker} Worker object.
 */
WorkerPool.prototype._remove_worker = function(worker) {
  var index_workers = this._workers.indexOf(worker);
  var index_active = this._active_workers.indexOf(worker);
  var index_idle = this._idle_workers.indexOf(worker);

  if (index_workers === -1) {
    // This worker has probably already been removed from the pool.
    return;
  }

  this._workers.splice(index_workers, 1);

  if (index_active !== -1) {
    this._active_workers.splice(index_active, 1);
  }

  if (index_idle !== -1) {
    this._idle_workers.splice(index_idle, 1);
  }

  // Remove all the listeners
  worker.removeAllListeners('result');
  worker.removeAllListeners('error');
  worker.removeAllListeners('timeout');

  this.emit('worker_removed', worker);
}

/*
 * Forcefully kill a worker process.
 *
 * @param {WorkerPoolChild} worker Child worker object.
 */
WorkerPool.prototype._kill_worker = function(worker) {
  var self = this;

  var in_active = this._active_workers.indexOf(worker);
  var in_idle = this._idle_workers.indexOf(worker);
  var in_pending_removal = this._pending_removal_workers.indexOf(worker);

  // Make sure that the worker is actually still running
  if (in_active === -1 && in_pending_removal === -1 && in_idle === -1) {
    return;
  }

  if (in_pending_removal !== -1) {
    this._pending_removal_workers.splice(in_pending_removal, 1);
  }

  if (worker._timeout_id) {
    // Clear the timeout
    clearTimeout(worker._timeout_id);
    worker._timeout_id = null;
  }

  // Because the worker has been forcefully terminated, _remove_worker function
  // needs to be called manually.
  worker.terminate(true);

  this._remove_worker(worker);
  process.nextTick(function() {
    self._ensure_pool_size();
  });
};

/*
 * Resize the pool.
 *
 * @param {Number} new_size New pool size.
 */
WorkerPool.prototype.resize_pool = function(new_size) {
  if (this._terminated) {
    return;
  }

  this._pool_size = new_size;
  this._ensure_pool_size();
};

/*
 * Return worker pool status.
 *
 * @return {Boolean} true if the pool has been terminated (stopped), false
 *                        otherwise.
 */
WorkerPool.prototype.is_terminated = function() {
  return this._is_terminated;
};

/*
 * Kill all the pool workers.
 *
 * @param {Boolean} forcefully If forcefully equals false, wait until all the
 *                             workers have finished processing before terminating.
 *
 * Note: If there are any pending jobs left in the queue, they won't be processed,
 *       even if forcefully equals false.
*/
WorkerPool.prototype.terminate = function(forcefully) {
  var self = this;
  var pool_size = this._pool_size;

  var forcefully_ = forcefully || false;
  this._terminated = true;
  this._pool_size = 0;
  this._pending_jobs = [];

  clearInterval(this._pending_jobs_timeout_id);

  process.nextTick(function() {
    self._remove_workers(pool_size, forcefully_);
  });
};

function WorkerPoolProcess(eventDest) {
  worker_lib._WorkerProcess.call(this, eventDest);
}

sys.inherits(WorkerPoolProcess, worker_lib._WorkerProcess);

/*
 * Post the result.
 *
 * @param {String} result JSON encoded result.
 */
WorkerPoolProcess.prototype.postResult = function(result) {
  sys.print(result+MESSAGE_SPLITTER);
};

function WorkerPoolNode(options) {
  var self = this;
  worker_lib._WorkerNode.call(this, WorkerPoolProcess, {});

  // Add a custom result and uncaughtException handler
  this.removeAllListeners('message');
  process.removeAllListeners('uncaughtException');

  this.addListener('result', function(result) {
    if (self.onresult) {
      self.onresult(result);
    }
  });

  process.addListener('uncaughtException', function (exception) {
    self.postResult({
      __exception__: exception
    });
  })
}

sys.inherits(WorkerPoolNode, worker_lib._WorkerNode);

WorkerPoolNode.prototype.postResult = function(payload) {
  this.impl.postResult(JSON.stringify(payload));
};

// postMessage function is only available with the normal workers. Pool workers
// use 'postResult' function.
//
// Note: postResult must only be called once after the worker has finished all
// the processing.
WorkerPoolNode.prototype.postMessage = undefined;
WorkerPoolNode.prototype.handleMessage = undefined;

/*
 * Emit the result event and propagate the result back to the caller.
 *
 * @param {String} result JSON encoded result.
 */
WorkerPoolChild.prototype.handleResult = function(result) {
  var obj;

  try {
    obj = JSON.parse(result);
  }
  catch (err) {
    this.eventDest.emit('error', err);

    return;
  }

  if (obj.__exception__) {
    this.eventDest.emit('error', obj.__exception__);
  }
  else {
    this.eventDest.emit('result', obj);
  }
};

/*
 * Handle the worker data.
 *
 * @param {Buffer} data Data.
 */
WorkerPoolChild.prototype.handleData = function(data) {
  worker_lib._WorkerChild.prototype.handleData.call(this, data,
                                        WorkerPoolChild.prototype.handleResult);
};

/*
 * Terminate (kill) a worker process.
 */
WorkerPoolChild.prototype.terminate = function() {
  worker_lib._WorkerChild.prototype.terminate.call(this);

  this.child.kill('SIGTERM');
};

exports.WorkerPool = WorkerPool;

// This value will only be defined, if this script is run by a worker
exports.worker = common.get_worker(process.ARGV.slice(), WorkerPoolNode);
