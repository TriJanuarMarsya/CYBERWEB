const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

async function gen() {
  const certsDir = path.join(__dirname, 'certs');
  if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir);

  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = await selfsigned.generate(attrs, {
    algorithm: 'sha256',
    days: 365,
    keySize: 2048,
  });

  // pems might be a string or an object
  let cert, key;
  if (typeof pems === 'string') {
    const certMatch = pems.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
    const keyMatch = pems.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
    cert = certMatch ? certMatch[0] : null;
    key = keyMatch ? keyMatch[0] : null;
  } else {
    cert = pems.cert || pems.certificate;
    key = pems.private || pems.privateKey;
  }

  if (!cert || !key) {
    console.log('Raw output:', JSON.stringify(pems).substring(0, 500));
    throw new Error('Could not extract cert/key from output');
  }

  fs.writeFileSync(path.join(certsDir, 'cert.pem'), cert);
  fs.writeFileSync(path.join(certsDir, 'key.pem'), key);
  console.log('SSL certificates generated in certs/');
}

gen().catch(e => { console.error(e); process.exit(1); });
