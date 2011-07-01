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


var agentManagers = require('cast-agent/managers');


function getBundleManager() {
  return agentManagers.getManager('BundleManager');
}


/**
 * Add a bundle to cast.
 * @param {String} name The name of the application.
 * @param {String} version The version of the application.
 * @param {stream.Stream} iStream A stream to read the bundle from.
 * @param {Function} getSHA1 An (optional) function called after iStream has
 *    emitted an 'end' event that takes a callback taking (err, sha1), where
 *    the 'sha1' argument is a base64 string.
 * @param {Function} callback A callback fired with (err).
 */
function addBundle(name, version, iStream, getSHA1, callback) {
  if (!callback) {
    callback = getSHA1;
    getSHA1 = undefined;
  }

  var opts = {
    getSHA1: getSHA1
  };

  getBundleManager().add(name, version, iStream, opts, callback);
}


/**
 * Remove a bundle from cast.
 * @param {String} name The name of the application.
 * @param {String} version The version of the application.
 * @param {Function} callback A callback fired with (err).
 */
function removeBundle(name, version, callback) {
  getBundleManager().remove(name, version, callback);
}


exports.addBundle = addBundle;
exports.removeBundle = removeBundle;
