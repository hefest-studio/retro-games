/* ПУЗЫРЬ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: видит то же, что на экране (платформы, врагов, шары, бонусы, искры), управляет
   как игрок — setInput(направление, прыжок зажат) и blow().
   Человеческие ограничения:
   - решает не каждый кадр, а раз в `react` (0.12–0.22 с), между решениями держит клавиши;
   - иногда (`blunder`) не замечает врага рядом; выдувает с ошибкой прицела (поворачивается не сразу);
   - ходит по графу платформ (как человек «видит», куда можно запрыгнуть/спрыгнуть).
   Стратегия: опасность рядом → выдуть шар во врага или уйти → лопнуть шары с врагами (пока не вырвались) →
   подобрать бонусы → охотиться на врагов (выйти на их уровень и выдуть) → лопать буквы и спецшары.
   opts: { players=1, levels=31, startLevel=1, lives=3, react:[0.12,0.22], blunder=0.04, maxLevelT=150, perfect=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function makeBrain(Z, game, pi, brng, opts = {}){
  const L = Z.logic, S = game.state(), perfect = !!opts.perfect, edgeDrive = L.drive;
  const [r0, r1] = opts.react || [0.12, 0.22];
  const react = perfect ? 1 / 60 : r0 + brng() * (r1 - r0);
  const blunder = perfect ? 0 : (opts.blunder == null ? 0.01 : opts.blunder);
  let landed = false, blowAt = 0, nextDecide = 0, dir = 0, jumpT = 0, jumpRel = 0, edge = null, edgeFrom = null, goalX = null, mode = 'idle', blind = 0;

  const me = () => S.players[pi];
  function curSeg(p){
    if (!p.ground) return null;
    const r = Math.round(p.y);
    return L.segAt(S.segs, p.x, r) || S.segs.filter(s => s.row === r).sort((a, b) => Math.abs((a.lo + a.hi) / 2 - p.x) - Math.abs((b.lo + b.hi) / 2 - p.x))[0] || null;
  }
  function pressJump(){ if (jumpRel <= 0 && jumpT <= 0){ jumpT = 0.22; } }
  // Сегмент, откуда можно достать шар прыжком (или дойти до него)
  function segForBubble(b){
    let best = null, bv = 1e9;
    for (const s of S.segs){
      if (!(b.y < s.row - 0.2 && b.y > s.row - 6.6)) continue;
      const ox = b.x < s.lo ? s.lo - b.x : b.x > s.hi ? b.x - s.hi : 0;
      if (ox > 0.6) continue;
      const v = Math.abs(s.row - (b.y + 3)) + ox * 3;
      if (v < bv){ bv = v; best = s; }
    }
    return best;
  }
  function segForPoint(x, y){
    const r = Math.round(y);
    const s = L.segAt(S.segs, x, r); if (s) return s;
    return L.landing(S.segs, x, y - 0.5);
  }
  function active(){ return S.enemies.filter(e => e.spawnT <= 0); }
  function hazards(p){
    const out = [];
    for (const e of active()){
      const vx = e.vx || e.dir * e.speed, vy = e.fly ? e.vy : e.ground ? 0 : Math.min(13, e.vy);
      out.push({ x: e.x, y: e.y, vx, w: e.w, h: e.h, e });
      if (e.charge > 0 && e.ground) out.push({ x: e.x + e.dir * 3, y: e.y, vx: e.dir * 6.5, w: 0.6, h: 0.6, shot: true });   // замах — сейчас выстрелит
      for (const k of [0.2, 0.4]) out.push({ x: e.x + vx * k, y: e.y + (e.fly || !e.ground ? vy * k + (e.fly ? 0 : 35 * k * k) : 0), vx, w: e.w, h: e.h, e, pred: true });
    }
    for (const s of S.shots){
      if (s.kind === 'drop'){ for (const k of [0, 0.25, 0.5]) out.push({ x: s.x + s.vx * k, y: s.y + s.vy * k + 0.4, vx: s.vx, w: 0.8, h: 0.8, drop: true }); continue; }
      out.push({ x: s.x, y: s.y + 0.3, vx: s.vx, w: 0.6, h: 0.6, shot: true });
    }
    const B = S.boss; if (B && B.alive && !B.trapped && B.spawnT <= 0) out.push({ x: B.x, y: B.y, vx: B.vx, w: B.w, h: B.h, boss: true });
    return out;
  }

  // Путь по ребру свободен от врагов (смотрим на столб прыжка и точку приземления)
  function pathClear(p, e){
    const to = S.segs[e.to], lx = e.type === 'fall' ? e.land : e.tx, top = Math.min(to.row, p.y) - 2.2, bot = Math.max(to.row, p.y) + 0.5;
    for (const en of active()){
      if (en.y < top || en.y - en.h > bot) continue;
      const lo = Math.min(p.x, lx) - 2.2, hi = Math.max(p.x, lx) + 2.2;
      if (en.x > lo && en.x < hi && Math.abs(en.y - p.y) > 0.9) return false;
    }
    return true;
  }
  function decide(){
    const p = me(); if (!p.alive){ dir = 0; return; }
    if (blind > 0) blind -= react;
    else if (brng() < blunder) blind = 0.5 + brng() * 0.6;      // «зазевался»
    const seg = curSeg(p);
    // 1) опасность
    if (blind <= 0 && p.inv <= 0.2){
      let threat = null, td = 1e9;
      for (const h of hazards(p)){
        const dx = h.x - p.x, vOver = h.y - h.h < p.y + 0.3 && p.y - p.h < h.y + 0.3;
        const near = Math.abs(dx) - (h.w + p.w) / 2;
        const coming = h.drop || Math.sign(h.vx || 0) === -Math.sign(dx) || Math.abs(dx) < 1.5;
        const lim = h.shot ? 3.5 : h.drop ? 1.2 : h.boss ? 3 : 2.4;
        if (vOver && near < lim && (coming || near < 1) && near < td){ td = near; threat = h; }
        else if (!vOver && !h.pred && h.e && h.e.ground && !h.e.fly && h.y < p.y - 1 && h.y > p.y - 6){   // сверху вот-вот сойдёт с края
          const s = L.segAt(S.segs, h.e.x, Math.round(h.e.y)), dr = h.e.dir;
          if (s){ const ex = dr > 0 ? s.c1 + 1 + 0.9 : s.c0 - 0.9;
            if ((ex - h.e.x) * dr < 2.2 && Math.abs(ex - p.x) < 2.3 && near + 1.5 < td){ td = near + 1.5; threat = Object.assign({}, h, { x: ex }); } }
        }
        else if (!vOver && !h.pred && !h.shot && h.e && !h.e.ground && !h.e.fly && h.y < p.y - 0.8 && h.y > p.y - 7){   // сверху падает: где он будет на моём уровне
          const e = h.e, dy = p.y - e.y, tt = (-e.vy + Math.sqrt(e.vy * e.vy + 2 * L.G * dy)) / L.G, xa = e.x + e.vx * tt;
          if (tt < 0.9 && Math.abs(xa - p.x) < 2.3 && near + 1 < td){ td = near + 1; threat = Object.assign({}, h, { x: xa }); }
        }
      }
      if (threat){
        const dx = threat.x - p.x, same = Math.abs(threat.y - p.y) < 1.0;
        if (threat.shot){ if (p.ground) pressJump(); dir = -Math.sign(dx) || 1; mode = 'dodge'; edge = null; return; }
        if (threat.drop){ dir = -Math.sign(dx) || (p.x < 16 ? 1 : -1); mode = 'dodge'; edge = null; return; }
        if (same && !threat.boss && p.blowCd <= 0){
          if (Math.sign(dx) === p.face || Math.abs(dx) < 0.4){ game.blow(pi); dir = 0; mode = 'fight'; return; }
          dir = Math.sign(dx); mode = 'turn'; blowAt = 0.05; return;   // развернуться и сразу выдуть
        }
        dir = -Math.sign(dx) || (p.x < 16 ? 1 : -1); mode = 'flee'; edge = null;
        const above = active().some(e => Math.abs(e.x - p.x) < 3 && e.y < p.y - 1 && e.y > p.y - 6);
        if (p.ground && same && !above && (threat.boss || td < 0.6)) pressJump();
        return;
      }
    }
    // 2) атака: враг на моём уровне в пределах досягаемости шара
    for (const e of active()){
      const dx = e.x - p.x;
      if (Math.abs(e.y - p.y) < 0.9 && Math.abs(dx) < L.RANGE + 0.8 && p.blowCd <= 0 && p.ground){
        if (Math.sign(dx) === p.face){ game.blow(pi); dir = 0; mode = 'shoot'; return; }
        dir = Math.sign(dx); mode = 'aim'; blowAt = 0.05; return;
      }
    }
    const B = S.boss;
    if (B && B.alive && !B.trapped && p.blowCd <= 0 && Math.abs((B.y - B.h / 2) - (p.y - p.h / 2)) < B.h / 2 + 0.3 && Math.abs(B.x - p.x) < 8){
      const dx = B.x - p.x;
      if (Math.sign(dx) === p.face){ game.blow(pi); mode = 'shoot'; }
      else dir = Math.sign(dx);
    }
    if (!seg){ return; }                                          // в воздухе — держим курс
    // 3) цели
    const goals = [];
    for (const b of S.bubbles){
      if (b.phase !== 'float') continue;
      let w = b.enemy ? 0 : b.kind === 'letter' ? 6 : b.kind !== 'plain' ? (S.boss && b.kind === 'bolt' ? 1 : 7) : 30;
      if (w >= 30) continue;
      if (b.enemy) w -= Math.max(0, 4 - b.trapT);                 // вот-вот вырвется — срочно
      goals.push({ x: b.x, y: b.y, w, bubble: b });
    }
    if (B && B.trapped && B.alive) goals.push({ x: B.x, y: B.y - B.h / 2, w: -5, bubble: { x: B.x, y: B.y - B.h / 2, r: 2 } });
    for (const it of S.items) goals.push({ x: it.x, y: it.y, w: 3, item: true });
    for (const e of active()) goals.push({ x: e.x, y: e.y, w: 4, enemy: e });
    let best = null, bv = 1e9;
    for (const gl of goals){
      const t = gl.bubble ? segForBubble(gl.bubble) : segForPoint(gl.x, gl.y);
      if (!t) continue;
      const rt = t.id === seg.id ? null : L.route(S.segs, seg.id, t.id);
      if (t.id !== seg.id && !rt) continue;
      const v = gl.w + (Math.abs(gl.x - p.x) + Math.abs(t.row - seg.row)) * 0.15 + brng() * 0.6;
      if (v < bv){ bv = v; best = { gl, t, rt }; }
    }
    if (!best){ edge = null; goalX = 16; mode = 'idle'; return; }
    const { gl, t, rt } = best;
    if (rt){ edge = rt; edgeFrom = seg.id; mode = 'route'; return; }
    edge = null; mode = 'local';
    if (gl.enemy && gl.enemy.fly){ goalX = Math.max(t.slo, Math.min(t.shi, gl.x - Math.sign(gl.x - p.x) * 3)); return; }
    goalX = Math.max(t.slo, Math.min(t.shi, gl.x));
    if (gl.bubble && Math.abs(goalX - p.x) < 0.6 && gl.y < p.y - p.h + 0.2 && p.ground) pressJump();
  }

  function steer(dt){
    const p = me();
    if (!p.alive){ game.setInput(pi, 0, false); jumpT = 0; return; }
    let d = dir, j = false;
    if (mode === 'route' && edge){
      if (p.ground){ const sg = curSeg(p); if (sg && sg.id !== edgeFrom){ edge = null; mode = 'wait'; d = 0; landed = true; } }
      if (edge){
        const c = edgeDrive(p, edge); d = c.dir;
        if (p.ground && (c.jump || edge.type === 'fall') && !pathClear(p, edge)){ d = 0; }
        else if (c.jump && p.ground) pressJump();
      }
    } else if (mode === 'local' && goalX != null){
      const dx = goalX - p.x; d = Math.abs(dx) > 0.25 ? Math.sign(dx) : 0;
    } else if (mode === 'idle' && goalX != null){ const dx = goalX - p.x; d = Math.abs(dx) > 1 ? Math.sign(dx) : 0; }
    if (blowAt > 0){ blowAt -= dt; if (blowAt <= 0 && p.face === (dir || p.face)){ game.blow(pi); dir = 0; d = 0; } }
    if (jumpT > 0){ j = true; jumpT -= dt; if (jumpT <= 0) jumpRel = 0.05; }
    else if (jumpRel > 0) jumpRel -= dt;
    game.setInput(pi, d, j);
  }

  return {
    react,
    get mode(){ return mode; },
    tick(t, dt){
      if (landed){ landed = false; nextDecide = Math.min(nextDecide, t + react * 0.5); }
      if (t >= nextDecide){ nextDecide = t + react; decide(); }
      steer(dt);
    }
  };
}

export function playPuzyr(Z, seed, opts = {}){
  const L = Z.logic, levels = opts.levels || 31, start = opts.startLevel || 1;
  const brng = mulberry32(seed * 7919 + 13);
  const maxLevelT = opts.maxLevelT || 150;
  const deaths = {}, levelTime = {};
  const game = Z.Game({ rng: mulberry32(seed), players: opts.players || 1, level: start, maxLevel: start + levels - 1, lives: opts.lives || 3,
    onEvent: (t, d) => { if (t === 'die') deaths[S.level] = (deaths[S.level] || 0) + 1; } }).start();
  const S = game.state(), h = 1 / 60;
  const brains = S.players.map((p, i) => makeBrain(Z, game, i, brng, opts));
  let t = 0, tLevel = 0, cur = S.level, stuck = 0;
  while (!S.over){
    for (const b of brains) b.tick(t, h);
    game.update(h); t += h;
    if (S.level !== cur){ levelTime[cur] = tLevel; cur = S.level; tLevel = 0; }
    tLevel += h;
    if (tLevel > maxLevelT){ stuck = S.level; break; }
  }
  levelTime[cur] = tLevel;
  const passed = S.won ? levels : (S.level - start);
  return { passed, won: S.won, deaths, levelTime, stuck, score: S.score, react: brains[0].react, level: S.level };
}
