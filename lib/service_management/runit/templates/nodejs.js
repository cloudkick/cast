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

var sprintf = require('sprintf').sprintf;
var base = require('./base');

var norris = require('norris');

/**
 * Get the non-standard portions of a 'runit' service template.
 *
 * @param {Object} templateArgs  An object containing: instancePath, entryFile.
 * @param {Function} callback     A callback that takes (err, template).
 */
var getTemplate = function(templateArgs, callback) {
  var i;
  var requiredArgs = ['instancePath', 'entryFile'];
  for (i = 0; i < requiredArgs.length; i++) {
    if (!templateArgs[requiredArgs[i]]) {
      callback(new Error(requiredArgs[i] + ' not specified for nodejs runit template'));
      return;
    }
  }

  var instancePath = templateArgs.instancePath;
  var entryFile = templateArgs.entryFile;

  norris.get(function(facts) {
    if (!facts || !facts.hasOwnProperty('node_binary')) {
      callback(new Error('Cannot retrieve path to the node binary'));
      return;
    }

    var entryPath = path.join(instancePath, entryFile);
    var runCmd = sprintf('%s %s', facts['node_binary'], entryPath);

    var template = {
      run: base.buildRunFile(runCmd, true)
    };

    callback(null, template);
  });
};

exports.getTemplate = getTemplate;
