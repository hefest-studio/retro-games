/* МЕДНИЦА · экономика без DOM (MEDNITSA.econ). Состояние — простой объект (сериализуется в JSON целиком).
   Всё время — в секундах игрового процесса; «сейчас» (мс) приходит снаружи: g.serverTime() — серверное время площадки
   или часы устройства на сайте. Защита от перевода часов — в offline()/touch(): отметка lastSeen только растёт. */
(function (global) {
  'use strict';
  var M = global.MEDNITSA = global.MEDNITSA || {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Флаги площадки → копия конфига (значения — строки; нечисловые, отрицательные и 0 — кроме ad_idle_first — игнорируются)
  function applyFlags(cfg, get) {
    var c = clone(cfg), K = M.FLAG_KEYS || {};
    c.costScale = 1; c.incomeScale = 1;
    Object.keys(K).forEach(function (k) {
      var v = parseFloat(get(k)); if (!isFinite(v) || v < 0 || (v === 0 && k !== 'ad_idle_first')) return;   // 0 допустим только для «реклама с первой секунды»
      if (k === 'cost_scale') c.costScale = v; else if (k === 'income_scale') c.incomeScale = v;
      else { var p = K[k]; c[p[0]][p[1]] = v; }
    });
    return c;
  }

  function Econ(cfg) {
    cfg = cfg || M.CFG; if (cfg.costScale == null) { cfg = clone(cfg); cfg.costScale = 1; cfg.incomeScale = 1; }
    var WS = cfg.WS, N = WS.length, UPS = cfg.UPS, UPI = {}; UPS.forEach(function (u) { UPI[u.id] = u; });
    var E = { cfg: cfg, N: N };

    E.newState = function () {
      return { v: cfg.version, copper: 0, runEarned: 0, lifeEarned: 0, marks: 0, marksEver: 0, prestiges: 0,
        lv: WS.map(function () { return 0; }), ups: {}, taps: 0, goals: {}, goalSeq: 0, chests: 0, boosts: 0,
        boostLeft: 0, lastSeen: 0, giftDay: -1, giftStreak: 0, chestT: cfg.chest.first, chestLive: 0,
        starter: false, starterGranted: false, playSec: 0, saved: 0 };
    };
    // Миграция/нормализация загруженного состояния (новые поля — значения по умолчанию)
    E.normalize = function (s) {
      var d = E.newState(); if (!s || typeof s !== 'object') return d;
      Object.keys(d).forEach(function (k) { if (s[k] === undefined || s[k] === null) s[k] = d[k]; });
      if (!Array.isArray(s.lv)) s.lv = d.lv; while (s.lv.length < N) s.lv.push(0); s.lv.length = N;
      for (var i = 0; i < N; i++) { s.lv[i] = Math.max(0, Math.floor(+s.lv[i] || 0)); }
      ['copper', 'runEarned', 'lifeEarned', 'marks', 'marksEver', 'boostLeft', 'playSec'].forEach(function (k) { s[k] = +s[k]; if (!isFinite(s[k]) || s[k] < 0) s[k] = 0; });
      s.v = cfg.version; return s;
    };

    // ---------- множители и доход ----------
    function milestones(lv) { var n = 0; for (var i = 0; i < cfg.MILESTONES.length; i++) if (lv >= cfg.MILESTONES[i]) n++; return n; }
    E.milestones = milestones;
    E.nextMilestone = function (lv) { for (var i = 0; i < cfg.MILESTONES.length; i++) if (lv < cfg.MILESTONES[i]) return cfg.MILESTONES[i]; return null; };
    E.wsMult = function (s, i) {
      var m = Math.pow(2, milestones(s.lv[i]));
      for (var k = 0; k < UPS.length; k++) { var u = UPS[k]; if (u.kind === 'ws' && u.ws === i && s.ups[u.id]) m *= u.x; }
      return m;
    };
    E.allMult = function (s, starterOwned) {
      var m = (1 + cfg.prestige.bonus * s.marks) * cfg.incomeScale;
      for (var k = 0; k < UPS.length; k++) { var u = UPS[k]; if (u.kind === 'all' && s.ups[u.id]) m *= u.x; }
      if (starterOwned || s.starter) m *= cfg.starter.mult;
      return m;
    };
    E.wsIncome = function (s, i, lv) { return (lv == null ? s.lv[i] : lv) * WS[i].inc * E.wsMult(s, i); };
    // доход в секунду без форсажа (base) и с ним
    E.baseIncome = function (s) { var t = 0; for (var i = 0; i < N; i++) if (s.lv[i]) t += E.wsIncome(s, i); return t * E.allMult(s); };
    E.boostMult = function (s) { return s.boostLeft > 0 ? cfg.boost.mult : 1; };
    E.income = function (s) { return E.baseIncome(s) * E.boostMult(s); };
    E.tapValue = function (s) {
      var b = cfg.tap.base, pct = cfg.tap.pct;
      for (var k = 0; k < UPS.length; k++) { var u = UPS[k]; if (!s.ups[u.id]) continue; if (u.kind === 'tap') b *= u.x; else if (u.kind === 'tapPct') pct += u.x; }
      return (b * E.allMult(s) + pct * E.baseIncome(s)) * E.boostMult(s);
    };

    // ---------- цены и покупки ----------
    E.cost = function (i, lv, n) { var w = WS[i], gg = w.g; n = n || 1; return w.c0 * Math.pow(gg, lv) * (Math.pow(gg, n) - 1) / (gg - 1) * cfg.costScale; };
    E.maxBuy = function (s, i) {
      var w = WS[i], gg = w.g, c = s.copper / cfg.costScale, base = w.c0 * Math.pow(gg, s.lv[i]);
      if (c < base) return 0; return Math.max(0, Math.floor(Math.log(c * (gg - 1) / base + 1) / Math.log(gg) + 1e-9));
    };
    E.unlocked = function (s, i) { return i === 0 || s.lv[i - 1] > 0 || s.lv[i] > 0; };
    // mode: 1 | 10 | 'max' → сколько уровней купить сейчас (для 10 — ровно 10, если хватает)
    E.buyCount = function (s, i, mode) { var m = E.maxBuy(s, i); if (mode === 'max') return m; return m >= mode ? mode : (mode === 1 ? 0 : 0); };
    E.buy = function (s, i, mode) {
      if (!E.unlocked(s, i)) return 0; var n = E.buyCount(s, i, mode == null ? 1 : mode); if (n <= 0) return 0;
      var c = E.cost(i, s.lv[i], n); if (c > s.copper * (1 + 1e-12)) return 0;
      var first = s.lv[i] === 0, ms0 = milestones(s.lv[i]);
      s.copper = Math.max(0, s.copper - c); s.lv[i] += n;
      return { n: n, first: first, milestone: milestones(s.lv[i]) > ms0 };
    };
    E.upVisible = function (s, u) { return !s.ups[u.id] && s.lv[u.need.ws] >= u.need.lv; };
    E.upsVisible = function (s) { return UPS.filter(function (u) { return E.upVisible(s, u); }); };
    E.upCost = function (u) { return u.cost * cfg.costScale; };
    E.buyUp = function (s, id) { var u = UPI[id]; if (!u || !E.upVisible(s, u) || s.copper < E.upCost(u)) return false; s.copper -= E.upCost(u); s.ups[id] = 1; return true; };
    E.upCount = function (s) { return Object.keys(s.ups).length; };
    E.up = function (id) { return UPI[id]; };

    // ---------- время: доход, форсаж, посылка ----------
    function earn(s, v) { s.copper += v; s.runEarned += v; s.lifeEarned += v; }
    E.earn = earn;
    // продвинуть игру на sec секунд активной игры (доход + форсаж + таймер посылки) → { chest: 'show'|'gone'|null }
    E.advance = function (s, sec) {
      if (!(sec > 0)) return {};
      var base = E.baseIncome(s), t1 = Math.min(sec, s.boostLeft);
      earn(s, base * cfg.boost.mult * t1 + base * (sec - t1)); s.boostLeft = Math.max(0, s.boostLeft - t1); s.playSec += sec;
      var ev = null;
      if (s.chestLive > 0) { s.chestLive -= sec; if (s.chestLive <= 0) { s.chestLive = 0; s.chestT = cfg.chest.every; ev = 'gone'; } }
      else { s.chestT -= sec; if (s.chestT <= 0) { s.chestLive = cfg.chest.life; ev = 'show'; } }
      return { chest: ev };
    };
    E.tap = function (s) { var v = E.tapValue(s); earn(s, v); s.taps++; return v; };
    E.boostSec = function (s) { var m = cfg.boost.min; UPS.forEach(function (u) { if (u.kind === 'boost' && s.ups[u.id]) m = Math.max(m, u.x); }); return m * 60; };
    E.boostAdd = function (s) { s.boostLeft = Math.min(s.boostLeft + E.boostSec(s), cfg.boost.maxMin * 60); s.boosts++; return s.boostLeft; };
    E.chestReward = function (s, ad) { var v = Math.max(20 + E.tapValue(s) * 20, E.baseIncome(s) * cfg.chest.freeSec); return ad ? v * cfg.chest.adMult : v; };
    E.openChest = function (s, ad) { if (s.chestLive <= 0) return 0; var v = E.chestReward(s, ad); earn(s, v); s.chestLive = 0; s.chestT = cfg.chest.every; s.chests++; return v; };

    // ---------- офлайн-доход (защита от перевода часов) ----------
    E.capSec = function (s) { var h = cfg.offline.capH; UPS.forEach(function (u) { if (u.kind === 'cap' && s.ups[u.id]) h = Math.max(h, u.x); }); return h * 3600; };
    E.offRate = function (s) { var r = cfg.offline.rate; UPS.forEach(function (u) { if (u.kind === 'rate' && s.ups[u.id]) r = Math.max(r, u.x); }); return r; };
    // now — мс (серверное время или часы устройства). Возвращает { sec, away, gain, capped, back } и СДВИГАЕТ lastSeen.
    // Часы назад (now < lastSeen) — 0 и lastSeen не уменьшается: «перевёл вперёд → забрал → вернул назад» не даёт второго раза,
    // пока реальное время не догонит отметку. Вперёд — не больше предела офлайна.
    E.offline = function (s, now) {
      var r = { sec: 0, away: 0, gain: 0, capped: false, back: false };
      if (!(now > 0)) return r;
      if (!s.lastSeen) { s.lastSeen = now; return r; }
      var dt = (now - s.lastSeen) / 1000;
      if (dt < 0) { r.back = true; return r; }
      s.lastSeen = now; r.away = dt;
      if (dt < cfg.offline.minSec) return r;   // короткий уход (до минуты) — не офлайн: доход идёт обычным ходом в игре
      var cap = E.capSec(s); r.sec = Math.min(dt, cap); r.capped = dt > cap;
      r.gain = E.baseIncome(s) * E.offRate(s) * r.sec; return r;
    };
    E.applyOffline = function (s, r, mult) { var v = r.gain * (mult || 1); if (v > 0) earn(s, v); return v; };
    E.touch = function (s, now) { if (now > (s.lastSeen || 0)) s.lastSeen = now; };

    // ---------- ежедневный подарок (день — по UTC+3 от «сейчас» площадки) ----------
    E.dayOf = function (now) { return Math.floor((now + 3 * 3600000) / 86400000); };
    E.daily = function (s, now) {
      var day = E.dayOf(now), ready = day > s.giftDay, streak = ready ? (day === s.giftDay + 1 ? s.giftStreak % 7 + 1 : 1) : s.giftStreak;
      var mins = cfg.daily[(streak - 1) % 7] || cfg.daily[0];
      return { day: day, ready: ready, streak: streak, mins: mins, mark: streak === 7, value: Math.max(cfg.dailyMin, E.baseIncome(s) * mins * 60) };
    };
    E.claimDaily = function (s, now) {
      var d = E.daily(s, now); if (!d.ready) return null;
      s.giftDay = d.day; s.giftStreak = d.streak; earn(s, d.value); if (d.mark) { s.marks++; s.marksEver++; }
      return d;
    };

    // ---------- заказы ----------
    function goalAt(idx) {
      var G = cfg.GOALS; if (idx < G.length) return G[idx];
      var k = idx - G.length + 1; return { id: 'gx' + k, type: 'all', n: 50 + 25 * k, rw: 240 + 20 * k, min: 1e12 * Math.pow(10, k) };
    }
    E.goalAt = goalAt;
    E.goalProgress = function (s, g) {
      switch (g.type) {
        case 'lv': return s.lv[g.ws];
        case 'taps': return s.taps;
        case 'earn': return s.runEarned;
        case 'ups': return E.upCount(s);
        case 'chest': return s.chests;
        case 'prestige': return s.prestiges;
        case 'boost': return s.boosts;
        case 'all': { var m = Infinity, any = false; for (var i = 0; i < N; i++) { if (!E.unlocked(s, i)) continue; any = true; m = Math.min(m, s.lv[i]); } return any ? m : 0; }
      }
      return 0;
    };
    // 3 первых невыполненных (забранных) заказа
    E.activeGoals = function (s, n) {
      n = n || 3; var out = [];
      for (var i = 0; out.length < n && i < cfg.GOALS.length + 400; i++) {
        var g = goalAt(i); if (s.goals[g.id]) continue;
        var p = E.goalProgress(s, g); out.push({ goal: g, idx: i, p: Math.min(p, g.n), n: g.n, done: p >= g.n, reward: E.goalReward(s, g) });
      }
      return out;
    };
    E.goalReward = function (s, g) { return Math.max(25, E.baseIncome(s) * g.rw, E.tapValue(s) * g.rw / 4); };   // секунды дохода (в самом начале — удары)
    E.claimGoal = function (s, id) {
      var a = E.activeGoals(s, 3); for (var i = 0; i < a.length; i++) if (a[i].goal.id === id && a[i].done) { s.goals[id] = 1; s.goalSeq++; earn(s, a[i].reward); return a[i].reward; }
      return 0;
    };
    E.goalsReady = function (s) { return E.activeGoals(s, 3).filter(function (a) { return a.done; }).length; };

    // ---------- переплавка (престиж) ----------
    E.marksTotal = function (lifeEarned) { return Math.floor(cfg.prestige.k * Math.cbrt(Math.max(0, lifeEarned) / cfg.prestige.div)); };   // кубический корень: удвоить клейма — заработать ×8
    E.prestigeGain = function (s) { return Math.max(0, E.marksTotal(s.lifeEarned) - s.marksEver); };
    E.canPrestige = function (s) { return E.prestigeGain(s) >= cfg.prestige.minGain; };
    // сколько ещё заработать до следующих minGain клейм (для подсказки)
    E.earnForGain = function (s, gain) { var want = s.marksEver + (gain || cfg.prestige.minGain); var need = Math.pow(want / cfg.prestige.k, 3) * cfg.prestige.div; return Math.max(0, need - s.lifeEarned); };
    E.prestige = function (s) {
      var g = E.prestigeGain(s); if (g < cfg.prestige.minGain) return 0;
      s.marks += g; s.marksEver += g; s.prestiges++;
      s.copper = 0; s.runEarned = 0; s.lv = WS.map(function () { return 0; }); s.ups = {};
      s.chestT = cfg.chest.first; s.chestLive = 0;
      return g;
    };
    return E;
  }

  // ---------- формат чисел ----------
  var SUF = {
    ru: ['', ' тыс', ' млн', ' млрд', ' трлн', ' квдр', ' квнт'],
    en: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'],
    tr: ['', 'B', 'Mn', 'Mr', 'Tn', 'Kd', 'Kn'],
    es: ['', 'K', 'M', 'MM', 'B', 'kB', 'T'],
    pt: ['', 'mil', 'mi', 'bi', 'tri', 'qua', 'qui']
  };
  function fmt(n, lang) {
    if (!isFinite(n)) return '∞'; if (n < 0) return '-' + fmt(-n, lang);
    if (n < 1000) return n < 10 && n % 1 > 0.05 ? n.toFixed(1) : String(Math.floor(n));
    var suf = SUF[lang] || SUF.en, e = Math.floor(Math.log10(n) / 3), sp = lang === 'pt' ? ' ' : '';
    var name;
    if (e < suf.length) name = sp + suf[e];
    else { var k = e - suf.length; name = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + k % 26); }
    var v = n / Math.pow(1000, e), s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    s = s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    if (lang && lang !== 'en') s = s.replace('.', ',');
    return s + name;
  }
  function fmtTime(sec, lang) {
    sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    var U = { ru: ['ч', 'мин', 'с'], tr: ['sa', 'dk', 'sn'], es: ['h', 'min', 's'], pt: ['h', 'min', 's'] }[lang] || ['h', 'm', 's'];
    if (h) return h + U[0] + (m ? ' ' + m + U[1] : ''); if (m) return m + U[1] + (s && m < 10 ? ' ' + s + U[2] : ''); return s + U[2];
  }

  M.econ = { Econ: Econ, applyFlags: applyFlags, fmt: fmt, fmtTime: fmtTime };
})(typeof window !== 'undefined' ? window : globalThis);
