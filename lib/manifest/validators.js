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

var fs = require('fs');
var path = require('path');

var T = require('extern/strobe-templates/index');
var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var misc = require('util/misc');
var health = require('health');
var constants = require('manifest/constants');

/**
 * Validators functions for the manifest file values.
 *
 * @param {Varies} value Value which is being validated.
 * @param {Object} options Options objects which contains additional information about the manifest.
 * @param {Function} callback Callback which is called with the error as the first argument if the validation fails,
 *                            without argument otherwise.
 */
var is_valid_type = function(value, options, callback) {
  if (!misc.in_array(value, constants.APPLICATION_TYPES)) {
    return callback(true);
  }

  callback();
};

var is_valid_string = function(value, options, callback) {
  if (typeof(value) === 'string') {
    return callback();
  }
  else if (typeof(value) === 'object') {
    if (value instanceof String) {
      return callback();
    }
  }

  callback(new Error('value is not a string'));
};

var is_valid_number = function(value, options, callback) {
  if (typeof(value) === 'number') {
    return callback();
  }
  else if (typeof(value) === 'object') {
    if (value instanceof Number) {
      return callback();
    }
  }

  callback(new Error('value is not a number'));
};

var is_valid_port = function(value, options, callback) {
  is_valid_number(value, options, function(error) {
    if (error) {
      return callback(error);
    }

    if (!((value > 0) && (value <= 65535))) {
      return callback(new Error('Port number must be between 1 and 65535'));
    }

    callback();
  });
};

var is_valid_check = function(value, options, callback) {
  var check_name, check_module, check_class, index;

  if (typeof(value) !== 'object') {
    return callback(new Error('Health check item, must be an object'));
  }

  if (!value.hasOwnProperty('check')) {
      return callback(new Error('Missing "check" property'));
  }

  check_name = value.check;

  // Check for a valid check name
  index = misc.array_find(check_name, health.available_checks, null, function(item, needle) { return item[0] === needle; });
  if (index === false) {
    return callback(new Error(sprintf('Invalid check type: %s', check_name)));
  }

  check_module = require(sprintf('health/checks/%s', check_name));
  check_class = health.available_checks[index][1];

  // Create a check object which throws an exception if a required argument is missing
  try {
    var module = new check_module[check_class](value['arguments']);
  }
  catch (error) {
    return callback(error);
  }

  callback();
};

var is_valid_template = function(value, options, callback) {
  if (!value) {
    return callback(new Error('Template file is an empty string'));
  }

  var template_path = path.join(options.manifest_path, value);
  path.exists(template_path, function(exists) {
    if (!exists) {
      return callback(new Error('Template file does not exist'));
    }

    var read_stream = fs.createReadStream(template_path);
    var data_buffer = [];

    read_stream.on('data', function(chunk) {
      data_buffer.push(chunk);
    });

    read_stream.on('end', function() {
      var data = data_buffer.join('');
      var template = new T.Template();

      try {
        template.parse(data);
      }
      catch (error) {
        return callback(error);
      }

      callback();
    });
  });
};

var is_valid_data_file = function(value, options, callback) {
  is_valid_string(value, options, function(error) {
    if (error) {
      return callback(error);
    }

    if (value.substr(0, 1) === '/' || value.substr(0, 2) === '~/' || value.substr(0, 2) === './' || value.substr(0, 2) === '..') {
      return callback(new Error('All the paths must be relative to the application root directory'));
    }

    callback();
  });
};

var is_valid_template_variable = function(value, options, callback) {
  var item;

  if (typeof(value) !== 'object' || value instanceof Array) {
    return callback(new Error('Template variable item must be an object'));
  }

  function validate_item(item) {
    async.waterfall([
      function(callback) {
        is_valid_string(item, options, function(error) {
          if (error) {
            return callback(null, false);
          }

          callback(null, true);
        });
      },

      function(is_valid, callback) {
        if (is_valid) {
          return callback();
        }

        is_valid_number(item, options, function(error) {
          callback(error);
        });
      }
    ],

    function(error) {
      if (error) {
        return callback(new Error('Template variable values can only be strings or integers'));
      }

      callback();
    });
  }

  for (var key in value) {
    if (value.hasOwnProperty(key)) {
      item = value[key];
      validate_item(item);
    }
  }
};

/**
 * Validator name to function mappings
 */
var VALIDATORS = {
  'valid_type': is_valid_type,
  'valid_string': is_valid_string,
  'valid_number': is_valid_number,
  'valid_port': is_valid_port,
  'valid_check': is_valid_check,
  'valid_template': is_valid_template,
  'valid_data_file': is_valid_data_file,
  'valid_template_variable': is_valid_template_variable
};

/**
 * Common validation functions
 */
var validate_array = function(array, validator, options, callback) {
  async.forEach(array, function(item, callback) {
    VALIDATORS[validator].call(this, item, options, function(error) {
      callback(error);
    });
  },

  function(error) {
    if (error) {
      return callback(error);
    }

    callback();
  });
};

var validate_value = function(value, validator, options, callback) {
  VALIDATORS[validator].call(this, value, options, function(error) {
    callback(error);
  });
};

exports.validate_array = validate_array;
exports.validate_value = validate_value;
