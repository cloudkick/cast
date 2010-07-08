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
var rest = require('extern/restler/lib/restler');
var http = require('http');
var misc = require('util/misc');
var sys = require('sys');
var fs = require('fs');
var log = require('util/log');
var uri = require('extern/restler/lib/vendor/uri');

var default_options = {
  'headers': {'User-Agent': version.toString()}
};

exports.putv2 = function(url, options) {
  var url = uri.parse(url);
  var merged = misc.merge(default_options, options);
  var headers = {
    'Accept': '*/*',
    'Host': url.domain
  };
  misc.merge(options.headers, headers);

  if (!url.path) {
    url.path = '/'
  }

  var spin = require('util/spinner').spinner("Uploading "+ options.file);
  var istream = fs.createReadStream(options.file, {'bufferSize': 1024 * 64});

  /* TODO: url parser */
  var client = http.createClient(8080, url.domain);
  var request = client.request('PUT', url.path, headers);
  spin.start();
  istream.addListener("data", function() {
    spin.tick();
  });
  istream.addListener("clode", function() {
    spin.end();
  });
  sys.pump(istream, request, function() {
    request.addListener('error', function() {
      log.err('request error');
    });
    request.addListener('response', function (response) {
      console.log('STATUS: ' + response.statusCode);
      console.log('HEADERS: ' + JSON.stringify(response.headers));
      response.setEncoding('utf8');
      response.addListener('data', function (chunk) {
        console.log('BODY: ' + chunk);
      });
    });
  });
};

/* TODO: expose everything */
/* TODO: fixup authentication */
exports.put = function(url, options) {
  var merged = misc.merge(a, options);
  return rest.put(url, merged);
};

exports.file = rest.file;
