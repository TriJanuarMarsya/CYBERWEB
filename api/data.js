const { initSchema, loadAll, replaceAll } = require('../lib/db');

async function withDb(fn) {
  if (!process.env.DATABASE_URL) return { error: 'DATABASE_URL is not set' };
  try {
    await initSchema();
    return await fn();
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    const result = await withDb(async () => ({ data: await loadAll() }));
    if (result.error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: result.error }));
      return;
    }
    res.statusCode = 200;
    res.end(JSON.stringify(result.data));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
        if (typeof parsed !== 'object' || parsed === null) throw new Error('invalid body');
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }));
        return;
      }
      const result = await withDb(async () => {
        await replaceAll(parsed);
        return { ok: true };
      });
      if (result.error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: result.error }));
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    });
    return;
  }

  res.statusCode = 405;
  res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
};