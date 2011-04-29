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

// TODO: Hook up config
//var config = require('util/config');
var Errorf = require('util/misc').Errof;


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


// Resource

function DirectoryResource(parentDir, name) {
  this.name = name;
  this.root = path.join(parentDir, name);
  this._jobs = [];
  this._running = null;
}


/**
 * Determine whether this resource exists by checking for its root directory.
 * @param {Function} callback A callback fired with (exists).
 */
DirectoryResource.prototype.exists = function(callback) {
  fs.stat(this.root, function(err, stats) {
    callback(!err && stats.isDirectory());
  });
};


DirectoryResource.prototype._cycle = function() {
  if (!this._running && this._jobs.length > 0) {
    this._running = this._jobs.shift();
    this._running.start();
  }
};


function Bundle(name) {
  // TODO: Hook up config
  //var conf = config.get();
  // DirectoryResource.call(this, name, conf['bundle_dir']);
  DirectoryResource.call(this, name, '/Users/russell/cast-data/bundles');
}
sys.inherits(Bundle, DirectoryResource);



// Resource Manager

function ResourceManager() {
  this.resourceType = undefined;
  this.resouces = {};
}


/**
 * Execute the given job against the resource identified by the specified name.
 * @param {String} name The name of the resource to execute the job against.
 * @param {Object} job The job to execute.
 */
ResourceManager.prototype.runJob = function(name, job) {
  if (!this.resources[name]) {
    this.resources[name] = new this.resourceType(name);
  }

  job.enqueueFor(this.resources[name]);
};


function BundleManager() {
  ResourceManager.call(this);
  this.resourceType = Bundle;
}


// Jobs

function Job(args) {
  var self = this;

  // An array of arguments passed to run
  this.args = Array.prototype.slice.call(args);

  // A job's id and resource are defined when it is queued
  this.id = null;
  this.resource = null;

  // A job's type and heading are provided by the implementation
  this.type = undefined;
  this.heading = undefined;
  this.options = undefined;

  // The following properties are set as various events are emitted
  this.result = null;
  this.messages = [];
  
  // Jobs go from 'unassigned' -> 'queued' -> 'running' -> 'completed'
  this.status = 'unassigned';

  
  // The result is set when an 'err' or 'success' event is emitted
  this.on('success', function(result) {
    self.status = 'completed';
    self.result = {
      type: 'success',
      data: result
    };
  });

  this.on('err', function(err) {
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
Job.prorotype.resurceMustNotExist = function() {
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
      callback(new Errorf('Resource %s does not exist.', self.resource.name));
      return;
    }

    if (self.resourceMustNotExist() && willExist) {
      callback(new Errorf('Resource % already exists.', self.resource.name));
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

  this.resource = resource;
  this.checkOptions(function(err) {
    if (err) {
      self.emit('err', err);
      return;
    }

    self.resource._jobs.push(this);
    self.status = 'queued';
    self.emit('ready');
    self.resource._cycle();
  });
};


Job.prototype.start = function() {
  var self = this;

  function onComplete(err, result) {
    if (err) {
      self.emit('err', err);
    } else {
      self.emit('success', result);
    }
    self.resource._running = null;
    self.resource._cycle();
  }

  // Verify this job can still execute before running it
  this.checkOptions(function(err) {
    if (err) {
      self.emit('err', err);
      return;
    }

    // The first argument is the resource, then passed args, then callback
    var fnargs = [this.resource].concat(this.args, onComplete);
    this.run.apply(this, fnargs);
  });
};


Job.prototype.run = function() {};


function BundlePointlessJob(somearg) {
  Job.call(this, arguments);
  this.args = arguments;
  this.type = 'BUNDLE_POINTLESS';
  this.heading = 'doing pointless stuff';
}
sys.inherits(BundlePointlessJob, Job);


BundlePointlessJob.prototype.run = function(bundle, somearg, callback) {
  console.log('Executing Job');
  this.emit('message', 'execution in progress');
  console.log(bundle);
  console.log(somearg);
  this.emit('message', 'execution still going');
  callback();
};


