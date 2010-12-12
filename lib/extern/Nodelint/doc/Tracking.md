Tracking.js
===========

Tracking.js is a utility module that helps with tracking asynchronous events.


Tracking( name, [options,] callback )
------------------------------------

Tracking is the main constructor. It takes three arguments.

- **name:** Name to attach to the current tracking instance. Just for display purposes.

- **options:** (Optional) Options object

- **callback:** Function called once tracking has completed or error'd out.

The callback function gets passed two arguments, an error that might bubble up, and an object containing all the markers with their respective results


Options
-------

- **timeout:** Number of milliseconds before triggering an error. Defaults to -1 (forever).

- **autostart:** Autostart the tracking. Should only be passed along with an object of markers already set.

- **markers:** Object of markers already set. Should be marked true for already finished, false for processing.



Tracking Instances
==================

Calling the Tracking function returns a new instance of the Tracking object. Below are methods of importance.


track.mark( [name, result] )
----------------------------

Function to add/complete a mark

- Pass a string to name a mark

- Pass the mark name and a second argument to set as its result for mark completion

- Pass zero arguments to have a mark name generated for you. The id for the mark will be passed back;



track.unmark( name )
--------------------

Function to remove a mark from the list.


track.error( e )
----------------

If an error occurs during your processing, you can pass that along to the Tracking instance, which will stop tracking and error out to the callback.


track.start()
-------------

Function triggers the start of tracking.


track.stop()
------------

Function that stops the tracking.


Usage
=====

	var Tracking = require('Nodelint').Tracking, sys = require('sys');

	// Create a new instance of tracking
	var track = new Tracking( 'My Custom Tracker', function( e, results ) {
		if ( e ) {
			sys.puts( 'Tracking Failed - ' + e.message );
		}
		else {
			sys.puts( 'Tracking Completed' );
			// Do something with the results
		}
	});


	// Go through a list of asynchronous processes
	[ 'one', 'two', 'three' ].forEach(function( entry ) {
		track.mark( entry );

		someAsyncFn(function( result ) {
			track.mark( entry, result );
		});
	});

	// Start tracking
	track.start();
