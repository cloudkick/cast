/**
 * @name node.process
 * @namespace
 * The <code>process</code> object is a global object and can be accessed from anywhere.
 * It is an instance of <code>EventEmitter</code>.
 */

goog.provide("node.process");

/**
 * Getter&#47;setter to set what is displayed in 'ps'.
 * @type {string|null}
 */
node.process.title = null;

/**
 * A compiled-in property that exposes <code>NODE_VERSION</code>.
 * <pre>
 *     console.log('Version: ' + process.version);
 * </pre>
 * @type {string|null}
 */
node.process.version = null;

/**
 * A compiled-in property that exposes <code>NODE_PREFIX</code>.
 * <pre>
 *     console.log('Prefix: ' + process.installPrefix);
 * </pre>
 * @type {string|null}
 */
node.process.installPrefix = null;

/**
 * @type {string|null}
 */
node.process.versions = null;

/**
 * What platform you're running on. <code>'linux2'</code>, <code>'darwin'</code>, etc.
 * <pre>
 *     console.log('This platform is ' + process.platform);
 * </pre>
 * @type {string|null}
 */
node.process.platform = null;

/**
 * @type {string|null}
 */
node.process.ARGV = null;

/**
 * An array containing the command line arguments.  The first element will be
 * 'node', the second element will be the name of the JavaScript file.  The
 * next elements will be any additional command line arguments.
 * <pre>
 *     &#47;&#47; print process.argv
 *     process.argv.forEach(function (val, index, array) {
 *       console.log(index + ': ' + val);
 *     });
 * </pre>
 * This will generate:
 * <pre>
 *     $ node process-2.js one two=three four
 *     0: node
 *     1: &#47;Users&#47;mjr&#47;work&#47;node&#47;process-2.js
 *     2: one
 *     3: two=three
 *     4: four
 * </pre>
 * @type {string|null}
 */
node.process.argv = null;

/**
 * An object containing the user environment. See environ(7).
 * @type {string|null}
 */
node.process.env = null;

/**
 * @type {string|null}
 */
node.process.ENV = null;

/**
 * The PID of the process.
 * <pre>
 *     console.log('This process is pid ' + process.pid);
 * </pre>
 * @type {string|null}
 */
node.process.pid = null;

/**
 * This is the absolute pathname of the executable that started the process.
 *
 * Example:
 * <pre>
 *     &#47;usr&#47;local&#47;bin&#47;node
 * </pre>
 * @type {string|null}
 */
node.process.execPath = null;

/**
 * A <code>Writable Stream</code> to <code>stdout</code>.
 *
 * Example: the definition of <code>console.log</code>
 * <pre>
 *     console.log = function (d) {
 *       process.stdout.write(d + '\n');
 *     };
 * </pre>
 * @type {string|null}
 */
node.process.stdout = null;

/**
 * A <code>Readable Stream</code> for stdin. The stdin stream is paused by default, so one
 * must call <code>process.stdin.resume()</code> to read from it.
 *
 * Example of opening standard input and listening for both events:
 * <pre>
 *     process.stdin.resume();
 *     process.stdin.setEncoding('utf8');
 *
 *     process.stdin.on('data', function (chunk) {
 *       process.stdout.write('data: ' + chunk);
 *     });
 *
 *     process.stdin.on('end', function () {
 *       process.stdout.write('end');
 *     });
 * </pre>
 * @type {string|null}
 */
node.process.stdin = null;

/**
 * @type {string|null}
 */
node.process.mainModule = null;

/**
 *
 */
node.process.compile = function() {
  return node.process.core_.compile();
};

/**
 *
 */
node.process.reallyExit = function() {
  return node.process.core_.reallyExit();
};

/**
 * Changes the current working directory of the process or throws an exception if that fails.
 * <pre>
 *     console.log('Starting directory: ' + process.cwd());
 *     try {
 *       process.chdir('&#47;tmp');
 *       console.log('New directory: ' + process.cwd());
 *     }
 *     catch (err) {
 *       console.log('chdir: ' + err);
 *     }
 * </pre>
 */
node.process.chdir = function() {
  return node.process.core_.chdir();
};

/**
 * Returns the current working directory of the process.
 * <pre>
 *     console.log('Current directory: ' + process.cwd());
 * </pre>
 */
node.process.cwd = function() {
  return node.process.core_.cwd();
};

/**
 * Gets the user identity of the process. (See getuid(2).)
 * This is the numerical userid, not the username.
 * <pre>
 *     console.log('Current uid: ' + process.getuid());
 * </pre>
 */
node.process.getuid = function() {
  return node.process.core_.getuid();
};

/**
 * Sets the user identity of the process. (See setuid(2).)  This accepts either
 * a numerical ID or a username string.  If a username is specified, this method
 * blocks while resolving it to a numerical ID.
 * <pre>
 *     console.log('Current uid: ' + process.getuid());
 *     try {
 *       process.setuid(501);
 *       console.log('New uid: ' + process.getuid());
 *     }
 *     catch (err) {
 *       console.log('Failed to set uid: ' + err);
 *     }
 * </pre>
 */
node.process.setuid = function() {
  return node.process.core_.setuid();
};

/**
 * Sets the group identity of the process. (See setgid(2).)  This accepts either
 * a numerical ID or a groupname string. If a groupname is specified, this method
 * blocks while resolving it to a numerical ID.
 * <pre>
 *     console.log('Current gid: ' + process.getgid());
 *     try {
 *       process.setgid(501);
 *       console.log('New gid: ' + process.getgid());
 *     }
 *     catch (err) {
 *       console.log('Failed to set gid: ' + err);
 *     }
 * </pre>
 */
node.process.setgid = function() {
  return node.process.core_.setgid();
};

/**
 * Gets the group identity of the process. (See getgid(2).)
 * This is the numerical group id, not the group name.
 * <pre>
 *     console.log('Current gid: ' + process.getgid());
 * </pre>
 */
node.process.getgid = function() {
  return node.process.core_.getgid();
};

/**
 * Sets or reads the process's file mode creation mask. Child processes inherit
 * the mask from the parent process. Returns the old mask if <code>mask</code> argument is
 * given, otherwise returns the current mask.
 * <pre>
 *     var oldmask, newmask = 0644;
 *
 *     oldmask = process.umask(newmask);
 *     console.log('Changed umask from: ' + oldmask.toString(8) +
 *                 ' to ' + newmask.toString(8));
 * </pre>
 */
node.process.umask = function() {
  return node.process.core_.umask();
};

/**
 *
 */
node.process.dlopen = function() {
  return node.process.core_.dlopen();
};

/**
 * Returns an object describing the memory usage of the Node process.
 * <pre>
 *     var util = require('util');
 *
 *     console.log(util.inspect(process.memoryUsage()));
 * </pre>
 * This will generate:
 * <pre>
 *     { rss: 4935680,
 *       vsize: 41893888,
 *       heapTotal: 1826816,
 *       heapUsed: 650472 }
 * </pre>
 * <code>heapTotal</code> and <code>heapUsed</code> refer to V8's memory usage.
 */
node.process.memoryUsage = function() {
  return node.process.core_.memoryUsage();
};

/**
 *
 */
node.process.binding = function() {
  return node.process.core_.binding();
};

/**
 *
 */
node.process.assert = function() {
  return node.process.core_.assert();
};

/**
 * On the next loop around the event loop call this callback.
 * This is *not* a simple alias to <code>setTimeout(fn, 0)</code>, it's much more
 * efficient.
 * <pre>
 *     process.nextTick(function () {
 *       console.log('nextTick callback');
 *     });
 * </pre>
 * @param {function(Error?,...[*]):undefined=} callback
 */
node.process.nextTick = function(callback) {
  return node.process.core_.nextTick(callback);
};

/**
 *
 */
node.process.openStdin = function() {
  return node.process.core_.openStdin();
};

/**
 * Ends the process with the specified <code>code</code>.  If omitted, exit uses the
 * 'success' code <code>0</code>.
 *
 * To exit with a 'failure' code:
 * <pre>
 *     process.exit(1);
 * </pre>
 * The shell that executed node should see the exit code as 1.
 * @param {string} code
 */
node.process.exit = function(code) {
  return node.process.core_.exit(code);
};

/**
 * Send a signal to a process. <code>pid</code> is the process id and <code>signal</code> is the
 * string describing the signal to send.  Signal names are strings like
 * 'SIGINT' or 'SIGUSR1'.  If omitted, the signal will be 'SIGTERM'.
 * See kill(2) for more information.
 *
 * Note that just because the name of this function is <code>process.kill</code>, it is
 * really just a signal sender, like the <code>kill</code> system call.  The signal sent
 * may do something other than kill the target process.
 *
 * Example of sending a signal to yourself:
 * <pre>
 *     process.on('SIGHUP', function () {
 *       console.log('Got SIGHUP signal.');
 *     });
 *
 *     setTimeout(function () {
 *       console.log('Exiting.');
 *       process.exit(0);
 *     }, 100);
 *
 *     process.kill(process.pid, 'SIGHUP');
 * </pre>
 * @param {string} pid
 * @param {string} sig
 */
node.process.kill = function(pid, sig) {
  return node.process.core_.kill(pid, sig);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.process.addListener = function(type, listener) {
  return node.process.core_.addListener(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.process.on = function(type, listener) {
  return node.process.core_.on(type, listener);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.process.removeListener = function(type, listener) {
  return node.process.core_.removeListener(type, listener);
};

/**
 *
 */
node.process.debug = function() {
  return node.process.core_.debug();
};

/**
 *
 */
node.process.error = function() {
  return node.process.core_.error();
};

/**
 *
 */
node.process.watchFile = function() {
  return node.process.core_.watchFile();
};

/**
 *
 */
node.process.unwatchFile = function() {
  return node.process.core_.unwatchFile();
};

/**
 *
 */
node.process.mixin = function() {
  return node.process.core_.mixin();
};

/**
 *
 */
node.process.createChildProcess = function() {
  return node.process.core_.createChildProcess();
};

/**
 *
 */
node.process.inherits = function() {
  return node.process.core_.inherits();
};

/**
 * @param {string} n
 */
node.process.setMaxListeners = function(n) {
  return node.process.core_.setMaxListeners(n);
};

/**
 * @param {string} type
 */
node.process.emit = function(type) {
  return node.process.core_.emit(type);
};

/**
 * @param {string} type
 * @param {string} listener
 */
node.process.once = function(type, listener) {
  return node.process.core_.once(type, listener);
};

/**
 * @param {string} type
 */
node.process.removeAllListeners = function(type) {
  return node.process.core_.removeAllListeners(type);
};

/**
 * @param {string} type
 */
node.process.listeners = function(type) {
  return node.process.core_.listeners(type);
};


/**
 * @private
 * @type {*}
 */
node.process.core_ = process;