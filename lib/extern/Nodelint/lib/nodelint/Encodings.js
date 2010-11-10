/*
 * Nodelint [VERSION]
 * [DATE]
 * A fork of tav's nodelint (http://github.com/tav/nodelint)
 * Corey Hart @ http://www.codenothing.com
 */
module.exports = {

	'UTF-8-BOM': function( file ) {
		if ( file.buffer[ 0 ] === 0xEF && file.buffer[ 1 ] === 0xBB && file.buffer[ 2 ] === 0xBF ) {
			file.buffer = file.buffer.slice( 3, file.buffer.length );
			file.content = file.buffer.toString();
		}
	}

};
