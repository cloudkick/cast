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


var querystring = require('querystring');

var deployment = require('deployment');
var http = require('util/http');

var clutch = require('extern/clutch');

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

function create_instance(req, res, instance_name) {
  var required_params = ['bundle_name', 'bundle_version'];

  http.get_params(required_params, req, function(err, params) {
    if (err) {
      return http.return_error(res, 400, err.message);
    }

    var bundle_name = params.bundle_name;
    var bundle_version = params.bundle_version;

    deployment.create_instance(instance_name, bundle_name, bundle_version, function(err) {
      if (err) {
        http.return_error(res, 500, err.message);
      }
      else {
        http.return_json(res, 200, {
          'result': 'success'
        });
      }
    });
  });
}

function destroy_instance(req, res, instance_name) {
  deployment.get_instance(function(err, instance) {
    if (err) {
      return http.return_error(res, 404, 'No such instance');
    }
    instance.destroy(function() {
      http.return_json(res, 200, {
        'result': 'success'
      });
    });
  });
}

exports.urls = clutch.route([
  ['PUT /(.+)/$', create_instance],
  ['DELETE /(.+)/$', destroy_instance]
]);
