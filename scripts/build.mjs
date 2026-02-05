import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

await mkdir(dist, { recursive: true });

// Copy/emit manifest.json
const manifest = {
  manifest_version: 3,
  name: '豐存股交易折線圖',
  version: '0.1.0',
  description: '抓取豐存股歷史交易紀錄並用 ECharts 畫折線圖（含 VTI 對照）',
  permissions: ['storage'],
  host_permissions: ['https://aiinvest.sinotrade.com.tw/*', 'https://query1.finance.yahoo.com/*'],
  background: {
    service_worker: 'sw.js',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['https://aiinvest.sinotrade.com.tw/Account/Transaction*'],
      js: ['content.js'],
      run_at: 'document_idle'
    }
  ],
  action: {
    default_title: '豐存股交易折線圖'
  }
};

await writeFile(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const common = {
  bundle: true,
  sourcemap: true,
  target: ['es2022'],
  logLevel: 'info'
};

await build({
  ...common,
  entryPoints: [path.join(root, 'src', 'extension', 'content.ts')],
  outfile: path.join(dist, 'content.js'),
  format: 'iife'
});

await build({
  ...common,
  entryPoints: [path.join(root, 'src', 'extension', 'sw.ts')],
  outfile: path.join(dist, 'sw.js'),
  format: 'esm'
});

// Build demo page (pure HTML/CSS/JS output)
await build({
  ...common,
  entryPoints: [path.join(root, 'src', 'demo.ts')],
  outfile: path.join(dist, 'demo.js'),
  format: 'iife'
});

await copyFile(path.join(root, 'public', 'demo.html'), path.join(dist, 'demo.html'));
await copyFile(path.join(root, 'public', 'demo.css'), path.join(dist, 'demo.css'));
