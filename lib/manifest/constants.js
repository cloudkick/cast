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
 * Manifest file name
 */
var MANIFEST_FILENAME = 'cast.json';

/**
 * Valid application types
 */
var APPLICATION_TYPES = ['nodejs', 'shell'];

/**
 * Manifest fields which are common to all the application types
 */
var COMMON_FIELDS = {
  'name':             {'type': 'string', 'required': true, 'description': 'Application name'},
  'description':      {'type': 'string', 'required': true, 'description': 'Application description'},
  'type':             {'type': 'string', 'required': true, 'validator': 'valid_type', 'description': 'Application type'},
  'entry_file':       {'type': 'string', 'required': true, 'description': 'Script or file which is run when starting the application'},
  'open_ports':       {'type': 'array', 'required': true, 'validator': 'valid_port', 'description': 'List of ports which should be open for this application'},
  'health_checks':    {'type': 'array', 'required': false, 'validator': 'valid_check', 'description': 'List of health check objects which are automatically added after deploying the application'},
  'template_files':   {'type': 'array', 'required': true, 'validator': 'valid_template', 'description': 'Relative paths to the template files'},
  'data_files':       {'type': 'array', 'required': true, 'validator': 'valid_data_file', 'description': 'List of relative paths to files and directories which are modified or created during application run-time (e.g. database file, user uploaded files, etc.)'}
};

/**
 * Fields types which are specific to each application type
 */
var APPLICATION_FIELDS = {
  'nodejs': {},
  'shell': {}
};

/**
 * Default manifest values (these will be used if no values are provided for the specified fields)
 */
var DEFAULT_VALUES = {
  'nodejs': {'entry_file': 'server.js', 'open_ports': [80]},
  'shell': {'entry_file': 'shell.sh'}
};

/**
 * A list of default check for each application type which are created on the server upon deployment.
 */
var HEALTH_CHECKS = {
  'nodejs': [{'check': 'http', 'arguments': {'url': 'http://127.0.0.1', 'type': 'status_code_match', 'value': 200}}],
  'shell': []
};

exports.MANIFEST_FILENAME = MANIFEST_FILENAME;
exports.APPLICATION_TYPES = APPLICATION_TYPES;
exports.COMMON_FIELDS = COMMON_FIELDS;
exports.APPLICATION_FIELDS = APPLICATION_FIELDS;
exports.DEFAULT_VALUES = DEFAULT_VALUES;
exports.HEALTH_CHECKS = HEALTH_CHECKS;
