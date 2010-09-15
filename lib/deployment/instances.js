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

var path = require('path');

var sprintf = require('extern/sprintf').sprintf;
var async = require('extern/async');

var config = require('util/config');
var fsutil = require('util/fs');
var misc = require('util/misc');

/*
 * Return an array of available instances for the given bundle.
 *
 * @param {String} bundle_name Bundle name as returned by the get_valid_bundle_name function
 * @param {String} bundle_version Bundle version string or 'all' to retrieve instances for all the
 *                                bundle versions
 * @param [Function] callback Callback which is called with a possible error as the first argument and an array of available instances
 *                            sorted by instance number as the second one (each item is a tuple of instance name and
 *                            instance number)
 *
 */
exports.get_available_instances = function(bundle_name, bundle_version, callback)
{
  var applications_path = path.join(config.get().data_root, config.get().app_dir);
  var instance_application_path = path.join(applications_path, bundle_name);

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

      var sorted = results.sort(function(a, b) { return a[1] - b[1]; });

      callback(null, sorted);
    });
  });
};
