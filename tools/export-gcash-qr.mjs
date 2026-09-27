// One-off: export Gcash_QR.jpg → assets/img/gcash-qr.webp (cropped). Requires: node serve.mjs 3001
import { createRequire } from 'module';
const require = createRequire('C:/Users/Jess/Desktop/Claude/Optivion/package.json');
const puppeteer = require('puppeteer');
const b = await puppeteer.launch({ headless: true }); const p = await b.newPage();
await p.setViewport({ width: 1042, height: 2000 });
await p.setContent(`<body style="margin:0"><img id="i" src="http://localhost:3001/Gcash_QR.jpg" style="display:block;width:1042px">`, { waitUntil: 'load' });
console.log('natural', await p.$eval('#i', (i) => [i.naturalWidth, i.naturalHeight]));
await p.screenshot({ path: 'C:/Users/Jess/Desktop/Claude/DXN Bundle/assets/img/gcash-qr.webp', type: 'webp', quality: 92, clip: { x: 60, y: 70, width: 922, height: 1190 } });
await b.close(); console.log('ok');
