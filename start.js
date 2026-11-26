const { spawn, execSync } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

if (!isWindows) {
  try {
    execSync('fuser -k 3000/tcp 5000/tcp 2>/dev/null || true', { shell: true });
  } catch (_) {}
} else {
  try {
    // Clean up any existing processes on Windows ports
    execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :3000 ^| findstr LISTENING\') do taskkill /F /PID %a', { shell: true, stdio: 'ignore' });
  } catch (_) {}
  try {
    execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :5000 ^| findstr LISTENING\') do taskkill /F /PID %a', { shell: true, stdio: 'ignore' });
  } catch (_) {}
}

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
    const frontend = spawn(npmCommand, ['run', 'dev'], {
      cwd: path.join(__dirname, 'client'),
      stdio: 'inherit',
      shell: isWindows,
      env: { ...process.env }
    });

    frontend.on('error', (err) => console.error('Frontend error:', err.message));
    frontend.on('close', (code) => {
      if (code !== null && code !== 0) console.log('Frontend exited with code', code);
    });

    const cleanup = () => {
      backend.kill();
      frontend.kill();
    };

    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });

    process.on('exit', cleanup);
  }, 2000);
}, 500);
