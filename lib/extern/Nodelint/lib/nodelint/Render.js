/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var Nodelint = global.Nodelint,
	fs = require('fs'),
	sys = require('sys'),
	Path = require('path'),
	Tracking = Nodelint.Tracking,
	rjs = /\.js$/,
	rslicefile = /\/[^\/]*$/,
	rstar = /\*/g,
	rquot = /'/g,
	rdquot = /"/g,
	rslash = /\//g,
	rlbrace = /\(/g,
	rrbrace = /\)/g,
	rlbracket = /\{/g,
	rrbracket = /\}/g,
	rdollar = /\$/g,
	rstart = /\^/g;



// Cleans a regex path
function PathRegex( path ) {
	return new RegExp( "^" + 
		( path || '' ).replace( rstar, ".*" )
			.replace( rquot, "\\'" )
			.replace( rdquot, "\\\"" )
			.replace( rslash, "\\/" )
			.replace( rlbrace, "\\(" )
			.replace( rrbrace, "\\)" )
			.replace( rlbracket, "\\{" )
			.replace( rrbracket, "\\}" )
			.replace( rdollar, "\\$" )
			.replace( rstart, "\\^" ) +
	"$" );
}


// Rendering Constructor
function Render( files, options, callback ) {
	if ( ! ( this instanceof Render ) ) {
		return new Render( files, options, callback );
	}
	else if ( callback === undefined && typeof options == 'function' ) {
		callback = options;
		options = {};
	}

	var self = this, track;
	self.options = Nodelint.extend( true, {}, Nodelint.Options, options || {} );
	self.jslint = require( self.options.jslint || __dirname + '/jslint' );
	self.ignore = [];
	self._rignore = [];
	self._lintignore = [];
	self.missing = [];
	self.passes = [];
	self.errors = [];
	self.count = {
		files: 0,
		errors: 0
	};

	// Start the rendering process if filepath provided
	if ( ! files ) {
		return callback.call( self, "No file path provided." );
	}
	else if ( ! Array.isArray( files ) ) {
		files = [ files ];
	}

	// Main Render tracker
	track = new Tracking( 'Main Render Tracker', function( e, results ) {
		callback.call( self, e, self );
	});

	// Loop through all paths passed, and render them
	files.forEach(function( file ) {
		var id = track.mark();

		// Start the render process
		self.stat( file, function( e, stat, path ) {
			if ( e ) {
				return track.error( e );
			}

			self.start( stat, path, function( e ) {
				if ( e ) {
					track.error( e );
				}
				else {
					track.mark( id, true );
				}
			});
		});
	});

	// Start main render tracking
	track.start();
}

Render.prototype = {

	// Starting point for each path passed in
	start: function( stat, path, callback ) {
		var self = this, isDirectory = stat.isDirectory(), current = '/', convert = path,
			track = new Tracking('Circular Lint Ignore', function( e, results ) {
				if ( e ) {
					callback.call( self, e );
				}
				else {
					self[ isDirectory ? 'dir' : 'file' ]( path, stat, callback );
				}
			});


		// Strip the file name if not a directory
		if ( ! isDirectory ) {
			convert = convert.replace( rslicefile, '' );
		}

		// Unlikely, but look for ignore file in the root directory
		track.mark( 'root' );
		self.lintignore( '/', function(){
			track.mark( 'root', true );
		});

		// Go through each directory along the tree and pick up all ignore files
		convert.split('/').forEach(function( dir ) {
			if ( ! dir || dir === '' ) {
				return;
			}
			current += dir + '/';

			// Read the ignore file
			var id = track.mark();
			self.lintignore( current, function(){
				track.mark( id, true );
			});
		});

		// Start tracking
		track.start();
	},

	// Custom Direcotry Readying
	readdir: function( path, callback ) {
		var self = this;

		// Force closing slash
		if ( path[ path.length - 1 ] !== '/' ) {
			path += '/';
		}

		// Read the required directory
		fs.readdir( path, function( e, files ) {
			if ( e ) {
				callback.call( self, e );
			}

			// Add path prefix to every file
			var i = files.length;
			while ( i-- ) {
				files[ i ] = path + files[ i ];
			}

			// Return converted paths
			callback.call( self, null, path, files );
		});
	},

	// Abstracted for less complexity
	parseLintignore: function( dir, data, callback ) {
		// Need tracker for each line
		var self = this, track = new Tracking( 'Parsing Ignore List: ' + dir + '.lintignore', callback );

		// ignore file is line based
		data.split("\n").forEach(function( line ) {
			// Skip over comment and empty lines
			if ( ! line || line === '' || line[ 0 ] == '#' ) {
				return;
			}

			// Mark file
			track.mark( line );

			if ( line.indexOf('*') > -1 ) {
				self._rignore.push(
					PathRegex( Path.normalize( dir + line ) )
				);
				return track.mark( line, true );
			}

			// Compile a clean path
			self.stat( dir + line, function( e, stat, path ) {
				if ( e ) {
					if ( self.options[ 'show-warnings' ] ) {
						Nodelint.warn( e );
					}
					return track.mark( line, e );
				}

				// Force ending slash
				if ( stat.isDirectory() && path[ path.length - 1 ] != '/' ) {
					path += '/';
				}

				// Add to ignore list
				self.ignore.push( path );
				track.mark( line, true );
			});
		});

		// Start tracking
		track.start();
	},

	// JSLint ignore files
	lintignore: function( dir, callback ) {
		var self = this, lintignore = dir + '.lintignore';

		// Force closing slash
		if ( dir[ dir.length - 1 ] != '/' ) {
			lintignore = ( dir += '/' ) + '.lintignore';
		}
		
		// Don't re-read ignore files
		if ( self._lintignore.indexOf( lintignore ) > -1 ) {
			return callback.call( self );
		}

		// Mark file as read, and continue on
		self._lintignore.push( lintignore );
		Path.exists( lintignore, function( exists ) {
			if ( ! exists ) {
				return callback.call( self );
			}

			// Parse the ignore spec
			fs.readFile( lintignore, 'utf-8', function( e, data ) {
				return e ? callback.call( self, e ) : self.parseLintignore( dir, data || '', callback );
			});
		});
	},

	// Normalizing paths to full paths
	normalize: function( path, callback ) {
		var self = this;

		fs.realpath( path, function( e, path ) {
			callback.call( self, e, e || Path.normalize( path ) );
		});
	},

	// Custom path stats, normalizes the path
	stat: function( path, callback ) {
		var self = this;

		Path.exists( path, function( exists ) {
			if ( ! exists ) {
				self.missing.push( "Invalid File or Path: " + path );
				callback.call( self, "Invalid File or Path: " + path );
				return;
			}

			// Normalize it before sending the stat info back
			self.normalize( path, function( e, path ) {
				if ( e ) {
					return callback.call( self, e );
				}

				fs.stat( path, function( e, stat ) {
					callback.call( self, null, stat, path );
				});
			});
		});
	},

	// Loops through regex array for a match
	rignore: function( path ) {
		var i = this._rignore.length;

		while ( i-- ) {
			if ( this._rignore[ i ].exec( path ) ) {
				return true;
			}
		}

		return false;
	},

	// Linting files
	file: function( file, stat, callback ) {
		var self = this;

		self.normalize( file, function( e, file ) {
			if ( e ) {
				return callback.call( self, e );
			}

			fs.readFile( file, 'utf-8', function( e, data ) {
				if ( e ) {
					return callback.call( self, e );
				}
				
				// Run through special encoding conversions
				if ( self.options.encodings ) {
					var info = { path: file, stat: stat, content: data, buffer: new Buffer( data ) }, error = false;
					Nodelint.each( self.options.encodings, function( encoding ) {
						if ( ! encoding || ! Nodelint.Encodings[ encoding ] ) {
							error = "Invalid Encoding: " + encoding;
							return false;
						}

						var result = Nodelint.Encodings[ encoding ].call( Nodelint, info );
						if ( typeof result == 'string' && result.length ) {
							error = "Encoding Error: " + result + "\nFile: " + file;
							return false;
						}
					});

					// Encoding error
					if ( error ) {
						return callback.call( self, error );
					}
					else {
						data = info.content;
					}
				}

				// Send processing back to caller
				if ( self.options.verbose ) {
					Nodelint.info( "JSLinting " + file );
				}

				// Tracking number of files linted
				self.count.files++;

				// Remove shebang from env files
				data = data.replace(/^\#\!.*/, '');

				// lint the file info
				if ( ! self.jslint( data, self.options._jslint ) ) {
					// When jslint is unable to continue, it pushes a null entry
					if ( self.jslint.errors[ self.jslint.errors.length - 1 ] === null ) {
						self.jslint.errors.pop();
					}

					// Mark count
					self.count.errors += self.jslint.errors.length;
					self.errors.push({
						file: file,
						errors: self.jslint.errors.slice( 0 )
					});
				}
				else {
					self.passes.push( file );
				}

				callback.call( self, null, self );
			});
		});
	},

	// Loop through a directory list and handle each item
	renderdir: function( path, files, callback ) {
		var self = this, track = Tracking("Rendering Directory: " + path, function( e ) {
			callback.call( self, e, self );
		});

		// Parse over directory
		files.forEach(function( file ) {
			var id = track.mark(), rignore = false;
			self.stat( file, function( e, stat, file ) {
				// Hope not
				if ( e ) {
					return track.error( e );
				}


				// Force slash on directorys
				if ( stat.isDirectory() && file[ file.length - 1 ] != '/' ) {
					file += '/';
				}


				// On ignore path, do nothing
				if ( self.ignore.indexOf( file ) > -1  || ( rignore = self.rignore( file ) ) ) {
					// For files that matched the regex ignore, add to ignore list
					if ( rignore ) {
						self.ignore.push( file );
					}
					return track.mark( id, true );
				}


				// Directory, render it again
				if ( stat.isDirectory() ) {
					self.dir( file, stat, function( e ) {
						if ( e ) {
							track.error( e );
						}
						else {
							track.mark( id, true );
						}
					});
				}
				// We only lint js files
				else if ( rjs.exec( file ) ) {
					self.file( file, stat, function( e ) {
						if ( e ) {
							track.error( e );
						}
						else {
							track.mark( id, true );
						}
					});
				}
				// Might need last file
				else {
					track.mark( id, true );
				}
			});
		});

		// All files marked
		track.start();
	},

	// Linting directories
	dir: function( path, stat, callback ) {
		var self = this;

		// Make sure we are dealing with a full path
		if ( path[ 0 ] != '/' ) {
			return self.normalize( path, function( e, path ) {
				return e ? callback.call( self, e ) : self.dir( path, stat, callback );
			});
		}

		if ( self.options.verbose ) {
			Nodelint.info( "Reading " + path );
		}

		self.lintignore( path, function(){
			self.readdir( path, function( e, path, files ) {
				// Pass error along to the callback
				return e ? callback.call( self, e ) :
					
					// No files in this directory, move on
					files.length < 1 ? callback.call( self, null, self ) :

					// Read the files and lint them
					self.renderdir( path, files, callback );
			});
		});
	}

};

// Expose rendering handler
module.exports = Render;
