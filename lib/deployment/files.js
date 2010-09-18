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
exports.resolve_data_files = function(extracted_bundle_path, data_path, instance_path,  data_files, callback) {
  var paths_to_link = [];

  data_files = misc.filter_repeated_paths(data_files);
  async.forEach(data_files, function(data_file, callback) {
    var source_file_path = path.join(extracted_bundle_path, data_file);
    var data_file_path = path.join(data_path, data_file);
    var instance_file_path = path.join(instance_path, data_file);

    var add_to_paths_to_link_array = function() {
      paths_to_link.push([data_file_path, instance_file_path]);
      callback();
    };

    // Check if the path exists in the extracted bundle directory and if it does, copy it to the instance data
    // directory before creating a symbolic link
    path.exists(source_file_path, function(exists) {
      if (exists) {
        fs.stat(source_file_path, function(err, stats) {
          if (stats.isDirectory()) {
            fsutil.copy_tree(source_file_path, data_file_path, add_to_paths_to_link_array);
          }
          else {
            fsutil.copy_file(source_file_path, data_file_path, add_to_paths_to_link_array);
          }
        });
      }
      else {
        var directory, directory_index, data_directory;
        var slash_position = data_file.lastIndexOf('/');

        if (slash_position !== -1) {
          // This path is a directory or contains directories
          if (slash_position !== (data_file.length - 1)) {
            directory = path.dirname(data_file);
          }
          else {
            directory = data_file;
          }

          // Create a directory tree which is required for creating a symlink for the file / directory listed in the
          // data_files array
          data_directory = data_file_path.substr(0, data_file_path.lastIndexOf(directory) + directory.length);
          fsutil.mkdir(data_directory, 0755, add_to_paths_to_link_array);
        }
        else {
          add_to_paths_to_link_array();
        }
      }
    });
  },

  function(err) {
    if (err) {
      callback(err);
    }

    // Create symbolic links for all the paths in the paths_to_link array
    fsutil.symbolic_link_files(paths_to_link, true, callback);
  });
};
