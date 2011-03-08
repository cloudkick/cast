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

var async = require('extern/async');
var http = require('util/http');
var clutch = require('extern/clutch');

var health = require('services/health').health;

function list_all_checks(req, res) {
  return http.return_json(res, 200, health.get_checks_array());
}

function list_scheduled_checks(req, res) {
  async.filter(health.get_checks_array(), function(check, callback) {
    if (!check.is_scheduled) {
      callback(false);
      return;
    }

    callback(true);
    return;
  },

  function(results) {
    return http.return_json(res, 200, results);
  });
}

function check_details(req, res, check_id) {
  if (!health._check_exists(check_id)) {
    return http.return_error(res, 404, 'Invalid check id');
  }

  http.return_json(res, 200, health.active_checks[check_id]);
}

exports.urls = clutch.route([
  ['GET /scheduled/$', list_scheduled_checks],
  ['GET /(.+)/details/$', check_details],
  ['GET /$', list_all_checks]
]);
