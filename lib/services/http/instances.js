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


var deployment = require('deployment');
var http = require('util/http');

var clutch = require('extern/clutch');

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

function create_instance(req, res, bundle_name_full, instance_name) {
  var bundle_name_split = bundle_name_full.split('@');
  var bundle_name = bundle_name_split[0];
  var bundle_version = bundle_name_split[1];

  deployment.create_instance(instance_name, bundle_name, bundle_version, function(error) {
    if (error) {
      http.return_error(res, 500, error.message);
    }
    else {
      http.return_json(res, 200, {
        'result': 'success'
      });
    }
  });
}

exports.urls = clutch.route([
  ['POST /(.+)/(.+)/$', create_instance],
]);
