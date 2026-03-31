const { spawn } = require('child_process');
const path = require('path');

function startProcess(command, args, cwd, name) {
  const proc = spawn(command, args, {
    cwd: path.join(__dirname, cwd),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });

  proc.on('error', (err) => {
    console.error(`[${name}] Error:`, err.message);
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
    }
  });

  return proc;
}

console.log('Starting NCET Paper Tracker...');
const server = startProcess('node', ['index.js'], 'server', 'API Server');
setTimeout(() => {
  const client = startProcess('npm', ['run', 'dev'], 'client', 'Frontend');
}, 2000);

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
