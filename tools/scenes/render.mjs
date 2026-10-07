// Renders the shop scenes to assets/scenes/<id>.webp.
// Usage: node tools/scenes/render.mjs [id ...]   (needs a static server on :8765 at the repo root)
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['lisbon'];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e));
await page.goto('http://127.0.0.1:8765/tools/scenes/render.html');
await page.waitForFunction(() => window.ready);
for (const id of ids) {
    const t0 = Date.now();
    const { url, anim } = await page.evaluate(([id]) => window.renderScene(id, 1170, 2400), [id]);
    fs.writeFileSync(`assets/scenes/web/${id}.webp`, Buffer.from(url.split(',')[1], 'base64'));
    fs.writeFileSync(`assets/scenes/web/${id}.json`, JSON.stringify(anim));
    console.log(id, Date.now() - t0, 'ms', fs.statSync(`assets/scenes/web/${id}.webp`).size, 'bytes');
}
await browser.close();
