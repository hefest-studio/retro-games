/* ГРОМ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node grom/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) в node:vm с шимом window. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/music.js', 'js/i18n.js', 'js/game.js', 'js/ui.js', 'js/modern.js', 'js/classic.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const GR = sandbox.GROM, L = GR.logic;
const { playGrom, navFor, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// игра без врагов на заданном уровне; ev — журнал событий
function mk(opts = {}){
  const ev = [];
  const game = GR.Game(Object.assign({ rng: mulberry32(1), onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  const S = game.state(); if (!opts.keepFoes) S.enemies = [];
  return { game, S, ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(inp); game.update(1 / 60); } game.setInput({}); }
const roomOf = (lv, x, y) => lv.rooms[Math.floor((y - 0.5) / L.RH) * lv.RX + Math.floor(x / L.RW)];
const nodeRoom = (lv, id) => { const c = id % lv.W, r = Math.floor(id / lv.W); return Math.floor((r - 1) / L.RH) * lv.RX + Math.floor(c / L.RW); };
// найти в уровне клетку пола (c, r) комнаты, где можно стоять, с запасом свободного места по сторонам
function floorSpot(lv, room, need = 3){
  const F = room.y0 + L.RH, w = { t: lv.t, W: lv.W, H: lv.H };
  for (let c = room.x0 + 4; c < room.x0 + L.RW - 4; c++){ let okk = true; for (let q = c - need; q <= c + need; q++) if (!L.isNode(w, q, F)) okk = false; if (okk) return { x: c + 0.5, y: F }; }
  return null;
}

// ---------- генератор уровней ----------
test('4 больших уровня-лабиринта: 20–35 комнат 32×20, мир в несколько экранов по обеим осям', () => {
  eq(L.LEVELS.length, 4);
  for (let n = 1; n <= 4; n++){
    const lv = L.level(n); ok(lv.rooms.length >= 20 && lv.rooms.length <= 35, 'комнат ' + lv.rooms.length);
    ok(lv.W >= L.VIEW_W * 4 && lv.H >= L.VIEW_H * 3.5, 'размер ' + lv.W + '×' + lv.H);
    ok(lv.time >= 300, 'таймер ' + lv.time);
  }
});
test('уровни фиксированы: повторная сборка даёт те же тайлы и предметы', () => {
  for (let n = 1; n <= 4; n++){ const a = L.level(n), b = L.buildLevel(n); eq(Buffer.from(b.t).toString('base64'), Buffer.from(a.t).toString('base64'), 'уровень ' + n); eq(b.items.length, a.items.length); eq(b.spawns.length, a.spawns.length); }
});
test('несколько путей к выходу: ≥ 2 рёберно-независимых пути от старта до предбанника арены', () => {
  for (let n = 1; n <= 4; n++){
    const lv = L.level(n), adj = new Map();
    lv.conns.forEach(c => { if (c.k === 'crack' || c.k === 'hatch') return; [[c.a, c.b], [c.b, c.a]].forEach(([u, v]) => { if (!adj.has(u)) adj.set(u, []); adj.get(u).push(v); }); });
    const used = new Map(), key = (u, v) => u + '>' + v; let flow = 0;
    for (let it = 0; it < 2; it++){
      const prev = new Map([[0, -1]]), q = [0];
      while (q.length && !prev.has(lv.ante)){ const u = q.shift(); for (const v of adj.get(u) || []){ if (prev.has(v) || v === lv.bossRoom) continue; if ((used.get(key(u, v)) || 0) - (used.get(key(v, u)) || 0) >= 1) continue; prev.set(v, u); q.push(v); } }
      if (!prev.has(lv.ante)) break; flow++;
      for (let v = lv.ante; v !== 0; v = prev.get(v)){ const u = prev.get(v); if (used.get(key(v, u))) used.set(key(v, u), used.get(key(v, u)) - 1); else used.set(key(u, v), (used.get(key(u, v)) || 0) + 1); }
    }
    eq(flow, 2, 'уровень ' + n);
    ok(lv.conns.filter(c => !c.tree).length >= 1, 'петли');
  }
});
test('тайники, бонус-блоки, тоннели «колеса», громоотводы и враги на каждом уровне', () => {
  let tunnels = 0;
  for (let n = 1; n <= 4; n++){
    const lv = L.level(n), secrets = lv.rooms.filter(r => r.kind === 's');
    ok(secrets.length >= 1, 'тайников ' + secrets.length);
    secrets.forEach(r => { const c = Object.values(r.nb)[0]; ok(['crack', 'hatch', 'tunnel'].includes(c.k), 'вход в тайник ' + c.k); });
    tunnels += lv.conns.filter(c => c.k === 'tunnel').length;
    const nb = Array.from(lv.t).filter(v => v === L.B).length; ok(nb >= 8, 'бонус-блоков ' + nb);
    ok(lv.items.filter(i => i.k === 'beacon').length >= 2, 'громоотводов');
    ok(lv.items.filter(i => i.k === 'gem').length >= 25, 'самоцветов');
    ok(lv.spawns.length >= 15, 'врагов ' + lv.spawns.length);
    ['crawler', 'flyer', 'turret'].forEach(t => ok(lv.spawns.some(s => s.type === t), n + ': нет ' + t));
    if (n >= 2) ok(lv.spawns.some(s => s.type === 'hopper'), 'прыгуны');
    eq(lv.rooms[lv.bossRoom].kind, 'X'); ok(lv.gates.length >= 3, 'ворота арены');
  }
  ok(tunnels >= 4, 'тоннелей ' + tunnels);
});

// ---------- проходимость (граф по настоящей физике) ----------
const NAVS = {}, NAVB = {};
for (let n = 1; n <= 4; n++){ NAVS[n] = navFor(GR, n); NAVB[n] = L.Nav(L.level(n), { broken: true }); }
test('достижимость выхода: с исходной картой арена босса и портал достижимы со старта (на всех 4 уровнях)', () => {
  for (let n = 1; n <= 4; n++){
    const N = NAVS[n], lv = N.lv, R = N.nav.reach(N.start);
    ok(N.arena.length > 10, 'узлов арены ' + N.arena.length); ok(N.toArena.has(N.start), 'путь к арене');
    ok(R.has(N.portal), 'портал'); ok(N.navG.reach(N.arena[0]).has(N.portal), 'портал при закрытых воротах');
    const rooms = new Set([...R].map(id => nodeRoom(lv, id)));
    lv.rooms.filter(r => r.kind !== 's').forEach(r => ok(rooms.has(r.i), n + ': комната ' + r.rx + ',' + r.ry));
  }
});
test('тайники: за трещиной/люком — только если их разбить; за тоннелем — колесом; всё достижимо', () => {
  for (let n = 1; n <= 4; n++){
    const N = NAVS[n], lv = N.lv, RB = NAVB[n].reach(N.start), R = N.nav.reach(N.start);
    const all = new Set([...RB].map(id => nodeRoom(lv, id))), intact = new Set([...R].map(id => nodeRoom(lv, id)));
    eq(all.size, lv.rooms.length, 'уровень ' + n + ': все комнаты');
    lv.rooms.filter(r => r.kind === 's').forEach(r => { const k = Object.values(r.nb)[0].k; eq(intact.has(r.i), k === 'tunnel', n + ': тайник ' + k); });
  }
});
test('все предметы достижимы (стоя на узле рядом или в прыжке)', () => {
  for (let n = 1; n <= 4; n++){
    const lv = L.level(n), RB = NAVB[n].reach(NAVS[n].start), bad = [];
    lv.items.forEach(it => {
      let found = false;
      for (let dc = -1; dc <= 1 && !found; dc++) for (let dr = 0; dr <= 4 && !found; dr++){ const id = (Math.floor(it.y) + 1 + dr) * lv.W + Math.floor(it.x) + dc; if (RB.has(id)) found = true; }
      if (!found) bad.push(it.k + '@' + it.x + ',' + it.y);
    });
    eq(bad.length, 0, 'уровень ' + n + ': ' + bad.slice(0, 4).join(' '));
  }
});
test('нет тупиков: из любого достижимого места можно дойти до арены', () => {
  for (let n = 1; n <= 4; n++){ const N = NAVS[n], R = N.nav.reach(N.start), bad = [...R].filter(id => !N.toArena.has(id)); eq(bad.length, 0, 'уровень ' + n + ': ' + bad.slice(0, 3).map(id => (id % N.lv.W) + ',' + Math.floor(id / N.lv.W)).join(' ')); }
});
test('граф совпадает с физикой игры: 200 случайных рёбер воспроизводятся в Game', () => {
  const rng = mulberry32(42); let checked = 0;
  for (let k = 0; k < 200; k++){
    const n = 1 + Math.floor(rng() * 4), N = NAVS[n], nodes = [...N.nav.reach(N.start)], id = nodes[Math.floor(rng() * nodes.length)], es = N.nav.edges(id);
    if (!es.length) continue;
    const e = es[Math.floor(rng() * es.length)], { game, S } = mk({ level: n }), c = id % S.W, r = Math.floor(id / S.W);
    game._place(c + 0.5, r); S.hero.charge = L.CHARGE;
    const m = new L.Macro(e.a, c);
    for (let i = 0; i < 400 && !m.done && !m.fail; i++){ const o = m.input(S.hero); if (o.form) game.setForm(o.form); game.setInput({ dx: o.dx, jump: o.jump }); game.update(1 / 60); m.after(S.hero); S.enemies = []; S.eb = []; S.hero.inv = 1; }
    ok(m.done, 'ребро не завершилось'); eq(L.nodeOf(S, S.hero), e.to, 'уровень ' + n + ' ребро ' + c + ',' + r + ' ' + L.ACTS[e.a].k); checked++;
  }
  ok(checked > 150);
});

// ---------- физика, форма-колесо ----------
test('прыжок ≈ 5 клеток; короткое нажатие — ниже; бег 7 клеток/с', () => {
  const lv = L.level(1), sp = floorSpot(lv, lv.rooms[0], 2), { game, S } = mk();
  game._place(sp.x, sp.y); let minY = S.hero.y;
  game.setInput({ jump: true }); for (let i = 0; i < 60; i++){ game.update(1 / 60); minY = Math.min(minY, S.hero.y); }
  ok(sp.y - minY > 4.6 && sp.y - minY < 5.2, 'высота ' + (sp.y - minY).toFixed(2));
  run(game, 1); game._place(sp.x, sp.y); minY = S.hero.y;
  game.setInput({ jump: true }); game.update(1 / 60); game.update(1 / 60); for (let i = 0; i < 60; i++){ game.setInput({}); game.update(1 / 60); minY = Math.min(minY, S.hero.y); }
  ok(sp.y - minY < 2.5, 'короткий ' + (sp.y - minY).toFixed(2));
});
function tunnelSpot(){
  for (let n = 1; n <= 4; n++){ const lv = L.level(n), c = lv.conns.find(q => q.k === 'tunnel'); if (c) return { n, lv, c }; }
}
test('колесо: человек в тоннель не проходит, колесо — проходит и само разворачивается на выходе', () => {
  const { n, c } = tunnelSpot(), { game, S, has } = mk({ level: n });
  game._place(c.wall - 7.5, c.F); run(game, 2, { dx: 1 });
  ok(S.hero.x < c.wall - 5, 'стена держит: ' + S.hero.x.toFixed(2));
  ok(game.wheel(), 'свернулся'); eq(S.hero.form, 'wheel');
  ok(!game.setForm('man') || S.hero.form === 'man'); game.setForm('wheel');
  run(game, 0.3, { dx: 1 }); ok(S.hero.x > c.wall - 5, 'в тоннеле'); ok(!game.setForm('man'), 'в тоннеле не развернуться'); eq(S.hero.form, 'wheel');
  run(game, 1.2, { dx: 1 }); ok(S.hero.x > c.wall + 6, 'выехал: ' + S.hero.x.toFixed(2));
  ok(game.setForm('man')); ok(has('wheel'));
});
test('колесо: неуязвимо для пуль и касаний, заряд тратится, при нуле — развернётся', () => {
  const lv = L.level(1), sp = floorSpot(lv, lv.rooms[0]), { game, S } = mk();
  game._place(sp.x, sp.y); game.wheel();
  game._hurt(5, 'bolt'); eq(S.hero.hp, L.HPMAX, 'неуязвим');
  S.eb.push({ x: S.hero.x, y: S.hero.y - 0.4, vx: 0, vy: 0, r: 0.3, dmg: 2, g: 0, life: 1 }); game.update(1 / 60); eq(S.hero.hp, L.HPMAX); eq(S.eb.length, 0, 'пуля отбита');
  S.hero.charge = 0.05; run(game, 0.2); eq(S.hero.form, 'man', 'заряд кончился');
  ok(S.hero.charge < L.CH_MIN); ok(!game.wheel(), 'без заряда не свернуться'); run(game, 2); ok(game.wheel(), 'заряд восстановился');
});
test('мины: в форме колеса огонь кладёт мину (тратит заряд), взрыв бьёт врага и рушит трещину', () => {
  const lv = L.level(1), sp = floorSpot(lv, lv.rooms[0]), { game, S, has } = mk();
  game._place(sp.x, sp.y); game.wheel(); const ch = S.hero.charge;
  game.setInput({ fire: true }); game.update(1 / 60); game.setInput({});
  eq(S.mines.length, 1); ok(S.hero.charge < ch - L.MINE_COST + 0.05, 'заряд');
  const e = game._spawn('crawler', sp.x + 0.5, sp.y, { hp: 5 });
  run(game, 0.6); ok(has('boom'), 'взрыв'); ok(e.dead, 'враг'); eq(S.mines.length, 0);
  const g2 = mk(), c = Math.floor(sp.x), r = sp.y - 1; g2.S.t[r * g2.S.W + c + 2] = L.K; g2.S.thp[r * g2.S.W + c + 2] = 4;
  g2.game._boom(c + 2.5, r + 0.5, 2.3, 9, 'mine'); eq(g2.S.t[r * g2.S.W + c + 2], L.E, 'трещина разбита');
});

// ---------- оружие ----------
test('основное оружие: веер 3 → 5 пуль, лазер пробивает, отскок отражается; капсулы — тип и ступень', () => {
  const lv = L.level(1), sp = floorSpot(lv, lv.rooms[0]), { game, S, has } = mk();
  game._place(sp.x, sp.y); game.setInput({ fire: true }); game.update(1 / 60); game.setInput({});
  eq(S.bullets.length, 3, 'веер I');
  const give = w => { S.items.push({ k: 'cap', w, x: S.hero.x, y: S.hero.y - 1, got: false, id: 'x' + w }); game.update(1 / 60); };
  give('S'); eq(S.weapon.lv, 2); S.bullets = []; run(game, 0.3); game.setInput({ fire: true }); game.update(1 / 60); game.setInput({}); eq(S.bullets.length, 5, 'веер II'); ok(has('weapon'));
  give('L'); eq(S.weapon.k, 'L'); eq(S.weapon.lv, 2, 'ступень сохраняется');
  S.bullets = []; const a = game._spawn('crawler', S.hero.x + 2, S.hero.y, { hp: 9 }), b = game._spawn('crawler', S.hero.x + 3.5, S.hero.y, { hp: 9 }); S.hero.face = 1; S.hero.fireCd = 0;
  game.setInput({ fire: true }); game.update(1 / 60); game.setInput({}); for (let i = 0; i < 10; i++) game.update(1 / 60);
  ok(a.hp < 9 && b.hp < 9, 'лазер прошил двоих');
  give('B'); eq(S.weapon.k, 'B'); S.bullets = []; S.enemies = [];
  S.bullets.push({ x: S.hero.x, y: S.hero.y - 0.8, vx: -18, vy: 0, dmg: 1, k: 'B', life: 1.2, bounces: 2, len: 0, hit: null });
  let flipped = false; for (let i = 0; i < 70 && S.bullets.length; i++){ game.update(1 / 60); if (S.bullets[0] && S.bullets[0].vx > 0) flipped = true; }
  ok(flipped, 'отскок от стены');
});
test('гибель снимает ступень оружия; молний на жизнь — не меньше двух', () => {
  const { game, S } = mk(); S.weapon = { k: 'L', lv: 3 }; S.thunder = 0;
  game._hurt(99, 'test'); eq(S.phase, 'dead'); eq(S.weapon.lv, 2); eq(S.lives, 2);
  run(game, 2); eq(S.phase, 'play'); eq(S.thunder, L.THUNDER0); eq(S.hero.hp, L.HPMAX);
});
test('луч-кнут: держится, герой стоит; поворачивается к выбранному из 8 направлений; бьёт врага, гасит пули, упирается в стену', () => {
  const lv = L.level(1), sp = floorSpot(lv, lv.rooms[0]), { game, S, has } = mk();
  game._place(sp.x, sp.y); S.hero.face = 1;
  game.setInput({ beam: true }); game.update(1 / 60); ok(S.hero.beam.on); ok(has('beam'));
  const x0 = S.hero.x; game.setInput({ beam: true, dx: -1, dy: -1 }); for (let i = 0; i < 40; i++) game.update(1 / 60);
  eq(S.hero.x, x0, 'стоит'); ok(Math.abs(S.hero.beam.ang - (-3 * Math.PI / 4)) < 0.01, 'вверх-влево: ' + S.hero.beam.ang.toFixed(2));
  game.setInput({ beam: true, dx: 0, dy: -1 }); for (let i = 0; i < 30; i++) game.update(1 / 60);
  ok(Math.abs(S.hero.beam.ang + Math.PI / 2) < 0.01, 'вверх');
  ok(S.hero.beam.len > 3, 'длина ' + S.hero.beam.len.toFixed(1));
  const e = game._spawn('flyer', S.hero.x, S.hero.y - 4, { hp: 3 }); S.enemies = [e];
  game.setInput({ beam: true, dx: 0, dy: -1 }); for (let i = 0; i < 30 && !e.dead; i++){ e.x = S.hero.x; e.y = S.hero.y - 4; game.update(1 / 60); }
  ok(e.dead, 'враг убит лучом');
  S.eb.push({ x: S.hero.x, y: S.hero.y - 3, vx: 0, vy: 0, r: 0.28, dmg: 2, g: 0, life: 2 }); game.update(1 / 60); eq(S.eb.length, 0, 'пуля погашена');
  game.setInput({}); game.update(1 / 60); ok(!S.hero.beam.on, 'отпустил');
});
test('молния: бьёт всех врагов на экране, гасит пули, тратит заряд', () => {
  const { game, S, has } = mk(); const h = S.hero;
  const a = game._spawn('crawler', h.x + 5, h.y), b = game._spawn('turret', h.x + 7, h.y - 4), far = game._spawn('crawler', h.x + 60, h.y);
  S.eb.push({ x: h.x + 2, y: h.y - 1, vx: -1, vy: 0, r: 0.28, dmg: 2, g: 0, life: 3 });
  const n0 = S.thunder; ok(game.thunder()); eq(S.thunder, n0 - 1); ok(a.dead && b.dead, 'на экране'); ok(!far.dead, 'за экраном'); eq(S.eb.length, 0); ok(has('thunder'));
  S.thunder = 0; ok(!game.thunder());
});
test('бонус-блок: разбивается выстрелами и выбрасывает предмет', () => {
  const { game, S, has } = mk(), i = Array.from(S.t).indexOf(L.B), c = i % S.W, r = Math.floor(i / S.W), n0 = S.items.length;
  for (let k = 0; k < 4; k++) game._tileHit(c, r, 1);
  eq(S.t[i], L.E); ok(has('break')); eq(S.items.length, n0 + 1); ok(S.items[S.items.length - 1].drop);
});

// ---------- враги ----------
test('враги: ползун разворачивается у края, турель предупреждает и стреляет, касание ранит, урон растёт с уровнем', () => {
  const lv = L.level(1), sp = floorSpot(lv, lv.rooms[0]), { game, S, has } = mk();
  game._place(sp.x - 6, sp.y);
  const cr = game._spawn('crawler', sp.x + 2, sp.y); cr.dir = 1; let turned = false;
  for (let i = 0; i < 600 && !turned; i++){ game.update(1 / 60); if (cr.dir < 0) turned = true; }
  ok(turned, 'разворот'); S.enemies = [];
  game._place(sp.x - 2, sp.y); const t = game._spawn('turret', sp.x + 3, sp.y, { cd: 0.6, mount: 'floor' }); let warned = false;
  for (let i = 0; i < 60; i++){ game.update(1 / 60); if (t.warn) warned = true; }
  ok(warned, 'вспышка перед выстрелом'); ok(has('eshot'), 'выстрел');
  S.enemies = []; S.eb = []; S.hero.inv = 0; const hp = S.hero.hp; game._spawn('crawler', S.hero.x, S.hero.y); game.update(1 / 60);
  eq(S.hero.hp, hp - L.FOES.crawler.dmg, 'касание');
  const g4 = mk({ level: 4 }); g4.game._hurt(2, 'x'); ok(Math.abs(g4.S.hero.hp - (L.HPMAX - 2 * 1.6)) < 1e-9, 'уровень 4: ×1.6');
});

// ---------- контрольные точки, таймер, тайник ----------
test('громоотвод: касание — точка возврата; после гибели — возврат к нему', () => {
  const lv = L.level(1), bc = lv.items.find(i => i.k === 'beacon' && !i.start), { game, S, has } = mk();
  game._place(bc.x - 2, Math.round(bc.y + 0.9)); run(game, 0.5, { dx: 1 });
  ok(has('beacon')); eq(S.cp.x, bc.x);
  game._hurt(99, 'x'); run(game, 2); ok(Math.abs(S.hero.x - bc.x) < 0.01, 'возврат: ' + S.hero.x);
});
test('таймер уровня: время вышло — минус жизнь, после возврата времени снова хватает', () => {
  const { game, S, has } = mk(); S.ltime = 0.05; run(game, 0.1);
  eq(S.phase, 'dead'); ok(has('die')); eq(S.lives, 2); run(game, 2); eq(S.phase, 'play'); ok(S.ltime >= 100);
});
test('тайник: первый вход — событие и бонус', () => {
  const lv = L.level(1), sr = lv.rooms.find(r => r.kind === 's'), { game, S, has } = mk(), sc = S.score;
  game._place(sr.x0 + 16.5, sr.y0 + L.RH); game.update(1 / 60); ok(has('secret')); eq(S.score - sc >= L.PTS.secret, true); eq(S.secrets, 1);
});

// ---------- боссы, выход, продолжения ----------
test('арена: вход закрывает ворота, босс с 3 фазами; победа — портал — следующий уровень', () => {
  for (let n = 1; n <= 4; n++){
    const lv = L.level(n), br = lv.rooms[lv.bossRoom], { game, S, has, count } = mk({ level: n });
    game._place(lv.arenaSpawn.x, lv.arenaSpawn.y); game.update(1 / 60);
    ok(S.bossActive, 'босс ' + n); ok(lv.gates.every(q => S.t[q] === L.G), 'ворота закрыты'); ok(has('bossIntro'));
    const b = S.boss; eq(b.key, lv.bossKey);
    run(game, 1.8); S.hero.inv = 99;
    game._hitBoss(b.max * 0.4, 'test'); eq(b.phase, 1); ok(has('phase')); run(game, 1.2);
    game._hitBoss(b.max * 0.3, 'test'); eq(b.phase, 2); run(game, 3);
    ok(count('eshot') + count('stomp') + count('markWarn') > 0, 'атакует');
    run(game, 1.2); game._hitBoss(b.max, 'test'); ok(b.dead && has('bossDie')); run(game, 2.2); ok(S.portal, 'портал');
    S.hero.inv = 0; game._place(S.portal.x, S.portal.y); game.update(1 / 60); ok(has('clear'), 'выход');
    run(game, 3.2);
    if (n < 4) eq(S.level, n + 1, 'следующий уровень'); else { ok(S.won && has('win')); }
  }
});
test('гибель в бою: возврат на арену, босс чинится на 20%', () => {
  const lv = L.level(1), { game, S } = mk();
  game._place(lv.arenaSpawn.x, lv.arenaSpawn.y); game.update(1 / 60); run(game, 1.8);
  const b = S.boss; game._hitBoss(b.max * 0.5, 't'); const hp = b.hp; S.hero.inv = 0; game._hurt(99, 'x');
  eq(L.BOSS_HEAL, 0.2); ok(Math.abs(b.hp - Math.min(b.max, hp + b.max * L.BOSS_HEAL)) < 1e-6, 'хп босса'); run(game, 2);
  eq(roomOf(lv, S.hero.x, S.hero.y).i, lv.bossRoom, 'на арене');
});
test('жизни и продолжения: без жизней — «продолжить?», уровень заново и счёт пополам; без продолжений — конец игры', () => {
  const { game, S, has } = mk(); S.score = 10000;
  for (let k = 0; k < 3; k++){ S.hero.inv = 0; game._hurt(99, 'x'); run(game, 1.6); }
  eq(S.phase, 'cont'); ok(has('cont'));
  ok(game.cont()); eq(S.phase, 'play'); eq(S.lives, L.LIVES); eq(S.conts, L.CONTS - 1); eq(S.score, 5000);
  for (let c = 0; c < L.CONTS; c++){ for (let k = 0; k < 3; k++){ S.hero.inv = 0; S.enemies = []; game._hurt(99, 'x'); run(game, 1.6); } if (S.phase === 'cont') game.cont(); }
  eq(S.conts, 0); for (let k = 0; k < 3; k++){ S.hero.inv = 0; S.enemies = []; game._hurt(99, 'x'); run(game, 1.6); }
  ok(S.over && has('gameover'));
});
test('отображение: оба рендера рисуют уровень, HUD и мини-карту без исключений', () => {
  const calls = { n: 0 }, texts = [];
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => { calls.n++; }, set: (o, k, v) => { o[k] = v; return true; } });
  const g = { W: 640, H: 384, t: k => k, text: s => texts.push(String(s)) };
  for (const R of [GR.modern, GR.classic]){
    const { game, S } = mk({ level: 2, keepFoes: true });
    game.setInput({ fire: true }); run(game, 0.5, { dx: 1, fire: true }); game.wheel(); game.update(1 / 60);
    GR.ui.render(g, ctx, S, R, {});
    const lv = L.level(2); game._place(lv.arenaSpawn.x, lv.arenaSpawn.y); run(game, 2.5); GR.ui.render(g, ctx, S, R, {});
  }
  ok(calls.n > 2000, 'вызовов ' + calls.n); ok(texts.includes('hp') && texts.includes('w_S'), 'HUD');
});

// ---------- музыка, i18n, ввод, имена ----------
test('музыка: оригинальный трек grom подключается по gameId', () => {
  const T = sandbox.Arcade.tracks.grom; ok(T && T.bpm > 0 && T.melody && T.bass && T.drums);
  const n = s => (Array.isArray(s) ? s.join(' ') : s).replace(/\|/g, ' ').trim().split(/\s+/).length;
  eq(n(T.melody) % 8, 0); eq(n(T.bass) % 8, 0); eq(n(T.drums) % 8, 0);
});
test('i18n: у RU и EN одинаковые ключи; есть имена зон, боссов и оружия', () => {
  const ru = Object.keys(GR.STR.ru).sort(), en = Object.keys(GR.STR.en).sort(); eq(ru.join(','), en.join(','));
  L.LEVELS.forEach(c => { ok(GR.STR.ru['z_' + c.zone] && GR.STR.en['z_' + c.zone], c.zone); ok(GR.STR.ru['b_' + c.boss], c.boss); });
  ['S', 'L', 'B'].forEach(k => ok(GR.STR.ru['w_' + k] && GR.STR.en['w_' + k]));
});
test('раскладка: клавиши игры не заняты горячими клавишами движка (кроме Пробела у И1)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8'), m = src.match(/p1: \{([\s\S]*?)\} \}/)[1];
  const codes = [...m.matchAll(/'([A-Za-z0-9]+)'/g)].map(x => x[1]);
  ok(codes.length >= 18, 'клавиш ' + codes.length);
  ['KeyP', 'Escape', 'KeyM', 'KeyL', 'KeyT', 'Enter', 'NumpadEnter'].forEach(h => ok(!codes.includes(h), 'занята ' + h));
  eq(new Set(codes).size, codes.length, 'повторы');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifHR1cnJpY2FufNGC0YPRgNGAP9C40LrQsNC9', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 14, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  ok(!BAD.test('turret') && !BAD.test('ГРОМ') && !BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('millstone'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
test('исполнимость: бот без урона проходит все 4 уровня в настоящей физике (лабиринт, колесо, боссы)', () => {
  for (const s of [1, 2, 3]){ const r = playGrom(GR, s, { dmgMul: 0 }); ok(r.won, 'сид ' + s + ': уровней ' + r.cleared + (r.stuckAt ? ' (' + r.stuckAt + ')' : '')); }
});
// «Человеческий» бот (tests/bot.mjs): реакция 150–250 мс, замечает не всех врагов, иногда недопрыгивает, уворачивается не всегда.
// 40 партий (сиды 1..40). Цели: 1-й уровень ≥ 90%, вся игра (с продолжениями) ≈ 20–45%.
const N = 40, BAL = []; for (let s = 1; s <= N; s++) BAL.push(playGrom(GR, s));
test('баланс: бот проходит 1-й уровень в ≥ 90% партий', () => {
  const n = BAL.filter(r => r.cleared >= 1).length; console.log('     1-й уровень: ' + n + '/' + N); ok(n >= 0.9 * N, 'слишком сложно: ' + n + '/' + N);
});
test('баланс: вся игра (4 уровня и босса) — 20–45% партий бота, без «зависаний»', () => {
  const n = BAL.filter(r => r.won).length, dist = new Array(5).fill(0); BAL.forEach(r => dist[r.cleared]++);
  const why = {}; BAL.forEach(r => { for (const k in r.why) why[k] = (why[k] || 0) + r.why[k]; });
  const conts = BAL.reduce((a, r) => a + r.conts, 0);
  console.log('     победы: ' + n + '/' + N + '; уровней 0..4: ' + dist.join(',') + '; гибели: ' + JSON.stringify(why) + '; продолжений: ' + conts);
  ok(n >= 0.2 * N, 'слишком сложно: ' + n + '/' + N); ok(n <= 0.45 * N, 'слишком легко: ' + n + '/' + N);
  ok(!BAL.some(r => r.stuck), 'бот застрял: ' + BAL.filter(r => r.stuck).map(r => r.seed + ':' + r.stuckAt).join(', '));
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
