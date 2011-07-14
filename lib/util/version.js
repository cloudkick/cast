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
 * Provides the current version of cast.
 *
 * These are written in an easily parsable format for use by
 * other (non-js) scripts to easily grep out the version number.
 */

var CAST_VERSION_MAJOR = 0;
var CAST_VERSION_MINOR = 3;
var CAST_VERSION_PATCH = 0;

/* change this on release tags */
var CAST_IS_DEV = true;

/** Major version */
exports.MAJOR = CAST_VERSION_MAJOR;
/** Minor version */
exports.MINOR = CAST_VERSION_MINOR;
/** Patch level */
exports.PATCH = CAST_VERSION_PATCH;
/** Boolean testing if this is a development version or release version */
exports.IS_DEV = CAST_IS_DEV;

/**
 * Get the current version of Cast.
 * @return {String} Dot'ed format string of the version.
 */
exports.toString = function() {
  var dstr = '-dev';

  if (exports.IS_DEV === false) {
    dstr = '-release';
  }

  return 'cast-' + CAST_VERSION_MAJOR + '.' + CAST_VERSION_MINOR + '.' + CAST_VERSION_PATCH + '' + dstr;
};
