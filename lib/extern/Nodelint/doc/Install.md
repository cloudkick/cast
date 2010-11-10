Installation
------------

Download and extract the Nodelint zip file. If you want the binfiles, then you will need to make them.

	$ ./configure
	$ make
	$ make install

	// Now we can use the jslint binfile
	$ jslint file.js


NPM Installation
----------------------

Nodelint is stored on the npm registry if that's your flavor.

	// Install Nodelint
	$ npm install Nodelint

	// Now we can use the jslint binfile
	$ jslint file.js


Notes
-----

 - Basic installation installs 2 binfiles: Nodelint and jslint, 2 manfiles: Nodelint.1 and jslint.1,
and a libfile in your requires path: Nodelint.js.  
  
 - Nodelint is the main binfile, which can be used in pre-commit hooks, while jslint is a shortcut which auto-enables
a few options to output more information to the terminal.  
  
 - The Nodelint.js libfile is added to either the libpath defined, or the first available path found in your require path.


**Note:** npm installation does all of the above, except install the jslint manfile.  
**Note2:** npm installation assumes /usr/local/bin/node as your node binary. If you installed node with a different prefix, you
will need to edit the Nodelint and jslint bin files.


Configuration
-------------

In addition to the settings in Options, the following can be used during configuration.

 - **jslint**: Path to a custom jslint file

 - **prefix**: Path to installation prefix, defaults to install path of node

 - **libpath**: Path to installation libfile, defaults to first available path in the require path

 - **no-Nodelint**: Block installation of Nodelint binfile

 - **no-jslint**: Block installation of jslint binfile

 - **no-libfile**: Block installation of Nodelint.js on the requires path


Here's a sample config

	./configure --jslint=/path/to/custom/jslint.js --prefix=/path/to/my/installationPrefix/ --no-libfile

And if you want to force certain options(including jslint options)

	./configure --verbose --adsafe=true --libpath=/my/libpath/
