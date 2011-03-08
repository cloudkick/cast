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

var http = require('services/http');
var httputil = require('util/http');

var route = http.route;

/*
 * Return available API versions and methods.
 */
function api_methods(req, res) {
  var api_info = {
    'current_api_version': http.CURRENT_API_VERSION,
    'available_api_versions': http.api_versions,
    'api_methods': {}
  };

  api_info.api_methods = http.api_methods;
  httputil.return_json(res, 200, api_info);
}

exports.urls = route([
   ['GET /$', '1.0', api_methods]
]);
