const { spawn } = require('child_process');
const path = require('path');

const proc = spawn('node', ['server/serve.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: false,
  env: { ...process.env }
});

proc.on('error', (err) => console.error('Error:', err.message));
proc.on('close', (code) => { if (code !== 0) console.log('Server exited with code', code); });
process.on('SIGTERM', () => { proc.kill(); process.exit(0); });
