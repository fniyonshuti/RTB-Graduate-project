import { spawn } from 'node:child_process';

const isProduction = process.env.NODE_ENV === 'production';
const command = isProduction ? process.execPath : process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = isProduction ? ['src/server.js'] : ['nodemon', 'src/server.js'];

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
