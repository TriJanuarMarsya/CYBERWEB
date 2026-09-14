const { exec } = require('child_process');

console.log('');
console.log('  Starting Drive Storage with HTTPS + Public Link...');
console.log('');

// Start main server
const server = exec('node server.js', { cwd: __dirname });
server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

// Wait a moment then start tunnel
setTimeout(() => {
  console.log('');
  console.log('  Creating public HTTPS tunnel...');
  console.log('  (Tunnel URL will appear below)');
  console.log('');

  const tunnel = exec('npx localtunnel --port 3443', { cwd: __dirname });
  tunnel.stdout.pipe(process.stdout);
  tunnel.stderr.pipe(process.stderr);

  tunnel.on('error', (err) => {
    console.log('  Tunnel error:', err.message);
  });
}, 2000);

process.on('SIGINT', () => {
  server.kill();
  process.exit();
});
