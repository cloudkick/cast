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

var fs = require('fs');
var assert = require('assert');
var path = require('path');

var sprintf = require('sprintf').sprintf;

/**
 * Check that the status of a path on the filesystem matches the status
 * described in the passed object. The passed object must have a 'path'
 * attribute containing the absolute or relative path to check. It must
 * also have a 'type' attribute which may be 'symlink', 'file', 'directory'
 * or 'null'. The path will be checked against the provided type ('null'
 * indicates that the path should not exist). In the case of a 'symlink'
 * type, the type may be followed by a '.' and another type describing the
 * type of the target. These will be follwed recursively, so for example
 * 'symlink.symlink.directory' should be a symlink to a symlink to a directory,
 * or 'symlink.null' indicates a broken symlink. Finally, the passed object
 * may have a 'target' attribute. After a 'file' or 'directory' type is
 * verified, we will ensure that the inode pointed to by 'path' matches
 * that pointed to by 'target'. After a 'null' type is verified we make
 * sure that 'path' and 'target' are the same path - we cannot check the
 * inode because 'path' does not exist.
 *
 * @param {Object} statObj The object described above.
 */
function checkPath(statObj) {
  var types = statObj.type.split('.');
  var stats;
  var type = types[0];
  var nextPath;

  function msg(text) {
    return sprintf('%s: %s', text, statObj.path);
  }

  if (type !== 'null') {
    stats = fs.lstatSync(statObj.path);
  }

  if (type === 'symlink') {
    assert.ok(stats.isSymbolicLink(), msg('not a symlink'));
    if (types.length > 1) {
      checkPath({
        path: fs.readlinkSync(statObj.path),
        type: types.slice(1).join('.'),
        target: statObj.target
      });
    }
  }
  else {
    if (type === 'file') {
      assert.ok(stats.isFile(), msg('not a file'));
    }
    else if (type === 'directory') {
      assert.ok(stats.isDirectory(), msg('not a directory'));
    }
    else if (type === 'null') {
      assert.equal(path.existsSync(statObj.path), false, msg('exists'));
    }
    else {
      throw new Error(sprintf('Unknown checkPath type: %s', type));
    }

    if (statObj.target) {
      // On a file or directory make sure the inodes match
      if (type !== 'null') {
        assert.equal(stats.ino, fs.lstatSync(statObj.target).ino,
                     msg('incorrect inode'));
      }
      // On a 'null' type just make sure the paths match
      else {
        assert.equal(path.resolve(statObj.path),
                     path.resolve(statObj.target),
                     msg('incorrect target'));
      }
    }
  }
}

exports.checkPath = checkPath;
