var sys = require('sys');
var path = require('path');

var sprintf = require('extern/sprintf').sprintf;

var manifest = require('manifest/index');
var manifest_constants = require('manifest/constants');

var config = {
  'short_description': 'Validates the cast.json manifest',
  'long_description': 'Validates that the cast.json manifest files contains all the required fields.',
  'required_arguments' : [['path', 'Path to the directory containing the cast.json file']],
  'optional_arguments': [],
  'switches': []
}

function handle_command(args) {
   if (!args.path || args.path === '.') {
    application_path = process.cwd();
  }
  else {
    application_path = args.path;
  }

  var manifest_file = path.join(application_path, manifest_constants.MANIFEST_FILENAME);

  // Check that the manifest file exists
  path.exists(manifest_file, function(exists) {
    if (!exists) {
      sys.puts(sprintf('Failed to find a manifest file %s in the directory %s, quitting', manifest_constants.MANIFEST_FILENAME, application_path));

      return;
    }

    manifest.validate_manifest(manifest_file, function(error, manifest_object) {
      if (error) {
        sys.puts(sprintf('Manifest file validation failed: %s', error.message));

        return;
      }

      sys.puts('Manifest file is valid.');
   });
 });
}

exports.config = config;
exports.handle_command = handle_command;
