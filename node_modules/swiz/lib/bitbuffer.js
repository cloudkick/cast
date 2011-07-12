/*
 *  Copyright 2011 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var Buffer = require('buffer').Buffer;


/**
 * The constructor for a BitBuffer class
 * @constructor
 *
 * @param {*} x a buffer, a bitbuffer, a size, or nothing.
 */
var BitBuffer = function(x) {
  var len, i;
  if (x instanceof Buffer) { // Copy
    this.buf = new Buffer(x.length);
    x.copy(this.buf);
  } else if (x instanceof BitBuffer) {
    this.buf = new Buffer(x.buf.length);
    x.buf.copy(this.buf);
  } else { // Size
    if (typeof(x) === 'number') { // Size
      len = x;
    } else {
      len = 128;
    }
    this.buf = new Buffer(len / 8);
    // Zero the buffer before use.
    len = this.buf.length;
    for (i = 0; i < len; i += 1) {
      this.buf[i] = 0;
    }
  }
};


/**
 * Set a single bit
 * @param {number} v the bit to set.
 */
BitBuffer.prototype.setBit = function(v) {
  var by, bit;
  by = this.buf.length - Math.floor(v / 8) - 1;
  bit = v % 8;
  this.buf[by] = this.buf[by] | (1 << bit);
};


/**
 * logical-NOT the whole buffer
 */
BitBuffer.prototype.not = function() {
  var i, l = this.buf.length;
  for (i = 0; i < l; i += 1) {
    this.buf[i] = ~this.buf[i];
  }
};


/**
 * logical-AND the whole buffer against another buffer
 * @param {BitBuffer} b the other buffer.
 */
BitBuffer.prototype.and = function(b) {
  var i, l = this.buf.length;
  for (i = 0; i < l; i += 1) {
    this.buf[i] = this.buf[i] & b.buf[i];
  }
};


/**
 * compare the buffer against another buffer
 * @param {BitBuffer} b the other buffer.
 * @return {bool} if the buffers match.
 */
BitBuffer.prototype.cmp = function(b) {
  var i, l = this.buf.length;
  for (i = 0; i < l; i += 1) {
    if (this.buf[i] !== b.buf[i]) {
      return false;
    }
  }
  return true;
};


/**
 * The BitBuffer class
 */
exports.BitBuffer = BitBuffer;
