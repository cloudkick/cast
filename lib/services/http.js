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

var sprintf = require('sprintf').sprintf;

var crypto = require('crypto');
var ps = require('util/pubsub');
var config = require('util/config');
var clutch = require('extern/clutch');
var http = require('util/http');
var constants = require('services/http/constants');

/**
 * An array which maps API version to the available endpoints.
 */
var apiMethods = {};

/**
 * An array which contains available API versions.
 */
var apiVersions = [];

function index(req, res) {
  http.returnJson(res, 200, { 'services': constants.APPS });
}

function _serverOnly(servicesHttpRoot, apps, currentApiVersion) {
  var r = ['GET /$', index];
  var urls = [];
  var i, endpointUrlsLen, endpointUrls, endpointUrl, endpointMethod;
  var serviceUrls, clutchArgs, routes;

  servicesHttpRoot = servicesHttpRoot || constants.SERVICES_HTTP_ROOT;
  apps = apps || constants.APPS;
  currentApiVersion = currentApiVersion || constants.CURRENT_API_VERSION;

  apps.forEach(function(app) {
    // Create "symlinks" for latest version
    serviceUrls = require(sprintf('%s%s', servicesHttpRoot, app)).urls;

    for (var apiVersion in serviceUrls) {
      if (serviceUrls.hasOwnProperty(apiVersion)) {
        endpointUrls = {};
        clutchArgs = serviceUrls[apiVersion];
        routes = clutch.route(clutchArgs);

        if (apiVersion === currentApiVersion) {
          urls.push([sprintf('* /%s', app), routes]);
        }

        urls.push([sprintf('* /%s/%s', apiVersion, app), routes]);

        if (apiVersions.indexOf(apiVersion) === -1) {
          apiVersions.push(apiVersion);
        }

        if (!apiMethods.hasOwnProperty(apiVersion)) {
          apiMethods[apiVersion] = {};
        }

        if (!apiMethods[apiVersion].hasOwnProperty(app)) {
          apiMethods[apiVersion][app] = {};
        }

        endpointUrlsLen = clutchArgs.length;
        for (i = 0; i < endpointUrlsLen; i++) {
          endpointUrl = clutchArgs[i][0];
          endpointMethod = clutchArgs[i][1].name;
          apiMethods[apiVersion][app][endpointMethod] = endpointUrl;
        }
      }
    }
  });

  exports.apiVersions = apiVersions;
  exports.apiMethods = apiMethods;
  urls.push(r);

  routes = clutch.route404(urls, constants.BASE_HEADERS);

  // Note: This calls util/http.buildServer()
  var server = http.buildServer();

  server.on('request', routes);

  return server;
}

function route(routes) {
  var i = 0, clutchRoutes = {};
  var currentRoute, method, path, func;
  var split, argLen, apiVersion;
  var routesLen = routes.length;

  for (i = 0; i < routesLen; i++) {
    currentRoute = routes[i];
    argLen = currentRoute.length;

    split = currentRoute[0].split(' ');
    method = split[0];
    path = split[1];

    if (argLen !== 3) {
      throw new Error('Function takes 3 argument - path, api version, callback');
    }

    apiVersion = currentRoute[1];
    func = currentRoute[2];

    if (!clutchRoutes.hasOwnProperty(apiVersion)) {
      clutchRoutes[apiVersion] = [];
    }

    clutchRoutes[apiVersion].push([sprintf('%s %s', method, path), func]);
  }

  return clutchRoutes;
}

function load() {
  var server, ip;
  var conf = config.get();

  ps.ensure(ps.AGENT_STATE_START, function() {
    server = _serverOnly();
    server.listen(conf['port'], conf['ip']);
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (server) {
      server.close();
      server = null;
    }
  });
}

exports._serverOnly = _serverOnly;
exports.route = route;

exports.load = load;
