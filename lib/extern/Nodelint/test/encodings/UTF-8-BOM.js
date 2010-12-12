/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */

// This file must not have errors
var obj = {};
for ( var i in obj ) {
	if ( obj.hasOwnProperty( i ) ) {
		obj[ i ] = true;
	}
}
