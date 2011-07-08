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


var util = require('util');
var events = require('events');

var async = require('async');

var jobs = require('jobs');
var agentManagers = require('cast-agent/managers');


// There is no need to get fancy with the serializer definition
agentManagers.registerSerializerDefs({
  'Job': [
    ['id', {src: 'id', type: 'string'}],
    ['cparams', {src: 'cparams', type: 'map<string,string>'}]
  ]
});


// A MockJob fires a sequence of events, with a call to process.nextTick()
// between each.
function MockJob(sequence) {
  var self = this;
  events.EventEmitter.call(this);
  this.id = 'this-is-a-mock-job';
  this.cparams = null;

  function emitEvent(event, callback) {
    process.nextTick(function() {
      self.emit.apply(self, event);
    });
  }

  process.nextTick(function() {
    async.forEachSeries(sequence, emitEvent);
  });
}

util.inherits(MockJob, events.EventEmitter);


MockJob.prototype.getSerializerType = function() {
  return 'Job';
};


// A SuccessfulJob emits a 'ready' event
function SuccessfulJob(cparams) {
  MockJob.call(this, [
    ['ready']
  ]);
  this.cparams = cparams;
}

util.inherits(SuccessfulJob, MockJob);


// A ResourceNotFoundJob emits an 'error' with a NotFoundError object
function ResourceNotFoundJob(type, name) {
  MockJob.call(this, [
    ['error', new jobs.NotFoundError(type, name)]
  ]);
}

util.inherits(ResourceNotFoundJob, MockJob);


// A ResourceExistsJob emits an 'error' with an AlreadyExistsError object
function ResourceExistsJob(type, name) {
  MockJob.call(this, [
    ['error', new jobs.AlreadyExistsError(type, name)]
  ]);
};

util.inherits(ResourceExistsJob, MockJob);


exports.MockJob = MockJob;
exports.SuccessfulJob = SuccessfulJob;
exports.ResourceNotFoundJob = ResourceNotFoundJob;
exports.ResourceExistsJob = ResourceExistsJob;
