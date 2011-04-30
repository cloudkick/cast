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

var Errorf = require('util/misc').Errof;


/**
 * A resource that is backed by a directory.
 * @param {String} name The name of this resource's directory.
 * @constructor
 */
function DirectoryResource(name) {
  this.name = name;
  this.parentDir = undefined;
  this._jobs = [];
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
 * If no job is currently being processed, start the one at the head of the
 * queue.
 */
DirectoryResource.prototype._cycle = function() {
  if (!this._running && this._jobs.length > 0) {
    this._running = this._jobs.shift();
    this._running.start();
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


exports.ResourceManager = ResourceManager;
exports.DirectoryResource = DirectoryResource;
