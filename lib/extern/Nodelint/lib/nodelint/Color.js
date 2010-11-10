/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
var Nodelint = global.Nodelint,
	Color = module.exports = function( color, bold, str ) {
		return Nodelint.Options[ 'no-color' ] ? str : 
			"\x1B[" + ( bold ? 1 : 0 ) + ";" + Color.colors[ color ] + "m" + str + "\x1B[0m";
	};

// Color references
Color.colors = {
	red: 31,
	green: 32,
	yellow: 33,
	blue: 34
};

// Bold object
Color.bold = {};

// Add the color references
Nodelint.each( Color.colors, function( value, color ) {
	// Normal color
	Color[ color ] = function( msg ) {
		return Color( color, false, msg );
	};

	// Bolded color
	Color.bold[ color ] = function( msg ) {
		return Color( color, true, msg );
	};
});
