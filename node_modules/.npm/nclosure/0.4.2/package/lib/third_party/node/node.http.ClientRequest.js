
goog.provide("node.http.ClientRequest");

/**
 * This object is created internally and returned from <code>http.request()</code>.  It
 * represents an <em>in-progress</em> request whose header has already been queued.  The
 * header is still mutable using the <code>setHeader(name, value)</code>, <code>getHeader(name)</code>,
 * <code>removeHeader(name)</code> API.  The actual header will be sent along with the first
 * data chunk or when closing the connection.
 *
 * To get the response, add a listener for <code>'response'</code> to the request object.
 * <code>'response'</code> will be emitted from the request object when the response
 * headers have been received.  The <code>'response'</code> event is executed with one
 * argument which is an instance of <code>http.ClientResponse</code>.
 *
 * During the <code>'response'</code> event, one can add listeners to the
 * response object; particularly to listen for the <code>'data'</code> event. Note that
 * the <code>'response'</code> event is called before any part of the response body is received,
 * so there is no need to worry about racing to catch the first part of the
 * body. As long as a listener for <code>'data'</code> is added during the <code>'response'</code>
 * event, the entire body will be caught.
 *
 * <pre>
 *     &#47;&#47; Good
 *     request.on('response', function (response) {
 *       response.on('data', function (chunk) {
 *         console.log('BODY: ' + chunk);
 *       });
 *     });
 *
 *     &#47;&#47; Bad - misses all or part of the body
 *     request.on('response', function (response) {
 *       setTimeout(function () {
 *         response.on('data', function (chunk) {
 *           console.log('BODY: ' + chunk);
 *         });
 *       }, 10);
 *     });
 * </pre>
 * This is a <code>Writable Stream</code>.
 *
 * This is an <code>EventEmitter</code> with the following events:
 * @constructor
 */
node.http.ClientRequest = function() {};


/**
 * @private
 * @type {*}
 */
node.http.ClientRequest.core_ = require("http").ClientRequest;