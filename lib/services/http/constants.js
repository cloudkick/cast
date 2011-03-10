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

var version = require('util/version');
var http = require('services/http');

/**
 * List of enabled http endpoints
 */
var APPS = ['info', 'api', 'bundles', 'services', 'facts', 'health', 'instances'];

/**
 * Default http services root path
 */
var SERVICES_HTTP_ROOT = 'services/http/';

/**
 * Currently active API version
 */
var CURRENT_API_VERSION = '1.0';

/**
 * Headers which are added to every HTTP response.
 */
var BASE_HEADERS = { 'X-Cast-Agent-Version': version.toString(),
                     'X-Cast-API-Version': CURRENT_API_VERSION };

exports.BASE_HEADERS = BASE_HEADERS;
exports.APPS = APPS;
exports.SERVICES_HTTP_ROOT = SERVICES_HTTP_ROOT;
exports.CURRENT_API_VERSION = CURRENT_API_VERSION;
