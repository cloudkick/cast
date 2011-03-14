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
var availableChecks = [['http', 'HTTPCheck'], ['tcp', 'TCPCheck']];

/**
 * A class which stores a single check result.
 *
 * @param {CheckStatus} status The check status.
 * @param {String} details The check details.
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
 * @param {String} name The check name.
 * @param {Array} requiredArguments Array of the required arguments.
 * @param {Array} optionalArguments Array of the optional arguments.
*  @param {Object} defaultValues Default values for the optional arguments.
 * @param {Object} checkArguments Provided check arguments.

 * @constructor
 */
function Check(name, requiredArguments, optionalArguments, defaultValues, checkArguments) {
  this.name = name;
  this.checkArguments = checkArguments || null;

  this.resultHistory = [];
  this.lastRunDate = null;

  if (this.checkArguments) {
    this.verifyArguments(requiredArguments, this.checkArguments);
    this.checkArguments = this.formatArguments(requiredArguments,
                                                 optionalArguments,
                                                 defaultValues,
                                                 this.checkArguments);
  }
}

/**
 * Verifies that all the required arguments are provided.
 * If some of the required arguments is not provided an exception is thrown.
 *
 * @param {Array} requiredArguments Array of the required arguments.
 * @param {Object} checkArguments Check arguments.
 */
Check.prototype.verifyArguments = function(requiredArguments, checkArguments) {
  var missingArguments = [];

  requiredArguments.forEach(function(value, index) {
    if (!checkArguments.hasOwnProperty(value)) {
      missingArguments.push(value);
    }
  });

  if (missingArguments.length) {
    throw new Error('Missing required check argument(s): ' + missingArguments.join(', '));
  }
};

/**
 * Return a new arguments object which only contains the valid arguments and all the
 * optional arguments replaced with the default values.
 *
 * @param {Array} requiredArguments Array of the required arguments.
 * @param {Array} optionalArguments Array of the optional arguments.
 * @param {Object} defaultValues Default values for the optional arguments.
 * @param {Object} checkArguments Check arguments.
 *
 * @return {Object} arguments object.
 */
Check.prototype.formatArguments = function(requiredArguments, optionalArguments, defaultValues, checkArguments) {
  var i;
  var item;
  var formattedArguments = {};

  for (i = 0; i < requiredArguments.length; i++) {
    item = requiredArguments[i];
    formattedArguments[item] = checkArguments[item];
  }

  for (i = 0; i < optionalArguments.length; i++) {
    item = optionalArguments[i];

    if (checkArguments.hasOwnProperty(item)) {
      formattedArguments[item] = checkArguments[item];
    }
    else {
      formattedArguments[item] = defaultValues[item];
    }
  }

  return formattedArguments;
};

Check.prototype.run = function(callback) {
  throw new Error('Not implemented');
};

/**
 * Add a result to the result cache and (if provided) fire the callback.
 *
 * @param {CheckResult} result Check result object.
 * @param {Function} callback An optional callback which takes the CheckResult object
 *                            as it's only argument.
 */
Check.prototype.addResult = function(result, callback) {
  if (this.resultHistory.length >= MAX_RESULTS) {
    this.resultHistory.pop();
  }

  this.resultHistory.unshift(result);
  this.lastRunDate = result.date;

  if (callback) {
    callback(result);
  }
};

/**
 * Return the last check result.
 *
 * @return {?Object} CheckResult object on success, null otherwise.
 */
Check.prototype.getLastResult = function() {
  return this.getResultAtIndex(0);
};

/**
 * Clear the check result history.
 */
Check.prototype.clearResultHistory = function() {
  this.resultHistory = [];
};

/**
 * Return the check result located at the specified index.
 * If the provided index is invalid, exception is thrown.
 *
 * @param {Integer} resultIndex Index of the check result (the most recent result is located on the
 * first place - index 0).
 *
 * @return {?Object} object on success, null otherwise.
 */
Check.prototype.getResultAtIndex = function(resultIndex) {
  var result;
  var index = resultIndex || 0;

  if (!this.resultHistory.length) {
    return null;
  }

  if ((index < 0) || (index > this.resultHistory.length)) {
    throw new Error('Invalid result index specified.');
  }

  result = this.resultHistory[index];
  return result;
};

exports.Check = Check;
exports.CheckStatus = CheckStatus;
exports.CheckResult = CheckResult;

exports.availableChecks = availableChecks;
