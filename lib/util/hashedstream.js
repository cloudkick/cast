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

var util = require('util');
var crypto = require('crypto');
var stream = require('stream');


/**
 * A stream that hashes all data that comes through it. Until HTTP streams are
 * fixed in node, this also doesn't let any 'data' or 'end' events leak through
 * once it is paused. A HashedStream will emit a 'hash' event
 * @constructor
 * @param {String} hashType The type of hash to use.
 */
function HashedStream(hashType) {
  stream.Stream.call(this);
  this.hash = crypto.createHash(hashType);
  this.buffer = [];
  this.paused = false;
  this.readable = true;
  this.writable = true;
}

util.inherits(HashedStream, stream.Stream);


/**
 * Pause the stream - 'data' and 'end' events are buffered if necessary.
 */
HashedStream.prototype.pause = function() {
  this.paused = true;
  this.emit('pause');
};


/**
 * Resume the stream - 'data' and 'end' events are played back if necessary.
 */
HashedStream.prototype.resume = function() {
  var self = this;
  this.paused = false;

  this.buffer.forEach(function(chunk) {
    self.emit('data', chunk);
  });

  this.buffer = [];

  if (this.ended) {
    this.emit('end');
    this.emit('hash', this.hash);
  }

  this.emit('resume');
};


/**
 * Write to the stream.
 * @param {Buffer} chunk A buffer.
 */
HashedStream.prototype.write = function(chunk) {
  this.hash.update(chunk);

  if (this.paused) {
    this.buffer.push(chunk);
    return false;
  } else {
    this.emit('data', chunk);
    return true;
  }
};


/**
 * End the stream.
 */
HashedStream.prototype.end = function() {
  this.ended = true;

  if (!this.paused) {
    this.emit('end');
    this.emit('hash', this.hash);
  }
};


exports.HashedStream = HashedStream;
