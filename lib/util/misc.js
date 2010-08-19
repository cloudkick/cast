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

/**
 * Short utility functions that otherwise wouldn't have a home.
 */

var path = require('path');

/* 
* very simple object merging
* TODO: import mixin from jquery / dojo for real objects
*/
exports.merge = function (a, b)
{
  var c = {};
  var attrname;
  for (attrname in a) {
    if (a.hasOwnProperty(attrname)) {
      c[attrname] = a[attrname];
    }
  }
  for (attrname in b) {
    if (b.hasOwnProperty(attrname)) {
      c[attrname] = b[attrname];
    }
  }
  return c;
};

exports.expanduser = function(pstr)
{
  if (pstr.indexOf("~") !== 0) {
    return pstr;
  }
  
  var splitter = pstr.indexOf('/');
  var user = "";
  if (splitter == -1) {
    user = pstr.substr(1);
    pstr = "/";
  }
  else {
    user = pstr.substring(1, splitter);
    pstr = pstr.substr(splitter+1);
  }

  if (user.length !== 0) {
    /* TODO: need bindings to getpwnam to make this work for the non-current */
    throw "no bindings to getpwnam, so you can't do get info for user: "+ user;
  }

  if (process.env.HOME === undefined) {
    throw "no bindings to getpwnam, and env[HOME] was undefined";
  }

  return path.join(process.env.HOME, pstr);
};

/**
 * Converts an object to a directory tree, where objects are treated as
 * directories and anything else is dumped to a regular file as a string.
 *
 * @param {String} basedir  The path to the tree's (not-yet-existing) root
 * @param {Object} basedir  The object to use as a template
 * @param {Function} cb     Callback, taking a possible error
 */
exports.template_to_tree = function(basedir, template, cb) {
  var actions = [
    async.apply(fs.mkdir, basedir, 0700)
  ];

  function recurse_action(basedir, key) {
    var curpath = path.join(basedir, key);
    return function(callback) {
      // Recurse on sub-templates
      if (typeof(template[key]) === 'object') {
        template_to_tree(curpath, template[key], callback);
      }
      // Render anything else to files
      else {
        fs.open(curpath, 'w', 0700, function(err, fd) {
          if (err) {
            callback(err);
          }
          else {
            fs.write(fd, template[key].toString(), callback);
          }
        });
      }
    };
  }

  // Build a list of actions to fill in this level of the tree
  for (var key in template) {
    if (template.hasOwnProperty(key)) {
      actions.push(recurse_action(basedir, key));
    }
  }

  // Execute the action sequence
  async.parallel(actions, cb);
};

