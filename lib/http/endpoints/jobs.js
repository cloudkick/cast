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


var control = require('control');
var castHttp = require('util/http');


function listJobs(req, res) {
  control.jobs.listJobs(function(err, jobs) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      castHttp.returnSwiz(res, jobs);
    }
  });
}


function getJob(req, res) {
  control.jobs.getJob(req.params.id, function(err, job) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      castHttp.returnSwiz(res, job);
    }
  });
}


function waitJob(req, res) {
  control.jobs.getJob(req.params.id, function(err, job) {
    if (err) {
      castHttp.returnError(res, err);
    } else {
      castHttp.returnCompletedJob(res, job);
    }
  });
}


function register(app, apiVersion) {
  app.get('/', listJobs);
  app.get('/:id/', getJob);
  app.get('/:id/wait/', waitJob);
}


exports.register = register;
