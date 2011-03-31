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

var path = require('path');
var fs = require('fs');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var misc = require('util/misc');
var ufs = require('util/fs');
var constants = require('manifest/constants');
var validators = require('manifest/validators');

/**
 * Custom error class containing information about a invalid field
 *
 * @param {String} field Field name.
 * @param {String} message Field error message.
 *
 * @constructor
 */
function InvalidFieldError(field, message) {
  this.name = 'InvalidFieldError';
  this.field = field;
  this.fieldMessage = message;
  this.message = sprintf('Field %s is not valid (%s)', this.field, this.fieldMessage);
}

/**
 * Return manifest data as a Javascript object.
 *
 * @param {String} manifestPath Absolute path to the manifest file.
 * @param {Function} callback Callback which is called with the error as the first argument if there is an error and
 *                            with manifestObject as the second argument otherwise.
 */
function getManifestObject(manifestPath, mergeWithDefaults, callback) {
  path.exists(manifestPath, function(exists) {
    if (!exists) {
      callback(new Error('Invalid path to the manifest file: ' + manifestPath), null);
      return;
    }

    ufs.jsonFile(manifestPath, function(err, obj) {
      var defaultValues, manifestObject;

      if (err) {
        callback(err);
        return;
      }

      if (mergeWithDefaults) {
        // Merge the manifest file values with the default values for this application type
        defaultValues = constants.DEFAULT_VALUES[obj.type];
        obj = misc.merge(defaultValues, obj);
      }

      callback(null, obj);
    });
  });
}

/**
 * Validate that the manifest file is valid.
 *
 * @param {String} manifestPath Absolute path to the manifest file.
 * @param {Function} callback Callback which is called with the error as the first argument if the validation fails,
 *                            with manifestObject as the second argument otherwise.
 */
function validateManifest(manifestPath, callback) {
  getManifestObject(manifestPath, true, function(error, manifestObject) {
    if (error) {
      callback(error, null);
      return;
    }

    var requiredFields = [];
    var optionalFields = [];
    var manifestFields = [];

    var field;
    for (field in manifestObject) {
      if (manifestObject.hasOwnProperty(field)) {
        manifestFields.push(field);
      }
    }

    for (field in constants.COMMON_FIELDS) {
      if (constants.COMMON_FIELDS[field].required) {
        requiredFields.push(field);
      }
      else {
        optionalFields.push(field);
      }
    }

    var applicationType = manifestObject.type;
    for (field in constants.APPLICATION_FIELDS[applicationType]) {
      if (constants.APPLICATION_FIELDS[applicationType][field].required) {
        requiredFields.push(field);
      }
      else {
        optionalFields.push(field);
      }
    }

    var allFields = requiredFields.concat(optionalFields);
    var missingRequiredFields = misc.arrayDifference(requiredFields, manifestFields);

    // Check that the manifest contains all the required fields
    if (missingRequiredFields.length > 0) {
      callback(new Error(sprintf('Manifest file is missing required fields: %s',
                                        missingRequiredFields.join(', '))));
      return;
    }

    // Check that the manifest contains valid optional fields (if any)
    if (!misc.arrayIsSubsetOf(manifestFields, allFields)) {
      var invalidFields = misc.arrayDifference(manifestFields, allFields);
      callback(new Error(sprintf('Manifest contains invalid fields: %s', invalidFields)));
      return;
    }

    // Field validation
    var type, validator;
    var allFieldsObject = misc.merge(constants.COMMON_FIELDS, constants.APPLICATION_FIELDS[applicationType]);

    // Currently the options object which is passed to each validator function only holds information about
    // the absolute path to the directory where the manifest file is located.
    var options = { 'manifest_path': path.dirname(manifestPath) };

    async.forEach(manifestFields, function(field, callback) {
      var validatorName;
      type = allFieldsObject[field].type;
      validator = allFieldsObject[field].validator;

      if (validator) {
        // Field has a custom validator specified, use this one
        validatorName = validator;
      }
      else {
        // Field has no validator specified, use a generic type validator
        if (type === 'string') {
          validatorName = 'valid_string';
        }
        else if (type === 'number') {
          validatorName = 'valid_number';
        }
      }

      // Validate the field
      if (type === 'array') {
        validators.validateArray(manifestObject[field], validatorName, options, function(error) {
          if (error) {
            callback(new InvalidFieldError(field, error.message));
            return;
          }

          callback();
        });
      }
      else {
        validators.validateValue(manifestObject[field], validatorName, options, function(error) {
          if (error) {
            callback(new InvalidFieldError(field, error.message));
            return;
          }

          callback();
        });
      }
    },

    function(error) {
      if (error) {
        callback(error);
        return;
      }

      // If we came so far, we have a valid manifest file
      callback(null, manifestObject);
    });
  });
}

exports.validateManifest = validateManifest;
exports.getManifestObject = getManifestObject;
