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

/**
 * List of enabled application
 */
var APPS = ['info', 'api', 'bundles', 'services', 'facts', 'health', 'instances'];

/**
 * Default http services root path
 */
var SERVICES_HTTP_ROOT = 'services/http/';

/**
 * Currently active API version
 */
var CURRENT_API_VERSION = '1.0';

/**
 * An array which maps API version to the available endpoints.
 */
var api_methods = {};

/**
 * An array which contains available API versions.
 */
var api_versions = [];

function index(req, res) {
  http.return_json(res, 200, { 'services': APPS });
}

exports._serverOnly = function(services_http_root, apps, current_api_version) {
  var r = ['GET /$', index];
  var urls = [];
  var i, endpoint_urls_len, endpoint_urls, endpoint_url, endpoint_method;
  var service_urls, clutch_args, routes;

  services_http_root = services_http_root || SERVICES_HTTP_ROOT;
  apps = apps || APPS;
  current_api_version = current_api_version || CURRENT_API_VERSION;

  apps.forEach(function(app) {
    // Create "symlinks" for latest version
    service_urls = require(sprintf('%s%s', services_http_root, app)).urls;

    for (var api_version in service_urls) {
      if (service_urls.hasOwnProperty(api_version)) {
        endpoint_urls = {};
        clutch_args = service_urls[api_version];
        routes = clutch.route(clutch_args);

        if (api_version === current_api_version) {
          urls.push([sprintf('* /%s', app), routes]);
        }

        urls.push([sprintf('* /%s/%s', api_version, app), routes]);

        if (api_versions.indexOf(api_version) === -1) {
          api_versions.push(api_version);
        }

        if (!api_methods.hasOwnProperty(api_version)) {
          api_methods[api_version] = {};
        }

        if (!api_methods[api_version].hasOwnProperty(app)) {
          api_methods[api_version][app] = {};
        }

        endpoint_urls_len = clutch_args.length;
        for (i = 0; i < endpoint_urls_len; i++) {
          endpoint_url = clutch_args[i][0];
          endpoint_method = clutch_args[i][1].name;
          api_methods[api_version][app][endpoint_method] = endpoint_url;
        }
      }
    }
  });

  exports.api_versions = api_versions;
  exports.api_methods = api_methods;
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

exports.CURRENT_API_VERSION = CURRENT_API_VERSION;
