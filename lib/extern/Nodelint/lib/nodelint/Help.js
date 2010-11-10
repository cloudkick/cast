/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var Nodelint = global.Nodelint,
	Color = Nodelint.Color,
	bold = Color.bold;

module.exports = [
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

	// buffer
	Color.red( "  -b TIME, --buffer-wait=TIME" ),
	"\tDefine the number of milliseconds(TIME) to wait for buffer output to finish before killing the process. Useful for pre-commit hooks.",
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

].join("\n");
