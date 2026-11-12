/* ТАЙНИК · tests/bot.mjs — бот для проверки проходимости и баланса.
   Опирается на граф макро-ходов уровня (lv.plan, строится генератором) и поле расстояний
   до выхода (logic.distToExit). Управляет только тем, что есть у игрока: game.setInput({l,r,u,d})
   и game.fire(); макро-ход исполняется покадрово, как нажатия клавиш.
   «Человеческий» бот (по умолчанию):
   - реакция 150–250 мс: пауза перед сменой действия (шаги в одну сторону — без пауз, как удержание клавиши);
   - рука ошибается: перед прыжком (с пола или с верёвки) положение сбито на ε ~ N(0, σ) px;
   - видит капли и пауков (функции времени) и чаще всего пережидает их, но не всегда (aware);
   - стреляет в обитателей на линии огня, если есть заряды;
   - на каждом устойчивом положении выбирает ход «стоимость + расстояние до выхода» (поле считается по графу).
   opts: { levels=6, startLevel=1, sigma=4, aware=0.85, perfect=false, maxMinutes=40 }
   perfect: без ошибок, без пауз, видит всё — проверка, что уровень проходим самой игрой. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function gauss(r){ let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const EDGE = { JU: 1, JL: 1, JR: 1, D: 1, RL: 1, RR: 1, DROP: 1 };
const FIRST = { JU: { u: 1 }, JL: { l: 1, u: 1 }, JR: { r: 1, u: 1 }, D: { d: 1 }, RL: { l: 1 }, RR: { r: 1 }, DROP: { d: 1 } };

// Опасность от пауков и капель на пути макро-хода (они — функции времени)
function predictHit(K, S, act){
  const L = K.logic, lv = S.lv, h = L.cloneHero(S.hero); h.pu = h.pl = h.pr = h.pd = false;
  const haz = S.enemies.filter(e => e.alive && (e.type === 'spider' || e.type === 'drop') && Math.abs(e.x - h.x) < 120 && Math.abs(e.top - h.y) < 200);
  if (!haz.length) return false;
  const x0 = h.x, y0 = h.y; let t = S.time;
  for (let f = 0; f < 90; f++){
    let inp = {};
    if (f === 0 && FIRST[act]) inp = FIRST[act];
    else if ((act === 'L' || act === 'R') && h.mode === 'ground' && Math.abs(h.x - x0) < 10) inp = act === 'L' ? { l: 1 } : { r: 1 };
    else if (act === 'CU' && h.mode === 'rope' && y0 - h.y < 10) inp = { u: 1 };
    else if (act === 'CD' && h.mode === 'rope' && h.y - y0 < 10) inp = { d: 1 };
    else if (f > 0 && h.mode !== 'air') break;
    const ev = L.stepHero(lv, h, inp, L.DT); t += L.DT;
    if (ev === 'acid' || ev === 'exit') break;
    const hb = L.heroBox(h);
    for (const e of haz){
      const b = e.type === 'spider' ? { x: e.x, y: L.spiderY(e, t), w: 8, h: 7 } : L.enemyBox(e, t);
      if (L.hit(hb, b)) return true;
    }
  }
  return false;
}

export function playTaynik(K, seed, opts = {}){
  const L = K.logic, perfect = !!opts.perfect;
  const sigma = opts.sigma == null ? 4 : opts.sigma, rob = perfect ? 0 : (opts.robust == null ? 0 : opts.robust), aware = perfect ? 1 : (opts.aware == null ? 0.85 : opts.aware);
  const hr = mulberry32(seed * 7919 + 13);
  let cleared = 0, deaths = 0, dmgTaken = 0; const reasons = {}, hurts = {};
  const game = K.Game({ rng: mulberry32(seed), lives: opts.lives || 3, level: opts.startLevel || 1,
    maxLevel: (opts.startLevel || 1) - 1 + (opts.levels || 6),
    onEvent: (t, d) => { if (t === 'clear') cleared++; if (t === 'die'){ deaths++; reasons[d.reason] = (reasons[d.reason] || 0) + 1; } if (t === 'hurt'){ dmgTaken += d.n; hurts[d.src] = (hurts[d.src] || 0) + d.n; } } }).start();
  const S = game._S;
  const maxFrames = (opts.maxMinutes || 40) * 3600;
  let visits = new Map(), lvRef = null, dist = null, mac = null, wait = 0, pre = [], lastAct = null, best = Infinity, bestAt = 0, stuck = false, frames = 0;

  // расстояние до выхода с допуском: ключи графа квантованы, фактическое положение может быть рядом
  function near(hh){
    const k = L.heroKey(hh), d0 = dist.get(k); if (d0 != null) return d0;
    let bestD = null;
    const m = k.match(/^([gr])(-?\d+),(-?[\d.]+)$/), a = +m[2], b = +m[3];
    for (let o = 1; o <= 2; o++) for (const s of [-o, o]){
      const kk = m[1] === 'g' ? 'g' + (a + s) + ',' + b : 'r' + a + ',' + (b + s);
      const d = dist.get(kk); if (d != null && (bestD == null || d + 12 * o < bestD)) bestD = d + 12 * o;
    }
    return bestD;
  }
  function decide(){
    const h = S.hero;
    const hk = L.heroKey(h); visits.set(hk, (visits.get(hk) || 0) + 1);
    // стрельба: обитатель на линии огня
    if (S.ammo > 0 && S.fireCd <= 0){
      let tgt = null, td = 1e9;
      for (const e of S.enemies){
        const b = L.enemyBox(e, S.time); if (!b || e.type === 'drop') continue;
        const dx = b.x - h.x, dy = b.y - (h.y - 11);
        if (Math.abs(dy) > b.h + 2 || Math.abs(dx) > 170 || Math.abs(dx) < 4) continue;
        let clear = true; for (let x = h.x; Math.abs(x - h.x) < Math.abs(dx); x += Math.sign(dx) * 10) if (L.tileAt(S.lv, Math.floor(x / L.T), Math.floor((h.y - 11) / L.T))) { clear = false; break; }
        if (clear && Math.abs(dx) < td){ td = Math.abs(dx); tgt = Math.sign(dx); }
      }
      if (tgt){
        if (tgt === h.face){ game.fire(); wait = perfect ? 2 : 6 + Math.floor(hr() * 6); return; }
        if (h.mode === 'ground'){ pre.push(tgt < 0 ? { l: 1 } : { r: 1 }, {}); return; }
      }
    }
    // выбор хода: стоимость + расстояние до выхода
    let bestA = null, bestS = Infinity;
    for (const act of L.macrosFor(h)){
      const r = L.runMacro(S.lv, h, act);
      if (r.res === 'acid' || r.res === 'stuck') continue;
      let s;
      if (r.res === 'exit') s = r.f;
      else { const k = L.heroKey(r.h); if (k === L.heroKey(h)) continue; const d = near(r.h); if (d == null) continue; s = r.f + 6 + r.dmg * 12 + d + 25 * (visits.get(k) || 0); }
      // человек выбирает прыжки «с запасом»: если сдвиг на ±rob px губит прыжок — штраф
      if (rob && (act === 'JL' || act === 'JR' || act === 'RL' || act === 'RR')){
        for (const o of [-rob, rob]){
          const hh = L.cloneHero(h);
          if (h.mode === 'ground') hh.x += o; else hh.y = Math.max(L.ropeMinY(S.lv.ropes[h.rope]), Math.min(L.ropeMaxY(S.lv.ropes[h.rope]), hh.y + o));
          if (h.mode === 'ground' && (L.overlapSolid(S.lv, hh.x, hh.y) || !L.supported(S.lv, hh.x, hh.y))) continue;
          const rr = L.runMacro(S.lv, hh, act); if (rr.res === 'acid') s += 400;
        }
      }
      if (s < bestS){ bestS = s; bestA = act; }
    }
    const cur = near(h); if (cur != null && cur < best - 1){ best = cur; bestAt = frames; }
    if (!bestA){ bestA = L.macrosFor(h)[Math.floor(hr() * 2)]; }
    // увидел паука/каплю на пути — переждать
    if (hr() < aware && predictHit(K, S, bestA)){ wait = 6; return; }
    // реакция — при смене действия
    if (!perfect && (bestA !== lastAct || EDGE[bestA])) wait = 9 + Math.floor(hr() * 7);
    // ошибка руки перед прыжком: сдвиг положения
    if (!perfect && sigma > 0 && (bestA === 'JL' || bestA === 'JR' || bestA === 'RL' || bestA === 'RR')){
      const eps = gauss(hr) * sigma;
      if (h.mode === 'ground'){
        // смещение шагами, но не за край и не в кислоту (это видно глазом)
        const n = Math.round(Math.abs(eps) / (L.WALK * L.DT)), dir = (bestA === 'JR') === (eps > 0) ? { r: 1 } : { l: 1 };
        const hh = L.cloneHero(h); hh.pu = hh.pl = hh.pr = hh.pd = false;
        for (let i = 0; i < n; i++){
          const t = L.cloneHero(hh); L.stepHero(S.lv, t, dir, L.DT);
          if (t.mode !== 'ground' || L.acidUnder(S.lv, t.x, t.y) || !L.supported(S.lv, t.x + (dir.r ? 4 : -4), t.y)) break;
          L.stepHero(S.lv, hh, dir, L.DT); pre.push(dir);
        }
      } else {
        const n = Math.round(Math.abs(eps) / (L.CLIMB * L.DT));
        for (let i = 0; i < n; i++) pre.push(eps > 0 ? { d: 1 } : { u: 1 });
      }
    }
    if (EDGE[bestA]) pre.push({});
    lastAct = bestA;
    mac = { act: bestA, f: 0, x0: 0, y0: 0, started: false };
  }
  function macroInput(){
    const h = S.hero, a = mac.act;
    if (!mac.started){ mac.started = true; mac.x0 = h.x; mac.y0 = h.y; mac.f = 0; }
    mac.f++;
    if (mac.f === 1 && FIRST[a]) return FIRST[a];
    if (mac.f > 1 && FIRST[a]) return null;
    if (a === 'L' || a === 'R'){ if (h.mode !== 'ground' || Math.abs(h.x - mac.x0) >= 10 || mac.f > 24) return null; return a === 'L' ? { l: 1 } : { r: 1 }; }
    if (a === 'CU'){ if (h.mode !== 'rope' || mac.y0 - h.y >= 10 || mac.f > 24) return null; return { u: 1 }; }
    if (a === 'CD'){ if (h.mode !== 'rope' || h.y - mac.y0 >= 10 || mac.f > 24) return null; return { d: 1 }; }
    return null;
  }

  while (!S.over && !S.won && frames < maxFrames){
    if (S.lv !== lvRef){ lvRef = S.lv; dist = L.distToExit(S.lv.plan); visits = new Map(); best = Infinity; bestAt = frames; mac = null; pre = []; }
    if (S.phase === 'play'){
      let inp = {};
      if (pre.length) inp = pre.shift();
      else if (mac){ const m = macroInput(); if (m) inp = m; else if (S.hero.mode !== 'air') mac = null; }
      else if (wait > 0) wait--;
      else if (S.hero.mode !== 'air') decide();
      game.setInput(inp);
    } else { game.setInput({}); mac = null; pre = []; wait = 0; }
    game.step(); frames++;
    if (frames - bestAt > 3600 * 5){ stuck = true; break; }   // 5 минут без продвижения
  }
  return { passed: cleared, won: S.won, over: S.over, stuck, score: S.score, frames, deaths, dmg: dmgTaken, reasons, hurts, level: S.level };
}
