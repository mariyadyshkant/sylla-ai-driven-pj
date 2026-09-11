const { _electron: electron } = require('playwright');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function launchApp() {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sylla-test-')), 'sylla.db');
  const env = { ...process.env, SYLLA_DB_PATH: dbPath, NODE_ENV: 'test' };
  // Some host shells (e.g. terminals embedded in an Electron app) export this,
  // which forces any Electron binary to run as plain Node and reject its own CLI flags.
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [path.join(__dirname, '..')],
    env,
  });
  const window = await app.firstWindow();
  await window.waitForSelector('[x-data]');
  return { app, window, dbPath };
}

async function closeApp({ app, dbPath }) {
  await app.close();
  fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
}

module.exports = { launchApp, closeApp };
