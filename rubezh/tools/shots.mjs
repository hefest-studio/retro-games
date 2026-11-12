#!/usr/bin/env node
/**
 * РУБЕЖ — screenshot generator (dependency-free).
 *
 * Uses installed Chrome in headless mode. Every shot gets its own temporary
 * profile; a 25 s watchdog kills a stuck browser so the batch can continue.
 *
 *   node tools/shots.mjs                 # все скриншоты
 *   node tools/shots.mjs --only title    # только имена, содержащие "title"
 *   node tools/shots.mjs --list          # показать список
 *
 * Скриншоты кладутся в rubezh/screenshots/.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'screenshots');
const PAGE = 'file://' + join(ROOT, 'legacy.html'); // родные экраны игры (index.html — движок v2)
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const SHOTS = [
  { name: 'title_modern',    size: [1280, 720], hash: '#gfx=modern' },
  { name: 'title_retro',     size: [1280, 720], hash: '#gfx=retro' },
  { name: 'title_en',        size: [1280, 720], hash: '#gfx=modern&lang=en' },
  { name: 'brief_modern',    size: [1280, 720], hash: '#shot=brief&stage=1&gfx=modern' },
  { name: 'play_modern',     size: [1280, 720], hash: '#shot=play&stage=1&x=1700&fire=1&gfx=modern' },
  { name: 'play_retro',      size: [1280, 720], hash: '#shot=play&stage=1&x=1500&fire=1&gfx=retro' },
  { name: 'play2_modern',    size: [1280, 720], hash: '#shot=play&stage=2&x=2600&fire=1&gfx=modern' },
  { name: 'laser_modern',    size: [1280, 720], hash: '#shot=play&stage=2&x=1450&fire=1&lasers=on&gfx=modern' },
  { name: 'boss_modern',     size: [1280, 720], hash: '#shot=boss&stage=1&gfx=modern' },
  { name: 'boss2_modern',    size: [1280, 720], hash: '#shot=boss&stage=2&gfx=modern' },
  { name: 'howto_modern',    size: [1280, 720], hash: '#shot=howto&gfx=modern' },
  { name: 'settings_modern', size: [1280, 720], hash: '#shot=settings&gfx=modern' },
  { name: 'pause_modern',    size: [1280, 720], hash: '#shot=pause&gfx=modern' },
  { name: 'over_modern',     size: [1280, 720], hash: '#shot=over&stage=1&gfx=modern' },
  { name: 'clear_modern',    size: [1280, 720], hash: '#shot=clear&stage=1&gfx=modern' },
  { name: 'win_modern',      size: [1280, 720], hash: '#shot=win&gfx=modern' },
  { name: 'mobile_landscape', size: [844, 390], hash: '#shot=play&stage=1&x=1500&fire=1&gfx=modern&touch=1' },
  { name: 'portrait_hint',   size: [500, 900],  hash: '#gfx=modern' },
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error('Chrome/Chromium not found');
}

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const s of SHOTS) console.log(`${s.name.padEnd(18)} ${s.size[0]}x${s.size[1]}  ${s.hash}`);
  process.exit(0);
}
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] || '' : '';
const picked = only ? SHOTS.filter((s) => s.name.includes(only)) : SHOTS;
if (!picked.length) { console.error('no shots matched --only ' + only); process.exit(2); }

const chrome = findChrome();
mkdirSync(OUT_DIR, { recursive: true });
const profileRoot = join(tmpdir(), 'rubezh-shots');
let ok = 0, fail = 0;

for (const shot of picked) {
  const out = join(OUT_DIR, shot.name + '.png');
  const profile = join(profileRoot, shot.name + '-' + process.pid);
  rmSync(profile, { recursive: true, force: true });
  rmSync(out, { force: true });
  const [w, h] = shot.size;
  const res = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crash-reporter',
    '--disable-breakpad', '--disable-dev-shm-usage', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files',
    '--user-data-dir=' + profile,
    '--virtual-time-budget=2800',
    '--window-size=' + w + ',' + h,
    '--screenshot=' + out,
    PAGE + shot.hash,
  ], { stdio: 'ignore', timeout: 25000, killSignal: 'SIGKILL' });
  rmSync(profile, { recursive: true, force: true });
  try {
    if (res.error && res.error.code !== 'ETIMEDOUT') throw res.error;
    const sz = statSync(out).size;
    if (sz < 5000) throw new Error('too small: ' + sz);
    console.log('🖼  ' + shot.name + '.png  ' + Math.round(sz / 1024) + ' KB');
    ok++;
  } catch (e) {
    console.log('✖  ' + shot.name + ': ' + (e.message || e));
    fail++;
  }
}
console.log(`\n${ok} OK, ${fail} failed → ${OUT_DIR}`);
process.exit(fail ? 1 : 0);
