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
var CAST_VERSION_MINOR = 1;
var CAST_VERSION_PATCH = 0;

/* change this on release tags */
var CAST_IS_DEV = true;

exports.MAJOR = CAST_VERSION_MAJOR;
exports.MINOR = CAST_VERSION_MINOR;
exports.PATCH = CAST_VERSION_PATCH;
exports.IS_DEV = CAST_IS_DEV;

exports.toString = function()
{
  var dstr = '-dev';

  if (DISLCOATE_IS_DEV === false) {
    dstr = '-release';
  }

  return 'cast-'+  DISLOCATE_VERSION_MAJOR +'.'+ DISLOCATE_VERSION_MINOR +'.'+ DISLOCATE_VERSION_PATCH +''+dstr;
};
