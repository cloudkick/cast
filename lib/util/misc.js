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

/**
 * @fileOverview Short utility functions that otherwise wouldn't have a home.
 */

var fs = require('fs');
var os = require('os');
var path = require('path');
var util = require('util');
var constants = require('constants');

var async = require('async');
var sprintf = require('sprintf').sprintf;

/**
 * Error class which automatically applys sprintf on the error message and the
 * arguments passed to the function.
 * @constructor
 *
 * {String} message Error message.
 */
function Errorf(message) {
  this.name = 'Error';
  this.message = sprintf.apply(message, arguments) || '';

  Error.captureStackTrace(this, arguments.callee);
}

Errorf.prototype.toString = function() {
  return sprintf('%s: %s', this.name, this.message);
};

/**
 * Represent an error which has happen on the server where the Cast agent is
 * running.
 * @constructor
 *
 * {String} message Error message.
 */
function ServerError(message) {
  this.name = 'ServerError';
  this.message = sprintf.apply(message, arguments) || '';
}

util.inherits(ServerError, Error);

/**
 * Very simple object merging.
 * Merges two objects together, returning a new object containing a
 * superset of all attributes.  Attributes in b are prefered if both
 * objects have identical keys.
 *
 * @param {Object} a Object to merge.
 * @param {Object} b Object to merge, wins on conflict.
 * @return {Object} The merged object.
 */
function merge(a, b) {
  var c = {};
  var attrname;
  for (attrname in a) {
    if (a.hasOwnProperty(attrname)) {
      c[attrname] = a[attrname];
    }
  }
  for (attrname in b) {
    if (b.hasOwnProperty(attrname)) {
      c[attrname] = b[attrname];
    }
  }
  return c;
}

/**
 * Expands a path with a ~user or ~ to an absolute path.
 * Note: This currently depends on the HOME enviroment variable,
 * because there are no bindings to getpwnam.
 *
 * @param {String} pstr Original path.
 * @return {string} Expanded path.
 */
function expanduser(pstr) {
  if (pstr.indexOf('~') !== 0) {
    return pstr;
  }

  var splitter = pstr.indexOf('/');
  var user = '';
  if (splitter === -1) {
    user = pstr.substr(1);
    pstr = '/';
  }
  else {
    user = pstr.substring(1, splitter);
    pstr = pstr.substr(splitter + 1);
  }

  if (user.length !== 0) {
    /* TODO: need bindings to getpwnam to make this work for the non-current */
    throw new Error("no bindings to getpwnam, so you can't do get info for user: " + user);
  }

  if (process.env.HOME === undefined) {
    throw new Error('no bindings to getpwnam, and env[HOME] was undefined');
  }

  return path.join(process.env.HOME, pstr);
}

/**
 * Trim leading and trailing whitespace from a string.
 *
 * @param {String} text Original String.
 * @return {string} String with trimmed whitespace.
 */
function trim(text) {
  return (text || '').replace(/^\s+|\s+$/g, '');
}

/**
 * Replace space with underscores and remove any non a-zA-z0-9_- characters.
 *
 * @param {String} text Original string.
 * @return {String} new string.
 */
function getValidBundleName(text) {
  return (text || '').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_\-]+/, '').toLowerCase();
}

/**
 * Check if the provided string is a valid cast version string.
 *
 * @param {String} version Version string.
 * @return {Boolean} true if the provided version is valid, false otherwise.
 */
function isValidBundleVersion(version) {
  return version.indexOf('@') === -1;
}

/**
 * Return a full bundle name.
 *
 * @param {String} bundleName Bundle name which is returned by the getValidBundleName function.
 * @param {String} bundleVersion Bundle version.
 * @return {String} Full bundle name.
 */
function getFullBundleName(bundleName, bundleVersion) {
  return sprintf('%s@%s', bundleName, bundleVersion);
}

/**
 * Return valid instance name.
 *
 * @param {String} applicationName Application name.
 * @return {String} Instance name.
 */
function getInstanceName(applicationName) {
  var name = applicationName.replace(/\s+/g, '_').toLowerCase();
  return name;
}

/*
 * Extract bundle name from the full bundle name which includes the version number.
 *
 * @param {String} fullBundleName Bundle name as returned by the getFullBundleName function.
 * @return {String} Bundle name.
 */
function getBundleName(fullBundleName) {
  var splitted, bundleName;

  splitted = fullBundleName.split('@');

  if (splitted.length !== 2) {
    throw new Errorf('Could not extract bundle name from the provided string: %s', fullBundleName);
  }

  bundleName = splitted[0];
  return bundleName;
}

/*
 * Return a valid instance name.
 *
 * @param {String} fullBundleName Bundle name which is returned by the getFullBundleName function.
 * @param {Number} instanceNumber Instance number.
 * @return {String} Instance name.
 */
function getValidInstanceName(fullBundleName, instanceNumber) {
  return sprintf('%s-%s', fullBundleName, instanceNumber);
}

/**
 * Generate a random string of upper lower case letters and decimal digits.
 *
 * @param {Number} len  The length of the string to return;.
 * @return {String} Random string.
 */
function randstr(len) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  function getRandomInt(min, max)
  {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  var r = [];
  for (var x = 0; x < len; x++) {
    r.push(chars[getRandomInt(0, chars.length)]);
  }

  return r.join('');
}

/**
 * Same as the inArray but return the index instead of true if the item is found in the array.
 *
 * @param  {Object} needle Item to search for.
 * @param  {Array} haystack Array to search in for the item.
 * @param  {Boolean} strict true to use the strict comparison (order of the item in the array matters).
 * @param {Function} compareFunction Optional compare function which is called with the current array
 *                                    item as the first argument and the needle as the second one and
 *                                    should return true if the current item matches the needle.
 *
 * @return {Number|Boolean} item index if the needle is located in the array, false otherwise.
 */
function arrayFind(needle, haystack, strict, compareFunction) {
  var compare = compareFunction || null;

  function compareStrict(item1, item2) {
      return (item1 === item2);
  }

  function compareLoose(item1, item2) {
      return (item1 === item2);
  }

  if (!compareFunction) {
    if (strict === true) {
      compare = compareStrict;
    }
    else {
      compare = compareLoose;
    }
  }

  for (var i = 0; i < haystack.length; i++) {
    if (compare(haystack[i], needle)) {
      return i;
    }
  }

  return false;
}

/**
 * Check if a haystack array contains a needle.
 *
 * @param  {Object} needle Object to search for.
 * @param  {Array} haystack Array to search.
 * @param  {Boolean} strict true to use the strict comparison.
 * @param {Function} compareFunction Optional compare function which is called with the current array
 *                                    item as the first argument and the needle as the second one and
 *                                    should return true if the current item matches the needle.
 *
 * @return {Boolean} true if the needle is located in the array, false otherwise.
 */
function inArray(needle, haystack, strict, compareFunction) {
  return (arrayFind(needle, haystack, strict, compareFunction) !== false);
}

/**
 * Checks if two arrays contain the same elements.
 *
 * @param  {Array} array1 First array.
 * @param  {Array} array2 Second array.
 * @param  {Boolean} strict true to use the strict comparison (order of the item in the array matters).
 *
 * @return {Boolean} true if the arrays contain same items, false otherwise.
 */
function arraysContainsSameElements(array1, array2, strict) {
  var compare;

  if (array1.length !== array2.length) {
    return false;
  }

  function compareStrict(index) {
    return (array1[index] === array2[index]);
  }

  function compareLoose(index) {
    return (inArray(array1[index], array2));
  }

  if (strict) {
    compare = compareStrict;
  }
  else {
    compare = compareLoose;
  }

  for (var i = 0; i < array1.length; i++) {
    if (!compare(i)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if the array1 is subset of the array2.
 *
 * @param  {Array} array1 Smaller array (needle).
 * @param  {Array} array2 Superset array.
 * @param  {Boolean} strict true if the array1 must be a proper subset of array2.
 *
 * @return {Boolean} true if the array1 if subset of the array2, false otherwise.
 */
function arrayIsSubsetOf(array1, array2, strict) {
  if (array1.length > array2.length) {
    return false;
  }

  if (strict) {
    if (array1.length === array2.length) {
      return false;
    }
  }

  for (var i = 0; i < array1.length; i++) {
    if (!inArray(array1[i], array2)) {
      return false;
    }
  }

  return true;
}

/**
 * Return list of items which are in array1 but not in array2.
 *
 * @param  {Array} array1 Array to find items in.
 * @param  {Array} array2 Array to test against.
 *
 * @return {Array} List of items which are in array1 but not in array2.
 */
function arrayDifference(array1, array2) {
  var difference = [];

  for (var i = 0; i < array1.length; i++) {
    if (!(inArray(array1[i], array2))) {
      difference.push(array1[i]);
    }
  }

  return difference;
}

/**
 * Remove repeated paths.
 *
 * @param {Array} paths Array of relative or absolute paths.
 * @return {Array} Array containing filtered paths sorted in alphabetical order.
 */
function filterRepeatedPaths(paths) {
  var path;
  var pathsFiltered = [];

  function compareFunction(item, needle) {
    if (item.charAt(item.length - 1) === '/' && needle.indexOf(item) !== -1) {
      return true;
    }
    else if (item === needle) {
      return true;
    }

    return false;
  }

  paths.sort();
  var pathsCount = paths.length;
  for (var i = 0; i < pathsCount; i++) {
    path = paths[i];

    if (!inArray(path, pathsFiltered, null, compareFunction)) {
      pathsFiltered.push(path);
    }
  }

  return pathsFiltered;
}

/**
 * Escape characters in a string which Javascript RegExp object considers as special.
 *
 * @param {String} string Input string.
 * @return {String} String with all the special characters escaped.
 */

function escapeRegexpString(string) {
  var regexp = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

  return string.replace(regexp, '\\$&');
}

/**
 * Return unix timestamp
 *
 * @param  {Date} date Date object to convert to Unix timestamp. If no date is
                       provided, current time is used.
 * @return {Number} Number of seconds passed from Unix epoch.
 */
function getUnixTimestamp(date) {
  var dateToFormat = date || new Date();

  return Math.round(dateToFormat / 1000);
}

function getOs() {
  var type = os.type();

  if (type.toLowerCase() === 'freebsd') {
    return 'freebsd';
  }

  return null;
}

/**
 * Get an exported member from the provided module.
 *
 * @param {String} modulePath Path to the module file.
 * @param {String} member Member name.
 * @param {Function} callback Callback called with (err, member)
 */
function getExportedMember(modulePath, member, callback) {
  var exported, value;

  if (modulePath.charAt(0) !== '/') {
    // Assume cwd
    modulePath = path.join(process.cwd(), modulePath);
  }

  try {
    exported = require(modulePath);
  }
  catch (err) {
    // No need for this to be async atm, but we might have a need for it to be
    // async later on.
    callback(new Errorf('Failed to load module "%s": %s', modulePath, err));
    return;
  }

  value = (exported.hasOwnProperty(member)) ? exported[member] : null;
  callback(null, value);
}

/**
 * Discover all the files in some directory which export member with a defined
 * name.
 *
 * @param {String} basePath Base directory which must exist.
 * @param {String} directory Directory where to look for the files. This
 * directory is joined with a basePath (path.join(basePath, directory)).
 * @param {String} memberName Name of the member which must be exported.
 * @param {Function} callback Callback called with (err, members). Members is an
 * object where the key is a file name with the extension and the value is
 * exported member in that file.
 */
function discoverFilesWithExportedMember(basePath, directory, memberName,
                                         callback) {
  var result = {};
  var finalPath = path.join(basePath, directory);

  async.waterfall([
    // Base path must exist
    async.apply(fs.stat, basePath),

    function readDirectory(_, callback) {
      fs.readdir(finalPath, function(err, files) {
        // Missing final path is not fatal
        if (err && (err.errno === constants.ENOENT)) {
          err = null;
          files = [];
        }

        callback(err, files);
      });
    },

    function discoverExportedMembers(files, callback) {
      async.forEach(files, function(file, callback) {
        var name = file.replace(/\.js$/, '');
        var modulePath = path.join(finalPath, file);

        getExportedMember(modulePath, memberName, function onEnd(err, value) {
          if (err) {
            callback();
            return;
          }

          result[name] = value;
          callback();
        });
      }, callback);
    }
  ],

  function(err) {
    callback(err, result);
  });
}

/**
 * Return a new object with only the values which are not located in the values
 * array.
 *
 * @param {Object} object Object on which to perform filtering.
 * @param {Array} values Values which should be filtered out.
 */
function filterObjectValues(object, values) {
  var newObject = {};

  for (var key in object) {
    if (object.hasOwnProperty(key) && values.indexOf(object[key]) === -1) {
      newObject[key] = object[key];
    }
  }

  return newObject;
}

function filterList(list, key, value) {
  var result = list.filter(function(member) {
    return member[key] === value;
  });

  return result;
}

exports.Errorf = Errorf;
exports.ServerError = ServerError;

exports.merge = merge;
exports.expanduser = expanduser;
exports.trim = trim;
exports.getInstanceName = getInstanceName;
exports.getValidBundleName = getValidBundleName;
exports.isValidBundleVersion = isValidBundleVersion;
exports.getFullBundleName = getFullBundleName;
exports.getBundleName = getBundleName;
exports.getValidInstanceName = getValidInstanceName;
exports.randstr = randstr;
exports.inArray = inArray;
exports.arrayFind = arrayFind;
exports.arraysContainsSameElements = arraysContainsSameElements;
exports.arrayIsSubsetOf = arrayIsSubsetOf;
exports.arrayDifference = arrayDifference;
exports.filterRepeatedPaths = filterRepeatedPaths;
exports.escapeRegexpString = escapeRegexpString;
exports.getUnixTimestamp = getUnixTimestamp;
exports.getOs = getOs;
exports.getExportedMember = getExportedMember;
exports.discoverFilesWithExportedMember = discoverFilesWithExportedMember;
exports.filterObjectValues = filterObjectValues;
exports.filterList = filterList;
