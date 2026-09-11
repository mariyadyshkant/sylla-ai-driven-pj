// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
