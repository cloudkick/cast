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

var Errorf = require('util/misc').Errorf;

/**
 * A resource that is backed by a directory.
 * @param {String} name The name of this resource's directory.
 * @constructor
 */
function DirectoryResource(name) {
  this.name = name;
  this.parentDir = undefined;
  this._jobs = [];
  this._waiters = [];
  this._running = null;
}


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
 * Attempt to predict whether a resource will exist after the current job
 * queue has been flushed.
 * @param {Function} callback A callback fired with (willExist).
 */
DirectoryResource.prototype.willExist = function(callback) {
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
DirectoryResource.prototype.enqueueJob = function(job, callback) {
  var self = this;

  this._waitToCheck(function(afterCheck) {

    // Test whether the resource will exist after the queue flushes.
    self.willExist(function(willExist) {

      // If the job can't handle a resource with willExist, callback with error
      if (!job.canHandleExistence(willExist)) {
        callback(self.getExistenceError(willExist));
        afterCheck();
        return;
      }

      // When the job ends, start the next one
      job.on('error', function() {
        self._running = null;
        self._cycle();
      });

      job.on('success', function() {
        self._running = null;
        self._cycle();
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
DirectoryResource.prototype.getExistenceError = function(exists) {
  var fmt;

  if (exists) {
    fmt = '%s \'%s\' already exists.';
  } else {
    fmt = '%s \'%s\' does not exist.';
  }

  return new Errorf(fmt, this.constructor.name, this.name);
};


/**
 * If no job is currently being processed, start the one at the head of the
 * queue.
 * @private
 */
DirectoryResource.prototype._cycle = function() {
  var self = this;

  if (!this._running && this._jobs.length > 0) {
    this._running = this._jobs.shift();

    // Delay start of the job until next tick to make queue testing easier
    process.nextTick(function() {
      self._running.start();
    });
  }
};


/**
 * Called by jobs waiting to check their options. Only one job may be checking
 * its options at any given time.
 * @param {Function} callback A callback fired when job may check its options.
 */
DirectoryResource.prototype._waitToCheck = function(callback) {
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
 * Execute the given job against the resource identified by the specified name.
 * @param {Object} job The job to execute.
 */
ResourceManager.prototype.runJob = function(job) {
  var name = job.resourceName;

  if (!this.resources[name]) {
    this.resources[name] = new this.resourceType(name);
  }

  job.enqueueFor(this.resources[name]);
};


exports.ResourceManager = ResourceManager;
exports.DirectoryResource = DirectoryResource;
