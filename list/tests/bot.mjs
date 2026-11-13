/* ЛИСТ · tests/bot.mjs — «человеческий» бот: играет в настоящей логике игры (js/game.js).
   Решения принимает раз в 150–250 мс (реакция), исполняет «макросы» — короткие последовательности кадров ввода
   (подход, комбо из трёх ударов, прыжок через яму / на уступ, блок, захват и бросок в рамку, карандаш у эскиза).
   Ошибки человека: часть замахов врага замечает поздно (miss), момент нажатий гуляет на ±jitter кадров,
   иногда «засматривается» (lapse). Головоломки решает как человек, который понял панель: рычаг → гвоздик рамки →
   карандаш у подставки → эскиз; на запечатанной рамке ловит кляксу и бросает её в рамку. На развилках выбирает
   выход случайно (или opts.prefer: 'F' | 'D').
   playPage(LIST, ch, pg, seed, opts) → { cleared, over, deaths, time, route, ending? }
   playGame(LIST, seed, opts) → { won, ch, pg, deaths, endings } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const DT = 1 / 60;
const RUN = 100;

// карта опоры по столбцам (шаг 2): верх самой высокой твёрдой опоры (без односторонних полок); Infinity — провал
export function groundMap(P, w){
  const n = Math.ceil(w / 2) + 1, g = new Array(n).fill(Infinity);
  for (const s of P.sol){
    if (s.oneway) continue;
    for (let i = Math.max(0, Math.floor(s.x / 2)); i <= Math.min(n - 1, Math.ceil((s.x + s.w) / 2) - 1); i++){
      const cx = i * 2 + 1; if (cx >= s.x && cx <= s.x + s.w) g[i] = Math.min(g[i], s.y);
    }
  }
  return g;
}

function nav(S, spec, P, tx, rng, o, dropInto){
  // макрос пути к точке tx: ходьба, прыжки через ямы ≤ 48 и на уступы ≤ 50
  const h = S.hero, d = Math.sign(tx - h.x); if (!d || Math.abs(tx - h.x) < 3) return [{}];
  const gm = groundMap(P, spec.w), col = x => Math.max(0, Math.min(gm.length - 1, Math.floor(x / 2)));
  const jit = () => Math.round((rng() - 0.5) * 2 * o.jitter);
  const base = h.y;
  for (let x = h.x + d * 6; d > 0 ? x <= Math.min(tx + 6, spec.w) : x >= Math.max(tx - 6, 0); x += d * 2){
    const gy = gm[col(x)];
    if (gy < base - 4){ // стена / уступ
      const rise = base - gy, dist = Math.abs(x - h.x) - 6;
      if (rise > 50) return [{ x: 0 }];
      if (dist <= 14) return [{ x: d, jump: true }].concat(Array.from({ length: 26 }, () => ({ x: d })));
      const k = Math.max(1, Math.min(14, Math.round((dist - 8) / RUN * 60) + jit()));
      return Array.from({ length: k }, () => ({ x: d }));
    }
    if (gy === Infinity){ // яма
      if (dropInto && x > dropInto[0] - 2 && x < dropInto[1] + 2) break; // в эту дыру — шагнуть
      let e = x; while (e >= 0 && e <= spec.w && gm[col(e)] === Infinity) e += d * 2;
      const width = Math.abs(e - x), dist = Math.abs(x - h.x);
      if (width > 50) return [{ x: 0 }];
      if (dist <= 12) return [{ x: d, jump: true }].concat(Array.from({ length: 36 }, () => ({ x: d })));
      const k = Math.max(1, Math.min(14, Math.round((dist - 6) / RUN * 60) + jit()));
      return Array.from({ length: k }, () => ({ x: d }));
    }
  }
  const k = Math.max(1, Math.min(12, Math.round(Math.abs(tx - h.x) / RUN * 60)));
  return Array.from({ length: k }, () => ({ x: d }));
}

function combo(d, rng, o){
  const fr = [{ x: d }];
  const gap = () => 12 + Math.round(rng() * o.jitter);
  for (let i = 0; i < 3; i++){ fr.push({ atk: true }); for (let j = 0; j < gap(); j++) fr.push({}); }
  return fr;
}
function block(d, n){ return Array.from({ length: n }, () => ({ x: d, block: true })); }
function jumpKick(d, pre){ const f = []; for (let i = 0; i < (pre || 0); i++) f.push({ x: d }); f.push({ x: d, jump: true }); for (let i = 0; i < 6; i++) f.push({ x: d }); f.push({ x: d, atk: true }); for (let i = 0; i < 30; i++) f.push({ x: d }); return f; }

function reachable(spec, P, h, x){ // нет непроходимой ямы между героем и x (уровень пола)
  const gm = groundMap(P, spec.w), a = Math.min(h.x, x), b = Math.max(h.x, x);
  let run = 0;
  for (let xx = a; xx <= b; xx += 2){ const g = gm[Math.max(0, Math.min(gm.length - 1, Math.floor(xx / 2)))]; if (g === Infinity) { run += 2; if (run > 50) return false; } else { run = 0; if (g < h.y - 50) return false; } }
  return true;
}

function decide(S, game, mem, rng, o){
  const h = S.hero, spec = game.spec(), P = game.panel(), F = spec.F;
  if (mem.pid !== S.pid + ':' + S.pg + ':' + S.ch){
    mem.pid = S.pid + ':' + S.pg + ':' + S.ch;
    const ex = spec.exits; mem.exit = ex.length > 1 ? (o.prefer ? (ex.find(e => (o.prefer === 'D') === (e.s === 'D')) || ex[0]) : ex[Math.floor(rng() * ex.length)]) : ex[0];
  }
  const B = S.boss;
  const live = S.en.filter(e => e.state !== 'dead' && e.state !== 'spawn' && !e.held);
  // 1) угроза: замах рядом — блок (если заметил)
  for (const e of live){
    const dx = e.x - h.x;
    if ((e.wind > 0 || (e.type === 'nib' && e.atkT > 0 && !e.didHit)) && Math.abs(dx) < (e.type === 'nib' ? 70 : 44) && rng() > o.miss){
      return block(Math.sign(dx) || h.face, e.type === 'nib' ? Math.round((e.wind + 0.45) * 60) + 4 : 18 + Math.round(rng() * 10));
    }
  }
  // 2) босс
  if (B && B.state !== 'enter' && B.state !== 'down'){
    const dx = B.x - h.x, d = Math.sign(dx) || 1, adx = Math.abs(dx);
    if (B.type === 'queen'){
      if ((B.state === 'leap' && B.vy > 40 && adx < 110 && h.ground) || (B.state === 'wind' && adx < 50)) return rng() > o.miss ? [{ x: -d, jump: true }].concat(Array.from({ length: 30 }, () => ({ x: -d }))) : [{}];
      if (B.state === 'recover' || B.state === 'walk'){ if (adx > 30) return nav(S, spec, P, B.x - d * 26, rng, o); return combo(d, rng, o); }
      return [{ x: -d }];
    }
    if (B.type === 'binder'){
      if ((B.state === 'charge' && Math.sign(-dx) === Math.sign(B.vx) && adx < 70) || (B.state === 'wind' && adx < 40)) return rng() > o.miss ? [{ x: d, jump: true }].concat(Array.from({ length: 34 }, () => ({ x: d }))) : [{}];
      if (B.state === 'stun'){ if (adx > 26) return nav(S, spec, P, B.x - d * 22, rng, o); return combo(d, rng, o); }
      if (S.proj.some(p => p.k === 'staple' && Math.abs(p.x - h.x) < 60)) return block(d, 20);
      // держать дистанцию: стоять у стены, чтобы таран врезался в неё
      const wallX = h.x < spec.w / 2 ? 14 : spec.w - 14;
      if (Math.abs(h.x - wallX) > 8) return nav(S, spec, P, wallX, rng, o);
      return [{ x: d }, ...Array.from({ length: 8 }, () => ({}))];
    }
    if (B.type === 'corrector'){
      const cw = spec.w / P.chunks, ci = Math.floor(h.x / cw);
      if (P.eraseWarn[ci] != null || P.erased[ci]){ let best = null, bd = 1e9; for (let i = 0; i < P.chunks; i++) if (P.eraseWarn[i] == null && !P.erased[i]){ const dd = Math.abs((i + 0.5) * cw - h.x); if (dd < bd){ bd = dd; best = i; } } if (best != null) return nav(S, spec, P, (best + 0.5) * cw, rng, o); }
      if (S.proj.some(p => p.k === 'putty' && Math.abs(p.x - h.x) < 50)) return block(d, 16);
      if (B.state === 'ground'){ if (adx > 26) return nav(S, spec, P, B.x - d * 22, rng, o); return combo(d, rng, o); }
      if (live.length) { const e = live[0]; const ed = Math.sign(e.x - h.x) || 1; if (Math.abs(e.x - h.x) > 20) return nav(S, spec, P, e.x - ed * 16, rng, o); return combo(ed, rng, o); }
      if (adx < 14 && h.ground) return jumpKick(d, 0);
      return nav(S, spec, P, B.x - d * 8, rng, o);
    }
  }
  // 3) враги
  const sealMode = spec.seal && P.cleared && !P.sealOpen;
  if (h.hold){
    const td = sealMode ? spec.dir : h.face, wallX = td > 0 ? spec.w : 0;
    if (sealMode && Math.abs(wallX - h.x) > 70) return Array.from({ length: 8 }, () => ({ x: td }));
    return [{ x: td }, { x: td, atk: true }, {}, {}];
  }
  if (live.length){
    let tgt = null, bd = 1e9;
    for (const e of live){
      if (e.type === 'nib' && e.state !== 'stuck' && e.y < F - 40 && !(Math.abs(e.x - h.x) < 18 && e.atkT <= 0)) continue;
      if (!reachable(spec, P, h, e.x)) continue;
      const dd = Math.abs(e.x - h.x); if (dd < bd){ bd = dd; tgt = e; }
    }
    if (!tgt){ const nb = live.find(e => e.type === 'nib' && e.atkT <= 0 && e.wind <= 0); if (nb && Math.abs(nb.x - h.x) < 16 && h.ground) return jumpKick(Math.sign(nb.x - h.x) || h.face, 0); }
    if (tgt){
      const dx = tgt.x - h.x, d = Math.sign(dx) || h.face;
      if (tgt.type === 'nib' && tgt.state !== 'stuck') return jumpKick(d, 0);
      if (sealMode && tgt.type === 'blot'){
        const gd = Math.sign(dx) || 1;
        if (Math.abs(dx) > 16) return nav(S, spec, P, tgt.x - gd * 12, rng, o);
        return [{ x: gd }, { grab: true }, {}, {}];
      }
      if (h.hold) return [{ atk: true }, {}];
      if (Math.abs(tgt.y - h.y) > 20 && h.y < tgt.y - 20) return nav(S, spec, P, tgt.x + (Math.abs(dx) < 10 ? d * 30 : 0), rng, o);
      if (Math.abs(dx) > 20 || Math.abs(tgt.y - h.y) > 20) return nav(S, spec, P, tgt.x - d * 16, rng, o);
      if (Math.abs(dx) < 8) return nav(S, spec, P, h.x - d * 12, rng, o);
      return combo(d, rng, o);
    }
  }
  // 4) низко чернил — к чернильнице
  if (h.hp < 70){ const pot = S.items.find(i => (i.k === 'ink' || i.k === 'drop') && reachable(spec, P, h, i.x)); if (pot && Math.abs(pot.x - h.x) > 3) return nav(S, spec, P, pot.x, rng, o); }
  // 5) головоломки (можно и до зачистки: враги за ямой подождут)
  if (spec.lever && !P.leverOn){
    const L = spec.lever, side = h.x < L.x ? -1 : 1, sx = L.x + side * 27;
    if (Math.abs(h.x - sx) > 3) return nav(S, spec, P, sx, rng, o);
    return jumpKick(-side, 0);
  }
  if (spec.frame && P.frame === 'hang'){
    const pin = spec.frame.pin, side = h.x < pin.x ? -1 : 1, sx = pin.x + side * 14;
    if (Math.abs(h.x - sx) > 3) return nav(S, spec, P, sx, rng, o);
    return [{ x: -side }, { atk: true }, ...Array.from({ length: 16 }, () => ({}))];
  }
  if (spec.sketch && !P.drawn){
    const pi = S.inv.indexOf('pencil');
    if (pi < 0) return nav(S, spec, P, S.stand.x, rng, o);
    const z = spec.sketch.zone, zx = (z[0] + z[1]) / 2;
    if (h.x < z[0] + 3 || h.x > z[1] - 3) return nav(S, spec, P, zx, rng, o);
    return [{ sel: pi + 1 }, { sel: pi + 1, use: true }, ...Array.from({ length: 42 }, () => ({}))];
  }
  if (sealMode || !P.cleared) return [{}, {}, {}];
  // 6) выход
  const ex = mem.exit; if (!ex) return [{}];
  if (ex.s === 'R') return nav(S, spec, P, spec.w + 12, rng, o);
  if (ex.s === 'L') return nav(S, spec, P, -12, rng, o);
  const hc = (ex.hole.x0 + ex.hole.x1) / 2;
  return nav(S, spec, P, hc, rng, o, [ex.hole.x0, ex.hole.x1]);
}

function makeBot(LIST, game, seed, opts){
  const o = Object.assign({ react: [0.15, 0.25], miss: 0.3, jitter: 3, lapse: 0.03 }, opts || {});
  const rng = mulberry32(seed * 7919 + 17);
  let plan = [], next = 0, t = 0, lapse = 0;
  const mem = {};
  return function step(){
    const S = game.state();
    t += DT;
    if (S.phase !== 'play'){ plan = []; game.setInput({}); return; }
    if (t >= next && lapse <= 0){
      next = t + o.react[0] + rng() * (o.react[1] - o.react[0]);
      if (rng() < o.lapse) lapse = 0.25 + rng() * 0.3;
      if (!plan.length || !plan.locked) { plan = decide(S, game, mem, rng, o); plan.locked = plan.some(f => f.atk || f.jump || f.grab || f.use || f.block); if (o.trace) o.trace(S, plan); }
    }
    if (lapse > 0) lapse -= DT;
    const f = plan.length ? plan.shift() : {};
    if (!plan.length) plan.locked = false;
    game.setInput(f);
  };
}

export function playPage(LIST, ch, pg, seed = 1, opts = {}){
  const o = Object.assign({ maxT: 240, god: false }, opts);
  const ev = { die: [], hurt: 0 };
  const game = LIST.Game({ seed, ch, pg, god: o.god, onEvent: (tp, d) => { if (tp === 'die') ev.die.push(d.why); if (tp === 'hurt') ev.hurt++; } }).start();
  const step = makeBot(LIST, game, seed, o);
  let t = 0;
  while (t < o.maxT){
    const S = game.state();
    if (S.pg !== pg || S.ch !== ch || S.phase === 'turn' || S.phase === 'ending' || S.phase === 'won') return { cleared: true, deaths: ev.die.length, why: ev.die, hurt: ev.hurt, time: t, route: S.route.slice(), ending: S.ending, seed };
    if (S.phase === 'over') return { cleared: false, over: true, deaths: ev.die.length, why: ev.die, hurt: ev.hurt, time: t, route: S.route.slice(), pid: S.pid, seed };
    step(); game.update(DT); t += DT;
  }
  const S = game.state();
  return { cleared: false, timeout: true, time: t, pid: S.pid, x: S.hero.x, y: S.hero.y, deaths: ev.die.length, route: S.route.slice(), seed };
}

export function playGame(LIST, seed = 1, opts = {}){
  const o = Object.assign({ maxT: 1500, god: false }, opts);
  const deaths = [];
  const game = LIST.Game({ seed, god: o.god, onEvent: (tp, d) => { if (tp === 'die') deaths.push(d.why); } }).start();
  const step = makeBot(LIST, game, seed, o);
  let t = 0;
  while (t < o.maxT){
    const S = game.state();
    if (S.phase === 'won') return { won: true, time: t, deaths: deaths.length, endings: S.endings.slice(), score: S.score };
    if (S.phase === 'over') return { won: false, over: true, ch: S.ch, pg: S.pg, pid: S.pid, deaths: deaths.length, endings: S.endings.slice() };
    step(); game.update(DT); t += DT;
  }
  const S = game.state();
  return { won: false, timeout: true, ch: S.ch, pg: S.pg, pid: S.pid, x: S.hero.x, boss: S.boss && S.boss.hp, endings: S.endings.slice() };
}
