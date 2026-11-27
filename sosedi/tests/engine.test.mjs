/* ШПУЛЬКА · tests/engine.test.mjs — автотесты логики, столов, строк, музыки, миграции, правила имён и баланса ботом (Node, без зависимостей).
   Запуск: node sosedi/tests/engine.test.mjs (≈ 20 с; QUICK=1 — без партий бота). Логика — в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, Date, JSON }; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js', 'js/save.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const K = sandbox.SPOOL, C = K.consts;
const { play } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function setup(o = {}) { const ev = []; const game = K.Game(Object.assign({ onEvent: (t, d) => ev.push({ t, d }) }, o)); return { game, S: game.state(), ev, has: (t) => ev.some((e) => e.t === t), count: (t) => ev.filter((e) => e.t === t).length }; }
function run(game, sec, hold) { if (hold != null) game.setHold(hold); for (let i = 0; i < Math.round(sec * 60); i++) game.step(1 / 60); }
// пустой стол: одна булавка, ни коробок, ни врагов, одна дальняя пуговица
function arena(S, o = {}) {
  S.walls = o.walls || []; S.foes = o.foes || []; S.pins = (o.pins || []).map((p) => Object.assign({ k: 'n', cool: 0, dead: 0, hang: 0, sp: 0, ph: 0, amp: 0, bx: p.x }, p));
  S.buttons = o.buttons || [{ x: 20, y: 20, on: true }]; S.left = S.buttons.filter((b) => b.on).length; S.total = S.buttons.length; S.exitOpen = false; S.inv = 0;
  S.hero = Object.assign({ x: 225, y: 400, hx: 0, hy: -1, hook: null }, o.hero || {}); S.hold = false; return S;
}

// ---------- столы ----------
test('столы: 8 штук, число булавок/пуговиц/врагов по таблице, старт и выход внутри стола', () => {
  eq(C.MAX_LEVEL, 8);
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i), P = K.params[i];
    eq(L.pins.length, P.pins, 'булавки ' + i); eq(L.buttons.length, P.btn, 'пуговицы ' + i); eq(L.walls.length, P.walls, 'коробки ' + i);
    eq(L.foes.filter((f) => f.t === 's').length, P.sc); eq(L.foes.filter((f) => f.t === 'm').length, P.moth); eq(L.foes.filter((f) => f.t === 'i').length, P.iron);
    eq(L.pins.filter((p) => p.k === 'r').length, P.rust); eq(L.pins.filter((p) => p.k === 'm').length, P.mov);
    ok(L.exit[0] > 0 && L.exit[0] < C.W && L.exit[1] > 0 && L.exit[1] < C.H, 'выход вне стола'); }
});
test('столы: пуговицы не на булавках, не в коробках и не у старта, не слипаются; первый стол без врагов (обучение)', () => {
  for (let i = 0; i < C.MAX_LEVEL; i++) { const L = K.level(i);
    for (const b of L.buttons.concat([L.exit])) { ok(Math.hypot(b[0] - L.start[0], b[1] - L.start[1]) >= 70, 'у старта ' + i);
      for (const p of L.pins) ok(Math.hypot(b[0] - p.x, b[1] - p.y) >= 26, 'на булавке ' + i);
      for (const w of L.walls) ok(!(b[0] > w.x - 20 && b[0] < w.x + w.w + 20 && b[1] > w.y - 20 && b[1] < w.y + w.h + 20), 'в коробке ' + i); }
    const all = L.buttons.concat([L.exit]); for (let a = 0; a < all.length; a++) for (let c = a + 1; c < all.length; c++) ok(Math.hypot(all[a][0] - all[c][0], all[a][1] - all[c][1]) >= 70, 'слипшиеся ' + i); }
  eq(K.level(0).foes.length, 0); ok(K.level(1).foes.length >= 1);
});
test('столы: детерминированы (одинаковые при повторном построении в чистой среде)', () => {
  const a = JSON.stringify(K.level(5)); const sb = { console, Math, JSON }; sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8'), sb); eq(JSON.stringify(sb.SPOOL.level(5)), a);
});

// ---------- нитка и полёт ----------
test('полёт: без кнопки шпулька летит по прямой с постоянной скоростью', () => {
  const { game, S } = setup(); arena(S, { hero: { x: 100, y: 500, hx: 1, hy: 0 } }); run(game, 1); ok(Math.abs(S.hero.x - 100 - C.SPEED) < 1.5, 'x ' + S.hero.x); ok(Math.abs(S.hero.y - 500) < 0.01);
});
test('нитка: держи рядом с булавкой — кружит, радиус не растёт и стягивается до минимума; скорость по дуге постоянна', () => {
  const { game, S, has } = setup(); arena(S, { pins: [{ x: 225, y: 300 }], hero: { x: 225, y: 400, hx: 1, hy: 0 } }); game.setHold(true); game.step(1 / 60); ok(S.hero.hook && has('hook'), 'не зацепилась'); const r0 = S.hero.hook.r; eq(S.hero.hook.dir, -1, 'булавка слева от курса вправо');
  run(game, 2); ok(S.hero.hook.r < r0 && S.hero.hook.r >= C.RMIN - 1e-9, 'радиус ' + S.hero.hook.r); ok(Math.abs(Math.hypot(S.hero.x - 225, S.hero.y - 300) - S.hero.hook.r) < 0.5, 'вне окружности');
  run(game, 6); eq(S.hero.hook.r, C.RMIN);
});
test('нитка: булавка дальше радиуса зацепа — не цепляется; цепляется, когда подлетела в радиус (кнопка уже зажата)', () => {
  const { game, S } = setup(); arena(S, { pins: [{ x: 225, y: 100 }], hero: { x: 225, y: 400, hx: 0, hy: -1 } }); game.setHold(true); game.step(1 / 60); eq(S.hero.hook, null, 'издалека'); run(game, 1.5); ok(S.hero.hook, 'в радиусе должна зацепиться');
});
test('нитка: отпустил — шпулька летит по касательной (курс ⟂ радиусу в момент отпускания, дальше не меняется), «release»', () => {
  const { game, S, has } = setup(); arena(S, { pins: [{ x: 225, y: 300 }], hero: { x: 225, y: 400, hx: 1, hy: 0 } }); run(game, 0.6, true);
  const rx = S.hero.x - 225, ry = S.hero.y - 300, rl = Math.hypot(rx, ry), hx = S.hero.hx, hy = S.hero.hy; ok(Math.abs((rx * hx + ry * hy) / rl) < 0.02, 'курс не касательный на дуге');
  game.setHold(false); run(game, 0.5); ok(has('release')); eq(S.hero.hook, null); ok(Math.abs(S.hero.hx - hx) < 1e-9 && Math.abs(S.hero.hy - hy) < 1e-9, 'курс изменился в свободном полёте');
});
test('нитка: сторона кружения — булавка остаётся с той же стороны курса (по часовой / против)', () => {
  let r = setup(); arena(r.S, { pins: [{ x: 300, y: 400 }], hero: { x: 225, y: 400, hx: 0, hy: -1 } }); r.game.setHold(true); r.game.step(1 / 60); eq(r.S.hero.hook.dir, 1, 'булавка справа от курса вверх');
  r = setup(); arena(r.S, { pins: [{ x: 150, y: 400 }], hero: { x: 225, y: 400, hx: 0, hy: -1 } }); r.game.setHold(true); r.game.step(1 / 60); eq(r.S.hero.hook.dir, -1, 'булавка слева');
});
test('стены: удар о край и коробку отражает курс, нитка отцепляется', () => {
  let r = setup(); arena(r.S, { hero: { x: 30, y: 300, hx: -1, hy: 0 } }); run(r.game, 0.5); ok(r.S.hero.hx > 0 && r.S.hero.x >= C.HERO_R - 1e-6, 'край'); ok(r.has('bump'));
  r = setup(); arena(r.S, { walls: [{ x: 200, y: 200, w: 56, h: 22 }], hero: { x: 228, y: 300, hx: 0, hy: -1 } }); run(r.game, 1); ok(r.S.hero.hy > 0, 'коробка отразила вниз'); ok(r.S.hero.y > 200);
  r = setup(); arena(r.S, { pins: [{ x: 100, y: 300 }], hero: { x: 100, y: 330, hx: 1, hy: 0 } }); r.game.setHold(true); run(r.game, 4); ok(r.has('bump') || r.S.hero.hook, 'круг у края стола должен задеть край, если не помещается');
});
test('ржавая булавка: ломается через 1,3 с зацепа, шпулька улетает, булавка возвращается через 3 с', () => {
  const { game, S, has } = setup(); arena(S, { pins: [{ x: 225, y: 300, k: 'r' }], hero: { x: 225, y: 400, hx: 1, hy: 0 } }); run(game, 0.05, true); ok(S.hero.hook); run(game, 1.4, true); ok(has('snap'), 'нет snap'); eq(S.hero.hook, null); ok(S.pins[0].dead > 0);
  run(game, 3.2, true); eq(S.pins[0].dead, 0);
});
test('подвижная булавка: ходит по рельсу ±amp, кружение идёт вокруг неё', () => {
  const { game, S } = setup(); arena(S, { pins: [{ x: 225, y: 300, bx: 225, k: 'm', sp: 1, ph: 0, amp: 40 }], hero: { x: 225, y: 380, hx: 1, hy: 0 } }); let mn = 999, mx = 0; game.setHold(true);
  for (let i = 0; i < 400; i++) { game.step(1 / 60); mn = Math.min(mn, S.pins[0].x); mx = Math.max(mx, S.pins[0].x); }
  ok(mx - mn > 60 && mx - mn <= 80.5, 'размах ' + (mx - mn)); if (S.hero.hook) ok(Math.abs(Math.hypot(S.hero.x - S.pins[0].x, S.hero.y - S.pins[0].y) - S.hero.hook.r) < 0.5);
});

// ---------- пуговицы, ушко, очки ----------
test('пуговицы: подбираются касанием, цепочка (≤ 2,2 с между) множит очки 50, 100, 150…; пауза рвёт цепочку', () => {
  const { game, S, ev } = setup(); arena(S, { buttons: [{ x: 250, y: 400, on: true }, { x: 300, y: 400, on: true }, { x: 350, y: 400, on: true }, { x: 20, y: 20, on: true }], hero: { x: 225, y: 400, hx: 1, hy: 0 } }); run(game, 1);
  eq(ev.filter((e) => e.t === 'button').map((e) => e.d.pts).join(), '50,100,150'); eq(S.left, 1); eq(S.stats.maxCombo, 3);
  run(game, 2.5); eq(S.combo, 0, 'цепочка оборвалась');
});
test('ушко: открывается, когда пуговиц не осталось; касание ушка — стол пройден, бонус, следующий стол', () => {
  const { game, S, ev, has } = setup({ level: 0 }); arena(S, { buttons: [{ x: 250, y: 400, on: true }], hero: { x: 225, y: 400, hx: 1, hy: 0 } }); S.exit = { x: 300, y: 400 }; run(game, 0.3); ok(has('exitOpen') && S.exitOpen);
  run(game, 0.6); eq(S.mode, 'clear'); ok(S.bonus >= 200); ok(has('clear')); run(game, 2); eq(S.level, 1); eq(S.mode, 'play'); ok(ev.some((e) => e.t === 'level'));
});
test('ушко закрыто, пока есть пуговицы: пролёт через ушко стол не проходит', () => {
  const { game, S } = setup(); arena(S, { buttons: [{ x: 20, y: 20, on: true }], hero: { x: 225, y: 400, hx: 1, hy: 0 } }); S.exit = { x: 260, y: 400 }; run(game, 0.5); eq(S.mode, 'play');
});

// ---------- враги ----------
test('ножницы: ходят туда-сюда по отрезку; касание — минус жизнь, «перерезано», возврат на старт с неуязвимостью', () => {
  const { game, S, ev } = setup(); arena(S, { foes: [{ t: 's', ax: 100, ay: 300, bx: 250, by: 300, u: 0, dir: 1, sp: 100, x: 100, y: 300, r: 12 }], hero: { x: 400, y: 100, hx: 0, hy: 1 } }); let mn = 999, mx = 0;
  for (let i = 0; i < 400; i++) { game.step(1 / 60); mn = Math.min(mn, S.foes[0].x); mx = Math.max(mx, S.foes[0].x); } ok(mx > 249 && mn < 101, 'размах ' + mn + '…' + mx);
  const g2 = setup(); arena(g2.S, { foes: [{ t: 's', ax: 225, ay: 400, bx: 225, by: 400, u: 0, dir: 1, sp: 0, x: 225, y: 400, r: 12 }] }); g2.game.step(1 / 60); eq(g2.S.lives, 2); eq(g2.S.mode, 'dying'); ok(g2.ev.some((e) => e.t === 'hurt'));
  run(g2.game, 1.3); eq(g2.S.mode, 'play'); ok(g2.S.inv > 0); eq(g2.S.hero.x, C.START[0]);
});
test('моль: кружит вокруг центра по радиусу; неуязвимость после возрождения не даёт умереть сразу', () => {
  const { game, S } = setup(); arena(S, { foes: [{ t: 'm', cx: 300, cy: 200, rad: 60, a: 0, w: 1.5, x: 360, y: 200, r: 9 }], hero: { x: 50, y: 580, hx: 1, hy: 0 } }); run(game, 2);
  ok(Math.abs(Math.hypot(S.foes[0].x - 300, S.foes[0].y - 200) - 60) < 0.01); S.inv = 0; S.hero.x = S.foes[0].x; S.hero.y = S.foes[0].y; game.step(1 / 60); eq(S.mode, 'dying');
  run(game, 1.3); eq(S.mode, 'play'); ok(S.inv > 1.5); game.step(1 / 60); eq(S.mode, 'play');
});
test('утюг: покой → предупреждение 0,85 с (красная полоса) → бросок через стол, опасен только в броске', () => {
  const { game, S, ev } = setup(); arena(S, { foes: [{ t: 'i', hz: true, lane: 300, st: 'rest', tm: 0.5, sgn: 1, p: -40, x: -60, y: -60, r: 15 }], hero: { x: 225, y: 300, hx: 0, hy: 1 } }); S.hero.hx = 0; S.hero.hy = 1;
  run(game, 0.2); eq(S.mode, 'play'); run(game, 0.5); eq(S.foes[0].st, 'warn'); ok(ev.some((e) => e.t === 'warn')); eq(S.mode, 'play', 'в предупреждении безопасно');
  S.hero.x = 225; S.hero.y = 300; S.hero.hx = 0; S.hero.hy = 0.0001; run(game, 1.9); eq(S.mode, 'dying', 'бросок сбил');
});
test('щит (награда за рекламу): гасит один удар; продолжение за рекламу: 1 жизнь, игра идёт с места', () => {
  const { game, S } = setup(); arena(S, { foes: [{ t: 's', ax: 225, ay: 400, bx: 225, by: 400, u: 0, dir: 1, sp: 0, x: 225, y: 400, r: 12 }] }); game.addShield(); game.step(1 / 60); eq(S.lives, 3); eq(S.shield, 0); eq(S.mode, 'play');
  S.inv = 0; S.lives = 0; S.mode = 'gameover'; game.revive(); eq(S.mode, 'play'); eq(S.lives, 1);
});
test('жизни кончились — конец игры; пока «dying» кнопка не действует', () => {
  const { game, S, has } = setup(); arena(S, { foes: [{ t: 's', ax: 225, ay: 400, bx: 225, by: 400, u: 0, dir: 1, sp: 0, x: 225, y: 400, r: 12 }] }); S.lives = 1; game.step(1 / 60); eq(S.lives, 0); game.setHold(true); eq(S.hold, false); run(game, 1.3); eq(S.mode, 'gameover'); ok(has('gameover') && game.isOver());
});

// ---------- партия ----------
test('партия: 8 столов подряд; +1 жизнь после 3-го и 6-го; победа после 8-го; клон состояния детерминирован', () => {
  const { game, S, ev } = setup(); S.lives = 2;
  for (let i = 0; i < C.MAX_LEVEL; i++) { eq(S.level, i); S.buttons.forEach((b) => { b.on = false; }); S.left = 0; S.exitOpen = true; S.exit = { x: S.hero.x, y: S.hero.y }; S.foes = []; game.step(1 / 60); eq(S.mode, 'clear'); run(game, 2); }
  eq(ev.filter((e) => e.t === 'life').length, 2); eq(S.mode, 'victory'); ok(game.isOver());
  const a = setup({ level: 3 }), b = a.game.clone(); for (let i = 0; i < 300; i++) { const h = (i % 40) < 20; a.game.setHold(h); b.setHold(h); a.game.step(1 / 30); b.step(1 / 30); } eq(JSON.stringify(a.game.state()), JSON.stringify(b.state()));
});

// ---------- сохранение и миграция ----------
test('миграция: старый рекорд СОСЕДЕЙ → «прежний рекорд», новый с нуля, сообщение; повторный запуск молчит; arcade.players.sosedi удалён', () => {
  const store = { 'arcade.best.sosedi': '12800', 'arcade.players.sosedi': '2' }, io = { get: (k) => (k in store ? store[k] : null), set: (k, v) => { store[k] = String(v); }, del: (k) => { delete store[k]; } };
  let m = K.save.migrate(io); ok(m.migrated && m.notice); eq(m.oldBest, 12800); eq(store['arcade.best.sosedi'], undefined); eq(store['arcade.sosedi.oldBest'], '12800'); eq(store['arcade.sosedi.v'], '2'); eq(store['arcade.players.sosedi'], undefined);
  m = K.save.migrate(io); ok(!m.migrated); eq(m.oldBest, 12800); const st2 = {}, io2 = { get: (k) => (k in st2 ? st2[k] : null), set: (k, v) => { st2[k] = String(v); }, del: (k) => { delete st2[k]; } };
  m = K.save.migrate(io2); ok(!m.migrated && !m.notice); eq(st2['arcade.sosedi.v'], '2');
});

// ---------- строки, музыка, правило имён ----------
test('строки: 5 языков, одинаковый набор ключей; название RU — ШПУЛЬКА, остальные — SPOOLSWING; подсказки заполнены', () => {
  const ks = Object.keys(K.STR.ru); for (const l of ['en', 'tr', 'es', 'pt']) { const miss = ks.filter((k) => K.STR[l][k] == null || K.STR[l][k] === ''), extra = Object.keys(K.STR[l]).filter((k) => K.STR.ru[k] == null); ok(!miss.length && !extra.length, l + ' ключи: -' + miss + ' +' + extra); }
  eq(K.STR.ru.title, 'ШПУЛЬКА'); for (const l of ['en', 'tr', 'es', 'pt']) eq(K.STR[l].title, 'SPOOLSWING'); for (const k of ['tut1', 'tut2', 'tut3', 'tut4', 'tutK1', 'tutK2', 'tutK3', 'tutK4']) for (const l of Object.keys(K.STR)) ok(K.STR[l][k].length > 10);
});
test('музыка: трек sosedi задан, секвенсор принимает ноты', () => {
  const t = sandbox.Arcade.tracks.sosedi; ok(t && t.melody.length >= 2 && t.bass && t.drums); const notes = (t.melody.join(' ') + ' ' + t.bass).replace(/\|/g, ' ').split(/\s+/).filter((x) => x && x !== '-' && x !== '.');
  for (const n of notes) ok(/^[A-G](#|b)?[0-8]$/.test(n), 'нота ' + n);
});
{ // правило имён 12.11: стоп-лист в base64 (чтобы сам тест не содержал чужих имён) + имена прежней версии игры
  const BAN = 'ZG91YmxlIGRyYWdvbnxrdW5pb3xyaXZlciBjaXR5fHRlY2hub3N8YXJjIHN5c3RlbXxudW1hIHRha2Vtb3RvfG5pbnRlbmRvfGNhcGNvbXxrb25hbWl8dGFpdG98dGVjbW98bmFtY298c2VnYXxjb250cmF8dGV0cmlzfHBhYy1tYW58YmF0dGxlIGNpdHl8cmV0cm8gYnJhd2x8cmVkIGRyYWdvbg==';
  const re = new RegExp('\\b(' + Buffer.from(BAN, 'base64').toString('utf8') + ')\\b', 'i');
  test('правило имён: в файлах игры нет чужих названий (стоп-лист в base64)', () => {
    const bad = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'screenshots') walk(p); } else if (/\.(js|mjs|html|css|md|json)$/.test(f.name) && f.name !== 'engine.js' && f.name !== 'engine.test.mjs') { if (re.test(fs.readFileSync(p, 'utf8'))) bad.push(p); } } })(ROOT);
    ok(!bad.length, bad.join('; '));
  });
}
test('нет внешних URL в игре (офлайн, file://)', () => {
  const bad = []; for (const f of ['index.html', 'js/main.js', 'js/render.js', 'js/ui.js', 'js/game.js', 'css/style.css']) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').replace(/<link rel="canonical"[^>]*>/, ''); if (/https?:\/\//.test(t)) bad.push(f); } ok(!bad.length, bad.join());
});
test('управление: одна кнопка «держи» (Пробел / ↑ / мышь / тач), без стика и второй кнопки', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); eq((html.match(/data-act=/g) || []).length, 1); ok(!/data-stick|stick\.js/.test(html), 'стик не нужен');
});

// ---------- баланс ботом ----------
if (!process.env.QUICK) {
  test('бот «человек» (6–10 % решений вслепую, 5 % случайных): стол 1 — ≥ 90 %; вся игра из 8 столов — 20–45 % партий', () => {
    let first = 0, n1 = 12; for (let s = 1; s <= n1; s++) if (play({ seed: 300 + s, levels: 1 }).win) first++; console.log('     первый стол: ' + first + '/' + n1); ok(first / n1 >= 0.9, 'доля ' + first / n1);
    let w = 0, N = 20; for (let s = 1; s <= N; s++) if (play({ seed: 100 + s, miss: 0.1, slip: 0.08 }).win) w++; const p = w / N; console.log('     вся игра: ' + w + '/' + N + ' = ' + Math.round(p * 100) + ' %'); ok(p >= 0.2 && p <= 0.45, 'доля ' + p);
  });
  test('бот-идеал (без ошибок): каждый стол проходит хотя бы в 2 из 3 партий', () => {
    for (let lv = 0; lv < C.MAX_LEVEL; lv++) { let w = 0; for (let s = 1; s <= 3; s++) if (play({ seed: s, miss: 0, slip: 0, startLevel: lv, levels: 1, maxT: 200 }).win) w++; ok(w >= 2, 'стол ' + (lv + 1) + ': ' + w + '/3'); }
  });
}

// ---------- площадка ----------
{ const { checkPlatformFeatures } = await import('../../tools/promo/platform-features.check.mjs');
  checkPlatformFeatures({ ROOT, slug: 'sosedi', boards: ['sosedi'], test, ok }); }

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
