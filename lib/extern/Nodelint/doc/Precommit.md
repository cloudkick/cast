Nodelint.Precommit
==================

Nodelint has the ability to act like a pre-commit hook for supported version control systems. Currently it only supports
Git and SVN, but there are future plans to add in mercurial, bazaar, and any others that are requested(and doable).


GIT Pre-Commit
--------------

If you are using git, add the following line to your .git/hooks/pre-commit file

	Nodelint --Nodelint-pre-commit=git

This will run JSLint on all files that are going to be committed, and block the transaction if any errors
are found. If you want to lint your entire project on every commit, add the following instead.

	Nodelint --Nodelint-pre-commit-all

Just remember to set your .lintignore script(s) to block linting of files you know will fail.  
  
If you have yet to create a pre-commit hook, just move the pre-commit.sample file to pre-commit, and remove
everything but the first line with the shebang telling what env to use. Make sure it is executable. Here's a
quick sample:


![Nodelint Git Pre Commit Example](http://www.cnstatic.com/images/github/Nodelint/git.png "Nodelint Git Pre Commit Example")



SVN Pre-Commit
--------------

If you are using svn, add the following to your PATH_TO_REPOS/project/hooks/pre-commit file

	Nodelint --Nodelint-pre-commit=svn $(svnlook changed --transaction $2 $1 | cut -c4-)

This will run JSLint on all files that are going to be committed, and block the transaction if any errors
are found. If you want to lint your entire project on every commit, add the following instead.

	Nodelint --Nodelint-pre-commit-all

Just remember to set your .lintignore script(s) to block linting of files you know will fail.  
  
If you have yet to create a pre-commit hook, just move the pre-commit.tmpl file to pre-commit, and remove
everything but the first line with the shebang telling what env to use. Make sure it is executable. Here's a quick
sample:

![Nodelint SVN Pre Commit Example](http://www.cnstatic.com/images/github/Nodelint/svn.png "Nodelint SVN Pre Commit Example")
  

**Note:** If you built node with a different install path then the default /usr/local/, then you will have to
use the full path to Nodelint binfile to use it in svn pre-commit hooks.


Buffers
-------

If you run Nodelint on a large project that produces many errors, you may run into a half finished report problem. This 
happens because node exits before it's buffers finish writing, and can cause color confusion in the terminal. If you 
experience this, just increase the buffer wait time, which is currently defaulted to 400 milliseconds.

	Nodelint --Nodelint-pre-commit=git -b 1500

The above will increase wait time to 1.5 seconds, a bit extreme, but will cover the time it takes for buffers to finish.


Recommendation
--------------

Download the Nodelint src, and add it as a tool to your project(you can just add the lib/nodelint/ directory, as it has everything you need).
Both svn and git set the current working directory to your repository root, so if you put Nodelint in a path like 
"myproject/tools/Nodelint", and then add the following to your pre-commit file.

	node tools/Nodelint/index.js --Nodelint-pre-commit=git

And now you and your team are all on the same page as to what errors have to be cleaned before they can be committed.
