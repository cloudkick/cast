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

var clutch = require('extern/clutch');
var async = require('extern/async');
var sprintf = require('extern/sprintf').sprintf;

var config = require('util/config');
var templates = require('util/templates');
var misc = require('util/misc');
var fsutil = require('util/fs');
var http = require('util/http');

var manifest = require('manifest');
var manifest_constants = require('manifest/constants');
var deployment = require('deployment');
var get_service_dir = require('runit/services').get_service_dir;

function create_instance(req, res, bundle_name) {
  var instance_name, instance_path, manifest_object;
  // @TODO: Don't hard-code the version delimiter and store it in util/misc.js?
  var splitted = bundle_name.split('@');

  var extracted_bundle_path = path.join(config.get().data_root, config.get().extracted_dir, splitted[0], bundle_name);
  var manifest_path = path.join(extracted_bundle_path, manifest_constants.MANIFEST_FILENAME);

  async.series([
    // Make sure that the extracted bundle path exists
    function(callback) {
      path.exists(extracted_bundle_path, function(exists) {
        if (!exists) {
          return callback(new Error('Invalid bundle name'));
        }

        callback();
      });
    },

    // Retrieve the manifest data object
    function(callback) {
      manifest.get_manifest_data_as_object(manifest_path, true, function(error, manifest_object_) {
        if (error) {
          return callback(error);
        }

        manifest_object = manifest_object_;
        callback();
      });
    },

    // Retrieve the instance number
    function(callback) {
      deployment.get_available_instances(bundle_name, function(error, instances) {
        if (error) {
          return callback(error);
        }

        var instances_count = instances.length;
        if (instances_count === 0) {
          // This is the first instance
          instance_number = 0;
        }
        else {
          instance_number = instances[instances_count - 1][1] + 1;
        }

        instance_name = misc.get_valid_instance_name(bundle_name, instance_number);
        instance_path = path.join(config.get().data_root, config.get().app_dir, instance_name);

        callback();
      });
    },

    // 1. Create the instance directory
    function(callback) {
      fs.mkdir(instance_path, 0755, function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    },

    // 2. Mirror the directory structure from the extracted bundle in the instance directory
    function(callback) {
      fsutil.get_directory_tree_as_template_object(extracted_bundle_path, function(error, template_object) {
        if (error) {
          return callback(error);
        }

        // No directories
        if (Object.keys(template_object).length === 0) {
          return callback();
        }

        misc.template_to_tree(instance_path, template_object, function(error) {
          if (error) {
            return callback(error);
          }

          callback();
        });
      });
    },

    // 3. Realize (render and save) templates
    function(callback) {
      deployment.realize_application_templates(manifest_path, extracted_bundle_path, instance_path, function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    },

    // 4. Hard-link all the files (except data files)
    function(callback) {
      fsutil.hard_link_files(extracted_bundle_path, instance_path, manifest_object.data_files, function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    },

    // 5. Create a runit service
    function(callback) {
      deployment.create_service(instance_name, instance_path, manifest_object.entry_file, manifest_object.type, function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    }
  ],

  function(error) {
    if (error) {
      return http.return_error(res, 500, error.message);
    }

    return http.return_json(res, 200, {
      'result': 'success',
      'instance_number': instance_number
    });
  });
}

/**
 * Enable and start an instance.
 */
function enable_instance(req, res, bundle_name, instance_number) {
  var instance_name, instance_path;

  instance_name = misc.get_valid_instance_name(bundle_name, instance_number);
  instance_path = path.join(config.get().data_root, config.get().app_dir, instance_name);

  path.exists(instance_path, function(exists) {
    if (!exists) {
      return http.return_error(res, 500, 'Invalid bundle name or instance number');
    }

    var dir = get_service_dir();

    async.waterfall([
      function(callback) {
        dir.get_service(instance_name, function(error, service) {
          if (error) {
            return callback(error);
          }

          callback(null, service);
        });
      },

      function(service, callback) {
        service.is_enabled(function(enabled) {
          if (enabled) {
            return callback(new Error('This instance is already enabled'));
          }

          callback(null, service);
        });
      },

      function(service, callback) {
        service.enable(function(error) {
          if (error) {
            return callback(error);
          }

          callback(null, service);
        });
      },

      function(service, callback) {
        // Wait 6 seconds before starting a service (runit scans directories for changes every 5 seconds so the control
        // file is not available instantly after we enable a service)
        setTimeout(function() {
          service.start(function(error) {});
          }, 6000);

          callback();
      }],

      function(error) {
        if (error) {
          return http.return_error(res, 500, error.message);
        }

        return http.return_json(res, 200, {'result': 'success'});
      }
    );
  });
}

/**
 * List all the available instances for the provided bundle.
 *
 * @param {String} bundle_name Full bundle name.
 */
function list_bundle_instances(req, res, bundle_name) {
  deployment.get_available_instances(bundle_name, function(error, instances) {
    if (error) {
      return http.return_error(res, 500, error.message);
    }

    var result_instances = [];
    var item = {};
    var splitted;

    async.forEach(instances, function(instance, callback) {
      // @TODO: Don't hard-code the version delimiter and store it in util/misc.js?
      splitted = instance[0].split('@');

      item = {
        'instance_name': misc.get_valid_instance_name(instance[0], instance[1]),
        'instance_number': instance[1],

        'bundle_name': splitted[0],
        'bundle_name_full': misc.get_full_bundle_name(splitted[0], splitted[1]),
        'bundle_version': splitted[1]
      };

      result_instances.push(item);

      callback();
    },

    function(error) {
      if (error) {
        return http.return_error(res, 500, error.message);
      }

      http.return_json(res, 200, result_instances);
    });
  });
}

/**
 * List all the available instances.
 */
function list_instances(req, res) {
  list_bundle_instances(req, res, '.*');
}

exports.urls = clutch.route([
                              ['POST /(.+)/$', create_instance],
                              ['PUT /([^\/]*?)/(\\d+)/enable/$', enable_instance],
                              ['GET /(.+)/$', list_bundle_instances],
                              ['GET /$', list_instances]
                            ]);
