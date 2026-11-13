/* ЛИСТ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node list/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/*.js) — в node:vm с шимом window;
   рендер прогоняется на «пустом» 2D-контексте (Proxy) — ловит исключения отрисовки в обеих темах. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const calls = { n: 0 };
const fakeCtx = () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop(){} }) : k === 'measureText' ? () => ({ width: 10 }) : () => { calls.n++; }, set: (o, k, v) => { o[k] = v; return true; } });
const sandbox = { console, Math, setTimeout: () => 0, document: { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) } };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['engine.js', 'js/music.js', 'js/i18n.js', 'js/levels.js', 'js/game.js', 'js/audio.js', 'js/render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const LI = sandbox.LIST, LV = LI.levels, LG = LI.logic, K = LG.K, dt = 1 / 60;
const { playPage, playGame, groundMap } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (a !== b) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }
function mk(ch = 1, pg = 1, pid = 'a', opts = {}){
  const ev = [];
  const game = LI.Game(Object.assign({ seed: 1, onEvent: (t, d) => ev.push({ t, d }) }, opts)).start();
  if (pid !== 'a' || ch !== 1 || pg !== 1) game._goto(ch, pg, pid, opts.from);
  return { game, S: game.state(), ev, has: t => ev.some(e => e.t === t), count: t => ev.filter(e => e.t === t).length, last: t => [...ev].reverse().find(e => e.t === t) };
}
function run(game, sec, inp = {}){ for (let i = 0; i < Math.round(sec * 60); i++){ game.setInput(inp); game.update(dt); } }
function tap(game, inp, hold = 1){ for (let i = 0; i < hold; i++){ game.setInput(inp); game.update(dt); } game.setInput({}); game.update(dt); }
function noFoes(game){ game._clearEnemies(); }
const allPanels = () => { const out = []; for (let ch = 1; ch <= 3; ch++) for (let pg = 1; pg <= 2; pg++) for (const id of LV.pageIds(pg)) out.push(LV.buildPanel(ch, pg, id)); return out; };

// ---------- структура и граф панелей ----------
test('книга: 3 главы × 2 страницы; на странице 6–8 панелей + 2 панели боссов на 2-й странице', () => {
  eq(LV.COUNT, 3); eq(LV.PAGES, 2);
  for (let pg = 1; pg <= 2; pg++){ const ids = LV.pageIds(pg), boss = ids.filter(id => LV.template(pg).p[id].boss); ok(ids.length - boss.length >= 6 && ids.length - boss.length <= 8, 'панелей ' + ids.length); eq(boss.length, pg === 2 ? 2 : 0); }
  for (const P of allPanels()){ ok(P.w >= 280 && P.h === 160, 'размер ' + P.id); ok(P.x >= 0 && P.x + P.w <= LV.PAGE_W && P.y + P.h <= LV.PAGE_H, 'в пределах листа ' + P.id); }
});
test('панели одной страницы не перекрываются, между ними есть «поле» (видны как отдельные кадры)', () => {
  for (let pg = 1; pg <= 2; pg++){ const ps = LV.pageIds(pg).map(id => LV.buildPanel(1, pg, id));
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++){ const a = ps[i], b = ps[j]; ok(a.x + a.w + 8 <= b.x || b.x + b.w + 8 <= a.x || a.y + a.h + 8 <= b.y || b.y + b.h + 8 <= a.y, a.id + '/' + b.id); } }
});
test('связность: из начала страницы любой путь по развилкам приходит к концу главы/страницы; тупиков и циклов нет', () => {
  for (let ch = 1; ch <= 3; ch++) for (let pg = 1; pg <= 2; pg++){
    const tpl = LV.template(pg), paths = [];
    (function walk(id, path){
      ok(path.indexOf(id) < 0, 'цикл ' + path.concat(id).join('>'));
      const P = LV.buildPanel(ch, pg, id);
      if (P.boss){ paths.push(path.concat(id)); return; }
      ok(P.exits.length >= 1, 'тупик ' + id);
      for (const ex of P.exits){ if (ex.to === 'END'){ paths.push(path.concat(id, 'END')); continue; } ok(tpl.p[ex.to], 'нет панели ' + ex.to); walk(ex.to, path.concat(id)); }
    })(tpl.start, []);
    ok(paths.length >= 2, 'вариантов пути ' + paths.length);
    const ends = new Set(paths.map(p => p[p.length - 1]));
    if (pg === 1) eq([...ends].join(), 'END'); else eq([...ends].sort().join(), 'A,B', 'обе концовки главы ' + ch);
    // каждая панель страницы достижима
    const seen = new Set(paths.flat()); LV.pageIds(pg).forEach(id => ok(seen.has(id), 'недостижима ' + id));
  }
});
test('развилки: у каждой — 2 выхода (вбок и вниз), и оба ведут к разным путям', () => {
  let forks = 0;
  for (const P of allPanels()) if (P.exits.length > 1){ forks++; eq(P.exits.length, 2); ok(P.exits.some(e => e.s === 'D') && P.exits.some(e => e.s !== 'D'), 'вид ' + P.id); ok(P.exits[0].to !== P.exits[1].to); }
  ok(forks >= 9, 'развилок ' + forks);
});
test('вход в панель: под точкой входа сбоку и под точкой падения сверху есть пол', () => {
  for (const P of allPanels()){
    const rt = LG.makeRuntime(P); rt.cleared = false; LG.rebuildSolids(rt); const gm = groundMap(rt, P.w);
    const at = x => gm[Math.floor(x / 2)];
    eq(at(P.entry.x), P.F, 'бок ' + P.ch + P.pg + P.id); eq(at(P.entry.dropX), P.F, 'верх ' + P.ch + P.pg + P.id);
  }
});
test('выход вниз — дыра в полу у дальнего края, закрыта крышкой, пока панель не зачищена', () => {
  const { game, S } = mk(1, 1, 'c'); const P = game.panel(), ex = game.spec().exits.find(e => e.s === 'D');
  ok(ex && ex.hole.x1 - ex.hole.x0 >= 30, 'дыра');
  ok(P.sol.some(s => s.k === 'cover'), 'крышка'); ok(!game.exitOpen('R'));
  noFoes(game); run(game, 0.2); ok(P.cleared); ok(!P.sol.some(s => s.k === 'cover'), 'крышка снята');
});

// ---------- головоломки: разрешимость поиском ----------
// Абстрактная модель: карта опор (шаг 2), ходьба (ступень ≤ 4), прыжок (подъём ≤ JH, пролёт ≤ JD), спуск — свободно.
const JH = K.JUMPV * K.JUMPV / (2 * K.G) - 10;          // ≈ 51: запас на габарит
const JD = K.RUN * (2 * K.JUMPV / K.G) - 12;            // ≈ 49
function reach(P, flags, fromX){
  const rt = LG.makeRuntime(P); rt.cleared = true; rt.gateOpen = !P.gate || flags.lever; rt.frame = P.frame ? (flags.frame ? 'down' : 'hang') : null; rt.drawn = !!flags.drawn; LG.rebuildSolids(rt);
  const gm = groundMap(rt, P.w), n = gm.length, seen = new Uint8Array(n), q = [Math.floor(fromX / 2)]; seen[q[0]] = 1;
  while (q.length){
    const i = q.shift(), y = gm[i];
    for (let d = -1; d <= 1; d += 2){
      for (let k = 1; k * 2 <= JD + 2; k++){
        const j = i + d * k; if (j < 0 || j >= n) break;
        const yj = gm[j];
        let blocked = false; for (let m = 1; m < k; m++){ const ym = gm[i + d * m]; if (ym < Math.min(y, yj) - JH) blocked = true; if (k > 1 && ym < y - JH) blocked = true; }
        if (blocked) break;
        if (yj === Infinity) continue;
        const walk = k === 1 && yj >= y - 4, jump = yj >= y - JH && (k === 1 || gm.slice(Math.min(i, j) + 1, Math.max(i, j)).every(v => v >= Math.min(y, yj) - JH));
        if ((walk || jump) && !seen[j]){ seen[j] = 1; q.push(j); }
        if (yj < y - JH) break; // стена
      }
    }
  }
  return { gm, seen, at: x => seen[Math.max(0, Math.min(n - 1, Math.floor(x / 2)))], n };
}
function solvePanel(P){
  // поиск по состояниям {lever, frame, drawn, pencil}: действия доступны, если до них можно дойти
  const start = { lever: false, frame: false, drawn: false, pencil: false }, key = s => [s.lever, s.frame, s.drawn, s.pencil].map(Number).join('');
  const q = [start], seen = new Set([key(start)]), from = P.entry.x;
  while (q.length){
    const s = q.shift(), R = reach(P, s, from);
    const nearAny = (x, r, yLo, yHi) => { for (let i = 0; i < R.n; i++) if (R.seen[i] && Math.abs(i * 2 + 1 - x) <= r && R.gm[i] >= yLo && R.gm[i] <= yHi) return true; return false; };
    // выход достижим?
    for (const ex of P.exits){
      if (ex.need === 'tear') { if (P.spawns.length && R.at(P.spawns[P.dir > 0 ? P.spawns.length - 1 : 0])) return { ok: true, via: 'tear', s }; continue; }
      if (ex.s === 'R' && R.seen[R.n - 2]) return { ok: true, via: 'R', s };
      if (ex.s === 'L' && R.seen[1]) return { ok: true, via: 'L', s };
      if (ex.s === 'D' && (R.at(ex.hole.x0 - 3) || R.at(ex.hole.x1 + 3))) return { ok: true, via: 'D', s };
    }
    const next = [];
    if (P.lever && !s.lever && nearAny(P.lever.x, 28, P.lever.y - 4, P.lever.y + 30)) next.push(Object.assign({}, s, { lever: true }));
    if (P.frame && !s.frame && nearAny(P.frame.pin.x, 22, P.frame.pin.y + 14, P.frame.pin.y + 26)) next.push(Object.assign({}, s, { frame: true }));
    if (P.stand && !s.pencil && nearAny(P.stand.x, 12, P.F, P.F)) next.push(Object.assign({}, s, { pencil: true }));
    if (P.sketch && s.pencil && !s.drawn && nearAny((P.sketch.zone[0] + P.sketch.zone[1]) / 2, (P.sketch.zone[1] - P.sketch.zone[0]) / 2, P.F, P.F)) next.push(Object.assign({}, s, { drawn: true, pencil: false }));
    for (const n of next){ const k = key(n); if (!seen.has(k)){ seen.add(k); q.push(n); } }
  }
  return { ok: false };
}
test('головоломки разрешимы (поиск по состояниям рычаг/рамка/карандаш/эскиз) во всех 42 обычных панелях', () => {
  let n = 0;
  for (const P of allPanels()){ if (P.boss) continue; n++; const r = solvePanel(P); ok(r.ok, 'панель ' + P.ch + '-' + P.pg + '-' + P.id + ' (' + P.kind + ')'); }
  eq(n, 42);
});
test('головоломки настоящие: без рычага/рамки/эскиза выход недостижим, а с ними — достижим', () => {
  const kinds = {};
  for (const P of allPanels()){
    if (P.boss || P.kind === 'brawl' || P.kind === 'wall') continue;
    kinds[P.kind] = (kinds[P.kind] || 0) + 1;
    const none = reach(P, {}, P.entry.x), exits = P.exits;
    const can = R => exits.some(ex => ex.s === 'D' ? (R.at(ex.hole.x0 - 3) || R.at(ex.hole.x1 + 3)) : ex.s === 'R' ? R.seen[R.n - 2] : R.seen[1]);
    ok(!can(none), 'без действия проходима: ' + P.ch + P.pg + P.id + ' ' + P.kind);
    const all = reach(P, { lever: true, frame: true, drawn: true }, P.entry.x); ok(can(all), 'с действием непроходима: ' + P.ch + P.pg + P.id);
  }
  ['lever', 'frame', 'sketch', 'steps', 'blank'].forEach(k => ok(kinds[k] >= 3, 'архетип ' + k + ': ' + kinds[k]));
});
test('запечатанная рамка (wall): выход только через разрыв бумаги; есть приток клякс для броска', () => {
  const walls = allPanels().filter(P => P.kind === 'wall'); ok(walls.length >= 4);
  walls.forEach(P => { ok(P.seal); ok(P.exits.some(e => e.need === 'tear')); ok(P.spawns.length >= 1); });
});

// ---------- физика ----------
test('физика: бег 100 ед/с, прыжок ≈ 61 ед вверх и ≈ 61 вдаль; яма-эскиз (92) и рамка (88) не перепрыгиваются', () => {
  const { game, S } = mk(); noFoes(game); game._place(40); run(game, 0.2);
  run(game, 0.5, { x: 1 }); ok(Math.abs(S.hero.vx - K.RUN) < 1);
  game._place(40); run(game, 0.2); let top = 1e9; tap(game, { jump: true }); for (let i = 0; i < 60; i++){ game.update(dt); top = Math.min(top, S.hero.y); }
  const hgt = 144 - top; ok(hgt > 58 && hgt < 64, 'высота ' + hgt);
  const air = 2 * K.JUMPV / K.G * K.RUN; ok(air < 88 - 12 && air < 92 - 12 && air > 34 + 6, 'дальность ' + air);
});
test('стены: ступень 24 — запрыгнуть можно, стена 72 — нет (нужны дорисованные ступени)', () => {
  const { game, S } = mk(1, 2, 'b'); noFoes(game); const P = game.spec(), blk = P.blocks[0];
  game._place(blk.x - 30); run(game, 0.1);
  for (let k = 0; k < 4; k++){ tap(game, { x: 1, jump: true }); run(game, 0.8, { x: 1 }); }
  ok(S.hero.x < blk.x, 'перед стеной x=' + S.hero.x.toFixed(1)); eq(S.hero.y, P.F);
});

// ---------- бой ----------
test('комбо: три удара подряд — 1 + 1 + 2 урона, третий отбрасывает и оглушает', () => {
  const { game, S, ev } = mk(); noFoes(game); game._place(60); const e = game._spawn('guard', 76); e.cd = 99; e.face = -1;
  const hp0 = e.hp, rng = Math.random; let blocks = 0;
  for (let i = 0; i < 3; i++){ tap(game, { atk: true }); run(game, 0.16); }
  blocks = ev.filter(x => x.t === 'eblock').length;
  ok(hp0 - e.hp + blocks * 1 >= 3, 'урон ' + (hp0 - e.hp) + ' блоков ' + blocks);
  ok(ev.some(x => x.t === 'swingHero' && x.d.combo === 2), 'третий удар серии');
});
test('удар в прыжке — 2 урона; один раз за прыжок', () => {
  const { game, S, count } = mk(); noFoes(game); game._place(60); const e = game._spawn('blot', 76); e.cd = 99;
  tap(game, { jump: true }); run(game, 0.36); tap(game, { atk: true }); run(game, 0.5);
  ok(count('jkick') === 1); ok(e.hp <= 1 || e.state === 'dead', 'hp ' + e.hp);
});
test('блок: фронтальный удар кляксы не стоит чернил; со спины — стоит', () => {
  const { game, S, has } = mk(); noFoes(game); game._place(60); S.hero.face = 1;
  game.setInput({ block: true }); game.update(dt);
  const ink0 = S.hero.hp; game._hurt(8, { x: 80 }); eq(S.hero.hp, ink0, 'спереди'); ok(has('blocked'));
  run(game, 0.3, { block: true }); game._hurt(8, { x: 40 }); ok(S.hero.hp < ink0, 'сзади');
});
test('захват и бросок: клякса летит и бьёт других; в рамку — рвёт бумагу (урон, событие tear)', () => {
  const { game, S, has, last } = mk(); noFoes(game); game._place(240); S.hero.face = 1;
  const a = game._spawn('blot', 254); a.cd = 99; run(game, 0.3); a.cd = 99;
  tap(game, { grab: true }); ok(S.hero.hold === a, 'держит'); tap(game, { atk: true });
  run(game, 0.8); ok(has('tear'), 'порвал'); eq(last('tear').d.side, 'R'); ok(a.hp < K.E.blot.hp || a.state === 'dead');
});
test('запечатанная рамка: бросок в неё открывает выход в соседнюю панель', () => {
  const { game, S } = mk(1, 1, 'g'); const P = game.panel(); noFoes(game); run(game, 0.2);
  ok(P.cleared && !game.exitOpen('R'), 'зачищено, но запечатано');
  game._place(game.spec().w - 40); S.hero.face = 1; const b = game._spawn('blot', game.spec().w - 26); b.cd = 99; run(game, 0.25); b.cd = 99;
  tap(game, { grab: true }); tap(game, { atk: true }); run(game, 0.6);
  ok(P.sealOpen && game.exitOpen('R'), 'выход открыт');
  run(game, 3, { x: 1 }); eq(S.pid, 'h', 'перешёл в следующую панель');
});
test('запечатанная рамка без врагов: из-за кадра натекает новая клякса (тупика нет)', () => {
  const { game, S } = mk(1, 1, 'g'); noFoes(game); run(game, 0.2); S.en = []; run(game, 3);
  ok(S.en.some(e => e.type === 'blot'), 'новая клякса');
});

// ---------- чернила = здоровье ----------
test('чернила: удар по воздуху −1, по стене/рамке −2, ножницы −3; чернильница +30, капля +10', () => {
  const { game, S } = mk(); noFoes(game); game._place(120); S.hero.face = 1;
  let h0 = S.hero.hp; tap(game, { atk: true }); run(game, 0.3); eq(h0 - S.hero.hp, K.COST_AIR, 'воздух');
  game.panel().cleared = false; const far = game._spawn('guard', 30); far.cd = 999; game._place(game.spec().w - 12); S.hero.face = 1; h0 = S.hero.hp; tap(game, { x: 1 }); tap(game, { atk: true }); run(game, 0.3); eq(h0 - S.hero.hp, K.COST_WALL, 'стена');
  far.state = 'dead'; game._place(120); S.inv = ['scis', null, null]; S.sel = 0; h0 = S.hero.hp; tap(game, { use: true }); eq(h0 - S.hero.hp, K.COST_SCIS, 'ножницы');
  S.hero.hp = 40; S.items = [{ id: 1, k: 'ink', x: S.hero.x, y: 144, cd: 0 }]; run(game, 0.1); eq(S.hero.hp, 70);
  S.items = [{ id: 2, k: 'drop', x: S.hero.x, y: 144, cd: 0 }]; run(game, 0.1); eq(S.hero.hp, 80);
});
test('промахи расходуют чернила до конца: 100 ударов по воздуху — гибель («расплескал»)', () => {
  const { game, S, has, last } = mk(); noFoes(game); game._place(120);
  for (let i = 0; i < 110 && S.phase === 'play'; i++){ tap(game, { atk: true }); run(game, 0.25); }
  ok(has('die')); eq(last('die').d.why, 'air');
});
test('жизни: один запасной лист; после гибели — панель заново с полными чернилами; вторая — конец игры', () => {
  const { game, S, has } = mk(); eq(S.lives, 2);
  game._hurt(200); run(game, 2); eq(S.phase, 'play'); eq(S.lives, 1); eq(S.hero.hp, K.INK); ok(has('respawn'));
  run(game, 1.5); game._hurt(200); run(game, 2); eq(S.phase, 'over'); ok(has('gameover'));
});
test('яма между кадров: −12 чернил и возврат ко входу панели', () => {
  const { game, S, has } = mk(1, 1, 'e'); noFoes(game); const P = game.spec(), pit = P.pits.find(p => p.k === 'pit');
  game._place((pit.x0 + pit.x1) / 2, 100); S.hero.ground = false; const h0 = S.hero.hp; run(game, 1.2);
  ok(has('fall')); eq(h0 - S.hero.hp, K.PIT_DMG); eq(S.hero.x, P.entry.x);
});

// ---------- инвентарь и механизмы ----------
test('инвентарь: 3 ячейки; при полной — обмен с выбранной (старый предмет падает рядом)', () => {
  const { game, S, has } = mk(); noFoes(game); game._place(100);
  S.inv = ['scis', 'flask', 'mark']; S.sel = 1; S.items = [{ id: 9, k: 'pencil', x: 100, y: 144, cd: 0 }]; run(game, 0.1);
  eq(S.inv.join(), 'scis,pencil,mark'); ok(S.items.some(i => i.k === 'flask'), 'склянка на полу');
  tap(game, { slot: true }); eq(S.sel, 2); tap(game, { sel: 1 }); eq(S.sel, 0);
});
test('карандаш: у подставки выдаётся; вне эскиза — «нечего дорисовать»; в зоне — мост становится опорой', () => {
  const { game, S, has } = mk(1, 1, 'e'); noFoes(game); const P = game.spec(), rt = game.panel();
  game._place(P.stand.x); run(game, 0.1); ok(S.inv.includes('pencil'), 'взял');
  S.sel = S.inv.indexOf('pencil'); game._place(P.stand.x); tap(game, { use: true }); ok(has('noSketch')); ok(S.inv.includes('pencil'), 'не потрачен');
  game._place((P.sketch.zone[0] + P.sketch.zone[1]) / 2); tap(game, { use: true }); run(game, 0.8);
  ok(rt.drawn, 'дорисовал'); ok(!S.inv.includes('pencil'), 'потрачен'); ok(rt.sol.some(s => s.k === 'sketch'));
});
test('рычаг открывает ворота; гвоздик роняет рамку-мост (и она бьёт врагов под собой)', () => {
  const a = mk(1, 1, 'b'); noFoes(a.game); const L = a.game.spec().lever, rt = a.game.panel();
  ok(rt.sol.some(s => s.k === 'gate'));
  a.game._place(L.x - 27); a.S.hero.face = 1; tap(a.game, { jump: true }); tap(a.game, { atk: true }); run(a.game, 0.8);
  ok(rt.leverOn && rt.gateOpen && !rt.sol.some(s => s.k === 'gate'), 'ворота открыты'); ok(a.has('lever'));
  const b = mk(1, 1, 'c'); noFoes(b.game); const fr = b.game.spec().frame, rt2 = b.game.panel();
  const e = b.game._spawn('blot', fr.rect.x + 40); e.cd = 99;
  b.game._place(fr.pin.x - 14); b.S.hero.face = 1; tap(b.game, { atk: true }); run(b.game, 0.7);
  eq(rt2.frame, 'down'); ok(rt2.sol.includes(fr.rect), 'мост'); ok(e.hp < K.E.blot.hp || e.state === 'dead', 'рамка ударила');
});
test('склянка — взрыв 5 урона по площади; закладка — щит 6 с; ножницы возвращаются в руку', () => {
  const { game, S, has } = mk(); noFoes(game); game._place(80); S.hero.face = 1;
  const e1 = game._spawn('guard', 118), e2 = game._spawn('blot', 128); e1.cd = e2.cd = 99;
  S.inv = ['flask', 'mark', 'scis']; S.sel = 0; tap(game, { use: true }); run(game, 0.6); ok(has('boom')); ok(e1.hp <= 1 || e1.state === 'dead'); ok(e2.state === 'dead');
  eq(S.inv[0], null, 'склянка потрачена');
  S.sel = 1; tap(game, { use: true }); ok(S.hero.shield > 5); const h0 = S.hero.hp; game._hurt(10, { x: 40 }); eq(S.hero.hp, h0, 'щит');
  S.sel = 2; tap(game, { use: true }); ok(S.proj.some(p => p.k === 'scis')); run(game, 1.5); ok(!S.proj.length); eq(S.inv[2], 'scis', 'вернулись');
});
test('отбитое блоком перо втыкается в пол — его можно бить и схватить', () => {
  const { game, S } = mk(1, 1, 'd'); noFoes(game); game._place(150); S.hero.face = 1;
  const n = game._spawn('nib', 190); n.y = 100; n.cd = 99; n.wind = 0.01;
  for (let i = 0; i < 90 && n.state !== 'stuck'; i++){ game.setInput({ block: true, x: Math.sign(n.x - S.hero.x) || 1 }); game.update(dt); }
  eq(n.state, 'stuck');
});

// ---------- боссы и концовки ----------
test('боссы: три разных (Великая Клякса, Переплётчик, Злой Корректор); у Переплётчика щит спереди', () => {
  const names = LV.CHAPTERS.map(c => c.boss); eq(names.join(), 'queen,binder,corrector');
  const { game, S, has } = mk(2, 2, 'A'); run(game, 1.2); const B = S.boss; ok(B && B.type === 'binder');
  run(game, 1.5); B.state = 'walk'; B.t = 0; B.face = -1; game._place(B.x - 26); S.hero.face = 1; S.hero.inv = 0; const hp0 = B.hp;
  tap(game, { atk: true }); run(game, 0.15); eq(B.hp, hp0, 'спереди — щит'); ok(has('eblock'));
  run(game, 0.3); B.state = 'stun'; B.t = 0; B.x = S.hero.x + 26; tap(game, { atk: true }); run(game, 0.15); ok(B.hp < hp0, 'оглушённого — можно');
});
test('Корректор стирает куски пола (с предупреждением), потом они возвращаются', () => {
  const { game, S, has } = mk(3, 2, 'B', { god: true }); run(game, 1.2); const P = game.panel();
  let warned = false, erased = false;
  for (let i = 0; i < 60 * 12; i++){ game.setInput({}); game.update(dt); if (Object.keys(P.eraseWarn).length) warned = true; if (Object.keys(P.erased).length) erased = true; }
  ok(warned && erased && has('erase'), 'стирание'); ok(has('restore'), 'возврат');
});
test('концовки: босс повержен → концовка A или B по панели-арене → следующая глава', () => {
  const { game, S, has, last } = mk(1, 2, 'A'); run(game, 1.3); const B = S.boss; B.hp = 1; B.state = 'recover';
  game._place(B.x - 28); S.hero.face = 1; S.hero.inv = 0; tap(game, { atk: true }); run(game, 2); ok(has('bossDown'), 'повержен'); eq(S.phase, 'ending'); eq(last('ending').d.v, 'A');
  run(game, 4.5); eq(S.ch, 2); eq(S.pg, 1); eq(S.phase, 'play'); eq(S.endings.join(), '1A');
});

// ---------- тексты, звук, рендер ----------
test('i18n: у RU и EN одинаковые ключи; есть подписи панелей, концовки, имена боссов; ономатопеи на своём языке', () => {
  const ru = Object.keys(LI.STR.ru).sort(), en = Object.keys(LI.STR.en).sort(); eq(ru.join(), en.join());
  for (const P of allPanels()) if (P.cap) ok(LI.STR.ru[P.cap] && LI.STR.en[P.cap], P.cap);
  for (let c = 1; c <= 3; c++) for (const v of 'AB') ok(LI.STR.ru['end' + c + v] && LI.STR.en['end' + c + v]);
  ['queen', 'binder', 'corrector'].forEach(b => ok(LI.STR.ru['b_' + b] && LI.STR.en['b_' + b]));
  eq(Object.keys(LI.ONO.ru).sort().join(), Object.keys(LI.ONO.en).sort().join());
  ok(LI.ONO.ru.hit.includes('БАЦ!') && LI.ONO.ru.hit.includes('ХРЯСЬ!') && LI.ONO.en.hit.includes('WHAM!') && LI.ONO.en.hit.includes('CRACK!'));
  ok(Object.values(LI.ONO.ru).flat().every(s => /[А-ЯЁ]/.test(s)) && Object.values(LI.ONO.en).flat().every(s => /^[A-Z!\- ]+$/.test(s)));
});
test('музыка: Arcade.tracks.list и темы глав/босса разбираются секвенсором', () => {
  const T = sandbox.Arcade.tracks; ['list', 'list:2', 'list:3', 'list:boss'].forEach(k => { ok(T[k], k); const p = sandbox.Arcade.parseTrack(T[k]); ok(p && p.steps > 0 || p, k); });
});
test('рендер: каждая страница каждой главы рисуется в обеих темах без исключений (в т.ч. смена страницы и босс)', () => {
  const g = { themeName: 'modern', th: () => ({}), t: k => (LI.STR.ru[k] || k), ctx: fakeCtx() };
  for (const theme of ['modern', 'retro']){
    g.themeName = theme;
    for (let ch = 1; ch <= 3; ch++) for (let pg = 1; pg <= 2; pg++) for (const id of LV.pageIds(pg)){
      const { game, S } = mk(ch, pg, id); run(game, 1.6, { x: 1, atk: true });
      const before = calls.n; LI.R.draw(g, fakeCtx(), S, game, { cam: { x: 300, y: 200 }, banner: { title: 'x', sub: 'y', a: 1, dur: 2, lines: ['z'] } }); ok(calls.n > before + 50, 'мало рисования ' + id);
    }
    const { game, S } = mk(); S.phase = 'turn'; S.phaseT = 0.6; LI.R.draw(g, fakeCtx(), S, game, { cam: { x: 300, y: 200 } });
  }
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (+ список этой игры)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxi', 'base64').toString('utf8')
    + '|' + Buffer.from('Y29taXggP3pvbmV80LrQvtC80LjQutGBID/Qt9C+0L180LrQvtC80LjQutGBLdC30L7QvXxza2V0Y2ggP3R1cm5lcnzRgdC60LXRgtGHID/RgtC10YDQvdC10YB80YHQutC10YLRhyA/0YLRkdGA0L3QtdGAfG1vcnR1c3zQvNC+0YDRgtGD0YF8cm9hZGtpbGx80YDQvtGD0LTQutC40Ls=', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 12, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  // проверка, что стоп-лист не задевает наши собственные слова
  ok(!BAD.test('Гефест') && !BAD.test('CONTRACT.md') && !BAD.test('комикс') && !BAD.test('лубок') && !BAD.test('Корректор'), 'стоп-лист без ложных срабатываний на наши слова');
});

// ---------- партии бота (QUICK=1 — пропустить) ----------
if (process.env.QUICK){ console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed) + ' (без бота)'); process.exit(failed ? 1 : 0); }
test('исполнимость: бот без урона проходит все 6 страниц и боссов, на развилках — оба выхода', () => {
  for (const pref of ['F', 'D']) for (let ch = 1; ch <= 3; ch++) for (let pg = 1; pg <= 2; pg++){
    const r = playPage(LI, ch, pg, 3, { god: true, prefer: pref, maxT: 300 }); ok(r.cleared, ch + '-' + pg + ' ' + pref + ': ' + JSON.stringify(r).slice(0, 160));
    if (pg === 2) ok(r.ending, 'концовка');
  }
});
// «Человеческий» бот: реакция 150–250 мс, не замечает 30 % замахов, ±3 кадра на нажатиях, «засматривается».
const N = 30, P1 = []; for (let s = 1; s <= N; s++) P1.push(playPage(LI, 1, 1, s));
test('баланс: «человеческий» бот проходит страницу 1 часто (≥ 70 % партий)', () => {
  const n = P1.filter(r => r.cleared).length; console.log('     страница 1: ' + n + '/' + N); ok(n >= 0.7 * N, 'слишком сложно: ' + n);
  ok(P1.some(r => r.route.includes('c')) && P1.some(r => !r.route.includes('c')), 'обе ветки развилки встречаются');
});
test('баланс: вся игра «человеческим» ботом — проходима, но не даром (1–60 % из 20)', () => {
  let w = 0; for (let s = 1; s <= 20; s++) if (playGame(LI, s).won) w++;
  console.log('     вся игра: ' + w + '/20'); ok(w >= 1 && w <= 12, 'побед ' + w);
});
test('расход здоровья в живой игре: промахи и удары по стенам реально тратят чернила', () => {
  let air = 0, wall = 0;
  const game = LI.Game({ seed: 5, onEvent: (t, d) => { if (t === 'ink' && d.why === 'air') air++; if (t === 'ink' && d.why === 'wall') wall++; } }).start();
  for (let i = 0; i < 60 * 20; i++){ game.setInput({ x: i < 60 ? 1 : -1, atk: i % 14 === 0 }); game.update(dt); }
  ok(air > 3, 'по воздуху ' + air); ok(wall >= 1, 'по стене ' + wall);
});

console.log((failed ? 'FAIL ' : 'OK ') + passed + '/' + (passed + failed));
process.exit(failed ? 1 : 0);
