# clutch

A no-frills web request router for [node.js](http://nodejs.org). With all those nice features:

* Standard RegExp patterns ([Scylla](http://github.com/ithinkihaveacat/node-scylla/) inspired)
* Parameters capture
* Nested routes

## 20 seconds crash-course

Install clutch and run the tests:

    $ git clone git://github.com/clement/clutch.git
    $ node clutch/test.js

Copy the following snippet in a `hello.js` file:

    var clutch = require('./clutch');

    function helloSomeone(req, res, name) {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Hello '+name+'!\n');
    }

    function helloWorld(req, res) {
        helloSomeone(req, res, 'World');
    }

    exports.urls = clutch.route404([['GET /hello/(\\w+)/$', helloSomeone],
                                    ['GET /hello/$', helloWorld]]);
    
and this in `server.js`:

    var http = require('http');
    http.createServer(require('./hello').urls).listen(8080, '127.0.0.1');
    
Run that swell hello world server, and send a few requests to test it:

    $ node server.js &
    $ curl http://127.0.0.1:8080/hello/yourself/
    Hello yourself!
    $ curl http://127.0.0.1:8080/hello/
    Hello World!
    $ curl http://127.0.0.1:8080/foo/ -i
    HTTP/1.1 404 Not Found
    ...

# 10 seconds more to learn nested routes

Modify slightly `server.js`:

    var http   = require('http'),
        clutch = require('clutch');

    function homepage(req, res) {
        res.writeHead(200, {'Content-Type': 'text-plain'});
        res.end('Welcome to echo server.\n');
    }

    var routes = clutch.route404([['* /app', require('./hello').urls],
                                  ['GET /$', homepage]]);

    http.createServer(routes).listen(8080, '127.0.0.1');

Then again:

    $ node server.js &
    $ curl http://127.0.0.1:8080/
    Welcome to echo server.
    $ curl http://127.0.0.1:8080/app/hello/yourself/
    Hello yourself!

## In-depth

### Installing

Aside from manually installing clutch from git, you can also get it from [kiwi](http://github.com/visionmedia/kiwi) or [npm](http://github.com/isaacs/npm).

### Invoking

You can create a routing function by passing an array of routes to `clutch.route`. The order matters; each routes will be tried in order until one matches. Each route is itself an array, with the matching rule as first element, and the callback as second.

Once you have that routing function, you can invoke it by giving it a `ServerRequest` and a `ServerResponse` object.

    // Get a routing function
    var router = clutch.route([['GET /$', home], ['GET /blog/$', blog]]);
    // Route a request
    router(request, response);

    // Optionally, you can combine those two steps into one:
    clutch.route([['GET /$', home], ['GET /blog/$', blog]], request, response);

`clutch.route` will return `true` if a matching route was found for the request, and `false` otherwise. It's up to you to deal with non-matched requests.

If you just want a simple **404** behaviour, you can use `clutch.route404`, which will automatically send back a 404 error and close the connection if no matching route was found.

    // So this snippet :
    if (!clutch.route([['GET /$', home]], request, response)) {
        response.writeHead(404);
        response.end();
    }

    // Is basically the same as:
    clutch.route404([['GET /$', home]], request, response);

`route404` and `route` have the same signature and are thus interchangeable.

### Matching rules

A matching rule is simply a string containing a method selector and a regular expression, separated by a single space. The regular expression part is optionnal, if omitted, your rule will match on any request path.

> **Free tip**
>
> Don't forget to double your backslashes (for example `\\d` for matching digits) in your regular expressions

Method selectors can be any HTTP method name, or the wildcard character (`*`) to match any method.

    'GET /blog/$' // will match a GET request to /blog/, but not a POST request
    '* /$' // will match any HTTP request to /
    'OPTIONS .*$' // will match any OPTIONS request
    'OPTIONS' // same as above

It is not necessary to prefix your regular expressions with a start of line (`^`) character, as it is done automatically inside clutch. But the end of line (`$`) character does matter, so be careful:

    'GET /blog/' // will match /blog/, /blog/foo/bar
    'GET /blog/$' // will only match /blog/

Any capturing group in the regular expression will be sent as parameter to the callback function. More on this in the *Parameters* section.

### Nested routes

clutch supports nested routing rules, that is: any route callback can be a clutch-generated routing function. There's no depth limit for nested rules as well. Here's an example:

    var blog_routes = clutch.route([['GET archive/$', blog_archive],
                                    ['GET /$', blog_home],
                                    ['POST /$', blog_post]]);
    var main_routes = clutch.route([['* /blog/', blog_routes],
                                    ['* .*$', fallback]]);

    // With this configuration :
    //   GET /blog/archive/ -> route to blog_archive
    //   GET /blog/ -> route to blog_home
    //   POST /blog/ -> route to blog_post
    //   GET /blog/foo/ -> route to fallback

Note that the matching rule for blog doesn't include an end-of-line (`$`).

You can also use `clutch.route404` for sub-routes, that will ensure that you never hit a fallback route by mistake, for example:

    var blog_routes = clutch.route404([['GET archive/$', blog_archive],
                                       ['GET /$', blog_home],
                                       ['POST /$', blog_post]]);
    var main_routes = clutch.route([['* /blog/', blog_routes],
                                    ['* .*$', fallback]]);

    // Because we used route404 for the nested rule:
    //   GET /blog/foo/ -> send back a 404 error (instead of routing to fallback)

### Parameters

As mentionned before, callback functions will receive an extra parameter for each capturing group in the RegExp (in the order they appear). Here's an example:

    var blog_route = clutch.route([['GET archive/(\\d{4})/(\\d{2})/$', blog_archive]
                                   ['GET (\\w+)/$', blog_item]]);
    var main_route = clutch.route([['GET /blog/(\\w+)/', blog_route],
                                   ['GET /(\\w*)$', home]]);

    // With this:
    //   GET /blog/official/archive/2010/06/ -> call blog_archive(req, res, 'official', '2010', '06')
    //   GET /blog/personal/clutch-is-out/ -> call blog_item(req, res, 'personal', 'clutch-is-out')
    //   GET / -> call home(req, res, '')

Also, any parameters given to a routing function will be forwarded to the callback. For example:

    var route = clutch.route([['GET /(.*)$', home]]);

    var errback = function (err) { require('sys').log(err); };

    route(req, resp, errback);

    // With this:
    //   GET /welcome -> call home(req, resp, errback, 'welcome')

## Author

Clément Nodet
[clement.nodet@gmail.com](mailto:clement.nodet@gmail.com)
