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
      templates.getTemplateContext(false, {}, function(error, context) {
        assert.equal(context.facts, undefined);
        callback();
      });
    },

    function(callback) {
      templates.getTemplateContext(true, {'name': 'cast'}, function(error, context) {
        assert.notEqual(context.facts, undefined);
        assert.notEqual(context.facts.hostname, '');
        assert.equal(context.name, 'cast');
        callback();
      });
    },

    // Test render_template_as_string with various arguments
    function(callback) {
      templates.renderTemplateAsString('/invalid/path', {}, function(error) {
        assert.notEqual(error, undefined);
        assert.match(error.message, /ENOENT/i);
        callback();
      });
    },

    function(callback) {
      templates.renderTemplateAsString(path.join(TEMPLATES_PATH, 'template.html'), {}, function(error, renderedTemplate) {
        assert.equal(error, undefined);
        assert.match(renderedTemplate, /Hello \./i);
        callback();
      });
    },

    function(callback) {
      templates.renderTemplateAsString(path.join(TEMPLATES_PATH, 'template.html'),
                                          {'name': 'cast'},
                                          function(error, renderedTemplate)
      {
        assert.equal(error, undefined);
        assert.match(renderedTemplate, /Hello cast\./i);
        callback();
      });
    },

    // Test render_and_save_templates
    function(callback) {
      var template1Path = path.join(RENDERED_PATH, 'template.html');
      var template2Path = path.join(RENDERED_PATH, 'subdir1/template2.html');

      templates.renderAndSaveTemplates(TEMPLATES_PATH, ['template.html', 'subdir1/template2.html'],
                                          RENDERED_PATH, {'name': 'cast'}, function(error)
      {
        assert.equal(error, undefined);
        assert.isDefined(fs.statSync(template1Path).ino);
        assert.isDefined(fs.statSync(template2Path).ino);
        assert.equal(fs.readFileSync(template1Path).toString(), 'Hello cast.');
        assert.equal(fs.readFileSync(template1Path).toString(), 'Hello cast.');
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
