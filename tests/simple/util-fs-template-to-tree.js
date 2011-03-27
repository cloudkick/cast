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
var fsutil = require('util/fs');
var async = require('extern/async');
var assert = require('assert');

exports['test_templateToTreeSimple_complex'] = function() {
  var tmpl = {
    afile: "simple file",
    subdir: {
      "subfile": "subfile contents"
    }
  };

  async.series([
    function(callback) {
      fs.mkdir, '.tests/fsutil', 0700, function(err) {
        callback();
      }
    },

    // Render a template to a tree
    function(callback) {
      fsutil.templateToTree('.tests/fsutil/template', tmpl, false, callback);
    },

    // Make sure it worked as expected
    function(callback) {
      fs.stat('.tests/fsutil/template', function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        assert.equal(stats.mode & 0777, 0700);
        callback();
      });
    },

    function(callback) {
      fs.stat('.tests/fsutil/template/subdir', function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());
        assert.equal(stats.mode & 0777, 0700);
        callback();
      });
    },

    function(callback) {
      fs.stat('.tests/fsutil/template/afile', function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isFile());
        assert.equal(stats.mode & 0777, 0700);
        callback();
      });
    },

    function(callback) {
      fs.stat('.tests/fsutil/template/subdir/subfile', function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isFile());
        assert.equal(stats.mode & 0777, 0700);
        callback();
      });
    },

    // Attempt to re-render the template - this should fail
    function(callback) {
      fsutil.templateToTree('.tests/fsutil/template', tmpl, false, function(err) {
        assert.ok(err);
        assert.equal(err.errno, 17);
        callback();
      });
    },

    // Attempt to re-render the template with ignore_existing set
    function(callback) {
      fsutil.templateToTree('.tests/fsutil/template', tmpl, true, function(err) {
        assert.ifError(err);
        callback();
      });
    },
  ],

  function(err) {
    assert.ifError(err);
  });
};

exports['test_templateToTreeSimple'] = function() {
  var tmpl = {
    afile: "simple file",
    subdir: {
      "subfile": "subfile contents"
    }
  };

  async.series([
    function(callback) {
      fs.mkdir('.tests/fsutil', 0700, function(err) {
        callback();
      });
    },

    function(callback) {
      fsutil.templateToTree(".tests/fsutil/template1", tmpl, false, callback);
    },

    function(callback) {
      fs.stat('.tests/fsutil/template1', function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());

        callback();
      });
    },

    function(callback) {
      fs.stat('.tests/fsutil/template1/subdir', function(err, stats) {
        assert.ifError(err);
        assert.ok(stats.isDirectory());

        callback();
      });
    }],

    function(err) {
      assert.ifError(err);
    }
  );
};

exports['test_templateToTree_throws_exception_on_existing_directory'] = function() {
  var tmpl = {
    afile: "simple file",
    subdir: {
      "subfile": "subfile contents"
    }
  };

  fsutil.templateToTree(".tests/fsutil.template1", tmpl, false, function(err) {
    assert.equal(err, undefined);

    fsutil.templateToTree(".tests/fsutil.template1", tmpl, false, function(err) {
      assert.equal(err.errno, 17);
      assert.match(err.message, /eexist/i);

      fsutil.templateToTree(".tests/fsutil.template1", tmpl, true, function(err) {
        assert.equal(err, undefined);
      });
    });
  });
};
