/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var Nodelint = require('../lib/nodelint/Nodelint'),
	sys = require('sys'),
	root = __dirname.replace( /build\/?/, '/' );

// Custom pre-commit hook for Nodelint
Nodelint( root, { encodings: [ 'UTF-8-BOM' ] }, function( e, results ) {
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
		process.exit( 0 );
	}
	else {
		Nodelint.leave( 1, results.stderr );
	}
});
