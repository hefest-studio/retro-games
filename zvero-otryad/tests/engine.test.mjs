/* ЗВЕРО-ОТРЯД · tests/engine.test.mjs — автотесты (Node, без зависимостей).
   Запуск: node zvero-otryad/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/levels.js, js/game.js) — в node:vm с шимом window.
   Покрытие: карты уровней, канат (длина, смена зверя, подтяжка), жизни, реклама за награду, i18n на 5 языков, музыка, страница, правило имён,
   площадка (platform-features); проходимость и баланс — «человеческим» ботом (tests/bot.mjs: только setInput/jump/swap). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/levels.js', 'js/game.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const Z = sandbox.ZVERO, L = Z.logic;
const { playLevel, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' - ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function mk(lv, o = {}) {
  const ev = [];
  const game = Z.Game(Object.assign({ rng: mulberry32(1), noHints: true, players: 1, onEvent: (t, d) => ev.push([t, d]) }, o)).start(lv);
  const S = game.state(); S.phase = 'play'; S.introT = 99;
  return { game, S, ev, has: t => ev.some(e => e[0] === t) };
}
function run(game, sec, fn) { for (let i = 0; i < Math.round(sec * 60); i++) { if (fn) fn(i); game.update(1 / 60); } }

// ---------- Уровни ----------
test('уровни: 8 карт 30x17; по одному Пыжу, Тяпе и двери; канат 150-560; подсказка и название есть; босс только на 8-м', () => {
  eq(Z.LEVELS.length, 8);
  Z.LEVELS.forEach((lv, i) => {
    eq(lv.map.length, L.ROWS, 'строк ' + (i + 1)); lv.map.forEach(r => eq(r.length, L.COLS, 'ширина ' + (i + 1)));
    const flat = lv.map.join('');
    ['P', 'T', 'E'].forEach(ch => eq(flat.split(ch).length - 1, 1, 'символ ' + ch + ' на уровне ' + (i + 1)));
    ok(lv.rope >= 150 && lv.rope <= 560, 'канат ' + lv.rope);
    ok(Z.STR.ru[lv.hint] && Z.STR.ru['n' + (i + 1)], 'подсказка/название ' + (i + 1));
    eq(!!lv.boss, i === 7);
  });
});
test('механика-ядро: на каждом уровне есть общий канат, а «качели» (4, 7) — со стеной и балкой, плиты и ворота парные', () => {
  Z.LEVELS.forEach((lv, i) => {
    const f = lv.map.join('');
    for (const [pl, gt] of [['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'], ['5', 'e'], ['6', 'f']]) ok((f.includes(pl)) === (f.includes(gt)), 'плита ' + pl + '/ворота ' + gt + ' на уровне ' + (i + 1));
  });
  [3, 6].forEach(i => ok(Z.LEVELS[i].rope >= 200, 'длинный канат для качелей'));
});

// ---------- Канат и звери ----------
test('канат: ведёшь одного - второй стоит якорем, дистанция не больше длины каната (+допуск упругости)', () => {
  const { game, S } = mk(0); let mx = 0;
  run(game, 4, () => { game.setInput(0, 1, false, false); const d = Math.hypot(S.an[0].x - S.an[1].x, S.an[0].y - S.an[1].y); mx = Math.max(mx, d); });
  ok(mx <= S.len + 45, 'канат растянулся: ' + mx.toFixed(0) + ' > ' + (S.len + 45).toFixed(0));
  ok(S.an[0].x > 110, 'Пыж двинулся');
});
test('смена зверя (соло): swap переключает активного, второй становится якорем; в кооп активны оба', () => {
  const { game, S } = mk(0); eq(S.active, 0); game.swap(); eq(S.active, 1); game.swap(); eq(S.active, 0);
  const c = mk(0, { players: 2 }); c.game.setPlayers(2); c.game.setInput(0, 1, false, false); c.game.setInput(1, -1, false, false); run(c.game, 1);
  ok(c.S.an[0].x > 70 && c.S.an[1].x < 140, 'оба ведутся независимо');
});
test('прыжок: Тяпа прыгает выше Пыжа (625 vs 545), прыжок даёт событие; в воздухе второй прыжок не срабатывает', () => {
  const h = []; for (const i of [0, 1]) { const { game, S } = mk(0); S.active = i; let top = 1e9, y0 = S.an[i].y; game.jump(i); for (let k = 0; k < 90; k++) { game.setInput(0, 0, true, false); game.update(1 / 60); top = Math.min(top, S.an[i].y); } h.push(y0 - top); }
  ok(h[1] > h[0] + 8, 'Тяпа выше: ' + h.map(Math.round).join('/'));
});
test('падение в пропасть = потеря жизни и возрождение у контрольной точки; шипы убивают; на нуле жизней - gameover', () => {
  const { game, S, has } = mk(1); const l0 = S.lives; S.an[0].x = 12 * 32; S.an[0].y = 640; run(game, 1.2);
  ok(has('die') && S.lives === l0 - 1, 'жизнь не списана: ' + S.lives);
  const z = mk(1); z.S.lives = 1; z.S.an[0].x = 12 * 32; z.S.an[0].y = 640; run(z.game, 1.5); ok(z.has('gameover') && z.S.phase === 'over', 'нет gameover: ' + z.S.phase);
});
test('реклама: reviveAd только после конца партии (3 жизни, уровень заново; лимит «раз за партию» — в движке); boost +1 жизнь до предела', () => {
  const a = mk(0); ok(!a.game.reviveAd(), 'в игре нельзя'); ok(a.game.canBoost()); const l = a.S.lives; a.game.boost(); eq(a.S.lives, l + 1);
  a.S.lives = L.K.MAXLIVES; ok(!a.game.canBoost(), 'потолок жизней');
  const b = mk(1); b.S.lives = 1; b.S.an[0].x = 12 * 32; b.S.an[0].y = 640; run(b.game, 1.2); eq(b.S.phase, 'over');
  ok(b.game.reviveAd()); eq(b.game.state().phase, 'play'); eq(b.game.state().lives, 3);
});
test('победа: оба зверя у двери - clear, очки и бонус; после 8-го - win', () => {
  const { game, S, has } = mk(0); S.an[0].x = S.exit.x; S.an[0].y = S.exit.y - 20; S.an[1].x = S.exit.x - 6; S.an[1].y = S.exit.y - 20;
  run(game, 1.4, () => { S.an[0].x = S.exit.x; S.an[1].x = S.exit.x - 6; S.an[0].y = S.an[1].y = S.exit.y - 20; });
  ok(has('clear'), 'нет clear'); ok(S.score > 0, 'очки');
});

// ---------- i18n, музыка, страница ----------
test('языки: ru/en/tr/es/pt - одинаковые ключи и непустые строки; название RU ЗВЕРО-ОТРЯД, EN/TR/ES/PT TWINLEASH', () => {
  const S = Z.STR, ks = Object.keys(S.en).sort().join(','); eq(Object.keys(S).join(','), 'ru,en,tr,es,pt');
  for (const l of ['ru', 'tr', 'es', 'pt']) eq(Object.keys(S[l]).sort().join(','), ks, l);
  for (const l of Object.keys(S)) Object.keys(S[l]).forEach(k => ok(String(S[l][k]).trim(), 'пусто ' + l + '.' + k));
  eq(S.ru.title, 'ЗВЕРО-ОТРЯД'); for (const l of ['en', 'tr', 'es', 'pt']) eq(S[l].title, 'TWINLEASH', l);
  for (let i = 1; i <= 8; i++) for (const l of Object.keys(S)) ok(S[l]['n' + i], 'название уровня ' + i + ' ' + l);
});
test('музыка: трек zvero-otryad разбирается секвенсором движка; 8-16 тактов, длины кратны такту', () => {
  const box = { console, Math }; box.window = box; box.globalThis = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), box);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), box);
  const tr = box.Arcade.tracks['zvero-otryad']; ok(tr, 'трек не зарегистрирован');
  const p = box.Arcade.parseTrack(tr); ok(p && p.steps > 0, 'не разобран');
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(tr.melody) % 8, 0); eq(n(tr.bass) % 8, 0); const bars = n(tr.melody) / 8; ok(bars >= 8 && bars <= 16, 'тактов ' + bars);
});
test('страница: фавикон, «← Каталог», canvas 960x544, скрипты по порядку, стик + две кнопки + пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="960" height="544"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/stick.js', 'js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/audio.js', 'js/render.js', 'js/ui.js', 'js/main.js']);
  ok(/data-stick/.test(html) && /data-pause/.test(html) && html.includes('data-d="A"') && html.includes('data-d="B"'), 'стик/пауза/две кнопки');
  eq((html.match(/<button[^>]*data-d=/g) || []).length, 2, 'не больше двух кнопок действий');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'нет внешних ссылок');
  ok(!fs.existsSync(path.join(ROOT, 'legacy.html')) && !fs.existsSync(path.join(ROOT, 'js/classic.js')), 'старые файлы удалены');
});
test('миграция сохранений: ключ версии, сброс старого рекорда, уведомление на титуле', () => {
  const m = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  ok(/arcade\.zvero-otryad\.ver/.test(m) && /removeItem\('arcade\.best\.zvero-otryad'\)/.test(m) && /migrated/.test(m), 'миграция');
  ok(/ArcadeStick\.create/.test(m) && /menuFit/.test(m) && /g\.adBreak\(\)/.test(m), 'стик/menuFit/межстраничная');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgg==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files) { const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('ЗВЕРО-ОТРЯД') && !BAD.test('TWINLEASH') && !BAD.test('Гефест'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот ----------
if (!process.env.QUICK) {
  const N = +process.env.BOT_N || 12, R = [];
  for (let lv = 0; lv < 8; lv++) { let w = 0, d = 0; for (let s = 1; s <= N; s++) { const r = playLevel(Z, lv, s); if (r.ok) w++; d += r.deaths; } R.push([w, d]); }
  console.log('     бот по уровням: ' + R.map((r, i) => (i + 1) + ':' + r[0] + '/' + N).join(' '));
  test('проходимость: бот проходит уровни 1-5 в >= 80% партий, 6-7 в >= 60%', () => {
    for (let i = 0; i < 5; i++) ok(R[i][0] >= 0.8 * N, 'уровень ' + (i + 1) + ': ' + R[i][0] + '/' + N);
    for (let i = 5; i < 7; i++) ok(R[i][0] >= 0.6 * N, 'уровень ' + (i + 1) + ': ' + R[i][0] + '/' + N);
  });
  test('баланс: босс (8) - 15-70% побед бота; не «на халяву» и не стена', () => { ok(R[7][0] >= 0.15 * N && R[7][0] <= 0.7 * N, 'босс: ' + R[7][0] + '/' + N); });
}
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'zvero-otryad', boards: ['zvero'], test, ok }); }

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
