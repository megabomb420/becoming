import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// EN/PL UI copy parity in the existing screens: every inline bilingual pair
// must carry both a non-empty English and a non-empty Polish string. This scans
// the rendered component screens (and the app shell) for the `t('en','pl')` and
// `uiText(ui,'en','pl')` literal call shapes.

const srcRoot = join(process.cwd(), 'src');

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

const targets = [join(srcRoot, 'App.tsx'), ...collect(join(srcRoot, 'components'))];

const pairs = [
  /\bt\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g,
  /\bt\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g,
  /uiText\(\s*[^,]+,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)/g,
  /uiText\(\s*[^,]+,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)/g,
];

let checked = 0;
const gaps: string[] = [];
for (const file of targets) {
  const source = readFileSync(file, 'utf8');
  for (const regex of pairs) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      checked += 1;
      if (!match[1].trim() || !match[2].trim()) {
        gaps.push(`${file}: "${match[1]}" / "${match[2]}"`);
      }
    }
  }
}

assert.ok(checked > 50, `copy scan must exercise the screens (found only ${checked} pairs)`);
assert.deepEqual(gaps, [], `EN/PL UI copy parity gaps (empty translation):\n${gaps.join('\n')}`);

console.log('EN/PL UI copy parity checks passed.');
