/* ГРОМ · tests/bot.mjs — «человеческий» бот для проверки проходимости и баланса.
   Карту уровня знает (как игрок, открывший мини-карту), но управляет только как человек: setInput({dx,dy,jump,fire,beam}),
   wheel/setForm, thunder, cont — и те же макросы движения, по которым строится граф проходимости (logic.ACTS).
   Человеческие ограничения:
   - реакция: каждое решение — через 150–250 мс (opts.react); между решениями держит прежние клавиши;
   - врагов замечает не всех (opts.miss — доля незамеченных при первом взгляде), видит только кадр камеры;
   - небрежность: иногда отпускает прыжок раньше (opts.slop) — недопрыгнул, перестраивает путь;
   - от пуль босса уворачивается прыжком не всегда (opts.dodge — вероятность заметить угрозу).
   opts: { react:[0.15,0.25], miss=0.25, slop=0.06, dodge=0.55, dmgMul, levels (сколько уровней играть), startLevel=1, maxT=900 (на уровень) } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const NAV = new Map();
// граф и поля расстояний уровня (общие для всех партий)
export function navFor(GR, n){
  if (NAV.has(n)) return NAV.get(n);
  const L = GR.logic, lv = L.level(n), nav = L.Nav(lv, {}), W = lv.W;
  const start = nav.nodeAt(lv.start.x, lv.start.y), br = lv.rooms[lv.bossRoom];
  const reach = nav.reach(start), arena = [];
  reach.forEach(id => { const c = id % W, r = Math.floor(id / W); if (c > br.x0 + 3 && c < br.x0 + L.RW - 2 && r > br.y0 + 3 && r <= br.y0 + L.RH) arena.push(id); });
  const toArena = nav.field(start, arena);
  const portal = nav.nodeAt(lv.portal.x, lv.portal.y);
  const navG = L.Nav(lv, { gates: true });   // после начала боя ворота арены закрыты
  const o = { lv, nav, navG, start, arena, toArena, portal, toPortal: null };
  NAV.set(n, o); return o;
}

export function playGrom(GR, seed, opts = {}){
  const L = GR.logic, brng = mulberry32(seed * 7919 + 31);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const missP = opts.miss == null ? 0.25 : opts.miss, slop = opts.slop == null ? 0.06 : opts.slop, dodgeP = opts.dodge == null ? 0.55 : opts.dodge;
  const startLevel = opts.startLevel || 1, maxLevel = Math.min(L.LEVELS.length, startLevel + (opts.levels || L.LEVELS.length) - 1);
  const maxT = opts.maxT || 900;
  const res = { seed, cleared: 0, won: false, over: false, deaths: 0, conts: 0, why: {}, levelT: [], dl: {}, db: {}, stuck: false, stuckAt: null, score: 0, secrets: 0 };
  const game = GR.Game({ rng: mulberry32(seed), level: startLevel, maxLevel, dmgMul: opts.dmgMul, onEvent: (t, d) => {
    if (t === 'die'){ res.deaths++; res.why[d.why] = (res.why[d.why] || 0) + 1; res.dl[S.level] = (res.dl[S.level] || 0) + 1; if (S.bossActive) res.db[S.level] = (res.db[S.level] || 0) + 1; }
    if (t === 'clear'){ res.cleared++; res.levelT.push(+(S.time - lvT0).toFixed(1)); }
    if (t === 'continue'){ res.conts++; lvT0 = S.time; }
    if (t === 'respawn'){ best = Infinity; bestT = S.time; macro = null; engage = null; }
  } }).start();
  const S = game.state(), dt = 1 / 60;
  let lvT0 = 0, curLevel = S.level;
  const seen = new WeakMap();
  const noticed = e => { if (!seen.has(e)) seen.set(e, brng() >= missP); return seen.get(e); };
  const react = () => r0 + brng() * (r1 - r0);
  let wait = react(), macro = null, held = { dx: 0, dy: 0, jump: false, fire: false, beam: false }, engage = null, engageT = 0;
  let best = Infinity, bestT = 0, slopF = -1;
  const q8 = (dx, dy) => { const a = Math.atan2(dy, dx), o = Math.round(a / (Math.PI / 4)), ang = o * Math.PI / 4; return { x: Math.round(Math.cos(ang)), y: Math.round(Math.sin(ang)) }; };
  // попадёт ли луч, направленный одним из 8 направлений, в цель (как видит игрок: «на одной линии»)
  const beamHits = (H, e) => { const ox = H.x, oy = H.y - 1.05, tx = e.x - ox, ty = (e.y - e.hh / 2) - oy, d = q8(tx, ty), n = Math.hypot(d.x, d.y), ux = d.x / n, uy = d.y / n, along = tx * ux + ty * uy, perp = Math.abs(tx * uy - ty * ux);
    return along > 0 && along < L.BEAM_LEN - 0.3 && perp < Math.max(e.hw, e.hh / 2) + 0.25 ? d : null; };
  const inView = (x, y) => x > S.cam.x - 0.5 && x < S.cam.x + L.VIEW_W + 0.5 && y > S.cam.y - 0.5 && y < S.cam.y + L.VIEW_H + 0.5;

  function fieldNow(){
    const N = navFor(GR, S.level);
    if (S.bossActive || S.bossDone){ if (!N.toPortal) N.toPortal = N.navG.field(N.arena[0], [N.portal]); return N.toPortal; }
    return N.toArena;
  }
  function threats(){
    const H = S.hero, hc = H.y - 1;
    return S.enemies.filter(e => !e.dead && inView(e.x, e.y) && noticed(e)).map(e => ({ e, dx: e.x - H.x, dy: (e.y - e.hh / 2) - hc, d: Math.hypot(e.x - H.x, (e.y - e.hh / 2) - hc) })).sort((a, b) => a.d - b.d);
  }
  // бой с боссом: держать дистанцию, целиться 8 направлениями, прыгать от волн/жернова/пуль, молния при низком здоровье
  function bossFight(){
    const H = S.hero, b = S.boss, o = { dx: 0, dy: 0, jump: false, fire: true, beam: false };
    if (!b || b.dead){ return o; }
    const floor = b.y0 + L.RH, hc = H.y - 1;
    if (H.form === 'wheel') game.setForm('man');
    let want = b.x + (H.x < b.x ? -7 : 7);
    if (b.key === 'kite' || b.key === 'horn') want = b.x + (H.x < b.x ? -1.2 : 1.2);   // под целью: огонь вверх попадает
    want = Math.max(b.x0 + 3, Math.min(b.x0 + L.RW - 3, want));
    if (b.key === 'millstone' && b.mode === 'roll' && Math.sign(b.x - H.x) === -b.dir && Math.abs(b.x - H.x) < 5 && H.ground) o.jump = brng() < dodgeP + 0.3;
    if (Math.abs(want - H.x) > 0.8) o.dx = want > H.x ? 1 : -1;
    // волны и метки молний
    S.waves.forEach(w => { if (Math.sign(H.x - w.x) === w.dir && Math.abs(H.x - w.x) < 2.6 && H.ground && brng() < dodgeP + 0.25) o.jump = true; });
    let flee = 0;
    S.marks.forEach(m => { if (Math.abs(H.x - m.x) < 1.4 && m.t < m.warn && brng() < dodgeP + 0.3) flee = H.x < m.x ? -1 : 1; });
    // пули
    for (const e of S.eb){
      const ex = H.x - e.x, ey = hc - e.y, v2 = e.vx * e.vx + e.vy * e.vy || 1, tt = (ex * e.vx + ey * e.vy) / v2;
      if (tt > 0 && tt < 0.45){ const px = e.x + e.vx * tt - H.x, py = e.y + e.vy * tt - hc; if (Math.abs(px) < 0.8 && Math.abs(py) < 1.3 && brng() < dodgeP){ if (H.ground && py > -0.3) o.jump = true; else o.dx = px > 0 ? -1 : 1; break; } }
    }
    const a = q8(b.x - H.x, b.y - hc);
    const dist = Math.hypot(b.x - H.x, b.y - hc);
    if (dist < 6 && !o.jump && H.ground && b.key !== 'millstone' && brng() < 0.5){ o.beam = true; o.dx = a.x; o.dy = a.y; o.fire = false; }
    else if (a.y < 0){ o.dy = -1; if (a.x !== 0 && !o.dx) o.dx = a.x; }
    if (flee){ o.dx = flee; o.beam = false; o.fire = true; }
    if (H.hp <= 4 && S.thunder > 0 && brng() < 0.4) game.thunder();
    return o;
  }

  for (let step = 0; ; step++){
    if (S.phase === 'won'){ res.won = true; break; }
    if (S.phase === 'over'){ res.over = true; break; }
    if (S.level !== curLevel){ curLevel = S.level; lvT0 = S.time; best = Infinity; bestT = S.time; macro = null; engage = null; }
    if (S.time - lvT0 > maxT){ res.stuck = true; res.stuckAt = 'L' + S.level + ' timeout'; break; }
    const H = S.hero;
    if (S.phase === 'cont'){ wait -= dt; if (wait <= 0){ game.cont(); wait = react(); } game.update(dt); continue; }
    if (S.phase !== 'play'){ game.setInput({}); game.update(dt); macro = null; engage = null; wait = react(); continue; }
    wait -= dt;
    // --- бой с боссом ---
    if (S.bossActive && S.boss && !S.boss.dead){
      bestT = S.time;
      if (wait <= 0){ held = bossFight(); wait = react(); }
      game.setInput(held); game.update(dt); continue;
    }
    // --- исполнение макроса ---
    if (macro){
      const o = macro.input(H);
      if (slopF >= 0 && macro.f >= slopF) o.jump = false;
      if (o.form) game.setForm(o.form);
      const th = wait <= 0 ? threats() : null;
      if (th){ wait = react(); held.fire = th.some(t => t.d < 14 && Math.abs(t.dy) < 1.3 && Math.sign(t.dx) === H.face); }
      game.setInput({ dx: o.dx, dy: 0, jump: o.jump, fire: held.fire && H.form === 'man' || (H.form === 'wheel' && th && th.some(t => t.d < 2.5)), beam: false });
      game.update(dt); macro.after(S.hero);
      if (macro.done || macro.fail || S.phase !== 'play'){ macro = null; slopF = -1; wait = react(); }
      continue;
    }
    // --- удержание луча-кнута по цели ---
    if (engage){
      engageT -= dt;
      if (engage.e.dead || engageT <= 0 || S.phase !== 'play'){ engage = null; wait = react(); game.setInput({}); game.update(dt); continue; }
      if (wait <= 0){ const d = beamHits(H, engage.e); if (!d){ engage = null; continue; } held = { dx: d.x, dy: d.y, jump: false, fire: false, beam: true }; wait = react(); }
      game.setInput(held); game.update(dt); continue;
    }
    if (wait > 0){ game.setInput({ dx: 0, dy: 0, jump: false, fire: held.fire, beam: false }); game.update(dt); continue; }
    // --- решение ---
    wait = react();
    if (H.form === 'wheel'){ game.setForm('man'); }
    if (!H.ground){ game.setInput({}); game.update(dt); continue; }
    const th = threats();
    if (H.hp <= 3 && S.thunder > 0 && th.filter(t => t.d < 9).length >= 2){ game.thunder(); }
    const near = th.find(t => t.d < 7 && beamHits(H, t.e) && L.los(S, H.x, H.y - 1.05, t.e.x, t.e.y - t.e.hh / 2));
    if (near){ const d = beamHits(H, near.e); engage = near; engageT = 1.6; held = { dx: d.x, dy: d.y, jump: false, fire: false, beam: true }; game.setInput(held); game.update(dt); continue; }
    held.fire = th.some(t => t.d < 14 && Math.abs(t.dy) < 1.3);
    const F = fieldNow(), id = L.nodeOf(S, H);
    if (id < 0 || !F.has(id)){
      // не на узле графа (например, разбили бонус-блок и стоим на его месте): подойти к ближайшему узлу
      const r = Math.round(H.y), c = Math.floor(H.x); let tgt = null;
      for (let k = 1; k <= 3 && tgt == null; k++) for (const s of [1, -1]) if (F.has(r * S.W + c + s * k)){ tgt = c + s * k; break; }
      game.setInput({ dx: tgt == null ? (brng() < 0.5 ? 1 : -1) : Math.sign(tgt + 0.5 - H.x), dy: 0, jump: tgt == null && brng() < 0.3, fire: held.fire }); for (let i = 0; i < 6; i++) game.update(dt);
      continue;
    }
    const dHere = F.has(id) ? F.get(id) : Infinity;
    if (dHere < best - 0.5){ best = dHere; bestT = S.time; }
    if (S.time - bestT > 60){ res.stuck = true; res.stuckAt = 'L' + S.level + ' node ' + (id % S.W) + ',' + Math.floor(id / S.W); break; }
    // центрирование в клетке (подшаги по кадру, как короткие нажатия)
    const cx = (id % S.W) + 0.5;
    if (Math.abs(H.x - cx) > 0.06){ game.setInput({ dx: H.x < cx ? 1 : -1, fire: held.fire }); game.update(dt); wait = 0; continue; }
    const N = navFor(GR, S.level), es = (S.bossActive || S.bossDone ? N.navG : N.nav).edges(id);
    let pick = null, pv = Infinity;
    for (const e of es){ if (!F.has(e.to)) continue; const v = e.t + F.get(e.to); if (v < pv){ pv = v; pick = e; } }
    if (!pick){ game.setInput({ dx: brng() < 0.5 ? 1 : -1 }); for (let i = 0; i < 8; i++) game.update(dt); continue; }
    if (L.ACTS[pick.a].k === 'roll' && H.charge < 2.6){ game.setInput({ fire: held.fire }); game.update(dt); wait = 0.3; continue; }
    macro = new L.Macro(pick.a, id % S.W);
    slopF = (L.ACTS[pick.a].k !== 'walk' && brng() < slop) ? 6 + Math.floor(brng() * 10) : -1;
  }
  res.score = S.score; res.secrets = S.secrets; res.level = S.level; res.time = +S.time.toFixed(1);
  return res;
}
