const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const tscPath = require.resolve('typescript/bin/tsc');

function runTsc(configFile) {
  console.log(`[BUILD] Compiling ${configFile}...`);
  const configPath = path.join(rootDir, configFile);
  const result = spawnSync(process.execPath, [tscPath, '-p', configPath], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`TypeScript compilation failed for ${configFile} with status ${result.status}`);
  }
}

try {
  runTsc('tsconfig.main.json');
  runTsc('tsconfig.preload.json');
  runTsc('tsconfig.renderer.json');

  console.log('[BUILD] Copying renderer static assets...');
  const distRenderer = path.join(rootDir, 'dist', 'renderer');
  fs.mkdirSync(distRenderer, { recursive: true });

  fs.copyFileSync(
    path.join(rootDir, 'src', 'renderer', 'index.html'),
    path.join(distRenderer, 'index.html')
  );

  fs.copyFileSync(
    path.join(rootDir, 'src', 'renderer', 'style.css'),
    path.join(distRenderer, 'style.css')
  );

  console.log('[BUILD] Successfully compiled and packaged distribution assets.');
} catch (err) {
  console.error('[BUILD ERROR]', err.message);
  process.exit(1);
}
