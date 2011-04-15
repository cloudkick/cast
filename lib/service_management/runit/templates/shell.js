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

/**
 * Get the non-standard portions of a 'runit' service template.
 *
 * @param {Object} templateArgs  An object containing: instancePath, entryFile.
 * @param {Function} callback     A callback that takes (err, template).
 */
function getTemplate(templateArgs, callback) {
  var i;
  var requiredArgs = ['instancePath', 'entryFile'];
  for (i = 0; i < requiredArgs.length; i++) {
    if (!templateArgs[requiredArgs[i]]) {
      callback(new Error(requiredArgs[i] + ' not specified for shell runit template'));
      return;
    }
  }

  var instancePath = templateArgs.instancePath;
  var entryFile = templateArgs.entryFile;

  var entryPath = path.join(instancePath, entryFile);
  var runCmd = sprintf('/bin/sh %s', entryPath);

  var template = {
    run: base.buildRunFile(runCmd, templateArgs.instancePath, true)
  };

  callback(null, template);
}

exports.getTemplate = getTemplate;
