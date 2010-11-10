Render.js
=========

Render.js is the rendering module that parses the file/project.


Render( file, [options,] callback )
------

Render is the main constructor. It takes three arguments

- **file:** A single path to a file or directory

- **options:** (Optional) An object of options in the format of Options.js

- **callback:** Function that gets called once the rendering is complete.

The callback function gets passed two arguments. The first is an error that might have bubbled
up during rendering, and the second is current instance of the Render Object.

	// Render Instance
	{
	  passes: Array of files that passed JSLINT
	  errors: Array of objects containing the filename that failed JSLINT, and the errors found
	  missing: Array of files that were expected, but were actually missing
	  count: Object with two properties, files which is the count of files parsed, and errors which is the count of errors found
	  options: Options object used
	  ignore: Array of paths to ignore
	}

It's important to note that all this function does is render the path or directory,
and send back the data. Formatting the response is up to the caller.



Usage
=====

	var Render = require('Nodelint').Render, sys = require('sys');

	Render( '/path/to/projectORfile', function( e, results ) {
		if ( e ) {
			Nodelint.error( e );
		}
		else {
			sys.puts( "Files Rendered - " + results.count.files );
			sys.puts( "Files Passed - " + results.passes.length );
			sys.puts( "Files with Errors - " + results.errors.length );
		}
	});
