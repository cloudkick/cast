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

var async = require('async');

var deployment = require('deployment');
var http = require('util/http');
var route = require('services/http').route;

var INSTANCE_NAME_RE = /^[a-zA-Z0-9_\-]+$/;

/**
 * Given an Instance object, generate an object in a format appropriate for
 * returning via the JSON api.
 *
 * @param {Instance} instance The instance to format.
 * @param {Function} callback A callback taking (err, data).
 */
var formatInstance = function(instance, callback) {
  var bundleVersion, bundleName;

  // Look up the name and version of each instance
  async.parallel([
    function(callback) {
      instance.getBundleName(function(err, name) {
        bundleName = name;
        callback(err);
        return;
      });
    },

    function(callback) {
      instance.getBundleVersion(function(version) {
        bundleVersion = version;
        callback();
        return;
      });
    }
  ],

  function(err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, {
      'name': instance.name,
      'bundle_name': bundleName,
      'bundle_version': bundleVersion
    });
    return;
  });
};

var listInstances = function(req, res) {
  deployment.getInstanceList(function(err, instances) {
    if (err) {
      return http.returnError(res, 500, err.message);
    }

    // Format each instance
    async.map(instances, formatInstance, function(err, instanceList) {
      if (err) {
        return http.returnError(res, 500, err.message);
      }

      // Sort by name
      instanceList.sort(function(a, b) {
        return (b.name < a.name);
      });

      http.returnJson(res, 200, instanceList);
    });
  });
};

var getInstance = function(req, res, instanceName) {
  deployment.getInstance(instanceName, function(err, instance) {
    if (err) {
      return http.returnError(res, 404, 'No such instance');
    }
    formatInstance(instance, function(err, instanceData) {
      if (err) {
        return http.returnError(res, 500, err.message);
      }
      http.returnJson(res, 200, instanceData);
    });
  });
};

var createInstance = function(req, res, instanceName) {
  var requiredParams = ['bundle_name', 'bundle_version'];

  http.getParams(requiredParams, req, function(err, params) {
    if (err) {
      return http.returnError(res, 400, err.message);
    }

    var bundleName = params.bundle_name;
    var bundleVersion = params.bundle_version;

    deployment.createInstance(instanceName, bundleName, bundleVersion, function(err) {
      if (err) {
        http.returnError(res, 500, err.message);
      }
      else {
        http.returnJson(res, 200, {
          'result': 'success'
        });
      }
    });
  });
};

var destroyInstance = function(req, res, instanceName) {
  deployment.getInstance(instanceName, function(err, instance) {
    if (err) {
      return http.returnError(res, 404, 'No such instance');
    }
    instance.destroy(function() {
      http.returnJson(res, 200, {
        'result': 'success'
      });
    });
  });
};

var urls = route([
  ['GET /$', '1.0', listInstances],
  ['GET /(.+)/$', '1.0', getInstance],
  ['PUT /(.+)/$', '1.0', createInstance],
  ['DELETE /(.+)/$', '1.0', destroyInstance]
]);

exports.urls = urls;
