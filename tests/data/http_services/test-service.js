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

var http = require('util/http');
var route = require('services/http').route;

function get_1_0(req, res) {
  http.returnJson(res, 200, { 'text': 'test 1.0'});
}

function get_2_0(req, res) {
  http.returnJson(res, 202, { 'text': 'test 2.0'});
}

exports.urls = route([
   ['GET /$', '1.0', get_1_0],
   ['GET /$', '2.0', get_2_0]
]);
