Format.js
=========

Format takes the result of a Render Object, formats the output, and sends back merged results.

	// Object returned from Nodelint.Format
	{
	  stdout: Standard output formatted for the terminal
	  stderr: Standard error formatted for the terminal
	  output: Combination of stdout and stderr formatted for the terminal
	  logfile: Output formatted for a text file
	  passes: Array of file paths that passed jslint
	  errors: Array of objects containing files that didn't pass jslint, and the errors found within
	  ignored: Paths that were ignored based on .lintignore file settings
	  missing: Paths missing that couldn't be found
	  count: Object containing a count on the number of files processed, and the number of errors found
	}

Usage
=====

	var Nodelint = require('Nodelint'), sys = require('sys'), fs = require('fs');

	Nodelint.Render( '/path/to/myproject', function( e, results ) {
		if ( e || ! results ) {
			return Nodelint.error( e || "Invalid Project Path." );
		}


		// Get the formatted results
		results = Nodelint.Format( results, options );


		if ( results.errors.length ) {
			// Do something when there are errors
		}
		else {
			// Do something else when there are no errors
		}

		// Output the results to the terminal
		sys.puts( results.output );

		// Write the results to a logfile
		fs.writeFile( 'logfile.out', results.logfile, 'utf8' );
	});
