const fs = require('fs');

const DATA_FILE = '/tmp/data.json';

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    res.statusCode = 200;
    res.end(JSON.stringify(readData()));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed !== 'object' || parsed === null) throw new Error('invalid body');
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed), 'utf8');
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }));
      }
    });
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
};