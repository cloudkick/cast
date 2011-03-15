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

var path = require('path');
var fs = require('fs');

/**
 * This detects if the entry file is a symlinked path, and tries to
 * insert the correct lib into the require.paths for eveyrthing to work correctly.
 *
 * @param {String} filePath Path to a file. If specified, it is joined with '../'
 *                           and '../lib/cast' and both of those paths are inserted
 *                           at the begining of the require.paths array.
 */
exports.pathSetup = function(filePath) {
  var stat, root;
  var p = filePath || path.join(__filename, '../');

  stat = fs.lstatSync(p);
  if (stat.isSymbolicLink()) {
    p = fs.readlinkSync(p);
  }

  root = path.dirname(p);

  if (filePath) {
    // in-place path
    require.paths.unshift(path.join(root, '../lib'));
    // installed path
    require.paths.unshift(path.join(root, '../lib/cast'));
  }
  else {
    require.paths.unshift(root);
  }
};
