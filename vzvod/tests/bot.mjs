/* ВЗВОД · tests/bot.mjs — бот-командир для проверки баланса и проходимости миссий.
   Без читов: командует только как игрок — moveTo (клик), fire (правая кнопка), gear/rocket (бросок в точку).
   «Человеческие» ограничения:
   - решения раз в 150–250 мс (реакция), между решениями держит прежнюю команду;
   - нового врага замечает не сразу: при первом «взгляде» пропускает его с вероятностью opts.miss (0.3),
     огонь открывает только со следующего решения;
   - прицел с ошибкой «на глаз» (±4 px + 4% дистанции), бросок шестерни — только с безопасной дистанции;
   - видит то же, что игрок: экран вокруг лидера и миникарту (ульи, цели, механизмы).
   opts: { squad, rank=0, miss=0.3, react:[0.15,0.25], maxT=480, invuln=false } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playMission(V, oi, mi, seed, opts = {}){
  const L = V.logic, spec = L.mission(oi, mi);
  const brng = mulberry32(seed * 7919 + 11);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.3;
  const maxT = opts.maxT || 480;
  const squad = opts.squad || Array.from({ length: spec.squad }, (_, i) => ({ id: i + 1, name: 'b' + i, rank: opts.rank || 0 }));
  const ev = { broken: 0, why: {}, throws: 0, pickups: 0 };
  const game = V.Game({ spec, seed, rng: mulberry32(seed), squad, invuln: !!opts.invuln,
    onEvent: (t, d) => { if (t === 'broken'){ ev.broken++; ev.why[d.src] = (ev.why[d.src] || 0) + 1; } else if (t === 'throw' || t === 'rocket') ev.throws++; else if (t === 'pickup') ev.pickups++; } }).start();
  const S = game.state(), M = S.map, dt = 1 / 60;
  const seen = new Map(), ignore = new Map(), focus = { id: -1, hp: 0, t: 0 };
  let next = 0, lastT = null, vipPath = null, vipPathT = -9, goal = null, still = { x: 0, y: 0, t: 0 }, wiggle = null;
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function go(p){
    const g = S.groups[S.active], ld = game.leader(S.active), pos = g.vehicle ? S.vehicles.find(v => v.id === g.vehicle) : ld;
    const moving = g.vehicle ? pos.q.length : ld.q.length;
    if (lastT && D(lastT, p) < 12 && moving) return;
    if (D(pos, p) < 6 && !moving) return;
    lastT = { x: p.x, y: p.y }; game.moveTo(p.x, p.y);
  }
  function decide(){
    const g = S.groups[S.active], ld = game.leader(S.active);
    if (!ld){ game.switchGroup(); return; }
    const pos = ld;
    // 1. угрозы на экране (≈ 215 px от лидера, прямая видимость)
    let threat = null, td = 1e9;
    for (const e of S.enemies){
      if (e.dead) continue; const d = D(pos, e);
      if (d > 215 || (ignore.get(e.id) || 0) > S.time || !L.los(M, pos.x, pos.y, e.x, e.y)) continue;
      if (!seen.has(e.id)){ if (brng() > miss) seen.set(e.id, S.time); continue; }
      const w = e.type === 'rusher' ? d * 0.6 : d;
      if (w < td){ td = w; threat = e; }
    }
    if (threat){
      // «не берётся» (угол стены гасит выстрелы) — человек сменил бы позицию: на время забыть о цели
      if (focus.id !== threat.id || focus.hp !== threat.hp){ focus.id = threat.id; focus.hp = threat.hp; focus.t = S.time; }
      else if (S.time - focus.t > 4){ ignore.set(threat.id, S.time + 6); focus.id = -1; }
      const d = D(pos, threat), n = 4 + d * 0.04;
      game.fire(true, threat.x + (brng() - 0.5) * 2 * n, threat.y + (brng() - 0.5) * 2 * n);
      if (ld.q.length && d < 160){ lastT = null; game.moveTo(ld.x, ld.y); }   // встать и отстреляться
      return;
    }
    game.fire(false);
    // топчется на месте 6 с без боя — «встряхнуться»: шаг в случайную сторону
    if (D(pos, still) > 10){ still = { x: pos.x, y: pos.y, t: S.time }; wiggle = null; }
    else if (S.time - still.t > 6 && !wiggle){ const a = brng() * Math.PI * 2; wiggle = { x: pos.x + Math.cos(a) * 60, y: pos.y + Math.sin(a) * 60, t: S.time + 2 }; }
    if (wiggle && wiggle.t > S.time){ go(wiggle); return; }
    const hives = S.hives.filter(h => !h.dead), kind = spec.obj;
    const ammo = S.ammo.gear + S.ammo.rocket;
    if (goal && (goal.taken || S.time > goal.until)) goal = null;
    const pick = S.pickups.filter(p => !p.taken).sort((a, b) => D(pos, a) - D(pos, b))[0];
    if (!goal && pick && (D(pos, pick) < 110 || (hives.length && kind !== 'escort' && kind !== 'hold' && ammo < hives.reduce((s, h) => s + h.hp, 0)))){ goal = pick; goal.until = S.time + 15; }
    if (goal){ go(goal); return; }
    if ((kind === 'hives' || kind === 'clear') && hives.length){
      const h = hives.sort((a, b) => D(pos, a) - D(pos, b))[0], dh = D(pos, h);
      const edge = q => ({ x: h.x + (q.x - h.x) / D(q, h) * 22, y: h.y + (q.y - h.y) / D(q, h) * 22 });
      if (S.ammo.gear <= 0 && S.ammo.rocket > 0){
        // только ракеты: нужна точка с прямой видимостью на улей с безопасной дистанции
        const e0 = edge(pos);
        if (dh > 56 && dh < 200 && L.los(M, pos.x, pos.y, e0.x, e0.y)){ if (!S.missiles.length) game.rocket(h.x, h.y); return; }
        if (!h.spot || S.time > h.spotT){
          let best = null, bd = 1e9; const tx0 = Math.floor(h.x / L.TS), ty0 = Math.floor(h.y / L.TS);
          for (let ty = ty0 - 10; ty <= ty0 + 10; ty++) for (let tx = tx0 - 10; tx <= tx0 + 10; tx++){
            if (L.solidFoot(L.tget(M, tx, ty))) continue;
            const c = { x: tx * L.TS + 8, y: ty * L.TS + 8 }, dc = D(c, h); if (dc < 64 || dc > 150) continue;
            const e1 = edge(c); if (!L.los(M, c.x, c.y, e1.x, e1.y)) continue;
            const k = D(c, pos); if (k < bd){ bd = k; best = c; }
          }
          h.spot = best; h.spotT = S.time + 5;
        }
        if (h.spot){ go(h.spot); return; }
      }
      if (dh < 150 && dh > 56 && S.ammo.gear > 0 && !S.nades.length){ game.gear(h.x + (brng() - 0.5) * 6, h.y + (brng() - 0.5) * 6); return; }
      if (dh <= 56){ go({ x: pos.x + (pos.x - h.x) / dh * 50, y: pos.y + (pos.y - h.y) / dh * 50 }); return; }
      go(h); return;
    }
    if (kind === 'clear'){
      const e = S.enemies.filter(q => !q.dead).sort((a, b) => D(pos, a) - D(pos, b))[0];
      if (e) go(e); return;
    }
    if (kind === 'escort' && S.vip){
      const v = S.vip;
      if (!S.units.some(u => u.alive && D(u, v) < 60)){ go(v); return; }
      if (!vipPath || S.time - vipPathT > 1){ vipPath = L.findPath(M, v.x, v.y, S.exit.x, S.exit.y, 'foot') || []; vipPathT = S.time; }
      let acc = 0, px = v.x, py = v.y, tgt = S.exit;
      for (const p of vipPath){ acc += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y; if (acc > 55){ tgt = p; break; } }
      go(tgt); return;
    }
    if (kind === 'hold' && S.zone){ if (D(pos, S.zone) > 18) go(S.zone); }
  }
  while (S.phase === 'play' && S.time < maxT){
    if (S.time >= next){ next = S.time + r0 + brng() * (r1 - r0); decide(); }
    game.update(dt);
  }
  return { won: S.phase === 'won', lost: S.phase === 'lost', reason: S.reason, time: S.time, broken: ev.broken, why: ev.why, kills: S.kills,
    hives: S.hivesKilled, throws: ev.throws, stuck: S.phase === 'play', seed, result: S.result, game };
}
