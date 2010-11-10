/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var Nodelint = require('../lib/nodelint/Nodelint'),
	Color = Nodelint.Color,
	sys = require('sys'),
	root = __dirname.replace( /build\/?/, '' );

// Configure test case
Nodelint.extend( Nodelint.Options, {
	logfile: root + 'lint.out',
	verbose: true,
	encodings: [ 'UTF-8-BOM' ],
	'show-missing': true,
	'show-ignored': true,
	'show-passed': true,
	'show-warnings': true
});

// Run nodelint and print out response
Nodelint( root, function( e, results ) {
	// Unknown Error
	if ( e ) {
		sys.error( e.message || e );
		process.exit( 1 );
	}
	// There should be one error from the test dir
	else if ( ! results.errors.length ) {
		sys.error( Nodelint.Color.bold.red( "Did not find test error in test/error.js" ) );
		process.exit( 1 );
	}
	// Make sure that the single error is the pre-determined one
	else if ( results.errors.length === 1 && /\/test\/error.js$/.exec( results.errors[ 0 ].file ) ) {
		Nodelint.leave( 0, results.output );
	}
	else {
		Nodelint.leave( 1, results.output );
	}
});
