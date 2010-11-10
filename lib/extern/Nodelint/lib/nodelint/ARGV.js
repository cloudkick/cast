/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var rdouble = /^--/, rsingle = /^-/, rnode = /node$/,
	rhome = /^\~\//, rroot = /^\//,
	path = require('path');


// Type conversion
function convert( val ) {
	return val === undefined || val.length < 1 || val === 'undefined' ? undefined :
		val === 'true' ? true :
		val === 'false' ? false :
		val === 'null' ? null :
		val == parseFloat( val ) ? parseFloat( val ) :
		val;
}


module.exports = function( defaults, args, overwrite ) {
	if ( overwrite === undefined && typeof args == 'boolean' ) {
		overwrite = args;
		args = undefined;
	}

	// Allow using list of arguments passed (but note that nothing is shifted if that is the case)
	var useargs = args && Array.isArray( args ),
		ARGV = useargs ? args.slice( 0 ) : process.argv.slice( 0 ),
		jslint = defaults._jslint,
		shortcuts = defaults._shortcuts,
		copy = overwrite ? defaults : { _jslint: {} },
		cwd = process.cwd() + '/',
		targets = [],
		short, opt, parts, i, l;

	// Assume binfile alias when not using node initializer
	if ( ! useargs && rnode.exec( ARGV.shift() ) ) {
		ARGV.shift();
	}

	// Run through the arguments and apply to their respective areas
	while ( ARGV.length ) {
		opt = ARGV.shift();

		// Longhand notation "--option=value"
		// NOTE*: Longhand notations may contain jslint options, so check for defined props
		if ( rdouble.exec( opt ) ) {
			opt = opt.replace( rdouble, '' );

			// Check for value assignment first
			if ( opt.indexOf('=') > -1 ) {
				parts = opt.split('=');

				// Must be defined in nodelint options, otherwise assume it's a jslint option
				if ( defaults.hasOwnProperty( parts[ 0 ] ) ) {
					copy[ parts[ 0 ] ] = convert( parts[ 1 ] );
				}
				else {
					copy._jslint[ parts[ 0 ] ] = convert( parts[ 1 ] );
				}
			}
			// Again, check if the option is defined in nodelint options,
			// Otherwise assume its a jslint option
			else if ( defaults.hasOwnProperty( opt ) ) {
				copy[ opt ] = true;
			}
			else {
				copy._jslint[ opt ] = true;
			}
		}
		// Shorthand notation "-o [value]"
		else if ( rsingle.exec( opt ) ) {

			// Shorthand operations can be bunched, so go through each character and do match comparrisons
			if ( ( opt = opt.replace( rsingle, '' ) ).length > 1 ) {
				for ( i = -1, l = opt.length; ++i < l; ) {
					if ( ( short = shortcuts[ opt[ i ] ] ) ) {

						// Check to see if it's expecting a second argument first
						// Otherwise just use the default
						copy[ short.long ] = short.expect && ARGV.length ? convert( ARGV.shift() ) : short['default'];
					}
				}
			}
			else if ( ( short = shortcuts[ opt ] ) ) {
				copy[ short.long ] = short.expect && ARGV.length ? convert( ARGV.shift() ) : short['default'];
			}
		}
		else {
			targets.push( opt );
		}
	}

	// Normalize paths
	if ( defaults._paths ) {
		for ( i in defaults._paths ) {
			if ( defaults._paths[ i ] === true && copy[ i ] ) {
				if ( rhome.exec( copy[ i ] ) ) {
					copy[ i ] = copy[ i ].replace( rhome, process.env.HOME + '/' );
				}
				else if ( ! rroot.exec( copy[ i ] ) ) {
					copy[ i ] = cwd + copy[ i ];
				}

				copy[ i ] = path.normalize( copy[ i ] );
			}
		}
	}

	// Special argument handling
	if ( defaults._special ) {
		for ( i in defaults._special ) {
			if ( typeof defaults._special[ i ] == 'function' && copy[ i ] ) {
				copy[ i ] = defaults._special[ i ]( copy[ i ], copy );
			}
		}
	}

	// Return the converted File List
	return { targets: targets, options: copy };
};
