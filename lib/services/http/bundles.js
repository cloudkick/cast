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

var clutch = require('extern/clutch');
var log = require('util/log');
var fs = require('fs');
var sys = require('sys');
var path = require('path');

/* TODO: move the core of this to utils */
function toPath(bundle, file) {
  /* TODO: configuration of the root */
  var p;
  var root = "/opt/cast/bundles/";
  if (bundle && file) {
    p = path.join(root, bundle, file);
  }
  else {
    p = path.join(root, bundle);
  }

  p = path.normalize(p);

  if (p.indexOf(root) != 0 ) {
    return null;
  }

  return p;
}

function handle_404(res) {
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('File not found\n');
}

function fileOr404(p, req, res, success) {
  if (p === null) {
    return handle_404(res);
  }

  fs.stat(p, function (err, stats) {
    if (err || !stats.isFile()) {
      return handle_404(res);
    }

    success();
  });
}

function pumpfilein(dest, istream, done)
{
  var fstream = fs.createWriteStream(dest, {'flags': 'w', 'encoding': 'binary', 'mode': 0644});
  /* THis is not ideal, but sys.pump and the HTTP request don't interact that well together,
   * so this emits a spurious and technically incorrect 'close' event for when the HTTP request
   * body has ended.
   */
  istream.on('end', function() {
    istream.emit('close');
  })
  sys.pump(istream, fstream, function() {
    done();
  });
}

function pumpfileout(source, ostream, done)
{
  /* TODO: global configuration of the bufferSize setting */
  var fstream = fs.createReadStream(source, {'bufferSize': 1024 * 64});
  sys.pump(fstream, ostream, function() {
    done();
  });
}

function upload(req, res, bundle, file) {
  var p = toPath(bundle, file);
  pumpfilein(p, req, function() {
    res.writeHead(204, {});
    res.end()
  });
}

function download(req, res, bundle, file) {
  var p = toPath(bundle, file);
  return fileOr404(p, req, res, function() {
    res.writeHead(200, {'Content-Type': 'application/octet-stream'});
    pumpfileout(p, res, function() { 
      res.end()
    });
  });
}

function remove(req, res, bundle, file) {
  res.writeHead(204, {});
  res.end();
}

function list_files(req, res, bundle) {
  res.writeHead(204, {});
  res.end();
}

function list_bundles(req, res) {
  res.writeHead(204, {});
  res.end();
}

exports.urls = clutch.route([
                              ['PUT /(.+)/(.+)$', upload],
                              ['GET /(.+)/(.+)$', download],
                              ['DELETE /(.+)/(.+)$', remove],
                              ['GET /(.+)/$', list_files],
                              ['GET /$', list_bundles]
                              ]);