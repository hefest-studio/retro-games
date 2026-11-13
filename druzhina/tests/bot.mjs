/* ДРУЖИНА · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: управляет только как игрок — setDir(pi, dx, dy), attack(pi), jump(pi), magic(pi), special(pi).
   - решения раз в 150–250 мс (реакция), между решениями держит прежние клавиши;
   - видит только кадр камеры; замах врага замечает не всегда: при каждом «взгляде» пропускает его
     с вероятностью opts.miss (по умолчанию 0.4); волну по земле и лужи — один бросок на объект;
   - бьёт комбо (жмёт удар на каждом решении), иногда бьёт в прыжке, «спину» — когда зажали с двух сторон;
   - магию тратит, когда врагов много или пришёл босс; гоняется за бесами и подбирает кувшины/еду;
   - ничейного зверя седлает, если тот рядом.
   opts: { stage=1, stages, players=1, heroes, miss=0.4, react:[0.15,0.25], maxStageT=420, continues=0 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playDruzhina(D, seed, opts = {}){
  const L = D.logic, start = opts.stage || 1;
  const stages = opts.stages || (L.STAGES.length - start + 1);
  const players = opts.players || 1;
  const brng = mulberry32(seed * 7919 + 17);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.4;
  const maxT = opts.maxStageT || 420;
  const heroes = opts.heroes || (players === 2 ? [L.HERO_KEYS[seed % 3], L.HERO_KEYS[(seed + 1) % 3]] : [L.HERO_KEYS[seed % 3]]);
  const events = [];
  let S = null;
  const game = D.Game({ rng: mulberry32(seed), players, heroes, stage: start, maxStage: start + stages - 1, continues: opts.continues || 0,
    onEvent: (t, d) => { if (t === 'clear' || t === 'heroDie' || t === 'win' || t === 'gameover' || t === 'magic' || t === 'mount' || t === 'grab' || t === 'back') events.push([t, d, S ? S.stage : start]); } }).start();
  S = game.state();
  const dt = 1 / 60;
  const ctl = S.heroes.map(() => ({ seen: new WeakMap(), next: 0, dx: 0, dy: 0, hold: 0, lastX: 0, stuckT: 0 }));
  let t = 0, tStage = 0, curKey = S.stage + ':' + S.phase, stuck = false;

  const inView = o => o.x > S.cam - 20 && o.x < S.cam + L.VIEW_W + 20;
  const notice = (C, o, p) => { if (!C.seen.has(o)) C.seen.set(o, brng() > (p == null ? miss : p)); return C.seen.get(o); };

  function decide(pi){
    const H = S.heroes[pi], C = ctl[pi], def = H.def;
    C.dx = 0; C.dy = 0;
    if (H.out || !H.alive || H.state === 'dead') return;
    if (S.phase !== 'play' && S.phase !== 'bonus') return;
    const foes = S.foes.filter(f => f.alive && !f.dying && f.kind !== 'imp' && inView(f) && !(f.kind === 'boss' && f.intro > 0));
    const imps = S.foes.filter(f => f.alive && f.kind === 'imp' && inView(f) && f.bags > 0);
    const near = foes.map(f => ({ f, d: Math.abs(f.x - H.x) + Math.abs(f.z - H.z) * 2 })).sort((a, b) => a.d - b.d);
    let dx = 0, dy = 0, att = false, jmp = false, mag = false, spc = false, dodging = false;
    const boss = foes.find(f => f.kind === 'boss');

    // --- угрозы: замахи врагов (заметил — уйти по глубине и назад) ---
    for (const f of foes){
      const wind = (f.state === 'atk' && f.phase === 'w') || f.state === 'leapWind' || (f.state === 'mountAtk' && (f.phase === 'w' || f.phase === 'a' && f.mm && f.mm.breath)) || (f.kind === 'boss' && f.state === 'atk' && f.phase !== 'r');
      if (!wind) { C.seen.delete(f); continue; }
      const reach = f.kind === 'boss' ? (f.move === 'charge' ? 900 : f.move === 'breath' ? 230 : f.move === 'slam' || f.move === 'pour' || f.move === 'summon' ? 0 : f.def.reach + 60)
        : f.mount ? f.mount.def.reach + 20 : f.state === 'leapWind' ? 220 : f.def.reach + 24;
      const fx = (H.x - f.x) * (f.kind === 'boss' && f.move === 'sweep' ? Math.sign(H.x - f.x) || 1 : f.face);
      if (fx < -30 || fx > reach || Math.abs(H.z - f.z) > 34) continue;
      if (!notice(C, f)) continue;
      dodging = true;
      dy = H.z > f.z ? 1 : -1; if (H.z < 25) dy = 1; if (H.z > L.DEPTH - 25) dy = -1;
      dx = Math.sign(H.x - f.x) || 1;
      if (f.kind === 'boss' && f.move === 'charge') dx = 0;
    }
    for (const w of S.waves){ const rx = (H.x - w.x) * w.dir; if (rx > -10 && rx < 150 && Math.abs(H.z - w.z) < 34 && notice(C, w, miss * 0.8)) { jmp = true; dodging = true; } }
    for (const p of S.puddles){ if (Math.abs(H.x - p.x) < p.r + 16 && Math.abs(H.z - p.z) < p.r * 0.5 + 10 && notice(C, p, miss * 0.6)) { dodging = true; dy = H.z > p.z ? 1 : -1; if (H.z < 20) dy = 1; if (H.z > L.DEPTH - 20) dy = -1; dx = Math.sign(H.x - p.x) || 1; } }

    // --- магия ---
    const lvl = game.magicLevel(H);
    const crowd = foes.filter(f => Math.abs(f.x - H.x) < 400).length;
    if (lvl && !H.mount && ((lvl >= 2 && crowd >= 3) || (boss && lvl >= 2 && boss.hp > boss.max * 0.25) || (H.hp < H.max * 0.3 && near.length && near[0].d < 90) || lvl >= 4 && crowd >= 2)) mag = brng() < 0.7;

    if (!dodging){
      const food = S.items.find(f => f.kind !== 'jug' && inView(f));
      const jug = S.items.find(f => f.kind === 'jug' && inView(f) && H.jugs < L.JUG_MAX);
      const mount = !H.mount && S.mounts.find(m => !m.rider && m.state === 'idle' && inView(m) && Math.abs(m.x - H.x) < 260);
      const closeFoe = near.length && near[0].d < 90;
      let goal = null;
      if (food && (H.hp < H.max * 0.55 || S.bonus) && !closeFoe) goal = { x: food.x, z: food.z, walk: 1 };
      else if (jug && (!closeFoe || S.bonus)) goal = { x: jug.x, z: jug.z, walk: 1 };
      else if (imps.length && (!closeFoe || S.bonus)) goal = { foe: imps[0] };
      else if (mount && !closeFoe && !boss) goal = { x: mount.x, z: mount.z, walk: 1 };
      else if (near.length) goal = { foe: near[0].f };
      if (goal && goal.walk){
        dx = Math.abs(goal.x - H.x) > 8 ? Math.sign(goal.x - H.x) : 0; dy = Math.abs(goal.z - H.z) > 6 ? Math.sign(goal.z - H.z) : 0;
      } else if (goal && goal.foe){
        const f = goal.foe, side = Math.sign(H.x - f.x) || -1;
        const reach = H.mount ? H.mount.def.reach * (H.mount.def.breath ? 0.6 : 0.7) : def.reach * 0.75;
        let want = f.x + side * (reach + (f.w || 16) * 0.5 + 6);
        const ranged = def.ranged && !H.mount && f.kind !== 'imp';
        if (ranged && Math.abs(f.x - H.x) > 90) want = f.x + side * Math.min(Math.abs(f.x - H.x), 240);
        if (f.kind === 'boss' && f.state === 'atk' && f.phase === 'r') want = f.x + side * (reach + 20);
        const adz = Math.abs(f.z - H.z), adx = Math.abs(want - H.x);
        dy = adz > 6 ? Math.sign(f.z - H.z) : 0;
        dx = adx > 8 ? Math.sign(want - H.x) : 0;
        const facing = Math.sign(f.x - H.x) === H.face || Math.abs(f.x - H.x) < 4;
        const inRange = Math.abs(f.x - H.x) < (ranged ? def.range - 30 : reach + (f.w || 16) + 14) && adz < (ranged ? 20 : 13);
        if (inRange && !facing) dx = Math.sign(f.x - H.x);
        if (inRange && facing && dx === 0 || inRange && facing && brng() < 0.5) att = true;
        if (inRange && facing && adz < 10 && !H.mount && (f.type === 'raider' || f.type === 'spear') && brng() < 0.12) { jmp = true; att = false; C.airAtk = t + 0.14; }
        // в захвате: колено, колено, бросок
        if (H.state === 'grab') { att = true; dx = 0; dy = 0; }
      } else if (S.phase === 'play') {
        dx = 1; dy = H.z < L.DEPTH * 0.4 ? 1 : H.z > L.DEPTH * 0.6 ? -1 : 0;
      }
      // зажали с двух сторон — «спина»
      const L1 = foes.some(f => f.x < H.x && H.x - f.x < 60 && Math.abs(f.z - H.z) < 16), R1 = foes.some(f => f.x > H.x && f.x - H.x < 60 && Math.abs(f.z - H.z) < 16);
      if (L1 && R1 && H.hp > H.max * 0.3 && brng() < 0.5 && !H.mount) { spc = true; att = false; }
    }
    // застревание (нет прогресса при открытой камере)
    if (!foes.length && !imps.length && S.phase === 'play'){ if (H.x > C.lastX + 5){ C.lastX = H.x; C.stuckT = 0; } else C.stuckT += (r0 + r1) / 2; if (C.stuckT > 3) { dy = brng() < 0.5 ? 1 : -1; dx = 1; } }
    else C.stuckT = 0;
    C.dx = dx; C.dy = dy;
    game.setDir(pi, dx, dy);
    if (mag) game.magic(pi);
    else if (spc) game.special(pi);
    else if (jmp) game.jump(pi);
    if (att) game.attack(pi);
  }

  while (!S.over && !S.won){
    for (let pi = 0; pi < S.heroes.length; pi++){
      const C = ctl[pi];
      if (t >= C.next){ decide(pi); C.next = t + r0 + brng() * (r1 - r0); }
      if (C.airAtk && t >= C.airAtk){ C.airAtk = 0; game.attack(pi); }
      game.setDir(pi, C.dx, C.dy);
    }
    game.update(dt); t += dt; tStage += dt;
    const k = S.stage + ':' + (S.bonus ? 'b' : 'p');
    if (k !== curKey){ curKey = k; tStage = 0; ctl.forEach(C => { C.lastX = 0; C.stuckT = 0; }); }
    if (S.phase === 'continue' && opts.continues) game.continue_();
    if (tStage > maxT){ stuck = true; break; }
  }
  const deaths = {};
  events.filter(e => e[0] === 'heroDie').forEach(e => { const k = e[2] + ':' + e[1].src; deaths[k] = (deaths[k] || 0) + 1; });
  const cleared = events.filter(e => e[0] === 'clear').length;
  const count = n => events.filter(e => e[0] === n).length;
  return { won: S.won, cleared, stage: S.stage, score: S.score, stuck, deaths, time: t, heroes, magic: count('magic'), mounts: count('mount'), grabs: count('grab'), backs: count('back') };
}
