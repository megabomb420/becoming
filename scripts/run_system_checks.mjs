import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'becoming-system-checks-'));
const outputFile = path.join(temporaryDirectory, 'life-path-checks.mjs');

try {
  await build({
    entryPoints: [new URL('./life_path_checks.ts', import.meta.url).pathname],
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  });

  await import(pathToFileURL(outputFile).href);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
