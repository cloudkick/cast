// Copyright 2010 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview A MessageChannel decorator that wraps a deferred MessageChannel
 * and enqueues messages and service registrations until that channel exists.
 *
 */

goog.provide('goog.messaging.DeferredChannel');

goog.require('goog.async.Deferred');
goog.require('goog.messaging.MessageChannel'); // interface



/**
 * Creates a new DeferredChannel, which wraps a deferred MessageChannel and
 * enqueues messages to be sent once the wrapped channel is resolved.
 *
 * @param {!goog.async.Deferred} deferredChannel The underlying deferred
 *     MessageChannel.
 * @constructor
 * @implements {goog.messaging.MessageChannel}
 */
goog.messaging.DeferredChannel = function(deferredChannel) {
  this.deferred_ = deferredChannel;
};


/** @inheritDoc */
goog.messaging.DeferredChannel.prototype.connect = function(opt_connectCb) {
  if (opt_connectCb) {
    opt_connectCb();
  }
};


/** @inheritDoc */
goog.messaging.DeferredChannel.prototype.isConnected = function() {
  return true;
};


/** @inheritDoc */
goog.messaging.DeferredChannel.prototype.registerService = function(
    serviceName, callback, opt_jsonEncoded) {
  this.deferred_.addCallback(function(resolved) {
    resolved.registerService(serviceName, callback, opt_jsonEncoded);
  });
};


/** @inheritDoc */
goog.messaging.DeferredChannel.prototype.registerDefaultService =
    function(callback) {
  this.deferred_.addCallback(function(resolved) {
    resolved.registerDefaultService(callback);
  });
};


/** @inheritDoc */
goog.messaging.DeferredChannel.prototype.send = function(serviceName, payload) {
  this.deferred_.addCallback(function(resolved) {
    resolved.send(serviceName, payload);
  });
};
