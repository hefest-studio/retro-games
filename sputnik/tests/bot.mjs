/* СПУТНИК · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: видит то же, что на экране (рельеф, механизмы, враги, пули, босс), управляет
   только как игрок — setDir(x,y), setFire(удержание), drone() (отстегнуть/вернуть).
   Человеческие ограничения:
   - реакция: видит картинку 150–250 мс давности, перепланирует маршрут ~10 раз/с;
   - скорость пуль и врагов оценивает «на глаз» по двум кадрам, прицел по высоте с ошибкой ±aimErr px;
   - часть пуль просто не замечает (miss), иногда «засматривается» (lapse — пропуск решения целиком);
   - стреляет очередью нажатий ~7 раз/с; пока слабое место босса закрыто — копит заряд и отпускает, когда откроется.
   opts: { levels=6, startLevel=1, react:[0.15,0.25], aimErr=6, lapse=0.05, miss=0.05, perfect=false, maxLevelT=420 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playSputnik(Sp, seed, opts = {}){
  const L = Sp.logic, perfect = !!opts.perfect, levels = opts.levels || 6, start = opts.startLevel || 1;
  const brng = mulberry32(seed * 7919 + 31);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = perfect ? 0.05 : r0 + brng() * (r1 - r0);
  const aimErr = perfect ? 0 : (opts.aimErr == null ? 6 : opts.aimErr);
  const lapse = perfect ? 0 : (opts.lapse == null ? 0.05 : opts.lapse);
  const missP = perfect ? 0 : (opts.miss == null ? 0.05 : opts.miss);
  const maxLevelT = opts.maxLevelT || 420;
  const lost = {}, levelTime = {}, why = {};
  const game = Sp.Game({ rng: mulberry32(seed), level: start, maxLevel: start + levels - 1,
    onEvent: (t, d) => { if (t === 'playerHit'){ lost[S.level] = (lost[S.level] || 0) + 1; why[d.why] = (why[d.why] || 0) + 1; } } }).start();
  const S = game.state(), h = 1 / 60;
  const hist = [];
  let t = 0, tLevel = 0, curLevel = S.level, stuck = 0, nextDecide = 0, nextTap = 0, tapOn = false, charging = false;
  let tx = S.ship.x - S.cx, ty = S.ship.y, aimNoise = 0, aimId = null, wantFire = false, wantCharge = false, chargeRelease = false;

  const seen = new WeakMap();
  function noticed(b){ if (!seen.has(b)) seen.set(b, brng() >= missP); return seen.get(b); }
  function snap(){
    const B = S.boss && S.boss.alive ? S.boss : null;
    return {
      t, cx: S.cx, scroll: !S.hold && S.cx < S.lv.len,
      bullets: S.bullets.filter(noticed).map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r: b.r })),
      enemies: S.enemies.filter(e => e.alive).map(e => ({ ref: e, x: e.x, y: e.y, r: e.r, type: e.type, warn: e.warn > 0, band: e.type === 'moth' ? [e.y0 - e.amp, e.y0 + e.amp] : null })),
      boss: B ? { open: B.open, weak: { ...B.weak }, armor: B.armor.map(a => ({ x: a.x, y: a.y, r: a.r, part: !!a.part })), enter: B.enter > 0 } : null,
      laser: S.laser ? { ...S.laser } : null,
      caps: S.caps.map(c => ({ x: c.x, y: c.y }))
    };
  }
  function velOf(view, old, ref){
    if (!old) return { vx: 0, vy: 0 };
    const a = view.enemies.find(x => x.ref === ref), b = old.enemies.find(x => x.ref === ref);
    if (!a || !b || view.t === old.t) return { vx: 0, vy: 0 };
    return { vx: (a.x - b.x) / (view.t - old.t), vy: (a.y - b.y) / (view.t - old.t) };
  }

  function decide(view, old){
    if (brng() < lapse) return;
    const sh = S.ship, lag = t - view.t, scr = view.scroll ? L.SCROLL : 0;
    // --- цель: ближайший враг впереди / слабое место босса
    let aimY = null, best = null;
    for (const e of view.enemies){
      if (e.warn) continue;
      const sx = e.x - view.cx; if (sx < 0 || sx > L.W - 6) continue;
      if (e.x < sh.x + 8) continue;
      const v = velOf(view, old, e.ref), tf = Math.max(0, (e.x - sh.x)) / L.SHOT_V + lag;
      const ey = e.y + v.vy * tf;
      let cost = (e.x - sh.x) / 300 + Math.abs(ey - sh.y) / 160;
      if (e.type === 'pod') cost -= 0.4;
      if (e.type === 'guard') cost -= 0.3;
      if (e.ref === aimId) cost -= 0.1;
      if (!best || cost < best.cost) best = { cost, y: ey, id: e.ref, r: e.r };
    }
    const B = view.boss;
    if (B && !B.enter){ const c = B.open ? -1 : 0.3; if (!best || c < best.cost) best = { cost: c, y: B.weak.y, id: 'boss', r: B.weak.r, boss: true }; }
    if (best){ if (best.id !== aimId){ aimId = best.id; aimNoise = gauss() * aimErr; } aimY = best.y + aimNoise; }
    // капсулы — подобрать, если рядом
    for (const c of view.caps) if (Math.abs(c.x - sh.x) < 140 && c.x > view.cx + 20){ aimY = c.y; best = best || { y: c.y }; break; }
    // --- маршрут: перебор точек, оценка опасности по траектории
    const baseSX = B ? 70 : 105;
    const cur = { x: sh.x, y: sh.y };
    const near = r => (o) => Math.abs(o.x - sh.x) < r;
    const bl = view.bullets.filter(near(260)).map(b => ({ ...b, x: b.x + b.vx * lag, y: b.y + b.vy * lag }));
    const en = view.enemies.filter(near(220)).map(e => { const v = velOf(view, old, e.ref); return { x: e.x + v.vx * lag, y: e.y + v.vy * lag, vx: v.vx, vy: e.band ? 0 : v.vy, r: e.r, band: e.band }; });
    const arm = B ? B.armor.concat(B.open ? [B.weak] : []) : [];
    // рельеф впереди — один раз за решение (кэш по 4 px)
    const X0 = Math.floor((sh.x - 60) / 4) * 4, NC = 90, CE = new Float64Array(NC), FL = new Float64Array(NC);
    for (let i = 0; i < NC; i++){ CE[i] = game._ceilY(X0 + i * 4); FL[i] = game._floorY(X0 + i * 4); }
    const ci = x => Math.max(0, Math.min(NC - 1, Math.round((x - X0) / 4)));
    const mh = S.lv.mechs.filter(mm => Math.abs(mm.x - sh.x) < 260);
    let bestC = 1e9, bx = tx, by = ty;
    const curSX = sh.x - view.cx;
    for (let ddx = -40; ddx <= 40; ddx += 40){
      const sxT = Math.max(24, Math.min(L.W - 40, baseSX + ddx));
      for (let dy = -132; dy <= 132; dy += 12){
        const yT = sh.y + dy; if (yT < L.TOP + 8 || yT > L.H - 8) continue;
        let c = 0;
        const dX = sxT - curSX, dY = yT - sh.y, dist = Math.hypot(dX, dY) || 1;
        for (const tau of [0.08, 0.18, 0.3, 0.45, 0.65]){
          const m = Math.min(dist, L.SHIP_V * tau);
          const px = cur.x + dX / dist * m + scr * tau, py = cur.y + dY / dist * m;
          // рельеф
          let cl = 1e9;
          for (let ox = -L.SHIP_TW; ox <= L.SHIP_TW; ox += L.SHIP_TW){ const k = ci(px + ox); cl = Math.min(cl, py - L.SHIP_TH - CE[k], FL[k] - py - L.SHIP_TH); }
          if (cl < 3) c += 900 / (tau + 0.1); else if (cl < 12) c += (12 - cl) * 3;
          for (const mm of mh){ if (Math.abs(mm.x - px) > 50) continue; const g = game._mechRects(mm, tau);
            if (g.r){ if (Math.hypot(px - g.cx, py - g.cy) < g.r + 16) c += 700 / (tau + 0.1); }
            else if (px + L.SHIP_TW + 10 > g.x0 && px - L.SHIP_TW - 10 < g.x1 && py + L.SHIP_TH + 14 > g.y0 && py - L.SHIP_TH - 14 < g.y1) c += 700 / (tau + 0.1); }
          for (const b of bl){ const qx = b.x + b.vx * tau, qy = b.y + b.vy * tau; if (Math.abs(qx - px) < L.SHIP_HW + b.r + 6 && Math.abs(qy - py) < L.SHIP_HH + b.r + 6) c += 500 / (tau + 0.1); }
          for (const e of en){ const qx = e.x + e.vx * tau; if (Math.abs(qx - px) >= e.r + L.SHIP_HW + 8) continue;
            if (e.band ? (py > e.band[0] - e.r - L.SHIP_HH - 8 && py < e.band[1] + e.r + L.SHIP_HH + 8) : Math.abs(e.y + e.vy * tau - py) < e.r + L.SHIP_HH + 8) c += 600 / (tau + 0.1); }
          for (const a of arm){ if (Math.hypot(a.x - px, a.y - py) < a.r + 16) c += 600 / (tau + 0.1); }
          if (view.laser && px < view.laser.x1 && Math.abs(py - view.laser.y) < 22) c += (view.laser.h > 0 ? 800 : 300 * (0.3 + (view.laser.warn || 0))) / (tau + 0.2);
        }
        if (aimY != null) c += Math.abs(yT - aimY) * 0.35; else c += Math.abs(dy) * 0.05;
        c += Math.abs(sxT - baseSX) * 0.04;
        if (c < bestC){ bestC = c; bx = sxT; by = yT; }
      }
    }
    tx = bx; ty = by;
    // --- огонь
    const inLine = aimY != null && Math.abs(sh.y - aimY) < (best && best.r ? best.r + 4 : 10);
    wantFire = inLine || (aimY != null && Math.abs(sh.y - aimY) < 30);
    if (B && !B.enter){ wantCharge = !B.open; chargeRelease = B.open && inLine; }
    else { wantCharge = false; chargeRelease = false; }
    // дрон: держим у корабля
    if (S.drone.state === 'free') game.drone();
  }

  while (!S.over){
    hist.push(snap());
    while (hist.length > 60) hist.shift();
    let vi = hist.length - 1; while (vi > 0 && hist[vi].t > t - react) vi--;
    const view = hist[vi];
    if (t >= nextDecide){
      nextDecide = t + 0.1;
      let oi = vi; while (oi > 0 && hist[oi].t > view.t - 0.15) oi--;
      decide(view, oi < vi ? hist[oi] : null);
    }
    const sh = S.ship, ddx = (tx + S.cx) - sh.x, ddy = ty - sh.y;
    game.setDir(Math.abs(ddx) < 3 ? 0 : ddx, Math.abs(ddy) < 2.5 ? 0 : ddy);
    // огонь: очередь нажатий или заряд
    if (wantCharge && !chargeRelease){ charging = true; game.setFire(true); }
    else if (charging){ charging = false; game.setFire(false); nextTap = t + 0.08; tapOn = false; }
    else if (wantFire && t >= nextTap){ tapOn = !tapOn; game.setFire(tapOn); nextTap = t + (tapOn ? 0.05 : 0.07 + brng() * 0.04); }
    else if (!wantFire && tapOn){ tapOn = false; game.setFire(false); }
    game.update(h); t += h;
    if (S.level !== curLevel){ levelTime[curLevel] = tLevel; curLevel = S.level; tLevel = 0; hist.length = 0; }
    if (S.phase === 'dead') hist.length = 0;
    tLevel += h;
    if (tLevel > maxLevelT){ stuck = S.level; break; }
  }
  if (S.over || stuck) levelTime[curLevel] = tLevel;
  const passed = S.won ? levels : (S.level - start);
  return { passed, won: S.won, lost, why, levelTime, stuck, score: S.score, react };
}
