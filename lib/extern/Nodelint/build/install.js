/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var sys = require('sys'),
	fs = require('fs'),
	path = require('path'),
	exec = require('child_process').exec,
	root = __dirname.replace( /build\/?$/, '' ),
	dist = root + 'dist/',
	config = {}, prefix = '';


// Default error handling
function error( e ) {
	sys.error( "\x1B[1;31m" + ( e.message || e ) + "\x1B[0m" );
}


// Creates the directory if it doesn't exist
function mkdir( dir, callback ) {
	path.exists( dir, function( exists ) {
		if ( exists ) {
			callback();
		}
		else {
			fs.mkdir( dir, 0755, function( e ) {
				if ( e ) {
					error( e );
				}

				callback();
			});
		}
	});
}


// Installs binfiles
function install( file ) {
	// Ensure dev wants the binfile
	if ( config[ 'no-' + file ] ) {
		return;
	}

	// Shortcut paths
	var from = dist + file,
		to = path.normalize( prefix + 'bin/' + file );

	exec( 'cp ' + from + ' ' + to, function( e ) {
		if ( e ) {
			error( e );
		}
		sys.puts( 'Installed ' + to );
	});
}



function manfiles( file ) {
	// Ensure dev wants the binfile
	if ( config[ 'no-' + file ] ) {
		return;
	}

	// Shortcut paths
	var from = root + 'man1/Nodelint.1',
		to = prefix + 'share/man/man1/' + file + '.1';

	exec( 'cp ' + from + ' ' + to, function( e ) {
		if ( e ) {
			error( e );
		}

		sys.puts( 'Installed ' + to );
	});
}


// Installing lib file
function libfile( i ) {
	if ( i >= require.paths.length ) {
		error( "Could not find path to install lib files." );
	}

	path.exists( require.paths[ i ], function( exists ) {
		if ( ! exists ) {
			return libfile( ++i );
		}

		exec( 'cp ' + dist + 'Nodelint ' + require.paths[ i ] + '/Nodelint.js', function( e ) {
			if ( e ) {
				error( e );
			}

			sys.puts( 'Installed ' + require.paths[ i ] + '/Nodelint.js' );
		});
	});
}


// Read configuration values
fs.readFile( dist + '.config', 'utf8', function( e, data ) {
	if ( e ) {
		error( e );
	}

	// Set configurations
	config = JSON.parse( data );
	prefix = ( config.prefix || process.installPrefix );

	// Ensure trailing slash
	if ( prefix[ prefix.length - 1 ] != '/' ) {
		prefix += '/';
	}

	// Install prefixs
	path.exists( prefix, function( exists ) {
		if ( ! exists ) {
			error( "The install prefix doesn't exist: " + prefix );
		}

		// Binfiles
		mkdir( prefix + 'bin/', function(){
			[ 'jslint', 'Nodelint' ].forEach( install );
		});

		// manfiles
		mkdir( prefix + 'share/', function(){
			mkdir( prefix + 'share/man/', function(){
				mkdir( prefix + 'share/man/man1/', function(){
					[ 'jslint', 'Nodelint' ].forEach( manfiles );
				});
			});
		});
	});

	// Libfile installation
	if ( ! config[ 'no-libfile' ] ) {
		if ( ! config.libpath ) {
			libfile( 0 );
		}
		else {
			if ( config.libpath[ config.libpath.length - 1 ] != '/' ) {
				config.libpath += '/';
			}

			exec( 'cp ' + dist + 'Nodelint ' + config.libpath + 'Nodelint.js', function( e ) {
				if ( e ) {
					error( e );
				}

				sys.puts( 'Installed ' + config.libpath + 'Nodelint.js' );
			});
		}
	}
});
