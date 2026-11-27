/* РЕДУТ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setDir(x, y) (стик), place() (A), flare() (B); состояние читает «глазами» поля
   (позиции мглы, свои опоры, заряд). Решения раз в 150–250 мс (реакция), между решениями держит прежний ввод;
   каждую мглу «замечает» с вероятностью 1 − miss (0.22) на каждом взгляде. Тактика: ставит одну-две опоры на стороне основной угрозы
   (оградой), остальным концом луча «подметает» подходы маятником, обходит мглу, вспышку жмёт, когда рядом ≥ 3 или гаситель/босс.
   opts: { wave=1, maxWave, miss=0.22, react:[0.15,0.25], maxT=420, seed } */
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playRedut(R, seed, opts = {}){
  const L = R.logic, CX = L.CX, CY = L.CY;
  const brng = mulberry32(seed * 7919 + 101);
  const [r0, r1] = opts.react || [0.15, 0.25], miss = opts.miss != null ? opts.miss : 0.22, maxT = opts.maxT || 420;
  const ev = { splat: {}, deaths: 0, coreHits: 0, clears: [], flares: 0, kills: 0, why: null };
  let tm = 0;
  const game = R.Game({ rng: mulberry32(seed), wave: opts.wave || 1, maxWave: opts.maxWave, noHints: true,
    onEvent: (t, d) => { if (t === 'hurt') { ev.deaths++; ev.hs = ev.hs || {}; ev.hs[d.src] = (ev.hs[d.src] || 0) + 1; } else if (t === 'coreHit') ev.coreHits++; else if (t === 'splat') ev.splat[d.type] = (ev.splat[d.type] || 0) + 1; else if (t === 'clear') ev.clears.push({ wave: d.wave, t: tm }); else if (t === 'flare') ev.flares++; else if (t === 'kill' || t === 'bossDie') ev.kills++; } }).start();
  const S = game.state();
  let next = 0, phi = 0, mode = 'build', buildT = 0, sweepDir = 1, tgtAng = -Math.PI / 2, lastRetarget = 0;
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  let dx = 0, dy = 0;
  const dt = 1 / 30;
  while (tm < maxT && S.phase !== 'over' && S.phase !== 'won'){
    tm += dt;
    if (S.phase === 'clear' && S.clearT > 0.2) S.clearT = Math.min(S.clearT, 0.2);
    if (tm >= next){
      next = tm + r0 + brng() * (r1 - r0);
      const h = S.hero;
      const seen = S.enemies.filter(e => brng() > miss && e.x > -10 && e.x < L.W + 10 && e.y > -10 && e.y < L.AH + 10);
      // основная угроза: угол взвешенного центра ближних к маяку
      let sx = 0, sy = 0, sw = 0;
      for (const e of seen){ const d = Math.hypot(e.x - CX, e.y - CY); if (d > 330) continue; const w = 1 / Math.max(40, d - 20); sx += (e.x - CX) * w / Math.max(1, d); sy += (e.y - CY) * w / Math.max(1, d); sw += w; }
      if (sw > 0 && tm - lastRetarget > 1.2){ const a = Math.atan2(sy, sx); if (Math.abs(wrap(a - tgtAng)) > 0.5 || S.pylons.length === 0){ tgtAng = a; lastRetarget = tm; } }
      // цель по умолчанию — «подметание»
      const pts = [{ x: CX, y: CY }, ...S.pylons], last = pts[pts.length - 1];
      let fl = 0; for (let i = 1; i < pts.length; i++) fl += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const rem = S.lmax - fl;
      let tx, ty;
      // строительство: nPyl опор в сторону угрозы, затем — орбита вокруг последней точки луча
      const want = Math.min(S.maxP, opts.pylons != null ? opts.pylons : 1);
      if (mode === 'build'){
        if (S.pylons.length >= want) mode = 'sweep';
        else {
          const k = S.pylons.length, a = tgtAng + (k === 0 ? 0 : 0.9), rr = k === 0 ? 90 : 120;
          tx = CX + Math.cos(a) * rr; ty = CY + Math.sin(a) * rr;
          if (Math.hypot(h.x - tx, h.y - ty) < 14) game.place();
        }
      }
      if (mode === 'sweep'){
        const rr = Math.min(rem * 0.92, opts.orbit || 125);
        if (opts.guard) {
          // страж: стоит на оси ближайшей угрозы и покачивает луч поперёк подхода
          const urg = seen.filter(e => e.air <= 0 || true).sort((a, b) => Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY))[0];
          const bs = seen.find(e => e.type === 'eater');
          if (bs){ const bd = Math.hypot(bs.x - CX, bs.y - CY) || 1; tx = bs.x + (bs.x - CX) / bd * 80 + Math.sin(tm * 1.7) * 18; ty = bs.y + (bs.y - CY) / bd * 80; tx = Math.max(24, Math.min(L.W - 24, tx)); ty = Math.max(24, Math.min(L.AH - 24, ty)); if (Math.hypot(tx - bs.x, ty - bs.y) < 70) { tx = CX + Math.cos(tgtAng) * 70; ty = CY + Math.sin(tgtAng) * 70; } }
          else if (urg){ const ua = Math.atan2(urg.y - CY, urg.x - CX), d = Math.hypot(urg.x - CX, urg.y - CY), r2 = Math.max(52, Math.min(opts.guard, d - 40)), a2 = ua + 0.5 * Math.sin(tm * 2.4);
            tx = CX + Math.cos(a2) * r2; ty = CY + Math.sin(a2) * r2; }
          else { tx = CX + Math.cos(tgtAng) * 60; ty = CY + Math.sin(tgtAng) * 60; }
        } else
        if (sw === 0 && !seen.length) { tx = CX + Math.cos(tgtAng) * 60; ty = CY + Math.sin(tgtAng) * 60; }
        else {
          const cur = Math.atan2(h.y - last.y, h.x - last.x); phi = cur + 0.55 * sweepDir;
          const ar = seen.filter(e => e.type === 'armor' || e.type === 'eater').sort((a, b) => Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY))[0];
          if (ar && Math.hypot(ar.x - CX, ar.y - CY) < 230) phi = Math.atan2(ar.y - last.y, ar.x - last.x);
          tx = last.x + Math.cos(phi) * rr; ty = last.y + Math.sin(phi) * rr;
          tx = Math.max(20, Math.min(L.W - 20, tx)); ty = Math.max(20, Math.min(L.AH - 20, ty));
          if (Math.hypot(tx - h.x, ty - h.y) < 4 && brng() < 0.5) sweepDir = -sweepDir;
        }
      }
      // вспышка
      if (S.charge >= 100 && h.alive){
        let near = 0, special = false; for (const e of seen){ const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < S.flareR * 0.95){ near++; if (e.type === 'snuff' || e.type === 'eater') special = true; } }
        const snHere = seen.some(e => e.type === 'snuff'); if ((near >= 3 && !(snHere && !special && S.coreHp > 2)) || special || (S.coreHp <= 2 && near >= 1)) game.flare();
        else { const sn = seen.find(e => e.type === 'snuff' && Math.hypot(e.x - h.x, e.y - h.y) < 260); if (sn && mode !== 'dismantle'){ tx = sn.x - (sn.x - CX) * 0.1; ty = sn.y - (sn.y - CY) * 0.1; } }
      }
      // обход мглы
      let ax = (tx == null ? h.x : tx) - h.x, ay = (ty == null ? h.y : ty) - h.y, al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
      if (al < 6){ ax = 0; ay = 0; }
      for (const e of seen){ if (e.air > 0) continue; const ex = h.x - e.x, ey = h.y - e.y, d = Math.hypot(ex, ey), safe = e.r + 34; if (d < safe && d > 0){ const k = (safe - d) / safe * 2.6; ax += ex / d * k; ay += ey / d * k; } }
      const l = Math.hypot(ax, ay); if (l > 1){ ax /= l; ay /= l; }
      dx = ax; dy = ay;
    }
    game.setDir(dx, dy);
    game.update(dt);
  }
  ev.won = !!S.won; ev.time = tm; ev.wave = S.wave; ev.score = S.score; ev.core = S.coreHp; ev.lives = S.lives; ev.why = S.over;
  return ev;
}
