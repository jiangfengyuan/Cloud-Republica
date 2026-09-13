'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');

for (const entry of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join(root, entry), path.join(output, entry));
}

for (const directory of ['js', 'assets']) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(output, directory), { recursive: true });
  }
}

console.log('Built offline-compatible dist/index.html with the legacy UI and the new domain bundle.');
