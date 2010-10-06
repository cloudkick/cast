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

var config = require('util/config');
var crypto = require('crypto');
var misc = require('util/misc');

var signature_header = 'X-Cast-Signature';
var nonce_header = 'X-Cast-Nonce';
var signature_encoding = "base64";

function hmac_genreate(input)
{
  var h = crypto.createHmac(config.get().hmac_algorithm, config.get().secret);

  input.forEach(function(item) {
    h.update(item);
  });

  return h.digest(signature_encoding);
}

/* To prevent timing attacks, you must not just do a plain
 * string comparision of an HMAC.  The following function is constant time,
 * if the input HMAC is of the correct length, and assuming v8
 * doesn't optimize it all out.
 */
function hmac_validate(a, b)
{
  if (a.length != b.length) {
    return false;
  }

  var rv = 0;

  for (var i = 0; i < a.length; i++) {
    rv = rv | (a[i] ^ b[i]);
  }

  if (rv === 0) {
    return true;
  }

  return false;
}

/**
 * Signs a request with the default HMAC algorithm and secret.
 *
 * @param {String} method  HTTP Method to sign.
 * @param {String} url  HTTP url to sign.
 * @param {Object} headers  Headers to set, modified by this function.
 */
exports.create_http_hmac = function(method, url, headers)
{
  var inputs = [method, url];

  if (!headers[nonce_header]) {
    headers[nonce_header] = misc.randstr(32);
  }

  inputs.push(headers[nonce_header]);

  headers[signature_header] = hmac_genreate(inputs);
};

