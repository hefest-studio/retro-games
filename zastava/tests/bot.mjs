/* ЗАСТАВА · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: видит то же, что на экране (строй, пули, зонд, коршуны, матку), управляет
   только как игрок — setDir(−1/0/1) и action() (выстрел).
   Человеческие ограничения:
   - реакция: видит картинку 150–250 мс давности, решает ~20 раз/с;
   - скорость целей оценивает «на глаз» по двум кадрам (0.2 с), упреждение с ошибкой;
   - прицел: разброс ±aimErr px (своя ошибка на каждый выстрел);
   - уклоняется только от пуль, которые уже видит (с запасом), не знает, когда щит коршуна закроется;
   - иногда «засматривается»: lapse — доля решений, пропущенных целиком; miss — доля пуль, которых не заметил.
   opts: { waves=10, startWave=1, react:[0.15,0.25], aimErr=5, lapse=0.06, miss=0.04, perfect=false, maxWaveT=240 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playZastava(Z, seed, opts = {}){
  const L = Z.logic, perfect = !!opts.perfect, waves = opts.waves || 10, start = opts.startWave || 1;
  const brng = mulberry32(seed * 7919 + 17);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = perfect ? 0 : r0 + brng() * (r1 - r0);
  const aimErr = perfect ? 0 : (opts.aimErr == null ? 5 : opts.aimErr);
  const lapse = perfect ? 0 : (opts.lapse == null ? 0.06 : opts.lapse);
  const maxWaveT = opts.maxWaveT || 240;
  const missP = perfect ? 0 : (opts.miss == null ? 0.04 : opts.miss);
  const lost = {}, waveTime = {};
  const game = Z.Game({ rng: mulberry32(seed), wave: start, maxWave: start + waves - 1,
    onEvent: (t) => { if (t === 'playerHit') lost[S.wave] = (lost[S.wave] || 0) + 1; } }).start();
  const S = game.state(), h = 1 / 60;
  const hist = [];
  let t = 0, tWave = 0, curWave = S.wave, stuck = 0, nextDecide = 0, desired = S.player.x, noise = 0, wantFire = false;

  function snap(){
    const v = { t, px: S.player.x, bullets: S.bullets.filter(noticed).map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy })), targets: [], shot: !!S.shot };
    if (S.fleet){
      const sh = game._shooters();
      for (const a of sh){ const q = game._alienPos(a); v.targets.push({ id: 'a' + a.c + ':' + a.r, x: q.x, y: q.y, low: a.r, pts: L.PTS[a.type] }); }
    }
    if (S.probe) v.targets.push({ id: 'probe', x: S.probe.x, y: S.probe.y, pts: S.probe.pts, probe: true });
    S.birds.forEach((b, i) => { if (b.alive) v.targets.push({ id: 'b' + i, x: b.x, y: b.y, shield: b.shield && b.state === 'form', dive: b.state === 'dive', bird: true }); });
    if (S.boss && S.boss.alive) v.targets.push({ id: 'boss', x: S.boss.x, y: S.boss.y, boss: true });
    return v;
  }
  // внимание: часть пуль человек просто не замечает (решается один раз на пулю)
  const seen = new WeakMap();
  function noticed(b){ if (!seen.has(b)) seen.set(b, brng() >= missP); return seen.get(b); }
  function velOf(view, old, id){
    if (!old) return 0;
    const a = view.targets.find(x => x.id === id), b = old.targets.find(x => x.id === id);
    if (!a || !b || view.t === old.t) return 0;
    return (a.x - b.x) / (view.t - old.t);
  }
  // пули, которые прилетят на линию лафета в ближайшие ~0.9 с: [{x, tt}]
  function threats(view){
    const out = [], yL = L.PLAYER_Y - L.PH / 2, dt = t - view.t;
    for (const b of view.bullets){
      if (b.vy <= 0) continue;
      const by = b.y + b.vy * dt, bx = b.x + b.vx * dt;    // глаз «доводит» пулю по её скорости
      const tt = (yL - by) / b.vy, tEnd = (L.PLAYER_Y + L.PH / 2 + 4 - by) / b.vy;   // вход в лафет и выход из него
      if (tEnd < 0 || tt > 0.9) continue;
      out.push({ x: bx + b.vx * Math.max(0, tt), tt: Math.max(0, tt), tEnd });
    }
    for (const g of view.targets) if (g.dive && g.y > 330){ const tt = Math.max(0, (L.PLAYER_Y - 40 - g.y) / 260); out.push({ x: g.x, tt, tEnd: tt + 0.4, wide: 26 }); }
    return out;
  }
  // своё укрытие над лафетом (видно на экране): выстрел уйдёт в наковальню
  function blocked(x){ for (let y = L.BK_Y; y < L.BK_Y + L.BK_R * L.BK_S; y += L.BK_S) if (game._cellAt(x, y)) return true; return false; }
  let aimId = null;
  function decide(view, old){
    if (brng() < lapse) return;
    const px = S.player.x;
    let aimX = px, best = null;
    const tfOf = y => Math.max(0, (L.PLAYER_Y - y) / L.SHOT_V);
    let anyInLine = false;
    for (const g of view.targets){
      if (g.shield) continue;
      const vx = velOf(view, old, g.id), tf = tfOf(g.y) + (t - view.t);
      let ax = g.x + vx * tf;
      if (Math.abs(ax - px) < 6) anyInLine = true;
      let cost = Math.abs(ax - px) / L.PLAYER_V;
      if (g.probe) cost -= 0.6;
      if (g.dive) cost -= 0.5;
      if (g.low != null) cost -= g.low * 0.03;
      if (g.id === aimId) cost -= 0.15;
      if (ax < L.FX0 + 10 || ax > L.FX1 - 10) cost += 5;
      if (blocked(ax)) cost += 0.5;
      if (!best || cost < best.cost) best = { cost, ax, id: g.id };
    }
    if (best){ if (best.id !== aimId){ aimId = best.id; noise = gauss() * aimErr; } aimX = best.ax + noise; }
    // уклонение: где окажется лафет в момент прилёта каждой видимой пули, если ехать к x
    const th = threats(view), V = L.PLAYER_V;
    const posAt = (x, tt) => { const dx = x - px; return px + Math.sign(dx) * Math.min(Math.abs(dx), V * tt); };
    const hazard = x => { let c = 0; for (const q of th){ const w = L.PW / 2 + 6 + (q.wide || 0); if (Math.abs(posAt(x, q.tt) - q.x) < w || Math.abs(posAt(x, q.tEnd) - q.x) < w) c += 1 / (0.15 + q.tt); } return c; };
    let want = aimX;
    if (th.length && hazard(aimX) > 0){
      let bestC = 1e9;
      for (let dx = -140; dx <= 140; dx += 4){
        const x = px + dx; if (x < L.FX0 + L.PW / 2 || x > L.FX1 - L.PW / 2) continue;
        const c = hazard(x) * 100 + Math.abs(x - aimX) / 200;
        if (c < bestC){ bestC = c; want = x; }
      }
    }
    desired = want;
    if (opts.debug) opts.debug({ t, px, aimX, want, th, hz: hazard(want), vt: view.t });
    wantFire = (Math.abs(aimX - px) < 4 || anyInLine) && (!blocked(px) || brng() < 0.12);
  }

  while (!S.over){
    hist.push(snap());
    while (hist.length > 90) hist.shift();             // ~1.5 с памяти
    let vi = hist.length - 1; while (vi > 0 && hist[vi].t > t - react) vi--;
    const view = hist[vi];
    if (t >= nextDecide){
      nextDecide = t + 1 / 20;
      let oi = vi; while (oi > 0 && hist[oi].t > view.t - 0.2) oi--;
      decide(view, oi < vi ? hist[oi] : null);
    }
    const d = desired - S.player.x;
    game.setDir(Math.abs(d) < 2 ? 0 : Math.sign(d));
    if (wantFire && !S.shot) game.action();
    game.update(h); t += h;
    if (S.wave !== curWave){ waveTime[curWave] = tWave; curWave = S.wave; tWave = 0; hist.length = 0; }
    tWave += h;
    if (tWave > maxWaveT){ stuck = S.wave; break; }
  }
  if (S.over || stuck) waveTime[curWave] = tWave;
  const passed = S.won ? waves : (S.wave - start);
  return { passed, won: S.won, invaded: S.invaded, lost, waveTime, stuck, score: S.score, react };
}
