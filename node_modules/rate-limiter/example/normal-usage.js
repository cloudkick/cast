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

var http = require('http');

var rateLimiter = require('../lib/rate-limiter');

// Normal usage example
var limiter = new rateLimiter.RateLimiter();

// User request will be silently dropped if "/limited" path is accessed more
// than 5 times in 100 seconds from the same IP address.
// If you want to warn the user that the request has been throttles, pass true
// as the last argument.
limiter.addLimit('/limited', 'all', 5, 100, false);

function handleRequest(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}

http.createServer(function(req, res) {
  // "handleRequest" callbackk will only be called if the request hasn't been
  // rate limited
  limiter.processRequest(req, res, handleRequest);
}).listen(8585);
