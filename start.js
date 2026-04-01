const { spawn, execSync } = require('child_process');

// Kill anything already on port 5000 before starting
try {
  execSync('fuser -k 5000/tcp 2>/dev/null || true', { shell: true });
} catch (_) {}

// Small delay to let the OS reclaim the port
setTimeout(() => {
  const proc = spawn('node', ['server/serve.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env }
  });

  proc.on('error', (err) => console.error('Startup error:', err.message));
  proc.on('close', (code) => {
    if (code !== null && code !== 0) console.log('Server exited with code', code);
  });
  process.on('SIGTERM', () => { proc.kill(); process.exit(0); });
}, 500);
