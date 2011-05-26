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

var sprintf = require('sprintf').sprintf;

/**
 * Valid HTTP methods.
 * @const
 * @type {Array}
 */
var VALID_METHODS = ['get','post','put','head','delete','all'];

/**
 * A simple class for IP address based request rate limiting.
 * @constructor
 */
function RateLimiter() {
  this._limits = {};
  this._limitsData = {};
}

/**
 * Add a new limit.
 *
 * @param {RegExp} path Regular expression for the path.
 * @param {String} method HTTP method name or 'all' for all.
 * @param {Number} requestCount The maximum number of request user can make
 *                               in the time period defined bellow.
 * @param {Number} requestPeriod Time period in seconds.
 * @param {Boolean} returnErr true to return an error message, false to drop
 *                            the requests without returning any error message
 *                            (defaults to false).
 */
RateLimiter.prototype.addLimit = function(path, method,
                                          requestCount,
                                          requestPeriod,
                                          returnErr) {
  method = method.toLowerCase() || 'all';
  var key = this._getKeyForLimit(path, method);

  if (VALID_METHODS.indexOf(method) === -1) {
    throw new Error(sprintf('Invalid method: %s', method));
  }

  if (this._limits.hasOwnProperty(key)) {
    throw new Error(sprintf('Limit for path %s and method %s already exists',
                     path, method));
  }

  if (requestCount < 1 || requestPeriod < 1) {
    throw new Error('requestCount and requestPeriod values must be ' +
                    'bigger or equal to 1.');
  }

  var limit = {
    'path_re': path,
    'method': method,
    'request_count': requestCount,
    'request_period': requestPeriod,
    'return_err': returnErr
  };

  this._limits[key] = limit;
  this._limitsData[key] = {};
};

/**
 * Remove a limit.
 * Note: This will also remove any existing limit for requests currently in
 * progress.
 *
 * @param {RegExp} path Regular expression for the path.
 * @param {String} method HTTP method name or 'all' for all.
 */
RateLimiter.prototype.removeLimit = function(path, method) {
  var key = this._getKeyForLimit(path, method);

  if (!this._limits.hasOwnProperty(key)) {
    throw new Error(sprintf('Limit for path %s and method %s does not exist',
                     path, method));
  }

  delete this._limits[key];
  delete this._limitsData[key];
};

/**
 * Reset access counter for the provided IP address.
 *
 * @param {RegExp} path Regular expression for the path.
 * @param {String} method HTTP method name or 'all' for all.
 * @param {String} ipAddress IP address for which the counter will be reset.
 */
RateLimiter.prototype.resetIpAddressAccessCounter = function(path, method,
                                                             ipAddress) {
  var key = this._getKeyForLimit(path, method);

  if (!this._limits.hasOwnProperty(key)) {
    throw new Error(sprintf('Limit for path %s and method %s does not exist',
                     path, method));
  }

  if (!this._limitsData[key].hasOwnProperty(ipAddress)) {
    throw new Error(sprintf('No recorded data for IP %s exists.', ipAddress));
  }

  this._limitsData[key][ipAddress]['access_count'] = 0;
};

/**
 * Return a key for the provided path and method combination.
 *
 * @param {RegExp} path Regular expression for the path.
 * @param {String} method HTTP method name or 'all' for all.
 */
RateLimiter.prototype._getKeyForLimit = function(path, method) {
  var key = sprintf('%s.%s', path.toString(), method.toLowerCase());
  return key;
};

/**
 * Process a request and if a limit has been reached, drop it, otherwise call
 * the callback provided by the user.
 *
 * @param {HttpServerRequest} req Request object.
 * @param {HttpServerResponse} res Response object.
 * @param {Function} A callback which is called with req and res if a limit
 *                   hasn't been reached.
 */
RateLimiter.prototype.processRequest = function(req, res, callback) {
  var tmp;

  if (typeof req === 'function') {
    // Allow user to pass in callback as the first argument.
    // This comes handy when creating a continuation.
    tmp = callback;
    callback = req;
    req = res;
    res = tmp;
  }

  var path = req.url;
  var method = req.method.toLowerCase();
  var ipAddress = req.socket.remoteAddress;

  var now = Math.round(new Date() / 1000);
  var limitReached = false;
  var limit, limitData, ipLimitData, code, headers, errMsg;

  for (var key in this._limits) {
    if (this._limits.hasOwnProperty(key)) {
      limit = this._limits[key];
      limitData = this._limitsData[key];

      if (!limitData.hasOwnProperty(ipAddress)) {
        limitData[ipAddress] = {
          'access_count': 0,
          'expire': null
        };
      }

      ipLimitData = limitData[ipAddress];

      if (!path.match(limit['path_re']) || (limit['method'] !== 'all' &&
          limit['method'] !== method)) {
        continue;
      }
      else {
        if (!ipLimitData['expire'] || ipLimitData['expire'] < now) {
          ipLimitData['access_count'] = 0;
          ipLimitData['expire'] = (now + limit['request_period']);
        }

        if ((ipLimitData['access_count'] >= limit['request_count']) &&
            (ipLimitData['expire'] > now) && (!limitReached)) {
          // Limit has been reached, end the request, but don't return yet,
          // because we need to update the counters for other matching limits.
          limitReached = true;
          code = 403;
          headers = {'Retry-After': (ipLimitData.expire - now) };

          if (limit['return_err']) {
            errMsg = sprintf('A limit of %d requests in %s seconds ' +
                             'has been reached. Request aborted.',
                             limit['request_count'],
                             limit['request_period']);
          }
          else {
            errMsg = '';
          }

          res.writeHead(code, headers);
          res.end(errMsg);
        }

        ipLimitData['access_count']++;
      }
    }
  }

  if (!limitReached) {
    callback(req, res);
  }
};

function expressMiddleware(rules) {
  var i, rulesLen, rule;
  var limiter = new RateLimiter();

  rulesLen = rules.length;
  for (i = 0; i < rulesLen; i++) {
    rule = rules[i];
    limiter.addLimit.apply(limiter, rule);
  }

  return function limitRate(req, res, next) {
    limiter.processRequest(req, res, function() {
      next();
    });
  };
}

exports.RateLimiter = RateLimiter;
exports.expressMiddleware = expressMiddleware;
