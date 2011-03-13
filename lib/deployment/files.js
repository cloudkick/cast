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

var async = require('extern/async');

var config = require('util/config');
var fsutil = require('util/fs');
var misc = require('util/misc');

/**
 * Resolves data files (copies existing files / directories from the extracted bundle path to the instance data
 * directory and create a symlink from the data directory to instance directory for all the paths specified in the
 * data_files Array)
 *
 * @param {String} extracted_bundle_path Path to the extracted bundle.
 * @param {String} data_path Path to the data directory for the specified instance.
 * @param {Array} data_files Array of data files (this value should come from the manifest file).
 * @param {Function} callback Callback which is called with a possible error.
 */
exports.resolveDataFiles = function(extractedBundlePath, dataPath, instancePath, data_files, callback) {
  var pathsToLink = [];

  data_files = misc.filterRepeatedPaths(data_files);
  async.forEach(data_files, function(dataFile, callback) {
    var sourceFilePath = path.join(extractedBundlePath, dataFile);
    var dataFilePath = path.join(dataPath, dataFile);
    var instanceFilePath = path.join(instancePath, dataFile);
    var dataFileIsDirectory = (dataFile[dataFile.length - 1] === '/');

    var addToPathsToLinkArray = function() {
      pathsToLink.push([dataFilePath, instanceFilePath]);
      callback();
    };

    // Check if the path exists in the extracted bundle directory and if it
    // does, copy it to the instance data directory before creating a symbolic
    // link
    path.exists(sourceFilePath, function(exists) {
      if (exists) {
        fs.stat(sourceFilePath, function(err, stats) {
          if (stats.isDirectory()) {
            if (dataFileIsDirectory) {
              fsutil.copyTree(sourceFilePath, dataFilePath, addToPathsToLinkArray);
              return;
            }

            // Ignore this path
            callback();
          }
          else {
            fsutil.copyFile(sourceFilePath, dataFilePath, addToPathsToLinkArray);
          }
        });
      }
      else {
        var directory, directoryIndex, dataDirectory;
        var slashPosition = dataFile.lastIndexOf('/');

        if (slashPosition !== -1) {
          // This path is a directory or contains directories
          if (slashPosition !== (dataFile.length - 1)) {
            directory = path.dirname(dataFile);
          }
          else {
            directory = dataFile;
          }

          // Create a directory tree which is required for creating a symlink for the file / directory listed in the
          // data_files array
          dataDirectory = dataFilePath.substr(0, dataFilePath.lastIndexOf(directory) + directory.length);
          fsutil.mkdir(dataDirectory, 0755, addToPathsToLinkArray);
        }
        else {
          addToPathsToLinkArray();
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
};
