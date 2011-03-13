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

/* The principle of this app is as follows.
 * as messages come in it adds it to the end of
 * the buffer and then copies it to a new buffer shifted over
 * chunk.length to make room for the new log lines.
 */
var stdin = process.openStdin(),
    http = require('http'),
    Buffer = require('buffer').Buffer,
    total = 512,
    buf = new Buffer(total),
    offset = 0;

stdin.setEncoding('utf8');

// Listen for the data and add it to the "Ring" Buffer
stdin.addListener('data', function(chunk) {
  process.stdout.write(chunk);
  if (offset + chunk.length > total) {
    // Going to buffer overrun.
    var oldBuf = buf;
    buf = new Buffer(total);
    oldBuf.copy(buf, 0, chunk.length, oldBuf.length);
    offset -= chunk.length;
  }
  offset += buf.write(chunk, offset);
});

http.createServer(function(request, response) {
  response.writeHead(200, {
    'content-type': 'text/plain',
    'stream': 'keep-alive',
    'accept': '*/*'});
  response.write(buf.slice(0, offset));
  stdin.addListener('data', function(chunk) {
    response.write(chunk);
  });
}).listen(8125);

console.log('Server running at http://127.0.0.1:8125/');
