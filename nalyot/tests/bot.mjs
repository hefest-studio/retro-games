/* НАЛЁТ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setDir(pi, dx, dy) (восемь направлений, как клавиши),
   setFire(pi, held), jump(pi), grenade(pi). Читает состояние только «глазами»:
   - решения раз в 160–260 мс (реакция), между решениями держит прежние клавиши;
   - видит только кадр камеры (враги, пули, бомбы за кадром не учитываются);
   - замечает пулю/бомбу/волну/лазер не сразу: при каждом «взгляде» (решении) пропускает её с вероятностью
     opts.miss (по умолчанию 0.45), волны и лазеры — один бросок;
   - целится восемью направлениями (как клавишами), по рельефу прыгает «на глаз»: стена или яма впереди;
   - гранаты бросает по турелям, броневагонам, постройкам и боссу, когда они рядом;
   - «Котёл» берёт, если тот впереди в кадре; выпрыгивает, когда он загорелся.
   opts: { startMission=1, missions, players=1, miss=0.3, react:[0.16,0.26], maxMissionT=420 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playNalyot(N, seed, opts = {}){
  const L = N.logic, T = L.T, start = opts.startMission || 1;
  const missions = opts.missions || (L.MISSIONS.length - start + 1);
  const brng = mulberry32(seed * 7919 + 101);
  const [r0, r1] = opts.react || [0.16, 0.26];
  const miss = opts.miss != null ? opts.miss : 0.45;
  const maxT = opts.maxMissionT || 420;
  const events = [];
  const game = N.Game({ rng: mulberry32(seed), players: opts.players || 1, mission: start, maxMission: start + missions - 1,
    onEvent: (t, d) => { if (t === 'clear' || t === 'heroDie' || t === 'win' || t === 'gameover') events.push([t, d, S ? S.mission : start]); } }).start();
  const S = game.state(), dt = 1 / 60;
  const ctl = S.heroes.map(() => ({ seen: new WeakMap(), hold: null, next: 0, dx: 1, dy: 0, fire: false, lastX: 0, stuckT: 0, gCd: 0, dodge: 0 }));
  let t = 0, tm = 0, curM = S.mission, stuck = false;
  const deaths = {};

  const solid = (c, r) => game._cellSolid(c, r);
  const groundRow = (c, fromRow) => { for (let r = Math.max(0, fromRow); r < L.ROWS; r++) if (solid(c, r) || (S.grid[r * S.W + c] === 2)) return r; return -1; };
  const inView = o => o.x > S.cam.x - 10 && o.x < S.cam.x + L.VIEW_W + 10;

  function decide(pi){
    const H = S.heroes[pi], C = ctl[pi];
    if (!H.alive){ C.dx = 0; C.dy = 0; C.fire = false; return; }
    const B = H.ride || H, hh = H.ride ? H.ride.hh : L.HH, feetRow = Math.floor((B.y - 1) / T);
    let dx = 1, dy = 0, fire = false, jump = false, gren = false, standStill = false, threat = null;
    // --- цели в кадре ---
    const foes = S.enemies.filter(e => !e.dead && inView(e)).map(e => ({ e, d: Math.hypot(e.x - B.x, (e.y - e.hh / 2) - (B.y - 18)) })).sort((a, b) => a.d - b.d);
    const boss = S.boss && !S.boss.dead && S.boss.intro <= 0 ? S.boss : null;
    let tgt = null;
    if (foes.length && foes[0].d < 520) tgt = { x: foes[0].e.x, y: foes[0].e.y - foes[0].e.hh / 2, e: foes[0].e };
    if (boss && (!tgt || foes[0].d > 200)) tgt = { x: boss.x - (boss.fly ? 0 : boss.w / 2) + 14, y: boss.y - boss.hh * 0.5, boss };
    // стена/постройка впереди
    const aheadCol = Math.floor((B.x + B.w / 2 + 8) / T);
    let wallH = 0; for (let r = feetRow; r > feetRow - 6 && r >= 0; r--) { if (solid(aheadCol, r)) wallH++; else break; }
    const blk = S.blocks.find(b => !b.dead && b.tx <= aheadCol + 2 && b.tx + b.tw > aheadCol && b.y > B.y - hh && b.ty * T < B.y);
    if (blk && wallH >= 3 && !tgt) tgt = { x: blk.x - blk.tw * T / 2 + 4, y: B.y - 18, block: blk };
    if (blk && wallH >= 3 && tgt && Math.abs(tgt.x - B.x) > 240) tgt = { x: blk.x - blk.tw * T / 2 + 4, y: B.y - 18, block: blk };
    // --- стрельба: 8 направлений, как клавишами ---
    if (tgt){
      const mx = B.x, my = B.y - (H.ride ? 30 : 20), vx = tgt.x - mx, vy = tgt.y - my;
      const a = Math.atan2(vy, vx), oct = Math.round(a / (Math.PI / 4));   // −4..4
      const fx = Math.sign(vx) || 1, close = Math.abs(vx) < (tgt.boss ? 0 : tgt.block ? 70 : tgt.e && tgt.e.type === 'wagon' ? 240 : 150);
      fire = Math.hypot(vx, vy) < 560;
      if (oct === -2 || (oct === 2 && !B.onGround)){ dx = 0; dy = oct < 0 ? -1 : 1; }          // вверх / вниз (в прыжке)
      else if (oct === -1 || oct === -3){ dx = fx; dy = -1; }                                 // по диагонали вверх — на ходу
      else if (oct === 1 || oct === 3){ dx = fx; dy = 1; }                                    // по диагонали вниз — на ходу
      else { dx = fx; dy = 0; if (close){ standStill = true; } }                              // горизонтально
      if (standStill){ if (B.face === fx || (H.ride && H.ride.face === fx)) dx = 0; else dx = fx; }
      if (dx < 0 && !tgt.boss && Math.abs(vx) > 60) dx = 0;                                   // назад без нужды не бежим
      // гранаты — по крепким целям рядом
      const tough = tgt.boss || tgt.block || (tgt.e && (tgt.e.type === 'turret' || tgt.e.type === 'wagon'));
      if (tough && C.gCd <= 0 && Math.abs(vx) < (H.ride ? 320 : 170) && (H.ride || H.grenades > 1) && brng() < 0.6){ gren = true; C.gCd = H.ride ? 1 : 1.6; }
      if (!tough && foes.filter(f => f.d < 140).length >= 3 && H.grenades > 2 && C.gCd <= 0){ gren = true; C.gCd = 2; }
    }
    // --- рельеф: стена — прыжок (или стреляем, если высокая), яма впереди — прыжок у края ---
    if (dx > 0){
      if (wallH > 0 && wallH <= 4 && B.x + B.w / 2 > aheadCol * T - 14) jump = true;
      // яма: человек видит край заранее и прыгает у самого края (запланированный момент)
      if (B.onGround){
        const fc = Math.floor((B.x + B.w / 2) / T);
        for (let k = 0; k <= 2; k++){
          const c = fc + k, gr = groundRow(c, feetRow - 4);
          if (gr < 0 || gr > feetRow + 3){
            const edge = c * T, dist = edge - (B.x + B.w / 2), spd = H.ride ? L.KOTEL.speed : L.RUN;
            if (dist < 70){ if (dist < 10) jump = true; else C.jumpAt = t + (dist - 6) / spd; }
            break;
          }
        }
      }
    }
    // --- босс: держать дистанцию ---
    if (boss){
      const near = boss.fly ? boss.x - 110 : boss.x - boss.w / 2 - 170;
      if (B.x > near) dx = -1;
      if (B.x < S.arenaX + 70 && dx < 0) dx = 0;
      if (boss.fly && B.x < boss.x - 260 && dx <= 0) dx = 1;
    }
    // --- броневагон рядом: не лезть ---
    for (const f of foes){ if (f.e.type === 'wagon' && f.e.x > B.x && f.e.x - B.x < 150 && dx > 0) dx = 0; }
    // --- «Котёл» ---
    if (!H.ride){
      const v = S.vehicles.find(v => !v.dead && v.rider < 0 && v.boom <= 0 && inView(v) && v.x > B.x - 40 && v.x - B.x < 320);
      if (v){ if (Math.abs(v.x - B.x) < 10 && B.onGround){ dx = 0; dy = 1; jump = false; } else if (!threat){ dx = Math.sign(v.x - B.x); if (dy > 0) dy = 0; } }
    } else if (H.ride.boom > 0 || H.ride.hp < 4){ dy = 1; jump = true; }
    // --- бомбы: где упадёт (по дуге), отойти, если успеваем ---
    for (const bm of S.bombs){
      if (!inView(bm)) continue;
      const G = bm.kind === 'drop' ? L.GRAV * 0.55 : L.GRAV, dy0 = B.y - 6 - bm.y, disc = bm.vy * bm.vy + 2 * G * dy0; if (disc < 0) continue;
      const tl = (-bm.vy + Math.sqrt(disc)) / G; if (tl < 0 || tl > 1.6) continue;
      const land = bm.x + bm.vx * tl;
      if (!C.seen.get(bm)) C.seen.set(bm, brng() > miss);
      if (C.seen.get(bm) && Math.abs(land - B.x) < bm.r + 18){ dx = land > B.x ? -1 : 1; dy = 0; standStill = false; if (B.x < S.cam.x + 60 && dx < 0) dx = 1; }
    }
    for (const e of foes){ if (e.e.type === 'drone' && e.e.warn && Math.abs(e.e.x - B.x) < 56 && brng() > miss){ dx = e.e.x > B.x ? -1 : 1; if (B.x < S.cam.x + 60) dx = 1; dy = 0; } }
    // метки миномёта/«дождя»: выбрать сторону, где до ближайшей метки дальше всего
    const marks = S.marks.filter(m => { if (!C.seen.get(m)) C.seen.set(m, brng() > miss); return C.seen.get(m); });
    if (marks.some(m => Math.abs(m.x - B.x) < 46)){
      const safe = x => Math.min(...marks.map(m => Math.abs(m.x - x))) - (x < S.cam.x + 50 || x > S.cam.x + L.VIEW_W - 50 ? 100 : 0) - (boss && !boss.fly && x > boss.x - boss.w / 2 - 40 ? 200 : 0);
      const opts2 = [[-1, safe(B.x - 70)], [1, safe(B.x + 70)], [0, safe(B.x)]].sort((a, b) => b[1] - a[1]);
      dx = opts2[0][0]; dy = 0; standStill = dx === 0;
    }
    // Пули: замеченные (один бросок «зевка» на пулю) — «прикинуть» несколько вариантов движения на 0.8 с вперёд
    // и выбрать тот, где пули проходят дальше всего от тела (как человек, который видит траектории).
    threat = null;
    const seenB = S.ebullets.filter(b => {
      if (!inView(b) || Math.hypot(b.x - B.x, b.y - B.y) > 300) return false;
      if (!C.seen.get(b)) C.seen.set(b, brng() > miss);   // не заметил — может заметить при следующем взгляде
      return C.seen.get(b);
    });
    S.bombs.forEach(bm => { if (inView(bm) && C.seen.get(bm)) seenB.push({ x: bm.x, y: bm.y, vx: bm.vx, vy: bm.vy, r: bm.r * 0.8, g: bm.kind === 'drop' ? L.GRAV * 0.55 : L.GRAV }); });
    if (seenB.length && B.onGround){
      const spd = H.ride ? L.KOTEL.speed : L.RUN, jv = H.ride ? L.KOTEL.jump : L.JUMP;
      const clear = (vx, crouch, jmp) => {
        let m = 1e9;
        for (let k = 0; k <= 24; k++){
          const tt = k / 30, x = B.x + vx * tt, y = jmp ? Math.min(B.y, B.y - jv * tt + 0.5 * L.GRAV * tt * tt) : B.y;
          const top = y - (crouch ? L.CROUCH_H : hh);
          for (const b of seenB){
            const bx = b.x + b.vx * tt, by = b.y + b.vy * tt + (b.g ? 0.5 * b.g * tt * tt : 0);
            const ox = Math.max(0, Math.abs(bx - x) - B.w / 2), oy = by < top ? top - by : by > y ? by - y : 0;
            m = Math.min(m, Math.hypot(ox, oy) - b.r);
          }
        }
        return m;
      };
      const planned = clear(standStill || (dx === 0 && dy > 0) ? 0 : dx * spd, !H.ride && dy > 0 && dx === 0, jump);
      if (planned < 8){
        const cands = [[0, 0, false, false], [-1, 0, false, false], [1, 0, false, false], [0, 1, false, true], [dx, 0, true, false], [0, 0, true, false]]
          .filter(c => !(c[3] && H.ride))
          .map(c => ({ c, v: clear(c[0] * spd, c[3], c[2]) + (c[0] < 0 ? -2 : 0) }));
        cands.sort((a, b) => b.v - a.v);
        const best = cands[0].c; threat = best;
        dx = best[0]; dy = best[3] ? 1 : 0; jump = best[2]; standStill = dx === 0;
        if (best[3]) C.hold = { until: t + 0.35 };
      }
    }
    for (const w of S.waves){
      if (!C.seen.has(w)) C.seen.set(w, brng() > miss * 0.7);
      const rx = w.x - B.x; if (C.seen.get(w) && rx > -10 && rx < 110 && B.onGround){ jump = true; dy = 0; }
    }
    for (const l of S.lasers){
      if (!C.seen.has(l)) C.seen.set(l, brng() > miss * 0.6);
      if (!C.seen.get(l) || (l.warn > 0.4)) continue;
      if (l.low){ if (B.onGround && l.warn < 0.3) jump = true; }
      else if (!H.ride){ dx = 0; dy = 1; standStill = true; jump = false; C.hold = { until: t + Math.max(0, l.warn) + l.fire + 0.05 }; }
      else if (B.onGround) jump = true;
    }
    // --- застревание ---
    if (B.x > C.lastX + 6 || threat){ C.lastX = Math.max(C.lastX, B.x); C.stuckT = 0; } else C.stuckT += (r0 + r1) / 2;
    if (!boss && C.stuckT > (tgt ? 5 : 2.5)){ jump = C.stuckT % 1.2 < 0.6; dx = 1; dy = 0; fire = true; }
    if (C.hold && t < C.hold.until && !jump){ dx = 0; dy = 1; } else C.hold = null;
    // в прыжке направление не бросаем (человек держит стрелку, пока летит над ямой)
    if (jump && B.onGround) C.jdx = dx || 1;
    // в воздухе: «прикинуть», куда приземлюсь; если у края ямы — нажать прыжок к приземлению (буфер 0.2 с)
    if (!B.onGround && dx > 0 && B.vy > -200){
      const spd = H.ride ? L.KOTEL.speed : L.RUN;
      let x = B.x, y = B.y, vy = B.vy, tl = 0;
      for (let k = 0; k < 60; k++){
        const ny = y + vy / 30; vy += L.GRAV / 30; x += spd / 30; tl += 1 / 30;
        const row = Math.floor(ny / T), c0 = Math.floor((x - B.w / 2) / T), c1 = Math.floor((x + B.w / 2) / T);
        if (vy > 0 && (solid(c0, row) || solid(c1, row) || S.grid[row * S.W + c1] === 2) && y <= row * T + 1){
          const ec = Math.floor((x + B.w / 2 + 34) / T), ge = groundRow(ec, row - 3);
          if (ge < 0 || ge > row + 3) C.jumpAt = t + Math.max(0, tl - 0.12);
          break;
        }
        y = ny; if (y > L.ROWS * T) break;
      }
    }
    if (!B.onGround && !jump){ const under = groundRow(Math.floor(B.x / T), feetRow); if (under < 0 || under > feetRow + 2){ dx = C.jdx || 1; if (dy > 0) dy = 0; } }
    C.dx = dx; C.dy = dy; C.fire = fire;
    if (jump) game.jump(pi);
    if (gren) game.grenade(pi);
  }

  while (!S.over && !S.won){
    for (let pi = 0; pi < S.heroes.length; pi++){
      const C = ctl[pi];
      C.gCd -= dt;
      if (t >= C.next){ decide(pi); C.next = t + r0 + brng() * (r1 - r0); }
      if (C.jumpAt && t >= C.jumpAt){ C.jumpAt = 0; if (C.dx > 0) { game.jump(pi); C.jdx = 1; } }
      game.setDir(pi, C.dx, C.dy); game.setFire(pi, C.fire);
    }
    game.update(dt); t += dt; tm += dt;
    if (S.mission !== curM){ curM = S.mission; tm = 0; ctl.forEach(C => { C.lastX = 0; C.stuckT = 0; C.hold = null; C.jumpAt = 0; }); }
    if (tm > maxT){ stuck = true; break; }
  }
  events.filter(e => e[0] === 'heroDie').forEach(e => { const k = e[2] + ':' + e[1].src; deaths[k] = (deaths[k] || 0) + 1; });
  const passed = events.filter(e => e[0] === 'clear').length;
  return { won: S.won, passed, mission: S.mission, score: S.score, stuck, deaths, time: t };
}
