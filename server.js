const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();
const { initSchema, loadAll, replaceAll } = require('./lib/db');

const HTTP_PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const HTTPS_PORT = 3443;
const BASE = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.ogg':  'video/ogg',
  '.avi':  'video/x-msvideo',
  '.mov':  'video/quicktime',
  '.mkv':  'video/x-matroska',
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt':  'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

function readData() {
  return loadAll();
}

function writeData(d) {
  return replaceAll(d);
}

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function handler(req, res) {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/drive.html';

  // ===== API: get full data store =====
  if (req.method === 'GET' && url === '/api/data') {
    readData()
      .then((data) => sendJSON(res, 200, data))
      .catch((e) => sendJSON(res, 500, { ok: false, error: String(e && e.message || e) }));
    return;
  }

  // ===== API: save full data store =====
  if (req.method === 'POST' && url === '/api/data') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
        if (typeof parsed !== 'object' || parsed === null) throw new Error('invalid body');
      } catch (e) {
        sendJSON(res, 400, { ok: false, error: 'invalid JSON' });
        return;
      }
      Promise.resolve()
        .then(() => initSchema())
        .then(() => writeData(parsed))
        .then(() => sendJSON(res, 200, { ok: true }))
        .catch((e) => sendJSON(res, 500, { ok: false, error: String(e && e.message || e) }));
    });
    return;
  }

  const filePath = path.join(BASE, url);

  // Security: prevent path traversal
  if (!filePath.startsWith(BASE)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Halaman Tidak Ditemukan</h1>');
      return;
    }

    const contentType = MIME[ext] || 'application/octet-stream';

    if (req.headers.range && (ext === '.mp4' || ext === '.webm' || ext === '.ogg' || ext === '.mkv' || ext === '.mov' || ext === '.avi')) {
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Start HTTP server
const httpServer = http.createServer(handler);
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  initSchema()
    .then(() => console.log('  ✔  Database (Neon) tersedia'))
    .catch((e) => console.log('  ⚠️  Database: ' + String(e && e.message || e)));
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║      🚀 Drive Storage Server Running          ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  HTTP:  http://localhost:${HTTP_PORT}               ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});

// Start HTTPS server
const certPath = path.join(BASE, 'certs', 'cert.pem');
const keyPath = path.join(BASE, 'certs', 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const sslOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  const httpsServer = https.createServer(sslOptions, handler);
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║      🔒 HTTPS Server Active                   ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║  HTTPS Local:   https://localhost:${HTTPS_PORT}       ║`);
    console.log(`  ║  HTTPS Network: https://${localIP}:${HTTPS_PORT}  ║`);
    console.log('  ║                                              ║');
    console.log('  ║  Akses dari HP/lainnya via link HTTPS:       ║');
    console.log(`  ║  → https://${localIP}:${HTTPS_PORT}        ║`);
    console.log('  ║                                              ║');
    console.log('  ║  Untuk link publik, jalankan:                ║');
    console.log('  ║  npx localtunnel --port 3443                 ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
  });
} else {
  console.log('  ⚠️  SSL certificates not found. HTTPS disabled.');
  console.log('  Run: node generate-cert.js');
}
