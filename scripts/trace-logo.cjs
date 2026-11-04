const potrace = require('potrace');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
potrace.trace(path.join(root, '.cache/logo-mask.png'), {
  threshold: 128,
  turdSize: 2,
  optTolerance: .15,
  color: '#303b48'
}, (error, svg) => {
  if (error) throw error;
  fs.writeFileSync(path.join(root, 'logo/assets/logo.svg'), svg + '\n');
  console.log('Traced original logo contours, including counters.');
});
