#!/usr/bin/env node
/**
 * thumbs.mjs — перегенерация превью каталога (assets/catalog/thumbs/<slug>-{retro,modern}.webp).
 *
 * Зачем: превью снимаются с живой игры, а не рисуются вручную, — тогда они не отстают
 * от текущей версии игры (12.11 выяснилось, что превью висели с 02.11, до ребрендинга).
 *
 * Как работает: поднимает статический сервер по корню репо, открывает каждую игру в
 * Playwright (Chromium), включает нужную тему, стартует игру, немного «играет» стрелками,
 * снимает самый большой <canvas> и вписывает кадр в 720×405 (WebP кодирует сам браузер).
 *
 * Запуск (нужен Playwright: `npm i -D playwright` или глобально):
 *   node tools/thumbs.mjs              # все игры из assets/catalog/games.json
 *   node tools/thumbs.mjs roy razrez   # только перечисленные
 * После перегенерации — поднять THUMB_REV в assets/catalog/catalog.js (сброс кэша).
 *
 * Способ выбора темы определяется автоматически:
 *   • игра на движке v2 (подключает ./engine.js) — localStorage 'arcade.theme';
 *   • игры с параметром #gfx= в адресе (vihr, rubikon, neon-yarost) — через hash;
 *   • остальные — снимок, затем клавиша G (переключение графики) и второй снимок.
 * Особые старты (кнопки, интро) — в таблице START ниже.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/catalog/thumbs');
const W = 720, H = 405;

/* Игры, где тема задаётся параметром в адресе. */
const HASH_GFX = { vihr: '', rubikon: '', 'neon-yarost': '&demo=1' };
/* Игры на G-переключателе, у которых после G получается retro (по умолчанию — modern). */
const TOGGLE_DEFAULT_MODERN = new Set(['saga']);
/* Особые способы начать игру. */
const START = {
  /* меню движка → Enter, затем родной брифинг сектора «ENTER — В БОЙ» */
  proryv: async (p) => { for (let i = 0; i < 3; i += 1) { await p.keyboard.press('Enter'); await p.waitForTimeout(700); } },
  'saga-2': async (p) => {
    /* с v2: меню движка → Enter, затем родной брифинг «В путь» → Enter */
    for (let i = 0; i < 3; i += 1) { await p.keyboard.press('Enter'); await p.waitForTimeout(700); }
  },
  rubezh: async (p) => {
    await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    await p.getByText(/начать операцию/i).first().click({ timeout: 3000 }).catch(() => {});
    await p.keyboard.press('Enter');
  },
  saga: async (p) => {
    for (let i = 0; i < 2; i += 1) { await p.keyboard.press('Enter'); await p.waitForTimeout(600); }
    await p.getByText(/вперёд/i).first().click({ timeout: 3000 }).catch(() => {});
  },
  ruslo: async (p) => { await p.keyboard.press('Enter'); },
  'neon-yarost': async () => {},
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

function serve() {
  return new Promise((ok) => {
    const srv = createServer(async (req, res) => {
      try {
        let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        let file = join(ROOT, path);
        if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
        if (existsSync(file) && (await stat(file)).isDirectory()) file = join(file, 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
      } catch { res.writeHead(404).end(); }
    });
    srv.listen(0, '127.0.0.1', () => ok(srv));
  });
}

async function biggestCanvas(p) {
  return p.evaluate(() => {
    let best = null;
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect(); const a = r.width * r.height;
      if (r.width > 50 && (!best || a > best.a)) best = { x: r.x, y: r.y, w: r.width, h: r.height, a };
    }
    return best;
  });
}

/* Снимок canvas → вписать в 720×405 → WebP (кодирует Chromium). */
async function capture(page, helper, file) {
  const b = await biggestCanvas(page);
  const clip = b ? { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.w, 1280), height: Math.min(b.h, 720) } : undefined;
  const png = await page.screenshot(clip ? { clip } : {});
  const dataUrl = await helper.evaluate(async ({ src, W, H }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const probe = document.createElement('canvas'); probe.width = probe.height = 1;
    probe.getContext('2d').drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
    const [r, g, bl] = probe.getContext('2d').getImageData(0, 0, 1, 1).data;
    x.fillStyle = `rgb(${r},${g},${bl})`; x.fillRect(0, 0, W, H);
    const ra = img.width / img.height, rt = W / H;
    const cover = Math.abs(ra - rt) / rt < 0.25;
    const s = cover ? Math.max(W / img.width, H / img.height) : Math.min(W / img.width, H / img.height);
    const w = img.width * s, h = img.height * s;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    return c.toDataURL('image/webp', 0.82);
  }, { src: 'data:image/png;base64,' + png.toString('base64'), W, H });
  await writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

async function play(p, slug, v2) {
  await p.mouse.click(5, 5).catch(() => {});
  if (START[slug]) await START[slug](p);
  else if (v2) await p.keyboard.press('Enter');
  else { await p.keyboard.press('Enter'); await p.waitForTimeout(300); await p.keyboard.press('Space'); }
  await p.waitForTimeout(500);
  for (const k of ['ArrowRight', 'ArrowUp', 'ArrowLeft']) { await p.keyboard.down(k); await p.waitForTimeout(400); await p.keyboard.up(k); }
  await p.waitForTimeout(1200);
}

async function main() {
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch {
    /* ESM не смотрит в NODE_PATH — пробуем обычный require (глобальная установка). */
    try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { console.error('Нужен Playwright: npm i -D playwright'); process.exit(1); }
  }
  const catalog = JSON.parse(readFileSync(join(ROOT, 'assets/catalog/games.json'), 'utf8'));
  const all = (catalog.games || catalog).map((g) => g.slug);
  const only = process.argv.slice(2);
  const slugs = only.length ? all.filter((s) => only.includes(s)) : all;
  const srv = await serve(); const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const helper = await browser.newPage();
  let fails = 0;
  for (const slug of slugs) {
    const html = readFileSync(join(ROOT, slug, 'index.html'), 'utf8');
    const v2 = /src=["']\.\/engine\.js/.test(html);
    try {
      if (v2 || slug in HASH_GFX) {
        for (const theme of ['retro', 'modern']) {
          const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
          if (v2) await ctx.addInitScript((t) => { try { localStorage.setItem('arcade.theme', t); } catch {} }, theme);
          const p = await ctx.newPage();
          const url = `${base}/${slug}/` + (slug in HASH_GFX ? `#gfx=${theme}${HASH_GFX[slug]}` : '');
          await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(1200);
          if (slug === 'neon-yarost') await p.waitForTimeout(2500); else await play(p, slug, v2);
          await capture(p, helper, join(OUT, `${slug}-${theme}.webp`));
          await ctx.close();
        }
      } else {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const p = await ctx.newPage();
        await p.goto(`${base}/${slug}/`, { waitUntil: 'load' }); await p.waitForTimeout(1200);
        await play(p, slug, false);
        const [first, second] = TOGGLE_DEFAULT_MODERN.has(slug) ? ['modern', 'retro'] : ['retro', 'modern'];
        await capture(p, helper, join(OUT, `${slug}-${first}.webp`));
        await p.keyboard.press('KeyG'); await p.waitForTimeout(800);
        await capture(p, helper, join(OUT, `${slug}-${second}.webp`));
        await ctx.close();
      }
      console.log('OK  ', slug);
    } catch (e) { fails += 1; console.log('FAIL', slug, e.message); }
  }
  await browser.close(); srv.close();
  console.log(`\nГотово: ${slugs.length - fails}/${slugs.length}. Не забудь поднять THUMB_REV в assets/catalog/catalog.js.`);
  process.exit(fails ? 1 : 0);
}
main();
