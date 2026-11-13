/* ЦЕПЬ · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса.
   Карту этажа знает (как игрок, видевший этаж), но управляет только как человек: setInput({dx,up,down,jump,atk,sub})
   и теми же приёмами, по которым строится граф проходимости (logic.simulate — прыжок/сход, лестницы, logic.rideCtl — маятник/подъёмник).
   Человеческие ограничения:
   - реакция: боевые решения раз в 150–250 мс (opts.react), между решениями держит прежние клавиши; часть решений «прозевает» (opts.miss);
   - место толчка — с ошибкой до ±0.04 клетки (граф прощает ±0.08);
   - бой: перебирает простые действия (стоять, присесть, шаг/прыжок вперёд/назад, удар, удар вверх, орудие, «по плану») и проверяет
     их той же физикой на 0.75 с вперёд (клон партии), выбирая выгодное; во время замаха цепи передумать нельзя.
   opts: { fi=0, route='A', react:[0.15,0.25], miss=0.12, dmgMul, maxT=420, god, lives, chain, sub, sparks, untilClear=true } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const NAV = new Map();
export function navFor(T, key){
  if (NAV.has(key)) return NAV.get(key);
  const L = T.logic, lv = T.build(key), nav = L.Nav(lv);
  const o = { lv, nav }; NAV.set(key, o); return o;
}
export function route(T, key){ const N = navFor(T, key), lv = N.lv; return N.nav.path(N.nav.startNode, u => u % lv.W > lv.gate.x + 2); }

// ---------- исполнитель ребра графа ----------
function compress(path){
  const out = [];
  for (const e of path){ const last = out[out.length - 1]; if (e.type === 'walk' && last && last.type === 'walk') last.to = e.to; else out.push(Object.assign({}, e)); }
  return out;
}
export function makeExec(T, lv, e, jit){ return { e, ph: 0, jit: jit || 0, ride: e.type === 'ride' ? { m: e.m, ph: 'go' } : null }; }
// → { inp, done, fail }
export function stepExec(T, lv, X, S){
  const L = T.logic, h = S.hero, e = X.e, W = lv.W, sgn = Math.sign;
  const cx = u => (u % W) + 0.5, ry = u => Math.floor(u / W);
  const node = () => L.nodeOf(lv, h);
  if (e.type === 'walk'){
    const tx = cx(e.to);
    if (!h.ground) return { inp: {} };
    if (Math.abs(h.x - tx) < 0.1 && Math.abs(h.y - ry(e.to)) < 0.01) return { inp: {}, done: true };
    if (Math.abs(h.y - ry(e.to)) > 0.01) return { inp: {}, fail: true };
    return { inp: { dx: sgn(tx - h.x) } };
  }
  if (e.type === 'jump'){
    if (X.ph === 0){
      if (!h.ground) return { inp: {} };
      const sx = e.sx + X.jit;
      if (Math.abs(h.x - sx) <= 0.035) { X.ph = 1; return { inp: { dx: e.d, jump: true } }; }
      return { inp: { dx: sgn(sx - h.x) } };
    }
    if (X.ph === 1){ if (!h.ground) { X.ph = 2; return { inp: { dx: e.d } }; } if ((X.k = (X.k || 0) + 1) > 2) { X.ph = 0; X.k = 0; } return { inp: {} }; }
    if (h.ground){ const v = node(); return v === e.to ? { inp: {}, done: true } : { inp: {}, fail: true }; }
    return { inp: {} };
  }
  if (e.type === 'drop'){
    if (X.ph === 0){ if (!h.ground) X.ph = 1; return { inp: { dx: e.d } }; }
    if (h.ground){ const v = node(); return v === e.to ? { inp: {}, done: true } : { inp: {}, fail: true }; }
    return { inp: {} };
  }
  if (e.type === 'stair'){
    const s = lv.stairs[e.s], px = e.up ? s.bx : s.tx;
    if (X.ph === 0){
      if (h.stair){ X.ph = 1; }
      else {
        if (!h.ground) return { inp: {} };
        if (Math.abs(h.x - px) > 0.8) return { inp: { dx: sgn(px - h.x) } };
        return { inp: e.up ? { up: true } : { down: true } };
      }
    }
    if (h.stair) return { inp: e.up ? { up: true } : { down: true } };
    if (h.ground){ const v = node(); return v === e.to ? { inp: {}, done: true } : { inp: {}, fail: true }; }
    return { inp: {} };
  }
  if (e.type === 'ride'){
    const Wd = { lv, t: S.t, gate: S.gateClosed, chain: S.chain };
    const inp = L.rideCtl(lv, X.ride, S, Wd);
    if (X.ride.ph === 'done') return { inp: {}, done: true };
    if (X.ride.ph === 'fail') return { inp: {}, fail: true };
    return { inp };
  }
  return { inp: {}, fail: true };
}

const CANDS = [
  { id: 'plan' }, { id: 'stand', inp: {} }, { id: 'crouch', inp: { down: true } },
  { id: 'fwd', inp: { dx: 'f' } }, { id: 'back', inp: { dx: 'b' } },
  { id: 'jumpF', inp: { dx: 'f', jump: 1 } }, { id: 'jumpB', inp: { dx: 'b', jump: 1 } }, { id: 'jumpU', inp: { jump: 1 } },
  { id: 'atk', inp: { atk: 1 } }, { id: 'atkT', inp: { dx: 't', atk: 2 } }, { id: 'uatk', inp: { up: true, atk: 1 } }, { id: 'jatk', inp: { dx: 't', jump: 1, atk: 8 } },
  { id: 'sub', inp: { sub: 1 } }, { id: 'crAtk', inp: { down: true, atk: 1 } }
];

export function playFloor(T, seed, opts = {}){
  const L = T.logic, K = L.K, brng = mulberry32(seed * 7919 + 17), dt = 1 / 60;
  const [r0, r1] = opts.react || [0.15, 0.25], missP = opts.miss == null ? 0.12 : opts.miss, maxT = opts.maxT || 420;
  const res = { seed, fi: opts.fi || 0, cleared: false, over: false, deaths: 0, why: {}, t: 0, stuck: false, bossT: null, hpLost: 0, kills: 0 };
  let bossAt = 0, S = null;
  const game = T.Game({ rng: mulberry32(seed), dmgMul: opts.god ? 0 : opts.dmgMul, onEvent: (t, d) => {
    if (t === 'die'){ res.deaths++; res.why[d.why] = (res.why[d.why] || 0) + 1; (res.at = res.at || []).push(d.why + '@' + d.x.toFixed(1) + ',' + d.y.toFixed(1) + (ex ? ':' + ex.e.type : '') + (commit ? ':' + commit.c.id : '')); }
    if (t === 'respawn'){ ex = null; plan = null; commit = null; }
    if (t === 'bossIntro') bossAt = S.time;
    if (t === 'kill') res.kills++;
    if (t === 'clear'){ res.cleared = true; res.bossT = +(S.time - bossAt).toFixed(1); res.route = d.route; }
    if (t === 'win'){ res.cleared = true; res.won = true; res.bossT = +(S.time - bossAt).toFixed(1); }
    if (t === 'continueQ' || t === 'gameover') res.over = true;
  } }).start();
  S = game.state();
  const fi = opts.fi || 0, rt = opts.route || 'A';
  game._floor(fi, fi > T.BRANCH ? rt : null);
  if (opts.lives) S.lives = opts.lives;
  if (opts.chain) S.chain = opts.chain;
  if (opts.sub) S.sub = opts.sub;
  if (opts.sparks != null) S.sparks = opts.sparks;
  if (opts.noFoes){ S.enemies = []; S.nests = []; }
  const N = navFor(T, S.key), lv = N.lv;
  let plan = null, ex = null, commit = null, wait = 0, cur = {}, lastNode = -1, stuckT = 0, lastX = 0;
  const react = () => r0 + brng() * (r1 - r0);
  const jitter = () => (brng() - 0.5) * 0.08;

  function goalFn(u){ return u % lv.W > lv.gate.x + 2; }
  function replan(){
    const u = L.nodeOf(lv, S.hero); if (u < 0) return false;
    const p = N.nav.path(u, goalFn); if (!p) return false;
    plan = compress(p); ex = plan.length ? makeExec(T, lv, plan.shift(), jitter()) : null; return true;
  }
  // «по плану» без клона: исполнитель пути / в бою — сближение со стражем / после стража — к выходу
  function planInput(Sx, exx){
    const h = Sx.hero;
    if (Sx.bossState === 'fight' || Sx.bossState === 'intro'){
      const b = Sx.boss; if (!b) return {};
      const side = Math.sign(b.x - h.x) || 1, reach = K.REACH[Sx.chain] * 0.75;
      let tx = b.x - side * (reach + b.w / 2);
      // маховик: ждать у стены, куда он врежется (оглушён — бить)
      if (b.k === 'flywheel' && b.st !== 'stun') tx = h.x > b.cx ? b.ax1 - 3.3 : b.ax0 + 3.3;
      if (Math.abs(h.x - tx) > 0.3) return { dx: Math.sign(tx - h.x) };
      return { dx: 0 };
    }
    if (Sx.bossState === 'dead'){
      let tx = null;
      if (Sx.doorsOn){ const d = Sx.doors.find(q => q.route === (opts.route || 'A')) || Sx.doors[0]; tx = d.x; }
      else { const c = Sx.items.find(i => i.k === 'core'); if (c) tx = c.x; }
      if (tx == null) return {};
      if (!h.ground) return {};
      return { dx: Math.abs(tx - h.x) > 0.2 ? Math.sign(tx - h.x) : 0 };
    }
    if (!exx) return {};
    const r = stepExec(T, lv, exx, Sx);
    return r.inp || {};
  }
  function nearThreat(){
    const h = S.hero;
    if (S.bossState === 'fight' || S.bossState === 'intro') return true;
    for (const e of S.enemies) if (e.act && Math.abs(e.x - h.x) < 7 && Math.abs(e.y - h.y) < 5) return true;
    for (const q of S.eshots) if (Math.abs(q.x - h.x) < 8 && Math.abs(q.y - h.y) < 6) return true;
    for (let i = 0; i < lv.lamps.length; i++) if (S.lampsOn[i] && Math.abs(lv.lamps[i].x - h.x) < 2.2 && lv.lamps[i].y < h.y && lv.lamps[i].y > h.y - 2.4) return true;
    return false;
  }
  function faceTo(Sx){ const h = Sx.hero, tgt = target(Sx); return tgt ? (Math.sign(tgt.x - h.x) || h.face) : h.face; }
  function resolve(c, Sx, f, tf){
    if (tf == null) tf = faceTo(Sx);
    const o = {}; const ci = c.inp;
    for (const k in ci){
      if (k === 'dx') o.dx = ci.dx === 'f' ? tf : ci.dx === 'b' ? -tf : ci.dx === 't' ? (f < 2 ? tf : 0) : ci.dx;
      else if (k === 'jump') o.jump = f === 0;
      else if (k === 'atk') o.atk = f === ci.atk;
      else if (k === 'sub') o.sub = f === 1;
      else o[k] = ci[k];
    }
    if (ci.sub && f === 0) o.dx = tf;
    return o;
  }
  function target(Sx){
    const h = Sx.hero; let best = null, bd = 1e9;
    if (Sx.boss && Sx.bossState === 'fight') return { x: Sx.boss.x, y: Sx.boss.y };
    for (const e of Sx.enemies){ if (!e.act) continue; const d = Math.abs(e.x - h.x) + Math.abs(e.y - h.y); if (d < bd){ bd = d; best = e; } }
    return best && bd < 8 ? best : null;
  }
  function value(g2){ const s = g2.state(); let v = 0; for (const e of s.enemies) v += e.hp; if (s.boss && s.bossState === 'fight') v += s.boss.hp * 1.5; return v; }
  function evalCand(c){
    const g2 = game.clone(), s2 = g2.state(), hp0 = s2.hp, v0 = value(g2), lamps0 = s2.lampsOn.reduce((a, b) => a + b, 0);
    let exx = c.id === 'plan' && ex ? JSON.parse(JSON.stringify(ex)) : null, firstHit = 99; const tf = faceTo(s2);
    const n = 45;
    for (let f = 0; f < n; f++){
      const inp = c.id === 'plan' ? planInput(s2, exx) : resolve(c, s2, f, tf);
      g2.setInput(inp); g2.update(dt);
      if (s2.hp < hp0 && firstHit === 99) firstHit = f;
      if (s2.phase !== 'play') break;
    }
    // в воздухе — досмотреть до приземления (пропасть)
    for (let f = 0; f < 120 && s2.phase === 'play' && !s2.hero.ground && !s2.hero.stair; f++){ g2.setInput({}); g2.update(dt); }
    const lost = hp0 - s2.hp, dead = s2.phase === 'dead' || s2.phase === 'cont' || s2.phase === 'over';
    const dealt = v0 - value(g2), lamps = lamps0 - s2.lampsOn.reduce((a, b) => a + b, 0);
    let sc = dealt * 3 + lamps * 0.6 - lost * 5 - (dead ? 1000 : 0) + (firstHit < 99 ? firstHit * 0.02 : 0);
    if (c.id === 'plan') sc += 0.4;
    if (c.id === 'sub' && dealt <= 0) sc -= 2;
    return sc;
  }

  let t = 0;
  while (t < maxT){
    t += dt; res.t = t;
    if (S.phase === 'clear' || S.phase === 'won'){ if (!opts.untilNext) break; }
    if (S.phase === 'cont' || S.phase === 'over'){ res.over = true; break; }
    if (S.phase === 'dead'){ game.setInput({}); game.update(dt); continue; }
    const h = S.hero;
    // путь
    if (S.bossState === 'none'){
      if (!ex && h.ground && h.on >= 0){
        const m = lv.mov[h.on]; ex = makeExec(T, lv, { type: 'ride', m: m.id, to: m.to[1] * lv.W + m.to[0] }, 0); ex.ride.ph = 'ride';
      } else if (!ex && h.ground && !h.stair) replan();
      else if (!ex && h.stair){
        // сошли с плана посреди лестницы — дойти до того конца, откуда ближе к цели
        const s = lv.stairs[h.stair.i], bn = L.pointNode(lv, s.bx, s.by), tn = L.pointNode(lv, s.tx, s.ty);
        const cost = u => { const p = N.nav.path(u, goalFn); return p ? p.reduce((a, e) => a + e.w, 0) : 1e9; };
        const up = cost(tn) <= cost(bn);
        ex = makeExec(T, lv, { type: 'stair', s: h.stair.i, up, to: up ? tn : bn }, 0); ex.ph = 1;
      }
    } else { ex = null; plan = null; }
    let inp;
    wait -= dt;
    const busy = h.atk || (ex && ex.e.type === 'ride' && ex.ride.ph !== 'go' && ex.ride.ph !== 'wait');
    if (commit){
      inp = resolve(commit.c, S, commit.f++, commit.tf);
      if (commit.f > commit.n || (commit.f > 3 && h.ground && !h.atk && commit.c.inp.jump)) { commit = null; ex = null; }
    } else if (wait <= 0 && !busy && !(ex && ex.ph > 0 && ex.e.type !== 'walk') && nearThreat()){
      wait = react();
      if (brng() >= missP){
        let best = null, bs = -1e9;
        for (const c of CANDS){
          if (c.id === 'sub' && (!S.sub || S.sparks < L.SUB[S.sub].cost)) continue;
          if (h.stair && c.inp && (c.inp.jump || c.inp.dx === 'b')) continue;
          const sc = evalCand(c); if (sc > bs){ bs = sc; best = c; }
        }
        if (opts.trace) opts.trace({ t, best: best && best.id, bs, x: S.hero.x, b: S.boss && { st: S.boss.st, x: S.boss.x, y: S.boss.y, hp: S.boss.hp } });
        if (best && best.id !== 'plan'){ commit = { c: best, f: 0, tf: faceTo(S), n: best.inp.jump ? 50 : best.inp.atk || best.inp.sub ? 20 : Math.round(react() * 60) }; inp = resolve(best, S, commit.f++, commit.tf); }
      }
    }
    if (!inp){
      if (S.bossState !== 'none') inp = planInput(S, null);
      else if (ex){
        const r = stepExec(T, lv, ex, S);
        inp = r.inp;
        if (r.done){ ex = plan && plan.length ? makeExec(T, lv, plan.shift(), jitter()) : null; }
        if (r.fail){ ex = null; plan = null; }
      } else inp = {};
    }
    cur = inp;
    if (opts.frame) opts.frame(S, ex, commit, inp);
    game.setInput(cur); game.update(dt);
    // зависание
    if (Math.abs(S.hero.x - lastX) > 0.05 || S.bossState !== 'none'){ lastX = S.hero.x; stuckT = 0; } else if ((stuckT += dt) > 8){ res.stuck = true; ex = null; plan = null; stuckT = 0; }
  }
  res.hp = S.hp; res.score = S.score; res.lives = S.lives;
  return res;
}
