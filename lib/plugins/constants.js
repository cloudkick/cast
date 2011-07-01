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
 * Name of the plugin manifest file.
 * @const
 * @type {String}
 */
var PLUGIN_MANIFEST_NAME = 'package.json';

/**
 * Name of the directory in the plugin lib/ directory where the http endpoints
 * are located.
 * @const
 * @type {String}
 */
var HTTP_ENDPOINTS_DIRECTORY = 'http/endpoints/';

/**
 * Name of the directory in the plugin lib/ directory where the services
 * are located.
 * @const
 * @type {String}
 */
var SERVICES_DIRECTORY = 'services';

/**
 * Name of the directory in the plugin lib/ directory where the jobs
 * are located.
 * @const
 * @type {String}
 */
var JOBS_DIRECTORY = 'jobs';


/**
 * Plugin name path prefix. The final path looks like this:
 * HTTP_ENDPOINT_PREFIX + / + <plugin_name> + / <plugin_endpoint>/
 * @const
 * @type {String}
 */
var HTTP_ENDPOINT_PREFIX = 'plugins';

exports.PLUGIN_MANIFEST_NAME = PLUGIN_MANIFEST_NAME;
exports.HTTP_ENDPOINTS_DIRECTORY = HTTP_ENDPOINTS_DIRECTORY;
exports.SERVICES_DIRECTORY = SERVICES_DIRECTORY;
exports.JOBS_DIRECTORY = JOBS_DIRECTORY;

exports.HTTP_ENDPOINT_PREFIX = HTTP_ENDPOINT_PREFIX;
