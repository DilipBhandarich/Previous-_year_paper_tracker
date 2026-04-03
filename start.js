const { spawn, execSync } = require('child_process');

try {
  execSync('fuser -k 3000/tcp 5000/tcp 2>/dev/null || true', { shell: true });
} catch (_) {}

setTimeout(() => {
  const backend = spawn('node', ['server/index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env }
  });

  backend.on('error', (err) => console.error('Backend error:', err.message));
  backend.on('close', (code) => {
    if (code !== null && code !== 0) console.log('Backend exited with code', code);
  });

  setTimeout(() => {
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: require('path').join(__dirname, 'client'),
      stdio: 'inherit',
      shell: false,
      env: { ...process.env }
    });

    frontend.on('error', (err) => console.error('Frontend error:', err.message));
    frontend.on('close', (code) => {
      if (code !== null && code !== 0) console.log('Frontend exited with code', code);
    });

    process.on('SIGTERM', () => {
      backend.kill();
      frontend.kill();
      process.exit(0);
    });
  }, 2000);
}, 500);
