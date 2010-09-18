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

exports.get = function(done) {
  var major, minor, patch;
  var node_version = process.version;

  node_version = node_version.replace('v', '');
  node_version = node_version.split('.');

  major = parseInt(node_version[0], 0);
  minor = parseInt(node_version[1], 0);
  patch = parseInt(node_version[2], 0);

  done({'node_version': {'major': major, 'minor': minor, 'patch': patch}});
};
