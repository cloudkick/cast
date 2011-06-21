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
  this.args = args || [];

  // A job's id is assiged by the job manager when it is submitted
  this.id = null;

  // A job's resource is set when it attempts to enqueue itself for a resource
  this._resource = null;

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
    self._resource = undefined;
    self.status = 'completed';
    self.result = {
      type: 'success',
      data: result
    };
  });

  this.on('error', function(err) {
    self._resource = undefined;
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
 * Retrieve serializer type for the Job class.
 * @returns {String} Serializer type.
 */
Job.prototype.getSerializerType = function() {
  return 'Job';
};


/**
 * Retriever serializer definitions for the Job class.
 * @returns {Array} Serializer definitions.
 */
Job.prototype.getSerializerDefs = function() {
  return  {
    'Job': [
      ['id', {src: 'id', type: 'string'}],
      ['resourceName', {src: 'resourceName', type: 'string'}],
      ['resourceType', {src: 'getResourceTypeName', type: 'string'}],
      ['status', {src: 'status', type: 'string'}],
      ['messages', {src: 'messages', type: 'array<string>'}],
      ['result', {src: 'result', type: 'object'}]
    ]
  };
};


/**
 * Retrieve the name of the resource class this job operates on.
 * @param {Function} callback A callback fired with (err, name).
 */
Job.prototype.getResourceTypeName = function(callback) {
  callback(null, this.resourceType.name);
};


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
 * Will this job create its resource?
 * @returns {Boolean} Whether this job will create its resource.
 */
Job.prototype.willCreate = function() {
  return (this.options & JobOptions.CREATE) !== 0;
};


/**
 * Will this job delete its resource?
 * @returns {Boolean} Whether this job will delete its resource.
 */
Job.prototype.willDelete = function() {
  return (this.options & JobOptions.DELETE) !== 0;
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
  this._resource = resource;

  this._resource.enqueueJob(this, function(err) {
    if (err) {
      self.emit('error', err);
      return;
    }

    self.status = 'queued';
    self.emit('ready');
  });
};


/**
 * Given a boolean indicating whether a resource exists (or is predicted to exist)
 * return a boolean indicating whether this job can operate on it.
 * @param {Boolean} exists Existence to test.
 * @returns {Boolean} whether this job can operate on the resource.
 */
Job.prototype.canHandleExistence = function(exists) {
  if (this.resourceMustExist() && !exists) {
    return false;
  }

  if (this.resourceMustNotExist() && exists) {
    return false;
  }

  return true;
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
  }

  // Verify this job can still execute before running it

  this._resource.exists(function(exists) {
    if (!self.canHandleExistence(exists)) {
      self.emit('error', self._resource.getExistenceError(exists));
      return;
    }

    // The first argument is the resource, then passed args, then callback
    self.emit('start');
    var fnargs = [self._resource].concat(self.args, onComplete);
    self.run.apply(self, fnargs);
  });
};


/**
 * The run method should be provided by the implementation, and carries out the
 * actual work done by the job on its resource.
 */
Job.prototype.run = function() {};


exports.Job = Job;
exports.JobOptions = JobOptions;
