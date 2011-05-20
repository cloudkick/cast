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

var express = require('express');

var rateLimiter = require('../lib/rate-limiter');

// Module used as an Express middleware

// User request will be dropped if "/limited" path is accessed more
// than 5 times in 100 seconds from the same IP address.
var rules = [
  ['/limited', 'all', 5, 100, true]
];

var app = express.createServer();
app.configure(function() {
  app.use(rateLimiter.expressMiddleware(rules));
});

app.get('/limited', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
});

app.listen(8686, '0.0.0.0');
