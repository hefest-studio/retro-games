/* КАЛЁНЫЙ ДВОР · «человеческий» бот для баланса и сквозной проверки (Node). Играет героем (игрок 1, средний подмастерье) только через
   публичный ввод: setInput (стик, ● бросок) и pressB (ловля). Человечность: решения раз в 0,18 с (реакция), думает 0,5–1,3 с перед броском,
   накал — в 30 % бросков (держит 0,6–1,0 с), ловит угрожающий шар с шансом 55 % и ошибкой времени σ ≈ 0,1 с, в 30 % уходит в сторону. */
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const HUMAN = { react: 0.18, catchP: 0.55, timeErr: 0.1, dodgeP: 0.3, thinkMin: 0.5, thinkMax: 1.3, chargeP: 0.3 };

export function playMatch(K, level, seed, o = {}) {
  const P = Object.assign({}, HUMAN, o.bot || {}), br = mulberry32(seed * 7919 + 11), dt = 1 / 30, L = K.logic;
  const ev = { catches: 0, perfect: 0, hits: 0, burns: 0 };
  const game = K.Game({ rng: mulberry32(seed), level, humans: o.aiOnly ? [] : [1], arena: o.arena, onEvent: (t, d) => { if (t === 'catch' && d.team === 0) { ev.catches++; if (d.perfect) ev.perfect++; } if (t === 'hit' && d.team === 1) ev.hits++; if (t === 'burn') ev.burns++; } }).start();
  const S = game.state(), hero = S.units[1]; let acc = 0, mx = 0, my = 0, a = false, think = -1, press = -1, dec = {}, err = {}, side = 1;
  const g1 = () => (br() + br() + br() - 1.5) * 1.6;
  while (S.phase === 'play' && S.time < 400) {
    if (!o.aiOnly) {
      acc += dt;
      if (press >= 0) { press -= dt; a = press > 0; if (press <= 0) { think = -1; } }
      if (acc >= P.react) {
        acc = 0; mx = 0; my = 0;
        const th = hero.state === 'in' ? game.threatOf(hero) : null;
        if (th) {
          const id = th.ball.sid;
          if (dec[id] == null) { dec[id] = br() < P.catchP ? 'c' : br() < P.dodgeP ? 'd' : 'n'; err[id] = g1() * P.timeErr; side = br() < 0.5 ? -1 : 1; }
          if (dec[id] === 'c' && hero.hold < 0 && hero.lock <= 0 && th.eta <= L.stanceLen(th.ball.heat) / 2 + err[id] + 0.03) game.pressB(1);
          else if (dec[id] === 'd') { const l = Math.hypot(th.ball.vx, th.ball.vy) || 1; mx = -th.ball.vy / l * side; my = th.ball.vx / l * side * 0.5; }
        } else if (hero.hold >= 0) {
          my = (hero.team === 0 ? S.units[1].y > 470 ? -1 : 0 : 0) * 0.5; mx = Math.sin(S.time * 1.2) * 0.4;
          if (think < 0) think = P.thinkMin + br() * (P.thinkMax - P.thinkMin);
          think -= P.react;
          if (think <= 0 && press < 0) press = br() < P.chargeP ? 0.6 + br() * 0.4 : 0.05;
        } else {
          let best = null, bd = 1e9; for (const b of S.balls) if (b.state === 'loose' && (hero.state === 'out' ? b.y < 130 : b.y >= 400 && b.y <= 670)) { const d = Math.hypot(b.x - hero.x, b.y - hero.y); if (d < bd) { bd = d; best = b; } }
          if (best) { mx = Math.max(-1, Math.min(1, (best.x - hero.x) / 30)); my = hero.state === 'out' ? 0 : Math.max(-1, Math.min(1, (best.y - hero.y) / 30)); }
          else { mx = Math.max(-1, Math.min(1, (225 + Math.sin(S.time * 0.8) * 90 - hero.x) / 30)) * 0.6; my = Math.max(-1, Math.min(1, (600 - hero.y) / 30)) * 0.5; }
        }
        if (hero.state === 'out') my = 0;
      }
      game.setInput(1, mx, my, a || press > 0);
    }
    game.update(dt);
  }
  return { result: S.result, points: S.points, time: S.time, ...ev, alive: game.counts(), left: S.left, sudden: S.sudden };
}

// турнир: 7 матчей, 2 попытки на переигровку; ничья — без потери попытки
export function playTournament(K, seed, o = {}) {
  let retries = o.retries == null ? 2 : o.retries, m = 0, score = 0, n = 0, losses = 0;
  while (m < 7 && n < 60) {
    n++; const r = playMatch(K, m, seed * 100 + n, o);
    if (r.result === 'win') { score += r.points; m++; } else if (r.result === 'lose') { losses++; if (retries <= 0) break; retries--; }
  }
  return { matches: m, won: m >= 7, score, losses };
}
