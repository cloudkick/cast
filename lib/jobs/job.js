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
 * Job options are can be any of:
 * CREATE - operates only on non-existant resources, creates them
 * UPDATE - operates only on existing resources
 * (CREATE | UPDATE) - operates on a resource, creates it if it doesn't exist
 * DELETE - removes existing resources
 */
var JobOptions = {
  CREATE: 1 << 0,
  UPDATE: 1 << 1,
  DELETE: 1 << 2
};


/**
 * Job objects represent an an action that should be carried out against a
 * resource. Subclasses of Job should set the 'options' field and implement
 * the 'run' method.
 * @constructor
 * @param {Object} args Arguments that should be passed to 'run'.
 */
function Job(args) {
  var self = this;

  // An array of arguments passed to run
  this.args = Array.prototype.slice.call(args);

  // A job's id is assiged by the job manager when it is submitted
  this.id = null;

  // A job's resource is set when it attempts to enqueue itself for a resource
  this.resource = null;

  // A job's resource identifiers and options are set by the implementation
  this.resourceType = undefined;
  this.resourceName = undefined;
  this.options = undefined;

  // The following properties are set as various events are emitted
  this.result = null;
  this.messages = [];
  
  // Jobs go from 'unassigned' -> 'assigned' -> 'queued' -> 'running' -> 'completed'
  this.status = 'unassigned';

  
  // The result is set when an 'error' or 'success' event is emitted
  this.on('success', function(result) {
    self.status = 'completed';
    self.result = {
      type: 'success',
      data: result
    };
  });

  this.on('error', function(err) {
    self.status = 'completed';
    self.result = {
      type: 'error',
      data: err
    };
  });

  
  // Messages are logged as they are emitted
  this.on('message', function(msg) {
    self.messages.push(msg);
  });

  this.on('start', function() {
    self.status = 'running';
  });
}
sys.inherits(Job, events.EventEmitter);


/**
 * The resource for this job must exist, unless we will create it.
 * @returns {Boolean} Whether the resource for this job must exist.
 */
Job.prototype.resourceMustExist = function() {
  return !(this.options & JobOptions.CREATE);
};


/**
 * The resource for this job must not exist if we can _only_ create it (as
 * opposed to create OR update).
 * @returns {Boolean} Whether the resource for this job must not exist.
 */
Job.prototype.resourceMustNotExist = function() {
  return this.options === JobOptions.CREATE;
};


/**
 * For jobs that set as the 'running' job for a resource this accurately
 * verifies whether a job with given options can execute against its resource.
 * For jobs that are in a resource's queue, this traverses up the queue in
 * order to __predict__ whether it can run. This allows, for example, a 'start'
 * job to be queued following a 'create' job. This should still be called for
 * each job once it is set as a resource's 'running' job however, as a job
 * ahead of it in the queue may have failed.
 * @param {Function} callback A callback fired with (err).
 */
Job.prototype.checkOptions = function(callback) {
  var self = this;
  var resource = this.resource;
  var priorJobs = [];
  var i;

  // For jobs that don't care if the resource exists, skip this
  if (!self.resourceMustNotExist() && !self.resourceMustExist()) {
    callback();
    return;
  }

  // Once we believe that the resource will/will not exist..
  function withExistence(willExist) {
    if (self.resourceMustExist() && !willExist) {
      callback(new Errorf('%s \'%s\' does not exist.',
                          self.resource.constructor.name, self.resource.name));
      return;
    }

    if (self.resourceMustNotExist() && willExist) {
      callback(new Errorf('%s \'%\' already exists.',
                          self.resource.constructor.name, self.resource.name));
      return;
    }

    callback();
  }
  
  if (this !== resource._running) {
    // Locate this job in the queue
    for (i = 0; i < resource._jobs.length; i++) {
      if (this === resource._jobs[i]) {
        break;
      }
    }

    // Grab a copy of all jobs ahead of us in reverse order.
    priorJobs = resource._jobs.slice(0, i).reverse();

    // Include the 'running' job.
    if (resource._running) {
      priorJobs.push(resource._running);
    }

    // Traverse prior jobs to see if they create/delete the resource
    for (i = 0; i < priorJobs.length; i++) {
      if (priorJobs[i].options & JobOptions.CREATE) {
        withExistence(true);
        return;
      }

      if (priorJobs[i].options & JobOptions.DELETE) {
        withExistence(false);
        return;
      }
    }
  }

  // Either this job is 'running' or no prior jobs did CREATE/DELETE
  self.resource.exists(withExistence);
};


/**
 * Add this job to job queue associated with the specified resource.
 * @param {Object} resource The resource on which the job shoud be executed.
 */
Job.prototype.enqueueFor = function(resource) {
  var self = this;

  if (this.status !== 'unassigned') {
    throw new Error('Job already assigned to resource');
  }

  this.status = 'assigned';
  this.resource = resource;

  // We have to wait in a "queue queue" for all jobs ahead of us to attempt to
  // enter the "real queue". For example if a 'create' and 'update' attempted
  // to enter the "real queue" simultaneously the 'update' job would be unable
  // to check its options properly as the 'create' wouldn't yet be in the
  // queue.
  this.resource._waitToCheck(function(afterCheck) {
    self.checkOptions(function(err) {
      if (err) {
        self.emit('error', err);
        afterCheck();
        return;
      }

      // This job must be queued before calling afterCheck
      self.resource._jobs.push(self);
      afterCheck();
      self.status = 'queued';
      self.emit('ready');
      self.resource._cycle();
    });
  });
};


/**
 * Called by the resource to start this job.
 */
Job.prototype.start = function() {
  var self = this;

  function onComplete(err, result) {
    if (err) {
      self.emit('error', err);
    } else {
      self.emit('success', result);
    }
    self.resource._running = null;
    self.resource._cycle();
  }

  // Verify this job can still execute before running it
  this.checkOptions(function(err) {
    if (err) {
      self.emit('error', err);
      self.resource._running = null;
      self.resource._cycle();
      return;
    }

    // The first argument is the resource, then passed args, then callback
    var fnargs = [self.resource].concat(self.args, onComplete);
    self.run.apply(self, fnargs);
  });
};


/**
 * The run method should be provided by the implementation, and carries out the
 * actual work done by the job on it's resource.
 */
Job.prototype.run = function() {};


exports.Job = Job;
exports.JobOptions = JobOptions;
