/* ДЕСАНТ · tests/engine.test.mjs — автотесты логики (Node, без зависимостей).
   Запуск: node desant/tests/engine.test.mjs (QUICK=1 — без партий бота). Логика (js/game.js) — в node:vm с шимом window;
   ввод по игрокам и музыка — настоящий движок (engine.js) в vm с поддельными событиями/AudioContext.
   Покрытие: генератор зон (проходимость старт → арена, мосты через каждую реку, танкетки, чекпоинты, детерминизм),
   ход в 8 направлениях и стрейф, пули и укрытия, гранаты через укрытия, ящики и припасы, гнёзда/дзоты/броневики/катера,
   танкетка (посадка, снаряды, топливо, броня, выход, давит пехоту и ящики), пять машин-боссов (защита ядра, шлюзы),
   чекпоинты и «Продолжить?», возрождение, доп. жизни, кооп и камера, производительность, раскладки, i18n, музыка
   (8–16 тактов, > 30 нот в окне), страница, правило имён; проходимость и баланс — «человеческим» ботом (tests/bot.mjs). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const sandbox = { console, Math };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/game.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
const DS = sandbox.DESANT, L = DS.logic, T = L.T, COLS = L.COLS;
const { playDesant, mulberry32 } = await import('./bot.mjs');

let passed = 0, failed = 0;
function test(name, fn){ try { fn(); passed++; console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + ' — ' + e.message); } }
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' ждали ' + JSON.stringify(b) + ', получили ' + JSON.stringify(a)); }
function ok(c, m){ if (!c) throw new Error(m || 'ложь'); }

// Игра без врагов и подкреплений: зона zone, сид seed
function mk(opts = {}){
  const events = [];
  const game = DS.Game(Object.assign({ rng: mulberry32(opts.seed || 1), seed: opts.seed || 1, onEvent: (t, d) => events.push([t, d]) }, opts)).start();
  const S = game._S;
  S.banner = 0; S.enemies = []; S.pending = []; S.runT = 1e9; S.items = [];
  S.heroes.forEach(h => { h.inv = 0; });
  return { game, S, events, has: t => events.some(e => e[0] === t), count: t => events.filter(e => e[0] === t).length, last: t => (events.filter(e => e[0] === t).pop() || [])[1] };
}
function run(game, sec, fn){ for (let i = 0; i < Math.round(sec * 60); i++){ if (fn) fn(i); game.update(1 / 60); } }
// чистая площадка 7×7 тайлов вокруг (tx,ty) в текущей зоне
function pad(game, S, tx, ty, r = 4){ for (let y = ty - r; y <= ty + r; y++) for (let x = Math.max(1, tx - r); x <= Math.min(COLS - 2, tx + r); x++) game._setTile(x, y, L.G); }
function at(S, tx, ty){ return S.tiles[tx + ty * COLS]; }
function place(S, h, tx, ty){ h.x = tx * T + T / 2; h.y = ty * T + T / 2; S.camY = Math.max(0, h.y - 360); }

// ---------- Генератор ----------
test('зоны: 5 видов × 30 сидов — размер, борта, от старта до арены можно дойти пешком, чекпоинты по порядку, танкетка есть', () => {
  for (let n = 1; n <= L.MAX_ZONE; n++) for (let seed = 0; seed < 30; seed++){
    const D = L.genZone(n, seed), Z = L.ZONES[n - 1];
    eq([D.w, D.h], [COLS, Z.rows + L.ARENA], 'размер');
    for (let y = 0; y < D.h; y++) ok(D.tiles[y * COLS] === L.SOLID && D.tiles[COLS - 1 + y * COLS] === L.SOLID, 'борт в строке ' + y);
    const r = L.reach(D, null, D.start.x, D.start.y);
    let arena = false; for (let x = 0; x < COLS; x++) if (r[x + (L.ARENA - 1) * COLS]) arena = true;
    ok(arena, 'зона ' + n + ', сид ' + seed + ': арена недостижима');
    eq(D.cps.length, 3); ok(D.cps[0].y > D.cps[1].y && D.cps[1].y > D.cps[2].y, 'чекпоинты снизу вверх');
    D.cps.forEach(c => ok(L.WALK[D.tiles[Math.floor(c.x / T) + Math.floor(c.y / T) * COLS]], 'чекпоинт на проходимом'));
    ok(D.tanks.length >= 1, 'нет танкетки');
    D.tanks.forEach(t => ok(r[Math.floor(t.x / T) + Math.floor(t.y / T) * COLS], 'танкетка недостижима'));
    D.spawns.forEach(s => { if (s.type !== 'bunker' && s.type !== 'boat') ok(L.WALK[D.tiles[Math.floor(s.x / T) + Math.floor(s.y / T) * COLS]], s.type + ' в стене'); });
    ok(D.spawns.some(s => s.type === 'nest'), 'нет пулемётных гнёзд');
    ok(D.repairs <= 6, 'генератору пришлось много чинить путь: ' + D.repairs);
  }
  eq(JSON.stringify(L.genZone(3, 5)), JSON.stringify(L.genZone(3, 5)), 'генератор детерминирован');
  ok(JSON.stringify(L.genZone(3, 5).tiles) !== JSON.stringify(L.genZone(3, 6).tiles), 'сид меняет карту');
});
test('реки: через каждую реку/провал есть мост; ландшафт зон различается (топь — грязь, крепость — стены, реки у порогов)', () => {
  const cnt = (D, v) => D.tiles.filter(t => t === v).length;
  for (let n = 1; n <= L.MAX_ZONE; n++) for (let seed = 0; seed < 20; seed++){
    const D = L.genZone(n, seed);
    for (let y = L.ARENA; y < D.h; y++){
      let w = 0, b = 0; for (let x = 1; x < COLS - 1; x++){ const t = D.tiles[x + y * COLS]; if (t === L.WATER) w++; if (t === L.BRIDGE) b++; }
      if (w >= COLS - 4) ok(b >= 2, 'зона ' + n + ' сид ' + seed + ' строка ' + y + ': река без моста');
    }
  }
  const D2 = L.genZone(2, 1), D4 = L.genZone(4, 1), D5 = L.genZone(5, 1), D1 = L.genZone(1, 1);
  ok(cnt(D2, L.MUD) > 20 && cnt(D1, L.MUD) === 0, 'грязь только в топях');
  ok(cnt(D5, L.WALL) > 40, 'стены крепости');
  ok(D4.segs.filter(s => s.kind === 'river').length >= 3, 'реки у порогов');
  eq([1, 2, 3, 4, 5].map(n => L.genZone(n, 1).boss), ['icebreaker', 'dredger', 'crusher', 'dam', 'engine']);
});

// ---------- Герой, стрельба, укрытия ----------
test('ход в 8 направлениях: ствол следует за ходом, диагональ нормирована; зажатый огонь фиксирует ствол (стрейф)', () => {
  const { game, S } = mk(), h = S.heroes[0], tx = 10, ty = 60;
  pad(game, S, tx, ty, 6); place(S, h, tx, ty);
  for (const d of L.DIRS){
    const x0 = h.x, y0 = h.y; game.setMove(0, d[0], d[1]); run(game, 0.25); game.setMove(0, 0, 0);
    eq(h.face, d, 'ствол'); const dist = Math.hypot(h.x - x0, h.y - y0); ok(Math.abs(dist - L.SPEED * 0.25) < 3, 'скорость ' + dist.toFixed(1));
    place(S, h, tx, ty);
  }
  game.setMove(0, 0, -1); run(game, 0.1); game.setFire(0, true); game.setMove(0, 1, 0); run(game, 0.4);
  eq(h.face, [0, -1], 'стрейф: ствол не повернулся'); ok(S.bullets.filter(b => b.k === 'p').every(b => Math.abs(b.vx) < 1e-6 && b.vy < 0), 'пули летят вверх');
  game.setFire(0, false); run(game, 0.05); eq(h.face, [1, 0], 'огонь отпущен — ствол снова по ходу');
});
test('пули: укрытие гасит пулю героя; пуля гнезда проходит свои мешки (первые 0.16 с), затем укрытие её гасит', () => {
  const { game, S } = mk(), h = S.heroes[0];
  pad(game, S, 10, 60, 7); place(S, h, 10, 64); game._setTile(10, 61, L.COVER);
  const e = game._spawn('nest', 10 * T + 12, 57 * T + 12); e.cd = 1e9;
  h.face = [0, -1]; game.setFire(0, true); run(game, 1.5); game.setFire(0, false);
  eq(e.hp, e.max, 'укрытие пропустило пулю'); game._setTile(10, 61, L.G); game.setFire(0, true); run(game, 2.5); ok(e.dead, 'без укрытия — попал');
  const m = mk(), H = m.S.heroes[0]; pad(m.game, m.S, 10, 60, 7); place(m.S, H, 10, 66); H.inv = 1e9;
  const n = m.game._spawn('nest', 10 * T + 12, 58 * T + 12); m.game._setTile(10, 59, L.COVER);
  n.cd = 0; run(m.game, 1.5); ok(m.count('eshot') >= 4, 'гнездо стреляет очередью'); ok(m.S.bullets.some(b => b.k === 'e' && b.y > 60 * T) || m.has('heroHurt') || m.count('wallHit') === 0, 'пули прошли свои мешки');
  m.game._setTile(10, 63, L.COVER); m.S.bullets = []; n.cd = 0; n.warn = 0; n.burst = 0; const hits0 = m.count('wallHit'); run(m.game, 1.5);
  ok(m.count('wallHit') > hits0, 'дальнее укрытие гасит пули врага');
});
test('гранаты: дуга на фиксированную дальность, перелетают укрытия, бьют гнездо, ломают ящики (выпадает припас); запас ограничен', () => {
  const { game, S, has, count } = mk(), h = S.heroes[0];
  pad(game, S, 10, 60, 8); place(S, h, 10, 66);
  for (let x = 1; x < COLS - 1; x++) game._setTile(x, 63, L.COVER);
  const n = game._spawn('nest', h.x, h.y - L.NADE.range); n.cd = 1e9;
  h.face = [0, -1]; const n0 = h.nades;
  eq(game.nade(0), 'nade'); run(game, 0.2); eq(game.nade(0), null, 'перезарядка броска'); run(game, 0.6);
  ok(has('boom') && n.hp < n.max, 'граната перелетела укрытие и задела гнездо');
  eq(h.nades, n0 - 1);
  run(game, 0.5); game.nade(0); run(game, 1); ok(n.dead, 'две гранаты добивают гнездо');
  // ящик с припасом
  game._setTile(10, 69, L.CRATE); S.D.crates[10 + 69 * COLS] = 'spread';
  place(S, h, 10, 75); S.camY = 69 * T - 300; h.face = [0, -1]; h.nadeCd = 0; game.nade(0); run(game, 1);
  eq(at(S, 10, 69), L.RUBBLE, 'ящик разбит'); ok(S.items.some(i => i.kind === 'spread'), 'припас из ящика');
  h.nades = 0; h.nadeCd = 0; eq(game.nade(0), 'empty'); ok(has('noNade'));
  ok(count('crate') >= 1);
});
test('ящик ломается и пулями (3 попадания); припасы: гранаты (≤ 9), здоровье, «веер» (3 пули), «скорострел»', () => {
  const { game, S } = mk(), h = S.heroes[0];
  pad(game, S, 10, 60, 7); place(S, h, 10, 64); game._setTile(10, 61, L.CRATE);
  h.face = [0, -1]; game.setFire(0, true); run(game, 1); game.setFire(0, false); eq(at(S, 10, 61), L.RUBBLE);
  h.nades = 8; S.items.push({ kind: 'nade', x: h.x, y: h.y, taken: false }); run(game, 0.05); eq(h.nades, L.NADES_MAX);
  h.hp = 1; S.items.push({ kind: 'med', x: h.x, y: h.y, taken: false }); run(game, 0.05); eq(h.hp, 2);
  S.items.push({ kind: 'spread', x: h.x, y: h.y, taken: false }); run(game, 0.05); eq(h.weapon, 'spread');
  S.bullets = []; h.cd = 0; game.setFire(0, true); run(game, 0.02); game.setFire(0, false); eq(S.bullets.filter(b => b.k === 'p').length, 3, 'веер — три пули');
  S.items.push({ kind: 'rapid', x: h.x, y: h.y, taken: false }); run(game, 0.05); eq(h.weapon, 'rapid');
  ok(L.GUN.rapid.cd < L.GUN.rifle.cd / 1.5);
});
test('враги: стрелок целится (вспышка) и стреляет; дзот рождает пехоту и не берётся пулями — только взрывом; броневик ходит по полосе и толстый', () => {
  const { game, S, has } = mk(), h = S.heroes[0];
  pad(game, S, 10, 60, 8); place(S, h, 10, 66); h.inv = 1e9;
  const r = game._spawn('rifle', 10 * T + 12, 58 * T + 12); r.cd = 0; r.turnT = 1e9;
  run(game, 0.1); eq(r.state, 'aim', 'вспышка прицеливания'); ok(has('aim')); run(game, 0.6); ok(has('eshot'), 'выстрел');
  game._setTile(9, 56, L.BUNKER); game._setTile(10, 56, L.BUNKER); game._setTile(9, 57, L.BUNKER); game._setTile(10, 57, L.BUNKER);
  const b = game._spawn('bunker', 10 * T, 57 * T, { tx: 9, ty: 56 }); b.cd = 0; run(game, 0.1); ok(has('spawn'), 'дзот выпустил пехоту');
  for (let i = 0; i < 5; i++){ S.bullets.push({ k: 'p', pi: 0, x: b.x, y: b.y + 30, vx: 0, vy: -400, r: 3, life: 1, dmg: 1 }); run(game, 0.1); }
  eq(b.hp, b.max, 'пули дзоту не страшны');
  for (let i = 0; i < 3; i++) game._boom(b.x, b.y + 10, 36, 6, 0, false);
  ok(b.dead && at(S, 9, 56) === L.RUBBLE, 'три взрыва — дзот в щебень');
  const c = game._spawn('car', 5 * T, 0, { lane: 61 }); const x0 = c.x; run(game, 1); ok(Math.abs(c.x - x0) > 30, 'броневик едет'); eq(c.y, 61 * T + 12, 'по своей полосе');
  for (let i = 0; i < 10; i++) game._boom(c.x, c.y, 10, 0.5, 0, false); ok(!c.dead, 'броневик не валится от пары осколков');
});

// ---------- Танкетка ----------
test('танкетка: садишься наездом, снаряды рвутся и бьют по площади, топливо тратится на ходу, без топлива стоит; выход — кнопкой гранаты', () => {
  const { game, S, has } = mk(), h = S.heroes[0];
  S.tanks = []; pad(game, S, 10, 60, 8); place(S, h, 10, 66);
  const tk = game._mkTank(10 * T + 12, 64 * T + 12);
  game.setMove(0, 0, -1); run(game, 0.6); ok(h.tank === tk && has('board'), 'посадка'); eq(tk.pilot, 0);
  const f0 = tk.fuel; run(game, 1); ok(tk.fuel < f0 && tk.y < 64 * T, 'едет и тратит топливо');
  game.setMove(0, 0, 0);
  const e1 = game._spawn('rifle', tk.x, tk.y - 150), e2 = game._spawn('rifle', tk.x + 18, tk.y - 160); [e1, e2].forEach(e => { e.state = 'aim'; e.warn = 1e9; });
  game.setFire(0, true); run(game, 0.7); game.setFire(0, false); ok(has('shell'), 'выстрел снарядом'); run(game, 0.5);
  ok(e1.dead && e2.dead, 'один снаряд — двое (взрыв по площади)');
  tk.fuel = 0; const y0 = tk.y; game.setMove(0, 0, -1); run(game, 0.5); eq(tk.y, y0, 'без топлива не едет'); game.setMove(0, 0, 0);
  eq(game.nade(0), 'exit'); ok(!h.tank && tk.pilot == null && has('exit'), 'вышел'); ok(Math.hypot(h.x - tk.x, h.y - tk.y) > 15, 'стоит рядом');
  h.exitCd = 0; h.x = tk.x; h.y = tk.y + 20; run(game, 0.1); ok(!h.tank && has('noFuel'), 'без топлива не сесть');
});
test('танкетка: броня принимает пули вместо бойца, на нуле — взрыв и выброс бойца с неуязвимостью; давит пехоту и ящики', () => {
  const { game, S, has } = mk(), h = S.heroes[0];
  S.tanks = []; pad(game, S, 10, 60, 8); place(S, h, 10, 66);
  const tk = game._mkTank(h.x, h.y); run(game, 0.05); ok(h.tank === tk);
  const hp0 = h.hp; game._hurt(h, 'bullet', 1); eq(h.hp, hp0, 'боец цел'); eq(tk.armor, tk.max - 1);
  game._setTile(10, 63, L.CRATE); const inf = game._spawn('rifle', h.x, 61 * T + 12); inf.state = 'aim'; inf.warn = 1e9;
  game.setMove(0, 0, -1); run(game, 1.4); game.setMove(0, 0, 0);
  ok(at(S, 10, 63) === L.RUBBLE, 'ящик раздавлен'); ok(inf.dead && has('crush'), 'пехота раздавлена');
  tk.armor = 1; game._hurt(h, 'bullet', 1); ok(tk.dead && !h.tank && h.alive && h.inv > 1 && has('tankDie'), 'взрыв и выброс');
});

// ---------- Боссы ----------
for (const key of Object.keys(L.BOSSES)){
  test('босс ' + key + ': ядро/шлюзы под защитой, порядок разрушения, гибель → «зона пройдена» → следующая зона', () => {
    const zone = { icebreaker: 1, dredger: 2, crusher: 3, dam: 4, engine: 5 }[key];
    const { game, S, has, count } = mk({ zone, maxZone: 5 }), h = S.heroes[0];
    S.camY = 0; place(S, h, 10, 20); S.camY = 0; h.inv = 1e9;
    const b = game._makeBoss(key); b.active = true; b.intro = 0;
    const cores = b.parts.filter(p => p.kind === 'core' || p.kind === 'port'), guards = b.parts.filter(p => p.kind !== 'core' && p.kind !== 'port');
    if (key === 'dam'){
      cores.forEach(p => { p.open = false; }); game._hurtPart(cores[0], 5, 0); eq(cores[0].hp, cores[0].max, 'закрытый шлюз неуязвим'); ok(has('armor'));
      cores.forEach(p => { p.open = true; game._hurtPart(p, 999, 0); });
    } else {
      const c = cores[0]; game._hurtPart(c, 5, 0); eq(c.hp, c.max, 'ядро под защитой'); ok(has('armor'));
      guards.forEach(p => game._hurtPart(p, 999, 0)); ok(guards.every(p => p.dead));
      ok(game._vuln(c), 'ядро открыто'); game._hurtPart(c, 999, 0);
    }
    ok(b.dead && has('bossDie'), 'босс повержен');
    run(game, 2.5); ok(has('clear'), 'зона пройдена'); run(game, 3.6);
    if (zone < 5) eq(S.zone, zone + 1, 'следующая зона'); else ok(has('win') && S.phase === 'won', 'победа');
    ok(count('partDie') === b.parts.length, 'все части разрушены');
  });
}
test('боссы атакуют: прицельные очереди, веера, навесные мины с меткой, валуны по дорожке, катера у плотины, спираль котлов', () => {
  const kinds = { icebreaker: ['eshot'], dredger: ['lob'], crusher: ['rumble'], dam: ['portOpen', 'spawn'], engine: ['eshot'] };
  for (const key of Object.keys(kinds)){
    const zone = { icebreaker: 1, dredger: 2, crusher: 3, dam: 4, engine: 5 }[key];
    const { game, S, has } = mk({ zone }), h = S.heroes[0]; S.camY = 0; place(S, h, 10, 21); S.camY = 0; h.inv = 1e9;
    const b = game._makeBoss(key); b.active = true; b.intro = 0; b.summonT = 0.5;
    run(game, 8); kinds[key].forEach(k => ok(has(k), key + ': нет ' + k));
    if (key === 'dredger') ok(has('boom'), 'мина взорвалась');
    if (key === 'crusher') ok(S.marks.some(m => m.lane) || has('rock') || S.boulders.length, 'валуны');
    if (key === 'engine') ok(S.bullets.filter(q => q.k === 'e').length >= 6, 'спираль');
  }
});

// ---------- Чекпоинты, жизни, «Продолжить?» ----------
test('чекпоинт засчитывается проходом; гибель всех → «Продолжить?» → с чекпоинта, 3 жизни; без продолжений — конец игры', () => {
  const { game, S, has } = mk(), h = S.heroes[0], cp = S.D.cps[0];
  h.x = cp.x; h.y = cp.y - 10; S.camY = cp.y - 300; run(game, 0.05); eq(S.cp, 0); ok(has('checkpoint'));
  for (let i = 0; i < L.LIVES * L.HP; i++){ h.inv = 0; game._hurt(h, 'bullet', 1); if (!h.alive && !h.out) run(game, 1.7); }
  ok(h.out && S.phase === 'cont' && has('contAsk'), 'спросили «Продолжить?»');
  ok(game.cont()); eq(S.phase, 'play'); eq(h.lives, L.LIVES); eq(S.continues, L.CONTINUES - 1);
  ok(Math.abs(h.y - cp.y) < 80, 'возрождение у чекпоинта: ' + (h.y - cp.y));
  S.continues = 0; for (let i = 0; i < L.LIVES * L.HP; i++){ h.inv = 0; game._hurt(h, 'bullet', 1); if (!h.alive && !h.out) run(game, 1.7); }
  eq(S.phase, 'over'); ok(has('gameover'));
  const m = mk(); m.game._kill(m.S.heroes[0], 't'); m.game._kill(m.S.heroes[0], 't'); m.game._kill(m.S.heroes[0], 't');
  run(m.game, 10.5); eq(m.S.phase, 'over', 'таймер «Продолжить?» истёк');
});
test('жизнь: после гибели — возрождение в кадре через 1.5 с, неуязвимость, гранат не меньше 4, оружие сброшено; доп. жизнь за очки', () => {
  const { game, S, has } = mk(), h = S.heroes[0];
  h.weapon = 'rapid'; h.nades = 0; for (let i = 0; i < L.HP; i++){ h.inv = 0; game._hurt(h, 'bullet', 1); }
  ok(!h.alive && has('heroDie')); eq(h.lives, L.LIVES - 1); run(game, 1.6); ok(h.alive && has('respawn'));
  ok(h.inv > 1 && h.nades >= 4 && h.weapon === 'rifle' && h.hp === L.HP); ok(h.y > S.camY && h.y < S.camY + L.VIEW_H, 'в кадре');
  const lv = h.lives; S.score = L.EXTRA_LIFE - 10; game._spawn('rifle', h.x, h.y - 100).hp = 0; S.enemies[S.enemies.length - 1].cd = 1e9;
  S.bullets.push({ k: 'p', pi: 0, x: h.x, y: h.y - 70, vx: 0, vy: -400, r: 3, life: 1, dmg: 1 }); run(game, 0.2);
  ok(h.lives === lv + 1 && has('life'), 'доп. жизнь');
});
test('камера: едет только вверх, к арене останавливается, босс просыпается на верху; враги появляются при входе в кадр', () => {
  const { game, S } = mk(), h = S.heroes[0];
  S.pending = L.genZone(1, 1 * 31 + 1).spawns.slice().sort((a, b) => b.y - a.y);
  const c0 = S.camY; h.inv = 1e9; game.setMove(0, 0, 1); run(game, 1); eq(S.camY, c0, 'вниз камера не едет');
  game.setMove(0, 0, 0); h.y = 200; S.camY = 10; run(game, 0.5); eq(S.camY, 0); ok(S.boss && S.boss.active, 'босс проснулся');
  const m = mk(); m.S.pending = [{ type: 'rifle', x: 240, y: m.S.camY - 100 }]; m.S.heroes[0].inv = 1e9; m.S.heroes[0].y = m.S.camY + 120; run(m.game, 1.5);
  ok(m.S.enemies.length >= 1 && m.S.pending.length === 0, 'плановый враг вошёл в кадр');
});
test('кооп: два бойца с раздельными жизнями и гранатами; отстающий держит камеру; выбывший возвращается в новой зоне', () => {
  const { game, S, has } = mk({ players: 2 }), [a, b] = S.heroes;
  eq(S.heroes.length, 2); ok(Math.abs(a.x - b.x) > 20, 'стоят рядом, не друг в друге');
  a.nades = 1; ok(b.nades === L.NADES0);
  b.inv = a.inv = 1e9; S.tanks = []; const c0 = S.camY; game.setMove(0, 0, -1); run(game, 6); game.setMove(0, 0, 0);
  ok(c0 - S.camY < 40 && a.y >= S.camY + 40, 'отстающий держит камеру, ведущий не уходит из кадра: ' + (c0 - S.camY));
  a.y = S.camY + 60; b.y = S.camY + 100; run(game, 2); ok(c0 - S.camY > 150, 'оба вверху — камера поехала: ' + (c0 - S.camY));
  for (let i = 0; i < 3; i++) game._kill(b, 't'); ok(b.out && S.phase === 'play', 'один выбыл — игра идёт');
  const B = game._makeBoss(S.D.boss); B.active = true; B.intro = 0; B.parts.forEach(p => { p.open = true; }); B.parts.filter(p => p.kind !== 'core' && p.kind !== 'port').forEach(p => game._hurtPart(p, 999, 0)); B.parts.forEach(p => game._hurtPart(p, 999, 0));
  run(game, 6); eq(S.zone, 2); ok(!b.out && b.lives === 1 && b.alive, 'вернулся с 1 жизнью');
});
test('производительность: 80 врагов, 100 пуль, 2 бойца и танкетка — шаг логики в Node < 3 мс', () => {
  const { game, S } = mk({ players: 2, zone: 3 }), r = mulberry32(3);
  S.heroes.forEach(h => { h.inv = 1e9; h.fire = true; h.weapon = 'rapid'; });
  for (let i = 0; i < 80; i++) game._spawn(i % 9 ? 'rifle' : 'nest', 40 + r() * 400, S.camY + 40 + r() * 400, { cd: r() * 2 });
  for (let i = 0; i < 100; i++) S.bullets.push({ k: 'e', x: 40 + r() * 400, y: S.camY + r() * 600, vx: (r() - 0.5) * 200, vy: (r() - 0.5) * 200, r: 3, life: 3, ign: 0, dmg: 1 });
  run(game, 0.5);
  const t0 = process.hrtime.bigint(); run(game, 3); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 180;
  console.log('     шаг: ' + ms.toFixed(3) + ' мс, врагов ' + S.enemies.length + ', пуль ' + S.bullets.length);
  ok(ms < 3, ms.toFixed(2) + ' мс');
});

// ---------- Ввод движка ----------
test('кооп-ввод: раскладки без конфликтов; И1 WASD + F огонь + G граната, И2 стрелки + . огонь + / граната; в одиночке обе ведут И1', () => {
  const src = fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), Lst = {};
  let t = 1000;
  const win = { Math, Object, Array, JSON, Error, Float32Array, parseInt, parseFloat, Date, console: { log() {}, error() {}, warn() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (Lst[ev] = Lst[ev] || []).push(fn); }, removeEventListener() {}, setInterval() { return 1; }, setTimeout() { return 0; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => t }, matchMedia: () => ({ matches: false }) };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ fillText() {}, fillRect() {}, save() {}, restore() {} }) };
  win.document = { querySelector: () => canvas, addEventListener() {} }; win.window = win; win.globalThis = win;
  vm.createContext(win); vm.runInContext(src, win, { filename: 'engine.js' });
  const A = win.Arcade;
  eq(A.checkBindings(L.BIND, { reserved: ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'] }).length, 0, 'конфликты раскладки');
  const g = A.createGame({ canvas: '#c', width: 320, height: 200, gameId: 'ds' });
  g.useStandardScreens({ lives: 3 }); g.scene('play', { realtime: true }); g.start('title');
  eq(g.usePlayers({ bind: L.BIND, actions: ['fire', 'nade'] }).count(), 1);
  eq(g.input.conflicts.length, 0, 'usePlayers нашёл конфликты');
  const key = (type, code) => (Lst[type] || []).forEach(f => f({ type, code, repeat: false, preventDefault() {}, stopPropagation() {} }));
  g.input.setPlayerCount(2); g.goto('play'); t += 500;
  const P1 = g.input.player(0), P2 = g.input.player(1), got = [];
  P1.onPress(n => got.push('1' + n)); P2.onPress(n => got.push('2' + n));
  key('keydown', 'KeyW'); key('keydown', 'KeyF');
  ok(P1.pressed('up') && P1.pressed('fire') && !P2.pressed('up'), 'И1');
  key('keydown', 'ArrowUp'); key('keydown', 'Period'); key('keydown', 'Slash'); key('keydown', 'KeyG');
  ok(P2.pressed('up') && P2.pressed('fire') && P2.pressed('nade'), 'И2');
  eq(got, ['1fire', '2fire', '2nade', '1nade']);
  ['KeyW', 'KeyF', 'ArrowUp', 'Period', 'Slash', 'KeyG'].forEach(c => key('keyup', c));
  g.input.setPlayerCount(1); key('keydown', 'ArrowDown'); key('keydown', 'Period');
  ok(P1.pressed('down') && P1.pressed('fire') && !P2.pressed('down'), 'в одиночке раскладка И2 ведёт И1');
  ok(!Object.values(L.BIND).some(m => Object.values(m).flat().some(c => ['KeyL', 'KeyT', 'KeyM', 'KeyP'].includes(c))), 'горячие клавиши движка не заняты');
});

// ---------- i18n, музыка, страница ----------
test('i18n: RU и EN — одинаковые ключи, непустые строки; зоны, боссы, припасы, оружие; заголовки RU/EN', () => {
  const ru = Object.keys(DS.STR.ru).sort(), en = Object.keys(DS.STR.en).sort();
  eq(ru, en);
  ru.forEach(k => ok(String(DS.STR.ru[k]).trim() && String(DS.STR.en[k]).trim(), 'пусто: ' + k));
  ['play', 'players', 'touch1p', 'language', 'theme', 'sound', 'pause', 'resume', 'menu', 'win', 'gameover', 'best', 'score', 'hint1', 'hint2'].forEach(k => ok(DS.STR.ru[k], 'нет ключа движка ' + k));
  for (let n = 1; n <= L.MAX_ZONE; n++) ok(DS.STR.ru['z_' + n] && DS.STR.en['zs_' + n], 'зона ' + n);
  Object.keys(L.BOSSES).forEach(k => ok(DS.STR.ru['b_' + k] && DS.STR.en['bs_' + k], 'босс ' + k));
  ['nade', 'med', 'spread', 'rapid', 'fuel'].forEach(k => ok(DS.STR.ru['p_' + k], 'припас ' + k));
  Object.keys(L.GUN).forEach(k => ok(DS.STR.en['w_' + k], 'оружие ' + k));
  eq(DS.STR.ru.title, 'ДЕСАНТ'); eq(DS.STR.en.title, 'SOOTBREAKERS');
});
// музыка — так же, как общий _shared/tests/music.test.mjs (секвенсор движка в vm с поддельным AudioContext)
function musicEnv(){
  const listeners = {}, timers = [];
  function param(v) { return { value: v, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(x) { if (!(x > 0)) throw new Error('exp ramp ≤0'); }, setTargetAtTime() {} }; }
  function node(kind) { return { kind, connect() {}, disconnect() {}, start() {}, stop() {}, frequency: param(440), detune: param(0), gain: param(1), Q: param(1), type: '' }; }
  class FakeAC { constructor() { this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {}; }
    createOscillator() { return node('osc'); } createGain() { return node('gain'); } createBiquadFilter() { return node('filter'); } createBufferSource() { return node('noise'); }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; } resume() {} suspend() {} }
  const win = { console, Math, Object, Array, JSON, Error, Float32Array, parseInt,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    setInterval(fn) { timers.push(fn); return timers.length; }, clearInterval(id) { timers[id - 1] = null; },
    setTimeout() { return 0; }, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, performance: { now: () => 0 }, AudioContext: FakeAC };
  const canvas = { width: 100, height: 100, style: {}, addEventListener() {}, getContext: () => ({ imageSmoothingEnabled: true }) };
  win.document = { querySelector: () => canvas, addEventListener() {}, hidden: false }; win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), win, { filename: 'engine.js' });
  return { win, fire: ev => (listeners[ev] || []).forEach(f => f({ code: 'Enter', preventDefault() {} })), tick: (ac, dt) => { ac.currentTime += dt; timers.forEach(t => t && t()); } };
}
test('музыка: трек desant — 8–16 тактов, голоса кратны мелодии, ноты в диапазоне, за 10 с в игре > 30 нот без ошибок', () => {
  const env = musicEnv(), A = env.win.Arcade;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/music.js'), 'utf8'), env.win, { filename: 'music.js' });
  const t = A.tracks.desant; ok(t, 'нет Arcade.tracks.desant');
  const c = A.parseTrack(t), perBar = c.div * 4 === 12 ? 6 : c.div * 4, bars = c.melody.length / perBar;
  ok(bars >= 8 && bars <= 16 && Number.isInteger(bars), 'тактов мелодии ' + bars);
  ok(c.melody.length % c.bass.length === 0 && c.melody.length % c.drums.length === 0, 'голоса не кратны мелодии');
  [...c.melody, ...c.bass].filter(Boolean).forEach(e => ok(e.f > 40 && e.f < 2200, 'нота вне диапазона ' + e.f));
  const g = A.createGame({ canvas: '#c', gameId: 'desant' }); g.useStandardScreens(); g.scene('play', {});
  env.fire('keydown'); g.goto('play'); for (let i = 0; i < 200; i++) env.tick(g.audio.ac, 0.05);
  const st = g.audio.music.stats; ok(st.scheduled > 30 && st.errors === 0, JSON.stringify(st));
});
test('страница: фавикон студии, «← Каталог» (RU/EN), canvas 480×640, скрипты по порядку, тач: стик, огонь, граната, пауза; engine.js = _shared/engine.js', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(/<link rel="icon"[^>]+data:image\/svg\+xml/.test(html), 'фавикон');
  ok(/class="back"[^>]*href="\.\.\/"[^>]*data-en="← Catalog"/.test(html), 'ссылка в каталог');
  ok(/<canvas id="c" width="480" height="640"/.test(html), 'canvas');
  const order = [...html.matchAll(/<script src="\.\/([^"]+)"/g)].map(m => m[1]);
  eq(order, ['engine.js', 'js/music.js', 'js/i18n.js', 'js/game.js', 'js/audio.js', 'js/render.js', 'js/main.js']);
  ok(/class="stick"/.test(html) && /data-d="A"/.test(html) && /data-act="nade"/.test(html) && /data-pause/.test(html), 'тач-кнопки');
  ok(/class="foot"[^>]*data-en=/.test(html), 'подсказка внизу переводится');
  eq(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), fs.readFileSync(path.join(ROOT, '..', '_shared', 'engine.js'), 'utf8'), 'engine.js не копия _shared');
  ok(!/(src|href)="https?:\/\/(?!arcade\.hefest\.ru)/.test(html), 'нет внешних ссылок');
  const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');
  ok(/a\.back\{position:fixed[^}]*z-index:5/.test(css), '«← Каталог» поверх игры и кнопок');
});
test('правило имён: в папке игры нет чужих названий игр/компаний/персонажей (регистронезависимо, с транслитом)', () => {
  // стоп-лист хранится в base64, чтобы сами названия не попадали в текст репозитория (общий список + оригиналы жанра run-and-gun)
  const BAD = new RegExp(Buffer.from('dGFpdG980YLQsNC50YLQvnxwYWMtP21hbnzQv9Cw0LrQvNCw0L18dGV0cmlzfNGC0LXRgtGA0LjRgXxcYmNvbnRyYVxifNC60L7QvdGC0YDQsCg/IVvQsC3Rj9GRXSl8a29uYW1pfNC60L7QvdCw0LzQuHxuYW1jb3zQvdCw0LzQutC+fGNhcGNvbXzQutCw0L/QutC+0Lx8bmludGVuZG980L3QuNC90YLQtdC90LTQvnxzZWdhXGJ80YHQtdCz0LAoPyFb0LAt0Y/RkV0pfHRlY21vfGRpenp5fGRlZXBzZWVrfHhvbml4fNC60YHQvtC90LjQutGBfGJhdHRsZSA/Y2l0eXxsb2RlID9ydW5uZXJ8Ym91bGRlciA/ZGFzaHxyaXZlciA/cmFpZHxleG9sb2580Y3QutGB0L7Qu9C+0L18dml0b3JjfNCy0LjRgtC+0YDQunxsb3N0ID92aWtpbmdzfGRvdWJsZSA/ZHJhZ29ufGJhdHRsZXRvYWRzfHNpbGt3b3JtfFxiZGlnZ2VyXGJ80LTQuNCz0LPQtdGAfGNoaXAgPyc/bic/ID9kYWxlfGRhcmt3aW5nfGdhbGFnfNCz0LDQu9Cw0LN8Z2FsYXhpYW58eWVzb2R80LnQtdGB0L7QtHx1bmRlcnd1cmxkZXxzYWJyZSA/d3VsZnxzYWJyZW1hbnxrbmlnaHQgP2xvcmV8bWFuaWMgP21pbmVyfGpldCA/c2V0ID93aWxseXxtaW5lciA/d2lsbHl8bW9udHkgP21vbGV80LzQvtC90YLQuCg/IVvQsC3Rj9GRXSl8c3RhcnF1YWtlfNGB0YLQsNGA0LrQstC10LnQunxtZXRyb2lkfNC80LXRgtGA0L7QuNC0fHNhbXVzfNGB0LDQvNGD0YF8c3BlbHVua3zRgdC/0LXQu9GD0L3QunxjYXN0bGV2YW5pYXxjeWJlcm5vaWR8amV0cGFjfGF0aWMgP2F0YWN8cGl0ZmFsbHxtb250ZXp1bWF80LzQvtC90YLQtdGB0YPQvHxpbXBvc3NpYmxlID9taXNzaW9ufGZvdGhlcmluZ2hhbXxyb2NrZm9yZHxkeW5hbWl0ZSA/ZGFufFxiZXhpbGVcYnxjaXRhZGVsfFxiYmxvYlxifGFsaWVuID9icmVlZHx0ZWFtID8tPzE3fFxiYWxpZW5zXGJ8eGVub21vcnBofGZhY2VodWdnZXJ8W9GN0LBd0Ltb0LjRjF3QtdC9ID/QsdGAW9C40Ytd0LR80YLQuNC8ID8tPzE3fFvRjdCwXdC7W9C40Yxd0LXQvdGBfNC60YHQtdC90L7QvNC+0YDRhHzRhNC1W9C50Lhd0YHRhdCw0LPQs9C10YB80LvQuNGG0LXRhdCy0LDRgnxjb21tYW5kb3zQutC+0LzQvNCw0L3QtNC+fGlrYXJpfNC40LrQsNGA0Lh8XGJtZXJjc1xifHNob2NrID90cm9vcGVyc3xcYmphY2thbFxifGhlYXZ5ID9iYXJyZWx8Z3VlcnI/aWxsYSA/d2FyfHJhbWJvfNGA0Y3QvNCx0L580YDQtdC80LHQvnx0aW1lID9zb2xkaWVyc3xmcm9udCA/bGluZXx3aG8gP2RhcmVzID93aW5zfGxhbmRpbmcgP3BhcnR5fHN0b3JtY2xvYWt8emFybml0c2F80LfQsNGA0L3QuNGGfG1ldGFsID9zbHVnfGNhbm5vbiA/Zm9kZGVyfGd1blwuPyA/c21va2V8YWxpZW4gP3N5bmRyb21lfGhhbG9cYnxjYWxsID9vZiA/ZHV0eQ==', 'base64').toString('utf8'), 'i');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => !f.endsWith('engine.js') && /\.(js|mjs|html|css|md|json)$/.test(f));
  ok(files.length >= 10, 'файлов: ' + files.length);
  for (const f of files){ const m = fs.readFileSync(f, 'utf8').match(BAD); ok(!m, path.relative(ROOT, f) + ': «' + (m && m[0]) + '»'); }
  for (const f of walk(ROOT)) ok(!BAD.test(path.relative(ROOT, f)), 'имя файла: ' + f);
  const u = b => Buffer.from(b, 'base64').toString('utf8');
  ['Q29tbWFuZG8=', 'SWthcmkgV2FycmlvcnM=', 'TWVyY3M=', 'SGVhdnkgQmFycmVs', 'UmFtYm8=', '0KDRjdC80LHQvg==', 'TGFuZGluZyBQYXJ0eQ==', 'Q29udHJh'].forEach(b => ok(BAD.test(u(b)), 'стоп-лист ловит оригинал жанра'));
  ok(!BAD.test('ДЕСАНТ') && !BAD.test('SOOTBREAKERS') && !BAD.test('Гефест') && !BAD.test('сажевики') && !BAD.test('Сверчок') && !BAD.test('Ольха') && !BAD.test('Пихта') && !BAD.test('CONTRACT.md') && !BAD.test('segs'), 'без ложных срабатываний');
});

// ---------- Проходимость и баланс: «человеческий» бот ----------
if (process.env.QUICK){ console.log(`\n${passed} прошло, ${failed} упало (без бота)`); process.exit(failed ? 1 : 0); }
test('исполнимость: неуязвимый бот проходит каждую из 5 зон с боссом (по 2 сида, настоящая физика)', () => {
  for (let z = 1; z <= L.MAX_ZONE; z++) for (const s of [z, z + 10]){
    const r = playDesant(DS, s, { startZone: z, maxZone: z, invuln: true });
    ok(r.cleared === 1 && !r.stuck, 'зона ' + z + ', сид ' + s + ': ' + JSON.stringify({ cleared: r.cleared, stuck: r.stuck, t: r.t }));
  }
});
const N = 16, RUNS = []; for (let s = 1; s <= N; s++) RUNS.push(playDesant(DS, s, { useCont: false }));
test('баланс: бот (реакция 150–250 мс, замечает не всех врагов и не все пули) без продолжений доходит до 2-й зоны в ≥ 70% из ' + N + ' партий', () => {
  const z2 = RUNS.filter(r => r.zone >= 2).length, dist = new Array(6).fill(0); RUNS.forEach(r => dist[r.cleared]++);
  const hits = {}; RUNS.forEach(r => { for (const k in r.hits) hits[k] = (hits[k] || 0) + r.hits[k]; });
  console.log('     до 2-й зоны: ' + z2 + '/' + N + '; пройдено зон 0..5: ' + dist.join(',') + '; попадания по бойцу: ' + JSON.stringify(hits));
  ok(z2 >= 0.7 * N, 'слишком сложно: ' + z2); ok(!RUNS.some(r => r.stuck), 'зависание: сиды ' + RUNS.filter(r => r.stuck).map(r => r.seed).join(','));
  ok(RUNS.every(r => r.score > 5000), 'очки набираются');
});
test('баланс: всю игру (5 зон, 3 жизни, без продолжений) бот проходит в 10–75% партий; набег ~5–20 минут', () => {
  const w = RUNS.filter(r => r.won).length, tw = RUNS.filter(r => r.won).map(r => r.t);
  console.log('     победы: ' + w + '/' + N + '; время побед, с: ' + tw.join(', '));
  ok(w >= 0.1 * N, 'слишком сложно: ' + w); ok(w <= 0.75 * N, 'слишком легко: ' + w);
  ok(tw.every(t => t > 300 && t < 1200), 'длительность партии');
});
test('продолжения: слабый бот с «Продолжить?» уходит дальше, чем без них; кооп: обе зоны 1 проходят все, без зависаний', () => {
  let a = 0, b = 0;
  for (let s = 1; s <= 4; s++){ a += playDesant(DS, s, { miss: 0.5, missBullet: 0.7, useCont: false }).cleared; b += playDesant(DS, s, { miss: 0.5, missBullet: 0.7 }).cleared; }
  console.log('     слабый бот: зон без продолжений ' + a + ', с продолжениями ' + b);
  ok(b > a, 'продолжения не помогают');
  const CO = []; for (let s = 1; s <= 4; s++) CO.push(playDesant(DS, s, { players: 2, useCont: false, maxZone: 2 }));
  console.log('     кооп (2 зоны): ' + CO.map(r => r.cleared).join(','));
  ok(CO.every(r => r.cleared >= 1 && !r.stuck), 'кооп падает на 1-й или зависает');
});

console.log(`\n${passed} прошло, ${failed} упало`);
process.exit(failed ? 1 : 0);
