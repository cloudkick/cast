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
 * Short utility functions that otherwise wouldn't have a home.
 */

var path = require('path');
var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;
var constants = require('util/constants');
var fs = require('fs');

function Errorf(message) {
  this.name = 'Error';
  this.message = sprintf.apply(message, arguments) || '';

  Error.captureStackTrace(this, arguments.callee);
}

Errorf.prototype.toString = function() {
  return sprintf('%s: %s', this.name, this.message);
};

exports.Errorf = Errorf;

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
exports.merge = function(a, b)
{
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
};

/**
 * Expands a path with a ~user or ~ to an absolute path.
 * Note: This currently depends on the HOME enviroment variable,
 * because there are no bindings to getpwnam.
 *
 * @param {String} pstr Original path.
 * @return {string} Expanded path.
 */
exports.expanduser = function(pstr)
{
  if (pstr.indexOf('~') !== 0) {
    return pstr;
  }

  var splitter = pstr.indexOf('/');
  var user = '';
  if (splitter == -1) {
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
};

/**
 * Trim leading and trailing whitespace from a string.
 *
 * @param {String} text Original String.
 * @return {string} String with trimmed whitespace.
 */
exports.trim = function(text)
{
  return (text || '').replace(/^\s+|\s+$/g, '');
};

/**
 * Replace space with underscores and remove any non a-zA-z0-9_- characters.
 *
 * @param {String} text Original string.
 * @return {String} new string.
 */
exports.get_valid_bundle_name = function(text) {
  return (text || '').replace(/\s/g, '_').replace(/[^a-zA-Z0-9_\-]+/, '').toLowerCase();
};

/**
 * Check if the provided string is a valid cast version string.
 *
 * @param {String} version Version string.
 * @return {Boolean} true if the provided version is valid, false otherwise.
 */
exports.is_valid_bundle_version = function(version) {
  return version.indexOf('@') == -1;
};

/**
 * Return a full bundle name.
 *
 * @param {String} bundle_name Bundle name which is returned by the get_valid_bundle_name function.
 * @param {String} bundle_version Bundle version.
 * @return {String} Full bundle name.
 */
exports.get_full_bundle_name = function(bundle_name, bundle_version) {
  return sprintf('%s@%s', bundle_name, bundle_version);
};


/**
 * Return a valid instance name.
 *
 * @param {String} full_bundle_name Bundle name which is returned by the get_full_bundle_name function.
 * @param {Number} instance_number Instance number.
 * @return {String} Instance name.
 */
exports.get_valid_instance_name = function(full_bundle_name, instance_number) {
  return sprintf('%s-%s', full_bundle_name, instance_number);
};

/**
 * Converts an object to a directory tree, where objects are treated as
 * directories and anything else is dumped to a regular file as a string.
 *
 * @param {String} basedir  The path to the tree's (not-yet-existing) root.
 * @param {Object} template  The object to use as a template.
 * @param {Boolean} ignore_existing If true, function won't return callback with an error when encountering
 *                                  a directory which already exists.
 * @param {Function} cb     Callback, taking a possible error.
 */
exports.template_to_tree = function(basedir, template, ignore_existing, cb) {
  fs.mkdir(basedir, 0700, function(err) {
    if (err) {
      if (!(ignore_existing && err.errno === constants.EEXIST)) {
        return cb(err);
      }
    }

    var actions = [];

    function recurse_action(basedir, key) {
      var curpath = path.join(basedir, key);
      return function(callback) {
        // Recurse on sub-templates
        if (typeof(template[key]) === 'object') {
          exports.template_to_tree(curpath, template[key], ignore_existing, callback);
        }
        // Render anything else to files
        else {
          fs.open(curpath, 'w', 0700, function(err, fd) {
            if (err) {
              callback(err);
            }
            else {
              fs.write(fd, template[key].toString(), null, 'ascii', callback);
            }
          });
        }
      };
    }

    // Build a list of actions to fill in this level of the tree
    for (var key in template) {
      if (template.hasOwnProperty(key)) {
        actions.push(recurse_action(basedir, key));
      }
    }

    // Execute the action sequence
    async.parallel(actions, function(err) {
      cb(err);
    });
  });
};

/**
 * Generate a random string of upper lower case letters and decimal digits.
 *
 * @param {Number} len  The length of the string to return;.
 * @return {String} Random string.
 */
exports.randstr = function(len) {
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
};

/**
 * Check if a haystack array contains a needle.
 *
 * @param  {Object} needle Object to search for.
 * @param  {Array} haystack Array to search.
 * @param  {Boolean} strict true to use the strict comparison.
 * @param {Function} compare_function Optional compare function which is called with the current array
 *                                    item as the first argument and the needle as the second one and
 *                                    should return true if the current item matches the needle.
 *
 * @return {Boolean} true if the needle is located in the array, false otherwise.
 */
exports.in_array = function(needle, haystack, strict, compare_function) {
  return (exports.array_find(needle, haystack, strict, compare_function) !== false);
};

/**
 * Same as the in_array but return the index instead of true if the item is found in the array.
 *
 * @param  {Object} needle Item to search for.
 * @param  {Array} haystack Array to search in for the item.
 * @param  {Boolean} strict true to use the strict comparison (order of the item in the array matters).
 * @param {Function} compare_function Optional compare function which is called with the current array
 *                                    item as the first argument and the needle as the second one and
 *                                    should return true if the current item matches the needle.
 *
 * @return {Number|Boolean} item index if the needle is located in the array, false otherwise.
 */
exports.array_find = function(needle, haystack, strict, compare_function) {
  var compare = compare_function || null;

  function compare_strict(item1, item2) {
      return (item1 === item2);
  }

  function compare_loose(item1, item2) {
      return (item1 === item2);
  }

  if (!compare_function) {
    if (strict === true) {
      compare = compare_strict;
    }
    else {
      compare = compare_loose;
    }
  }

  for (var i = 0; i < haystack.length; i++) {
    if (compare(haystack[i], needle)) {
      return i;
    }
  }

  return false;
};

/**
 * Checks if two arrays contain the same elements.
 *
 * @param  {Array} array1 First array.
 * @param  {Array} array2 Second array.
 * @param  {Boolean} strict true to use the strict comparison (order of the item in the array matters).
 *
 * @return {Boolean} true if the arrays contain same items, false otherwise.
 */
exports.arrays_contains_same_elements = function(array1, array2, strict) {
  var compare;

  if (array1.length !== array2.length) {
    return false;
  }

  function compare_strict(index) {
    return (array1[index] === array2[index]);
  }

  function compare_loose(index) {
    return (exports.in_array(array1[index], array2));
  }

  if (strict) {
    compare = compare_strict;
  }
  else {
    compare = compare_loose;
  }

  for (var i = 0; i < array1.length; i++) {
    if (!compare(i)) {
      return false;
    }
  }

  return true;
};

/**
 * Checks if the array1 is subset of the array2.
 *
 * @param  {Array} array1 Smaller array (needle).
 * @param  {Array} array2 Superset array.
 * @param  {Boolean} strict true if the array1 must be a proper subset of array2.
 *
 * @return {Boolean} true if the array1 if subset of the array2, false otherwise.
 */
exports.array_is_subset_of = function(array1, array2, strict) {
  if (array1.length > array2.length) {
    return false;
  }

  if (strict) {
    if (array1.length === array2.length) {
      return false;
    }
  }

  for (var i = 0; i < array1.length; i++) {
    if (!exports.in_array(array1[i], array2)) {
      return false;
    }
  }

  return true;
};

/**
 * Return list of items which are in array1 but not in array2.
 *
 * @param  {Array} array1 Array to find items in.
 * @param  {Array} array2 Array to test against.
 *
 * @return {Array} List of items which are in array1 but not in array2.
 */
exports.array_difference = function(array1, array2) {
  var difference = [];

  for (var i = 0; i < array1.length; i++) {
    if (!(exports.in_array(array1[i], array2))) {
      difference.push(array1[i]);
    }
  }

  return difference;
};

/**
 * Remove repeated paths.
 *
 * @param {Array} paths Array of relative or absolute paths.
 * @return {Array} Array containing filtered paths sorted in alphabetical order.
 */
exports.filter_repeated_paths = function(paths) {
  var path;
  var paths_filtered = [];

  var compare_function = function(item, needle) {
    if (item.charAt(item.length - 1) === '/' && needle.indexOf(item) !== -1) {
      return true;
    }
    else if (item === needle) {
      return true;
    }

    return false;
  };

  paths.sort();
  var paths_count = paths.length;
  for (var i = 0; i < paths_count; i++) {
    path = paths[i];

    if (!exports.in_array(path, paths_filtered, null, compare_function)) {
      paths_filtered.push(path);
    }
  }

  return paths_filtered;
};

/**
 * Escape characters in a string which Javascript RegExp object considers as special.
 *
 * @param {String} string Input string.
 * @return {String} String with all the special characters escaped.
 */

exports.escape_regexp_string = function(string) {
  var regexp = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

  return string.replace(regexp, '\\$&');
};

/**
 * Left pad the given string to the maximum width provided.
 *
 * @param  {String} str Input string.
 * @param  {Number} width Desired length.
 * @return {String} Left padded string.
 */
exports.lpad = function(str, width) {
    str = String(str);
    var n = width - str.length;

    if (n < 1) {
      return str;

    }

    while (n--) {
      str = ' ' + str;
    }

    return str;
};

/**
 * Right Pad the given string to the maximum width provided.
 *
 * @param  {String} str Input string.
 * @param  {Number} width Desired Lenght.
 * @return {String} Right padded string.
 */
exports.rpad = function(str, width) {
    str = String(str);
    var n = width - str.length;

    if (n < 1) {
      return str;
    }

    while (n--) {
      str = str + ' ';
    }

    return str;
};
