import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'dist-tests');
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'tests', 'run.ts')],
  outfile: path.join(outDir, 'run.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  target: ['node18'],
  logLevel: 'info'
});

const p = spawn(process.execPath, [path.join(outDir, 'run.js')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '--enable-source-maps' }
});

p.on('exit', (code) => process.exit(code ?? 1));

