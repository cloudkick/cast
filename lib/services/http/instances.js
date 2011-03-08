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

var async = require('extern/async');

var deployment = require('deployment');
var http = require('util/http');
var route = require('services/http').route;

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

/**
 * Given an Instance object, generate an object in a format appropriate for
 * returning via the JSON api.
 *
 * @param {Instance} instance The instance to format
 * @param {Function} callback A callback taking (err, data)
 */
function format_instance(instance, callback) {
  var bundle_version, bundle_name;

  // Look up the name and version of each instance
  async.parallel([
    function(callback) {
      instance.get_bundle_name(function(err, name) {
        bundle_name = name;
        return callback(err);
      });
    },

    function(callback) {
      instance.get_bundle_version(function(version) {
        bundle_version = version;
        return callback();
      });
    }
  ],
  function(err) {
    if (err) {
      return callback(err);
    }
    return callback(null, {
      name: instance.name,
      bundle_name: bundle_name,
      bundle_version: bundle_version
    });
  });
}

function list_instances(req, res) {
  deployment.get_instance_list(function(err, instances) {
    if (err) {
      return http.return_error(res, 500, err.message);
    }

    // Format each instance
    async.map(instances, format_instance, function(err, instance_list) {
      if (err) {
        return http.return_error(res, 500, err.message);
      }

      // Sort by name
      instance_list.sort(function(a, b) {
        return (b.name < a.name);
      });

      http.return_json(res, 200, instance_list);
    });
  });
}

function get_instance(req, res, instance_name) {
  deployment.get_instance(instance_name, function(err, instance) {
    if (err) {
      return http.return_error(res, 404, 'No such instance');
    }
    format_instance(instance, function(err, instance_data) {
      if (err) {
        return http.return_error(res, 500, err.message);
      }
      http.return_json(res, 200, instance_data);
    });
  });
}

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
  deployment.get_instance(instance_name, function(err, instance) {
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

exports.urls = route([
  ['GET /$', '1.0', list_instances],
  ['GET /(.+)/$', '1.0', get_instance],
  ['PUT /(.+)/$', '1.0', create_instance],
  ['DELETE /(.+)/$', '1.0', destroy_instance]
]);
