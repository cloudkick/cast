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
 * The maximum number of requests client can send to the /ca/ endpoint before
 * blocking it.
 * @const
 * @type {String}
 */
var REQUEST_COUNT_LIMIT = 2;

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
 * Method for the certificate authority signing request.
 * @const
 * @type {String}
 */
var CA_REQUEST_METHOD = 'PUT';

/**
 * Rate limiter rules
 * @const
 * @type {Array}
 */
var LIMITER_RULES = [
  [CA_REQUEST_PATH_RE, CA_REQUEST_METHOD, REQUEST_COUNT_LIMIT, REQUEST_TIME_LIMIT, true]
];

exports.REQUEST_COUNT_LIMIT = REQUEST_COUNT_LIMIT;
exports.REQUEST_TIME_LIMIT = REQUEST_TIME_LIMIT;
exports.CA_REQUEST_PATH_RE = CA_REQUEST_PATH_RE;
exports.CA_REQUEST_METHOD = CA_REQUEST_METHOD;

exports.LIMITER_RULES = LIMITER_RULES;