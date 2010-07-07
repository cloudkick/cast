/* The principle of this app is as follows.
 * as messages come in it adds it to the end of
 * the buffer and then copies it to a new buffer shifted over 
 * chunk.length to make room for the new log lines.
 */
var stdin = process.openStdin(),
    http = require('http'),
    Buffer = require('buffer').Buffer,
    total = 512,
    buf = new Buffer(total),
    offset = 0;

stdin.setEncoding('utf8');

// Listen for the data and add it to the "Ring" Buffer
stdin.addListener('data', function (chunk) {
  process.stdout.write(chunk);
  if (offset + chunk.length > total) {
    // Going to buffer overrun. 
    var old_buf = buf;
    buf = new Buffer(total);
    old_buf.copy(buf, 0, chunk.length, old_buf.length);
    offset -= chunk.length;
  }
  offset += buf.write(chunk, offset);
});

http.createServer(function (request, response) {
  response.writeHead(200, {
    'content-type': 'text/plain',
    'stream': 'keep-alive',
    'accept': '*/*'});
  response.write(buf.slice(0, offset));
  stdin.addListener('data', function (chunk) {
    response.write(chunk);
  });
}).listen(8125);

console.log('Server running at http://127.0.0.1:8125/');