import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
await build({
  entryPoints: ['logo/src/main.js'],
  outfile: 'logo/spatial.js',
  bundle: true,
  minify: true,
  target: ['es2022'],
  format: 'esm',
  loader: { '.svg': 'text' },
  legalComments: 'linked',
  logLevel: 'info'
});
await mkdir('logo/licenses', { recursive: true });
await copyFile('node_modules/three/LICENSE', 'logo/licenses/three-LICENSE.txt');
