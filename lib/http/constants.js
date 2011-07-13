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

/**
 * Header indicating cast API version
 * @const
 * @type {String}
 */
var API_VERSION_HEADER = 'x-cast-api-version';

/**
 * The maximum number of requests client can send to the /ca/ endpoint before
 * blocking it.
 * @const
 * @type {String}
 */
var REQUEST_COUNT_LIMIT = 10;

/**
 * Number of seconds in which a client can send a maximum of REQUEST_TIME_LIMIT
 * number ob requests before blocking it.
 * @const
 * @type {String}
 */
var REQUEST_TIME_LIMIT = 100;

/**
 * Regular expression for the certificate authority signing request.
 * @const
 * @type {RegExp}
 */
var CA_REQUEST_PATH_RE = /\/1\.0\/ca\/(.+)\//;

/**
 * Method for retrieving a CA signing request.
 * @const
 * @type {String}
 */
var CA_RETRIEVE_REQUEST_METHOD = 'GET';

/**
 * Method for submitting a CA signing request.
 * @const
 * @type {String}
 */
var CA_SUBMIT_REQUEST_METHOD = 'PUT';

/**
 * Connect logger middleware log line format.
 * @const
 * @type {String}
 */
var LOG_FORMAT = ':remote-addr - - [:date] :method :url HTTP/:http-version " :status -" :referrer ":user-agent"';

/**
 * Rate limiter rules
 * @const
 * @type {Array}
 */
var LIMITER_RULES = [
  [CA_REQUEST_PATH_RE, CA_RETRIEVE_REQUEST_METHOD, REQUEST_COUNT_LIMIT, REQUEST_TIME_LIMIT, true],
  [CA_REQUEST_PATH_RE, CA_SUBMIT_REQUEST_METHOD, REQUEST_COUNT_LIMIT, REQUEST_TIME_LIMIT, true]
];

/**
 * List of enabled http endpoints
 * @const
 * @type {Array}
 */
var APPS = ['endpoints', 'info', 'ca', 'bundles', 'services', 'facts',
            'health', 'instances', 'jobs', 'plugins'];

/**
 * Default http services root path
 * @const
 * @type {String}
 */
var SERVICES_HTTP_ROOT = 'services/http/';

/**
 * Currently active API version
 * @const
 * @type {String}
 */
var CURRENT_API_VERSION = '1.0';

/**
 * Headers which are added to every HTTP response.
 * @const
 * @type {Object}
 */
var BASE_HEADERS = { 'X-Cast-Agent-Version': version.toString(),
                     'X-Cast-API-Version': CURRENT_API_VERSION };

exports.API_VERSION_HEADER = API_VERSION_HEADER;
exports.BASE_HEADERS = BASE_HEADERS;
exports.APPS = APPS;
exports.SERVICES_HTTP_ROOT = SERVICES_HTTP_ROOT;
exports.CURRENT_API_VERSION = CURRENT_API_VERSION;

exports.REQUEST_COUNT_LIMIT = REQUEST_COUNT_LIMIT;
exports.REQUEST_TIME_LIMIT = REQUEST_TIME_LIMIT;
exports.CA_REQUEST_PATH_RE = CA_REQUEST_PATH_RE;
exports.CA_SUBMIT_REQUEST_METHOD = CA_SUBMIT_REQUEST_METHOD;
exports.CA_RETRIEVE_REQUEST_METHOD = CA_RETRIEVE_REQUEST_METHOD;

exports.LOG_FORMAT = LOG_FORMAT;

exports.LIMITER_RULES = LIMITER_RULES;
