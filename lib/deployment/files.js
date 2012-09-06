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
var path = require('path');

var async = require('async');

var config = require('util/config');
var fsutil = require('util/fs');
var misc = require('util/misc');
var flowctrl = require('util/flow_control');

/**
 * Resolves data files (copies existing files / directories from the extracted bundle path to the instance data
 * directory and create a symlink from the data directory to instance directory for all the paths specified in the
 * dataFiles Array)
 *
 * @param {String} extractedBundlePath Path to the extracted bundle.
 * @param {String} dataPath Path to the data directory for the specified instance.
 * @param {Array} dataFiles Array of data files (this value should come from the manifest file).
 * @param {Function} callback Callback which is called with a possible error.
 */
function resolveDataFiles(extractedBundlePath, dataPath, instancePath, dataFiles, callback) {
  var pathsToLink = [];
  var directoryString, callbackFunc;

  // Add a path to the array which we will later use to create appropriate
  // symlinks
  function addToPathsToLinkArray(err, dataFilePath, instanceFilePath, callback) {
    if (err) {
      callback();
      return;
    }

    pathsToLink.push([dataFilePath, instanceFilePath]);
    callback();
  }

  // Return a directory string from the provided path.
  // Note: The provided path must not contain leading slash but it must
  // contain trailing slash if it is directory.
  //
  // For example:
  // dir/foo/bar/some.tar.gz -> dir/foo/bar/
  // dir1/dir2/ -> dir1/dir2/
  function getDirectoryStringFromPath(dataFile) {
    var directory, directoryIndex, dataDirectory;
    var slashPosition = dataFile.lastIndexOf('/');

    if (slashPosition !== -1) {
      // This path is a directory or contains directories
      if (slashPosition !== (dataFile.length - 1)) {
        return path.dirname(dataFile);
      }
      else {
        return dataFile;
      }
    }

    return null;
  }

  // Create a directory tree which is required for creating a symlink for the
  // file / directory listed in the dataFiles array
  function createDirectoryTree(dataFilePath, directory, callback) {
    var dataDirectory = dataFilePath.substr(0, dataFilePath.lastIndexOf(directory) + directory.length);
    flowctrl.callIgnoringError(fsutil.mkdir, null, dataDirectory, 0755,
                               callback);
  }


  dataFiles = misc.filterRepeatedPaths(dataFiles);
  async.forEachSeries(dataFiles, function(dataFile, callback) {
    var sourceFilePath = path.join(extractedBundlePath, dataFile);
    var dataFilePath = path.join(dataPath, dataFile);
    var instanceFilePath = path.join(instancePath, dataFile);
    var dataFileIsDirectory = (dataFile[dataFile.length - 1] === '/');

    // Check if the path exists in the extracted bundle directory and if it
    // does, copy it to the instance data directory before creating a symbolic
    // link
    path.exists(sourceFilePath, function(exists) {
      if (exists) {
        fs.stat(sourceFilePath, function(err, stats) {
          if (stats.isDirectory()) {
            if (dataFileIsDirectory) {
              fsutil.copyTree(sourceFilePath, dataFilePath, function(err) {
                if (err) {
                  callback(err);
                  return;
                }

                addToPathsToLinkArray(null, dataFilePath, instanceFilePath,
                                      callback);
                return;
              });
            } else {
              // Ignore this path. It is a file but user did not specify mandatory
              // trailing slash
              callback();
            }
          }
          else {
            directoryString = getDirectoryStringFromPath(dataFile);

            callbackFunc = async.apply(addToPathsToLinkArray, null,
                                       dataFilePath, instanceFilePath,
                                       callback);
            if (!directoryString) {
              // Just a file, no need to create container directories before
              // copying it
              callbackFunc = async.apply(addToPathsToLinkArray, null,
                                         dataFilePath, instanceFilePath,
                                         callback);
              fsutil.copyFile(sourceFilePath, dataFilePath, callbackFunc);
            }
            else {
              createDirectoryTree(dataFilePath, directoryString, function() {
                fsutil.copyFile(sourceFilePath, dataFilePath, callbackFunc);
              });
            }
          }
        });
      }
      else {
        directoryString = getDirectoryStringFromPath(dataFile);

        if (directoryString) {
          // Create a directory tree which is required for creating a symlink for the file / directory listed in the
          // dataFiles array]
          callbackFunc = async.apply(addToPathsToLinkArray, null, dataFilePath,
                                     instanceFilePath, callback);
          createDirectoryTree(dataFilePath, directoryString, callbackFunc);
        }
        else {
          // We allow user to specify paths to data files and directories which
          // currently don't yet exist.
          addToPathsToLinkArray(null, dataFilePath, instanceFilePath, callback);
        }
      }
    });
  },

  function(err) {
    if (err) {
      callback(err);
    }

    // Create symbolic links for all the paths in the paths_to_link array
    fsutil.symbolicLinkFiles(pathsToLink, true, callback);
  });
}

exports.resolveDataFiles = resolveDataFiles;
