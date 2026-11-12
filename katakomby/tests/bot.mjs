/* КАТАКОМБЫ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setDir(pi, dx, dy) восемью направлениями клавиш,
   setFire(pi, held), bomb(pi), а на прокачке — те же стрелки и «огонь» (choose).
   Человеческие ограничения:
   - решения раз в 180–300 мс (реакция), между решениями держит прежние клавиши;
   - видит только кадр камеры (+1 клетка): врагов и логова за кадром не замечает;
   - путь к цели ищет по карте (как игрок, который видит план этажа), но идёт по клеткам
     «на глаз» — восемь направлений, без пиксельной точности; застрял — дёргается в сторону;
   - бомбу бросает, когда стало туго (много врагов рядом или мало здоровья).
   opts: { floors, startFloor=1, players=1, heroes=['smith','spark'], maxFloorT=240, react:[0.18,0.3] } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playKatakomby(K, seed, opts = {}){
  const L = K.logic, T = L.T, start = opts.startFloor || 1;
  const floors = opts.floors || (L.FLOORS.length - start + 1);
  const brng = mulberry32(seed * 7919 + 17);
  const [r0, r1] = opts.react || [0.18, 0.3];
  const maxFloorT = opts.maxFloorT || 240;
  const game = K.Game({ rng: mulberry32(seed), players: opts.players || 1, heroes: opts.heroes || ['smith', 'spark'],
    floor: start, maxFloor: start + floors - 1 }).start();
  const S = game.state(), h = 1 / 60;
  const ctl = S.heroes.map(() => ({ next: 0, dx: 0, dy: 0, fire: false, lastX: 0, lastY: 0, stuckT: 0, jig: 0, jdx: 0, jdy: 0, side: 1 }));
  const deaths = {}, floorTime = {};
  let t = 0, tFloor = 0, curFloor = S.floor, stuck = 0, upPlan = { smith: ['arm', 'str', 'spd'], spark: ['str', 'spd', 'arm'] };

  const passable = (tx, ty, keys, goal) => {
    if (tx < 0 || ty < 0 || tx >= S.W || ty >= S.H) return false;
    const k = ty * S.W + tx; if (goal && goal[k]) return true;
    const c = S.grid[k]; if (c === '#') return false;
    if (c === 'D') return keys > 0 && goal && goal.door;
    return !S.lairs.some(l => l.hp > 0 && l.tx === tx && l.ty === ty);
  };
  // BFS от героя: dist и родитель — для пути к любой клетке
  function bfs(hero, goal){
    const n = S.W * S.H, d = new Int16Array(n).fill(-1), par = new Int32Array(n).fill(-1);
    const s = Math.floor(hero.y / T) * S.W + Math.floor(hero.x / T), q = [s]; d[s] = 0;
    for (let qi = 0; qi < q.length; qi++){
      const j = q[qi], x = j % S.W, y = (j / S.W) | 0;
      if (goal && goal[j] && j !== s) continue;   // в цель (логово/дверь) входим, но не сквозь неё
      for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + ox, ny = y + oy, k = ny * S.W + nx;
        if (nx < 0 || ny < 0 || nx >= S.W || ny >= S.H || d[k] >= 0 || !passable(nx, ny, S.keys, goal)) continue;
        d[k] = d[j] + 1; par[k] = j; q.push(k);
      }
    }
    return { d, par, s };
  }
  function stepToward(B, k){   // первая клетка пути к k
    let cur = k, prev = k;
    while (B.par[cur] >= 0 && B.par[cur] !== B.s){ prev = cur; cur = B.par[cur]; }
    if (B.par[cur] < 0 && cur !== B.s) return null;
    return cur === B.s ? prev : cur;
  }
  const inView = o => o.x > S.cam.x - T && o.x < S.cam.x + L.VIEW_W + T && o.y > S.cam.y - T && o.y < S.cam.y + L.VIEW_H + T;
  const q8 = (vx, vy) => { const l = Math.hypot(vx, vy) || 1, x = vx / l, y = vy / l; return [Math.abs(x) > 0.38 ? Math.sign(x) : 0, Math.abs(y) > 0.38 ? Math.sign(y) : 0]; };

  function decide(pi){
    const H = S.heroes[pi], C = ctl[pi]; if (!H.alive){ C.dx = C.dy = 0; C.fire = false; return; }
    const st = L.heroStats(H), melee = L.HEROES[H.cls].melee;
    const foes = S.enemies.filter(e => e.hp > 0 && inView(e)).map(e => ({ e, d: Math.hypot(e.x - H.x, e.y - H.y) })).sort((a, b) => a.d - b.d);
    const lairs = S.lairs.filter(l => l.hp > 0 && inView(l));
    // бомба — когда туго
    const close = foes.filter(f => f.d < 4 * T).length;
    if (S.potions > 0 && (close >= 6 || (H.hp < st.maxHp * 0.3 && close >= 2) || (S.boss && !S.boss.dead && S.boss.hp > 20 && H.hp < st.maxHp * 0.45 && inView(S.boss)))) game.bomb(pi);
    let goalCells = null, direct = null, fire = false, tap = false, big = false;
    const B0 = bfs(H, null);
    const reach = (tx, ty) => B0.d[ty * S.W + tx];
    // Бой: развернуться к цели (отпустив «огонь» — герой смотрит, куда идёт), затем зажать «огонь»
    // (направление фиксируется) и двигаться как удобно: Кузнец — вплотную, Искорка — держит дистанцию.
    const fight = (tx, ty, keep) => {
      const want = q8(tx - H.x, ty - H.y), have = q8(H.face.x, H.face.y), d = Math.hypot(tx - H.x, ty - H.y);
      if (melee){ direct = [tx - H.x, ty - H.y]; fire = d < keep[1] + 40; return; }   // Кузнец бьёт по ходу движения
      // развернуться — короткое нажатие стрелки (≈50 мс), а не шаг навстречу врагу
      // выстрелы ложатся в цель (видно по попаданиям), если она в пределах ~20° от взгляда
      const cosA = ((tx - H.x) * H.face.x + (ty - H.y) * H.face.y) / (d || 1);
      if (cosA < Math.cos(L.AIM_CONE * 0.85) && (want[0] !== have[0] || want[1] !== have[1])){ direct = [tx - H.x, ty - H.y]; fire = false; tap = true; return; }
      fire = true;
      // Искорка с зажатым «огнём» пятится и обходит цель по дуге (стрейф), сторону меняет, упёршись
      const ux = (tx - H.x) / (d || 1), uy = (ty - H.y) / (d || 1), sx = -uy * C.side, sy = ux * C.side;
      if (d < keep[0]) direct = [-ux + sx * 0.8, -uy + sy * 0.8];
      else if (d > keep[1]) direct = [ux, uy];
      else direct = big ? [sx, sy] : [0, 0];
    };
    // 1) босс
    if (S.boss && !S.boss.dead){
      const b = S.boss;
      if (foes.length && foes[0].d < 2.2 * T) fight(foes[0].e.x, foes[0].e.y, melee ? [0, 20] : [1.4 * T, 3 * T]);
      // Страж «набухает» перед кольцом плевков (видно на экране) — Кузнец отходит, потом снова в бой
      else if (melee && b.ringT < 0.7 && Math.hypot(b.x - H.x, b.y - H.y) < 3.2 * T){ direct = [H.x - b.x, H.y - b.y]; fire = false; }
      else { big = true; fight(b.x, b.y, melee ? [0, b.r + 14] : [3.5 * T, 6 * T]); }
    }
    // 2) враги рядом
    else if (foes.length && foes[0].d < (melee ? 3.2 : 5) * T && (los(H.x, H.y, foes[0].e.x, foes[0].e.y) || reach(Math.floor(foes[0].e.x / T), Math.floor(foes[0].e.y / T)) >= 0)){
      const f = foes[0].e;
      // в прямой видимости — бить; иначе подойти по карте
      if (los(H.x, H.y, f.x, f.y)) fight(f.x, f.y, melee ? [0, 18] : [1.8 * T, 4 * T]);
      else goalCells = { [Math.floor(f.y / T) * S.W + Math.floor(f.x / T)]: 1 };
    }
    if (!direct && !goalCells){
      // 3) логово в кадре и доступно
      const lr = lairs.map(l => ({ l, d: reachLair(B0, l) })).filter(o => o.d >= 0 && o.d <= 14).sort((a, b) => a.d - b.d)[0];
      const items = S.items.filter(it => !it.taken).map(it => ({ it, d: reach(it.tx, it.ty) })).filter(o => o.d >= 0);
      const food = items.filter(o => o.it.kind === 'food').sort((a, b) => a.d - b.d)[0];
      const near = items.filter(o => (o.it.kind === 'chest' || o.it.kind === 'potion') && o.d <= 7).sort((a, b) => a.d - b.d)[0];
      if (food && H.hp < st.maxHp * 0.55 && food.d < 30) goalCells = cellGoal(food.it);
      else if (lr){
        const l = lr.l, dd = Math.hypot(l.x - H.x, l.y - H.y);
        if ((melee ? dd < 1.5 * T : dd < 4 * T) && los(H.x, H.y, l.x, l.y, l)) fight(l.x, l.y, melee ? [0, 30] : [1.5 * T, 3.5 * T]);
        else goalCells = { [l.ty * S.W + l.tx]: 1 };
      }
      else if (near) goalCells = cellGoal(near.it);
      else if (S.exit && reach(S.exit.tx, S.exit.ty) >= 0) goalCells = { [S.exit.ty * S.W + S.exit.tx]: 1 };
      else {
        const key = items.filter(o => o.it.kind === 'key').sort((a, b) => a.d - b.d)[0];
        if (key) goalCells = cellGoal(key.it);
        else if (S.keys > 0){ goalCells = { door: true }; S.grid.forEach((c, i) => { if (c === 'D') goalCells[i] = 1; }); }
        else if (food) goalCells = cellGoal(food.it);
      }
    }
    // уворот от плевков: если плевок пройдёт впритирку в ближайшие ~0.6 с — шаг поперёк его полёта
    let dodge = null;
    for (const s of S.spits){
      if (!inView(s)) continue;
      const rx = H.x - s.x, ry = H.y - s.y, v2 = s.vx * s.vx + s.vy * s.vy, tt = (rx * s.vx + ry * s.vy) / v2;
      if (tt < 0 || tt > 0.6) continue;
      const mx = rx - s.vx * tt, my = ry - s.vy * tt, miss = Math.hypot(mx, my);
      if (miss < H.r + s.r + 6){ const px = -s.vy, py = s.vx, sg = (mx * px + my * py) >= 0 ? 1 : -1; dodge = [px * sg, py * sg]; break; }
    }
    if (dodge && !tap){ direct = dodge; if (melee) fire = false; }
    let dx = 0, dy = 0;
    if (direct && !direct[0] && !direct[1]) direct = null, dx = dy = 0;
    else if (direct) [dx, dy] = q8(direct[0], direct[1]);
    else if (goalCells){
      const B = goalCells === null ? B0 : bfs(H, goalCells);
      let bestK = -1, bd = 1e9;
      for (const k in goalCells){ if (k === 'door') continue; const v = B.d[k]; if (v >= 0 && v < bd){ bd = v; bestK = +k; } }
      if (bestK >= 0){
        const nk = stepToward(B, bestK);
        if (nk != null){ const nx = (nk % S.W) * T + T / 2, ny = ((nk / S.W) | 0) * T + T / 2; [dx, dy] = q8(nx - H.x, ny - H.y);
          if (bd <= 1){ const gx = (bestK % S.W) * T + T / 2, gy = ((bestK / S.W) | 0) * T + T / 2; [dx, dy] = q8(gx - H.x, gy - H.y); } }
      }
    }
    // застревание — шаг в сторону
    if (Math.hypot(H.x - C.lastX, H.y - C.lastY) < 2 && (dx || dy)) C.stuckT += C.dt || 0.25; else C.stuckT = 0;
    C.lastX = H.x; C.lastY = H.y;
    if (C.stuckT > 0.4) C.side = -C.side;
    if (C.stuckT > 0.8){ C.jig = 0.35; const a = (brng() * 8) | 0; C.jdx = [1,1,0,-1,-1,-1,0,1][a]; C.jdy = [0,1,1,1,0,-1,-1,-1][a]; C.stuckT = 0; }
    if (C.jig > 0){ dx = C.jdx; dy = C.jdy; fire = false; }
    C.dx = dx; C.dy = dy; C.fire = fire; C.tap = tap ? 0.05 : -1;
  }
  // прямая видимость (по клеткам: стены, двери и живые логова, кроме цели) — как «вижу и могу попасть»
  function los(x0, y0, x1, y1, target){
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
    for (let i = 1; i < n; i++){
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n, tx = Math.floor(x / T), ty = Math.floor(y / T), c = S.grid[ty * S.W + tx];
      if (c === '#' || c === 'D') return false;
      if (S.lairs.some(l => l !== target && l.hp > 0 && l.tx === tx && l.ty === ty)) return false;
    }
    return true;
  }
  function cellGoal(it){ return { [it.ty * S.W + it.tx]: 1 }; }
  function reachLair(B0, l){
    let best = -1;
    for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const v = B0.d[(l.ty + oy) * S.W + l.tx + ox]; if (v >= 0 && (best < 0 || v < best)) best = v; }
    return best;
  }

  while (!S.over){
    if (S.phase === 'upgrade'){
      S.heroes.forEach((H, pi) => { if (!S.upDone[pi]){ const plan = upPlan[H.cls]; const pick = plan.find(k => H.up[k] < L.UPG_MAX && H.up[k] <= Math.min(...plan.map(p => H.up[p]))) || plan[0]; game.choose(pi, L.UPG.indexOf(pick)); } });
    } else if (S.phase === 'play'){
      S.heroes.forEach((H, pi) => {
        const C = ctl[pi];
        C.jig -= h;
        if (t >= C.next){ C.dt = r0 + brng() * (r1 - r0); C.next = t + C.dt; decide(pi); }
        const held = C.tap < 0 || C.tap > 0; if (C.tap > 0) C.tap = Math.max(0, C.tap - h);
        game.setDir(pi, held ? C.dx : 0, held ? C.dy : 0); game.setFire(pi, C.fire);
      });
    } else S.heroes.forEach((H, pi) => { game.setDir(pi, 0, 0); game.setFire(pi, false); });
    const alive = S.heroes.map(x => x.alive);
    game.update(h); t += h; tFloor += h;
    S.heroes.forEach((H, i) => { if (alive[i] && !H.alive) deaths[S.floor] = (deaths[S.floor] || 0) + 1; });
    if (S.floor !== curFloor){ floorTime[curFloor] = tFloor; curFloor = S.floor; tFloor = 0; }
    if (tFloor > maxFloorT){ stuck = S.floor; break; }
  }
  if (S.over || stuck) floorTime[curFloor] = tFloor;
  const passed = S.won ? floors : (S.floor - start);
  return { passed, won: S.won, floor: S.floor, deaths, floorTime, stuck, score: S.score, hp: S.heroes.map(x => Math.round(x.hp)) };
}
