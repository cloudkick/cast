Nodelint.js
===========

Nodelint.js is the main Nodelint module that renders files/directories and formats the output.


Nodelint( Files, [Options,] Callback )
-------------

Nodelint is the function that formats the result from the rendering module. It takes three parameters

- **Files:** A single file path, or array of file paths to be parsed.

- **Options:** (Optional) Object of options in the same format as Options.js

- **Callback:** Function that is called once the rendering and formatting process is complete



The callback gets passed two arguments to it. The first is any error that may bubble up during rendering process, and a results object.

	// Results object
	{
	  stdout: Standard output formatted for the terminal
	  stderr: Standard error formatted for the terminal
	  output: Combination of stdout and stderr formatted for the terminal
	  logfile: Output formatted for a text file
	  passes: Array of file paths that passed jslint
	  errors: Array of objects containing files that didn't pass, and the errors found within
	  ignored: Paths that were ignored based on .lintignore file settings
	  missing: Paths missing that couldn't be found
	  count: Object containing a count on the number of files processed, and the number of errors found
	}


Nodelint.info( msg )
--------------------

Informational messages during Nodelint processing.


Nodelint.warn( msg )
--------------------

Warning messages that may bubble up.


Nodelint.error( e )
-------------------

Process ending error's the may bubble up.


Usage
=====

	var Nodelint = require('Nodelint'), sys = require('sys'), fs = require('fs');

	Nodelint( '/path/to/myproject', function( e, results ) {
		if ( e ) {
			return Nodelint.error( e );
		}

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
