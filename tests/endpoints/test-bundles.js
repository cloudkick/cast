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

var async = require('async');
var sprintf = require('sprintf').sprintf;

var jobs = require('jobs');
var control = require('control');
var testUtil = require('util/test');
var hashedstream = require('util/hashedstream');
var http = require('services/http');
var getServer = http.getAndConfigureServer;


var applications = [
  {
    name: 'foo',
    bundles: [
      'foo@1.0',
      'foo@2.0'
    ]
  },
  {
    name: 'bar',
    bundles: [
      'bar@10.1',
      'bar@10.2'
    ]
  }
];


control.bundles = {
  listApplications: function(callback) {
    callback(null, applications);
  },

  getApplication: function(name, callback) {
    var app = applications.filter(function(app) {
      return app.name === name;
    })[0];

    if (app) {
      callback(null, app);
    } else {
      callback(new jobs.NotFoundError('BundleApplication', name));
    }
  },

  addBundle: function(name, version, iStream, getSHA1, callback) {
    if (!callback) {
      callback = getSHA1;
      getSHA1 = undefined;
    }

    var fname = sprintf('%s@%s', name, version);

    if (name === 'bar') {
      callback(new jobs.AlreadyExistsError('Bundle', fname));
      return;
    }

    var hs = new hashedstream.HashedStream('sha1');
    iStream.pipe(hs);

    hs.on('hash', function(hash) {
      var received = hash.digest('base64');
      if (!getSHA1 && received !== 'dttvIChGMloP9XkkVtWMPKDPcfQ=') {
        throw new Error('Uncaught SHA1 mismatch');
      } else if(!getSHA1) {
        callback();
        return;
      }

      getSHA1(function(err, expected) {
        if (!err && received !== expected) {
          err = new Error('SHA1 mismatch');
          err.responseCode = 400;
          console.log(err);
        }
        callback(err);
      });
    });
  },

  getBundle: function(name, version, callback) {
    var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
    var fname = sprintf('%s@%s', name, version);

    if (name === 'bar') {
      callback(new jobs.NotFoundError('Bundle', fname));
    } else {
      callback(null, fs.createReadStream(tbpath));
    }
  },

  removeBundle: function(name, version, callback) {
    var fname = sprintf('%s@%s', name, version);
    if (fname === 'foo@1.0') {
      callback();
    } else {
      callback(new jobs.NotFoundError('Bundle', fname));
    }
  }
};


exports['test_list'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, applications);
    test.finish();
  });
};


exports['test_get_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/foo/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, applications[0]);
    test.finish();
  });
};


exports['test_get_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/baz/', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body.message, 'BundleApplication \'baz\' does not exist.');
    test.finish();
  });
};


exports['test_add_bundle_success'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/foo/foo@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 204);
    test.finish();
  });
};


exports['test_add_bundle_sha1trailer_success'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/foo/foo@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  req.trailers = {
    'x-content-sha1': 'dttvIChGMloP9XkkVtWMPKDPcfQ='
  };
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 204);
    test.finish();
  });
};


exports['test_add_bundle_sha1trailer_mismatch'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/foo/foo@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  req.trailers = {
    'x-content-sha1': 'dttvIChGMloP9XkkXtWMPKDPcfQ='
  };
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 400);
    test.finish();
  });
};


exports['test_add_bundle_sha1header_success'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/foo/foo@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  req.headers = {
    'x-content-sha1': 'dttvIChGMloP9XkkVtWMPKDPcfQ='
  };
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 204);
    test.finish();
  });
};


exports['test_add_bundle_sha1header_mismatch'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/foo/foo@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  req.headers = {
    'x-content-sha1': 'dttvIChGMloP9XkkXtWMPKDPcfQ='
  };
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 400);
    test.finish();
  });
};


exports['test_add_bundle_409'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/bar/bar@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'Bundle \'bar@3.0\' already exists.');
    test.finish();
  });
};


exports['test_add_bundle_invalid'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/foo/bar@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Invalid bundle path');
    test.finish();
  });
};


exports['test_add_bundle_sha1trailer_missing'] = function(test, assert) {
  var tbpath = path.join(process.cwd(), 'data/fooserv.tar.gz');
  var req = testUtil.getReqObject('/bundles/foo/foo@3.0.tar.gz', 'PUT');
  req.streamer = function(request) {
    var tbStream = fs.createReadStream(tbpath);
    tbStream.pipe(request);
  };
  req.headers = {
    'trailer': 'x-content-sha1'
  };
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Missing x-content-sha1 trailer');
    test.finish();
  });
};


exports['test_get_bundle_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/foo/foo@3.0.tar.gz', 'GET');
  req.streamResponse = true;
  assert.response(getServer(), req, function(res) {
    var hs = new hashedstream.HashedStream('sha1');
    res.pipe(hs);
    hs.on('hash', function(sha1) {
      assert.equal(res.statusCode, 200);
      assert.equal(sha1.digest('base64'), 'dttvIChGMloP9XkkVtWMPKDPcfQ=');
      test.finish();
    });
  });
};


exports['test_get_bundle_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/bar/bar@3.0.tar.gz', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Bundle \'bar@3.0\' does not exist.');
    test.finish();
  });
};


exports['test_get_bundle_invalid'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/foo/bar@3.0.tar.gz', 'GET');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Invalid bundle path');
    test.finish();
  });
};


exports['test_delete_bundle_success'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/foo/foo@1.0.tar.gz', 'DELETE');
  assert.response(getServer(), req, function(res) {
    assert.equal(res.statusCode, 204);
    test.finish();
  });
};


exports['test_delete_bundle_404'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/bar/bar@1.0.tar.gz', 'DELETE');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Bundle \'bar@1.0\' does not exist.');
    test.finish();
  });
};


exports['test_delete_bundle_invalid'] = function(test, assert) {
  var req = testUtil.getReqObject('/bundles/foo/bar@1.0.tar.gz', 'DELETE');
  assert.responseJson(getServer(), req, function(res) {
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Invalid bundle path');
    test.finish();
  });
};
