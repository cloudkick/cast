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
var http = require('http');
var misc = require('util/misc');
var sys = require('sys');
var fs = require('fs');
var log = require('util/log');
var uri = require('extern/restler/lib/vendor/uri');
var rest = require('extern/restler/lib/restler');

exports.put = function(url, options)
{
  options.headers = options.headers ? options.headers : {};
  options.headers['User-Agent'] = version.toString();
  options.timeout = 3000;
  return rest.put(url, options);
}

exports.put_file = function(source, url, options)
{
  var stream = fs.createReadStream(source, {'bufferSize': options.bufferSize ? bufferSize : 1024 * 64});
  options['data_stream'] = stream;
  /* TODO: refactor into a UI thing in restler */
  if (options.spinner) {
    fs.stat(source, function (err, stats) {
      if (err) { 
        throw err;
      }
      var spin = require('util/spinner').percent("Uploading "+ source, stats.size);
      spin.start();
      var l = 0;
      stream.addListener("data", function(chunk) {
        l += chunk.length;
        spin.tick(l);
      });
      stream.addListener("close", function() {
        spin.end();
      });
    });
  }
  return exports.put(url, options);
}
