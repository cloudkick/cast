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


function is_char_boundary(byte) {
  return ((byte & 0xC0) !== 0x80);
}


/**
 * A UTF-8 safe ring buffer implemented on top of a Node.js buffer.
 * @constructor
 *
 * @param {Number} size How many bytes to store in the buffer
 */
function RingBuffer(size) {
  this.buffer = new Buffer(size);
  this.offset = 0;
  this.wrapped = false;
}


/**
 * Append data to the ring buffer. This (obviously) may overwite existing data
 * and if the supplied buffer is larger than the ring buffer itself, earlier
 * bytes of the supplied buffer will not be stored.
 *
 * @param {Buffer} buf  The buffer to store data from
 */
RingBuffer.prototype.append = function(buf) {
  var diff; 

  if (buf.length >= this.buffer.length) {
    diff = buf.length - this.buffer.length;
    buf.copy(this.buffer, 0, diff);
    this.offset = 0;
    this.wrapped = true;
    return;
  }
  
  else if (buf.length > (this.buffer.length - this.offset)) {
    diff = this.buffer.length - this.offset;
    buf.copy(this.buffer, this.offset, 0, diff);
    buf.copy(this.buffer, 0, diff);
    this.offset = buf.length - diff;
    this.wrapped = true;
    return;
  }

  else {
    buf.copy(this.buffer, this.offset, 0);
    this.offset += buf.length;
    return;
  }
};

/**
 * Read the given number of bytes from the end of the ring buffer. This will
 * return a buffer containing no more than the requested number of bytes. It
 * may contain less than the requested number if either the ring buffer does
 * not currently hold that many or if the 'utf8' argument is true in which
 * case it will attempt to split along character boundaries. In other words,
 * if 'utf8' is set and only valid UTF-8 has been written to the buffer the returned buffer
 * will contain a trailing subset of the characters that have been written, but
 * not possibly less than the number of bytes requested.
 *
 * @param {Number} bytes  The maximum number of bytes to retrieve
 * @param {Boolean} utf8  Whether to ensure that the returned buffer contains
 *                        only valid UTF-8
 */
RingBuffer.prototype.tail = function(bytes, utf8) {
  var _utf8 = utf8 || false;
  var toread = (bytes < this.buffer.length) ? bytes : this.buffer.length;
  var begin = this.offset - bytes;

  if (begin < 0) {
    if (this.wrapped) {
      begin = this.buffer.length + begin;
    }
    if (begin < 0) {
      toread += begin;
      begin = 0;
    }
  }

  if (_utf8) {
    while (!is_char_boundary(this.buffer[begin]) && toread > 0) {
      begin++;
      toread--;
    }
  }

  var buf = new Buffer(toread);
  var copied = 0;
 
  if ((begin + toread) > this.buffer.length) {
    copied = this.buffer.copy(buf, 0, begin);
    begin = 0;
  }

  this.buffer.copy(buf, copied, begin, begin + (toread - copied));

  return buf;
};
