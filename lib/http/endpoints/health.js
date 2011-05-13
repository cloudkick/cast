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

var async = require('async');

var http = require('util/http');
var health = require('services/health').health;
var route = require('services/http').route;

function listAllChecks(req, res) {
  return http.returnJson(res, 200, health.getChecksArray());
}

function listScheduledChecks(req, res) {
  async.filter(health.getChecksArray(), function(check, callback) {
    if (!check.isScheduled) {
      callback(false);
      return;
    }

    callback(true);
    return;
  },

  function(results) {
    return http.returnJson(res, 200, results);
  });
}

function checkDetails(req, res, checkId) {
  if (!health._checkExists(checkId)) {
    return http.returnError(res, 404, 'Invalid check id');
  }

  http.returnJson(res, 200, health.activeChecks[checkId]);
}

var urls = route([
  ['GET /scheduled/$', '1.0', listScheduledChecks],
  ['GET /(.+)/details/$', '1.0', checkDetails],
  ['GET /$', '1.0', listAllChecks]
]);

exports.urls = urls;
