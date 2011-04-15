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

/**
 * Maximum delay before runit picks up new changes (in milliseconds).
 * @type {Number}
 * @const
 */
var RUNIT_DELAY = 6000;

/**
 * Default timeouts (in ms) for hooks
 * @type {Object}
 * @const
*/
var timeouts = {
     'pre_prepare': 50000, // Gets called after the instance is prepared
     'post_prepare': 50000, // Gets called after the instance is prepared

     'pre_version_activate': 50000, // Gets called before the version is activated
     'post_version_activate': 50000 // Gets called after the version is activated
};

exports.RUNIT_DELAY = RUNIT_DELAY;
exports.timeouts = timeouts;
