/* ОРУЖЕЙНИК · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса.
   Карту этапа знает (как игрок, видевший этап), но управляет только как человек: setInput({dx,down,jump,fire,slide}),
   selectWeapon / useTank — и теми же макросами движения, по которым строится граф проходимости (logic.MACROS, blinkRun).
   Человеческие ограничения:
   - реакция: каждое решение — через 150–250 мс (opts.react); между решениями держит прежние клавиши;
     начало прыжка/подката — тоже после паузы реакции; заученное движение (макрос) исполняет целиком;
   - врагов замечает не всех сразу (opts.miss — доля незамеченных при первом взгляде), видит только кадр камеры;
   - от снарядов и рывков босса уворачивается не всегда (opts.dodge — вероятность заметить угрозу вовремя);
   - стреляет «тапами» (не чаще раза в 0.12 с), заряженный выстрел — только иногда (opts.chargeP).
   opts: { stage=0, react:[0.15,0.25], miss=0.2, dodge=0.8, chargeP=0.25, dmgMul, maxT=600, store } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const NAV = new Map();
export function navFor(OZ, idx){
  if (NAV.has(idx)) return NAV.get(idx);
  const L = OZ.logic, lv = OZ.level(idx), nav = L.Nav(lv);
  const start = nav.nodeAt(lv.start.x, lv.start.y);
  const goals = [...nav.set].filter(id => id % lv.W > lv.arena.x0 + 2);
  const dist = nav.field(goals);
  const o = { lv, nav, start, goals, dist }; NAV.set(idx, o); return o;
}

export function playStage(OZ, seed, opts = {}){
  const L = OZ.logic, brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const missP = opts.miss == null ? 0.2 : opts.miss, dodgeP = opts.dodge == null ? 0.8 : opts.dodge, chargeP = opts.chargeP == null ? 0.25 : opts.chargeP;
  const maxT = opts.maxT || 600, idx = opts.stage || 0;
  const res = { seed, stage: idx, cleared: false, over: false, deaths: 0, why: {}, t: 0, stuck: false, bossDeaths: 0, miniDeaths: 0, tanks: 0 };
  let S = null;
  let rushKey = '', rushOk = false, curDx = 0, wantFire = false, jumpT = 0, plan = null, fireCd = 0, best = Infinity, bestT = 0, holdFire = 0, dodge = null, wait = 0;
  const game = OZ.Game({ rng: mulberry32(seed), dmgMul: opts.dmgMul, store: opts.store, onEvent: (t, d) => {
    if (t === 'die'){ (res.at = res.at || []).push(d.why + '@' + d.x.toFixed(1)); res.deaths++; res.why[d.why] = (res.why[d.why] || 0) + 1; if (S.bossState === 'fight') res.bossDeaths++; if (S.miniState === 'fight') res.miniDeaths++; }
    if (t === 'respawn'){ plan = null; best = Infinity; bestT = S.time; }
    if (t === 'got' || t === 'clear' || t === 'win') res.cleared = true;
    if (t === 'miniIntro') res.miniAt = +S.time.toFixed(1);
    if (t === 'kill' && d.mini) res.miniT = +(S.time - res.miniAt).toFixed(1);
    if (t === 'bossIntro' && !d.rematch && !d.phase2) res.bossAt = +S.time.toFixed(1);
    if (t === 'bossDie') res.bossT = +(S.time - res.bossAt).toFixed(1);
    if (t === 'gameover') res.over = true;
  } }).start();
  S = game.state();
  if (opts.prep) opts.prep(game);
  if (idx >= 8){ game._beatAll(); S.prog.fort = idx - 8; game.pick(8); } else game.pick(idx);
  const N = navFor(OZ, S.stage), lv = N.lv, dt = 1 / 60;
  const seen = new WeakMap();
  const noticed = e => { if (!seen.has(e)) seen.set(e, brng() >= missP); return seen.get(e); };
  const react = () => r0 + brng() * (r1 - r0);
  let held = { dx: 0, down: false, jump: false, fire: false, slide: false };
  wait = react();
  const inView = (x) => x > S.cam.x - 0.5 && x < S.cam.x + L.VIEW_W + 0.5;
  const H = () => S.hero;

  // огонь «тапами»: возвращает fire для этого кадра
  function tapFire(want){
    if (holdFire > 0){ holdFire -= dt; if (holdFire <= 0) return false; return true; }
    if (!want){ return false; }
    if (held.fire){ return false; }                // отпустить между тапами
    if (fireCd > 0) return false;
    fireCd = 0.12 + brng() * 0.08;
    if (S.wsel === 0 && brng() < chargeP) holdFire = L.CH1 + 0.05 + brng() * 0.9;
    return true;
  }
  // цели на линии огня
  function targetAhead(){
    const h = H(), sy = h.y - 0.95;
    let bestE = null, bd = 1e9;
    for (const e of S.enemies){
      if (e.dead || !inView(e.x) || !noticed(e)) continue;
      const dx = e.x - h.x, d = Math.abs(dx);
      if (d > 9) continue;
      const lineOk = sy > e.y - e.hh - 0.15 && sy < e.y + 0.15;
      if (!lineOk) continue;
      let blocked = false; const row = Math.floor(sy);
      for (let x = Math.min(h.x, e.x); x < Math.max(h.x, e.x); x += 0.5) if (L.solid(S.W, Math.floor(x), row, S.time)) { blocked = true; break; }
      if (blocked) continue;
      if (d < bd){ bd = d; bestE = e; }
    }
    return bestE;
  }
  // угрозы: снаряд/враг попадёт в героя в ближайшие ~0.6 с, если стоять
  function threat(){
    const h = H(), hx0 = h.x - 0.4, hx1 = h.x + 0.4, hy0 = h.y - 1.5, hy1 = h.y;
    let out = null;
    const check = (x, y, vx, vy, hw, hh, kind, g) => {
      for (let tt = 0; tt <= 0.6; tt += 0.05){
        const px = x + vx * tt, py = y + vy * tt + (g ? 0.5 * g * tt * tt : 0);
        if (px + hw > hx0 && px - hw < hx1 && py + hh > hy0 && py - hh < hy1){ if (!out || tt < out.tt) out = { tt, low: py - hh > h.y - 1.2, high: py + hh < h.y - 0.6, kind, x }; return; }
      }
    };
    for (const s of S.eshots) check(s.x, s.y, s.vx, s.vy, s.hw || s.r, s.hh || s.r, s.kind, s.g);
    const b = S.boss;
    if (b && !b.dead && S.bossState === 'fight') check(b.x, b.y - b.hh / 2, b.vx || 0, b.fly ? (b.vy || 0) : 0, b.hw, b.hh / 2, 'boss');
    return out;
  }
  function bossPolicy(){
    const h = H(), b = S.boss, o = { dx: 0, down: false, jump: false, fire: false, slide: false };
    if (!b || b.dead) return o;
    // оружие-слабость, если есть
    const wk = L.WEAK[b.key], wi = L.WEAP.findIndex(w => w.k === wk);
    if (wi > 0 && game.owned(wi) && S.energy[wi] >= L.WEAP[wi].cost && S.wsel !== wi) game.selectWeapon(wi);
    else if ((wi <= 0 || !game.owned(wi) || S.energy[wi] < L.WEAP[wi].cost) && S.wsel !== 0) game.selectWeapon(0);
    if (S.prog.tanks > 0 && h.hp < 8 && game.useTank()) res.tanks++;
    const side = h.x < b.x ? -1 : 1, ax = S.lv.arena.x0;
    let want = b.x + side * 6.5;
    if (b.key === 'fan' && b.mode === 'inhale') want = b.x + side * 12;
    if ((b.key === 'magnet' || b.key === 'core') && b.mode === 'aim') want = h.x + (h.x < b.x ? -4 : 4);
    if (b.key === 'bell' && b.mode === 'shake') want = b.x + side * 6;
    if (b.key === 'spring' && b.mode === 'leap') want = h.x - Math.sign(b.vx || side) * 3;
    if (want < ax + 2 || want > ax + 24){ // прижали к стене — уйти на другую сторону, когда безопасно
      want = Math.max(ax + 2, Math.min(ax + 24, want));
    }
    if (Math.abs(want - h.x) > 0.6) o.dx = want > h.x ? 1 : -1;
    // стрельба: лицом к боссу
    const facing = Math.sign(b.x - h.x) || 1;
    const lineOk = Math.abs((h.y - 0.95) - (b.y - b.hh / 2)) < b.hh / 2 + 0.6 || b.fly;
    if (o.dx === 0 || o.dx === facing){ if (o.dx === 0 && h.face !== facing) o.dx = facing; }
    o.fire = true;
    if (!lineOk && b.y - b.hh / 2 < h.y - 1.2 && Math.abs(b.x - h.x) < 9 && h.face === facing && brng() < 0.6) o.jump = true;   // прыжок с выстрелом
    // уклонение
    const th = threat();
    if (th && h.ground && brng() < dodgeP){
      if (th.kind === 'boss' && (b.mode === 'dash' || b.mode === 'roll' || b.mode === 'charge')) { /* см. ниже */ }
      else if (th.low || th.kind === 'wave' || th.kind === 'hmr' || th.kind === 'cog' || th.kind === 'boss') { o.jump = true; dodge = { t: 0.5, dx: 0 }; }
      else { dodge = { t: 0.35, dx: th.x < h.x ? 1 : -1 }; }
    }
    // рывок по полу: присед/замах босса виден заранее — игрок готовит прыжок (см. rushJump в цикле)
    if (b.mode === 'dash' || b.mode === 'roll' || b.mode === 'charge' || b.mode === 'crouch') { o.dx = 0; o.jump = false; dodge = null; }
    return o;
  }
  function fightMini(e){
    const h = H(), o = { dx: 0, down: false, jump: false, fire: false, slide: false };
    const side = h.x < e.x ? -1 : 1, m = S.lv.mini;
    let want = e.x + side * 5.5; want = Math.max(m.x0 + 1.5, Math.min(m.x1 - 0.8, want));
    if (Math.abs(want - h.x) > 0.6) o.dx = want > h.x ? 1 : -1;
    const facing = Math.sign(e.x - h.x) || 1;
    if (o.dx === 0 && h.face !== facing) o.dx = facing;
    o.fire = true;
    if (e.y - e.hh / 2 < h.y - 1.4 && Math.abs(e.x - h.x) < 8 && h.face === facing && brng() < 0.6) o.jump = true;   // прыжок с выстрелом
    const th = threat();
    if (th && h.ground && brng() < dodgeP){ if (th.low || th.kind === 'boss') o.jump = true; else dodge = { t: 0.3, dx: th.x < h.x ? 1 : -1 }; }
    if (e.type === 'drone' && e.mode === 'aim') dodge = { t: 0.5, dx: h.x < e.x ? -1 : 1 };
    if (Math.abs(e.x - h.x) < e.hw + 1.4 && h.ground && Math.abs(e.y - h.y) < 1) { o.jump = true; }
    return o;
  }

  // выбор следующего ребра графа
  function choosePlan(){
    const h = H(), id = N.nav.nodeAt(h.x, h.y);
    if (id < 0) return null;
    const es = N.nav.edges.get(id) || [];
    let bestE = null, bv = Infinity;
    for (const e of es){ const d = N.dist.get(e.to); if (d == null) continue; const v = d + e.cost; if (v < bv){ bv = v; bestE = e; } }
    if (!bestE) return null;
    const dHere = N.dist.get(id);
    if (dHere != null && dHere < best){ best = dHere; bestT = S.time; }
    return { e: bestE, stage: 'approach', t: 0, k: 0, mode: 'wait' };
  }
  function runPlan(o){
    const h = H(), p = plan, e = p.e;
    p.age = (p.age || 0) + dt; if (!e.blink && p.age > 5){ plan = null; return; }   // сбили с пути (отбросило ударом) — выбрать заново
    if (e.walk){ if (Math.abs(h.y - Math.floor(e.to / lv.W)) > 0.5 && h.ground){ plan = null; return; } o.dx = e.walk; const tx = (e.to % lv.W) + 0.5; if ((e.walk > 0 && h.x >= tx - 0.15) || (e.walk < 0 && h.x <= tx + 0.15)) plan = null; return; }
    if (e.blink){
      const ch = e.blink;
      if (p.stage === 'approach'){ const ex = ch.c0 - 0.42; if (Math.abs(h.x - ex) > 0.05){ o.dx = h.x < ex ? 1 : -1; return; } p.stage = 'run'; p.k = 0; p.mode = 'wait'; }
      const edge = p.k === 0 ? ch.c0 - 0.42 : ch.stones[p.k - 1].c1 - 0.45;
      if (p.mode === 'wait'){
        if (h.ground && h.x < edge - 0.05) o.dx = 1;
        else if (h.ground && L.blinkReady(ch, p.k, S.time, 0.12 + (r1 - r0) * brng())){ p.mode = 'jump'; p.t = 0; o.dx = 1; o.jump = true; }
      } else {
        p.t += dt; o.dx = 1; o.jump = true;
        if (p.t > 0.05 && h.ground){ o.dx = 0; o.jump = false; p.k++; p.mode = 'wait'; if (p.k > ch.stones.length){ plan = null; } }
      }
      return;
    }
    // макрос
    if (p.stage === 'approach'){
      if (Math.abs(h.x - e.sx) > 0.05){ o.dx = h.x < e.sx ? 1 : -1; return; }
      if (!h.ground) return;
      p.stage = 'react'; p.t = react() * 0.6;
    }
    if (p.stage === 'react'){ p.t -= dt; if (p.t > 0) return; p.stage = 'go'; p.t = 0; p.first = true; }
    const mi = L.macroInput(e.m, p.t, p.first);
    o.dx = mi.dx; o.jump = mi.jump; o.slide = mi.slidePress || (e.m.slide && p.t < 0.05);
    p.first = false; p.t += dt;
    if (e.m.slide){ if (p.t > 0.1 && !h.slide && h.ground){ plan = null; } }
    else if (e.m.hold > 0){ if (p.t > 0.06 && h.ground){ plan = null; } }
    else if (p.t > 0.05 && h.ground && p.left){ plan = null; }
    if (!h.ground) p.left = true;
    if (p.t > 3) plan = null;
  }

  let T = 0;
  while (T < maxT){
    T += dt;
    if (fireCd > 0) fireCd -= dt;
    if (S.phase === 'got' || S.phase === 'clear' || S.phase === 'won'){ res.cleared = true; break; }
    if (S.phase === 'over'){ res.over = true; break; }
    if (S.phase !== 'stage'){ game.setInput({}); held = { dx: 0, down: false, jump: false, fire: false, slide: false }; game.update(dt); continue; }
    const h = H();
    let o = { dx: 0, down: false, jump: false, fire: false, slide: false };
    const fighting = S.bossState === 'fight' || S.bossState === 'intro';
    const mini = S.miniState === 'fight' && S.mini && !S.mini.dead ? S.mini : null;
    wait -= dt;
    if (fighting || mini){
      plan = null;
      if (wait <= 0){
        wait = react();
        const pol = fighting ? bossPolicy() : fightMini(mini);
        curDx = pol.dx; wantFire = pol.fire;
        if (pol.jump && h.ground && jumpT <= 0 && !held.jump) jumpT = 0.42 + brng() * 0.1;
      }
      if (dodge && dodge.t > 0){ dodge.t -= dt; if (dodge.dx) curDx = dodge.dx; } else dodge = null;
      const B = S.boss;
      if (fighting && B && !B.dead){
        if ((B.mode === 'crouch' || B.mode === 'fall') && rushKey !== B.mode){ rushOk = brng() < Math.min(0.97, dodgeP + 0.12); }
        rushKey = B.mode;
        if ((B.mode === 'dash' || B.mode === 'roll' || B.mode === 'charge') && Math.sign(B.vx) === Math.sign(h.x - B.x)){
          curDx = 0;
          const gap = Math.abs(B.x - h.x) - B.hw - 0.35, rel = Math.abs(B.vx) || 1;
          if (rushOk && h.ground && jumpT <= 0 && !held.jump && gap < rel * 0.3) jumpT = 0.5;
        }
      }
      o.dx = curDx; o.jump = jumpT > 0; if (jumpT > 0) jumpT -= dt;
      o.fire = tapFire(wantFire);
    } else {
      // враг на пути — остановиться и стрелять
      const tgt = !plan || plan.stage === 'approach' ? targetAhead() : null;
      if (tgt && h.ground && wait <= 0){
        const f = Math.sign(tgt.x - h.x) || 1; o.dx = h.face !== f ? f : 0; o.fire = tapFire(true);
        if (wait <= 0) wait = 0.03;
      } else if (plan){ runPlan(o); }
      else if (wait <= 0){ if (h.ground){ plan = choosePlan(); wait = react() * 0.5; } }
      if (!plan && !tgt){ o.fire = tapFire(false); }
    }
    held = o;
    game.setInput(o); game.update(dt);
    if (!fighting && !mini && S.time - bestT > 30){ res.stuck = true; res.stuckAt = { x: +H().x.toFixed(2), y: +H().y.toFixed(2), plan: plan && (plan.e.walk ? 'walk' + plan.e.walk : plan.e.blink ? 'blink' : JSON.stringify(plan.e.m) + '@' + plan.e.sx + ' ' + plan.stage), foes: S.enemies.map(e => e.type + '@' + e.x.toFixed(1) + ',' + e.y.toFixed(1)).join(' ') }; break; }
    if (fighting || mini) bestT = S.time;
  }
  res.t = +T.toFixed(1); res.score = S.score;
  return res;
}
