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
var sys = require('sys');
var fs = require('fs');
var tasks = [];

function upload_to_cast(source, dest, callback)
{
  var r = http.put_file(source, dest, {'spinner': true});

  r.on('error', function(body, response) {
    sys.puts("Error: "+ body);
  });

  r.on('success', function(body, response) {
    sys.puts("Success: "+ body);
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
