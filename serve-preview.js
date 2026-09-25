const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Projects/VALERIE/src-tauri/frontend';
const MIME = { html:'text/html', js:'application/javascript', css:'text/css', png:'image/png', svg:'image/svg+xml', ico:'image/x-icon', woff2:'font/woff2', json:'application/json', webmanifest:'application/manifest+json' };
http.createServer((req, res) => {
  let f = ROOT + req.url.split('?')[0];
  if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) f = ROOT + '/index.html';
  const ext = f.split('.').pop();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}).listen(4173, () => console.log('Static preview on http://localhost:4173'));
