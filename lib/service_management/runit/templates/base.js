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

var sprintf = require('sprintf').sprintf;

var misc = require('util/misc');
var config = require('util/config');

var manifestConstants = require('manifest/constants');

function buildRunFile(cmd, rootDirectory, redir) {
  var runLine = [];
  var chpstArgs = ['chpst'];
  var i, chpstArgsLen, chpstArg, runText;

    var svlogdUser = config.get()['runit']['svlogd_daemon_user'];
    if (svlogdUser) {
      chpstArgs.push(sprintf('-u %s', svlogdUser));
    }

    if (rootDirectory) {
      runLine.push(sprintf('cd "%s" ;', rootDirectory));
      chpstArgs.push(sprintf('-l %s', rootDirectory));
    }

    chpstArgsLen = chpstArgs.length;

    // Temporary disable chpst because for chpst to work runit needs to run as
    // root
    if (chpstArgsLen && false) {
      for (i = 0; i < chpstArgsLen; i++) {
        chpstArg = chpstArgs[i];
        runLine.push(chpstArg);
      }
    }

    runLine.push('exec');
    runLine.push(cmd);

    if (redir) {
      runLine.push('2>&1');
    }

    runText = runLine.join(' ');

    var file = [
      '#!/bin/bash',
      runText
    ];

    return file.join('\n');
}

/**
 * Get a template that can be used to generate a runit service configuration
 * using templateToTree.
 *
 * @param {Object} templateArgs  An object containing: serviceName, instancePath, entryFile.
 * @param {Function} callback     A callback that takes (err, template).
 */
function getApplicationTemplate(templateArgs, callback) {
  var getRunitTemplate, template, chpst, i;
  var requiredArgs = ['applicationType', 'serviceName'];
  for (i = 0; i < requiredArgs.length; i++) {
    if (!templateArgs[requiredArgs[i]]) {
      callback(new Error(requiredArgs[i] + ' not specified for base runit template'));
      return;
    }
  }

  var applicationType = templateArgs.applicationType;
  var serviceName = templateArgs.serviceName;
  var runitConf = config.get()['runit'];

  if (!misc.inArray(applicationType, manifestConstants.APPLICATION_TYPES)) {
    callback(new Error(sprintf('Invalid application type %s', applicationType)));
    return;
  }

  try {
    getRunitTemplate = require(sprintf('./%s', applicationType)).getTemplate;
  }
  catch (error) {
    callback(new Error(sprintf('Cannot load template module for application type %s', applicationType)));
    return;
  }

  getRunitTemplate(templateArgs, function(error, template) {
    if (error) {
      callback(error);
      return;
    }

    var logCmd = sprintf('svlogd -tt ./%s', runitConf['log_directory']);
    var configFile = [
      runitConf.maxLogSize,
      runitConf.maxLogNum
    ].join('\n');

    template = misc.merge({
      run: '#!/bin/bash\n# Stub run file\nexit 0',
      finish: sprintf("#!/bin/sh\necho 'Service %s stopped'\nsleep 1\nexit 0", serviceName),
      down: "# Down file so it doesn't start up automagically",
      log: {
        'run': buildRunFile(logCmd),
        'config': configFile,
        main: {}
      }
    }, template);

    callback(null, template);
  });
}

exports.buildRunFile = buildRunFile;
exports.getApplicationTemplate = getApplicationTemplate;
