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

var log = require('util/log');
var path  = require('path');
var http = require('util/http');
var path = require('path');
var tasks = [];
var fs = require('fs');

function upload_to_cast(source, dest, callback)
{
  fs.stat(source, function (err, stats) {
    if (err) { 
      throw err;
    }
    var istream = fs.createReadStream(source, {'bufferSize': 1024 * 4});
    var options = {'data_stream': istream};
    var spin = require('util/spinner').percent("Uploading "+ source, stats.size);
    spin.start();
    var l = 0;
    istream.addListener("data", function(chunk) {
      l += chunk.length;
      spin.tick(l);
    });
    istream.addListener("close", function() {
      spin.end();
      setTimeout(function() {
        process.exit();
      }, 0);
    });
    http.putrest(dest, options);
  });
}

var commands = {'upload': {
    'short': null,
    'param': 'PATH',
    'desc': 'Upload a file',
    'func': function(opt, value) {
      log.info('uploading '+ value);
      upload_to_cast(value, 'http://127.0.0.1:8010', function() {
        log.err('all done');
      });
    }
  }
};

(function() {
  options = [];
  for (var k in commands) {
    if (commands.hasOwnProperty(k)) {
      var s = "--"+ k;
      if (commands[k].param) {
        s += " "+ commands[k].param;
      }
      options.push([commands[k].short, s, commands[k].desc]);
    }
  }
  exports.options = options;
  exports.add = function(p) {
    for (var k in commands) {
      if (commands.hasOwnProperty(k)) {
        p.on(k, commands[k].func);
      }
    }
  };
})();
