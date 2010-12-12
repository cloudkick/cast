Options.js
==========

Options.js contains the options object of default settings for Nodelint and JSLint.  
  
  

 - **-l FILE, --logfile=FILE:** Define a logfile to output results to.

 - **-j FILE, --jslint=FILE:** Define a custom jslint file to use.

 - **-e ENCODINGS, --encodings=ENCODINGS:** Define a comma-sparated list of encodings to check for.

 - **-c, --no-color:** Disable coloring of output.

 - **-v, --verbose:** Verbose mode. Outputs processing information like what directory is currently being read, or what file is currently being linted.

 - **-p, --show-passed:** Output list of files that passed jslint.

 - **-i, --show-ignored:** Output list of files ignored based on lintignore files.

 - **-m, --show-missing:** Output missing files that were expected.

 - **-w, --show-warnings:** Output warning messages during processing.

 - **--Nodelint-cli:** Trigger Cli run of arguments.

 - **--Nodelint-pre-commit=VCS:** Run the pre-commit hook on files to be committed for the version control system defined. Blocks commit on error.

 - **--Nodelint-pre-commit-all:** Run Nodelint across the entire project before, and block commit on error.



_jslint
------

The "_jslint" option is an object of JSLINT specific options that just get passed to the JSLINT parser.



_paths
------

The "_paths" option is an object defining a list of options that have path values to be normalized


_special
--------

The "_special" option is an object of options with special argument value handling.
An example would be the following handler that forces integer values:

	'option-that-needs-integer': function( value ) {
		return parseInt( value || 0, 10 );
	}


_shortcuts
----------

The "_shortcuts" options is an object containing shortcut references for Nodelint options. Each shortcut must use the following format

	"character": {
		"long": longhand reference
		"expect": Boolean, true if option expects an argument to follow, false to just use the default
		"default": Default value for when the shortcut is used without an expectation
	}

An example would be

	// Shortcut for logfile, expecting next argument to be path to logfile
	'l': {
		'long': 'logfile',
		'expect': true,
		'default': null
	}



Usage
=====

	// Not much too it, just returns the options object
	var Options = require('Nodelint').Options;
