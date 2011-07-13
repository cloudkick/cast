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

CIDR = require('cidr').CIDR;

exports['test_cidr_v4'] = function(test, assert) {
  c1 = new CIDR('192.169.0.1/29');

  assert.deepEqual(c1.v, 4);
  assert.deepEqual(c1.subnet, 29);
  assert.deepEqual(c1.mask.buf[3], 248);
  assert.deepEqual(c1.mask.buf[1], 255);
  assert.deepEqual(c1.prefix.buf[0], 192);
  assert.deepEqual(c1.prefix.buf[1], 169);

  assert.deepEqual(c1.isInCIDR('192.169.0.1'), true);
  assert.deepEqual(c1.isInCIDR('192.160.0.1'), false);
  assert.deepEqual(c1.isInCIDR('a::b'), false);

  test.finish();
};

exports['test_cidr_v6'] = function(test, assert) {

  c1 = new CIDR('a::b/64');

  assert.deepEqual(c1.v, 6);
  assert.deepEqual(c1.subnet, 64);
  assert.deepEqual(c1.mask.buf[8], 0);
  assert.deepEqual(c1.mask.buf[7], 255);
  assert.deepEqual(c1.prefix.buf[0], 0);
  assert.deepEqual(c1.prefix.buf[1], 0x0a);

  assert.deepEqual(c1.isInCIDR('a::b'), true);
  assert.deepEqual(c1.isInCIDR('b::b'), false);
  assert.deepEqual(c1.isInCIDR('192.150.0.1'), false);

  c1 = new CIDR('fc00::0/7');
  assert.deepEqual(c1.v, 6);
  assert.deepEqual(c1.subnet, 7);
  assert.deepEqual(c1.prefix.buf[0], 0xfc);
  test.finish();

};
