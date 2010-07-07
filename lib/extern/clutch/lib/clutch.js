var clutch = exports,
    url    = require('url');

function slice(arrayLike) {
    // A slice method that works on pseudo-arrays like
    // `arguments` or the result of a regexp match

    var sliceMethod = Array.prototype.slice;
    return sliceMethod.apply(arrayLike, sliceMethod.apply(arguments, [1]));
}

function Route(method, path_re, callback) {
    return function (req, resp) {
        // Call the route callback with captured parameters
        // if the request URL match
        //
        // Return `true` if the request matched, `false` otherwise

        // `*` match on all methods
        if (method == '*' || method.toLowerCase() == req.method.toLowerCase()) {
            var parts, path = '';

            if ('clutch_url_remainder' in req) { 
                // TODO feeling dirty monkey-patching ServerRequest like that,
                // look for a parameter passing solution on next versions
                path = req.clutch_url_remainder;
            }
            else {
                var parsed = url.parse(req.url);
                if (parsed.slashes) {
                    path = '//';
                }
                path += parsed.pathname || '';
            }

            if (parts = path.match(path_re)) {
                req.clutch_url_remainder = parts.input.substr(parts[0].length);
                var result = callback.apply(null, slice(arguments).concat(slice(parts, 1)));
                req.clutch_url_remainder = path;

                return (result === undefined ? true : result);
            }
        }

        return false;
    };
}


clutch.route = function (urls, req, res) {
    // If called without request and response parameters,
    // it will return a routing function, otherwise
    // it directly route the request

    var url_re = /^(\w+|\*)(\s(.*))?$/;
    var routes = [];

    var i;
    var parts;
    for (i in urls) {
        if(!(parts = urls[i][0].match(url_re))) {
            throw new Error('invalid URL : `'+urls[i][0]+'`');
        }

        routes.push(Route(parts[1], new RegExp('^'+(parts[3] || '')), urls[i][1]));
    }

    var _route = function(req, res) {
        var i;
        for (i in routes) {
            if (routes[i].apply(null, arguments)) {
                return true;
            }
        }

        return false;
    }

    if (req && res) {
        return _route.apply(null, slice(arguments, 1));
    }
    else {
        return _route;
    }
}

clutch.route404 = function (urls, req, res) {
    // Just an utility function that will send back
    // a 404 error and return false if no matching route
    // can be found for the current request

    var router = clutch.route(urls);

    var _route = function (req, res) {
        if (!router.apply(null, arguments)) {
            res.writeHead(404);
            res.end();
        }
        return true;
    }

    if (req && res) {
        return _route.apply(null, slice(arguments, 1));
    }
    else {
        return _route;
    }
}
