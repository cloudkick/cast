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

var T = require('magic-templates');
var async = require('async');
var sprintf = require('sprintf').sprintf;

var misc = require('util/misc');
var health = require('health');
var constants = require('manifest/constants');

var Errorf = misc.Errorf;

/**
 * Validators functions for the manifest file values.
 *
 * @param {Varies} value Value which is being validated.
 * @param {Object} options Options objects which contains additional information about the manifest.
 * @param {Function} callback Callback which is called with the error as the first argument if the validation fails,
 *                            without argument otherwise.
 */
function isValidType(value, options, callback) {
  if (!misc.inArray(value, constants.APPLICATION_TYPES)) {
    callback(new Errorf('Invalid type: %s', value));
    return;
  }

  callback();
}

function isValidString(value, options, callback) {
  if (typeof(value) === 'string') {
    callback();
    return;
  }
  else if (typeof(value) === 'object') {
    if (value instanceof String) {
      callback();
      return;
    }
  }

  callback(new Error('value is not a string'));
}

function isValidNumber(value, options, callback) {
  if (typeof(value) === 'number') {
    callback();
    return;
  }
  else if (typeof(value) === 'object') {
    if (value instanceof Number) {
      callback();
      return;
    }
  }

  callback(new Error('value is not a number'));
}

function isValidPort(value, options, callback) {
  isValidNumber(value, options, function(error) {
    if (error) {
      callback(error);
      return;
    }

    if (!((value > 0) && (value <= 65535))) {
      callback(new Error('Port number must be between 1 and 65535'));
      return;
    }

    callback();
  });
}

function isValidCheck(value, options, callback) {
  var checkName, checkModule, checkClass, index;

  if (typeof(value) !== 'object') {
    callback(new Error('Health check item, must be an object'));
    return;
  }

  if (!value.hasOwnProperty('check')) {
      callback(new Error('Missing "check" property'));
      return;
  }

  checkName = value.check;

  // Check for a valid check name
  index = misc.arrayFind(checkName,
                          health.availableChecks,
                          null,
                          function(item, needle) {
                            return item[0] === needle;
                          });

  if (index === false) {
    callback(new Error(sprintf('Invalid check type: %s', checkName)));
    return;
  }

  checkModule = require(sprintf('health/checks/%s', checkName));
  checkClass = health.availableChecks[index][1];

  // Create a check object which throws an exception if a required argument is missing
  try {
    var module = new checkModule[checkClass](value['arguments']);
  }
  catch (error) {
    callback(error);
    return;
  }

  callback();
}

function isValidTemplate(value, options, callback) {
  if (!value) {
    callback(new Error('Template file is an empty string'));
    return;
  }

  var templatePath = path.join(options.manifest_path, value);
  path.exists(templatePath, function(exists) {
    if (!exists) {
      callback(new Error('Template file does not exist'));
      return;
    }

    var readStream = fs.createReadStream(templatePath);
    var dataBuffer = [];

    readStream.on('data', function(chunk) {
      dataBuffer.push(chunk);
    });

    readStream.on('end', function() {
      var data = dataBuffer.join('');
      var template = new T.Template();

      try {
        template.parse(data);
      }
      catch (error) {
        callback(error);
        return;
      }

      callback();
    });
  });
}

function isValidDataFile(value, options, callback) {
  isValidString(value, options, function(error) {
    if (error) {
      callback(error);
      return;
    }

    if (value.substr(0, 1) === '/' ||
        value.substr(0, 2) === '~/' ||
        value.substr(0, 2) === './' ||
        value.substr(0, 2) === '..') {
      callback(new Error('All the paths must be relative to the application root directory'));
      return;
    }

    callback();
  });
}

function isValidTemplateVariable(value, options, callback) {
  var item;

  if (typeof(value) !== 'object' || value instanceof Array) {
    callback(new Error('Template variable item must be an object'));
    return;
  }

  function validateItem(item) {
    async.waterfall([
      function(callback) {
        isValidString(item, options, function(error) {
          if (error) {
            callback(null, false);
            return;
          }

          callback(null, true);
        });
      },

      function(isValid, callback) {
        if (isValid) {
          callback();
          return;
        }

        isValidNumber(item, options, function(error) {
          callback(error);
        });
      }
    ],

    function(error) {
      if (error) {
        callback(new Error('Template variable values can only be strings or integers'));
        return;
      }

      callback();
    });
  }

  for (var key in value) {
    if (value.hasOwnProperty(key)) {
      item = value[key];
      validateItem(item);
    }
  }
}

function isValidBundleVersion(value, options, callback) {
  var err = null;

  if (value.indexOf('@') !== -1) {
    err = new Error('Version number cannot contain @ character');
  }

  callback(err);
}

/**
 * Validator name to function mappings
 */
var VALIDATORS = {
  'valid_type': isValidType,
  'valid_string': isValidString,
  'valid_number': isValidNumber,
  'valid_port': isValidPort,
  'valid_check': isValidCheck,
  'valid_template': isValidTemplate,
  'valid_data_file': isValidDataFile,
  'valid_template_variable': isValidTemplateVariable,
  'valid_version': isValidBundleVersion
};

/**
 * Applies validator to an Array of values
 *
 * @param {Array} array Array of items to validate.
 * @param {String} validator Validator to run against values.
 * @param {?Object} options Extra options to the Validator.
 * @param {Function} callback Invoked on completion, first parameter
 *                            is present if errors happened.
 */
function validateArray(array, validator, options, callback) {
  async.forEach(array, function(item, callback) {
    VALIDATORS[validator].call(null, item, options, function(error) {
      callback(error);
    });
  },

  function(error) {
    if (error) {
      callback(error);
      return;
    }

    callback();
  });
}

/**
 * Applies validator to a single value.
 *
 * @param {Object} value Item to validate.
 * @param {String} validator Validator to run against values.
 * @param {?Object} options Extra options to the Validator.
 * @param {Function} callback Invoked on completion, first parameter
 *                            is present if errors happened.
 */
function validateValue(value, validator, options, callback) {
  VALIDATORS[validator].call(null, value, options, function(error) {
    callback(error);
  });
}

exports.validateArray = validateArray;
exports.validateValue = validateValue;
