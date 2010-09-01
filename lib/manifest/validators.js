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

var misc = require('util/misc');

var manifest = require('manifest');

/**
 * Validators functions for the manifest file values
 */
var is_valid_type = function(value) {
  if (!misc.in_array(value, manifest.APPLICATION_TYPES)) {
    return false;
  }
  
  return true;
};

var is_valid_string = function(value) {
  if (typeof(value) === 'string') {
    return true;
  }
  else if (typeof(value)=== 'object') {
    if (value instanceof String) {
      return true;
    }
  }
  
  return false;
};

var is_valid_number = function(value) {
  if (typeof(value) === 'number') {
    return true;
  }
  else if (typeof(value) === 'object') {
    if (value instanceof Number) {
      return true;
    }
  }
  
  return false;
}

var is_valid_port = function(value) {
  if (is_valid_number(value)) {
    return false;
  }
  
  if (!(value > 0) && (value < 65535)) {
    return false;
  }
  
  return true;
}

var is_valid_template = function(value) {
  // @todo
};

/**
 * Validator name to function mappings
 */
var VALIDATORS = {
  'valid_type': is_valid_type,
  'valid_string': is_valid_string,
  'valid_number': is_valid_number,
  'valid_port': is_valid_port,
  'valid_template': is_valid_template
};

/**
 * Common validation functions
 */
var validate_array = function(array, validator) {
  var validation_result = array.map(function(value) {
    return VALIDATORS[validator].call(this, value);
  });
  
  if (misc.in_array(false, validation_result)) {
    return false;
  }
  
  return true;
};

var validate_value = function(value, validator) {
  return VALIDATORS[validator].call(this, value);
};
 
exports.validate_array = validate_array;
exports.validate_value = validate_value;
