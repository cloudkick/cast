Encodings.js
============

Encodings module is an object of supported encoding conversions. Currently only UTF-8-BOM conversion is supported, but will look into
any other use cases brought forth.


Encodings.*encoding*
--------------------

Each custom conversion handler is passed a single object arguments, that contains the following.

	// File info
	{
	  path: Path to current file
	  stat: Stat object from fs.stat
	  content: Content read as utf-8
	  buffer: Buffered content
	}
