/* ЧАЙНИК · tests/bot.mjs — «человеческий» бот и проверки проходимости по настоящей физике игры.
   Бот-платформер: каждые 150–250 мс (реакция) выбирает макро-действие (бег, прыжок с разной длиной удержания,
   хват за крюк и раскачка с отпуском, ожидание), прокручивая кандидатов на копии состояния (snapshot/restore) —
   «представляет», что будет. Исполнение — с человеческим шумом: момент прыжка/отпуска гуляет на ±timing,
   часть врагов замечает поздно (miss — в оценке не учитывает урон), иногда «засматривается» (lapse).
   Маршрут — точки уровня (человек знает, куда идти). Пар включает сам, если враг перед носиком; кипяток — по заряду.
   opts: { react:[0.15,0.25], timing=0.04, miss=0.12, lapse=0.02, god=false, maxT=300, perfect=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const T = 16;
// маршруты (клетки: столбец, ряд опоры — герой стоит на верхней грани ряда)
export const ROUTES = {
  1: [[32, 15], [50, 18], [65, 15], [69, 12], [73, 9], [79, 9], [84, 18], [98, 18], [115, 18], [132, 18], [134, 14], [140, 12], [145, 11], [152, 14], [162, 18], [181, 18], [200, 18], [206, 18], [222, 18], [228, 18], [232, 14], [236, 11], [252, 12], [264, 18], [272, 18], [291, 18], [302, 18], [310, 18], [328, 18]],
  3: [[31, 97], [27, 78], [17, 74], [7, 70], [6, 50], [11, 50], [20, 50], [24, 46], [31, 42], [34, 42], [30, 29], [21, 27], [13, 25], [6, 23], [8, 23], [16, 7], [23, 7], [32, 5]],
  6: null
};

function heroOf(S){ return S.hero; }

// оценка состояния: прогресс по маршруту, штрафы за урон и гибель
function makeEval(route){
  return function(S, base){
    if (S.phase === 'clear' || S.phase === 'won') return 1e9;
    if (S.phase === 'dead' || S.phase === 'over') return -1e9;
    const h = heroOf(S); let idx = S._wi || 0;
    const wp = route[Math.min(idx, route.length - 1)], wx = wp[0] * T + 8, wy = wp[1] * T;
    let v = idx * 10000 - Math.hypot(h.x - wx, (h.y - wy) * 1.3);
    v -= (base.hp - h.hp) * 2500;
    if (S.level === 3) v += S.warm * 300;
    return v;
  };
}
function advance(S, route){
  const h = heroOf(S); let i = S._wi || 0;
  while (i < route.length){ const wp = route[i]; if (Math.abs(h.x - (wp[0] * T + 8)) < 30 && Math.abs(h.y - wp[1] * T) < 10 && (h.ground || S.level === 3)) i++; else break; }
  S._wi = i;
}

// макро-действия: список кадров ввода {x,y,jump,fire}
function macros(S, dirGoal){
  const h = S.hero, out = [];
  const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  if (h.hook){
    for (const n of [4, 10, 16, 22, 28, 36, 44, 54, 66, 80]) for (const rel of [1, -1]) {
      out.push({ name: 'swing' + n + (rel > 0 ? 'R' : 'L'), f: seq(n + 1, i => i < n ? { x: 'pump', y: 0, jump: false } : { x: rel, y: 0, jump: true }) });
    }
    return out;
  }
  for (const d of [dirGoal, -dirGoal]) {
    out.push({ name: 'run6' + d, f: seq(6, () => ({ x: d, y: 0, jump: false })) });
    out.push({ name: 'run14' + d, f: seq(14, () => ({ x: d, y: 0, jump: false })) });
    for (const hold of [5, 12, 30]) for (const pre of [0, 6]) for (const up of [0, 1]) {
      if (up && hold < 12) continue;
      out.push({ name: `j${d}_${pre}_${hold}${up ? 'u' : ''}`, f: seq(pre + 34, i => ({ x: d, y: up && i > pre + 4 ? -1 : 0, jump: i >= pre && i < pre + hold })) });
    }
  }
  out.push({ name: 'jump0', f: seq(30, i => ({ x: 0, y: 0, jump: i < 30 })) });
  out.push({ name: 'wait', f: seq(10, () => ({ x: 0, y: 0, jump: false })) });
  out.push({ name: 'drop', f: seq(14, () => ({ x: dirGoal, y: 1, jump: false })) });
  return out;
}

function frameInput(S, fr, auto){
  let x = fr.x;
  if (x === 'pump'){ const k = S.hero.hook; x = k ? (k.w * Math.cos(k.th) >= 0 ? 1 : -1) : 0; }
  return { x, y: fr.y, jump: fr.jump, fire: auto.fire, boil: auto.boil };
}

// автоматика «рук»: пар по врагу перед носиком, кипяток по заряду (по тостеру / магниту / боссу)
function autoFire(CH, S, LV){
  const h = S.hero, out = { fire: false, boil: false, aim: 0 };
  if (!h) return out;
  let near = null, nd = 1e9;
  for (const e of S.enemies){ if (e.dead) continue; const dx = e.x - h.x, dy = (e.y - 6) - (h.y - 14); const d = Math.hypot(dx, dy); if (d < nd){ nd = d; near = { e, dx, dy }; } }
  if (near && nd < 120 && Math.abs(near.dy) < 30 && Math.sign(near.dx) === h.face && S.heat < 0.85) out.fire = true;
  if (near && nd < 90 && near.dy < -30 && Math.abs(near.dx) < 30 && S.heat < 0.85) { out.fire = true; out.aim = -1; }
  if (S.charge >= 1){
    if (near && near.e.k === 'toaster' && nd < 240 && Math.sign(near.dx) === h.face && Math.abs(near.dy) < 30) out.boil = true;
    for (const m of LV.magnets || []) if (!S.magOff[m.id] && Math.abs(m.x - h.x) < 140 && Math.sign(m.x - h.x) === h.face) out.boil = false;
  }
  return out;
}

export function playLevel(CH, level, seed = 1, opts = {}){
  const o = Object.assign({ react: [0.15, 0.25], timing: 0.04, miss: 0.12, lapse: 0.02, god: false, maxT: 300, perfect: false, lives: 3 }, opts);
  if (o.perfect){ o.react = [0.1, 0.1]; o.timing = 0; o.miss = 0; o.lapse = 0; }
  const rng = mulberry32(seed * 7919 + level);
  const ev = { hurt: 0, die: [] };
  const game = CH.Game({ seed, level, god: o.god, lives: o.lives, onEvent: (t, d) => { if (t === 'hurt') ev.hurt++; if (t === 'die') ev.die.push(d.kind); } }).start();
  const route = ROUTES[level], dt = 1 / 60, LV = game.level();
  const evalFn = makeEval(route);
  let plan = [], planI = 0, nextDecide = 0, t = 0, stuckT = 0, bestWi = 0, lapse = 0, lastDeaths = 0;
  const S0 = () => game.state();
  while (t < o.maxT){
    const S = S0();
    if (S.level !== level || S.phase === 'clear' || S.phase === 'won') return { cleared: true, time: S.lvT, deaths: ev.die.length, why: ev.die, hurt: ev.hurt, seed };
    if (S.phase === 'over') return { cleared: false, over: true, time: t, deaths: ev.die.length, why: ev.die, hurt: ev.hurt, wi: S._wi || 0, seed };
    if (S.phase === 'play' && S.deaths !== lastDeaths){   // после возрождения — к ближайшей точке маршрута
      lastDeaths = S.deaths; let bi = 0, bd = 1e9;
      route.forEach((w, i) => { const d = Math.hypot(w[0] * T + 8 - S.hero.x, w[1] * T - S.hero.y); if (d < bd){ bd = d; bi = i; } });
      S._wi = bi; bestWi = Math.min(bestWi, bi);
    }
    advance(S, route);
    if ((S._wi || 0) > bestWi){ bestWi = S._wi; stuckT = 0; } else stuckT += dt;
    if (stuckT > 7 && Math.floor((stuckT - dt) / 7) !== Math.floor(stuckT / 7)){   // «не выходит» — вернуться на шаг маршрута назад
      let bi = 0, bd = 1e9;
      route.forEach((w, i) => { const d = Math.hypot(w[0] * T + 8 - S.hero.x, w[1] * T - S.hero.y); if (d < bd){ bd = d; bi = i; } });
      S._wi = Math.max(0, Math.min(S._wi || 0, bi) - 1); bestWi = S._wi;
    }
    if (stuckT > 40) return { cleared: false, stuck: true, time: t, deaths: ev.die.length, why: ev.die, wi: S._wi || 0, x: S.hero.x, y: S.hero.y, seed };
    if (S.phase === 'play' && t >= nextDecide){
      nextDecide = t + o.react[0] + rng() * (o.react[1] - o.react[0]);
      if (lapse <= 0 && rng() < o.lapse) lapse = 0.3 + rng() * 0.3;
      // кандидаты оцениваются от текущего состояния с учётом «ещё не отпущенных» кадров прежнего плана
      const snap = game.snapshot(), miss = rng() < o.miss;
      const wp = route[Math.min(S._wi || 0, route.length - 1)], dirGoal = (wp[0] * T + 8) >= S.hero.x ? 1 : -1;
      const lag = Math.round((nextDecide - t) / dt);
      const auto = autoFire(CH, S, LV);
      let best = null, bestV = -Infinity;
      game.mute(true);
      for (const m of macros(S, dirGoal)){
        game.restore(snap); const st = game.state(); st._wi = S._wi;
        const base = { hp: S.hero.hp };
        let dead = false;
        // макро + «досмотр»: без ввода, пока не встанем на опору / не повиснем (до 1,5 с)
        for (let i = 0; i < m.f.length + 90; i++){
          const fr = i < m.f.length ? m.f[i] : { x: 0, y: 0, jump: false };
          game.setInput(frameInput(st, fr, i < m.f.length ? auto : {})); game.update(dt); advance(st, route);
          if (st.phase !== 'play'){ dead = st.phase === 'dead'; break; }
          if (i >= m.f.length + 6 && (st.hero.ground || st.hero.hook)) break;
        }
        let v = evalFn(st, base);
        if (miss && !dead) v += (base.hp - st.hero.hp) * 2500;
        if (v > bestV){ bestV = v; best = m; }
      }
      game.restore(snap); game.state()._wi = S._wi;
      game.mute(false);
      // шум исполнения: сдвиг момента нажатий
      let f = best.f.slice();
      const sh = Math.round(((rng() * 2 - 1) * o.timing) / dt);
      if (sh > 0) f = Array(sh).fill(f[0]).concat(f); else if (sh < 0) f = f.slice(-sh);
      plan = f; planI = 0;
    }
    const st = S0();
    let fr = plan[planI++] || { x: 0, y: 0, jump: false };
    if (lapse > 0){ lapse -= dt; fr = { x: 0, y: 0, jump: false }; }
    const auto = autoFire(CH, st, LV);
    const inp = frameInput(st, fr, auto); if (auto.aim < 0 && !inp.jump && fr.y === 0) inp.y = -1;
    game.setInput(inp); game.update(dt); t += dt;
  }
  const S = S0();
  return { cleared: false, timeout: true, time: t, deaths: ev.die.length, why: ev.die, wi: S._wi || 0, seed };
}

// ---------- гонка: простая «человеческая» политика ----------
export function playRace(CH, seed = 1, opts = {}){
  const o = Object.assign({ react: 0.2, jump: true, boost: true, jumpJam: true, maxT: 120 }, opts);
  const game = CH.Game({ seed, level: 2, god: false, lives: 9 }).start(), L = CH.logic, TR = L.TRACK, dt = 1 / 60;
  const rng = mulberry32(seed * 31 + 2);
  let t = 0, jumpUntil = 0, seen = {}, lastFall = 0, react = o.react;
  while (t < o.maxT){
    const S = game.state();
    if (S.level !== 2 || S.phase === 'clear') return { won: true, time: S.race ? S.race.time : t, rivalX: S.race ? S.race.rx : null, margin: S.race ? TR.len - S.race.rx : 0 };
    if (S.phase === 'dead') return { won: false, time: t, x: S.race.x, rx: S.race.rx };
    const R = S.race; let jump = t < jumpUntil;
    if (R.fall > 0 && !lastFall){ seen = {}; } lastFall = R.fall > 0 ? 1 : 0;
    if (o.jump && !R.air && R.count <= 0){
      for (const ob of TR.obs){
        if (seen[ob.id] || R.got[ob.id] || !(ob.k === 'crumb' || ob.k === 'shaker' || ob.k === 'hole' || (ob.k === 'jam' && o.jumpJam))) continue;
        // человек замечает препятствие с запаздыванием реакции и прыгает «на глаз» (разброс ±40 мс)
        const d = ob.x - R.x, lead = R.v * (0.12 + (rng() - 0.5) * 0.08) + 24;
        if (d > 0 && d < lead + 10){ seen[ob.id] = 1; jumpUntil = t + 0.22 + rng() * 0.1; jump = true; break; }
      }
    }
    const boost = o.boost && S.heat < 0.7 && !S.over;
    game.setInput({ x: 1, y: 0, jump, fire: boost, boil: false }); game.update(dt); t += dt;
  }
  return { won: false, timeout: true };
}

// ---------- головоломка: прогон найденного решения через настоящую игру ----------
export function playPuzzle(CH, actions){
  const game = CH.Game({ seed: 1, level: 4 }).start(), dt = 1 / 60;
  for (const a of actions){
    const S = game.state(); if (S.phase !== 'play') break;
    // ждём окончания анимации шага
    let g = 0; while (game.state().pz.anim > 0 && g++ < 60) { game.setInput({}); game.update(dt); }
    if (a[0] === 'p'){ const d = a[1], v = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[d]; game._pzFace = d; game.state().pz.s.f = d; game.setInput({ fire: true }); game.update(dt); game.setInput({}); game.update(dt); }
    else { const v = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[a]; game.setInput({ x: v[0], y: v[1] }); game.update(dt); game.setInput({}); game.update(dt); }
  }
  for (let i = 0; i < 30; i++){ game.setInput({}); game.update(dt); }
  const S = game.state();
  return { cleared: S.level === 5 || S.phase === 'clear', moves: S.pz ? S.pz.moves : null, phase: S.phase };
}

// ---------- полёт: бот уклонения (видит пули и врагов, держит дистанцию) ----------
export function playFly(CH, seed = 1, opts = {}){
  const o = Object.assign({ god: false, react: 0.2, maxT: 200, lives: 3 }, opts);
  const game = CH.Game({ seed, level: 5, god: o.god, lives: o.lives }).start(), dt = 1 / 60, rng = mulberry32(seed * 13 + 5);
  let t = 0, nd = 0, cmd = { x: 0, y: 0 };
  const deaths = [];
  while (t < o.maxT){
    const S = game.state();
    if (S.level !== 5 || S.phase === 'clear') return { cleared: true, time: S.lvT, deaths: deaths.length };
    if (S.phase === 'over') return { cleared: false, time: t, deaths: deaths.length };
    if (S.phase === 'dead' && !deaths.includes(S.deaths)) deaths.push(S.deaths);
    const F = S.fly;
    if (F && t >= nd){
      nd = t + o.react * (0.75 + rng() * 0.5);
      // цель по вертикали: ближайший враг впереди; уклон от пуль/врагов, близких по курсу
      let ty = F.y, tx = 140;
      const foes = S.enemies.filter(e => !e.dead && e.x > F.x - 10);
      if (foes.length){ foes.sort((a, b) => a.x - b.x); ty = foes[0].y; }
      if (F.boss && !F.boss.dead){
        const B = F.boss; ty = 200;
        if (B.st === 'aim' || B.st === 'slam'){ const side = F.x < B.col ? -1 : 1; tx = B.col + side * 120; if (tx < 40) tx = B.col + 120; if (tx > 470) tx = B.col - 120; }
        else tx = Math.max(40, B.x - 130);
      }
      // уклон: ближайшая угроза, которая через ~0,5 с окажется рядом
      let thr = null, td = 1e9;
      for (const s of S.eshots.concat(S.enemies.filter(e => (e.k === 'moth' && e.mode === 1) || e.k === 'flake' || (e.k === 'bee' && e.t > 9)))){
        const fx = s.x + (s.vx || -150) * 0.4, fy = s.y + (s.vy || 0) * 0.4, d = Math.hypot(fx - F.x, (fy - F.y) * 1.5);
        if (d < 90 && d < td){ td = d; thr = { y: fy }; }
      }
      if (thr) ty = thr.y > F.y ? F.y - 90 : F.y + 90;
      ty = Math.max(60, Math.min(320, ty));
      cmd = { x: Math.abs(tx - F.x) > 12 ? Math.sign(tx - F.x) : 0, y: Math.abs(ty - F.y) > 8 ? Math.sign(ty - F.y) : 0 };
    }
    const fire = S.heat < 0.8 && !S.over, boil = S.charge >= 1 && ((F && F.boss && !F.boss.dead && Math.abs(F.boss.x - F.x - 120) < 140) || S.enemies.length > 4);
    game.setInput({ x: cmd.x, y: cmd.y, jump: false, fire, boil }); game.update(dt); t += dt;
  }
  return { cleared: false, timeout: true };
}

// ---------- босс: бот с планированием уклонения + стрельба ----------
export function playBoss(CH, seed = 1, opts = {}){
  const o = Object.assign({ god: false, maxT: 300, lives: 3 }, opts);
  const game = CH.Game({ seed, level: 6, god: o.god, lives: o.lives }).start(), dt = 1 / 60, rng = mulberry32(seed * 17 + 6);
  let t = 0, plan = [], pi = 0, nd = 0;
  const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  while (t < o.maxT){
    const S = game.state();
    if (S.phase === 'clear' || S.phase === 'won') return { cleared: true, time: S.lvT, deaths: S.lvDeaths };
    if (S.phase === 'over') return { cleared: false, time: t, deaths: S.lvDeaths };
    const B = S.boss, h = S.hero;
    const targets = B.parts.filter(p => !p.dead && !(p.k === 'teapot' && B.parts.some(q => q.k !== 'teapot' && !q.dead)));
    const tgt = targets[0];
    if (S.phase === 'play' && t >= nd){
      nd = t + 0.15 + rng() * 0.1;
      const snap = game.snapshot(); game.mute(true);
      let best = null, bv = -Infinity;
      const cands = [];
      for (const d of [-1, 1, 0]) { cands.push(seq(12, () => ({ x: d, jump: false }))); for (const hold of [8, 30]) cands.push(seq(36, i => ({ x: d, jump: i < hold, y: i > 10 ? -1 : 0 }))); }
      if (h.hook) { cands.length = 0; for (const n of [6, 14, 24, 36]) for (const r of [-1, 1]) cands.push(seq(n + 1, i => i < n ? { x: 'pump' } : { x: r, jump: true })); }
      for (const f of cands){
        game.restore(snap); const st = game.state();
        for (let i = 0; i < f.length + 20; i++){ const fr = f[i] || { x: 0 }; let x = fr.x; if (x === 'pump'){ const k = st.hero.hook; x = k ? (k.w * Math.cos(k.th) >= 0 ? 1 : -1) : 0; } game.setInput({ x, y: fr.y || 0, jump: !!fr.jump }); game.update(dt); if (st.phase !== 'play') break; }
        let v = st.phase === 'dead' ? -1e9 : st.phase === 'clear' ? 1e9 : 0;
        if (st.phase === 'play'){
          v -= (h.hp - st.hero.hp) * 1000;
          const tg = st.boss.parts.find(p => tgt && p.k === tgt.k) || st.boss.lid;
          if (st.boss.lid) v -= Math.abs(st.boss.lid.x - st.hero.x);
          else if (tg){
            // бьём с «внешней» стороны поезда: сахарницу — слева, молочник — справа; у стены — с другой стороны
            const A = game.level().arena; let side = tg.k === 'sugar' ? -1 : tg.k === 'creamer' ? 1 : (st.hero.x < tg.x ? -1 : 1);
            let want = tg.x + side * 120; if (want < A.x0 + 20 || want > A.x1 - 20) want = tg.x - side * 120;
            v -= Math.abs(st.hero.x - want) * 0.5;
          }
        }
        if (v > bv){ bv = v; best = f; }
      }
      game.restore(snap); game.mute(false); plan = best; pi = 0;
    }
    const st = game.state(), hh = st.hero;
    let fr = plan[pi++] || { x: 0 }; let x = fr.x; if (x === 'pump'){ const k = hh.hook; x = k ? (k.w * Math.cos(k.th) >= 0 ? 1 : -1) : 0; }
    // стрельба: повернуться к цели, когда стоим
    let fire = false, boil = false;
    if (tgt && st.phase === 'play' && !hh.hook){
      const dx = tgt.x - hh.x;
      if (Math.abs(dx) < 200 && Math.sign(dx) === hh.face){ fire = st.heat < 0.85 && tgt.temp < 0.7; boil = st.charge >= 1 && (tgt.temp >= 0.5 || st.heat > 0.6); }
      if (Math.abs(dx) < 200 && Math.sign(dx) !== hh.face && hh.ground && !fr.jump && fr.x === 0) x = Math.sign(dx);
    }
    game.setInput({ x, y: fr.y || 0, jump: !!fr.jump, fire, boil }); game.update(dt); t += dt;
  }
  return { cleared: false, timeout: true, cracks: game.state().boss.parts.map(p => p.k + ':' + p.cracks).join(',') };
}
