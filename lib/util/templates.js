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

var norris = require('norris');

var misc = require('util/misc');

var async = require('extern/async');
var T = require('extern/strobe-templates/index');

var get_template_context = function(use_norris_facts, context, callback) {
  var template_context = {};

  async.series([function(callback) {
    if (use_norris_facts) {
      norris.get(function(facts) {

        template_context = misc.merge(template_context, {'facts': facts});
        callback();
      });
    }
    else {
      callback();
    }
  }],

  function (error) {
    if (error) {
      return callback(error);
    }

    template_context = misc.merge(template_context, context);

    callback(null, template_context);
  });
};

var render_template_as_string = function(template_path, context, callback) {
  var template = new T.Template(template_path);

  template.load(function(error, template) {
    if (error) {
      return callback(error);
    }

    template.render(context, function(error, output) {
      if (error) {
        return callback(error);
      }

      callback(null, output.join(''));
    });
  });
};
