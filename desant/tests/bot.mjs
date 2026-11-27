/* ЗАРЕВО (папка desant) · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setMove(0, dx, dy) (8 направлений, как клавиши), setFire(0, on), bar() (кнопка «вал»),
   а на экране «Продолжить?» — cont(). Видит только то, что в кадре (как игрок на экране).
   - решения раз в 150–250 мс (реакция), между решениями держит прежние клавиши; поворот ствола — короткое касание
     направления (60–100 мс) с отпущенным огнём, дальше огонь зажат и бот стрейфует, выравниваясь на цель;
   - врага замечает не сразу: при каждом «взгляде» пропускает нового с вероятностью opts.miss (0.25);
   - уходит в сторону от летящих пуль, из-под меток навесных снарядов и с дорожек валунов;
   - огненный вал: пускает перед частоколом, перед толпой пехоты, перед гнёздами/дзотами/броневиками/катерами и против боссов (если хватает заряда),
     идёт на безопасном расстоянии за полосой (в неё не заходит), сам отбивает вал, когда впереди пусто и заряд на исходе;
   - идёт вверх по кратчайшему пути внутри кадра (поиск по тайлам; сжигаемые тайлы — «проходимые после вала»), подбирает припасы рядом.
   opts: { startZone=1, maxZone, miss=0.25, missBullet=0.4, react:[0.15,0.25], maxT=2400, invuln=false, useCont=true } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playDesant(DS, seed, opts = {}){
  const L = DS.logic, T = L.T, COLS = L.COLS, VH = L.VIEW_H;
  const brng = mulberry32(seed * 7919 + 101);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.25;
  const missB = opts.missBullet != null ? opts.missBullet : 0.4;   // часть пуль «не замечает» (как человек в суматохе)
  const seenB = new WeakMap();
  const noticed = b => { if (!seenB.has(b)) seenB.set(b, brng() >= missB); return seenB.get(b); };
  const maxT = opts.maxT || 2400;
  const useCont = opts.useCont !== false;
  const ev = { deaths: 0, why: {}, hits: {}, clears: [], bars: 0, conts: 0, cps: 0, zoneT: [] };
  let tm = 0, zoneStart = 0;
  const game = DS.Game({ rng: mulberry32(seed), seed, zone: opts.startZone || 1, maxZone: opts.maxZone,
    onEvent: (t, d) => {
      if (t === 'heroDie'){ ev.deaths++; ev.why[d.src] = (ev.why[d.src] || 0) + 1; if (game && game.state().boss && game.state().boss.active) ev.bossDeaths = (ev.bossDeaths || 0) + 1; }
      else if (t === 'clear'){ ev.clears.push(d.zone); ev.zoneT.push(+(tm - zoneStart).toFixed(1)); }
      else if (t === 'zone'){ if (!d.cp) zoneStart = tm; }
      else if (t === 'heroHurt') ev.hits[d.src] = (ev.hits[d.src] || 0) + 1;
      else if (t === 'barStart') ev.bars++;
      else if (t === 'continue') ev.conts++;
      else if (t === 'checkpoint') ev.cps++;
      else if (t === 'bossIntro') ev.bossAt = +(tm - zoneStart).toFixed(1);
    } }).start();
  const S = game.state(), dt = 1 / 60;
  const ctl = S.heroes.map(() => ({ next: 0, mv: [0, 0], fire: false, tap: 0, want: [0, -1], seen: new Set(), skip: new Set(), barAt: -99 }));
  let lastCam = S.camY, lastCamT = 0, stuck = false, contWait = 0;

  const walk = (tx, ty) => tx >= 0 && tx < COLS && ty >= 0 && ty < S.D.h && L.WALK[S.tiles[tx + ty * COLS]] === 1;
  const burnable = (tx, ty) => tx > 0 && tx < COLS - 1 && ty >= 0 && ty < S.D.h && L.BURN[S.tiles[tx + ty * COLS]] === 1;
  const plan = (tx, ty) => walk(tx, ty) || burnable(tx, ty);   // сжигаемое бот планирует «пройти после вала»
  function bfs(h, rowMin, rowMax){
    const ok = plan;
    const sx = Math.floor(h.x / T), sy = Math.floor(h.y / T), N = COLS * S.D.h, dist = new Int16Array(N).fill(-1), prev = new Int32Array(N).fill(-1), q = [sx + sy * COLS];
    dist[q[0]] = 0;
    for (let i = 0; i < q.length; i++){ const c = q[i], x = c % COLS, y = (c - x) / COLS;
      for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x + ox, ny = y + oy; if (ny < rowMin || ny > rowMax || !ok(nx, ny)) continue; const k = nx + ny * COLS; if (dist[k] < 0){ dist[k] = dist[c] + 1; prev[k] = c; q.push(k); } } }
    return { dist, prev, start: q[0] };
  }
  function stepTo(h, B, goal, pt){   // направление к первой «видимой» клетке пути
    if (goal < 0 || B.dist[goal] < 0) return null;
    const path = []; for (let k = goal; k >= 0 && k !== B.start; k = B.prev[k]) path.push(k); path.reverse();
    if (!path.length) return pt && Math.hypot(pt.x - h.x, pt.y - h.y) > 3 ? L.oct(pt.x - h.x, pt.y - h.y) : null;
    let idx = 0;
    for (let i = Math.min(3, path.length - 1); i > 0; i--){ const k = path[i], x = (k % COLS) * T + T / 2, y = Math.floor(k / COLS) * T + T / 2; if (clearLine(h.x, h.y, x, y)){ idx = i; break; } }
    const k = path[idx], x = (k % COLS) * T + T / 2, y = Math.floor(k / COLS) * T + T / 2;
    return L.oct(x - h.x, y - h.y);
  }
  function clearLine(x0, y0, x1, y1){ const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6); for (let i = 0; i <= n; i++){ const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (game._circleHits(x, y, L.HERO_R + 1, L.WALK)) return false; } return true; }
  function okDir(h, d){ const n = Math.hypot(d[0], d[1]) || 1; return !game._circleHits(h.x + d[0] / n * 10, h.y + d[1] / n * 10, L.HERO_R, L.WALK); }

  function targets(h){
    const out = [], top = S.camY, bot = S.camY + VH;
    S.enemies.forEach(e => {
      if (e.dead || e.y < top + 10 || e.y > bot - 4) return;
      const key = 'e' + e.id;
      const C = ctl[h.id];
      if (!C.seen.has(key)){ if (!C.skip.has(key) && brng() < miss){ C.skip.add(key); return; } C.seen.add(key); }
      let x = e.x;
      if (e.type === 'car' || e.type === 'boat'){ const fl = Math.hypot(e.x - h.x, e.y - h.y) / L.BULLET.speed; x = e.x + e.vx * L.ENEMIES[e.type].speed * fl; }   // упреждение, как у игрока
      out.push({ id: 'e' + e.id, x, y: e.y, r: e.r, kind: e.type, heavy: e.type !== 'rifle' && e.type !== 'grenadier', bunker: e.type === 'bunker', mob: e.type === 'rifle' || e.type === 'grenadier' });
    });
    if (S.boss && S.boss.active && !S.boss.dead && S.boss.intro <= 0) S.boss.parts.forEach(p => { if (!p.dead && game._vuln(p)) out.push({ id: 'p' + p.id, x: p.x, y: p.y, r: p.r, kind: 'part', heavy: true, boss: true }); });
    return out;
  }
  function decide(pi){
    const h = S.heroes[pi], c = ctl[pi];
    if (!h.alive || h.out){ c.mv = [0, 0]; c.fire = false; return; }
    const top = S.camY, bot = S.camY + VH, boss = S.boss && S.boss.active;
    // 2) цель
    const ts = targets(h);
    let tgt = null, bd = 1e9;
    for (const t of ts){
      if (t.bunker) continue;   // дзот пулями не берётся — только валом
      if (c.ban && c.ban[t.id] > tm) continue;   // «надоела» — не попадаю, иду дальше
      const d = Math.hypot(t.x - h.x, t.y - h.y); if (d > (t.boss ? 600 : 420)) continue;
      const see = game._los(h.x, h.y, t.x, t.y, true);
      if (!see) continue;   // за укрытием — не тратить время
      const w = d * (t.boss ? 0.6 : t.heavy ? 1.15 : 1) * (see ? 1 : 1.8) * (t.id === c.tid ? 0.6 : 1);   // держится прежней цели
      if (w < bd){ bd = w; tgt = t; }
    }
    if (tgt && tgt.id === c.tid) { c.tidT = (c.tidT || 0) + (r0 + r1) / 2; if (c.tidT > 7 && !tgt.boss) { (c.ban = c.ban || {})[tgt.id] = tm + 12; c.tidT = 0; } } else c.tidT = 0;
    c.tid = tgt ? tgt.id : null;
    // 3) цель движения
    const rowMin = Math.max(0, Math.floor((top + 40) / T)), rowMax = Math.floor((bot - 14) / T);
    const B = bfs(h, rowMin, rowMax);
    let goal = -1, goalPt = null;
    const useful = it => !(it.kind === 'shell' && S.charge > 85) && !(it.kind === 'med' && h.hp >= L.HP);
    const items = S.items.filter(it => !it.taken && it.y > top + 40 && it.y < Math.min(bot - 10, h.y + 50) && Math.hypot(it.x - h.x, it.y - h.y) < 150 && useful(it))
      .sort((a, b) => (a === c.item ? -1 : b === c.item ? 1 : Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)));
    if (goal < 0 && items.length){ const it = items[0], k = Math.floor(it.x / T) + Math.floor(it.y / T) * COLS; if (B.dist[k] >= 0 && B.dist[k] < 9){ goal = k; goalPt = it; c.item = it; } }
    if (goal < 0){
      // вверх: самая верхняя достижимая строка, ближе к выбранному x
      const crowd = ts.filter(t => !t.boss && !t.bunker && t.y < h.y - 20 && Math.hypot(t.x - h.x, t.y - h.y) < 220 && game._los(h.x, h.y, t.x, t.y, true)).length;
      if (crowd >= 3) c.hold = (c.hold || 0) + (r0 + r1) / 2; else c.hold = 0;
      let wantY = boss ? top + VH - 170 : crowd >= 3 && c.hold < 6 ? h.y : top + 150;
      if (boss && S.boss.key === 'crusher') wantY = top + VH - 110;
      const gx = tgt ? tgt.x : h.x;
      const wantRow = Math.max(rowMin, Math.min(rowMax, Math.floor(wantY / T)));
      let best = 1e9;
      for (let y = rowMin; y <= rowMax; y++) for (let x = 1; x < COLS - 1; x++){
        const k = x + y * COLS; if (B.dist[k] < 0) continue;
        const sc = Math.abs(y - wantRow) * 3 + Math.abs(x * T + T / 2 - gx) / T * (boss ? 2 : 0.7) + B.dist[k] * 0.15;
        if (sc < best){ best = sc; goal = k; }
      }
    }
    let move = stepTo(h, B, goal, goalPt) || [0, 0];
    // 4) прицел и огонь
    if (tgt){
      const dx = tgt.x - h.x, dy = tgt.y - h.y;
      let want = L.oct(dx, dy);
      if (tgt.boss || Math.abs(dy) > 1.6 * Math.abs(dx)) want = [0, dy > 0 && !tgt.boss ? 1 : -1];
      else if (Math.abs(dx) > 1.6 * Math.abs(dy)) want = [dx > 0 ? 1 : -1, 0];
      const f = h.face, fl = Math.hypot(f[0], f[1]) || 1;
      const perp = Math.abs(dx * f[1] - dy * f[0]) / fl, ahead = (dx * f[0] + dy * f[1]) / fl;
      const aligned = ahead > 0 && perp < tgt.r + 4;
      if (!aligned && (want[0] !== f[0] || want[1] !== f[1])){ c.tap = 0.06 + brng() * 0.04; c.want = want; c.fire = !tgt.bunker; }
      else {
        c.fire = !tgt.bunker;
        c.misT = !aligned ? (c.misT || 0) + (r0 + r1) / 2 : 0;
        if (c.misT > 2.5){ (c.ban = c.ban || {})[tgt.id] = tm + 8; c.misT = 0; }   // долго не выходит на линию огня — бросить цель
        if (!aligned){
          const side = L.oct(dx - f[0] * ahead / fl, dy - f[1] * ahead / fl);
          // стрейф поперёк ствола + продвижение по пути вдоль ствола (если по пути есть такая составляющая)
          const mix = f[0] === 0 ? [side[0], move[1]] : f[1] === 0 ? [move[0], side[1]] : side;
          if ((mix[0] || mix[1]) && okDir(h, mix)) move = mix; else if (okDir(h, side)) move = side;
        }
      }
    }
    else {
      // никого: ствол вверх и «на всякий случай» огонь
      if (h.face[0] !== 0 || h.face[1] !== -1){ c.tap = 0.06 + brng() * 0.04; c.want = [0, -1]; c.fire = true; }
      else c.fire = true;
    }
    // 4б) огненный вал: когда пускать, где держаться, когда отбить
    {
      const Bn = S.bar, active = Bn.st !== 'idle', cost = L.BAR;
      let blk = null;   // ближайшая сжигаемая клетка на пути к цели (частокол/укрытия) выше бойца
      if (goal >= 0 && B.dist[goal] >= 0){
        const path = []; for (let k = goal; k >= 0 && k !== B.start; k = B.prev[k]) path.push(k); path.reverse();
        for (const k of path){ const tx = k % COLS, ty = (k - tx) / COLS; if (!walk(tx, ty) && burnable(tx, ty)){ blk = { x: tx * T + T / 2, y: ty * T + T / 2 }; break; } }
      }
      const dBlk = blk ? h.y - (blk.y + T / 2) : 1e9;   // расстояние до нижней кромки преграды
      const above = ts.filter(t => !t.boss && t.y < h.y - 40 && h.y - t.y < 330);
      const crowd = above.filter(t => t.mob && h.y - t.y > 80 && game._los(h.x, h.y, t.x, t.y, true)).length;
      const heavyAhead = above.some(t => t.heavy && h.y - t.y > 110 && h.y - t.y < 300);
      const bossNear = boss && S.boss.parts.some(p => !p.dead && game._vuln(p) && h.y - p.y < 480);
      if (!active){
        let want = false;
        if (blk && dBlk >= 40 && dBlk < 260 && S.charge >= cost.min + 25) want = true;
        else if (blk && dBlk < 40 && dBlk > -30 && okDir(h, [0, 1])) move = [0, 1];   // отойти, чтобы вал стартовал ниже преграды
        else if ((crowd >= 3 || heavyAhead) && S.charge >= 55 && !(blk && dBlk < 60)) want = true;
        else if (bossNear && S.charge >= 45 && S.boss.intro <= 0) want = true;
        if (want && tm - c.barAt > 3.5){ if (game.bar() === 'start') c.barAt = tm; }
      } else {
        const bd = h.y - Bn.y;
        if (bd < 66){ if (move[1] < 0) move = [move[0], 0]; if (bd < 54) move = [move[0], 1]; }
        // впереди пусто и заряда немного — отбить, чтобы сберечь остаток
        const clearAhead = !above.some(t => t.y < Bn.y + 20) && !(blk && blk.y < Bn.y + 40) && !bossNear;
        if (Bn.st === 'run' && clearAhead && S.charge < 60 && tm - c.barAt > 1.2){ game.bar(); c.barAt = tm; }
      }
    }
    // 5) угрозы: оценить 9 вариантов хода на 0.6 с вперёд (пули, метки навесного огня, валуны) и выбрать безопасный
    const sp = L.SPEED, R = L.HERO_R;
    function danger(m){
      const n = Math.hypot(m[0], m[1]) || 1, mx = m[0] / n * sp, my = m[1] / n * sp; let d = 0;
      for (let t = 0.1; t <= 0.61; t += 0.1){
        const px = h.x + mx * t, py = Math.min(bot - 12, Math.max(top + 40, h.y + my * t));
        for (const b of S.bullets){ if (b.k !== 'e' || !noticed(b)) continue; const bx = b.x + b.vx * t, by = b.y + b.vy * t; if (Math.abs(bx - px) < R + 9 && Math.abs(by - py) < R + 9) d += (0.75 - t) * 10; }
        for (const mk of S.marks){ if (mk.lane || mk.t > t + 0.15) continue; if (Math.hypot(px - mk.x, py - mk.y) < mk.r + R + 6) d += 6; }
        for (const bo of S.boulders){ const by = bo.wait > t ? bo.y : bo.y + bo.vy * (t - Math.max(0, bo.wait)); if (Math.abs(bo.x - px) < bo.r + R + 4 && Math.abs(by - py) < bo.r + R + 4) d += 8; }
      }
      return d;
    }
    c.plan = move;
    const d0 = danger(move); c.d0 = d0;
    if (d0 > 0){
      let best = move, bd = d0;
      for (const m of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]){
        if ((m[0] || m[1]) && !okDir(h, m)) continue;
        const dd = danger(m) + (m[0] === move[0] && m[1] === move[1] ? 0 : 0.3);
        if (dd < bd){ bd = dd; best = m; }
      }
      move = best;
    }
    c.mv = move;
  }

  while (tm < maxT){
    if (S.phase === 'over' || S.phase === 'won') break;
    if (S.phase === 'cont'){
      contWait += dt;
      if (contWait > 1.2){ contWait = 0; if (useCont) game.cont(); else { while (S.phase === 'cont') game.update(0.5); break; } }
      game.update(dt); tm += dt; continue;
    }
    if (opts.invuln) S.heroes.forEach(h => { h.inv = 1e9; });
    for (let pi = 0; pi < S.heroes.length; pi++){
      const c = ctl[pi];
      if (tm >= c.next){ decide(pi); c.next = tm + r0 + brng() * (r1 - r0); if (opts.trace) opts.trace(tm, S, c); }
      if (c.tap > 0){ game.setMove(pi, c.want[0], c.want[1]); game.setFire(pi, false); c.tap -= dt; }
      else { game.setMove(pi, c.mv[0], c.mv[1]); game.setFire(pi, c.fire); }
    }
    game.update(dt); tm += dt;
    if (S.camY < lastCam - 1 || S.camY > lastCam + 40 || (S.boss && S.boss.active) || S.phase !== 'play'){ lastCam = S.camY; lastCamT = tm; }
    if (tm - lastCamT > 60){ stuck = true; if (opts.debug) opts.debug(S, game, ctl); break; }
  }
  return { seed, zone: S.zone, cleared: ev.clears.length, won: S.phase === 'won', score: S.score, deaths: ev.deaths, why: ev.why, hits: ev.hits, stuck, t: +tm.toFixed(1),
    bossAt: ev.bossAt, bossDeaths: ev.bossDeaths || 0, bars: ev.bars, conts: ev.conts, cps: ev.cps, zoneT: ev.zoneT, phase: S.phase, camY: Math.round(S.camY) };
}
