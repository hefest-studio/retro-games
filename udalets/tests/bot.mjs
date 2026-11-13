/* УДАЛЕЦ · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса.
   Карту уровня знает (как игрок, прошедший уровень разок), но управляет только как человек:
   setInput(dx, dy, jump), fire(), jet() — по тем же «макросам» движения, из которых строится граф (logic.ACTS),
   и перелётам на ранце по клеткам (рёбра flights).
   Человеческие ограничения:
   - реакция: каждое решение через 150–250 мс после приземления; иногда «засматривается» (lapse);
   - время удержания направления в прыжке — с ошибкой ±timing с (прыжок выходит короче/длиннее);
   - обитателей предугадывает «на глаз»: на новом экране часть замечает с опозданием ~0,6 с (miss), ждёт, пока путь освободится, но не дольше ~5 с;
   - стреляет в обитателя, который мешает пройти, — тоже с задержкой реакции.
   opts: { react:[0.15,0.25], timing=0.035, lapse=0.06, miss=0.15, perfect=false, god=false, level=1, maxT=1500, only=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// навигация по уровню: граф + обратные рёбра (наземные и перелёты отдельно) + кэш полей расстояний
const NAVS = new WeakMap();
function navFor(L, LV){
  if (NAVS.has(LV.def)) return NAVS.get(LV.def);
  const nav = L.Nav(LV), W = LV.w, revG = new Map(), revF = new Map(), nodes = [];
  for (let r = 0; r < LV.h; r++) for (let c = 0; c < W; c++) if (nav.isNode(c, r)) nodes.push(r * W + c);
  const add = (m, e, from) => { if (!m.has(e.to)) m.set(e.to, []); m.get(e.to).push({ from, e }); };
  // «рискованный» прыжок: при ошибке удержания ±0,05 с герой задевает шипы/огонь/кислоту или промахивается мимо
  // опоры (приземляется не туда) — человек такого избегает, если есть путь надёжнее
  const risky = (n, e) => {
    const a = L.ACTS[e.a]; if (a.k !== 'jump') return 0;
    for (const nz of [-0.05, 0.05]){
      const H = L.newHero(n % W, Math.floor(n / W)), X0 = H.x; let t = 0, f = null;
      for (let i = 0; i < 240 && !f; i++){ L.heroStep(LV, H, L.drive(a, t, H, X0, nz), L.STEP); t += L.STEP; if (L.hazardHit(LV, H)) return 1; f = L.finished(a, t, H, { X0 }); }
      if (f !== 'ok' || L.nodeOf(LV, H) !== e.to) return 1;
    }
    return 0;
  };
  nodes.forEach(n => { nav.edges(n).forEach(e => { if (e.risk == null) e.risk = risky(n, e); add(revG, e, n); }); nav.flights(n).forEach(e => add(revF, e, n)); });
  const o = { nav, revG, revF, fields: new Map(), LV };
  NAVS.set(LV.def, o); return o;
}
// jet — топливо, которым можно распорядиться (0 — ранца нет): перелёты дороже запаса в поле не входят
function field(A, target, jet){
  jet = jet ? Math.floor(jet / 5) * 5 : 0;
  const key = target + ':' + jet;
  if (A.fields.has(key)) return A.fields.get(key);
  const dist = new Map([[target, 0]]), heap = [[0, target]];
  const pop = () => { let b = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[b][0]) b = i; return heap.splice(b, 1)[0]; };
  while (heap.length){
    const [d, n] = pop(); if (d > dist.get(n)) continue;
    const lists = [A.revG.get(n) || []]; if (jet) lists.push(A.revF.get(n) || []);
    for (const l of lists) for (const { from, e } of l){
      if (e.fly && e.fuel + MARGIN > jet) continue;
      const nd = d + e.t + (e.fly ? 1.5 : 0.25) + (e.risk ? 3 : 0);
      if (nd < (dist.has(from) ? dist.get(from) : Infinity)){ dist.set(from, nd); heap.push([nd, from]); }
    }
  }
  A.fields.set(key, dist); return dist;
}

const MARGIN = 8, STAND = { k: 'stand' }, HOP = { k: 'jump', d: 0, hold: 0, delay: 0 };
export function playUdalets(U, seed, opts = {}){
  const L = U.logic, dt = 1 / 60, JS = L.JS;
  const perfect = !!opts.perfect, brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const timing = perfect ? 0 : (opts.timing == null ? 0.035 : opts.timing);
  const lapse = perfect ? 0 : (opts.lapse == null ? 0.06 : opts.lapse);
  const missP = perfect ? 0 : (opts.miss == null ? 0.15 : opts.miss);
  const maxT = opts.maxT || 1500;
  const res = { seed, won: false, level: 1, cleared: 0, deaths: 0, why: {}, kills: 0, shots: 0, time: 0, score: 0, stuck: false, over: false, flights: 0, bonus: 0, restarts: 0, log: [] };
  const game = U.Game({ rng: mulberry32(seed), god: !!opts.god, level: opts.level || 1, onEvent: (t, d) => {
    if (t === 'die'){ res.why[d.why] = (res.why[d.why] || 0) + 1; res.log.push(d.level + (d.k || d.why)); }
    if (t === 'clear') res.cleared++;
    if (t === 'warp') res.bonus++;
  } }).start();
  const S = game.state();
  let seen = new WeakMap();
  // внимание: обитателя на новом экране иногда «проморгал» — замечает его только через ~0,6 с
  let seenRoom = -1;
  const noticed = e => {
    if (S.room !== seenRoom){ seenRoom = S.room; seen = new WeakMap(); }
    let s = seen.get(e); if (!s){ s = { t: S.time, miss: brng() < missP }; seen.set(e, s); }
    return !s.miss || S.time - s.t > 0.6;
  };
  const reactT = () => perfect ? 0.03 : r0 + brng() * (r1 - r0);
  let mode = 'decide', wait = reactT(), act = null, actT = 0, mem = null, noise = 0, waited = 0;
  let noMove = 0, curLV = null, A = null, lastKey = '', best = Infinity, bestT = 0, wander = 0;

  function goal(){
    const LV = S.LV;
    if (LV.bonus) return A.LV.exit.r * LV.w + LV.exit.c;
    const want = k => LV.items.find(i => i.k === k && !S.got[i.id]);
    const g = !S.gun && want('G'), j = !S.jetOwned && want('J');
    for (const it of [g, j]) if (it){ const n = A.nav.itemNode(it); if (n != null) return n; }
    // мало топлива — сначала канистра (ближайшая достижимая)
    const main = !S.cup ? A.nav.itemNode(LV.cup) : LV.exit.r * LV.w + LV.exit.c, h0 = nodeHere();
    if (S.jetOwned && (S.fuel < 45 || (h0 && !field(A, main, S.fuel).has(h0.n)))){
      const here = nodeHere(); let bf = null, bd = Infinity;
      if (here) LV.items.forEach(it => { if (it.k !== 'F' || S.got[it.id]) return; const n = A.nav.itemNode(it); if (n == null) return;
        const d = field(A, n, S.fuel).get(here.n); if (d != null && d < bd){ bd = d; bf = n; } });
      if (bf != null) return bf;
    }
    return main;
  }
  function nodeHere(){
    const H = S.hero; if (!H.ground || H.jet) return null;
    const n = L.nodeOf(S.LV, H); if (n == null) return null;
    return { n, c: n % S.LV.w, r: Math.floor(n / S.LV.w) };
  }
  // «на глаз»: прогон действия вперёд вместе с обитателями экрана — заденут ли
  function unsafe(a, path, horizon){
    if (S.inv > 0.6) return false;
    const LV = S.LV, H = Object.assign({}, S.hero), X0 = H.x;
    const ens = S.enemies.filter(e => e.alive && e.room === S.room && noticed(e)).map(e => Object.assign({}, e));
    const shots = S.eshots.map(b => Object.assign({}, b));
    if (!ens.length && !shots.length) return false;
    const m = { X0, i: 0, path }; let t = 0;
    for (let k = 0; k < (horizon || 150); k++){
      let inp;
      if (path){ inp = flyDrive(H, m); if (!inp) break; H.jet = true; }
      else inp = L.drive(a, t, H, X0, 0);
      L.heroStep(LV, H, inp, dt); t += dt;
      for (const e of ens) { L.enemyStep(LV, e, dt, H, shots); if (L.heroTouches(H, L.enemyBox(e), 0.25)) return true; }
      for (const b of shots){ L.shotStep(LV, b, dt); if (b.alive && L.heroTouches(H, { x0: b.x - 0.15, x1: b.x + 0.15, y0: b.y - 0.15, y1: b.y + 0.15 }, 0.2)) return true; }
      if (!path && L.finished(a, t, H, m)) { if (t > 0.5) break; }
    }
    // и постоять ещё полсекунды на месте приземления
    for (let k = 0; k < 30; k++){
      for (const e of ens) { L.enemyStep(LV, e, dt, H, shots); if (L.heroTouches(H, L.enemyBox(e), 0.25)) return true; }
    }
    return false;
  }
  function flyDrive(H, m){
    if (m.i >= m.path.length) return null;
    const [c, y] = m.path[m.i], tx = c + 0.5;
    const dx = L.clamp((tx - H.x) / (JS * dt), -1, 1), dy = L.clamp((y - H.y) / (JS * dt), -1, 1);
    if (Math.abs(tx - H.x) < 1e-3 && Math.abs(y - H.y) < 1e-3){ m.i++; return flyDrive(H, m); }
    return { dx: Math.abs(dx) < 1e-6 ? 0 : dx, dy: Math.abs(dy) < 1e-6 ? 0 : dy, jump: false };
  }
  // мешающий обитатель на линии огня
  function target(){
    const H = S.hero, hy = H.y - 0.85;
    let bestE = null, bd = 99;
    for (const e of S.enemies){
      if (!e.alive || e.room !== S.room || !noticed(e)) continue;
      const bx = L.enemyBox(e); if (hy < bx.y0 - 0.15 || hy > bx.y1 + 0.15) continue;
      const d = Math.abs(e.x - H.x); if (d > 11 || d < 0.6) continue;
      let clear = true; const s = Math.sign(e.x - H.x);
      for (let x = H.x; Math.abs(x - e.x) > 0.5; x += s * 0.5) if (L.isSolid(S.LV, Math.floor(x), Math.floor(hy))) { clear = false; break; }
      if (clear && d < bd){ bd = d; bestE = e; }
    }
    return bestE;
  }

  for (let step = 0; step < maxT * 60 && !S.over && !S.won; step++){
    if (opts.only && S.level !== (opts.level || 1)) break;
    const H = S.hero;
    if (S.phase !== 'play'){ mode = 'decide'; wait = 0.3; game.setInput(0, 0, false); game.update(dt); continue; }
    if (S.LV !== curLV){ curLV = S.LV; A = navFor(L, curLV); lastKey = ''; mode = 'decide'; wait = reactT(); }
    if (mode === 'act'){
      if (act.k === 'fly'){
        const inp = flyDrive(H, mem);
        if (!H.jet){ mode = 'decide'; wait = reactT(); game.setInput(0, 0, false); game.update(dt); continue; }   // кончилось топливо
        if (!inp){ game.jet(); mode = 'land'; game.setInput(0, 0, false); game.update(dt); continue; }
        // перед посадкой — посмотреть, не ждёт ли внизу обитатель; если да — повисеть (или выстрелить)
        if ((mem.hold || 0) < 3 && S.fuel > (mem.path.length - mem.i) / JS * L.FUEL_DRAIN + 8 && (mem.hold || (step % 6 === 0)) && unsafe(null, mem.path.slice(mem.i), 50)){
          mem.hold = (mem.hold || 0) + dt;
          const tg2 = S.gun && S.ammo > 0 && mem.hold > 0.2 ? target() : null;
          if (tg2 && H.face === Math.sign(tg2.x - H.x) && game.fire()) res.shots++;
          else if (tg2) { game.setInput(Math.sign(tg2.x - H.x) * 1e-4, 0, false); game.update(dt); continue; }
          game.setInput(0, 0, false); game.update(dt); continue;
        }
        game.setInput(inp.dx, inp.dy, false); game.update(dt); continue;
      }
      const inp = L.drive(act, actT, H, mem.X0, noise); actT += dt;
      game.setInput(inp.dx, inp.dy, inp.jump); game.update(dt);
      const f = L.finished(act, actT, H, mem);
      if (f){ mode = 'decide'; wait = reactT(); if (brng() < lapse) wait += 0.3 + brng() * 0.4; }
      continue;
    }
    if (mode === 'land'){ game.setInput(0, 0, false); game.update(dt); if (H.ground){ mode = 'decide'; wait = reactT(); } continue; }
    if (mode === 'wander'){ wander -= dt; game.setInput(Math.floor(S.time) % 4 < 2 ? 1 : -1, 0, brng() < 0.03); game.update(dt); if (wander <= 0) mode = 'decide'; continue; }
    if (mode === 'aim'){ wait -= dt; game.setInput(0, 0, false); game.update(dt); if (wait <= 0){ if (game.fire()) res.shots++; mode = 'decide'; wait = 0.1; } continue; }
    // decide
    if (wait > 0){ wait -= dt; game.setInput(0, 0, false); game.update(dt); continue; }
    if (H.jet){ game.jet(); mode = 'land'; continue; }
    const here = nodeHere();
    if (!here){   // стоит «между узлами» (край опоры у шипов и т. п.) — шагнуть к ближайшей нормальной опоре
      let dx = 0;
      if (H.ground){ const r = Math.round(H.y), c = Math.floor(H.x);
        for (let k = 1; k <= 3 && !dx; k++){ if (A.nav.isNode(c - k, r)) dx = -1; else if (A.nav.isNode(c + k, r)) dx = 1; }
        if (!dx) dx = L.isSolid(S.LV, c, r) ? (L.isSolid(S.LV, c + 1, r) ? -1 : 1) : -1; }   // нет рядом — сойти с края вниз
      game.setInput(dx * 0.5, 0, false); game.update(dt); continue;
    }
    const cx = here.c + 0.5;
    if (Math.abs(H.x - cx) > 1e-3){ game.setInput(L.clamp((cx - H.x) / (L.RUN * dt), -1, 1), 0, false); game.update(dt); continue; }
    const tg = goal(), jet = S.jetOwned ? S.fuel : 0, dist = field(A, tg, jet), key = tg + ':' + Math.floor(jet / 5) + ':' + S.LV.idx;
    if (key !== lastKey){ lastKey = key; best = Infinity; bestT = S.time; }
    const dHere = dist.has(here.n) ? dist.get(here.n) : Infinity;
    if (dHere < best - 0.3){ best = dHere; bestT = S.time; }
    if (S.time - bestT > 60){ if (opts.log) console.log('застрял', here.c, here.r, 'цель', tg % S.LV.w, Math.floor(tg / S.LV.w), 'топливо', S.fuel.toFixed(1)); best = Infinity; bestT = S.time; mode = 'wander'; wander = 2 + brng() * 2; res.stuck = true; continue; }
    let bestE = null, bestC = Infinity;
    const cand = A.nav.edges(here.n).concat(jet ? A.nav.flights(here.n).filter(e => e.fuel + MARGIN <= Math.floor(jet / 5) * 5) : []);
    for (const e of cand){
      const d2 = dist.get(e.to); if (d2 == null) continue;
      const cost = e.t + d2 + (e.fly ? 1.5 : 0.25) + (e.risk ? 3 : 0);
      if (cost < bestC){ bestC = cost; bestE = e; }
    }
    if (!bestE){   // хода нет (топливо кончилось не там) — как человек: «Заново уровень» из паузы (−1 жизнь)
      if (opts.log) console.log('нет хода', 'L' + S.level, here.c, here.r, 'цель', tg % S.LV.w, Math.floor(tg / S.LV.w), 'топливо', S.fuel.toFixed(1), 'dHere', dHere);
      noMove += dt; if (noMove > 2){ noMove = 0; res.restarts++; res.log.push(S.level + 'restart'); game.restartLevel(); continue; }
      game.setInput(0, 0, false); game.update(dt); continue;
    }
    noMove = 0;
    let a = bestE.fly ? { k: 'fly' } : L.ACTS[bestE.a];
    // ошибка исполнения: соседняя по длине задержка направления
    if (!perfect && a.k === 'jump' && brng() < 0.03){
      const alt = L.ACTS.filter(q => q.k === 'jump' && q.d === a.d && q.delay === a.delay);
      a = alt[Math.max(0, Math.min(alt.length - 1, alt.indexOf(a) + (brng() < 0.5 ? -1 : 1)))];
    }
    if (unsafe(a, bestE.fly ? bestE.path : null)){
      const tgt = S.gun && S.ammo > 0 ? target() : null;
      if (tgt){   // мешает — стреляем (с задержкой реакции)
        const s = Math.sign(tgt.x - H.x);
        if (H.face !== s){ game.setInput(s * 1e-4, 0, false); game.update(dt); continue; }
        mode = 'aim'; wait = reactT() * 0.6; waited = 0; continue;
      }
      // другой путь почти той же длины, который сейчас безопасен
      const alt2 = cand.filter(e => e !== bestE && dist.has(e.to) && dist.get(e.to) < dHere - 0.1 && (!e.fly || e.fuel + MARGIN <= S.fuel))
        .map(e => [e.t + dist.get(e.to) + (e.fly ? 1.5 : 0.25) + (e.risk ? 3 : 0), e]).filter(p => p[0] < bestC + 4).sort((p, q) => p[0] - q[0]);
      const ok2 = alt2.find(p => !unsafe(p[1].fly ? { k: 'fly' } : L.ACTS[p[1].a], p[1].fly ? p[1].path : null));
      if (ok2 && waited > 0.3){
        const e2 = ok2[1]; waited = 0;
        if (e2.fly){ if (!H.jet && !game.jet()) continue; act = { k: 'fly' }; mem = { i: 1, path: e2.path }; mode = 'act'; res.flights++; continue; }
        act = L.ACTS[e2.a]; actT = 0; mem = { X0: H.x }; noise = gauss() * timing; mode = 'act'; continue;
      }
      if (unsafe(STAND)){   // стоять тоже нельзя — уходим любым безопасным ходом (или подпрыгиваем)
        const alt = cand.filter(e => !e.fly && dist.has(e.to)).map(e => [e.t + dist.get(e.to) + (e.risk ? 3 : 0), L.ACTS[e.a]]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
        alt.push(HOP);
        const ok = alt.find(q => !unsafe(q));
        if (ok){ act = ok; actT = 0; mem = { X0: H.x }; noise = gauss() * timing; mode = 'act'; waited = 0; continue; }
      } else if (waited < (perfect ? 8 : 5)){ waited += dt; game.setInput(0, 0, false); game.update(dt); continue; }
    }
    waited = 0;
    if (opts.log > 1) console.log('ход', S.time.toFixed(2), a.k, a.d, a.hold, a.delay, 'inv', S.inv.toFixed(2), 'unsafe', unsafe(a, bestE.fly ? bestE.path : null), 'видит', S.enemies.filter(e => e.alive && e.room === S.room).map(e => e.k + (noticed(e) ? '+' : '-') + e.x.toFixed(1) + ',' + e.y.toFixed(1)).join(' '), 'noise', noise.toFixed(3));
    if (a.k === 'fly'){ if (!H.jet && !game.jet()){ mode = 'wander'; wander = 0.5; continue; } act = a; mem = { i: 1, path: bestE.path }; mode = 'act'; res.flights++; continue; }
    act = a; actT = 0; mem = { X0: H.x }; noise = gauss() * timing; mode = 'act';
  }
  res.time = S.time; res.won = S.won; res.over = S.over; res.level = S.level; res.deaths = S.deaths; res.kills = S.kills; res.score = S.score;
  return res;
}
