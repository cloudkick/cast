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
var Service = require('services').Service;

var middlewareRateLimiter = require('rate-limiter');
var middlewareAuthentication = require('http/middleware/authentication');
var middlewareHmac = require('http/middleware/hmac');
var middlewareRequiredParams = require('http/middleware/required-params');

var SERVICE_NAME = 'HTTP server';

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

function HttpServer() {
  Service.call(this, SERVICE_NAME);

  this._server = null;
}

HttpServer.prototype.start = function() {
  Service.prototype.start.call(this);

  var server = this._getAndConfigure();
  this._configureErrorHandlers(server);
  this._listen(server);

  this._server = server;
};

HttpServer.prototype.stop = function() {
  Service.prototype.stop.call(this);

  this._server.close();
};

/**
 * Configure an application and register middleware.
 */
HttpServer.prototype._configure = function(server) {
  // Add middleware
  server.configure(function() {
    server.use(express.logger({ format: httpConstants.LOG_FORMAT,
                                stream: log.info }));
    server.use(express.bodyParser());
    server.use(middlewareRateLimiter.expressMiddleware(httpConstants.LIMITER_RULES));
    server.use(middlewareAuthentication.attachMiddleware());
    server.use(middlewareHmac.attachMiddleware());
  });

  // Register all the services endpoints
  // @TODO: overwrite app.use function and make it save all the routes in a
  // local variable so we can expose all the API methods using the api http
  // endpoint.
  server.use(sprintf('/%s', httpConstants.CURRENT_API_VERSION),
             getEndpointsApp(httpConstants.CURRENT_API_VERSION));
};

/**
 * Create an HTTP service and configure all the Express applications and
 * middleware.
 *
 * @return {HTTPServer} HTTPServer instance.
 */
HttpServer.prototype._getAndConfigure = function() {
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

  this._configure(server);
  return server;
};

/**
 * Register 500 and 404 error handlers.
 */
HttpServer.prototype._configureErrorHandlers = function(server) {
  server.error(errorHandler);
  server.use(notFoundHandler);
};

HttpServer.prototype._listen = function(server) {
  var conf = config.get();
  certgen.getCertFingerprint(conf['ssl_cert'], function(err, fp) {
    if (err) {
      log.err(err.message);
    } else {
      log.info('Fingerprint: ' + fp);
    }

    server.listen(conf['port'], conf['ip']);
    log.info('Cast API server listening on %s://%s:%s/',
             (conf['ssl_enabled']) ? 'https' : 'http', conf['ip'], conf['port']);
  });
};

var httpServer = new HttpServer();

function load() {
  function startServer() {
    httpServer.start();
    ps.emit('cast.agent.services.httpserver.started');
  }

  function stopServer() {
    httpServer.stop();
    ps.emit('cast.agent.services.httpserver.stopped');
  }

  ps.ensure(ps.AGENT_STATE_START, function() {
    if (!httpServer.isRunning) {
      startServer();
    }
  });

  ps.on(ps.AGENT_STATE_STOP, function() {
    if (httpServer.isRunning) {
      stopServer();
    }
  });
}

exports.load = load;
exports.httpServer = httpServer;

// @TODO: For now expose these so the existing tests will work, but later on we
// need to refactor it.
exports.configureErrorHandlers = httpServer._configureErrorHandlers.bind(httpServer);
exports.getAndConfigureServer = httpServer._getAndConfigure.bind(httpServer);
