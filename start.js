const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

function startProcess(command, args, cwd, name) {
  const proc = spawn(command, args, {
    cwd: path.join(__dirname, cwd),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });
  proc.on('error', (err) => console.error(`[${name}] Error:`, err.message));
  proc.on('close', (code) => { if (code !== null && code !== 0) console.log(`[${name}] exited with code ${code}`); });
  return proc;
}

function waitForServer(port, retries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let done = false;

    const check = () => {
      if (done) return;
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (done) return;
        if (res.statusCode === 200) {
          done = true;
          console.log(`[Startup] Backend is ready on port ${port}`);
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.setTimeout(400, () => { req.destroy(); retry(); });
    };

    const retry = () => {
      if (done) return;
      attempts++;
      if (attempts >= retries) {
        done = true;
        reject(new Error(`Backend did not start after ${retries} attempts`));
      } else {
        setTimeout(check, delay);
      }
    };

    check();
  });
}

async function main() {
  console.log('Starting NCET Paper Tracker...');
  const server = startProcess('node', ['index.js'], 'server', 'API Server');

  try {
    await waitForServer(3000);
    startProcess('npm', ['run', 'dev'], 'client', 'Frontend');
  } catch (err) {
    console.error('[Startup] Failed to start backend:', err.message);
    process.exit(1);
  }

  process.on('SIGTERM', () => { server.kill(); process.exit(0); });
}

main();
