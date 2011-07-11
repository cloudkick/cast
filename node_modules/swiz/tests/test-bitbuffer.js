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

var bif = require('bitbuffer').BitBuffer;

exports['test_bitbuffer_setbit'] = function(test, assert) {
  var buf = new bif(24);

  assert.deepEqual(buf.buf[2], 0);
  assert.deepEqual(buf.buf[1], 0);
  assert.deepEqual(buf.buf[0], 0);

  buf.setBit(1);
  buf.setBit(0);
  buf.setBit(23);
  assert.deepEqual(buf.buf[2], 3);
  assert.deepEqual(buf.buf[1], 0);
  assert.deepEqual(buf.buf[0], 0x80);

  test.finish();
};

exports['test_bitbuffer_not'] = function(test, assert) {
  var buf = new bif(24);

  buf.setBit(1);
  buf.setBit(0);
  buf.setBit(23);

  buf.not();
  assert.deepEqual(buf.buf[2], 0xfc);
  assert.deepEqual(buf.buf[1], 0xff);
  assert.deepEqual(buf.buf[0], 0x7f);

  test.finish();
};

exports['test_bitbuffer_and'] = function(test, assert) {
  var buf = new bif(24);
  var buf2 = new bif(24);

  buf.setBit(1);
  buf.setBit(0);
  buf.setBit(23);

  buf2.setBit(1);
  buf2.setBit(0);
  buf2.setBit(22);
  buf2.setBit(23);

  buf2.and(buf);
  assert.deepEqual(buf.buf[2], 3);
  assert.deepEqual(buf.buf[1], 0);
  assert.deepEqual(buf.buf[0], 0x80);

  test.finish();
};

exports['test_bitbuffer_cmp'] = function(test, assert) {
  var buf = new bif(24);
  var buf2 = new bif(24);

  buf.setBit(1);
  buf.setBit(0);
  buf.setBit(23);

  buf2.setBit(1);
  buf2.setBit(0);
  buf2.setBit(23);

  assert.deepEqual(buf.cmp(buf2), true);

  buf2.setBit(22);

  assert.deepEqual(buf.cmp(buf2), false);
  test.finish();
};

exports['test_bitbuffer_constructor'] = function(test, assert) {
  var buf, buf2, str = '192.192.192.192';
  buf = new Buffer(str.split('.'));
  buf2 = new bif(buf);
  assert.deepEqual(buf[0], buf2.buf[0]);
  assert.deepEqual(buf[1], buf2.buf[1]);
  assert.deepEqual(buf[2], buf2.buf[2]);
  assert.deepEqual(buf[3], buf2.buf[3]);
  test.finish();
};
