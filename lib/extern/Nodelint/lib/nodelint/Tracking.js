/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var noop = function(){};

// Tracking Constructor
function Tracking( name, options, callback ) {
	if ( ! ( this instanceof Tracking ) ) {
		return new Tracking( name, options, callback );
	}

	// Allow for no options
	if ( callback === undefined ) {
		callback = options;
		options = {};
	}

	// Instance vars
	options = options || {};
	this.name = name || 'Unnamed Tracker';
	this.callback = callback || noop;
	this.timeout = options.timeout || -1;
	this.markers = options.markers || {};
	this.hold = true;
	this.fin = false;
	this.errord = false;
	this.results = {};

	// Mark the results for any markers that are already finished
	for ( var i in this.markers ) {
		if ( this.markers.hasOwnProperty( i ) && this.markers[ i ] === true ) {
			this.results[ i ] = true;
		}
	}

	// Start the time
	if ( options.autostart ) {
		this.start();
	}
}


Tracking.prototype = {

	// Generic Id generator
	guid: (function(){
		var id = Date.now();
		return function(){
			return "Tracking_" + this.name + "_" + ( ++id );
		};
	})(),

	// Can mark a method as started, or pass in the result
	mark: function( name, result ) {
		// Allow for custom id generation
		if ( arguments.length === 0 ) {
			var guid = this.guid();
			this.markers[ guid ] = false;
			return guid;
		}
		else if ( arguments.length === 1 ) {
			this.markers[ name ] = false;
		}
		else {
			this.markers[ name ] = true;
			this.results[ name ] = result;
			this.check();
		}
	},

	// Remove mark from the list
	unmark: function( name ) {
		if ( this.markers.hasOwnProperty( name ) ) {
			delete this.markers[ name ];
		}
		if ( this.results.hasOwnProperty( name ) ) {
			delete this.results[ name ];
		}
	},

	// Triggers the callback if all marks are complete
	check: function(){
		// Don't rerun if already finished
		if ( this.fin ) {
			return true;
		}
		// Check to make sure there have been no errors/holds
		else if ( this.hold || this.errord ) {
			return false;
		}

		// Check all the markers
		for ( var i in this.markers ) {
			if ( this.markers[ i ] === false ) {
				return false;
			}
		}

		// Clear any timer
		if ( this.timeid ) {
			this.timeid = clearTimeout( this.timeid );
		}

		// Inform the creator
		this.callback.call( this, null, this.results, this );

		// Expose passed check
		return ( this.fin = true );
	},

	// Force an error to the callback
	error: function( e ) {
		if ( e ) {
			this.stop();
			this.errord = true;
			this.callback.call( this, e, null, this );
		}
		else {
			return this.errord;
		}
	},

	// Kill the countdown timer
	stop: function(){
		this.hold = true;
		if ( this.timeid ) {
			this.timeid = clearTimeout( this.timeid );
		}
	},

	// Start the countdown
	start: function(){
		var self = this;

		// Hold checks
		self.hold = false;

		// Make sure we have a timelimit set
		if ( ! self.check() && self.timeout > -1 ) {
			self.timeid = setTimeout(function(){
				self.error( new Error( self.name + " Tracking Timeout" ) );
			}, self.timeout );
		}
	}

};

// Tracking module
module.exports = Tracking;
