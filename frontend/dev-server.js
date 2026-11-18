'use strict';

// Local-only static server. Deployment should use an HTTPS static host.
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.FRONTEND_PORT || 8080);
const basePath = '/prjD6';
const files = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/app.js': 'app.js',
  '/config.js': 'config.js',
  '/styles.css': 'styles.css'
};
const contentTypes = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'application/javascript; charset=utf-8',
  'config.js': 'application/javascript; charset=utf-8',
  'styles.css': 'text/css; charset=utf-8'
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/') {
    res.writeHead(302, { Location: `${basePath}/` });
    res.end();
    return;
  }
  if (!url.pathname.startsWith(`${basePath}/`)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const fileName = files[url.pathname.slice(basePath.length)];
  if (!fileName || req.method !== 'GET') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  fs.readFile(path.join(__dirname, fileName), (error, data) => {
    if (error) {
      res.writeHead(500);
      res.end('Could not read file');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[fileName], 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`Frontend development server: http://localhost:${port}${basePath}/`);
});

