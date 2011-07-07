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
var exec = require('child_process').exec;

var async = require('async');
var sprintf = require('sprintf').sprintf;

var managers = require('cast-agent/managers');
var control = require('control');

var TMPDIR = path.join('.tests', 'tmp');


exports['setUp'] = function(test, assert) {
  exec(sprintf('mkdir -p "%s"', TMPDIR), function(err) {
    assert.ifError(err);
    managers.initManagers(function(err) {
      assert.ifError(err);
      test.finish();
    });
  });
};


exports['test_bundles'] = function(test, assert) {
  var appName = 'fooapp';
  var expected = 'dttvIChGMloP9XkkVtWMPKDPcfQ=';

  async.series([
    // List applications (should be none)
    function(callback) {
      control.bundles.listApplications(function(err, apps) {
        assert.ifError(err);
        assert.deepEqual(apps, []);
        callback();
      });
    },

    // Retrieve a nonexistant application
    function(callback) {
      control.bundles.getApplication(appName, function(err, app) {
        var msg = 'BundleApplication \'' + appName + '\' does not exist.';
        assert.equal(err.message, msg);
        callback();
      });
    },

    // Try to add a bundle with a bad sha1, make sure getSHA1 isn't called
    // until the stream has ended.
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);
      var ended = false;

      tbStream.on('end', function() {
        ended = true;
      });

      function getSHA1(callback) {
        assert.ok(ended);
        callback(null, 'anInv1l3dshA1H4sh');
      }

      control.bundles.addBundle(appName, '1.0', tbStream, getSHA1, function(err) {
        assert.ok(err.message, 'SHA1 Mismatch');
        callback();
      });
    },

    // List applications (should be none still)
    function(callback) {
      control.bundles.listApplications(function(err, apps) {
        assert.ifError(err);
        assert.deepEqual(apps, []);
        callback();
      });
    },

    // Retrieve a nonexistant application
    function(callback) {
      control.bundles.getApplication(appName, function(err, app) {
        var msg = 'BundleApplication \'' + appName + '\' does not exist.';
        assert.equal(err.message, msg);
        callback();
      });
    },

    // Add a bundle with a good sha1, make sure getSHA1 isn't called until the
    // stream has ended.
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);
      var ended = false;

      tbStream.on('end', function() {
        ended = true;
      });

      function getSHA1(callback) {
        assert.ok(ended);
        callback(null, expected);
      }

      control.bundles.addBundle(appName, '1.0', tbStream, getSHA1, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // List applications (should be one)
    function(callback) {
      control.bundles.listApplications(function(err, apps) {
        assert.ifError(err);
        assert.deepEqual(apps, [
          {
            name: 'fooapp',
            bundles: [
              'fooapp@1.0.tar.gz'
            ]
          }
        ]);
        callback();
      });
    },

    // Retrieve the now-existing application
    function(callback) {
      control.bundles.getApplication(appName, function(err, app) {
        assert.ifError(err);
        assert.deepEqual(app, {
          name: 'fooapp',
          bundles: [
            'fooapp@1.0.tar.gz'
          ]
        });
        callback();
      });
    },

    // Attempt to re-add the same version
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);

      control.bundles.addBundle(appName, '1.0', tbStream, function(err) {
        var msg = 'Bundle \'' + appName + '@1.0\' already exists.';
        assert.equal(err.message, msg);
        callback();
      });
    },

    // Attempt to add the same bundle twice at the same time
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream1 = fs.createReadStream(tbpath);
      var tbStream2 = fs.createReadStream(tbpath);

      control.bundles.addBundle(appName, '1.5', tbStream1, function(err) {
        assert.ifError(err);
        callback();
      });

      control.bundles.addBundle(appName, '1.5', tbStream2, function(err) {
        var msg = 'Upload already in progress for ' + appName + '@1.5';
        assert.equal(err.message, msg);
      });
    },

    // Retrieve the application, now with 2 bundles
    function(callback) {
      control.bundles.getApplication(appName, function(err, app) {
        assert.ifError(err);
        assert.deepEqual(app, {
          name: 'fooapp',
          bundles: [
            'fooapp@1.0.tar.gz',
            'fooapp@1.5.tar.gz'
          ]
        });
        callback();
      });
    },

    // Add a bundle to a new application
    function(callback) {
      var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
      var tbStream = fs.createReadStream(tbpath);

      control.bundles.addBundle('barapp', '1.0', tbStream, function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // List applications (should be two now)
    function(callback) {
      control.bundles.listApplications(function(err, apps) {
        assert.ifError(err);
        assert.deepEqual(apps, [
          {
            name: 'barapp',
            bundles: [
              'barapp@1.0.tar.gz'
            ]
          },
          {
            name: 'fooapp',
            bundles: [
              'fooapp@1.0.tar.gz',
              'fooapp@1.5.tar.gz'
            ]
          }
        ]);
        callback();
      });
    },

    // Retrieve a bundle stream for a non-existant stream
    function(callback) {
      control.bundles.getBundle(appName, '6.0', function(err, oStream) {
        var msg = 'Bundle \'' + appName + '@6.0\' does not exist.';
        assert.equal(err.message, msg);
        callback();
      });
    },

    // Retrieve a bundle stream for an existing bundle
    function(callback) {
      var fpath = path.join(TMPDIR, 'fooapp@1.5.tar.gz');
      var fstream = fs.createWriteStream(fpath);
      control.bundles.getBundle(appName, '1.0', function(err, oStream) {
        oStream.pipe(fstream);
        oStream.on('error', function(err) {
          assert.ifError(err);
          assert.fail();
        });
        fstream.on('close', function() {
          exec(sprintf('md5sum %s', fpath), function(err, stdout) {
            assert.ifError(err);
            assert.equal(stdout.split(' ')[0], '7c730980cb710e040ff0cb70153b6c63');
            callback();
          });
        });
      });
    },

    // Delete one bundle of the first application
    function(callback) {
      control.bundles.removeBundle(appName, '1.5', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // List applications (should be two now)
    function(callback) {
      control.bundles.listApplications(function(err, apps) {
        assert.ifError(err);
        assert.deepEqual(apps, [
          {
            name: 'barapp',
            bundles: [
              'barapp@1.0.tar.gz'
            ]
          },
          {
            name: 'fooapp',
            bundles: [
              'fooapp@1.0.tar.gz'
            ]
          }
        ]);
        callback();
      });
    },

    // Delete the other bundle of the first application
    function(callback) {
      control.bundles.removeBundle(appName, '1.0', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // List applications (down to one now)
    function(callback) {
      control.bundles.listApplications(function(err, apps) {
        assert.ifError(err);
        assert.deepEqual(apps, [
          {
            name: 'barapp',
            bundles: [
              'barapp@1.0.tar.gz'
            ]
          }
        ]);
        callback();
      });
    },

    // Remove the last bundle
    function(callback) {
      control.bundles.removeBundle('barapp', '1.0', function(err) {
        assert.ifError(err);
        callback();
      });
    },

    // Nothing left?
    function(callback) {
      control.bundles.listApplications(function(err, apps) {
        assert.ifError(err);
        assert.deepEqual(apps, []);
        callback();
      });
    }
  ],

  function(err) {
    assert.ifError(err);
    test.finish();
  });
};
