var assert = require('assert'),
    sys    = require('sys'),
    clutch = require('./index'),
    slice  = Array.prototype.slice;

function MockRequest(method, url) {
    this.method = method;
    this.url = url;
}

function MockResponse(name, id, code, body) {
    this.name = name;
    this.body = body || '';
    this.id = id;
    this.code = code;
    this.buffer = '';
}
MockResponse.prototype.writeHead = function (code, reason, headers) {
    assert.equal(code, this.code, this.name+': Invalid return code, expected `'+this.code+'` (got `'+code+'`)');
}
MockResponse.prototype.write = function (content) {
    this.buffer += content.toString();
}
MockResponse.prototype.end = function (id) {
    assert.equal(id, this.id, this.name+': Invalid function id, expected `'+this.id+'` (got `'+id+'`)');
    assert.equal(this.buffer, this.body, this.name+': Invalid response body, expected `'+this.body+'` (got `'+this.buffer+'`)');
    sys.print('.');
}


function echo(id) {
    return function (req, resp) {
        resp.writeHead(200);

        var args = slice.apply(arguments, [2]);
        if (args.length) {
            resp.write(JSON.stringify(args));
        }
        resp.end(id);
    };
}


function testInvalidRoute() {
    assert.throws(function () { clutch.route([['']]); }, 'testInvalidRoute1');
    assert.throws(function () { clutch.route([['/$']]); }, 'testInvalidRoute2');
    assert.throws(function () { clutch.route([['GET/$']]); }, 'testInvalidRoute3');
}

function testBasic() {
    var router = clutch.route([['GET /$', echo(1)],
                               ['POST /$', echo(2)],
                               ['* /$', echo(3)]]);

    assert.ok(router(new MockRequest('GET', '/'), new MockResponse('testBasic1', 1, 200)), 'testBasic1');
    assert.ok(router(new MockRequest('POST', '/'), new MockResponse('testBasic3', 2, 200)), 'testBasic2');
    assert.ok(router(new MockRequest('OPTIONS', '/'), new MockResponse('testBasic4', 3, 200)), 'testBasic3');
    assert.ok(!router(new MockRequest('GET', '/foo/'), new MockResponse('testBasic4')), 'testBasic4');
}

function test404() {
    var router = clutch.route404([['GET /onlyget/$', echo(1)],
                                ['POST /onlypost/$', echo(2)],
                                ['* /everything/$', echo(3)]]);
    router(new MockRequest('GET', '/onlypost/'), new MockResponse('test404-1', undefined, 404));
    router(new MockRequest('OPTIONS', '/everything/andbeyond/'), new MockResponse('test404-2', undefined, 404));
}

function testNoRoutes() {
    var router = clutch.route([]);

    assert.ok(!router(new MockRequest('GET', '/'), new MockResponse('testNoRoutes1')), 'testNoRoutes1');
}

function testDynamicRoutes() {
    var routes = [['GET /$', echo(1)],
                  ['POST /$', echo(2)]];

    clutch.route404(routes, new MockRequest('GET', '/'), new MockResponse('testDynamic1', 1, 200));
    clutch.route404(routes, new MockRequest('POST', '/'), new MockResponse('testDynamic2', 2, 200));
}

function testPriority() {
    var router = clutch.route404([['GET /foo/$', echo(1)],
                               ['* /', echo(2)],
                               ['POST /foo/$', echo(3)]]);
    router(new MockRequest('GET', '/foo/'), new MockResponse('testPriority1', 1, 200));
    router(new MockRequest('POST', '/foo/'), new MockResponse('testPriority2', 2, 200));
}

function testParams() {
    var router = clutch.route404([['* /(\\w+)/$', echo(1)],
                               ['* /(\\w+)(/?)(\\w*)$', echo(2)]]);
    router(new MockRequest('GET', '/foo/'), new MockResponse('testParams1', 1, 200, '["foo"]'));
    router(new MockRequest('GET', '/foo'), new MockResponse('testParams2', 2, 200, '["foo","",""]'));
    router(new MockRequest('GET', '/foo/bar'), new MockResponse('testParams3', 2, 200, '["foo","/","bar"]'));
}

function testExtraParams() {
    var router = clutch.route404([['GET /$', echo(1)],
                                  ['GET /(.*)$', echo(2)]]);
    router(new MockRequest('GET', '/'), new MockResponse('testExtraParams1', 1, 200, '[42,"bar"]'), 42, 'bar');
    router(new MockRequest('GET', '/foo'), new MockResponse('testExtraParams2', 2, 200, '[42,"baz","foo"]'), 42, 'baz');
}

function testIncludedRoutes() {
    var router_comments = clutch.route([['GET comments/$', echo('blog_comments')],
                                        ['GET $', echo('blog_post')]]);
    var router_blog = clutch.route([['* /post/(\\d+)/', router_comments],
                                    ['POST /post/$', echo('blog_create')]]);
    var router_forum = clutch.route([['GET /post/(\\d+)/$', echo('forum_post')],
                                     ['POST /$', echo('forum_create')]]);
    var router = clutch.route404([['* /blog', router_blog],
                                  ['GET /$', echo('home')],
                                  ['GET /forum/(\\w+)', router_forum],
                                  ['GET (.*)$', echo('catch_all')]]);

    router(new MockRequest('GET', '/'), new MockResponse('testIncludedRoutes1', 'home', 200));
    router(new MockRequest('POST', '/blog/post/'), new MockResponse('testIncludedRoutes2', 'blog_create', 200));
    router(new MockRequest('GET', '/blog/post/42/'), new MockResponse('testIncludedRoutes3', 'blog_post', 200, '["42"]'));
    router(new MockRequest('GET', '/blog/post/42/comments/'), new MockResponse('testIncludedRoutes4', 'blog_comments', 200, '["42"]'));
    router(new MockRequest('POST', '/forum/clutch/post/'), new MockResponse('testIncludedRoutes5', null, 404));
    router(new MockRequest('GET', '/forum/clutch/post/42/'), new MockResponse('testIncludedRoutes6', 'forum_post', 200, '["clutch","42"]'));
    router(new MockRequest('GET', '/forum/clutch/post/'), new MockResponse('testIncludedRoutes7', 'catch_all', 200, '["/forum/clutch/post/"]'));
}

function testIncludedRoutes404() {
    // If a sub route has a 404 router, if the first segments match,
    // then siblings routes will not be tried
    var router_forum = clutch.route404([['GET /post/(\\d+)/$', echo('forum_post')],
                                     ['POST /$', echo('forum_create')]]);
    var router = clutch.route404([['GET /forum/(\\w+)', router_forum],
                                  ['GET (.*)$', echo('catch_all')]]);
    router(new MockRequest('GET', '/forum/clutch/post/42/'), new MockResponse('testIncluded404-1', 'forum_post', 200, '["clutch","42"]'));
    router(new MockRequest('GET', '/forum/clutch/post/'), new MockResponse('testIncluded404-2', undefined, 404));
}

function testIncludedRoutesExtraParams() {
    var router = clutch.route404([['GET /blog', clutch.route([['GET /(\\w+)', clutch.route([['GET /post/(\\d+)/$', echo(1)]])]])]]);

    router(new MockRequest('GET', '/blog/mine/post/42/'), new MockResponse('testIncludedRoutesExtraParams', 1, 200, '["foo","baz","mine","42"]'), 'foo', 'baz');
}

function testPassThru() {
    var router = clutch.route404([['GET', echo(1)], ['*', echo(2)]]);

    router(new MockRequest('GET', '/foo/bar/'), new MockResponse('testPassThru1', 1, 200));
    router(new MockRequest('POST', '/foo/bar/'), new MockResponse('testPassThru2', 2, 200));
}

function testSlashes() {
    var router = clutch.route404([['* //$', echo(1)], ['* ///$', echo(2)], ['* ////$', echo(3)]]);

    router(new MockRequest('GET', '//'), new MockResponse('testSlashes1', 1, 200));
    router(new MockRequest('GET', '///'), new MockResponse('testSlashes2', 2, 200));
    router(new MockRequest('GET', '////'), new MockResponse('testSlashes3', 3, 200));
}

var tests = [
    testInvalidRoute,
    testBasic,
    test404,
    testNoRoutes,
    testDynamicRoutes,
    testPriority,
    testParams,
    testExtraParams,
    testIncludedRoutes,
    testIncludedRoutes404,
    testIncludedRoutesExtraParams,
    testPassThru,
    testSlashes
];

sys.log('Test suite started');

var i, errors = [];
for (i in tests) {
    try {
        tests[i]();
        sys.print('.');
    }
    catch (e) {
        errors.push(e);
        sys.print('E');
    }
}

if (errors.length) {
    sys.puts('\n');
    for (i in errors) {
        sys.puts(errors[i]);
    }
}
else {
    sys.puts('\n\nAll tests passed.');
}
