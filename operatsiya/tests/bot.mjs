/* ОПЕРАЦИЯ · tests/bot.mjs — бот-командир для проверки проходимости и баланса миссий.
   Играет только через публичный API, как игрок: moveTo / shoot / throwGear / crouch / reload / interact / useKit / endTurn.
   Видит то же, что игрок: врагов — только замеченных бригадой (S.spot[0]), последние известные позиции (S.known[0])
   и разведанные клетки (S.seen[0]); неразведанное идёт «на ощупь».
   Тактика: стреляет при шансе ≥ 35% (выбирает режим по ожидаемому урону), бросает шестерню в группу или в засевшего
   за укрытием, иначе продвигается к цели миссии по клеткам с укрытием, держит строй и оставляет ОД на реакционный огонь.
   opts: { lvl, diff='normal', maxTurns, squad } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function squadFor(O, spec, lvl = 0){
  const Camp = O.Camp;
  return Camp.ROSTER.slice(0, spec.squad).map(r => Camp.statsOf({ id: r.id, lvl, load: Object.assign({}, r.load) }));
}

export function playMission(O, spec, seed, opts = {}){
  const L = O.logic, T = L.T, MW = L.MW, MH = L.MH, C = L.COST;
  const game = O.Game({ spec, seed, diff: opts.diff || 'normal', squad: opts.squad || squadFor(O, spec, opts.lvl || 0), hotseat: !!opts.hotseat });
  const S = game.state();
  let ticks = 0, actions = 0;
  const maxTicks = 60000;
  const drain = () => { let n = 0; while (game.busy() && S.phase === 'play' && n++ < 4000){ game.tick(); ticks++; } };
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const team = () => S.side;

  function goalField(u){
    const goals = [], tm = u.team, O1 = S.obj.kind;
    const master = S.units.find(v => v.kind === 'master');
    if (u.kind === 'master') S.exits.forEach(p => goals.push(p));
    else if (O1 === 'rescue' && master && master.captive) goals.push([master.x, master.y]);
    else if (O1 === 'rescue' && master && master.alive && !Object.keys(S.known[tm]).length && S.turn > 12){ S.exits.forEach(p => goals.push(p)); }
    else if (O1 === 'hack' && S.core) goals.push(S.core);
    else if (O1 === 'hold') S.zone.forEach(p => goals.push(p));
    else if (O1 === 'evac') S.exits.forEach(p => goals.push(p));
    if (!goals.length || O1 === 'clear' || O1 === 'boss' || O1 === 'duel' || (O1 === 'rescue' && master && !master.captive && u.kind !== 'master')){
      Object.values(S.known[tm]).forEach(e => goals.push([e.x, e.y]));
      if (!goals.length) for (let k = 0; k < MW * MH; k++) if (!S.seen[tm][k] && (L.PASS[S.t[k]] || S.t[k] === T.DOOR)) goals.push([k % MW, (k / MW) | 0]);
    }
    const f = new Array(MW * MH).fill(1e9), q = [];
    goals.forEach(p => { const k = p[1] * MW + p[0]; if (f[k] > 0){ f[k] = 0; q.push(k); } });
    while (q.length){
      const k = q.shift(), x = k % MW, y = (k / MW) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
        const nk = ny * MW + nx, t = S.t[nk];
        if (!(L.PASS[t] || t === T.DOOR || t === T.CORE && f[k] === 0 || t === T.BRICK || t === T.CRATE)) continue;
        const w = (t === T.BRICK || t === T.CRATE) ? 4 : 1;
        if (f[nk] > f[k] + w){ f[nk] = f[k] + w; q.push(nk); }
      }
    }
    return f;
  }
  function visibleFoes(u){ return S.units.filter(v => v.team !== u.team && v.alive && !v.evac && !v.captive && S.spot[u.team].includes(v.id)); }
  function bestShot(u, foes){
    let best = null; const W = L.WEAPONS[u.weapon]; if (!W) return null;
    for (const tg of foes) for (const mode of ['aimed', 'burst', 'snap']){
      const I = game.shotInfo(u, tg, mode); if (!I.ok) continue;
      let ev = I.rounds * I.chance / 100 * W.dmg; if (tg.hp <= W.dmg) ev *= 1.5; if (tg.boss) ev *= 1.2;
      const sc = ev / Math.sqrt(I.cost);
      if (!best || sc > best.sc) best = { tg, mode, ch: I.chance, sc, ev };
    }
    return best;
  }
  function bestGear(u, foes){
    if (!(u.gear > 0)) return null; let best = null;
    for (const t of foes) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){
      const x = t.x + dx, y = t.y + dy, I = game.gearInfo(u, x, y); if (!I.ok || L.dist(u.x, u.y, x, y) < 2.5) continue;
      let val = 0; for (const v of S.units){ if (!v.alive || v.evac || v.captive) continue; const d = L.cheb(v.x, v.y, x, y); if (d > 1) continue; val += (v.team === u.team ? -3 : 1) * (d === 0 ? 1 : 0.7) * (v.team !== u.team && v.hp <= 4 ? 1.3 : 1); }
      val *= I.chance / 100; if (!best || val > best.val) best = { x, y, val };
    }
    return best;
  }
  function moveStep(u, foes){
    const f = goalField(u), here = u.y * MW + u.x;
    const holdHere = (S.obj.kind === 'hold' && S.t[here] === T.ZONE);
    if (holdHere) return false;
    const budget = Math.max(0, u.ap - (foes.length ? C.snap : C.snap));
    if (budget < C.ortho) return false;
    const R = game.reach(u, budget), mates = S.units.filter(v => v.team === u.team && v !== u && v.alive && !v.evac && !v.captive);
    const cx = mates.length ? mates.reduce((s, v) => s + v.x, 0) / mates.length : u.x, cy = mates.length ? mates.reduce((s, v) => s + v.y, 0) / mates.length : u.y;
    const known = Object.values(S.known[u.team]);
    let best = null;
    for (let k = 0; k < MW * MH; k++){
      if (!isFinite(R.cost[k]) || S.t[k] === T.DOOR) continue;
      const x = k % MW, y = (k / MW) | 0; if (k !== here && game.unitAt(x, y)) continue;
      let s = -f[k] * 3;
      if (u.kind !== 'master'){
        let cov = 0, exp = 0, ch = 0;
        for (const e of foes.length ? foes : known){
          if (L.dist(x, y, e.x, e.y) > L.VIS + 1 || !L.los(S.t, x, y, e.x, e.y)) continue;
          const c = game.coverOf(x, y, e.x, e.y); cov += c === 2 ? 10 : c === 1 ? 7 : 0; if (!c) exp++;
          if (foes.length) ch = Math.max(ch, game.hitChance(u, e, 'snap', { x, y }));
        }
        s += cov - exp * 6 + ch * 0.15;
        const dc = Math.hypot(x - cx, y - cy); s -= Math.max(0, dc - 4) * 2;
        if (S.obj.kind === 'hold' && S.t[k] === T.ZONE) s += 30;
        if (S.items.some(it => it.x === x && it.y === y)) s += 4;
      }
      s -= R.cost[k] * 0.05;
      if (!best || s > best.s) best = { x, y, s };
    }
    if (!best || (best.x === u.x && best.y === u.y)) return false;
    if (!game.moveTo(u, best.x, best.y)) return false;
    drain(); return true;
  }
  function unitTurn(u){
    for (let step = 0; step < 10 && S.phase === 'play' && u.alive && !u.evac && !u.captive; step++){
      actions++;
      const opts2 = game.interactOptions(u);
      const calm = !visibleFoes(u).length;
      const want = opts2.find(o => ((o.kind === 'free' && calm) || o.kind === 'evac' || (o.kind === 'hack' && !o.used) || o.kind === 'pickup') && u.ap >= o.cost);
      if (want && game.interact(u, want.kind)){ drain(); continue; }
      const W = L.WEAPONS[u.weapon];
      if (W && u.clip <= 0 && u.clips > 0 && u.ap >= C.reload){ game.reload(u); continue; }
      if (u.kit > 0 && u.hp <= u.hpMax / 2 && u.ap >= C.kit && game.useKit(u, u)) continue;
      if (u.kind === 'master' && (visibleFoes(u).length || Object.keys(S.known[u.team]).length) && S.t[u.y * MW + u.x] !== T.EXIT){ if (!u.crouch && u.ap >= C.crouch) game.crouch(u); break; }   // мастер ждёт, пока бригада не расчистит путь
      const foes = u.kind === 'master' ? [] : visibleFoes(u);
      if (foes.length && W){
        const sh = bestShot(u, foes), gr = bestGear(u, foes);
        if (gr && gr.val >= 1.1 && (!sh || sh.ev < gr.val * 4)){ if (game.throwGear(u, gr.x, gr.y).ok){ drain(); continue; } }
        if (sh && sh.ch >= 35){ game.shoot(u, sh.tg, sh.mode); drain(); continue; }
        if (gr && gr.val >= 0.6 && (!sh || sh.ch < 25)){ if (game.throwGear(u, gr.x, gr.y).ok){ drain(); continue; } }
        if (moveStep(u, foes)) continue;
        if (sh && sh.ch >= 15){ game.shoot(u, sh.tg, sh.mode); drain(); continue; }
      } else if (moveStep(u, foes)) continue;
      if (!u.crouch && u.ap >= C.crouch && u.kind !== 'master') game.crouch(u);
      break;
    }
  }
  const maxTurns = opts.maxTurns || 60;
  while (S.phase === 'play' && ticks < maxTicks && S.turn <= maxTurns){
    if (game.busy()){ game.tick(); ticks++; continue; }
    if (S.side === 0 || S.hotseat){
      const tm = team();
      const order = S.units.filter(u => u.team === tm && u.alive && !u.evac && !u.captive).sort((a, b) => (a.kind === 'master') - (b.kind === 'master'));
      for (const u of order){ if (S.phase !== 'play') break; unitTurn(u); }
      if (S.phase !== 'play') break;
      if (!game.endTurn()) { drain(); game.endTurn(); }
    }
  }
  return { won: S.phase === 'won', reason: S.reason, turn: S.turn, kills: S.kills, score: S.score, ticks, actions, phase: S.phase, winner: S.winner,
    alive: S.units.filter(u => u.team === 0 && u.kind === 'mech' && u.alive).length, result: S.result, S };
}
