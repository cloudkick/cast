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
exports.meetsRequirements = function(requirements, callback) {
  norris.get(function(facts) {

    if (Object.keys(facts).length === 0) {
      callback(new Error('No facts available'));
    }

    async.forEach(Object.keys(requirements), function(key, callback) {
      var requirement, value, comparator, errorMessage, comparatorFunction;

      if (!misc.inArray(key, Object.keys(facts))) {
        callback(new Error('Fact for ' + key + ' is not available.'));
        return;
      }

      requirement = requirements[key];
      value = requirement[0];
      comparatorFunction = requirement[1];
      errorMessage = requirement[2];

      if (!comparatorFunction(value, facts[key])) {
        callback(new Error(errorMessage));
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
 * Return true if verB >= verA, false otherwise.
 *
 * @param {String|Object} verA Version string (e.g. 0.1.1) or Object with keys: major, minor, patch
 * @param {String|Object} verB Version string (e.g. 0.1.1) or Object with keys: major, minor, patch
 *
 */
exports.compareVersions = function(verA, verB) {
  function getVersionAsObject(version) {
    var splitted;

    if (typeof(version) === 'string') {
      splitted = version.split('.');

      version = {};
      version.major = parseInt(splitted[0], 10);
      version.minor = parseInt(splitted[1], 10);
      version.patch = parseInt(splitted[2], 10);
    }

    return version;
  }

  verA = getVersionAsObject(verA);
  verB = getVersionAsObject(verB);

  if (verB.major === verA.major) {
    if (verB.minor === verA.minor) {
      if (verB.patch < verA.patch) {
        return false;
      }
      else {
        return true;
      }
    }
    else if (verB.minor < verA.minor) {
      return false;
    }
    else {
      return true;
    }
  }
  else if (verB.major < verA.major) {
    return false;
  }
  else {
    return true;
  }
};

/*
 * Return true if the fact is defined (not null, false or undefined), false otherwise.
 *
 * @param {Object} expected Expected value (in this case we don't care about this variable so it is ignored)
 * @param {String|Object} value The value.
 *
 */
exports.isDefined = function(expected, value) {
  if (value === null || value === undefined || value === false) {
    return false;
  }

  return true;
};
