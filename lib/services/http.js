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
var path = require('path');
var crypto = require('crypto');

var express = require('express');
var async = require('async');
var sprintf = require('sprintf').sprintf;

var ps = require('util/pubsub');
var log = require('util/log');
var config = require('util/config');
var http = require('util/http');
var certgen = require('security/certgen');
var httpUtil = require('util/http');
var httpConstants = require('http/constants');

var middlewareRateLimiter = require('rate-limiter');
var middlewareAuthentication = require('http/middleware/authentication');
var middlewareHmac = require('http/middleware/hmac');
var middlewareRequiredParams = require('http/middleware/required-params');

/**
 * 500 handler.
 */
function errorHandler(err, req, res) {
  httpUtil.returnError(res, 500, null, 'Internal Server Error');
}

/**
 * 404 handler.
 */
function notFoundHandler(req, res) {
  httpUtil.returnText(res, 404, null, 'Not Found');
}

/**
 * Return an Express application for the provided endpoint.
 *
 * @param {String} apiVersion Version of the API for which endpoints are being
 *                            registered.
 * @param {String} endpointPath Path to the endpoint module.
 * @return {HTTPSServer} HTTPSServer instance.
 */
function getEndpointApp(apiVersion, endpointPath) {
  var endpointApp = express.createServer();
  module = require(endpointPath);
  module.register(endpointApp, apiVersion);
  return endpointApp;
}

/**
 * Register all the endpoint handlers and return a new Express application.
 * @param {String} apiVersion Version of the API for which endpoints are being
 *                            registered.
 * @return {HTTPSServer} HTTPSServer instance.
 */
function getEndpointsApp(apiVersion) {
  var i, endpointName, endpointApp;
  var server = express.createServer();
  var appsLen = httpConstants.APPS.length;

  for (i = 0; i < appsLen; i++) {
    endpointName = httpConstants.APPS[i];
    endpointApp = getEndpointApp(apiVersion,
                                 sprintf('http/endpoints/%s', endpointName));
    server.use(sprintf('/%s', endpointName), endpointApp);
  }

  return server;
}

/**
 * Configure an application and register middleware.
 */
function configure(app) {
  // Add middleware
  app.configure(function() {
    app.use(express.logger({ format: httpConstants.LOG_FORMAT,
                             stream: log.info }));
    app.use(express.bodyParser());
    app.use(middlewareRateLimiter.expressMiddleware(httpConstants.LIMITER_RULES));
    app.use(middlewareAuthentication.attachMiddleware());
    app.use(middlewareHmac.attachMiddleware());
  });

  // Register all the services endpoints
  // @TODO: overwrite app.use function and make it save all the routes in a
  // local variable so we can expose all the API methods using the api http
  // endpoint.
  app.use(sprintf('/%s', httpConstants.CURRENT_API_VERSION),
          getEndpointsApp(httpConstants.CURRENT_API_VERSION));
}

/**
 * Register 500 and 404 error handlers.
 */

function configureErrorHandlers(server) {
  server.error(errorHandler);
  server.use(notFoundHandler);
}

function listen(app) {
  var conf = config.get();
  certgen.getCertFingerprint(conf['ssl_cert'], function(err, fp) {
    if (err) {
      log.err(err.message);
    } else {
      log.info('Fingerprint: ' + fp);
    }

    app.listen(conf['port'], conf['ip']);
    log.info('Cast API server listening on %s://%s:%s/',
             (conf['ssl_enabled']) ? 'https' : 'http', conf['ip'], conf['port']);
  });
}

function getAndConfigureServer() {
  var server, ip, options;
  var conf = config.get();

  if (conf['ssl_enabled']) {
    options = {
      key: fs.readFileSync(conf['ssl_key']),
      cert: fs.readFileSync(conf['ssl_cert']),
      ca: fs.readFileSync(conf['ssl_ca_cert']),
      requestCert: true,
      rejectUnauthorized: false
    };

    server = express.createServer(options);
  }
  else {
    server = express.createServer();
  }

  configure(server);
  return server;
}

function load() {
  var server;
  ps.ensure(ps.AGENT_STATE_START, function() {
    server = getAndConfigureServer();
    configureErrorHandlers(server);
    listen(server);
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (server) {
      server.close();
      server = null;
    }
  });
}

exports.load = load;
exports.configureErrorHandlers = configureErrorHandlers;
exports.getAndConfigureServer = getAndConfigureServer;
