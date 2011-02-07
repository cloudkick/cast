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

var async = require('extern/async');

var templates = require('util/templates');
var assert = require('assert');

var DATA_DIR = path.join(process.cwd(), 'data');
var TEMPLATES_PATH = path.join(DATA_DIR, 'templates');
var RENDERED_PATH = path.join(process.cwd(), '.tests', 'templates_rendered');


(function() {
  var completed = false;
  async.series([
    // Test get_template_context with various arguments
    function(callback) {
      templates.get_template_context(false, {}, function(error, context) {
        assert.equal(context.facts, undefined);
        callback();
      });
    },

    function(callback) {
      templates.get_template_context(true, {'name': 'cast'}, function(error, context) {
        assert.notEqual(context.facts, undefined);
        assert.notEqual(context.facts.hostname, '');
        assert.equal(context.name, 'cast');
        callback();
      });
    },

    // Test render_template_as_string with various arguments
    function(callback) {
      templates.render_template_as_string('/invalid/path', {}, function(error) {
        assert.notEqual(error, undefined);
        assert.match(error.message, /ENOENT/i);
        callback();
      });
    },

    function(callback) {
      templates.render_template_as_string(path.join(TEMPLATES_PATH, 'template.html'), {}, function(error, rendered_template) {
        assert.equal(error, undefined);
        assert.match(rendered_template, /Hello \./i);
        callback();
      });
    },

    function(callback) {
      templates.render_template_as_string(path.join(TEMPLATES_PATH, 'template.html'),
                                          {'name': 'cast'},
                                          function(error, rendered_template)
      {
        assert.equal(error, undefined);
        assert.match(rendered_template, /Hello cast\./i);
        callback();
      });
    },

    // Test render_and_save_templates
    function(callback) {
      var template1_path = path.join(RENDERED_PATH, 'template.html');
      var template2_path = path.join(RENDERED_PATH, 'subdir1/template2.html');

      templates.render_and_save_templates(TEMPLATES_PATH, ['template.html', 'subdir1/template2.html'],
                                          RENDERED_PATH, {'name': 'cast'}, function(error)
      {
        assert.equal(error, undefined);
        assert.isDefined(fs.statSync(template1_path).ino);
        assert.isDefined(fs.statSync(template2_path).ino);
        assert.equal(fs.readFileSync(template1_path).toString(), 'Hello cast.');
        assert.equal(fs.readFileSync(template1_path).toString(), 'Hello cast.');
        callback();
      });

    }
  ],
  function(err) {
    completed = true;
    assert.ifError(err);
  });

  process.on('exit', function() {
    assert.ok(completed, 'Tests completed');
  });
})();
