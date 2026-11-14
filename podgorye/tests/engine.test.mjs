/* ПОДГОРЬЕ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node podgorye/tests/engine.test.mjs   (QUICK=1 — без графа порядков и партий ботов).
   Логика (js/*.js) — в node:vm с шимом window. Проверяет: мир (комнаты, двери, зоны, предметы), физику и способности,
   игровые механики (предметы, наковальни, смерть, босс, горны, печать), сохранения (3 слота, миграции v1 и старого ключа),
   граф проходимости по настоящей физике: все допустимые порядки способностей без софтлока и ловушек, каждая способность
   нужна, при полном наборе достижимы все комнаты и предметы (100 %); боссов (бот без урона), «человеческого» бота
   (реакция 150–250 мс) в первой зоне с первым боссом, время кадра логики, музыку, i18n и правило имён. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math, addEventListener() {}, setTimeout };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['engine.js', 'js/music.js', 'js/i18n.js', 'js/physics.js', 'js/world.js', 'js/enemies.js', 'js/bosses.js', 'js/save.js', 'js/game.js'])
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const P = sandbox.PODGORYE, A = sandbox.Arcade, T = P.T, K = P.K, ph = P.phys, W = P.WORLD(), DT = 1 / 60;
const { makeNav, solveOrders, playZone1, bossBot, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn) { const t0 = Date.now(); try { fn(); passed++; console.log('ok   ' + name + (Date.now() - t0 > 2000 ? '  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' с)' : '')); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m) { if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ложь'); }
function near(a, b, d, m) { if (Math.abs(a - b) > d) throw new Error((m || '') + ' ждали ≈' + b + '±' + d + ', получили ' + a); }

// тестовая комната из строк (40×22 по умолчанию): '.#=^CISH~LFiXBh', 'O' — кольцо
function room(rows, o = {}) {
  const Wd = o.W || 40, H = rows.length, t = new Uint8Array(Wd * H), rings = [];
  rows.forEach((s, r) => { for (let c = 0; c < Wd; c++) { const ch = s[c] || '#'; if (ch === 'O') { rings.push({ x: c + 0.5, y: r + 0.5 }); t[r * Wd + c] = T.AIR; } else t[r * Wd + c] = P.CHARS.indexOf(ch); } });
  const R = { i: 0, W: Wd, H, t, rings, gx: 0, gy: 0 }; ph.roomFlags(R); return R;
}
const AIR = '#' + '.'.repeat(38) + '#', FL = '#'.repeat(40);
function box(extra = {}) { const rows = []; for (let r = 0; r < 22; r++) rows.push(r === 0 || r >= 19 ? FL : AIR); for (const k in extra) rows[k] = extra[k]; return rows; }
function simH(R, h, inp, n, ab = {}) { const ev = []; for (let i = 0; i < n; i++) ph.stepHero(h, typeof inp === 'function' ? inp(i, h) : inp, R, DT, ab, (t) => ev.push(t)); return ev; }
const ALL = { boots: 1, dash: 1, gloves: 1, hook: 1, hammer: 1, bell: 1, cloak: 1, light: 1 };

// ---------- мир ----------
test('мир: 150–220 комнат в 6 зонах + сердцевина, сетка 34×19, комнаты не пересекаются', () => {
  ok(W.rooms.length >= 150 && W.rooms.length <= 220, 'комнат ' + W.rooms.length);
  const zones = new Set(W.rooms.map(r => r.zone)); eq(zones.size, 7);
  const seen = new Set();
  for (const rm of W.rooms) for (let y = rm.gy; y < rm.gy + rm.h; y++) for (let x = rm.gx; x < rm.gx + rm.w; x++) { const k = y * 34 + x; ok(!seen.has(k), 'пересечение ' + rm.i); seen.add(k); eq(W.grid[k], rm.i); }
  ok(W.rooms.some(r => r.w * r.h > 1), 'есть большие комнаты со скроллом');
});
test('мир: все двери парные и совпадают по месту (проёмы L/R на одной высоте, люки U/D в одном столбце)', () => {
  const opp = { L: 'R', R: 'L', U: 'D', D: 'U' };
  for (const rm of W.rooms) for (const d of rm.doors) {
    const nb = W.rooms[d.to], back = nb.doors.find(b => b.to === rm.i && b.side === opp[d.side]); ok(back, 'нет обратной двери ' + rm.i + d.side);
    if (d.side === 'L' || d.side === 'R') eq(rm.gy + d.k, nb.gy + back.k, 'высота двери ' + rm.i); else eq(rm.gx + d.k, nb.gx + back.k, 'столбец люка ' + rm.i);
  }
});
test('мир фиксирован: повторная сборка даёт те же клетки', () => {
  const W2 = P.buildWorld(); eq(W2.rooms.length, W.rooms.length);
  for (let i = 0; i < W.rooms.length; i += 7) eq(Buffer.from(W2.rooms[i].t).toString('base64'), Buffer.from(W.rooms[i].t).toString('base64'), 'комната ' + i);
});
test('предметы: 8 способностей, 12 сосудов (7 в мире + 5 у боссов), 4 ёмкости искры, 4 улучшения фонаря', () => {
  const c = t => W.items.filter(i => i.type === t).length;
  eq(W.items.filter(i => i.type.startsWith('ab:')).length, 8); eq(c('vessel'), 12); eq(c('tank'), 4); eq(W.items.filter(i => i.type.startsWith('up:')).length, 4);
  eq(W.items.filter(i => i.boss && i.type === 'vessel').length, 5);
  ['boots', 'dash', 'gloves', 'hook', 'hammer', 'bell', 'cloak', 'light'].forEach(a => eq(c('ab:' + a), 1, a));
  ok(W.items.some(i => i.bar === 'false'), 'есть тайники за ложной стеной');
});
test('объекты: наковальни (≥ 15), лифты-шахты (≥ 6), 7 боссов на аренах, 5 Спящих Горнов, Сердце Горы, печать', () => {
  ok(W.anvils.length >= 15, 'наковален ' + W.anvils.length); ok(W.lifts.length >= 6, 'лифтов ' + W.lifts.length);
  eq(Object.keys(W.bossRooms).length, 7); P.BOSSES.forEach(b => eq(W.rooms[W.bossRooms[b]].kind, 'arena', b));
  eq(W.forges.filter(Boolean).length, 5); ok(W.rooms.some(r => r.kind === 'heart')); ok(W.groups.some(g => g.kind === T.SEAL));
  eq(W.rooms[W.start.room].kind, 'start');
});

// ---------- физика и способности ----------
test('прыжок ≈ 4,1 клетки, второй прыжок (паровые сапоги) — всего ≥ 6,5; без сапог второго нет', () => {
  const R = room(box()), h = ph.newHero(10.5, 19); let top = 99;
  simH(R, h, (i, hh) => { top = Math.min(top, hh.y); return { jump: true }; }, 60); near(19 - top, 3.95, 0.2, 'высота (дискретный шаг 1/60)');
  const h2 = ph.newHero(10.5, 19); let t2 = 99; simH(R, h2, (i, hh) => { t2 = Math.min(t2, hh.y); return { jump: i < 20 || (i >= 22 && i < 42) }; }, 90, { boots: 1 }); ok(19 - t2 > 6.5, 'с сапогами ' + (19 - t2));
  const h3 = ph.newHero(10.5, 19); let t3 = 99; simH(R, h3, (i, hh) => { t3 = Math.min(t3, hh.y); return { jump: i < 20 || (i >= 22 && i < 42) }; }, 90, {}); ok(19 - t3 < 4.3, 'без сапог ' + (19 - t3));
});
test('рывок мехов ≈ 3,2 клетки и проскок сквозь паровую завесу; без рывка завеса — стена', () => {
  const R = room(box({ 16: '#' + '.'.repeat(20) + 'SS' + '.'.repeat(16) + '#', 17: '#' + '.'.repeat(20) + 'SS' + '.'.repeat(16) + '#', 18: '#' + '.'.repeat(20) + 'SS' + '.'.repeat(16) + '#' }));
  const h = ph.newHero(10.5, 19); simH(R, h, (i) => ({ dash: i < 2 }), 11, { dash: 1 }); near(h.x - 10.5, K.DASH_V * K.DASH_T, 0.4, 'дальность');
  const w = ph.newHero(20.2, 19); simH(R, w, (i) => ({ x: 1, dash: i < 2 }), 40, { dash: 1 }); ok(w.x > 22.4, 'прошла завесу: ' + w.x);
  const n = ph.newHero(19.5, 19); simH(R, n, () => ({ x: 1 }), 60, {}); ok(n.x < 20.7, 'без рывка стоит: ' + n.x);
});
test('цепкие перчатки: зацеп и отскоки поднимают по одной стене выше двойного прыжка; без перчаток — нет', () => {
  const rows = box(); for (let r = 1; r < 19; r++) rows[r] = '#' + '.'.repeat(20) + '#' + '.'.repeat(17) + '#';
  // программа «как у игрока»: прижаться к стене, отскок (прыжок держим ~0,25 с), через 7 кадров — снова к стене
  const R = room(rows), climb = (ab) => { const h = ph.newHero(19.5, 19); let top = 99, f0 = -100; simH(R, h, (i, hh) => { top = Math.min(top, hh.y); if (hh.cling && i - f0 > 16) f0 = i; const g = i - f0; return { x: g >= 1 && g < 8 ? -1 : 1, jump: i < 12 || (g >= 1 && g < 15) }; }, 600, ab); return 19 - top; };
  ok(climb({ gloves: 1 }) > 9, 'с перчатками ' + climb({ gloves: 1 }).toFixed(1)); ok(climb({}) < 4.5, 'без перчаток');
});
test('кошка-крюк: зацеп за кольцо в радиусе, раскачка и бросок через пропасть шире рывка с двойным прыжком', () => {
  const rows = box({ 11: '#' + '.'.repeat(13) + 'O' + '.'.repeat(5) + 'O' + '.'.repeat(5) + 'O' + '.'.repeat(12) + '#' }); rows[19] = '#'.repeat(10) + '.'.repeat(22) + '#'.repeat(8); rows[20] = '#'.repeat(10) + '^'.repeat(22) + '#'.repeat(8);
  const R = room(rows); ok(R.rings.length === 3);
  const h = ph.newHero(9.3, 19); h.ground = true; let hooked = 0, f0 = -1, n = 0;
  simH(R, h, (i, hh) => {
    if (hh.hook) { n++; const w = hh.hook.w; if (n > 60 && w > 1.2 && hh.hook.a > -0.1) { n = 0; return { x: 1, jump: true }; } return { x: Math.abs(w) < 0.4 ? 1 : (w > 0 ? 1 : -1) }; }
    if (!hh.ground && i > 4 && ph.ringFor(R, hh, 1) >= 0) { hooked++; return { x: 1, hook: true }; }
    return { x: 1, jump: i < 18 };
  }, 900, { hook: 1 });
  ok(hooked > 0, 'зацепилась'); ok(h.x > 32 && h.ground && h.y === 19, 'перелетела пропасть: ' + h.x.toFixed(1) + ',' + h.y.toFixed(1));
  const b = ph.newHero(9.3, 19); simH(b, b, () => ({}), 0); simH(R, b, (i) => ({ x: 1, jump: i < 17 || (i >= 20 && i < 38), dash: i >= 32 && i < 34 }), 120, { boots: 1, dash: 1 }); ok(b.x < 32, 'без крюка не долетает: ' + b.x.toFixed(1));
});
test('тяжёлый молот: удар вниз (↓+X в воздухе) ломает треснувший пол — игра открывает группу', () => {
  const g = P.Game({ noEnemies: true }).start(), S = g.state(); g._give('hammer');
  const G = W.groups.find(x => x.kind === T.CRACK && W.rooms[x.room].kind === 'gate'); const [c, r] = G.cells[0];
  g._place(G.room, c + 0.5, r); for (let i = 0; i < 10; i++) g.update(DT);
  let f = 0; for (; f < 60 && !S.prog.opened[G.id]; f++) { g.setInput(f < 4 ? { jump: true } : f === 8 ? { y: 1, shoot: true } : { y: 1 }); g.update(DT); }
  ok(S.prog.opened[G.id], 'пол сломан'); eq(S.R.t[r * S.R.W + c], T.AIR);
});
test('вода: без колокола героиня всплывает и не ныряет глубже 2 клеток; с колоколом — плавает вниз', () => {
  const rows = box(); for (let r = 6; r < 19; r++) rows[r] = '#' + '~'.repeat(38) + '#'; const R = room(rows);
  const h = ph.newHero(20.5, 3); let deep = 0; simH(R, h, (i, hh) => { deep = Math.max(deep, hh.y - 6); return { y: 1 }; }, 300, {}); ok(deep < 2.2, 'без колокола глубина ' + deep.toFixed(2));
  const b = ph.newHero(20.5, 3); let d2 = 0; simH(R, b, (i, hh) => { d2 = Math.max(d2, hh.y - 6); return { y: 1 }; }, 300, { bell: 1 }); ok(d2 > 10, 'с колоколом ' + d2.toFixed(1));
});
test('жар: без плаща — ожог и отброс назад; с плащом — проход', () => {
  const rows = box(); for (let r = 16; r < 19; r++) rows[r] = '#' + '.'.repeat(20) + 'H'.repeat(10) + '.'.repeat(8) + '#'; const R = room(rows);
  const h = ph.newHero(17.5, 19); const ev = simH(R, h, () => ({ x: 1 }), 120, {}); ok(ev.includes('heat'), 'ожог'); ok(h.x < 21, 'отброшена: ' + h.x.toFixed(1));
  const c = ph.newHero(17.5, 19); const ev2 = simH(R, c, () => ({ x: 1 }), 120, { cloak: 1 }); ok(!ev2.includes('heat') && c.x > 31, 'прошла: ' + c.x.toFixed(1));
});
test('мостки: прыжок сквозь снизу, стоят сверху, ↓ + прыжок — спрыгнуть', () => {
  const R = room(box({ 16: '#' + '.'.repeat(9) + '======' + '.'.repeat(23) + '#' }));
  const h = ph.newHero(12.5, 19); simH(R, h, (i) => ({ jump: i < 18 }), 70); ok(h.ground && h.y === 16, 'на мостках: ' + h.y);
  simH(R, h, (i) => ({ y: 1, jump: i === 2 }), 40); ok(h.y === 19, 'спрыгнула: ' + h.y);
});
test('свет-луч фонаря открывает световую створку рядом; без луча створка — стена', () => {
  const g = P.Game({ noEnemies: true }).start(), S = g.state(); g._give('light');
  const G = W.groups.find(x => x.kind === T.LIGHT); const [c, r] = G.cells[0], rm = W.rooms[G.room];
  let sx = c + 0.5, sy = r; for (let dy = 0; dy < 6; dy++) for (const dx of [-3, 3, -2, 2]) { const yy = r + dy, xx = c + dx; if (xx > 0 && xx < rm.W - 1 && P.SOLID[rm.t[yy * rm.W + xx]] && !P.SOLID[rm.t[(yy - 1) * rm.W + xx]] && !P.SOLID[rm.t[(yy - 2) * rm.W + xx]]) { sx = xx + 0.5; sy = yy; dy = 9; break; } }
  g._place(G.room, sx, sy); g.update(DT); ok(!S.prog.opened[G.id], 'без луча закрыта');
  g.setInput({ beam: true }); g.update(DT); ok(S.prog.opened[G.id], 'луч открыл');
});

// ---------- игровые механики ----------
test('предметы: сосуд +1 к здоровью и лечит, ёмкость +1 искры, способность включается; процент растёт', () => {
  const g = P.Game({ noEnemies: true }).start(), S = g.state();
  const v = W.items.find(i => i.type === 'vessel' && !i.boss), t = W.items.find(i => i.type === 'tank'), a = W.items.find(i => i.type === 'ab:dash');
  const p0 = g.percent(); S.hp = 1;
  for (const it of [v, t, a]) { g._place(it.room, it.x, it.y); g.update(DT); g.update(DT); }
  eq(S.prog.hpMax, 6); eq(S.hp, 6); eq(S.prog.tanks, 3); ok(S.prog.ab.dash); ok(g.percent() > p0);
});
test('наковальня: ↑ — сохранение (событие с данными), полное здоровье; смерть → возврат к наковальне без потери предметов', () => {
  const ev = []; const g = P.Game({ noEnemies: true, onEvent: (t, d) => ev.push([t, d]) }).start(), S = g.state();
  const an = W.anvils[3]; g._place(an.room, an.x, an.y); g.update(DT); S.hp = 2; g.setInput({ y: -1 }); g.update(DT); g.setInput({});
  const sv = ev.find(e => e[0] === 'save'); ok(sv && sv[1].data.v === P.SAVE_VERSION, 'сохранено'); eq(S.hp, S.prog.hpMax); eq(S.prog.anvil, an.id);
  const it = W.items.find(i => i.type === 'tank'); g._place(it.room, it.x, it.y); g.update(DT); ok(S.prog.items[it.id]);
  g._hurt(99, 'test'); eq(S.phase, 'dead'); for (let i = 0; i < 120; i++) g.update(DT);
  eq(S.phase, 'play'); eq(S.room, an.room); ok(S.prog.items[it.id], 'предмет остался'); eq(S.hp, S.prog.hpMax); eq(S.deaths, 1);
});
test('босс: вход на арену закрывает проёмы, победа открывает их, даёт награду и запоминается', () => {
  const g = P.Game({ god: true }).start(), S = g.state(), ri = W.bossRooms.gatekeeper; g._place(ri, 20, 19); g.update(DT);
  ok(S.boss && !S.boss.dead, 'бой начался'); ok(S.R.t.includes(T.SHUT), 'проёмы закрыты');
  S.boss.hp = 0.5; S.boss.st = 'idle'; S.R.shots.push({ x: S.boss.parts[0].x, y: S.boss.parts[0].y, vx: 1, vy: 0, life: 1, dmg: 1, hit: {} }); g.update(DT);
  ok(S.boss.dead && S.prog.bosses.gatekeeper); ok(!S.R.t.includes(T.SHUT), 'открыто');
  const rw = W.items.find(i => i.boss === 'gatekeeper'); eq(rw.type, 'ab:boots'); g._place(ri, rw.x, rw.y); g.update(DT); g.update(DT); ok(S.prog.ab.boots, 'сапоги получены');
});
test('Горны: пять разожжённых открывают Печать Горнов; Сердце Горы — победа после Окалины', () => {
  const ev = []; const g = P.Game({ noEnemies: true, onEvent: t => ev.push(t) }).start(), S = g.state();
  for (let i = 0; i < 5; i++) g._forge(i); ok(ev.includes('sealOpen')); W.groups.filter(G => G.kind === T.SEAL).forEach(G => ok(S.prog.opened[G.id]));
  const hr = W.rooms.find(r => r.kind === 'heart'), ho = hr.objs.find(o => o.type === 'heart');
  g._place(hr.i, ho.x, ho.y); g.update(DT); eq(S.phase, 'play', 'без победы над Окалиной сердце спит');
  S.prog.bosses.scale = true; g.update(DT); eq(S.phase, 'won');
});
test('процент: все предметы и горны = 100 %', () => {
  const g = P.Game({ noEnemies: true }).start(), S = g.state(); W.items.forEach(i => S.prog.items[i.id] = true); for (let i = 0; i < 5; i++) S.prog.forges[i] = true; eq(g.percent(), 100);
});
test('лифты-шахты: касание запускает, ↑ — меню, переезд в другой запущенный лифт', () => {
  const g = P.Game({ noEnemies: true }).start(), S = g.state(), a = W.lifts[0], b = W.lifts[2];
  g._place(b.room, b.x, b.y); g.update(DT); g._place(a.room, a.x, a.y); g.update(DT); g.update(DT);
  ok(S.prog.lifts[a.id] && S.prog.lifts[b.id]); g.setInput({ y: -1 }); g.update(DT); eq(S.phase, 'lift'); g.setInput({});
  while (g.liftList()[S.liftSel] !== b.id) g.liftMove(1); g.liftGo(); eq(S.phase, 'play'); eq(S.room, b.room);
});

// ---------- сохранения ----------
function memStore() { const m = new Map(); return { m, get: (k, d) => m.has(k) ? m.get(k) : d, set: (k, v) => m.set(k, String(v)), remove: k => m.delete(k) }; }
test('сохранения: 3 слота независимы, снимок → загрузка восстанавливает прогресс', () => {
  const st = memStore(), SV = P.SV;
  const g = P.Game({ noEnemies: true }).start(), S = g.state(); g._give('boots', 'dash'); S.prog.items[3] = true; S.prog.hpMax = 7; S.prog.forges[1] = true; S.prog.anvil = 5; S.time = 123.4;
  SV.save(2, g.snapshot(), st); ok(!SV.load(1, st) && !SV.load(3, st)); const d = SV.load(2, st);
  const g2 = P.Game({ noEnemies: true, save: d }).start(), S2 = g2.state();
  ok(S2.prog.ab.boots && S2.prog.ab.dash && !S2.prog.ab.hook); ok(S2.prog.items[3]); eq(S2.prog.hpMax, 7); ok(S2.prog.forges[1]); eq(S2.room, W.anvils[5].room); near(S2.time, 123.4, 0.01);
  SV.save(1, g.snapshot(), st); SV.save(3, g2.snapshot(), st); eq(SV.list(st).filter(Boolean).length, 3); SV.clear(2, st); eq(SV.list(st)[1], null);
});
test('сохранения: миграция формата v1 → v2 и перенос старого ключа в свободный слот; битые данные — null', () => {
  const st = memStore(), SV = P.SV;
  const v1 = { version: 1, abilities: { boots: true, hook: true, dash: false }, got: [1, 2, 5], beaten: ['gatekeeper'], lit: [0], seen: [0, 1, 2], anvil: 2, hp: 6, cells: 3, playTime: 88 };
  const m = SV.migrate(v1); eq(m.v, 2); eq(m.ab.join(','), 'boots,hook'); eq(m.items.join(','), '1,2,5'); eq(m.bosses[0], 'gatekeeper'); eq(m.hpMax, 6); eq(m.tanks, 3); eq(m.visited[2], 1);
  st.set(SV.key(1), JSON.stringify({ v: 2, ab: [], items: [], anvil: 0 })); st.set(SV.LEGACY, JSON.stringify(v1));
  eq(SV.legacy(st), 2, 'в слот 2'); ok(!st.get(SV.LEGACY, null), 'старый ключ удалён'); eq(SV.load(2, st).time, 88);
  st.set(SV.key(3), JSON.stringify(v1)); eq(SV.load(3, st).v, 2); eq(JSON.parse(st.get(SV.key(3))).v, 2, 'перезаписан в новом формате');
  st.set(SV.key(1), '{bad json'); eq(SV.load(1, st), null); eq(SV.migrate({ v: 99 }), null); eq(SV.migrate(null), null);
  eq(SV.record(500, 40, st).time, true); eq(SV.record(600, 30, st).time, false); eq(SV.records(st).time, 500); eq(SV.records(st).pct, 40);
});

// ---------- музыка, i18n ----------
test('музыка: главная тема + по треку на каждую зону и на босса, 8–16 тактов, голоса кратны, ноты в диапазоне', () => {
  const all = Object.assign({ main: A.tracks.podgorye }, P.MUSIC);
  ['gates', 'flood', 'ice', 'hot', 'gardens', 'halls', 'core', 'boss', 'final'].forEach(k => ok(all[k], 'нет трека ' + k));
  W.zones.forEach(z => ok(P.MUSIC[z.music], 'зона ' + z.id));
  for (const [k, t] of Object.entries(all)) { const c = A.parseTrack(t), bars = c.melody.length / (c.div * 4); ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), k + ' тактов ' + bars); ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, k); [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, k + ' нота ' + e.f)); }
});
test('i18n: RU и EN — одинаковые ключи, есть названия зон, способностей и боссов', () => {
  const ru = Object.keys(P.STR.ru).sort().join(','), en = Object.keys(P.STR.en).sort().join(','); eq(ru, en);
  for (let z = 0; z < 7; z++) ok(P.STR.ru['z' + z] && P.STR.en['z' + z]); P.BOSSES.forEach(b => ok(P.STR.en['b_' + b])); P.ABIL.forEach(a => ok(P.STR.ru['ab_' + a + '_d']));
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список студии + жанровые оригиналы)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8') + '|' + Buffer.from('c3ltcGhvbnkgb2YgdGhlIG5pZ2h0fNGB0LjQvNGE0L7QvdC4W9GP0LhdINC90L7Rh9C4fGhvbGxvdyA/a25pZ2h0fNGF0L7Qu9C70L7RgyA/0L3QsNC50YJ8XGJvcmlcYnwoPzwhW9CwLdGP0ZFdKdC+0YDQuCg/IVvQsC3Rj9GRXSl8YXhpb20gP3ZlcmdlfNCw0LrRgdC4W9C+0YNd0LwgP9Cy0LXRgNC00LZ80LrQsNGB0YLQu9Cy0LDQvdC4fHN1cGVyID9tZXRyb2lkfNGB0YPQv9C10YAgP9C80LXRgtGA0L7QuNC0', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 18, 'файлов: ' + files.length);
  for (const f of files) { const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('original') && !BAD.test('Огнёвка') && !BAD.test('CONTRACT.md') && !BAD.test('Гефест') && !BAD.test('горн') && !BAD.test('glob'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- производительность ----------
test('производительность: шаг логики в самой большой комнате с врагами — в среднем < 1 мс', () => {
  const big = W.rooms.filter(r => r.kind === 'normal').sort((a, b) => b.w * b.h + b.ens.length * 0.01 - a.w * a.h - a.ens.length * 0.01)[0];
  const g = P.Game({ god: true, seed: 5 }).start(), S = g.state(); g._place(big.i, big.W / 2, big.H - 4);
  for (let i = 0; i < 6; i++) S.R.ens.push(P.EN.make({ type: ['crawler', 'flyer', 'turret'][i % 3], x: 6 + i * 10, y: big.H - 3 }, Math.random));
  const t0 = process.hrtime.bigint(); const N = 1200;
  for (let i = 0; i < N; i++) { g.setInput({ x: Math.sin(i / 40) > 0 ? 1 : -1, jump: i % 50 < 12, shoot: i % 9 < 2 }); g.update(DT); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N; console.log('     комната ' + big.w + '×' + big.h + ' экранов, врагов ' + S.R.ens.length + ': ' + ms.toFixed(3) + ' мс/кадр');
  ok(ms < 1, ms.toFixed(3) + ' мс');
});

if (process.env.QUICK) { console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без графа и ботов)'); process.exit(failed ? 1 : 0); }

// ---------- граф проходимости по настоящей физике ----------
const nav = makeNav(P, W);
let ORD = null;
test('граф: все допустимые порядки способностей — на каждом шаге достижима следующая, нет софтлока и ловушек, игру можно завершить', () => {
  ORD = solveOrders(P, W, nav, { traps: true });
  console.log('     состояний ' + ORD.states + ', полных порядков ' + ORD.orders + ', глубина ' + ORD.maxDepth);
  eq(ORD.softlocks.length, 0, 'софтлоки: ' + ORD.softlocks.join(' | '));
  eq(ORD.traps.length, 0, 'ловушки: ' + JSON.stringify(ORD.traps.slice(0, 2)));
  ok(ORD.orders >= 10, 'порядков ' + ORD.orders); eq(ORD.maxDepth, 8, 'все 8 способностей');
});
test('граф: стартовый набор — достижимы Ворота и первый босс, но не другие зоны', () => {
  const r = nav.reach({}); const areas = new Set([...r.rooms].map(i => P.AREAS[W.rooms[i].area].id));
  eq([...areas].join(','), 'gates'); ok(r.rooms.has(W.bossRooms.gatekeeper)); ok([...r.items].some(i => W.items[i].type === 'ab:boots'));
});
test('граф: каждая способность действительно нужна — без любой из восьми игру не завершить', () => {
  for (const a of P.ABIL) { const o = solveOrders(P, W, nav, { forbid: a }); eq(o.complete, 0, 'без ' + a + ' можно пройти'); }
});
test('граф: при полном наборе достижимы все комнаты и все предметы — 100 % прохождения', () => {
  const r = nav.reach(ALL); eq(r.rooms.size, W.rooms.length, 'комнат');
  const miss = W.items.filter(i => !r.items.has(i.id)); eq(miss.length, 0, 'не взяты: ' + miss.map(i => i.type + '@' + i.room).join(' '));
  W.forges.forEach(f => ok(r.rooms.has(f.room))); ok(r.rooms.has(W.rooms.find(x => x.kind === 'heart').i));
});

// ---------- боссы и «человеческий» бот ----------
test('боссы: каждый из 7 побеждаем ботом без урона (Окалина — обе фазы)', () => {
  for (const id of P.BOSSES) { const r = bossBot(P, W, id); ok(r.won, id + ' не побеждён, hp ' + r.hp); }
  ok(bossBot(P, W, 'gatekeeper', { ups: false }).won, 'первый босс — и без улучшений');
});
test('«человеческий» бот (реакция 150–250 мс, неточный старт прыжков) проходит Ворота и Привратника в ≥ 60 % партий', () => {
  nav.reach({}); const N = 20; let won = 0, deaths = 0; const ts = [];
  for (let s = 1; s <= N; s++) { const r = playZone1(P, W, nav, s, { maxT: 480 }); if (r.won) { won++; ts.push(r.time); } deaths += r.deaths; }
  console.log('     победы ' + won + '/' + N + ', падений всего ' + deaths + ', время побед ' + (ts.length ? Math.round(Math.min(...ts)) + '–' + Math.round(Math.max(...ts)) + ' с' : '—'));
  ok(won >= 0.6 * N, 'слишком сложно: ' + won + '/' + N);
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
