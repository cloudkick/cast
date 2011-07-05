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

var control = require('control');
var castHttp = require('util/http');


// Wrapped control calls
var listChecks = castHttp.wrapCall(control.health.listChecks);
var listScheduledChecks = castHttp.wrapCall(control.health.listScheduledChecks);
var getCheck = castHttp.wrapCall(control.health.getCheck, ['checkId']);


function register(app, apiVersion) {
  app.get('/', listChecks);
  app.get('/scheduled/', listScheduledChecks);
  app.get('/:checkId/', getCheck);
}


exports.register = register;
