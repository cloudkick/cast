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

var misc = require('util/misc');

var norris = require('norris');

/*
 * Checks if the applications meets the requirements (based on norris facts).
 *
 * @param {Function} callback Callback which is called with a possible error as the first argument and true as the
 *                            second one if the requirements are met.
 */
exports.meets_requirements = function(requirements, callback) {
  norris.get(function(facts) {

    if (Object.keys(facts).length === 0) {
      callback(new Error('No facts available'));
    }

    async.forEach(Object.keys(requirements), function(key, callback) {
      var requirement, value, comparator, error_message, comparator_function;

      if (!misc.in_array(key, Object.keys(facts))) {
        callback(new Error('Fact for ' + key + ' is not available.'));
        return;
      }

      requirement = requirements[key];
      value = requirement[0];
      comparator_function = requirement[1];
      error_message = requirement[2];

      if (!comparator_function(value, facts[key])) {
        callback(new Error(error_message));
        return;
      }

      callback();
    },

    function(err) {
      if (err) {
        callback(new Error('Requirements not met: ' + err.message));
        return;
      }

      callback(null, true);
    });
  });
};

/* General requirements comparator functions */

/*
 * Return true if ver_b <= ver_a, false otherwise.
 *
 * @param {String|Object} ver_a Version string (e.g. 0.1.1) or Object with keys: major, minor, patch
 * @param {String|Object} ver_b Version string (e.g. 0.1.1) or Object with keys: major, minor, patch
 *
 */
exports.compare_versions = function(ver_a, ver_b) {
  function get_version_as_object(version) {
    var splitted;

    if (typeof(version) === 'string') {
      splitted = version.split('.');

      version = {};
      version.major = splitted[0];
      version.minor = splitted[1];
      version.patch = splitted[2];
    }

    return version;
  }

  ver_a = get_version_as_object(ver_a);
  ver_b = get_version_as_object(ver_b);

  if (ver_b.major == ver_a.major) {
    if (ver_b.minor == ver_a.minor) {
      if (ver_b.patch < ver_a.patch) {
        return false;
      }
      else {
        return true;
      }
    }
    else if (ver_b.minor < ver_a.minor) {
      return false;
    }
    else {
      return true;
    }
  }
  else if (ver_b.major < ver_a.major) {
    return false;
  }
  else {
    return true;
  }
};
