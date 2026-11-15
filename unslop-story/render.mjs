// Renders story.html to unslop-story.mp4 (1080x1080, 30fps, ~10s) using a virtual clock.
// Usage: node render.mjs [workdir]   (frames go to workdir, default $TMPDIR/unslop-frames; never into the repo)
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path'; import url from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(url.fileURLToPath(import.meta.url));
const work = process.argv[2] || path.join(os.tmpdir(), 'unslop-frames');
fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
const FPS = 30, OUT = 1080;

const browser = await chromium.launch();
const probe = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await probe.goto('file://' + path.join(here, 'story.html') + '?manual');
const [fx, fy, fw] = (await probe.$eval('meta[name="unslop-frame"]', m => m.content)).split(/\s+/).map(Number);
await probe.close();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: OUT / fw });
await page.goto('file://' + path.join(here, 'story.html') + '?manual');
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.__story.total);
const n = Math.round(total * FPS / 1000);
for (let i = 0; i < n; i++) {
  await page.evaluate(ms => window.__story.seek(ms), i * 1000 / FPS);
  await page.screenshot({ path: path.join(work, `f${String(i).padStart(4, '0')}.png`), clip: { x: fx, y: fy, width: fw, height: fw } });
}
await browser.close();
const ff = process.env.FFMPEG || 'ffmpeg';
execFileSync(ff, ['-y', '-framerate', String(FPS), '-i', path.join(work, 'f%04d.png'), '-vf', `scale=${OUT}:${OUT}`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', path.join(here, 'unslop-story.mp4')], { stdio: 'inherit' });
console.log('done', n, 'frames');
