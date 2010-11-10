/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var Nodelint = global.Nodelint,
	Color = Nodelint.Color,
	bold = Color.bold,
	sys = require('sys'),
	spawn = require('child_process').spawn,
	rjs = /\.js$/;


// Running JSLint only on files that are being committed
function Precommit( type ) {
	// Run the precommit hook
	if ( typeof Precommit[ type ] == 'function' ) {
		Precommit[ type ]();
	}
	else {
		sys.error( bold.red( "Nodelint doesn't support pre-commit hook for " + type ) );
		process.exit( 1 );
	}
}


// Add various version control handlers
Nodelint.extend( Precommit, {

	// Git has a special diff command to get the list of files to be committed
	git: function(){
		var git = spawn( 'git', [ 'diff', '--cached', '--name-only', '--diff-filter=ACM' ] ),
			data = { stdout: '', stderr: '' },
			argv = Nodelint.ARGV( Nodelint.Options, true ),
			real = [];

		// Read in the response
		Nodelint.each( data, function( val, key ) {
			git[ key ].on( 'data', function( str ) {
				data[ key ] += str;
			});
		});

		// Run JSlint on changed file real
		git.on( 'exit', function( e ) {
			if ( e || data.stderr.length ) {
				sys.puts( bold.red( e || data.stderr ) );
				process.exit( 1 );
			}

			data.stdout.trim().split("\n").forEach(function( file ) {
				if ( rjs.exec( ( file || '' ).trim() ) ) {
					real.push( file );
				}
			});

			// Exit gracefully if no files are to be linted
			if ( real.length ) {
				Nodelint( real, argv.options, Precommit.Results );
			}
			else {
				process.exit( 0 );
			}
		});
	},

	// SVN has to be used in conjunction with svnlook, of which the changed
	// files are passed in as cli arguments
	svn: function(){
		var argv = Nodelint.ARGV( Nodelint.Options, true ), real = [];

		argv.targets.forEach(function( file ) {
			if ( rjs.exec( ( file || '' ).trim() ) ) {
				real.push( file );
			}
		});

		// Exit gracefully if no files are to be linted
		if ( real.length ) {
			Nodelint( real, argv.options, Precommit.Results );
		}
		else {
			process.exit( 0 );
		}
	},

	// Running JSLint on the entire project (or dirs/files specified)
	All: function(){
		var argv = Nodelint.ARGV( Nodelint.Options, true );

		// If no paths were passed, then assume the whole project needs to be linted
		if ( ! argv.targets.length ) {
			argv.targets = [ process.cwd() ];
		}

		// Run JSLint
		Nodelint( argv.targets, argv.options, Precommit.Results );
	},

	// Handling response from all pre-commit methods
	Results: function( e, results ) {
		if ( e ) {
			sys.error( bold.red( e.message || e ) );
			process.exit( 1 );
		}
		else if ( results.errors.length ) {
			Nodelint.leave( 1, results.stderr );
		}
		else {
			process.exit( 0 );
		}
	}

});

// Push onto Nodelint
module.exports = Precommit;
