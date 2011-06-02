/*
 * Licensed to Cloudkick, Inc ('Cloudkick') under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * Cloudkick licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var fs = require('fs');
var sys = require('sys');
var path = require('path');
var events = require('events');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var Errorf = require('util/misc').Errorf;

/**
 * Resources for which jobs can be queued and executed. Implementations must
 * specify an 'exists' method.
 * @extends {events.EventEmitter}
 * @param {String} name The name of this resource's directory.
 */
function Resource(name) {
  this.name = name;
  this._serializer = undefined;
  this._jobs = [];
  this._waiters = [];
  this._running = null;
  this._jobCount = 0;
  this._state = null;
}

sys.inherits(Resource, events.EventEmitter);


Resource.prototype.list = function(callback) { callback(new Error('Not Implemented')); };


/**
 * Determine whether this resource exists. Should be overridden by resource
 * implementations.
 * @param {Function} callback A callback fired with (exists).
 */
Resource.prototype.exists = function(callback) { callback(false); };


/**
 * Determine the swiz type for this resource. Implementations should specify
 * a _serializerType property.
 * @returns {String} The serializer type for use by swiz.
 */
Resource.prototype.getSerializerType = function() {
  return this.constructor.name;
};


/**
 * Retrieve the serialized state of this resource. If a job is currently
 * executing on this resource this will use the state cached when that job
 * began. Otherwise it will retrieve the state on demand.
 * @param {Function} callback A callback fired with (err, state).
 */
Resource.prototype.getState = function(callback) {
  var self = this;

  if (this._running) {
    // If a job is running...
    if (!this._state) {
      // The state isn't ready yet, wait for it...
      this.once('cache', callback);
    } else if (this._state instanceof Error) {
      // The state was an error, whoops
      callback(this._state);
    } else {
      // Use the cached state directly
      callback(null, this._state);
    }
  } else {
    // Make sure no jobs start while we're doing this
    this._jobCount++;
    this._waitToCheck(function(afterCheck) {
      self.exists(function(exists) {
        if (!exists) {
          callback(self.getExistenceError(exists));
          self._removeJob(false);
          afterCheck();
          return;
        }
        self._serializer.buildObject(self, function(err, state) {
          callback(err, state);
          self._removeJob(false);
          afterCheck();
        });
      });
    });
  }
};


/**
 * Attempt to predict whether a resource will exist after the current job
 * queue has been flushed.
 * @param {Function} callback A callback fired with (willExist).
 */
Resource.prototype.willExist = function(callback) {
  var i;

  // Make a copy of the job queue and reverse it
  var priorJobs = this._jobs.slice(0, this._jobs.length).reverse();

  if (this._running) {
    priorJobs.push(this._running);
  }

  // Traverse prior jobs to see if they create/delete the resource
  for (i = 0; i < priorJobs.length; i++) {
    if (priorJobs[i].willCreate()) {
      callback(true);
      return;
    }

    if (priorJobs[i].willDelete()) {
      callback(false);
      return;
    }
  }

  // No job will create or delete this resource, does it exist now?
  this.exists(callback);
};


/**
 * Enqueue a job for this resource.
 * @param {Object} job The job to enqueue.
 */
Resource.prototype.enqueueJob = function(job, callback) {
  var self = this;
  this._jobCount++;

  this._waitToCheck(function(afterCheck) {

    // Test whether the resource will exist after the queue flushes.
    self.willExist(function(willExist) {

      // If the job can't handle a resource with willExist, callback with error
      if (!job.canHandleExistence(willExist)) {
        callback(self.getExistenceError(willExist));
        afterCheck();
        self._removeJob(false);
        return;
      }

      // When the job ends, start the next one
      job.on('error', function() {
        self._removeJob(true);
      });

      job.on('success', function() {
        self._removeJob(true);
      });

      // Enqueue this job and make sure the queue is being processed
      self._jobs.push(job);
      self._cycle();
      afterCheck();
      callback();
    });
  });
};


/**
 * Generate an error for this resource based on the passed boolean indicating
 * what the problem is.
 * @param {Boolean} exists Is that problem that it does exist, or doesn't?
 * @returns {Error} The appropriate error.
 */
Resource.prototype.getExistenceError = function(exists) {
  var fmt;

  if (exists) {
    fmt = '%s \'%s\' already exists.';
  } else {
    fmt = '%s \'%s\' does not exist.';
  }

  return new Errorf(fmt, this.constructor.name, this.name);
};


/**
 * Remove a job by decreasing the reference counter and, if the job was queued,
 * removing the reference to it as well.
 * @param {Boolean} queued Whether the job was queued.
 */
Resource.prototype._removeJob = function(queued) {
  this._jobCount--;

  // Jobs that have reached the queue will always make it to the head
  if (queued) {
    this._running = null;
    this._state = null;
    this._cycle();
  }

  if (this._jobCount === 0) {
    this.emit('drain');
  }
};


/**
 * If no job is currently being processed, start the one at the head of the
 * queue.
 * @private
 */
Resource.prototype._cycle = function() {
  var self = this;

  if (!this._running && this._jobs.length > 0) {
    this._running = this._jobs.shift();

    this._serializer.buildObject(this, function(err, state) {
      self._state = err || state;
      self.emit('cache', err, state);
      self._running.start();
    });
  }
};


/**
 * Called by jobs waiting to check their options. Only one job may be checking
 * its options at any given time.
 * @param {Function} callback A callback fired when job may check its options.
 */
Resource.prototype._waitToCheck = function(callback) {
  var self = this;

  function afterCheck() {
    self._waiters.shift();
    if (self._waiters.length > 0) {
      self._waiters[0](afterCheck);
    }
  }

  this._waiters.push(callback);
  if (this._waiters.length === 1) {
    this._waiters[0](afterCheck);
  }
};


/**
 * A resource that is backed by a directory.
 * @param {String} name The name of this resource's directory.
 * @constructor
 */
function DirectoryResource(name) {
  Resource.call(this, name);
  this.parentDir = this.getParentDir();
}

sys.inherits(DirectoryResource, Resource);


/**
 * Get parent directory of resources of this type. This must be set by
 * DirectoryResource implementations.
 * @returns {String} The path to the directory containing resource sof this
 *     type.
 */
DirectoryResource.prototype.getParentDir = function() { return undefined; };


/**
 * @inheritdoc
 */
DirectoryResource.prototype.list = function(callback) {
  fs.readdir(this.getParentDir(), callback);
};


/**
 * Get the path to the root of this resource.
 * @returns {String} Path to the root of this resource.
 */
DirectoryResource.prototype.getRoot = function() {
  return path.join(this.parentDir, this.name);
};


/**
 * Determine whether this resource exists by checking for its root directory.
 * @param {Function} callback A callback fired with (exists).
 */
DirectoryResource.prototype.exists = function(callback) {
  fs.stat(this.getRoot(), function(err, stats) {
    callback(!err && stats.isDirectory());
  });
};


/**
 * A ResourceManager manages access to resources in order to enforce locking,
 * queueing, etc. When a request to access a resource is received, the manager
 * will automatically construct resource objects as necessary, then deconstruct
 * them when they are no longer in use. The resource objects only provide
 * mechanisms for accessing the data they represent, and shouldn't try to
 * maintain resource state in memory.
 * @constructor
 */
function ResourceManager() {
  this.resourceType = undefined;
  this.resources = {};
}


/**
 * Retrieve, if necessary by instantiating, a resource with the specified name.
 * When a resource is instantiated it "job count" will be 0, but it won't be
 * removed until something causes it to emit a 'drain'. Thereore, if you are
 * going to call this you should make sure to kick off something that will
 * increment and later decrement the job counter.
 * @param {String} name The name of this job.
 */
ResourceManager.prototype._getOrCreate = function(name) {
  var self = this;

  // If necessary, instantiate the resource
  if (!this.resources[name]) {
    this.resources[name] = new this.resourceType(name);

    this.resources[name].on('drain', function() {
      delete self.resources[name];
    });
  }

  return this.resources[name];
};


/**
 * Execute the given job against the resource identified by the specified name.
 * @param {Object} job The job to execute.
 */
ResourceManager.prototype.runJob = function(job) {
  var self = this;
  var name = job.resourceName;

  job.enqueueFor(this._getOrCreate(name));
};


/**
 * Retrieve the serialized state of an instance.
 * @param {String} name The name of the resource to retreieve.
 * @param {Function} callback A callback fired with (err, state).
 */
ResourceManager.prototype.get = function(name, callback) {
  var self = this;
  var resource = this._getOrCreate(name);
  resource.getState(callback);
};


/**
 * Get a serialized copy of each resource.
 * @param {Function} callback A callback fired with (err, states).
 */
ResourceManager.prototype.list = function(callback) {
  var self = this;

  function getNames(callback) {
    self.resourceType.prototype.list(callback);
  }

  function mapToStates(names, callback) {
    var resources = names.map(function(name) {
      return self._getOrCreate(name);
    });

    async.map(resources, function(resource, callback) {
      resource.getState(callback);
    }, callback);
  }

  async.waterfall([getNames, mapToStates], callback);
};


/**
 * Resource managers may optionally override this to do asynchronous
 * initialization tasks.
 * @param {Function} callback A callback fired with (err).
 */
ResourceManager.prototype.init = function(callback) {
  callback();
};


exports.ResourceManager = ResourceManager;
exports.DirectoryResource = DirectoryResource;
