/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var Nodelint = global.Nodelint,
	Color = Nodelint.Color,
	bold = Color.bold,
	sys = require('sys');

// Calling help on certain target
function Help( target ) {
	if ( ! target ) {
		Nodelint.leave( 0, Help._display );
	}
	else if ( Help[ target ] ) {
		Help[ target ]();
	}
	else {
		Nodelint.leave( 1, "Unknown Help Target - " + target );
	}
}


Nodelint.extend( Help, {

	// Main help display
	_display: [
		bold.red( "Usage:" ),
		"\tNodelint [options] file.js [file2.js dir dir2]",
		"",


		bold.red( "Options:" ),
		"",

		// Logfile
		Color.red( "  -l FILE, --logfile=FILE" ),
		"\tDefine a logfile to output results to.",
		"",

		// Custom jslint
		Color.red( "  -j FILE, --jslint=FILE" ),
		"\tDefine a custom jslint file to use.",
		"",

		// Custom jslint
		Color.red( "  -e ENCODINGS, --encodings=ENCODINGS" ),
		"\tDefine a comma-sparated list of encodings to check for.",
		"",

		// disable coloring
		Color.red( "  -c, --no-color" ),
		"\tDisable coloring of output.",
		"",

		// verbose
		Color.red( "  -v, --verbose" ),
		"\tVerbose mode. Outputs processing information like what directory is currently being read, or what file is currently being linted.",
		"",

		// show passed
		Color.red( "  -p, --show-passed" ),
		"\tOutput list of files that passed jslint.",
		"",

		// Show ignored
		Color.red( "  -i, --show-ignored" ),
		"\tOutput list of files ignored based on lintignore files.",
		"",

		// Show missing
		Color.red( "  -m, --show-missing" ),
		"\tOutput missing files that were expected.",
		"",

		// Show warnings
		Color.red( "  -w, --show-warnings" ),
		"\tOutput warning messages during processing.",
		"",

		// Cli
		Color.red( "  --Nodelint-cli" ),
		"\tTrigger Cli run of arguments.",
		"",

		// pre-commit
		Color.red( "  --Nodelint-pre-commit=VCS" ),
		"\tRun the pre-commit hook on files to be committed for the version control system defined. Blocks commit on error.",
		"",

		// pre-commit-all
		Color.red( "  --Nodelint-pre-commit-all" ),
		"\tRun Nodelint across the entire project before, and block commit on error.",
		"",

		// JSLint options
		bold.red( "Passing JSLint Options:" ),
		"\tNodelint --adsafe=true [more options] file.js",
		""

	].join("\n"),


	// List out supported enconding conversions
	encodings: function(){
		sys.puts( bold.blue( "\nSupported Encoding Conversions:" ) );
		Nodelint.each( Nodelint.Encodings, function( fn, encoding ) {
			sys.puts( encoding );
		});

		// Custom exit
		Nodelint.leave( 0, '' );
	}
});


module.exports = Help;
