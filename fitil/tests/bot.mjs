/* ФИТИЛЬ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: видит то же, что на экране (поле, бомбы с фитилями, пламя, врагов, бонусы,
   открытый люк; спрятанные под ящиками бонусы НЕ видит), управляет как игрок —
   setDir(направление), bomb(), detonate().
   Человеческие ограничения:
   - решает не каждый кадр, а раз в `react` (0.12–0.22 с) — между решениями держит клавишу;
   - запас по времени при бегстве от взрыва `margin`; иногда (`blunder`) ставит бомбу,
     не проверив путь отхода, и иногда (`late`) запаздывает с бегством;
   - врагов обходит, но оценивает их только по текущей клетке.
   Стратегия: убежать из зоны взрыва → в открытый люк → за видимым бонусом →
   к лучшей точке для бомбы (ящики/враги в кресте) с проверкой пути отхода → поставить → отойти.
   opts: { players=1, levels=9, startLevel=1, lives=3, react:[0.12,0.22], blunder=0.03, margin=0.25,
           maxLevelT=240, perfect=false, ff=false }
   perfect: true — бот без задержки и ошибок (проверка проходимости). */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function makeBrain(F, game, pi, brng, opts = {}){
  const L = F.logic, S = game.state(), perfect = !!opts.perfect;
  const [r0, r1] = opts.react || [0.12, 0.22];
  const react = perfect ? 1 / 60 : r0 + brng() * (r1 - r0);
  const blunder = perfect ? 0 : (opts.blunder == null ? 0.03 : opts.blunder);
  const late = perfect ? 0 : (opts.late == null ? 0.04 : opts.late);
  const margin = opts.margin == null ? 0.25 : opts.margin;
  const hide = opts.hide == null ? 1 : opts.hide;   // доля «огня» после взрыва, которую укрытие должно продержаться без врагов
  const room = opts.room == null ? 3 : opts.room;
  const cap = opts.cap || 1;   // сколько своих бомб держит на поле разом (осторожный игрок — одну)
  const N = L.COLS * L.ROWS, idx = L.idx, DIRS = L.DIRS;
  let nextDecide = 0, dir = [0, 0], goal = null, plan = null, lateT = 0, mode = null, holdT = 0;

  const me = () => S.players[pi];
  const speedOf = p => L.BASE_SPEED + p.speed * L.SPEED_STEP;
  const R = Math.round;

  // Окна опасности по клеткам: [[from,to],…] — с учётом цепочек
  function dangerMap(extra){
    // бомба на РЕЛЕ рванёт когда угодно: её крест опасен «навсегда»; свою бот подорвёт сам, выйдя из креста (на отход — как фитиль)
    const bombs = S.bombs.map(b => ({ x: R(b.x), y: R(b.y), r: b.r, t: b.relay ? (b.owner === pi ? L.FUSE : 1.4) : Math.max(0, b.fuse), relay: b.relay }));
    if (extra) bombs.push(extra);
    let changed = true, guard = 0;
    const cells = bombs.map(b => L.blast(S.grid, b.x, b.y, b.r));
    while (changed && guard++ < 20){
      changed = false;
      for (let i = 0; i < bombs.length; i++) for (const c of cells[i]) for (let j = 0; j < bombs.length; j++)
        if (j !== i && bombs[j].x === c.x && bombs[j].y === c.y && bombs[j].t > bombs[i].t){ bombs[j].t = bombs[i].t; changed = true; }
    }
    const win = new Array(N);
    for (let i = 0; i < bombs.length; i++) for (const c of cells[i]){
      const k = idx(c.x, c.y); (win[k] || (win[k] = [])).push([bombs[i].t, bombs[i].relay ? 1e9 : bombs[i].t + L.FLAME_T]);
    }
    for (const k in S.flames){ (win[k] || (win[k] = [])).push([0, S.flames[k].t]); }
    return win;
  }
  // Когда враг может оказаться в клетке (с): BFS по его проходимости; бродячие — «медленнее» (идут не к нам)
  // бомбы врагам не пройти — учитываем (extra — клетка задуманной бомбы)
  function enemyBlock(extra){
    const T = new Float32Array(N).fill(1e9), bs = bombSet(); if (extra != null) bs.add(extra);
    const one = (ex, ey, sp, crates, k, pad) => {
      const d = L.bfs(R(ex), R(ey), (x, y) => { const i = idx(x, y), c = S.grid[i]; return !bs.has(i) && (c === L.FLOOR || (crates && c === L.CRATE)); });
      for (let c = 0; c < N; c++) if (d[c] >= 0){ const t = Math.max(0, (d[c] - pad) / (sp * k)); if (t < T[c]) T[c] = t; }
    };
    for (const e of S.enemies){
      const k = (e.type === 'chaser' || e.type === 'fast') ? 1 : 0.85;
      one(e.x, e.y, e.speed, e.type === 'ghost', k, 0.6);
    }
    const B = S.boss;
    if (B && B.alive) one(B.x, B.y, B.speed, false, 1, 1.4);
    return T;
  }
  const NOENEMY = new Float32Array(N).fill(1e9);
  const bombSet = () => { const s = new Set(); for (const b of S.bombs) s.add(idx(R(b.x), R(b.y))); return s; };

  // BFS с учётом времени прихода. → {dist[], prev[], t[]}
  function search(sx, sy, win, blk, bombs, sp, opt = {}){
    const dist = new Int16Array(N).fill(-1), prev = new Int16Array(N).fill(-1);
    const step = 1 / sp, q = [idx(sx, sy)]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++){
      const c = q[h], x = c % L.COLS, y = (c / L.COLS) | 0, d = dist[c];
      for (const [dx, dy] of DIRS){
        const nx = x + dx, ny = y + dy, n = idx(nx, ny);
        if (!L.inside(nx, ny) || dist[n] >= 0 || S.grid[n] !== L.FLOOR || bombs.has(n)) continue;
        const ta = (d + 1) * step;
        if (blk[n] < ta + step + 0.15) continue;
        if (win[n] && win[n].some(([a, b]) => ta - margin < b && ta + step + margin > a)) continue;
        if (opt.maxD && d + 1 > opt.maxD) continue;
        dist[n] = d + 1; prev[n] = c; q.push(n);
      }
    }
    return { dist, prev, step };
  }
  function firstStep(res, from, to){
    let c = to; if (c === from) return null;
    while (res.prev[c] !== from && res.prev[c] >= 0) c = res.prev[c];
    return res.prev[c] === from ? c : null;
  }
  // Ближайшая безопасная клетка, куда успеть
  // Куда отойти: безопасная от взрывов клетка с наибольшим запасом времени до врагов.
  // blkPath — враги при поиске пути (NOENEMY — игнорировать), blkScore — для оценки запаса.
  function escape(sx, sy, win, blkPath, bombs, sp, blkScore){
    const res = search(sx, sy, win, blkPath, bombs, sp), bs = blkScore || blkPath;
    let best = -1, bd = 1e9;
    for (let c = 0; c < N; c++){
      if (res.dist[c] < 0 || win[c]) continue;
      if (res.dist[c] === 0 && bs[c] < 0.8) continue;   // стоять на месте — не укрытие, если враг рядом
      const tt = res.dist[c] * res.step;
      const slack = bs[c] - tt, pen = slack < 2 ? (2 - slack) * 2 : 0;
      const v = tt + pen + (res.dist[c] === 0 ? 0.3 : 0);
      if (v < bd){ bd = v; best = c; }
    }
    return best < 0 ? null : { cell: best, res };
  }
  function blastValue(x, y, r){
    let v = 0;
    const cells = L.blast(S.grid, x, y, r);
    for (const c of cells){
      if (c.crate) v += 1;
      for (const e of S.enemies) if ((R(e.x) === c.x && R(e.y) === c.y) || (e.tx === c.x && e.ty === c.y)) v += 3;
      const B = S.boss;
      if (B && B.alive && Math.abs(B.x - c.x) < 1.2 && Math.abs(B.y - c.y) < 1.2) v += 6;
    }
    return v;
  }
  // «простор» вокруг клетки: сколько клеток в 3 шагах, куда враги не успеют за minT (тупик — ловушка)
  function roomy(c0, blk, bs, minT){
    const seen = new Map([[c0, 0]]), q = [c0]; let n = 0;
    for (let h = 0; h < q.length; h++){
      const c = q[h], d = seen.get(c), x = c % L.COLS, y = (c / L.COLS) | 0;
      if (blk[c] > minT) n++;
      if (d >= 3) continue;
      for (const [dx, dy] of DIRS){
        const nx = x + dx, ny = y + dy, k = idx(nx, ny);
        if (!L.inside(nx, ny) || seen.has(k) || S.grid[k] !== L.FLOOR || bs.has(k) || blk[k] <= minT) continue;
        seen.set(k, d + 1); q.push(k);
      }
    }
    return n;
  }
  function canEscapeWith(x, y, p){
    const win = dangerMap({ x, y, r: p.flame, t: L.FUSE }), blk = enemyBlock(idx(x, y));
    const bombs = bombSet(); bombs.delete(idx(x, y));   // с клетки своей бомбы уйти можно (она «под ногами»)
    const res = search(x, y, win, blk, bombs, speedOf(p));
    // укрытие: вне креста, успеть до взрыва, и враги не доберутся туда, пока ждём
    for (let c = 0; c < N; c++){
      if (res.dist[c] <= 0 || win[c]) continue;
      const tt = res.dist[c] * res.step;
      if (tt < L.FUSE - 0.35 && blk[c] > L.FUSE + L.FLAME_T * hide && (S.enemies.length === 0 || roomy(c, blk, bombs, L.FUSE) >= room)) return true;
    }
    return false;
  }

  function decide(){
    const p = me(); if (!p.alive) { dir = [0, 0]; return; }
    const x = R(p.x), y = R(p.y), here = idx(x, y), sp = speedOf(p);
    const win = dangerMap(null), blk = enemyBlock(), bombs = bombSet();
    bombs.delete(here);
    // РЕЛЕ: свои бомбы ждут — подорвать, когда сам вне креста
    if (p.relay && S.bombs.some(b => b.owner === pi && b.relay)){
      const mine = S.bombs.filter(b => b.owner === pi && b.relay);
      const inBlast = mine.some(b => L.blast(S.grid, R(b.x), R(b.y), b.r).some(c => c.x === x && c.y === y));
      if (!inBlast) game.detonate(pi);   // гибель считается по клетке под центром — её и проверяем
    }
    // 1) опасно стоять — бежать
    if (win[here] || blk[here] < 0.8){
      if (lateT > 0){ lateT -= react; return; }
      if (brng() < late) { lateT = 0.2; return; }
      // уже бежим — не метаться: держим прежнее укрытие, пока до него можно дойти и враг не успевает туда раньше
      if (mode === 'esc' && goal != null && goal !== here){
        const r2 = search(x, y, win, NOENEMY, bombs, sp);
        if (r2.dist[goal] >= 0 && !win[goal] && blk[goal] - r2.dist[goal] * r2.step > 0.3){ plan = r2; return; }
      }
      const esc = escape(x, y, win, blk, bombs, sp) || escape(x, y, win, NOENEMY, bombs, sp, blk);
      if (esc){ goal = esc.cell; plan = esc.res; mode = 'esc'; return; }
      goal = null; plan = null; return;
    }
    // враг совсем рядом — бомба, если есть отход, иначе отойти
    if (blk[here] < 1.8){
      if (blastValue(x, y, p.flame) >= 3 && (brng() < blunder || canEscapeWith(x, y, p))){ game.bomb(pi); nextDecide = 0; return; }
    }
    const res = search(x, y, win, blk, bombs, sp, { maxD: 30 });
    // враг близко, а вокруг тесно — выйти на простор, пока не зажали
    if (blk[here] < 2.2 && roomy(here, blk, bombs, 1.2) < 4){
      let bc = -1, bv = -1e9;
      for (let c = 0; c < N; c++){
        if (res.dist[c] < 0 || win[c] || res.dist[c] > 8) continue;
        const tt = res.dist[c] * res.step, v = Math.min(blk[c] - tt, 4) + roomy(c, blk, bombs, 1.2) * 0.4 - tt * 0.3;
        if (v > bv){ bv = v; bc = c; }
      }
      if (bc >= 0 && bc !== here){ goal = bc; plan = res; mode = 'out'; return; }
    }
    const own = S.bombs.filter(b => b.owner === pi).length;
    // держим прежнюю цель, пока она в силе (без «дрожи» между равными вариантами)
    if (goal != null && mode === 'spot' && res.dist[goal] >= 0 && !win[goal] && own < Math.min(p.bombs, cap)){
      const gx = goal % L.COLS, gy = (goal / L.COLS) | 0;
      if (blastValue(gx, gy, p.flame) > 0){
        if (goal === here && Math.abs(p.x - x) + Math.abs(p.y - y) < 0.25){
          if (canEscapeWith(x, y, p)){ game.bomb(pi); nextDecide = 0; goal = null; mode = null; return; }
        } else { plan = res; return; }
      }
    }
    if (goal != null && mode === 'idle' && holdT > 0 && blk[here] > 2.5 && res.dist[goal] >= 0 && !win[goal] && blk[goal] > 2.5){ holdT -= react; plan = res; return; }
    mode = null;
    // 2) люк открыт
    if (S.hatch.open && res.dist[idx(S.hatch.x, S.hatch.y)] >= 0){ goal = idx(S.hatch.x, S.hatch.y); plan = res; return; }
    // 3) видимые бонусы
    let bi = -1, bd = 1e9;
    for (const k in S.items){ const d = res.dist[k]; if (d >= 0 && d < bd && d <= 12){ bd = d; bi = +k; } }
    if (bi >= 0){ goal = bi; plan = res; return; }
    // 4) точка для бомбы
    if (own < Math.min(p.bombs, cap)){
      const cands = [];
      for (let c = 0; c < N; c++){
        if (res.dist[c] < 0 || win[c]) continue;
        const cx = c % L.COLS, cy = (c / L.COLS) | 0, v = blastValue(cx, cy, p.flame);
        if (v <= 0) continue;
        if (blk[c] - res.dist[c] * res.step < (v >= 3 ? 0.7 : 1.5)) continue;     // враг успеет туда раньше нас
        cands.push({ c, s: v / (1 + res.dist[c] * 0.25) });
      }
      cands.sort((a, b) => b.s - a.s);
      for (let i = 0; i < Math.min(8, cands.length); i++){
        const c = cands[i].c, cx = c % L.COLS, cy = (c / L.COLS) | 0;
        if (canEscapeWith(cx, cy, p)){
          if (c === here && Math.abs(p.x - x) + Math.abs(p.y - y) < 0.25){ game.bomb(pi); nextDecide = 0; goal = null; return; }
          goal = c; plan = res; mode = 'spot'; return;
        }
      }
      if (brng() < blunder && cands.length && cands[0].c === here){ game.bomb(pi); return; }
    }
    // 5) ничего — к ближайшему врагу/ящику на расстояние, иначе стоять
    let ti = -1, td = 1e9;
    for (let c = 0; c < N; c++){
      if (res.dist[c] < 0 || win[c]) continue;
      const cx = c % L.COLS, cy = (c / L.COLS) | 0;
      let md = 1e9; for (const e of S.enemies) md = Math.min(md, Math.abs(e.x - cx) + Math.abs(e.y - cy));
      if (S.boss && S.boss.alive) md = Math.min(md, Math.abs(S.boss.x - cx) + Math.abs(S.boss.y - cy));
      const v = Math.abs(md - 3) * 0.6 + res.dist[c] * 0.25 - Math.min(blk[c] - res.dist[c] * res.step, 5) * 1.5 - roomy(c, blk, bombs, 2) * 0.4 + brng() * 0.5;
      if (v < td){ td = v; ti = c; }
    }
    goal = ti >= 0 ? ti : null; plan = res; mode = 'idle'; holdT = 1.2;
  }

  function steer(){
    const p = me(); if (!p.alive){ game.setDir(pi, 0, 0); return; }
    const x = R(p.x), y = R(p.y), here = idx(x, y);
    if (goal == null || !plan){ game.setDir(pi, 0, 0); return; }
    if (goal === here){
      // довести до центра клетки
      const dx = x - p.x, dy = y - p.y;
      if (Math.abs(dx) > 0.04) game.setDir(pi, Math.sign(dx), 0);
      else if (Math.abs(dy) > 0.04) game.setDir(pi, 0, Math.sign(dy));
      else game.setDir(pi, 0, 0);
      return;
    }
    const st = plan.dist[goal] >= 0 ? firstStep(plan, here, goal) : null;
    if (st == null){ game.setDir(pi, 0, 0); goal = null; return; }
    const nx = st % L.COLS, ny = (st / L.COLS) | 0;
    game.setDir(pi, nx - x, ny - y);
  }

  let lastCell = -1;
  return {
    react,
    tick(t){
      const p = me();
      const cell = idx(R(p.x), R(p.y));
      if (t >= nextDecide || cell !== lastCell && perfect){ nextDecide = t + react; decide(); }
      lastCell = cell;
      // план строился от клетки решения — при переходе в новую клетку пересчитать путь от неё
      if (plan && goal != null && plan.dist[cell] < 0 && cell !== goal){ decide(); }
      steer();
    }
  };
}

export function playFitil(F, seed, opts = {}){
  const L = F.logic, levels = opts.levels || L.LEVELS.length, start = opts.startLevel || 1;
  const brng = mulberry32(seed * 7919 + 13);
  const maxLevelT = opts.maxLevelT || 240;
  const deaths = {}, levelTime = {};
  const game = F.Game({ rng: mulberry32(seed), players: opts.players || 1, level: start, maxLevel: start + levels - 1,
    lives: opts.lives || 3, friendlyFire: !!opts.ff,
    onEvent: (t, d) => { if (t === 'die') deaths[S.level] = (deaths[S.level] || 0) + 1; } }).start();
  const S = game.state(), h = 1 / 60;
  const brains = S.players.map((p, i) => makeBrain(F, game, i, brng, opts));
  let t = 0, tLevel = 0, cur = S.level, stuck = 0;
  while (!S.over){
    for (const b of brains) b.tick(t);
    game.update(h); t += h;
    if (S.level !== cur){ levelTime[cur] = tLevel; cur = S.level; tLevel = 0; }
    tLevel += h;
    if (tLevel > maxLevelT){ stuck = S.level; break; }
  }
  levelTime[cur] = tLevel;
  const passed = S.won ? levels : (S.level - start);
  return { passed, won: S.won, deaths, levelTime, stuck, score: S.score, react: brains[0].react };
}
