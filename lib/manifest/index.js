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

var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var misc = require('util/misc');
var constants = require('manifest/constants');
var validators = require('manifest/validators');

/**
 * Custom error class containing information about a invalid field
 *
 * @param {String} field Field name
 * @param {String} message Field error message
 *
 * @constructor
 */
function InvalidFieldError(field, message) {
  this.name = 'InvalidFieldError';
  this.field = field;
  this.field_message = message;
  this.message = sprintf('Field %s is not valid (%s)', this.field, this.field_message);
};

/**
 * Validate that the manifest file is valid.
 *
 * @param {String} manifest_path Absolute path to the manifest file.
 * @param {Function} callback Callback which is called with the error as the first argument if the validation fails,
 *                            without argument otherwise.
 */
var validate_manifest = function(manifest_path, callback) {
  path.exists(manifest_path, function(exists) {
    if (!exists) {
      return callback('Invalid path to the manifest file');
    }

    var read_stream = fs.createReadStream(manifest_path);
    var data_buffer = [];

    var handle_validation = function() {
      var data = data_buffer.join('');

      try {
        var manifest_object = JSON.parse(data);
      }
      catch (error) {
        return callback(new Error('Manifest file contains invalid JSON'));
      }

      var required_fields = [];
      var optional_fields = [];
      var manifest_fields = [];
      var default_values = constants.DEFAULT_VALUES[manifest_object.type];

      var field;

      // Merge the manifest file values with the default values
      manifest_object = misc.merge(default_values, manifest_object);

      for (field in manifest_object) {
        manifest_fields.push(field);
      }

      for (field in constants.COMMON_FIELDS) {
        if (constants.COMMON_FIELDS[field].required) {
          required_fields.push(field);
        }
        else {
          optional_fields.push(field);
        }
      }

      var application_type = manifest_object.type;
      for (field in constants.APPLICATION_FIELDS[application_type]) {
        if (constants.APPLICATION_FIELDS[application_type][field].required) {
          required_fields.push(field);
        }
        else {
          optional_fields.push(field);
        }
      }

      var all_fields = required_fields.concat(optional_fields);
      var missing_required_fields = misc.array_difference(required_fields, manifest_fields);

      // Check that the manifest contains all the required fields
      if (missing_required_fields.length > 0) {
        return callback(new Error(sprintf('Manifest file is missing required fields: %s', missing_required_fields.join(', '))));
      }

      // Check that the manifest contains valid optional fields (if any)
      if (!misc.array_is_subset_of(manifest_fields, all_fields)) {
        var invalid_fields = misc.array_difference(manifest_fields, all_fields);

        return callback(new Error(sprintf('Manifest contains invalid fields: %s', invalid_fields)));
      }

      // Field validation
      var type, validator;
      var all_fields_object = misc.merge(constants.COMMON_FIELDS, constants.APPLICATION_FIELDS[application_type]);

      // Currently the options object which is passed to each validator function only holds information about
      // the absolute path to the directory where the manifest file is located.
      var options = { 'manifest_path': path.dirname(manifest_path) };

      async.forEach(manifest_fields, function(field, callback) {
        type = all_fields_object[field].type;
        validator = all_fields_object[field].validator;

        if (validator) {
          // Field has a custom validator specified, use this one
          validator_name = validator;
        }
        else {
          // Field has no validator specified, use a generic type validator
          if (type === 'string') {
            validator_name = 'valid_string';
          }
          else if (type === 'number') {
            validator_name = 'valid_number';
          }
        }

        // Validate the field
        if (type === 'array') {
          validators.validate_array(manifest_object[field], validator_name, options, function(error) {
            if (error) {
              return callback(new InvalidFieldError(field, error.message));
            }

            callback();
          });
        }
        else {
          validators.validate_value(manifest_object[field], validator_name, options, function(error) {
            if (error) {
              return callback(new InvalidFieldError(field, error.message));
            }

            callback();
          });
        }
      },

      function(error) {
        if (error) {
          return callback(error);
        }

        // If we came so far, we have a valid manifest file
        callback();
      });
    }

    read_stream.on('data', function(chunk) {
      data_buffer.push(chunk);
    });

    read_stream.on('error', function(error) {
      read_stream.removeListener('end', handle_validation);
      return callback(error);
    });

    read_stream.on('end', handle_validation);
  });
};

exports.validate_manifest = validate_manifest;
