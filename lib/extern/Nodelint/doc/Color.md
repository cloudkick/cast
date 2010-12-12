Color.js
========


Color.js is a coloring module for text output to the terminal.



Color.*color*( string )
-----------------------

The color module comes with a predefined set of colors: red, green, blue & yellow.


Color.bold.*color*( string )
----------------------------

The bold counterparts to red, green, blue & yellow.


Usage
=====

	// Color Module
	var Color = require('Nodelint').Color, sys = require('sys');

	// Shortcut to coloring a string red for terminal output
	sys.puts( Color.red( 'This is a red string' ) );
