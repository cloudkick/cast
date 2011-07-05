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

var util = require('util');
var sprintf = require('sprintf').sprintf;


/**
 * An error indicating that an operation failed because a resource (or job,
 * etc) doesn't exist.
 * @param {String} type The name of the type of resource that doesn't exist.
 * @param {String} name The name of the resource that doesn't exist.
 */
function NotFoundError(type, name) {
  Error.captureStackTrace(this, NotFoundError);
  this.name = 'NotFoundError';
  this.message = sprintf('%s \'%s\' does not exist.', type, name);
  this.responseCode = 404;
}

util.inherits(NotFoundError, Error);


/**
 * An error indicating that an operation failed because a resource with the
 * given type and name already exists.
 * @param {String} type The name of the type of resource that already exists.
 * @param {String} name The name of the resource that already exists.
 */
function AlreadyExistsError(type, name) {
  Error.captureStackTrace(this, AlreadyExistsError);
  this.name = 'AlreadyExistsError';
  this.message = sprintf('%s \'%s\' already exists.', type, name);
  this.responseCode = 409;
}

util.inherits(AlreadyExistsError, Error);


exports.NotFoundError = NotFoundError;
exports.AlreadyExistsError = AlreadyExistsError;
