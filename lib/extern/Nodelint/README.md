This implementation is a fork of [tav]'s original [nodelint.js]

Nodelint
========

Nodelint combines the power of [Node] and [JSLint] to parse through files or projects and find syntax errors.
Here's a quick example:

![Nodelint Example](http://www.cnstatic.com/images/github/Nodelint/example.png "Nodelint Example")



Installation
------------

Download and extract the Nodelint zip file. If you want the binfiles, then you will need to build and install them.

	$ ./configure
	$ make
	$ make install

	// Now we can use the jslint binfile
	$ jslint file.js


NPM Installation
----------------------

Nodelint is stored on the npm registry if thats your flavor.

	// Install Nodelint
	$ npm install Nodelint

	// Now we can use the jslint binfile
	$ jslint file.js



.lintignore
-----------

.lintgnore are Nodelint specific files that mark which files and/or directories to ignore during rendering. Here's an example

	# Ignore jquery as it doesn't pass my version of JSLINT, but is browser safe
	myproject/jquery/jquery.js

	# Ignore the compressed directory as it definitely won't pass jslint
	myproject/compressedjs/*

	# Ignore all my config files because they have special hacks
	myproject/*.config.js

**Note:** The renderer reads all .lintignore files up the file tree, so be aware when marking files down the tree.



Pre-commit Hook
---------------

Nodelint has a special operation for projects that want to use their version control pre-commit hooks.
Just add the following line to your pre-commit bash script

	Nodelint --Nodelint-pre-commit=git

On large projects, if there are many errors, node might not have enough time to flush it's buffers which
will result in partial output. To fix this, you will need to increase the buffer wait time(in milliseconds)
before Nodelint exits

	Nodelint --Nodelint-pre-commit=git --buffer-wait=1500 .

Here's a quick sample

![Nodelint Git Pre Commit Example](http://www.cnstatic.com/images/github/Nodelint/git.png "Nodelint Git Pre Commit Example")



Nodelint Usage
--------------

Nodelint can be included into your project or build process easily. Here's a quick example

	var Nodelint = require('Nodelint'), sys = require('sys'), fs = require('fs');

	Nodelint( '/path/to/myproject', function( e, results ) {
		if ( e ) {
			return Nodelint.error( e );
		}

		if ( results.errors.length ) {
			// Do something when there are errors
		}
		else {
			// Do something else when there are no errors
		}

		// Output the results to the terminal
		sys.puts( results.output );

		// Write the results to a logfile
		fs.writeFile( 'logfile.out', results.logfile, 'utf8' );
	});

You can read more about Nodelint and other modules inside the doc/ directory.




Custom JSLINT
-------------

The current package comes with the latest version of JSLINT(2010-10-16). To add your own custom version,
or to update to a newer version of JSLINT, add the following as the last line of the jslint.js file, and
overwrite the default jslint in your Nodelint/lib/nodelint/ directory.

	module.exports = JSLINT;

You can also configure into your binfiles a path to the jslint file you want to use.

	$ ./configure --jslint=/path/to/jslint.js
	$ make
	$ make intall




Options
-------

The package provides an Options.js file where default options for JSLINT and Nodelint can be set.
Take a look at docs/Options.md or [JSLINT's Options] to see what to put in there.



Credits
-------

- [tav], wrote original nodelint.js

- [Felix Geisendörfer][felixge], clarified Node.js specific details

- [Douglas Crockford], wrote the original JSLint and rhino.js runner

- [Nathan Landis][my8bird], updated nodelint.js to Node's new API.

- [Corey Hart], Rewrote nodelint.js to current Nodelint implementation



[Node]: http://nodejs.org/
[JSLint]: http://www.jslint.com/lint.html
[JSLINT's Options]: http://www.jslint.com/lint.html#options
[tav]: http://tav.espians.com
[felixge]: http://debuggable.com
[Douglas Crockford]: http://www.crockford.com
[my8bird]: http://github.com/my8bird
[Corey Hart]: http://www.codenothing.com
[nodelint.js]: http://github.com/tav/nodelint.js
