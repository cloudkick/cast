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
var instances = require('deployment/instances');
var service_management = require('service_management');

function create_instance(req, res, bundle_name_full) {
  var application_instance_path, instance_name, instance_number, instance_path, manifest_object, ignored_paths;
  var application_data_path, instance_data_path;

  // @TODO: Don't hard-code the version delimiter and store it in util/misc.js?
  var splitted = bundle_name_full.split('@');

  var bundle_name = splitted[0];
  var bundle_version = splitted[1];

  var extracted_bundle_path = path.join(config.get().extracted_dir, bundle_name, bundle_name_full);
  var manifest_path = path.join(extracted_bundle_path, manifest_constants.MANIFEST_FILENAME);

  application_instance_path = path.join(config.get().app_dir, bundle_name);

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

    // Create the application directory (if it does not already exist)
    function(callback) {
      fsutil.ensure_directory(application_instance_path, callback);
    },

    // Retrieve the instance number
    function(callback) {
      deployment.get_available_instances(bundle_name, bundle_version, function(error, instances) {
        if (error) {
          if (error.errno === process.ENOENT) {
            // Directory for this application does not yet exist
            instances = [];
          }
          else {
            return callback(error);
          }
        }

        var instances_count = instances.length;
        if (instances_count === 0) {
          // This is the first instance
          instance_number = 0;
        }
        else {
          instance_number = instances[instances_count - 1][1] + 1;
        }

        instance_name = misc.get_valid_instance_name(bundle_name_full, instance_number);
        instance_path = path.join(application_instance_path, instance_name);

        application_data_path = path.join(config.get().data_dir, bundle_name);
        instance_data_path = path.join(application_data_path, instance_name);

        ignored_paths = manifest_object.template_files.concat(manifest_object.data_files);

        callback();
      });
    },

    // Create the application data directory (if it does not already exist)
    function(callback) {
      fsutil.ensure_directory(application_data_path, callback);
    },

    // Create the instance data directory (if it does not already exist)
    function(callback) {
      fsutil.ensure_directory(instance_data_path, callback);
    },

    // 1. Create the instance directory
    function(callback) {
      fsutil.ensure_directory(instance_path, callback);
    },

    // 2. Mirror the directory structure from the extracted bundle in the instance directory
    function(callback) {
      fsutil.get_directory_tree_as_template_object(extracted_bundle_path, ignored_paths, function(error, template_object) {
        if (error) {
          return callback(error);
        }

        // No directories
        if (Object.keys(template_object).length === 0) {
          return callback();
        }

        misc.template_to_tree(instance_path, template_object, true, function(error) {
          if (error) {
            return callback(error);
          }

          callback();
        });
      });
    },

    // 3. Realize (render and save) templates
    function(callback) {
      var instance_data = templates.get_instance_template_object(instance_name, instance_number, instance_path);

      deployment.realize_application_templates(manifest_object, instance_data, extracted_bundle_path, instance_path,
                                              function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    },

    // 4. Hard-link all the files (except template and data files)
    function(callback) {
      fsutil.hard_link_files(extracted_bundle_path, instance_path, ignored_paths, function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    },

    // 5. Resolve the data files
    function(callback) {
      deployment.resolve_data_files(extracted_bundle_path, instance_data_path, instance_path,
                                    manifest_object.data_files, callback);
    },

    // 6. Create a runit service
    function(callback) {
      deployment.create_service(instance_name, instance_path, manifest_object.entry_file, manifest_object.type,
                                function(error) {
        if (error) {
          return callback(error);
        }

        callback();
      });
    }
  ],

  function(error) {
    if (error) {
      if (!instance_name) {
        // Deployment failed before any non-idempotent action has been performed so no cleanup
        // is needed
        http.return_error(res, 500, error.message);
        return;
      }

      deployment.cleanup(instance_name, instance_path, instance_data_path, function(err) {
        http.return_error(res, 500, error.message);
        return;
      });

      return;
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
function enable_instance(req, res, bundle_name_full, instance_number) {
  var return_array, instance_name, instance_path;

  return_array = misc.get_instance_name_and_path(bundle_name_full, instance_number);
  instance_name = return_array[0];
  instance_path = return_array[1];

  path.exists(instance_path, function(exists) {
    if (!exists) {
      return http.return_error(res, 500, 'Invalid bundle name or instance number');
    }

    var manager = service_management.get_default_manager().get_manager();

    async.waterfall([
      function(callback) {
        manager.get_service(instance_name, function(error, service) {
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
        // Remove the down file so the service is started automatically.
        var down_path = path.join(service.path_enabled, 'down');

        fs.unlink(down_path, function(err) {
          callback(null, service);
        });
      },

      function(service, callback) {
        // Remove the down file so service is started automatically.

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

/*
 * Disable and stop the instance (if started).
 */
function disable_instance(req, res, bundle_name_full, instance_number) {
  var return_array, instance_name, instance_path;

  return_array = misc.get_instance_name_and_path(bundle_name_full, instance_number);
  instance_name = return_array[0];
  instance_path = return_array[1];

  path.exists(instance_path, function(exists) {
    if (!exists) {
      return http.return_error(res, 500, 'Invalid bundle name or instance number');
    }

    var manager = service_management.get_default_manager().get_manager();

    async.waterfall([
      function(callback) {
        manager.get_service(instance_name, function(error, service) {
          if (error) {
            return callback(error);
          }

          callback(null, service);
        });
      },

      function(service, callback) {
        service.is_enabled(function(enabled) {
          if (!enabled) {
            return callback(new Error('This instance is already disabled'));
          }

          callback(null, service);
        });
      },

      function(service, callback) {
        service.disable(function(err) {
          callback(err);
        });
      }],

      function(err) {
        if (err) {
          return http.return_error(res, 500, err.message);
        }

        return http.return_json(res, 200, {'result': 'success'});
      }
    );
  });
}

/*
 * Delete everything related to an instance (including data folder and service folder which means that
 * the instance will be stopped if it's running).
 */
function delete_instance(req, res, bundle_name_full, instance_number) {
  var return_array, instance_name, instance_path;

  return_array = misc.get_instance_name_and_path(bundle_name_full, instance_number);
  instance_name = return_array[0];
  instance_path = return_array[1];

  instances.instance_exists(bundle_name_full, instance_number, function(err, exists) {
    var bundle_name, application_data_path, instance_data_path;

    if (err) {
      http.return_error(res, 500, err.message);
      return;
    }
    else if (!exists) {
      http.return_error(res, 404, 'Instance does not exist');
      return;
    }

    bundle_name = misc.get_bundle_name(bundle_name_full);

    application_data_path = path.join(config.get().data_dir, bundle_name);
    instance_data_path = path.join(application_data_path, instance_name);

    deployment.cleanup(instance_name, instance_path, instance_data_path, function() {
      http.return_json(res, 200, {'result': 'success'});
      return;
    });
  });
}

/**
 * List all the available instances for the provided bundle version.
 *
 * @param {String} bundle_name Bundle name as returned by the get_valid_bundle_name function.
 * @param {String} bundle_version Bundle version.
 */
function list_bundle_version_instances(req, res, bundle_name, bundle_version) {
  deployment.get_available_instances(bundle_name, bundle_version, function(error, instances) {
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
 * List all the available instances for the provided bundle.
 *
 * @param {String} bundle_name Bundle name as returned by the get_valid_bundle_name function.
 */
function list_all_bundle_instances(req, res, bundle_name) {
  list_bundle_version_instances(req, res, bundle_name, 'all');
}

exports.urls = clutch.route([
                              ['POST /(.+)/$', create_instance],
                              ['PUT /([^\/]*?)/(\\d+)/enable/$', enable_instance],
                              ['PUT /([^\/]*?)/(\\d+)/disable/$', disable_instance],
                              ['DELETE /([^\/]*?)/(\\d+)/$', delete_instance],
                              ['GET /(.+)/(.+)/$', list_bundle_version_instances],
                              ['GET /(.+)/$', list_all_bundle_instances]
                            ]);
