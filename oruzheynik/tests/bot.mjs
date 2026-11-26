/* ОТБОЙ · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса всей игры.
   Карту этапа знает (как игрок, видевший этап), но управляет только как человек: setInput({dx,down,jump,hit,slide})
   и теми же макросами движения, по которым строится граф проходимости (logic.MACROS, blinkRun).
   Человеческие ограничения:
   - реакция: каждое решение — через 150–250 мс (opts.react); между решениями держит прежние клавиши;
     начало прыжка/кувырка — тоже после паузы реакции; заученное движение (макрос) исполняет целиком;
   - врагов замечает не всех сразу (opts.miss — доля незамеченных при первом взгляде), видит только кадр камеры;
   - снаряд отбивает не всегда: с вероятностью opts.parry замечает его и бьёт молотом в нужный момент (иначе — пропускает);
   - от рывков и ударных волн Мастера уворачивается не всегда (opts.dodge — вероятность заметить угрозу вовремя).
   playGame(OZ, seed, opts) — вся игра подряд (opts.from — этап, с которого начать; opts.single — остановиться после этапа).
   opts: { from=0, single, react:[0.15,0.25], miss=0.2, dodge=0.8, parry=0.85, dmgMul, maxT=3000 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const NAV = new Map();
export function navFor(OZ, idx){
  if (NAV.has(idx)) return NAV.get(idx);
  const L = OZ.logic, lv = OZ.level(idx), nav = L.Nav(lv);
  const start = nav.nodeAt(lv.start.x, lv.start.y);
  const goals = [...nav.set].filter(id => id % lv.W > lv.arena.x0 + 2);
  const dist = nav.field(goals);
  const o = { lv, nav, start, goals, dist, idx }; NAV.set(idx, o); return o;
}

export function playGame(OZ, seed, opts = {}){
  const L = OZ.logic, brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const missP = opts.miss == null ? 0.2 : opts.miss, dodgeP = opts.dodge == null ? 0.8 : opts.dodge, parryP = opts.parry == null ? 0.85 : opts.parry;
  const maxT = opts.maxT || 3000, from = opts.from || 0;
  const res = { seed, won: false, over: false, cleared: 0, deaths: 0, why: {}, t: 0, stuck: false, stages: [], reflects: 0 };
  let S = null, cur = null; const ignoreFoe = new WeakSet(); let waitFoe = null, waitFoeT = 0, nudge = 0;
  let rushKey = '', rushOk = false, curDx = 0, jumpT = 0, plan = null, best = Infinity, bestT = 0, dodge = null, wait = 0, swingCd = 0, parried = new WeakSet(), armed = new WeakMap();
  const stg = () => cur || (cur = res.stages[S.stage] = res.stages[S.stage] || { i: S.stage, deaths: 0, miniDeaths: 0, bossDeaths: 0, t0: S.time });
  const game = OZ.Game({ rng: mulberry32(seed), dmgMul: opts.dmgMul, tutorial: false, start: { si: from }, onEvent: (t, d) => {
    if (!S) return;
    if (t === 'stage'){ cur = null; plan = null; }
    if (t === 'die'){ const q = stg(); (res.at = res.at || []).push(S.stage + ':' + d.why + '@' + d.x.toFixed(1)); res.deaths++; q.deaths++; res.why[d.why] = (res.why[d.why] || 0) + 1; if (S.bossState === 'fight') q.bossDeaths++; if (S.miniState === 'fight') q.miniDeaths++; }
    if (t === 'respawn'){ plan = null; best = Infinity; bestT = S.time; }
    if (t === 'miniIntro') stg().miniAt = S.time;
    if (t === 'kill' && d.mini) stg().miniT = +(S.time - stg().miniAt).toFixed(1);
    if (t === 'bossIntro' && !d.phase2) stg().bossAt = S.time;
    if (t === 'bossDie') stg().bossT = +(S.time - (stg().bossAt || S.time)).toFixed(1);
    if (t === 'reflect') res.reflects++;
    if (t === 'clear'){ res.cleared++; stg().done = true; }
    if (t === 'win'){ res.won = true; res.cleared++; stg().done = true; }
    if (t === 'gameover') res.over = true;
  } });
  S = game.state(); game.start();
  let N = navFor(OZ, S.stage), lv = N.lv;
  const dt = 1 / 60;
  const seen = new WeakMap();
  const noticed = e => { if (!seen.has(e)) seen.set(e, brng() >= missP); return seen.get(e); };
  const react = () => r0 + brng() * (r1 - r0);
  let held = { dx: 0, down: false, jump: false, hit: false, slide: false };
  wait = react();
  const inView = (x) => x > S.cam.x - 0.5 && x < S.cam.x + L.VIEW_W + 0.5;
  const H = () => S.hero;
  const empty = () => ({ dx: 0, down: false, jump: false, hit: false, slide: false });

  // удар «тапом»: не чаще чем раз в 0.1 с после конца замаха
  function tapHit(want){
    if (!want || swingCd > 0 || held.hit) return false;
    swingCd = L.SW_TOT + 0.04 + brng() * 0.1;
    return true;
  }
  // снаряд, который стоит отбить: летит к герою, достигнет зоны удара в ближайшие ~0.3 с
  function reflectable(){
    const h = H(), f = h.face;
    let hit = null;
    for (const s of S.eshots){
      if (s.life <= 0 || L.NOREF[s.kind]) continue;
      const hw = s.hw || s.r || 0.3, hh = s.hh || s.r || 0.3;
      if (s.y + hh < h.y - 2.3 || s.y - hh > h.y) continue;                 // выше/ниже зоны удара
      const rel = (s.x - h.x) * f, vr = s.vx * f;
      if (vr >= -0.5 && !(s.g && Math.abs(s.vy) > 3)) continue;                // удаляется или не к герою
      const tt = (rel - L.REACH) / Math.max(1, -vr);                        // когда войдёт в охват
      if (rel < -0.6 || tt > 0.32) continue;
      if (!armed.has(s)) armed.set(s, brng() < parryP);                     // заметил ли
      if (!armed.get(s)) continue;
      hit = s; break;
    }
    return hit;
  }
  // цели на пути: ближний враг впереди в зоне досягаемости
  function foeInReach(){
    const h = H(), f = h.face;
    for (const e of S.enemies){
      if (e.dead || !inView(e.x) || !noticed(e)) continue;
      const rel = (e.x - h.x) * f - e.hw;
      if (rel > -0.3 && rel < L.REACH - 0.25 && e.y - e.hh < h.y && e.y > h.y - 2.3) return e;
    }
    return null;
  }
  function foeAhead(){
    const h = H(), f = Math.sign(h.face) || 1;
    let bestE = null, bd = 1e9;
    for (const e of S.enemies){
      if (e.dead || !inView(e.x) || !noticed(e) || e.type === 'turret' || ignoreFoe.has(e)) continue;
      const rel = (e.x - h.x) * f - e.hw;
      if (rel > 0 && rel < 4.2 && Math.abs(e.y - h.y) < 1.2 && rel < bd){ bd = rel; bestE = e; }
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
    for (const s of S.eshots) if (L.NOREF[s.kind] || (s.life > 0 && !armed.get(s))) check(s.x, s.y, s.vx, s.vy, s.hw || s.r, s.hh || s.r, s.kind, s.g);
    const b = S.boss;
    if (b && !b.dead && S.bossState === 'fight') check(b.x, b.y - b.hh / 2, b.vx || 0, b.fly ? (b.vy || 0) : 0, b.hw, b.hh / 2, 'boss');
    return out;
  }
  function bossPolicy(){
    const h = H(), b = S.boss, o = empty();
    if (!b || b.dead) return o;
    const side = h.x < b.x ? -1 : 1, ax = S.lv.arena.x0;
    let want = b.x + side * 6.5;
    if (b.key === 'fan' && b.mode === 'inhale') want = b.x + side * 12;
    if ((b.key === 'magnet' || b.key === 'core') && b.mode === 'aim') want = h.x + (h.x < b.x ? -4 : 4);
    if (b.key === 'bell' && b.mode === 'shake') want = b.x + side * 6;
    if (want < ax + 2 || want > ax + 24) want = Math.max(ax + 2, Math.min(ax + 24, want));
    if (Math.abs(want - h.x) > 0.6) o.dx = want > h.x ? 1 : -1;
    const facing = Math.sign(b.x - h.x) || 1;
    if (o.dx === 0 && h.face !== facing) o.dx = facing;
    const th = threat();
    if (th && h.ground && brng() < dodgeP){
      if (th.kind === 'boss' && (b.mode === 'dash' || b.mode === 'roll' || b.mode === 'charge')) { /* см. ниже */ }
      else if (th.low || th.kind === 'wave' || th.kind === 'boss') { o.jump = true; dodge = { t: 0.5, dx: 0 }; }
      else { dodge = { t: 0.35, dx: th.x < h.x ? 1 : -1 }; }
    }
    if (b.mode === 'dash' || b.mode === 'roll' || b.mode === 'charge' || b.mode === 'crouch') { o.dx = 0; o.jump = false; dodge = null; }
    return o;
  }
  function fightMini(e){
    const h = H(), o = empty();
    const side = h.x < e.x ? -1 : 1, m = S.lv.mini;
    let want = e.x + side * 5.5; want = Math.max(m.x0 + 1.5, Math.min(m.x1 - 0.8, want));
    if (Math.abs(want - h.x) > 0.6) o.dx = want > h.x ? 1 : -1;
    const facing = Math.sign(e.x - h.x) || 1;
    if (o.dx === 0 && h.face !== facing) o.dx = facing;
    const th = threat();
    if (th && h.ground && brng() < dodgeP){ if (th.low || th.kind === 'boss') o.jump = true; else dodge = { t: 0.3, dx: th.x < h.x ? 1 : -1 }; }
    if (e.type === 'drone' && e.mode === 'aim') dodge = { t: 0.5, dx: h.x < e.x ? -1 : 1 };
    if (Math.abs(e.x - h.x) < e.hw + 1.4 && h.ground && Math.abs(e.y - h.y) < 1) o.jump = true;
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
    if (swingCd > 0) swingCd -= dt;
    if (S.won || S.phase === 'won'){ res.won = true; break; }
    if (S.phase === 'over'){ res.over = true; break; }
    if (S.phase === 'clear' && opts.single){ break; }
    if (S.phase !== 'stage'){ game.setInput({}); held = empty(); game.update(dt); continue; }
    if (N.idx !== S.stage){ N = navFor(OZ, S.stage); lv = N.lv; plan = null; best = Infinity; bestT = S.time; }
    const h = H();
    let o = empty();
    const fighting = S.bossState === 'fight' || S.bossState === 'intro';
    const mini = S.miniState === 'fight' && S.mini && !S.mini.dead ? S.mini : null;
    wait -= dt;
    if (fighting || mini){
      plan = null;
      if (wait <= 0){
        wait = react();
        const pol = fighting ? bossPolicy() : fightMini(mini);
        curDx = pol.dx;
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
      // молот: отбить летящее, иначе ударить, что в охвате (мини-босс/Мастер — прямой удар слабее отбоя, но не лишний)
      const rf = reflectable();
      let want = !!rf && h.swingT <= 0;
      if (!want && wait < react() * 0.3){
        const tg = mini || (fighting && B && !B.dead && S.bossState === 'fight' ? B : null);
        if (tg && Math.abs(tg.x - h.x) - tg.hw < L.REACH - 0.3 && tg.y - tg.hh < h.y && tg.y > h.y - 2.3 && h.face === (Math.sign(tg.x - h.x) || 1)) want = true;
      }
      o.hit = tapHit(want);
    } else {
      // враг впереди — остановиться и бить; снаряд — отбить
      const rf = reflectable(), fr = foeInReach(), ah = foeAhead();
      const onGround = h.ground;
      if (rf && h.swingT <= 0 && wait <= 0.12){ o.hit = tapHit(true); if (plan && plan.stage !== 'approach') {} }
      if (!o.hit && fr && onGround && wait <= 0.1 && (!plan || plan.stage === 'approach')){ o.hit = tapHit(true); }
      if (ah !== waitFoe){ waitFoe = ah; waitFoeT = 0; }
      if (ah && onGround && (!plan || plan.stage === 'approach') && !fr && waitFoeT < 1.6){
        const f = Math.sign(ah.x - h.x) || 1; o.dx = h.face !== f ? f : 0;      // стоит и ждёт, пока подойдёт в охват (не дольше 1,6 с)
        waitFoeT += dt; if (waitFoeT >= 1.6) ignoreFoe.add(ah);
        if (wait <= 0) wait = 0.03;
      } else if (plan){ runPlan(o); }
      else if (wait <= 0){ if (h.ground){ plan = choosePlan(); wait = react() * 0.5; if (!plan) nudge = 0.25; } }
      if (!plan && nudge > 0){ nudge -= dt; o.dx = (h.x % 1) > 0.5 ? 1 : -1; if (!h.ground) o.dx = 0; }   // стоит между узлами графа — шаг к ближайшей клетке
      if (o.hit) { /* удар поверх движения — бот не прекращает макрос */ }
    }
    held = o;
    game.setInput(o); game.update(dt);
    if (!fighting && !mini && S.time - bestT > 30){ res.stuck = true; res.stuckAt = { st: S.stage, x: +H().x.toFixed(2), y: +H().y.toFixed(2) }; break; }
    if (fighting || mini) bestT = S.time;
  }
  res.t = +T.toFixed(1); res.score = S.score; res.lives = S.lives; res.hp = S.hero.hp;
  return res;
}

// один этап (для тестов проходимости): совместимость со старым именем
export function playStage(OZ, seed, opts = {}){ return playGame(OZ, seed, Object.assign({}, opts, { from: opts.stage || 0, single: true })); }
