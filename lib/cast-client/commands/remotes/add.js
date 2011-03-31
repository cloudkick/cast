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

var sys = require('sys');
var url = require('url');
var fs = require('fs');

var async = require('async');
var sprintf = require('sprintf').sprintf;
var Errorf = require('util/misc').Errorf;

var dotfiles = require('util/client_dotfiles');
var http = require('util/http');
var terminal = require('util/terminal');

var config = {
  shortDescription: 'Add a remote',
  longDescription: 'Add a reference to a remote cast-agent',
  requiredArguments: [
    ['name', 'A name for the remote'],
    ['url', 'The URL to the remote']
  ],
  optionalArguments: [],
  options: [
    {
      names: ['--default', '-d'],
      dest: 'make_default',
      action: 'store_true',
      desc: 'Make this remote the default. Up to one default remote may be ' +
            'specified for each project, as well as one global default. If ' +
            'another default already exists, this will become the default ' +
            'instead.'
    },
    {
      names: ['--overwrite', '-o'],
      dest: 'overwrite',
      action: 'store_true',
      desc: 'Use this option if you want to overwrite an existing remote.'
    },
    {
      names: ['--project', '-p'],
      dest: 'project',
      action: 'store_true',
      desc: 'Add the remote only to the current project. This will override ' +
            'any global remote with the same name, and a default project ' +
            'remote, if one exists, will take precedent over the global one.'
    },
    {
      names: ['--accept', '-y'],
      dest: 'accept',
      action: 'store_true',
      desc: 'Accept the remote certificate without prompting. This is ' +
            'almost certainly a bad idea.'
    }
  ]
};

function handleCommand(args) {
  var conf = require('util/config').get();

  var calls = [
    // Make sure ~/.cast exists
    function(callback) {
      if (args.project) {
        // This also passes back the path which we don't want
        dotfiles.ensureDotCastProject(process.cwd(), function(err) {
          callback(err);
        });
      }
      else {
        dotfiles.ensureDotCast(callback);
      }
    },

    // Get or create the current remotes object
    function(callback) {
      if (args.project) {
        dotfiles.getLocalRemotes(callback);
      }
      else {
        dotfiles.getGlobalRemotes(callback);
      }
    },

    function(remotes, callback) {
      // Check if remote with this name already exists
      if (remotes[args.name] && !args.overwrite) {
        callback(new Errorf('Remote with name "%s" already exists. ' +
                            'Use --overwrite option if you want to ' +
                            'overwrite an existing remote', args.name));
        return;
      }

      callback(null, remotes);
    }
  ];

  if (url.parse(args.url).protocol === 'https:') {
    calls = calls.concat([
      function(remotes, callback) {
        // Fetch the server SSL certificate information
        http.getServerCertInfo(args.url, function(err, certInfo) {
          if (err) {
            callback(err);
            return;
          }
          callback(null, remotes, certInfo);
        });
      },

      function(remotes, certInfo, callback) {
        var hostname, port, fingerprint;

        function printCertData(data) {
          var key;
          for (key in data) {
            if (data.hasOwnProperty(key)) {
              sys.puts(sprintf('    %s: %s', key, data[key]));
            }
          }
        }

        if (args.accept) {
          callback(null, remotes, certInfo['fingerprint']);
          return;
        }

        // Show ertificate information to user and ask before accepting
        sys.puts('Certificate information');
        sys.puts('  Subject:');
        printCertData(certInfo['subject']);
        sys.puts('  Issuer:');
        printCertData(certInfo['issuer']);
        sys.puts(sprintf('  Valid to: %s', certInfo['valid_to']));
        sys.puts(sprintf('  Fingerprint: %s', certInfo['fingerprint']));
        sys.puts('');

        terminal.prompt('Are you sure you want to accept this certificate?', ['y', 'n'], 'y', function(data) {
          if (data === 'y') {
           callback(null, remotes, certInfo['fingerprint']);
           return;
          }

          callback(new Error('Certificate not accepted, remote not added'));
        });
      }
    ]);
  }
  else {
    calls.push(function(remotes, callback) {
      callback(null, remotes, null);
    });
  }

  // Insert the new remote
  calls.push(function(remotes, fingerprint, callback) {
    var urlObject = url.parse(args.url);
    var hostname = urlObject.hostname;
    var port = urlObject.port || 443;
    var isDefault = args.makeDefault ? true : false;
    var name;

    // If this is the only global remote, make it the default
    var remotesLen = Object.keys(remotes).length;
    if ((!args.project && remotesLen === 0) ||
        (remotesLen === 1 && remotes.hasOwnProperty(args.name))) {
      isDefault = true;
    }

    // Make sure there are no other defaults if this one is default
    if (isDefault) {
      for (name in remotes) {
        if (remotes.hasOwnProperty(name) && remotes[name].is_default) {
          remotes[name].is_default = false;
        }
      }
    }

    remotes[args.name] = {
      'url': args.url,
      'hostname': hostname,
      'port': port,
      'fingerprint': fingerprint,
      'is_default': isDefault
    };

    callback(null, remotes);
  });

  // Write it all back
  calls.push(function(remotes, callback) {
    if (args.project) {
      dotfiles.saveLocalRemotes(remotes, callback);
    } else {
      dotfiles.saveGlobalRemotes(remotes, callback);
    }
  });

  async.waterfall(calls,
  function(err) {
    if (err) {
      sys.puts('Error: ' + err.message);
    }
    else {
      sys.puts('Remote added');
    }
  });
}

exports.config = config;
exports.handleCommand = handleCommand;
