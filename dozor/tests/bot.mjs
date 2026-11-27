/* ДОЗОР · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setDir(pi, dx, dy) (8 направлений, как клавиши), setFire(pi, held),
   sec(pi) (заслон), cont() (продолжение). Состояние читает только «глазами»:
   - решения раз в 150–250 мс (реакция), между решениями держит прежние клавиши;
   - видит только кадр камеры (за кадром враги, пули и пленные не учитываются);
   - пулю/снаряд замечает не сразу: при каждом «взгляде» пропускает её с вероятностью opts.miss (0.42);
     метку миномёта и поезд — один бросок на объект;
   - маршрут по полю прокладывает «на глаз» (поиск в ширину по видимым клеткам), вагоны подбирает, проезжая по ним; под крупных врагов и орудия встаёт по оси пулемёта.
   opts: { startStage=1, stages, players=1, miss=0.42, react:[0.15,0.25], maxStageT=420, continues=true, invuln=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playDozor(D, seed, opts = {}){
  const L = D.logic, T = L.T, COLS = L.COLS, start = opts.startStage || 1;
  const stages = opts.stages || (L.STAGES.length - start + 1);
  const brng = mulberry32(seed * 7919 + 101);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.42;
  const maxT = opts.maxStageT || 420;
  const ev = { deaths: 0, why: {}, hooks: 0, clears: [], conts: 0, lost: 0 };
  let S = null;
  const game = D.Game({ rng: mulberry32(seed), players: opts.players || 1, stage: start, maxStage: start + stages - 1,
    onEvent: (t, d) => {
      if (t === 'heroDie'){ ev.deaths++; ev.why[d.src] = (ev.why[d.src] || 0) + 1; }
      else if (t === 'hook') ev.hooks++;
      else if (t === 'clear') ev.clears.push({ stage: d.stage, t: tm });
      else if (t === 'continue') ev.conts++;
      else if (t === 'wagLostFar') ev.lost++;
    } }).start();
  S = game.state();
  const dt = 1 / 60, NP = S.heroes.length;
  const ctl = S.heroes.map(() => ({ seen: new WeakMap(), next: 0, dx: 0, dy: -1, fire: true, secAt: -1, contAt: -1, stuck: 0, lastY: 0 }));
  let t = 0, tm = 0, curStage = S.stage, stuck = false, contWait = 0;
  if (opts.invuln) S.heroes.forEach(h => { h.inv = 1e9; });

  const vis = (x, y) => y > S.camY - 4 && y < S.camY + L.VIEW_H + 4;
  const solid = (c, r) => game._cellSolid(c, r);
  const oct = (dx, dy) => { const a = Math.atan2(dy, dx); return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; };
  const OCT = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const noticed = (C, o, p) => { if (C.seen.get(o)) return true; const ok = brng() >= p; if (ok) C.seen.set(o, true); return ok; };

  // Поиск пути по видимым клеткам (от клетки машины до ближайшей клетки-цели)
  function path(H, goal){
    const rTop = Math.max(0, Math.floor(S.camY / T) - 1), rBot = Math.min(S.H - 1, Math.floor((S.camY + L.VIEW_H) / T));
    const sc = Math.floor(H.x / T), sr = Math.floor(H.y / T), W = COLS, prev = new Map(), q = [sc + sr * W];
    prev.set(q[0], -1);
    let found = -1, bestD = 1e9, bestK = -1;
    while (q.length){
      const k = q.shift(), c = k % W, r = (k - c) / W;
      const dd = Math.abs(c * T + T / 2 - goal.x) + Math.abs(r * T + T / 2 - goal.y);
      if (dd < bestD){ bestD = dd; bestK = k; }
      if (dd < T * 0.75){ found = k; break; }
      for (const [ax, ay] of [[0, -1], [1, 0], [-1, 0], [0, 1]]){
        const nc = c + ax, nr = r + ay; if (nc < 0 || nc >= W || nr < rTop || nr > rBot) continue;
        const nk = nc + nr * W; if (prev.has(nk) || solid(nc, nr)) continue;
        if (S.enemies.some(e => !e.dead && e.solid && e.active && Math.abs(e.x - (nc * T + T / 2)) < e.r + 8 && Math.abs(e.y - (nr * T + T / 2)) < e.r + 8)) continue;
        prev.set(nk, k); q.push(nk);
      }
    }
    let k = found >= 0 ? found : bestK; const cells = [];
    while (k >= 0){ cells.push(k); k = prev.get(k); }
    cells.reverse();
    return { cells, reached: found >= 0, d: bestD };
  }
  function steer(H, goal, C){
    const p = path(H, goal);
    let tx = goal.x, ty = goal.y;
    if (p.cells.length > 1){ const k = p.cells[Math.min(p.cells.length - 1, 1)], c = k % COLS, r = (k - c) / COLS; tx = c * T + T / 2; ty = r * T + T / 2; if (p.cells.length === 2 && p.reached){ tx = goal.x; ty = goal.y; } }
    else if (!p.reached && p.cells.length <= 1) { tx = goal.x; ty = goal.y; }
    const dx = tx - H.x, dy = ty - H.y;
    return { dx: Math.abs(dx) > 3 ? Math.sign(dx) : 0, dy: Math.abs(dy) > 3 ? Math.sign(dy) : 0, p };
  }

  function decide(pi){
    const H = S.heroes[pi], C = ctl[pi];
    if (!H.alive){ C.dx = 0; C.dy = 0; return; }
    let dx = 0, dy = -1, goal = null, why = 'adv';
    const standOff = 110;
    const B = S.boss && S.boss.active && !S.boss.dead ? S.boss : null;
    const loose = S.loose.filter(p => vis(p.x, p.y) && p.y < H.y + 90 && p.y > H.y - 200).sort((a, b) => dist(a, H) - dist(b, H));
    const dep = S.depots.filter(b => !b.dead && vis(b.x, b.y) && b.y < H.y - 10).sort((a, b) => dist(a, H) - dist(b, H))[0];
    const foes = S.enemies.filter(e => !e.dead && e.active && vis(e.x, e.y)).sort((a, b) => dist(a, H) - dist(b, H));
    if (loose.length && H.wag.length < L.WAG.max) { goal = { x: loose[0].x, y: loose[0].y }; why = 'hook'; }
    else if (dep && dep.y > S.camY + 40) { goal = { x: dep.x, y: dep.y + 60 }; why = 'dep'; }
    else if (B) {
      const gun = foes.find(e => e.boss);
      if (gun) goal = { x: gun.x, y: gun.y + 96 }; else goal = { x: B.x + Math.sin(t * 0.9) * 70, y: B.y1 + 90 };
      why = 'boss';
    }
    // крупные враги впереди — подровняться под пулемёт / довернуть второе оружие
    const big = foes.find(e => C.seen.get(e) !== 'skip' && (e.type === 'tank' || e.type === 'turret' || e.type === 'cannon' || e.type === 'boat' || e.type === 'heli') && dist(e, H) < 300 && e.y < H.y - 30 && e.y + 110 < S.camY + L.VIEW_H - 30);
    const colClear = e => { for (let y = e.y + 14; y < e.y + 108; y += 12) if (L.blockB(S.grid[Math.floor(y / T) * COLS + Math.floor(e.x / T)])) return false; return true; };
    if (big && why === 'adv' && colClear(big)){
      if (C.bigO !== big){ C.bigO = big; C.bigT = t; }
      if (t - C.bigT > 9) C.seen.set(big, 'skip');
    }
    if (big && why === 'adv' && colClear(big) && C.seen.get(big) !== 'skip') goal = { x: big.x, y: Math.min(big.y + 110, S.camY + L.VIEW_H - 40) }, why = 'big';
    if (!goal) goal = { x: H.x + (brng() - 0.5) * 30, y: H.y - 8 * T };
    // поезд: пока идёт/гудит — не лезть на рельсы
    for (const tr of S.trains){
      if (tr.done || !(tr.state === 'run' || tr.state === 'warn')) continue;
      if (!noticed(C, tr, 0.15)) continue;
      if (H.y > tr.y - 10 && H.y < tr.y + 70 && goal.y < tr.y + 40){ goal = { x: H.x, y: tr.y + 62 }; why = 'train'; }
      if (H.y <= tr.y - 10 && H.y > tr.y - 50 && goal.y > tr.y - 60){ goal = { x: H.x, y: tr.y - 58 }; }
    }
    goal.y = Math.min(goal.y, S.camY + L.VIEW_H - 34);
    const st = steer(H, goal, C); dx = st.dx; dy = st.dy;
    // --- уклонение: замеченные пули и метки ---
    // кандидаты: 8 направлений и «стоять»; для каждого — ближайший пролёт замеченных пуль за 0.7 с
    const threats = S.ebullets.filter(b => vis(b.x, b.y) && Math.hypot(b.x - H.x, b.y - H.y) < 260 && noticed(C, b, miss));
    let danger = false;
    const clearance = (mx, my) => {
      let worst = 1e9;
      for (const b of threats){
        for (let k = 1; k <= 7; k++){ const tt = k * 0.1, hx = H.x + mx * L.SPEED * Math.min(tt, 0.35), hy = H.y + my * L.SPEED * Math.min(tt, 0.35);
          const d = Math.hypot(b.x + b.vx * tt - hx, b.y + b.vy * tt - hy) - b.r; if (d < worst) worst = d; }
      }
      return worst;
    };
    if (threats.length){
      const here = clearance(dx / (Math.hypot(dx, dy) || 1), dy / (Math.hypot(dx, dy) || 1));
      if (here < 17){
        danger = true;
        let best = null, bv = -1e9;
        for (const [ox, oy] of OCT.concat([[0, 0]])){
          const l = Math.hypot(ox, oy) || 1, mx = ox / l, my = oy / l;
          if ((ox || oy) && !game._boxFree(H.x + mx * 20, H.y + my * 20, L.HB)) continue;
          if (H.x + mx * 20 < 14 || H.x + mx * 20 > L.VIEW_W - 14 || H.y + my * 20 > S.camY + L.VIEW_H - 18) continue;
          const v = Math.min(40, clearance(mx, my)) + (ox === dx && oy === dy ? 2 : 0);
          if (v > bv){ bv = v; best = [ox, oy]; }
        }
        if (best){ dx = best[0]; dy = best[1]; }
      }
    }
    for (const m of S.marks){ if (Math.hypot(m.x - H.x, m.y - H.y) < 40 && noticed(C, m, 0.2)){ const a = Math.atan2(H.y - m.y, H.x - m.x); dx = Math.round(Math.cos(a)); dy = Math.round(Math.sin(a)); if (!dx && !dy) dx = 1; danger = true; } }
    C.dx = dx; C.dy = dy;
    if (opts.trace) opts.trace(t, pi, why, goal, H, dx, dy, danger);
    C.fire = true;
  }
  function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }

  while (true){
    if (S.phase === 'won' || S.over) break;
    if (S.stage !== curStage){ curStage = S.stage; tm = 0; }
    if (S.phase === 'cont'){
      contWait += dt;
      if (opts.continues !== false && contWait > 1.2){ game.cont(); contWait = 0; }
    }
    if (S.phase === 'play'){
      for (let pi = 0; pi < NP; pi++){
        const C = ctl[pi];
        if (t >= C.next){ decide(pi); C.next = t + r0 + brng() * (r1 - r0); }
        game.setDir(pi, C.dx, C.dy); game.setFire(pi, C.fire);
        if (C.secAt >= 0 && t >= C.secAt){ game.sec(pi); C.secAt = -1; }
      }
    }
    game.update(dt); t += dt; tm += dt;
    if (opts.invuln) S.heroes.forEach(h => { h.inv = 1e9; });
    if (tm > maxT){ stuck = true; break; }
  }
  const passed = S.won ? S.maxStage - start + 1 : S.stage - start;
  return { seed, won: S.won, passed, stage: S.stage, score: S.score, time: t, stuck, deaths: ev.deaths, why: ev.why, hooks: ev.hooks, conts: ev.conts, lost: ev.lost, clears: ev.clears };
}
