/* МЕДНИЦА · сборщики площадок с путём прототипа: tools/platform-build.mjs и tools/promo-build.mjs принимают `_proto/<имя>`
   (итог — <имя>-<площадка>, промо — promo/<имя>/), игры из корня — как раньше; чужие пути — отказ.
   Запуск: node _proto/mednitsa/tests/tools-proto.test.mjs   (без браузера; сборки — во временную папку вне репо) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build, gameName } from '../../../tools/platform-build.mjs';
import { gameName as promoName, checkTexts } from '../../../tools/promo-build.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PROMO = path.resolve(process.env.PROMO_DIR || path.join(REPO, '..', 'arcade-full', 'promo'));
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }

test('имя игры: kaskad → kaskad, _proto/mednitsa → mednitsa; чужие пути (.., вложенные, заглавные) — нет', () => {
  for (const f of [gameName, promoName]) {
    eq(f('kaskad'), 'kaskad'); eq(f('_proto/mednitsa'), 'mednitsa');
    for (const bad of ['../kaskad', '_proto/../kaskad', '_proto/a/b', '_shared', 'tools/x', 'Kaskad', '/kaskad', '_proto/']) eq(f(bad), null, bad);
  }
});
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-build-'));
try {
  test('platform-build _proto/mednitsa → mednitsa-web и mednitsa-yandex: index.html в корне, без tests/ и *.md, отчёт slug=mednitsa src=_proto/mednitsa', () => {
    for (const pl of ['web', 'yandex']) {
      const r = build('_proto/mednitsa/', pl, out, { noZip: true });
      ok(r.ok, pl + ': ' + r.errors.join(' | ')); eq(r.slug, 'mednitsa'); eq(r.src, '_proto/mednitsa');
      const d = path.join(out, 'mednitsa-' + pl); ok(fs.existsSync(path.join(d, 'index.html')), 'index.html');
      ok(!fs.existsSync(path.join(d, 'tests')) && !fs.existsSync(path.join(d, 'README.md')), 'служебное не попало в сборку');
      ok(fs.existsSync(path.join(out, 'mednitsa-' + pl + '.build.json')), 'отчёт');
      const html = fs.readFileSync(path.join(d, 'index.html'), 'utf8'); ok(!/data-catalog-back/.test(html), '«← Каталог» убран'); ok(html.includes('platform=' + pl), 'адаптер');
      if (fs.existsSync(path.join(PROMO, 'mednitsa', 'promo.json'))) { ok(r.names && r.names.ru, 'названия из promo/mednitsa'); ok(/<title data-en="Boilerwright">Медница<\/title>/.test(html), '<title> из promo.json'); }
    }
  });
  test('platform-build: игра из корня — по-старому (kaskad → kaskad-web)', () => {
    const r = build('kaskad', 'web', out, { noZip: true }); ok(r.ok, r.errors.join('|')); eq(r.slug, 'kaskad'); eq(r.src, 'kaskad'); ok(fs.existsSync(path.join(out, 'kaskad-web', 'index.html')));
  });
  test('CLI: чужой путь — отказ с кодом 2 (platform-build и promo-build)', () => {
    for (const args of [['tools/platform-build.mjs', '_proto/../kaskad', 'web', out], ['tools/platform-build.mjs', '_shared', 'web', out], ['tools/promo-build.mjs', '_proto/../kaskad', '--check'], ['tools/promo-build.mjs', '_proto/nope', '--check']]) {
      let code = 0; try { execFileSync('node', args, { cwd: REPO, stdio: 'pipe' }); } catch (e) { code = e.status; } eq(code, 2, args.join(' '));
    }
  });
  test('promo-build --check _proto/mednitsa: тексты promo/mednitsa/promo.json — 0 ошибок (длины, дубли, запрещённые слова)', () => {
    const f = path.join(PROMO, 'mednitsa', 'promo.json'); if (!fs.existsSync(f)) { console.log('     (нет ' + f + ' — пропуск)'); return; }
    eq(checkTexts(JSON.parse(fs.readFileSync(f, 'utf8'))).join(' | '), '');
    const r = execFileSync('node', ['tools/promo-build.mjs', '_proto/mednitsa', '--check'], { cwd: REPO, encoding: 'utf8' }); ok(/^OK\s+promo\/mednitsa(\/promo\.json)?: ошибок 0/m.test(r), r);
  });
} finally { fs.rmSync(out, { recursive: true, force: true }); }
console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
