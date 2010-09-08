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

var CheckStatus = {
  SUCCESS: 0,
  ERROR: 1,
  UNKNOWN: 2
};

var MAX_RESULTS = 5;
var available_checks = [['http', 'HTTPCheck'], ['tcp', 'TCPCheck']];

/**
 * A class which stores a single check result.
 *
 * @param {CheckStatus} status The check status
 * @param {String} code The check details
 *
 * @constructor
 */
function CheckResult(status, details) {
  this.date = new Date();

  this.status = status || CheckStatus.UNKNOWN;
  this.details = details || '';
}

/**
 * Base check class.
 * All the check classes should inherit from it and add their own implementation for the run method.
 *
 * @param {String} name The check name
 * @param {Array} required_arguments Array of the required arguments
 * @param {Array} optional_arguments Array of the optional arguments
*  @param {Object} default_values Default values for the optional arguments
 * @param {Object} check_arguments Provided check arguments

 * @constructor
 */
function Check(name, required_arguments, optional_arguments, default_values, check_arguments) {
  this.name = name;
  this.check_arguments = check_arguments || null;

  this.result_history = [];
  this.last_run_date = null;

  if (this.check_arguments) {
    this.verify_arguments(required_arguments, this.check_arguments);
    this.check_arguments = this.format_arguments(required_arguments, optional_arguments, default_values, this.check_arguments);
  }
}

/**
 * Verifies that all the required arguments are provided.
 * If some of the required arguments is not provided an exception is thrown.
 *
 * @param {Array} required_arguments Array of the required arguments
 * @param {Object} check_arguments Check arguments
 */
Check.prototype.verify_arguments = function(required_arguments, check_arguments) {

  missing_arguments = [];
  required_arguments.forEach(function(value, index) {
    if (!check_arguments.hasOwnProperty(value)) {
      missing_arguments.push(value);
    }
  });

  if (missing_arguments.length) {
    throw new Error('Missing required check argument(s): ' + missing_arguments.join(', '));
  }
};

/**
 * Return a new arguments object which only contains the valid arguments and all the
 * optional arguments replaced with the default values.
 *
 * @param {Array} required_arguments Array of the required arguments
 * @param {Array} required_arguments Array of the optional arguments
 * @param {Object} default_values Default values for the optional arguments
 *
 * @return arguments object
 */
Check.prototype.format_arguments = function(required_arguments, optional_arguments, default_values, check_arguments) {
  var i;
  var item;
  var formatted_arguments = {};

  for (i = 0; i < required_arguments.length; i++) {
    item = required_arguments[i];
    formatted_arguments[item] = check_arguments[item];
  }

  for (i = 0; i < optional_arguments.length; i++) {
    item = optional_arguments[i];

    if (check_arguments.hasOwnProperty(item)) {
      formatted_arguments[item] = check_arguments[item];
    }
    else {
      formatted_arguments[item] = default_values[item];
    }
  }

  return formatted_arguments;
};

Check.prototype.run = function(callback) {
  throw new Error('Not implemented');
};

/**
 * Add a result to the result cache and (if provided) fire the callback.
 *
 * @param {CheckResult} result Check result object.
 * @param {Function} callback An optional callback which takes the CheckResult object
 *                            as it's only argument
 */
Check.prototype.add_result = function (result, callback) {
  if (this.result_history.length >= MAX_RESULTS) {
    this.result_history.pop();
  }

  this.result_history.unshift(result);
  this.last_run_date = result.date;

  if (callback) {
    callback(result);
  }
};

/**
 * Return the last check result.
 */
Check.prototype.get_last_result = function() {
  return this.get_result_at_index(0);
};

/**
 * Clear the check result history.
 */
Check.prototype.clear_result_history = function() {
  this.result_history = [];
};

/**
 * Return the check result located at the specified index.
 * If the provided index is invalid, exception is thrown.
 *
 * @param {Integer} result_index Index of the check result (the most recent result is located on the
 * first place - index 0)
 * @param {Function} callback Optional callback which is fired after adding the result.
 *
 * @return CheckResult object on success, null otherwise.
 */
Check.prototype.get_result_at_index = function(result_index) {
  var index = result_index || 0;

  if (!this.result_history.length) {
    return null;
  }

  if ((index < 0) || (index > this.result_history.length)) {
    throw new Error('Invalid result index specified.');
  }

  result = this.result_history[index];
  return result;
};

exports.Check = Check;
exports.CheckStatus = CheckStatus;
exports.CheckResult = CheckResult;

exports.available_checks = available_checks;
