var sys = require('sys');
var fs = require('fs');
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;

var version = require('util/version');
var client_config = require('util/config');
var tarball = require('util/tarball');
var misc = require('util/misc');
var lock = require('util/lock');
var spinner = require('util/spinner');

var manifest = require('manifest/index');
var manifest_constants = require('manifest/constants');

var config = {
  'short_description': 'Create an save the application bundle',
  'long_description': 'Create an application bundle. If you don\'t specify the app or bundle path, the current working directory is used.',
  'required_arguments' : [['version', 'Application version number']],
  'optional_arguments': [['apppath', 'Path to folder containing the cast.json file and your application files'],
                        ['bundlepath', 'Path where the cast temporary directory will be created and the bundle saved to']],
  'switches': [['upload', 'Upload a bundle to the server after it is created']]
};

function handle_command(args) {
  var application_path, bundle_path;

  if (!args.apppath) {
    application_path = process.cwd();
  }
  else {
    application_path = args.apppath;
  }

  if (!args.bundlepath) {
    bundle_path = process.cwd();
  }
  else {
    bundle_path = args.bundlepath;
  }

  // Create a temporary directory for a bundle
  var temp_directory = path.join(bundle_path, client_config.get().temp_directory);
  var manifest_file = path.join(application_path, manifest_constants.MANIFEST_FILENAME);

  fs.mkdir(temp_directory, 0755, function(error) {
    if (error && error.errno !== 17) {
      sys.puts('Failed to create or write to a temporary directory, quitting');

      return;
    }

    // Check that the manifest file exists
    path.exists(manifest_file, function(exists) {
      if (!exists) {
        sys.puts(sprintf('Failed to find a manifest file %s in the application directory %s, quitting', manifest_constants.MANIFEST_FILENAME, application_path));

        return;
      }

      manifest.validate_manifest(manifest_file, function(error, manifest_object) {
        if (error) {
          sys.puts(sprintf('Manifest file validation failed: %s', error.message));

          return;
        }

        var bundle_name = misc.get_valid_bundle_name(manifest_object.name);
        var tarball_name = sprintf('%s-%s.tar.gz', bundle_name, args.version);
        var lock_path = path.join(temp_directory, sprintf('%s.lock', tarball_name ));

        lock.with_lock(lock_path, function(error, release) {
          if (error) {
            sys.puts('Failed to acquire a lock, probably someone is already creating a bundle with the same name');

            return;
          }

          var progress_spinner = spinner.spinner('Manifest validation succeeded, creating a bundle ');
          var timeout_id = setInterval(function() { progress_spinner.tick(); }, 100);
          progress_spinner.start();

          tarball.create_tarball(application_path, temp_directory, tarball_name, true, function(error) {
            if (error) {
              sys.puts('Creating a bundle failed');

              release();
              return;
            }

            clearInterval(timeout_id);
            progress_spinner.end();
            sys.puts(sprintf('Bundle has been successfully created and saved to %s', path.join(temp_directory, tarball_name)));

            // Release a lock when we are done
            release();
          });
        });
      });
    });
  });
}

exports.config = config;
exports.handle_command = handle_command;
