/* УДАЛЕЦ · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса (переделка 2026-11: мехи и горны).
   Карту уровня знает (как игрок, прошедший уровень разок), но управляет только как человек:
   setInput(dx, dy, jump) и puff(dir) — по тем же «макросам» движения, из которых строится граф (logic.ACTS:
   шаг, прыжок, прыжок с подскоком-выдохом, подъём на продухе).
   Цель — ближайшее место, откуда выдох достаёт незажжённый горн; если до горнов не дойти — крыльчатка (поднять заслонки).
   Человеческие ограничения:
   - реакция: каждое решение через 150–250 мс после приземления; иногда «засматривается» (lapse);
   - время удержания направления в прыжке — с ошибкой ±timing с (прыжок выходит короче/длиннее);
   - обитателей предугадывает «на глаз»: часть замечает с опозданием ~0,6 с (miss), ждёт, пока путь освободится, но не дольше ~5 с;
   - мешающего обитателя сдувает выдохом — тоже с задержкой реакции.
   opts: { react:[0.15,0.25], timing=0.035, lapse=0.06, miss=0.15, perfect=false, god=false, level=1, maxT=1500, only=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// навигация по уровню: граф + обратные рёбра + кэш полей расстояний; пересобирается, когда поднимаются заслонки (LV.ver)
const NAVS = new WeakMap();
function navFor(L, LV){
  const old = NAVS.get(LV); if (old && old.ver === LV.ver) return old;
  const nav = L.Nav(LV), W = LV.w, rev = new Map(), nodes = [];
  for (let r = 0; r < LV.h; r++) for (let c = 0; c < W; c++) if (nav.isNode(c, r)) nodes.push(r * W + c);
  // «рискованный» прыжок: при ошибке удержания ±0,05 с герой задевает опасность или приземляется не туда — человек такого избегает
  const risky = (n, e) => {
    const a = L.ACTS[e.a]; if (a.k === 'walk') return 0;
    for (const nz of [-0.05, 0.05]){
      const H = L.newHero(n % W, Math.floor(n / W)), X0 = H.x, mem = { X0 }; let t = 0, f = null;
      for (let i = 0; i < 420 && !f; i++){ L.heroStep(LV, H, L.drive(a, t, H, X0, nz, mem), L.STEP); t += L.STEP; if (L.hazardHit(LV, H)) return 1; f = L.finished(a, t, H, mem); }
      if (f !== 'ok' || L.nodeOf(LV, H) !== e.to) return 1;
    }
    return 0;
  };
  const reach = nav.reach([LV.start.r * W + LV.start.c]);
  nodes.forEach(n => { nav.edges(n).forEach(e => { if (e.risk == null) e.risk = reach[n] ? risky(n, e) : 0; if (!rev.has(e.to)) rev.set(e.to, []); rev.get(e.to).push({ from: n, e }); }); });
  const o = { nav, rev, fields: new Map(), LV, ver: LV.ver };
  NAVS.set(LV, o); return o;
}
const cost = e => e.t + 0.25 + (e.risk ? 3 : 0);
function field(A, targets){
  const key = targets.join(',');
  if (A.fields.has(key)) return A.fields.get(key);
  const dist = new Map(), heap = [];
  targets.forEach(t => { dist.set(t, 0); heap.push([0, t]); });
  const pop = () => { let b = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[b][0]) b = i; return heap.splice(b, 1)[0]; };
  while (heap.length){
    const [d, n] = pop(); if (d > dist.get(n)) continue;
    for (const { from, e } of A.rev.get(n) || []){
      const nd = d + cost(e);
      if (nd < (dist.has(from) ? dist.get(from) : Infinity)){ dist.set(from, nd); heap.push([nd, from]); }
    }
  }
  A.fields.set(key, dist); return dist;
}

const STAND = { k: 'stand' }, HOP = { k: 'jump', d: 0, hold: 0, delay: 0 };
export function playUdalets(U, seed, opts = {}){
  const L = U.logic, dt = 1 / 60;
  const perfect = !!opts.perfect, brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const timing = perfect ? 0 : (opts.timing == null ? 0.035 : opts.timing);
  const lapse = perfect ? 0 : (opts.lapse == null ? 0.06 : opts.lapse);
  const missP = perfect ? 0 : (opts.miss == null ? 0.15 : opts.miss);
  const maxT = opts.maxT || 1500;
  const res = { seed, won: false, level: 1, cleared: 0, deaths: 0, why: {}, kills: 0, puffs: 0, time: 0, score: 0, stuck: false, over: false, lifts: 0, rides: 0, log: [] };
  const game = U.Game({ rng: mulberry32(seed), god: !!opts.god, level: opts.level || 1, onEvent: (t, d) => {
    if (t === 'die'){ res.why[d.why] = (res.why[d.why] || 0) + 1; res.log.push(d.level + (d.k || d.why)); }
    if (t === 'clear') res.cleared++;
  } }).start();
  const S = game.state();
  let seen = new WeakMap(), seenLV = null;
  const noticed = e => {
    if (S.LV !== seenLV){ seenLV = S.LV; seen = new WeakMap(); }
    let s = seen.get(e); if (!s){ s = { t: S.time, miss: brng() < missP }; seen.set(e, s); }
    return !s.miss || S.time - s.t > 0.6;
  };
  const reactT = () => perfect ? 0.03 : r0 + brng() * (r1 - r0);
  let mode = 'decide', wait = reactT(), act = null, actT = 0, mem = null, noise = 0, waited = 0, blow = null;
  let A = null, lastKey = '', best = Infinity, bestT = 0, wander = 0;
  const step = (dx, dy, jump) => { game.setInput(dx, dy, jump); game.update(dt); };

  // цели: места выдоха для незажжённых горнов; если ни одно не достижимо — для нераскрученных крыльчаток
  function goals(){
    const LV = S.LV, out = { furn: [], vane: [] };
    LV.furn.forEach(f => { if (S.heat[f.id] < L.HEAT_NEED) L.spotsFor(LV, f.c, f.r).forEach(s => out.furn.push(Object.assign({ obj: f, kind: 'furn' }, s))); });
    LV.vanes.forEach(v => { if (!S.spun[v.id]) L.spotsFor(LV, v.c, v.r).forEach(s => out.vane.push(Object.assign({ obj: v, kind: 'vane' }, s))); });
    return out;
  }
  function nodeHere(){
    const H = S.hero; if (!H.ground || H.up) return null;
    const n = L.nodeOf(S.LV, H); if (n == null) return null;
    return { n, c: n % S.LV.w, r: Math.floor(n / S.LV.w) };
  }
  const near = e => e.alive && L.near(e, S.hero) && noticed(e);
  // «на глаз»: прогон действия вперёд вместе с обитателями — заденут ли
  function unsafe(a, horizon){
    if (S.inv > 0.6) return false;
    const LV = S.LV, H = Object.assign({}, S.hero), X0 = H.x, m = { X0 };
    const ens = S.enemies.filter(near).map(e => Object.assign({}, e));
    const shots = S.eshots.map(b => Object.assign({}, b));
    if (!ens.length && !shots.length) return false;
    const hit = () => { for (const e of ens) if (L.harmful(e) && L.heroTouches(H, L.enemyBox(e), 0.25)) return true; for (const b of shots) if (b.alive && L.heroTouches(H, { x0: b.x - 0.15, x1: b.x + 0.15, y0: b.y - 0.15, y1: b.y + 0.15 }, 0.2)) return true; return false; };
    let t = 0;
    if (a.k !== 'stand') for (let k = 0; k < (horizon || 200); k++){
      L.heroStep(LV, H, L.drive(a, t, H, X0, 0, m), dt); t += dt;
      for (const e of ens) L.enemyStep(LV, e, dt, H, shots);
      for (const b of shots) L.shotStep(LV, b, dt);
      if (hit()) return true;
      if (L.finished(a, t, H, m)) { if (t > 0.5) break; }
    }
    for (let k = 0; k < 30; k++){ for (const e of ens) L.enemyStep(LV, e, dt, H, shots); for (const b of shots) L.shotStep(LV, b, dt); if (hit()) return true; }
    return false;
  }
  // мешающий обитатель (или уголёк) в зоне выдоха перед героем
  function threat(){
    const H = S.hero; let bestE = null, bd = 99;
    for (const d of [1, -1]){
      const b = L.gustBox(S.LV, H, d);
      for (const e of S.enemies){
        if (!near(e) || !L.harmful(e)) continue;
        const bx = L.enemyBox(e);
        if (bx.x1 > b.x0 && bx.x0 < b.x1 && bx.y1 > b.y0 && bx.y0 < b.y1){ const dd = Math.abs(e.x - H.x); if (dd < bd){ bd = dd; bestE = { d, e }; } }
      }
      for (const s of S.eshots){ if (s.alive && s.x > b.x0 && s.x < b.x1 && s.y > b.y0 && s.y < b.y1 && Math.sign(s.vx) === -d){ const dd = Math.abs(s.x - H.x); if (dd < bd){ bd = dd; bestE = { d, e: s }; } } }
    }
    return bestE;
  }
  function startAct(a){ act = a; actT = 0; mem = { X0: S.hero.x }; noise = a.k === 'walk' ? 0 : gauss() * timing; mode = 'act'; if (a.k === 'lift') res.lifts++; if (a.k === 'ride') res.rides++; }

  for (let st = 0; st < maxT * 60 && !S.over && !S.won; st++){
    if (opts.only && S.level !== (opts.level || 1)) break;
    const H = S.hero;
    if (S.phase !== 'play'){ mode = 'decide'; wait = 0.3; blow = null; step(0, 0, false); continue; }
    if (!A || A.LV !== S.LV || A.ver !== S.LV.ver){ A = navFor(L, S.LV); lastKey = ''; if (mode !== 'act') { mode = 'decide'; wait = reactT(); } }
    if (mode === 'act'){
      const inp = L.drive(act, actT, H, mem.X0, noise, mem); actT += dt;
      game.setInput(inp.dx, inp.dy, inp.jump); if (inp.lift && game.puff('down')) res.puffs++; game.update(dt);
      const f = L.finished(act, actT, H, mem);
      if (f){ mode = 'decide'; wait = reactT(); if (brng() < lapse) wait += 0.3 + brng() * 0.4; }
      continue;
    }
    if (mode === 'wander'){ wander -= dt; step(Math.floor(S.time) % 4 < 2 ? 1 : -1, 0, brng() < 0.03); if (wander <= 0) mode = 'decide'; continue; }
    if (mode === 'blow'){   // у горна/крыльчатки: повернуться и дуть, пока не разгорится
      wait -= dt;
      if (H.face !== blow.face){ step(blow.face * 1e-4, 0, false); continue; }
      if (wait > 0){ step(0, 0, false); continue; }
      const done = blow.kind === 'furn' ? S.heat[blow.obj.id] >= L.HEAT_NEED : !!S.spun[blow.obj.id];
      if (done || blow.n-- <= 0){ mode = 'decide'; wait = reactT(); blow = null; step(0, 0, false); continue; }
      const th = threat();
      if (th && th.d !== blow.face){ step(th.d * 1e-4, 0, false); game.puff(th.d); res.puffs++; blow.face0 = blow.face; continue; }
      game.setInput(0, 0, false); if (game.puff(blow.face)) res.puffs++; game.update(dt); wait = perfect ? L.PUFF_CD : L.PUFF_CD + 0.05 + brng() * 0.12; continue;
    }
    // decide
    if (wait > 0){ wait -= dt; step(0, 0, false); continue; }
    const here = nodeHere();
    if (!here){   // стоит «между узлами» или висит в потоке — шагнуть к ближайшей нормальной опоре
      let dx = 0;
      if (H.ground){ const r = Math.round(H.y), c = Math.floor(H.x);
        for (let k = 1; k <= 3 && !dx; k++){ if (A.nav.isNode(c - k, r)) dx = -1; else if (A.nav.isNode(c + k, r)) dx = 1; }
        if (!dx) dx = L.isSolid(S.LV, c, r) ? (L.isSolid(S.LV, c + 1, r) ? -1 : 1) : -1; }
      else if (H.up){   // в потоке: к ближайшей опоре на высоте тела, откуда ближе к цели
        const G = goals(), tg = (G.furn.length ? G.furn : G.vane).map(s => s.n), dist = tg.length ? field(A, tg) : new Map();
        let bd = Infinity; const c = Math.floor(H.x);
        for (let k = 1; k <= 4; k++) for (const s of [-1, 1]) for (let r = Math.floor(H.y); r <= Math.floor(H.y) + 2; r++){
          const n = r * S.LV.w + c + s * k; if (!A.nav.isNode(c + s * k, r)) continue;
          const d = (dist.has(n) ? dist.get(n) : 99) + k; if (d < bd){ bd = d; dx = s; } }
      }
      step(dx * 0.5, 0, false); continue;
    }
    const cx = here.c + 0.5;
    if (Math.abs(H.x - cx) > 1e-3){ step(L.clamp((cx - H.x) / (L.RUN * dt), -1, 1), 0, false); continue; }
    // обитатель рядом в зоне выдоха — сдуть (с задержкой реакции)
    const th = threat();
    if (th && Math.abs(th.e.x - H.x) < 3.2 && (unsafe(STAND) || Math.abs(th.e.x - H.x) < 2.2)){
      if (H.face !== th.d){ step(th.d * 1e-4, 0, false); continue; }
      wait = reactT() * 0.5; step(0, 0, false); if (game.puff(th.d)) res.puffs++; continue;
    }
    const G = goals();
    let list = G.furn, dist = list.length ? field(A, list.map(s => s.n)) : new Map();
    if (!dist.has(here.n) && G.vane.length){ list = G.vane; dist = field(A, list.map(s => s.n)); }
    const spot = list.find(s => s.n === here.n);
    if (spot){ mode = 'blow'; blow = { obj: spot.obj, kind: spot.kind, face: spot.face, n: 8 }; wait = reactT() * 0.5; continue; }
    const key = list.map(s => s.n).join(',') + ':' + S.LV.idx + ':' + S.LV.ver;
    if (key !== lastKey){ lastKey = key; best = Infinity; bestT = S.time; }
    const dHere = dist.has(here.n) ? dist.get(here.n) : Infinity;
    if (dHere < best - 0.3){ best = dHere; bestT = S.time; }
    if (S.time - bestT > 60){ if (opts.log) console.log('застрял L' + S.level, here.c, here.r); best = Infinity; bestT = S.time; mode = 'wander'; wander = 2 + brng() * 2; res.stuck = true; continue; }
    let bestE = null, bestC = Infinity;
    const cand = A.nav.edges(here.n);
    for (const e of cand){ const d2 = dist.get(e.to); if (d2 == null) continue; const c2 = cost(e) + d2; if (c2 < bestC){ bestC = c2; bestE = e; } }
    if (!bestE){ if (opts.log) console.log('нет хода L' + S.level, here.c, here.r); mode = 'wander'; wander = 1 + brng(); res.stuck = true; continue; }
    let a = L.ACTS[bestE.a];
    // ошибка исполнения: соседняя по длине задержка направления
    if (!perfect && (a.k === 'jump' || a.k === 'lift') && brng() < 0.03){
      const alt = L.ACTS.filter(q => q.k === a.k && q.d === a.d && q.delay === a.delay);
      a = alt[Math.max(0, Math.min(alt.length - 1, alt.indexOf(a) + (brng() < 0.5 ? -1 : 1)))];
    }
    if (unsafe(a)){
      const alt2 = cand.filter(e => e !== bestE && dist.has(e.to) && dist.get(e.to) < dHere - 0.1)
        .map(e => [cost(e) + dist.get(e.to), e]).filter(p => p[0] < bestC + 4).sort((p, q) => p[0] - q[0]);
      const ok2 = alt2.find(p => !unsafe(L.ACTS[p[1].a]));
      if (ok2 && waited > 0.3){ waited = 0; startAct(L.ACTS[ok2[1].a]); continue; }
      if (unsafe(STAND)){   // стоять тоже нельзя — уходим любым безопасным ходом (или подпрыгиваем)
        const alt = cand.filter(e => dist.has(e.to)).map(e => [cost(e) + dist.get(e.to), L.ACTS[e.a]]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
        alt.push(HOP);
        const ok = alt.find(q => !unsafe(q));
        if (ok){ waited = 0; startAct(ok); continue; }
      } else if (waited < (perfect ? 8 : 5)){ waited += dt; step(0, 0, false); continue; }
    }
    waited = 0;
    startAct(a);
  }
  res.time = S.time; res.won = S.won; res.over = S.over; res.level = S.level; res.deaths = S.deaths; res.kills = S.kills; res.score = S.score;
  return res;
}
