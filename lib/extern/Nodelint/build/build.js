/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var sys = require('sys'),
	fs = require('fs'),
	path = require('path'),
	root = __dirname.replace( /\/build\/?/, '' ),
	dist = root + '/dist/';


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


// Building binfiles
function buildfile( name, file ) {
	fs.writeFile( dist + name, file, 'utf8', function( e ) {
		if ( e ) {
			error( e );
		}

		fs.chmod( dist + name, 0755, function( e ) {
			if ( e ) {
				error( e );
			}
			else {
				sys.puts( name + " built." );
			}
		});
	});
}


// Converts templates into binfiles
function convert( template, data ) {
	return template.replace( /#\{config\}/, data || 'null' )
		.replace( /#\{path\}/, root )
		.replace( /#\{exec\}/, process.execPath );
}


// Make dist directory and build the binfiles
mkdir( dist, function(){
	fs.readFile( dist + '.config', 'utf8', function( e, data ) {
		if ( e ) {
			error( "Could not find configuration, did you run configure? - " + e );
			process.exit( 1 );
		}

		fs.readFile( __dirname + '/template', 'utf8', function( e, template ) {
			if ( e ) {
				error( e );
				process.exit( 1 );
			}

			// No change to Nodelint
			buildfile( 'Nodelint', convert( template, data ) );

			// Show more information for jslint binfile
			var config = JSON.parse( data );
			config.verbose = true;
			config[ 'Nodelint-cli' ] = true;
			config[ 'show-passed' ] = true;
			buildfile( 'jslint', convert( template, JSON.stringify( config ) ) );
		});
	});
});
