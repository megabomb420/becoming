import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'becoming-system-checks-'));
const outputFile = path.join(temporaryDirectory, 'system-checks.mjs');
const projectDirectory = fileURLToPath(new URL('..', import.meta.url));
const entryPoint = process.argv[2] ?? 'scripts/system_checks.ts';

try {
  await build({
    // fileURLToPath is required on Windows; URL.pathname produces /C:/... and
    // made the repository's own system check fail before any assertion ran.
    absWorkingDir: projectDirectory,
    entryPoints: [entryPoint],
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
