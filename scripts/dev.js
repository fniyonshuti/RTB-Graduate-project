const { spawn } = require("node:child_process");

const processes = [];

function start(name, cwd, command) {
  const child = spawn(command, {
    cwd,
    shell: true,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
    }
  });

  processes.push(child);
}

function stopAll() {
  for (const child of processes) {
    if (!child.killed) child.kill("SIGINT");
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

start("backend", "backend", "npm.cmd run dev");
start("frontend", "my-project", "npm.cmd run dev");
