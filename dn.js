const http = require('http');
const JsonStream = require('JSONStream');
const url = require('url');
const fs = require('fs');

const server = http.createServer();

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
server.on('connection', (socket) => {
  var address = {
    family: socket.remoteFamily,
    address: socket.remoteAddress,
    port: socket.remotePort
  };
  console.log('new connection from', address);
  socket.on('close', (had_error) => {
    console.log('connection closed to', address, had_error ? '(errored)' : '(ok)');
  })
});
server.on('listening', () => {
  console.log('server listening on', server.address());
});

var clients = {};
/* {
  'codeXYZ': [client1, client2]
} */

var data_methods = {'POST':1, 'PUT':1};
server.on('request', (req, res) => {
  var parsed = url.parse(req.url);
  if (req.method in data_methods) {
    var count = 0;
    req.pipe(JsonStream.parse()).on('data', (data) => {
      count++;
      if (count <= 1) {
        handle(req, res, req.method, parsed.pathname, parsed.query, data);
      } else {
        //console.log('discarding extra json');
      }
    });
  } else {
    handle(req, res, req.method, parsed.pathname, parsed.query, null);
  }
});

var handle = (req, res, method, path, query, json) => {
  if (method == 'GET' && path == '/') {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    fs.readFile('index.html', 'utf8', (err, data) => {
        if (err) throw err;
        res.end(data);
    });
  } else if (method == 'GET' && path.startsWith('/v1/events/')) {
    var code = path.substring('/v1/events/'.length);
    res.writeHead(200, {'Content-Type': 'text/event-stream'});
    if (!(code in clients)) {
      clients[code] = [];
    }
    clients[code].push(res);
    req.on('close', () => {
      var idx = clients[code].indexOf(res);
      if (idx > -1) {
        clients[code].splice(idx, 1);
      } else {
        console.log('could not remove client from list');
      }
    });
    res.write(': You are now connected\n\n');
  } else if (method == 'POST' && path.startsWith('/v1/notify/')) {
    var code = path.substring('/v1/notify/'.length);
    if (code in clients) {
      var data = JSON.stringify(json);
      clients[code].forEach((res) => {
        res.write('event: notification\ndata: ' + data + '\n\n');
      });
    }
    console.log('notification ' + code);
    res.end('{"status":"ok"}');
  } else {
    console.log(404, method, path);
    res.writeHead(404);
    res.end('{"status":"not found"}');
  }
}

server.listen(8900, '0.0.0.0');
