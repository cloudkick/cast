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
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var config = require('util/config');
var flowctrl = require('util/flow_control');
var fsutil = require('util/fs');
var misc = require('util/misc');
var service_management = require('service_management');

/*
 * Return an array of available instances for the given bundle.
 *
 * @param {String} bundle_name Bundle name as returned by the get_valid_bundle_name function
 * @param {String} bundle_version Bundle version string or 'all' to retrieve instances for all the
 *                                bundle versions
 * @param {Function} callback Callback which is called with a possible error as the first
 *                            argument and an array of available instances sorted by instance
 *                            number as the second one (each item is a tuple of instance
 *                            name and instance number)
 */
exports.get_available_instances = function(bundle_name, bundle_version, callback)
{
  var sorted, match_regex;
  var instance_application_path = path.join(config.get().app_dir, bundle_name);

  if (bundle_version === 'all') {
    match_regex = /.*?-[0-9]+/;
  }
  else {
    match_regex = sprintf('.*?@%s-[0-9]+', misc.escape_regexp_string(bundle_version));
  }

  fsutil.get_matching_files(instance_application_path, match_regex, false, function(error, files) {
    if (error) {
      return callback(error);
    }

    async.map(files, function(file, callback) {
      var splitted = file.split('-');

      callback(null, [splitted[0], parseInt(splitted[1], 10)]);
    },

    function(error, results) {
      if (error) {
        return callback(error);
      }

      results.sort(function(a, b) {
        if (a[1] === b[1]) {
          return (a[0].localeCompare(b[0]) < 0) ? -1 : 1;
        }
        else {
          return a[1] < b[1] ? -1 : 1;
        }
      });

      callback(null, results);
    });
  });
};

/*
 * This function cleans up everything related to a specific instance and should only be called
 * if the instance creation fails.
 *
 * @param {String} instance_name Instance name as returned by misc.get_valid_instance_name function
 * @param {string} instance_path Instance path
 * @param {string} instance_data_path Instance data path
 * @param {Function} callback Callback which is called when the cleanup process has finished
 */
exports.cleanup = function(instance_name, instance_path, instance_data_path, callback) {
  var manager = service_management.get_default_manager().get_manager();
  var ops = [
    async.apply(flowctrl.call_ignoring_error, fsutil.rmtree, null, instance_path),
    async.apply(flowctrl.call_ignoring_error, fsutil.rmtree, null, instance_data_path)
  ];

  manager.get_service(instance_name, function (err, service) {
    if (!err) {
      ops.push(async.apply(flowctrl.call_ignoring_error, service.destroy, service));
    }

    async.parallel(ops,

    function(err) {
      callback();
    });
  });
};

/**
 * Check if an instance exists (a.k.a. instance application directory exists).
 *
 * @param {String} bundle_name_full Bundle name as returned by the get_full_bundle_name function.
 * @param {int} instance_number Instance number.
 * @param {Function} callback Callback which is called a with possible error as the first argument and true
 *                            as the second one if the instance exists, false otherwise.
 */
exports.instance_exists = function(bundle_name_full, instance_number, callback) {
  var instance_path;

  try {
    instance_path = misc.get_instance_name_and_path(bundle_name_full, instance_number)[1];
  }
  catch (err) {
    callback(err);
    return;
  }

  path.exists(instance_path, function(exists) {
    callback(null,exists);
  });
};
