import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve(process.argv[2] ?? 'dist');
const assetsDirectory = path.join(outputDirectory, 'assets');
const assetNames = await readdir(assetsDirectory);
const javascript = (await Promise.all(
  assetNames
    .filter(name => name.endsWith('.js'))
    .map(name => readFile(path.join(assetsDirectory, name), 'utf8')),
)).join('\n');

assert.doesNotMatch(javascript, /Dev simulation|creature day \/ 1 real minute/,
  'the production bundle must not contain the accelerated-clock UI');
assert.doesNotMatch(javascript, /__DEV_TIME_SIMULATION__|__DEV_TIME_SCALE__/,
  'the production bundle must not contain an activatable simulation flag');
assert.doesNotMatch(javascript, /becoming-dev-time-session-v1/,
  'the production bundle must not contain dev simulation epoch storage');

console.log('Production bundle contains no accelerated-clock activation or UI.');
