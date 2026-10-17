import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from './version.js';

test('release version is valid and matches npm metadata', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/);
  assert.equal(packageJson.version, APP_VERSION);
});
