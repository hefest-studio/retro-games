/* ДОСПЕХ · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса.
   Карту уровня знает (как игрок, видевший уровень), но управляет только как человек: setInput({dx,up,down,jump,fire})
   и теми же приёмами, по которым строится граф проходимости (logic.simulate — прыжок/сход с края, лестница, logic.rideCtl — плот).
   Человеческие ограничения:
   - реакция: решения раз в 150–250 мс (opts.react); между решениями держит прежние клавиши;
   - место толчка — с ошибкой до ±0.04 клетки сверх шага кадра (граф прощает ±0.08);
   - врагов замечает не всех (opts.miss), угрозу (снаряд, пике, прыжок стража) замечает с вероятностью opts.dodge;
     уворачивается, перебирая простые действия (стоять, шаг влево/вправо, присесть, прыжок) и проверяя их той же физикой;
   - бросает «тапами» не чаще раза в 0.15 с; особый удар в золотом доспехе — иногда (opts.chargeP).
   opts: { level=0, loop=1, lives, react:[0.15,0.25], miss=0.15, dodge=0.75, chargeP=0.2, dmgMul, maxT=500 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const NAV = new Map();
export function navFor(D, idx){
  if (NAV.has(idx)) return NAV.get(idx);
  const L = D.logic, lv = D.build(idx), nav = L.Nav(lv);
  const goals = [...nav.set].filter(id => id % lv.W > lv.arena.x0 + 3);
  const dist = nav.field(goals);
  const o = { lv, nav, goals, dist }; NAV.set(idx, o); return o;
}

const OPTS = [
  { dx: 0 }, { dx: -1 }, { dx: 1 }, { dx: 0, down: true }, { dx: 0, jump: true }, { dx: -1, jump: true }, { dx: 1, jump: true }
];

export function playLevel(D, seed, opts = {}){
  const L = D.logic, brng = mulberry32(seed * 7919 + 17);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const missP = opts.miss == null ? 0.15 : opts.miss, dodgeP = opts.dodge == null ? 0.75 : opts.dodge, chargeP = opts.chargeP == null ? 0.2 : opts.chargeP;
  const maxT = opts.maxT || 500, idx = opts.level || 0, dt = 1 / 60;
  const res = { seed, level: idx, cleared: false, over: false, deaths: 0, why: {}, t: 0, stuck: false, armorLost: 0, bossT: null };
  let S = null, bossAt = 0;
  const game = D.Game({ rng: mulberry32(seed), dmgMul: opts.dmgMul, onEvent: (t, d) => {
    if (t === 'die'){ res.deaths++; res.why[d.why] = (res.why[d.why] || 0) + 1; (res.at = res.at || []).push(d.why + '@' + d.x.toFixed(1)); }
    if (t === 'armorOff') res.armorLost++;
    if (t === 'respawn'){ plan = null; bestT = S.time; best = Infinity; }
    if (t === 'bossIntro') bossAt = S.time;
    if (t === 'clear'){ res.cleared = true; res.bossT = +(S.time - bossAt).toFixed(1); }
    if (t === 'continueQ' || t === 'gameover') res.over = true;
  } }).start();
  S = game.state();
  game._level(idx, opts.loop || 1);
  if (opts.lives) S.lives = opts.lives;
  if (opts.noFoes) S.lv.rise = 1e9;
  if (opts.prep) opts.prep(game);
  const N = navFor(D, idx), lv = N.lv;
  const seen = new WeakMap();
  const spotted = e => { if (!seen.has(e)) seen.set(e, S.time + (brng() > dodgeP ? 0.25 + brng() * 0.3 : 0)); return S.time >= seen.get(e); };
  const noticed = e => { if (!seen.has(e)) seen.set(e, S.time + (brng() < missP ? 0.4 + brng() * 0.6 : 0)); return S.time >= seen.get(e); };
  const react = () => r0 + brng() * (r1 - r0);
  const H = () => S.hero;
  let jumpThrow = 0, plan = null, wait = react(), cur = { dx: 0 }, fireCd = 0, holdFire = 0, best = Infinity, bestT = 0, dodgeT = 0, dodgeO = null, lastFire = false;

  // ---------- угрозы и проверка действий той же физикой ----------
  function threats(){
    const h = H(), out = [];
    if (opts.noFoes) return out;
    const near = x => Math.abs(x - h.x) < 12;
    for (const s of S.eshots) if (near(s.x) && spotted(s)) out.push({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, g: s.g || 0, hw: s.r, hh: s.r, c: true });
    for (const e of S.enemies){
      if (!near(e.x) || !noticed(e)) continue;
      if (e.type === 'riser' && e.st === 'rise' && e.t < 0.5) continue;
      if (e.type === 'vent' && e.st === 'hidden') continue;
      if (e.type === 'kite'){
        if (e.st === 'dive' || e.st === 'warn' || e.st === 'up'){
          const w = e.st === 'warn' ? Math.max(0, 0.6 - e.t) : 0;
          let vx = e.vx, vy = e.vy;
          if (e.st === 'warn'){ const dx = e.tx - e.x, dy = e.ty - e.y, n = Math.hypot(dx, dy) || 1; vx = dx / n * 8; vy = dy / n * 8; }
          const tb = e.st === 'up' ? 0 : Math.max(0, (e.ty - e.y) / (vy || 1e-6)), x0 = e.x, y0 = e.y;
          out.push({ hw: e.hw, hh: e.hh, at: t => { if (t < w) return [x0, y0]; const u = t - w; if (e.st !== 'up' && u < tb) return [x0 + vx * u, y0 + vy * u]; const k = e.st === 'up' ? u : u - tb, bx = e.st === 'up' ? x0 : x0 + vx * tb, by = e.st === 'up' ? y0 : y0 + vy * tb; return [bx + vx * 0.5 * k, by - 7 * k]; } });
        }
        continue;
      }
      if (e.type === 'blub'){ out.push({ x: e.x, y: e.y, vx: e.vx, vy: e.vy, g: 22, hw: e.hw, hh: e.hh, dy: e.hh / 2 }); continue; }
      const sp = e.type === 'riser' && e.st === 'live' ? 1.3 : e.type === 'brute' ? 1.1 : 0;
      out.push({ x: e.x, y: e.y, vx: e.face * sp, vy: 0, g: 0, hw: e.hw, hh: e.hh, dy: e.hh / 2, ground: true });
    }
    for (const w of S.warn) if (near(w.x)) out.push({ x: w.x, y: L.R - 0.3, vx: (h.x < w.x ? -1 : 1) * 1.0, vy: -15.2, g: 22, hw: 0.35, hh: 0.7, dy: 0.35, delay: w.t });
    const b = S.boss;
    if (b && !b.dead && b.mode !== 'intro'){
      let vx = 0, vy = 0, g = 0;
      if (b.mode === 'dash' || b.mode === 'scuttle' || b.mode === 'glide') vx = b.vx || 0;
      if (b.mode === 'aim') vx = (h.x < b.x ? -9 : 9);
      if (b.mode === 'hop'){ vx = b.vx; vy = b.vy; g = 22; }
      if (b.mode === 'dive'){ vx = b.dvx; vy = b.dvy; }
      if (b.mode === 'walk') vx = (h.x < b.x ? -1.4 : 1.4);
      let delay = b.mode === 'aim' ? Math.max(0, 0.75 - b.mt) : 0;
      if (b.key === 'serpent' && b.mode === 'warn'){ const tx = b.did ? b.tx : h.x, dy = (lv.arena.y - 1.0) - b.y, dx = tx - b.x, n = Math.hypot(dx, dy) || 1; vx = dx / n * 9; vy = dy / n * 9; delay = Math.max(0, 0.6 - b.mt); const ty = lv.arena.y - 1.0, tb = Math.max(0, dy / (vy || 1e-6)), x0 = b.x, y0 = b.y;
        out.push({ hw: b.hw, hh: b.hh, at: t => { const u = Math.max(0, t - delay); return u < tb ? [x0 + vx * u, y0 + vy * u] : [x0 + vx * tb, ty]; } }); return out; }
      if (b.key === 'serpent' && b.mode === 'dive'){ const ty = lv.arena.y - 1.0, tb = Math.max(0, (ty - b.y) / (b.dvy || 1e-6)), x0 = b.x, y0 = b.y, dvx = b.dvx, dvy = b.dvy;
        out.push({ hw: b.hw, hh: b.hh, at: t => t < tb ? [x0 + dvx * t, y0 + dvy * t] : [x0 + dvx * tb, ty] }); return out; }
      out.push({ x: b.x, y: b.y, vx, vy, g, hw: b.hw, hh: b.hh, dy: b.hh / 2, boss: true, delay });
    }
    return out;
  }
  function optionSafe(o, th, horizon){
    const h0 = H(), h = Object.assign({}, h0), dtt = 1 / 30;
    h.jprev = false; h.hurtT = 0;
    const Wd = L.world(lv, S.t, dtt);
    for (let t = 0; t <= horizon; t += dtt){
      const Wn = L.world(lv, S.t + t, dtt);
      L.heroStep(Wn, h, { dx: o.dx, down: !!o.down, jump: !!o.jump && t < 0.05 }, dtt);
      if (h.y > L.R - 0.6) return false;
      if (t + dtt > horizon && !h.ground && !h.climb){ for (let k = 0; k < 60 && !h.ground; k++){ L.heroStep(L.world(lv, S.t + t + k * dtt, dtt), h, { dx: 0 }, dtt); if (h.y > L.R - 0.6) return false; } }
      const hh = h.crouch ? L.CH : L.HH, x0 = h.x - L.HW, x1 = h.x + L.HW, y0 = h.y - hh, y1 = h.y;
      for (const q of th){
        const tt = Math.max(0, t - (q.delay || 0)); let qx, qy;
        if (q.at){ const pq = q.at(t); qx = pq[0]; qy = pq[1]; } else { qx = q.x + q.vx * tt; qy = q.y + q.vy * tt + 0.5 * q.g * tt * tt; }
        const top = q.c ? qy - q.hh : qy - q.hh, bot = q.c ? qy + q.hh : qy;
        if (qx + q.hw > x0 - 0.05 && qx - q.hw < x1 + 0.05 && bot > y0 && top < y1) return false;
      }
    }
    void Wd;
    return true;
  }
  function safeChoice(want, horizon){
    const th = threats();
    if (!th.length) return want;
    if (optionSafe(want, th, horizon)) return want;
    const pref = OPTS.slice().sort((a, b) => (Math.abs(a.dx - want.dx) + (a.jump ? 1.5 : 0)) - (Math.abs(b.dx - want.dx) + (b.jump ? 1.5 : 0)));
    for (const o of pref) if (optionSafe(o, th, horizon)) return Object.assign({ dodge: true }, o);
    return want;
  }

  // ---------- броски ----------
  function tapFire(want){
    if (holdFire > 0){ holdFire -= dt; return holdFire > 0; }
    if (!want || lastFire || fireCd > 0) return false;
    fireCd = 0.15 + brng() * 0.08;
    if (H().armor === 2 && brng() < chargeP) holdFire = L.CHARGE + 0.1 + brng() * 0.3;
    return true;
  }
  function targetAhead(){
    if (opts.noFoes) return null;
    if (S.time - bestT > 8 && (S.time - bestT) % 8 < 3) return null;   // давно топчемся — прорваться вперёд
    const h = H(), sy = h.y - 1.15;
    let bestE = null, bd = 1e9;
    for (const e of S.enemies){
      if (e.dead || !noticed(e) || e.x < S.cam.x || e.x > S.cam.x + L.VIEW_W) continue;
      if ((e.type === 'vent' && e.st === 'hidden') || e.type === 'blub') continue;
      const d = Math.abs(e.x - h.x); if (d > 8) continue;
      const arc = S.weapon === 'axe' || S.weapon === 'hammer';
      const lineOk = arc ? (Math.abs(e.y - h.y) < 0.5 || (e.y < h.y && e.y > h.y - 5 && d > 1.5 && d < 4.5)) : (sy > e.y - e.hh - 0.3 && sy < e.y + 0.3);
      if (!lineOk) continue;
      if (d < bd){ bd = d; bestE = e; }
    }
    if (!bestE) for (const c of S.chests){ if (!c.open && Math.abs(c.x - H().x) < 5 && Math.abs(c.y - h.y) < 0.5 && S.weapon !== 'torch') { bestE = c; break; } }
    return bestE;
  }

  // ---------- граф ----------
  function choosePlan(){
    const h = H();
    if (h.on >= 0){   // стоит на плоту/подъёмнике — доехать
      for (const l of N.nav.edges.values()) for (const e of l) if (e.ride === h.on) return { e, stage: 'approach', t: 0, jit: 0, st: { k: 'ride', w: 0 } };
    }
    let id = N.nav.nodeAt(h.x, h.y);
    if (id < 0){ const r = Math.round(h.y); for (const dc of [0, -1, 1, -2, 2]){ const c = Math.floor(h.x) + dc; if (N.nav.set.has(r * lv.W + c)) return { e: { walk: dc > 0 ? 1 : -1, to: r * lv.W + c }, stage: 'approach', t: 0, jit: 0, st: {} }; } return null; }
    const dHere = N.dist.get(id);
    if (dHere != null && dHere < best - 0.01){ best = dHere; bestT = S.time; }
    let bestE = null, bv = Infinity;
    for (const e of N.nav.edges.get(id) || []){ const d = N.dist.get(e.to); if (d == null) continue; const v = d + e.cost; if (v < bv){ bv = v; bestE = e; } }
    if (!bestE) return null;
    return { e: bestE, stage: 'approach', t: 0, jit: (brng() * 2 - 1) * 0.04, st: {} };
  }
  function runPlan(o){
    const h = H(), p = plan, e = p.e;
    p.age = (p.age || 0) + dt; if (e.ride == null && p.age > 6){ plan = null; return; }
    if (e.walk){ o.dx = e.walk; const tx = (e.to % lv.W) + 0.5; if (!h.ground){ return; } if ((e.walk > 0 && h.x >= tx - 0.2) || (e.walk < 0 && h.x <= tx + 0.2)) plan = null; return; }
    if (e.ride != null){
      if ((!p.st.k || p.st.k === 'wait') && pitBusy()){ p.st.w = 0; return; }
      const r = L.rideCtl(lv, e.ride, p.st, h, S.t, p.react || (p.react = r0 + brng() * (r1 - r0)));
      if (r.done || r.fail){ plan = null; return; }
      o.dx = r.dx; o.jump = r.jump; return;
    }
    if (e.climb){
      const cx = (e.to % lv.W) + 0.5;
      if (p.stage === 'approach'){ if (Math.abs(h.x - cx) > 0.25 && !h.climb){ o.dx = h.x < cx ? 1 : -1; return; } p.stage = 'go'; }
      if (e.climb < 0) o.up = true; else o.down = true;
      if (p.t > 0.1 && h.ground && !h.climb) plan = null;
      p.t += dt; return;
    }
    if (e.drop){ o.dx = h.ground && p.stage !== 'air' ? e.drop : 0; if (!h.ground) p.stage = 'air'; else if (p.stage === 'air') plan = null; return; }
    // прыжок
    if (p.stage === 'approach'){
      const sx = e.sx + p.jit;
      if (Math.abs(h.x - sx) > 0.035){ o.dx = h.x < sx ? 1 : -1; return; }
      if (!h.ground) return;
      p.stage = 'react'; p.t = react() * 0.5;
    }
    if (p.stage === 'react'){ p.t -= dt; if (p.t > 0) return; p.stage = 'go'; o.dx = e.d; o.jump = true; p.t = 0; return; }
    p.t += dt; o.dx = 0;
    if (p.t > 0.05 && h.ground) plan = null;
  }
  // перед прыжком через жижу — подождать, если пузырится
  function pitBusy(){ const h = H(); return S.warn.some(w => Math.abs(w.x - h.x) < 5) || S.enemies.some(e => e.type === 'blub' && Math.abs(e.x - h.x) < 5); }

  // ---------- страж ----------
  function bossPolicy(){
    const h = H(), b = S.boss, a = lv.arena, o = { dx: 0, fire: false };
    if (!b || b.dead){ const k = S.items.find(it => it.k === 'key'); if (k && Math.abs(k.x - h.x) > 0.3) o.dx = k.x > h.x ? 1 : -1; return o; }
    const side = h.x < b.x ? -1 : 1;
    let want = b.x + side * (b.key === 'serpent' ? 4 : 6.5);
    if (want < a.x0 + 1 || want > a.x1) want = b.x - side * 6.5;
    want = Math.max(a.x0 + 0.5, Math.min(a.x1 + 0.5, want));
    if (Math.abs(want - h.x) > 0.5) o.dx = want > h.x ? 1 : -1;
    const facing = Math.sign(b.x - h.x) || 1;
    if (o.dx === 0 && h.face !== facing) o.dx = facing;
    o.fire = h.face === facing;
    if (b.fly && (b.mode === 'glide' || b.mode === 'rise') && h.ground && h.face === facing && Math.abs(b.x - h.x) > 1.5 && Math.abs(b.x - h.x) < 5 && brng() < 0.5) o.jt = true;
    return o;
  }

  let T = 0;
  while (T < maxT){
    T += dt;
    if (fireCd > 0) fireCd -= dt;
    if (S.phase === 'clear' || S.phase === 'loopEnd' || S.phase === 'won'){ res.cleared = true; break; }
    if (S.phase === 'cont' || S.phase === 'over'){ res.over = true; break; }
    if (S.phase !== 'play'){ game.setInput({}); game.update(dt); lastFire = false; continue; }
    const h = H();
    let o = { dx: 0, up: false, down: false, jump: false, fire: false };
    const fighting = S.bossState !== 'none';
    wait -= dt;
    if (dodgeT > 0){ dodgeT -= dt; o.dx = dodgeO.dx; o.down = !!dodgeO.down; o.jump = !!dodgeO.jump; o.fire = tapFire(!dodgeO.jump && !!targetAhead()); }
    else if (fighting){
      plan = null;
      if (wait <= 0){
        wait = react();
        const pol = bossPolicy();
        const c = h.ground ? safeChoice({ dx: pol.dx }, 1.1) : { dx: 0 };
        if (c.dodge){ dodgeO = c; dodgeT = c.jump ? 0.1 : 0.35; }
        else if (pol.jt && optionSafe({ dx: 0, jump: true }, threats(), 0.8)){ jumpThrow = 0.32; }
        cur = { dx: c.dx, fire: pol.fire };
      }
      o.dx = cur.dx; o.fire = tapFire(cur.fire);
      if (jumpThrow > 0){ o.dx = 0; if (jumpThrow > 0.3) o.jump = true; jumpThrow -= dt; o.fire = jumpThrow <= 0 ? tapFire(true) : false; }
    } else {
      const inAir = plan && ((plan.e.ride != null && plan.st.k && plan.st.k !== 'go' && plan.st.k !== 'wait') || (plan.e.ride == null && plan.stage !== 'approach' && !plan.e.walk));
      const tgt = !inAir ? targetAhead() : null;
      // намерение этого кадра: бить цель или идти по плану
      if (tgt && h.ground && (!plan || plan.stage === 'approach')){
        const f = Math.sign(tgt.x - h.x) || 1, d = Math.abs(tgt.x - h.x), arc = (S.weapon === 'axe' || S.weapon === 'hammer') && tgt.hp != null && tgt.type !== 'kite';
        if (arc && d < 3.8 && d > 1.2 && optionSafe({ dx: -f }, threats(), 0.4)) o.dx = -f;
        else { o.dx = h.face !== f ? f : 0; o.fire = tapFire(o.dx === 0); }
      }
      else if (plan){ if (plan.stage === 'approach' && plan.e.jump && pitBusy()){ o.dx = 0; } else runPlan(o); }
      else if (h.ground){ plan = choosePlan(); }
      if (!tgt && !o.fire) o.fire = tapFire(false);
      // раз в реакцию — проверить, не опасно ли намерение (и стоять на месте); заметил угрозу — увернуться
      if (!inAir && h.ground && wait <= 0 && !o.jump){
        wait = react();
        const th = threats();
        if (th.length){
          const c = safeChoice({ dx: o.dx, down: o.down }, 1.2);
          if (c.dodge){ dodgeO = c; dodgeT = c.jump ? 0.1 : 0.3; plan = null; o.dx = c.dx; o.jump = !!c.jump; o.down = !!c.down; o.fire = false; }
        }
      }
    }
    lastFire = o.fire;
    game.setInput(o); game.update(dt);
    if (!fighting && S.time - bestT > 40){ res.stuck = true; res.stuckAt = { x: +H().x.toFixed(2), y: +H().y.toFixed(2), plan: plan && JSON.stringify(plan.e) }; break; }
    if (fighting) bestT = S.time;
  }
  res.t = +T.toFixed(1); res.score = S.score;
  return res;
}
