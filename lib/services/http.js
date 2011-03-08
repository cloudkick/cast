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

var sprintf = require('extern/sprintf').sprintf;

var crypto = require('crypto');
var ps = require('util/pubsub');
var config = require('util/config');
var clutch = require('extern/clutch');
var http = require('util/http');

var APPS = ['bundles', 'services', 'facts', 'health', 'instances'];

/* List of available API versions */
var AVAILABLE_API_VERSION = [ '1.0' ];

function index(req, res) {
    res.writeHead(200, {'Content-Type': 'text-plain'});
    APPS.forEach(function(app) {
      res.write(app + '\n');
    });
    res.end();
}

/* Used by test cases that just want an instance of the server, not yet running */
exports._serverOnly = function() {
  var r = ['GET /$', index];
  var urls = [];
  var service_urls, clutch_args, routes;

  APPS.forEach(function(app) {
    service_urls = require(sprintf('services/http/%s', app)).urls;

    for (var api_version in service_urls) {
      if (service_urls.hasOwnProperty(api_version)) {
        clutch_args = service_urls[api_version];
        routes = clutch.route(clutch_args);

        urls.push([sprintf('* /%s/%s', api_version, app), routes]);
      }
    }
  });

  urls.push(r);

  routes = clutch.route404(urls);

  // Note: This calls util/http.server
  var server = http.server(routes);

  return server;
};

exports.route = function(routes) {
  var i = 0, clutch_routes = {};
  var route, method, path, func;
  var split, arg_len, api_version;
  var routes_len = routes.length;

  for (i = 0; i < routes_len; i++) {
    route = routes[i];
    arg_len = route.length;

    split = route[0].split(' ');
    method = split[0];
    path = split[1];

    if (arg_len !== 3) {
      throw new Error('Function takes 3 argument - path, api version, callback');
    }

    api_version = route[1];
    func = route[2];

    if (!clutch_routes.hasOwnProperty(api_version)) {
      clutch_routes[api_version] = [];
    }

    clutch_routes[api_version].push([ sprintf('%s %s', method, path), func ]);
  }

  return clutch_routes;
};

exports.load = function() {
  var server, ip;
  var conf = config.get();

  ps.ensure(ps.AGENT_STATE_START, function() {
    server = exports._serverOnly();
    ip = conf.ip || '0.0.0.0';
    server.listen(conf.port, ip);
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (server) {
      server.close();
      server = null;
    }
  });
};
