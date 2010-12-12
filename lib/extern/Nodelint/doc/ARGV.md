ARGV.js
=======

ARGV parses the command line arguments and creates the array of files that need to be rendered.


Usage
=====

	// Parse command line arguments
	var argv = require('Nodelint').ARGV( defaultOptions );
	
	// Files that need to be rendered
	argv.files

	// Options read from the command line
	argv.options

You can also pass in a custom set of arguments if needed.

	// If you need to send a custom list of arguments
	var argv = require('Nodelint').ARGV( defaultOptions, myargs );
