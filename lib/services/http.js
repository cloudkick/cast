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

var sys = require('sys');
var fs = require('fs');
var crypto = require('crypto');
var ps = require('util/pubsub');
var config = require('util/config');
var clutch = require('extern/clutch');
var http = require('util/http');
var apps = ['bundles', 'services', 'facts', 'health', 'instances'];

function index(req, res) {
    res.writeHead(200, {'Content-Type': 'text-plain'});
    apps.forEach(function(v) {
      res.write(v + '\n');
    });
    res.end();
}

/* Used by test cases that just want an instance of the server, not yet running */
exports._serverOnly = function() {
  var r = ['GET /$', index];
  var urls = [];
  apps.forEach(function(v) {
    urls.push(['* /' + v, require('services/http/' + v).urls]);
  });

  urls.push(r);

  var routes = clutch.route404(urls);

  var server = http.server(routes);

  return server;
};

exports.load = function() {
  var conf = config.get();
  var server = exports._serverOnly();
  ps.ensure(ps.AGENT_STATE_START, function() {
    if (conf.ssl_enabled) {
      /* TODO: async? */
      var key = fs.readFileSync(conf.ssl_key).toString();
      var cert = fs.readFileSync(conf.ssl_cert).toString();
      var sslcontext = crypto.createCredentials({method: 'TLSv1_server_method', key: key, cert: cert});
      sslcontext.context.setCiphers(conf.ssl_ciphers);
      server.setSecure(sslcontext);
    }
    server.listen(conf.port, '0.0.0.0');
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    server.close();
  });
};
