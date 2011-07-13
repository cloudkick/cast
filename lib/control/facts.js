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

var norris = require('norris');


/**
 * Retrieve facts about the host cast is running on.
 * @param {Function} callback A callback fired with (err, facts).
 */
function getFacts(callback) {
  // We currently hardcode a null error argument for API consistency and
  // future-proofing.
  norris.get(callback.bind(null, null));
}


exports.getFacts = getFacts;
