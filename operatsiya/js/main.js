/* ОПЕРАЦИЯ · сборка: фреймворк Гефест Arcade (engine.js) + логика боя (game.js) + кампания (campaign.js) + рендер/интерфейс.
   Сцены: title (меню: Продолжить/Новая кампания, Горячий стул, Сложность + язык/тема/звук; фон — цех), equip (снаряжение),
   play (бой), handoff (передача хода в «горячем стуле»), debrief (разбор), pause/win — движок.
   Ввод: мышь/тач (pointer events) по полю, списку бойцов и панели действий; клавиши 1/2/3, G, C, R, F, Z, K, N, Tab/Q/E,
   стрелки/WASD + пробел/Enter — курсор. Бой сохраняется в начале каждого хода бригады, кампания — между миссиями. */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA, LG = O.logic, LY = O.layout, R = O.render, Camp = O.Camp, Store = Arcade.Store, T = LG.T, MW = LG.MW, MH = LG.MH, C = LG.COST;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0d1016', panel: '#11151c', ink: '#eef2f8', muted: '#9aa4b5', accent: '#64b5f6', grid: '#222838' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#40c8f8', muted: '#a8a8a8' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: LY.W, height: LY.H, gameId: 'operatsiya', strings: O.STR, theme: 'modern', lives: 1, themes: themes });
  O.g = g; O.ui.init(g);
  function pal() { return g.themeName === 'retro' ? O.classic : O.modern; }
  g.useStandardScreens({ lives: 1 });

  var DKEY = 'arcade.operatsiya.diff', DIFFS = ['easy', 'normal', 'hard'];
  var diff = Store.get(DKEY, 'normal'); if (DIFFS.indexOf(diff) < 0) diff = 'normal';
  var camp = Camp.load(Store), game = null, hot = false, sure = false, E = { row: 0, regions: [], diff: diff }, DB = null;
  var V = null;
  function resetView() {
    V = { sel: null, hover: null, mode: 'move', fire: 'aimed', armed: false, pos: {}, anims: { beams: [], booms: [], floats: [], lobs: [] }, banner: null,
      hoverBtn: null, log: [], wait: 0, lock: 0, endT: null, touchPrev: null, dirty: true, key: '' };
  }
  resetView();
  function S() { return game && game.state(); }
  function viewTeam() { var s = S(); return s && s.hotseat ? s.side : 0; }
  function human() { var s = S(); return s && s.phase === 'play' && !game.busy() && (s.hotseat || s.side === 0) && V.lock <= 0 && V.endT == null; }
  function selU() {
    var s = S(); if (!s) return null; var vt = viewTeam(), u = V.sel != null ? game.byId(V.sel) : null;
    if (!u || u.team !== vt || !u.alive || u.evac || u.captive) {
      u = s.units.filter(function (q) { return q.team === vt && q.alive && !q.evac && !q.captive; })[0] || null;
      V.sel = u ? u.id : null;
    }
    return u;
  }
  function roster() { var vt = viewTeam(); return S().units.filter(function (q) { return q.team === vt && (q.kind !== 'master' || !q.captive); }).slice(0, 7); }
  function cycle(d) { var L = roster().filter(function (q) { return q.alive && !q.evac; }); if (!L.length) return; var i = L.findIndex(function (q) { return q.id === V.sel; }); V.sel = L[(i + d + L.length) % L.length].id; V.mode = 'move'; V.armed = false; V.dirty = true; var u = selU(); if (u) V.hover = { x: u.x, y: u.y }; g.audio.beep(760, 0.03, 'triangle', 0.03); }
  function log(text, color) { V.log.unshift({ text: text, color: color }); if (V.log.length > 6) V.log.pop(); }
  function float(x, y, text, color, big) { V.anims.floats.push({ x: x, y: y, text: text, color: color, t: 1.4, big: big }); if (V.anims.floats.length > 14) V.anims.floats.shift(); }
  function nm(u) { return R.nameOf(g, u); }
  function scr(x, y) { return { x: x * LY.TS + LY.TS / 2, y: LY.HUD + y * LY.TS + LY.TS / 2 }; }

  // ---------- События боя ----------
  function onEvent(type, d) {
    if (!game) return;
    O.sfx(g, type, d);
    var P = pal(), s = S(), vt = viewTeam(); V.dirty = true;
    var seenBy = function (x, y) { return s.vis[vt][y * MW + x]; };
    if (type === 'shot') {
      var a = Math.random() * Math.PI * 2;
      V.anims.beams.push({ x: d.x, y: d.y, tx: d.tx, ty: d.ty, hit: d.hit, team: d.team, mode: d.mode, t: 0.3, ox: Math.cos(a) * 0.45, oy: Math.sin(a) * 0.45 });
      if (!d.hit && seenBy(d.tx, d.ty)) float(d.tx, d.ty, g.t('t_miss'), P.muted);
      V.wait = Math.max(V.wait, 0.3); V.lock = Math.max(V.lock, 0.25);
    } else if (type === 'hit') { if (seenBy(d.x, d.y) || d.team === vt) float(d.x, d.y, '−' + d.dmg, d.team === vt ? P.bad : P.warn, true); }
    else if (type === 'down') {
      var u = game.byId(d.id), p = scr(d.x, d.y);
      g.particles.spawn(p.x, p.y, { color: d.team === 0 ? P.t0 : P.t1, count: 14, speed: 90, life: 0.6, size: P.pixel ? 4 : 3 });
      var msg = R.fmt(g.t(d.team === 0 && !s.hotseat || (s.hotseat && d.team === vt) ? 't_down0' : 't_down1'), { name: nm(u) });
      if (d.team === 0 || seenBy(d.x, d.y) || s.hotseat) { float(d.x, d.y, msg, d.team === vt ? P.bad : P.good); log(msg, d.team === vt ? P.bad : P.good); }
      V.wait = Math.max(V.wait, 0.5);
    } else if (type === 'react') { var r = game.byId(d.id); if (r.team === vt || seenBy(d.x, d.y)) { float(d.x, d.y, g.t('t_react'), P.warn, true); log(g.t('t_react') + ' ' + nm(r), P.warn); } V.wait = Math.max(V.wait, 0.35); }
    else if (type === 'overheat') { var o = game.byId(d.id); if (o.team === vt) { var m2 = R.fmt(g.t('t_overheat'), { n: d.lost }); float(d.x, d.y, m2, P.heatC); log(nm(o) + ': ' + m2, P.heatC); } }
    else if (type === 'boil') { var b = game.byId(d.id); if (b.team === vt) { float(d.x, d.y, g.t('t_boil'), P.heatC, true); log(nm(b) + ': ' + g.t('t_boil'), P.heatC); } }
    else if (type === 'break') { var pb = scr(d.x, d.y); g.particles.spawn(pb.x, pb.y, { color: P.rubble2, count: 12, speed: 70, life: 0.5, size: 3 }); if (seenBy(d.x, d.y)) float(d.x, d.y, g.t('t_break'), P.warn); }
    else if (type === 'throw') { V.anims.lobs.push({ x: d.x, y: d.y, tx: d.tx, ty: d.ty, t: 0.4, T: 0.4 }); V.wait = Math.max(V.wait, 0.75); V.lock = Math.max(V.lock, 0.6); }
    else if (type === 'boom') { V.anims.booms.push({ x: d.x, y: d.y, t: 0.55, T: 0.55, delay: V.anims.lobs.length ? 0.4 : 0 }); }
    else if (type === 'pickup') { float(d.x, d.y, g.t('t_pick_' + d.item), P.good); }
    else if (type === 'freed') { float(d.x, d.y, g.t('t_freed'), P.good, true); log(g.t('t_freed'), P.good); }
    else if (type === 'hack') { var m3 = R.fmt(g.t('t_hack'), { n: d.prog, m: d.need }); float(d.x, d.y, m3, P.accent, true); log(m3, P.accent); }
    else if (type === 'holdTick') { var m4 = R.fmt(g.t('t_hold'), { n: d.prog, m: d.need }); log(m4, P.zone); V.holdMsg = m4; }
    else if (type === 'evac') { var m5 = R.fmt(g.t('t_evac'), { n: d.n, m: d.need }); float(d.x, d.y, m5, P.good, true); log(m5, P.good); }
    else if (type === 'reinf') { if (!V.reinfT || s.turn !== V.reinfT) { V.reinfT = s.turn; log(g.t('t_reinf'), P.bad); } }
    else if (type === 'spotted') { if (d.team === vt) { var su = game.byId(d.id); float(su.x, su.y, g.t('t_spotted'), P.warn); } }
    else if (type === 'kit') { float(d.x, d.y, g.t('t_kit'), P.good); }
    else if (type === 'reload') { var ru = game.byId(d.id); if (ru.team === vt) float(ru.x, ru.y, g.t('t_reload'), P.accent); }
    else if (type === 'turn') {
      var sub = V.objText || '';
      if (s.hotseat) V.banner = { text: g.t('turn') + ' ' + s.turn + ' · ' + g.t('hs_t' + d.side), sub: '', t: 1.4, color: d.side === 0 ? P.t0 : P.t1 };
      else if (d.side === 0) { V.banner = { text: g.t('turn') + ' ' + s.turn + ' · ' + g.t('side0'), sub: V.holdMsg || sub, t: 1.3, color: P.good }; V.holdMsg = null; if (camp && game) Camp.saveBattle(Store, camp, game); }
      else V.banner = { text: g.t('side1'), sub: '', t: 0.9, color: P.bad };
      V.sel = null;
    } else if (type === 'won' || type === 'lost') {
      var txtE = s.hotseat ? R.fmt(g.t('hs_win'), { name: g.t('hs_t' + d.winner) }) : g.t(type === 'won' ? 'db_win' : 'db_fail');
      V.banner = { text: txtE, sub: s.hotseat ? '' : g.t('r_' + d.reason), t: 2.4, color: type === 'won' ? P.good : P.bad }; V.endT = 2.2;
    }
    syncScore();
  }
  function syncScore() { g.state.score = (camp ? camp.score : 0) + (game && !hot ? S().score : 0); }

  // ---------- Запуск боя ----------
  function newCamp() { camp = Camp.newCampaign(diff); Camp.save(Store, camp); Camp.clearBattle(Store); }
  function startMission(restore) {
    hot = false; resetView(); DB = null;
    var spec = Camp.spec(camp);
    game = null;
    var gm = restore ? O.Game({ restore: restore, onEvent: onEvent }) : O.Game({ spec: spec, seed: 1 + Math.floor(Math.random() * 1e9), diff: diff, squad: Camp.squadDefs(camp), onEvent: onEvent });
    game = gm; V.objText = objText();
    if (!restore) Camp.saveBattle(Store, camp, game);
    V.banner = { text: g.t('m_' + spec.id), sub: O.ui.objLine(g, spec), t: 2, color: pal().accent };
    syncScore(); g.goto('play');
  }
  function startHot() {
    hot = true; resetView(); DB = null; game = null;
    var squad = Camp.ROSTER.slice(0, 5).map(function (r) { return Camp.statsOf({ id: r.id, lvl: 1, load: Object.assign({}, r.load) }); });
    game = O.Game({ spec: O.ARENA, seed: 1 + Math.floor(Math.random() * 1e9), hotseat: true, squad: squad, onEvent: onEvent });
    V.objText = g.t('o_duel'); g.state.score = 0;
    g.goto('handoff', { side: 0 });
  }
  function objText() {
    var s = S(); if (!s) return ''; var k = s.obj.kind;
    if (k === 'clear') return R.fmt(g.t('o_clear'), { n: s.units.filter(function (u) { return u.team === 1 && u.alive; }).length });
    if (k === 'rescue') { var m = s.units.filter(function (u) { return u.kind === 'master'; })[0]; return g.t(m && !m.captive ? 'o_rescue2' : 'o_rescue'); }
    if (k === 'hack' || k === 'hold') return R.fmt(g.t('o_' + k), { n: s.obj.prog, m: s.obj.need });
    if (k === 'evac') return R.fmt(g.t('o_evac'), { n: s.evac, m: s.obj.need });
    return g.t('o_' + k);
  }
  function finishMission() {
    var s = S(), res = s.result;
    if (hot) { DB = { hot: true, winner: s.winner, turn: s.turn }; g.goto('debrief'); return; }
    var rep = Camp.apply(camp, res);
    Camp.clearBattle(Store);
    DB = { won: res.won, reason: res.reason, turn: res.turn, kills: res.kills, score: res.score, units: res.units, rep: rep, total: camp.score, spec: s.spec, camp: camp };
    g.state.score = camp.score; g.saveBest();
    if (camp.done) Camp.clear(Store); else Camp.save(Store, camp);
    g.goto('debrief');
  }
  function afterDebrief() {
    if (!DB) { g.goto('title'); return; }
    if (DB.hot) { game = null; g.goto('title'); return; }
    if (camp.done) { g.state.score = camp.score; camp = null; game = null; g.win(); return; }
    game = null; g.goto('equip');
  }

  // ---------- Действия игрока ----------
  function why(k) { var u = selU(); if (u) float(u.x, u.y, g.t('why_' + k, g.t('t_noap')), pal().bad); g.audio.beep(160, 0.06, 'square', 0.03); }
  function act(k) {
    if (!human()) return;
    var u = selU(); if (!u) return;
    var W = LG.WEAPONS[u.weapon];
    if (k === 'aimed' || k === 'snap' || k === 'burst') {
      if (!W) return why('noweapon');
      if (k === 'burst' && !W.burst) return why('noburst');
      if (V.fire === k) V.armed = !V.armed; else { V.fire = k; V.armed = true; }
      V.mode = 'move';
      if (V.target && game.shotInfo(u, V.target, V.fire).ok && V.touchFire) { fireAt(V.target); }
    } else if (k === 'gear') { if (!(u.gear > 0)) return why('nogear'); V.mode = V.mode === 'gear' ? 'move' : 'gear'; V.armed = false; }
    else if (k === 'turn') { V.mode = V.mode === 'turn' ? 'move' : 'turn'; V.armed = false; }
    else if (k === 'kit') {
      if (!(u.kit > 0)) return why('target');
      var near = S().units.filter(function (q) { return q.team === u.team && q.alive && !q.evac && LG.cheb(q.x, q.y, u.x, u.y) <= 1 && (q.hp < q.hpMax || q.heat >= 20); });
      if (near.length === 1) { if (!game.useKit(u, near[0])) why('ap'); }
      else if (near.length) { V.mode = V.mode === 'kit' ? 'move' : 'kit'; }
      else why('target');
    }
    else if (k === 'crouch') { if (!game.crouch(u)) why('ap'); }
    else if (k === 'reload') { if (!game.reload(u)) why(u.ap < C.reload ? 'ap' : 'target'); }
    else if (k === 'act') { var o = game.interactOptions(u)[0]; if (!o) return why('target'); if (!game.interact(u)) why(o.used ? 'target' : 'ap'); else if (o.kind === 'evac') V.sel = null; }
    else if (k === 'end') { endTurn(); return; }
    V.dirty = true;
  }
  function endTurn() {
    if (!human()) return;
    V.mode = 'move'; V.armed = false; V.preview = null; V.touchPrev = null;
    if (game.endTurn()) { V.sel = null; if (S().hotseat && S().phase === 'play') g.goto('handoff', { side: S().side }); }
  }
  function fireAt(tg) {
    var u = selU(), I = game.shotInfo(u, tg, V.fire);
    if (!I.ok) return why(I.why);
    game.shoot(u, tg, V.fire); V.armed = false; V.touchPrev = null; V.dirty = true;
  }
  function tileClick(x, y, touch) {
    if (!human()) return;
    var s = S(), u = selU(); if (!u) return;
    var v = game.unitAt(x, y), vt = viewTeam();
    if (V.mode === 'kit') { if (v && v.team === u.team) { if (!game.useKit(u, v)) why('target'); } V.mode = 'move'; V.dirty = true; return; }
    if (v && v.team === vt && !v.captive) { if (v.id !== V.sel) { V.sel = v.id; V.mode = 'move'; V.armed = false; V.touchPrev = null; V.dirty = true; g.audio.beep(760, 0.03, 'triangle', 0.03); } return; }
    if (V.mode === 'gear') {
      if (touch && !(V.touchPrev && V.touchPrev.x === x && V.touchPrev.y === y)) { V.touchPrev = { x: x, y: y }; return; }
      var r = game.throwGear(u, x, y); if (!r.ok) why(r.why); else { V.mode = 'move'; V.touchPrev = null; } V.dirty = true; return;
    }
    if (V.mode === 'turn') { if (!game.turnTo(u, x, y)) why('ap'); V.mode = 'move'; V.dirty = true; return; }
    var enemy = v && v.team !== vt && s.spot[vt].indexOf(v.id) >= 0;
    if (enemy) {
      if (touch && !(V.touchPrev && V.touchPrev.x === x && V.touchPrev.y === y)) { V.touchPrev = { x: x, y: y }; V.touchFire = true; return; }
      fireAt(v); return;
    }
    var t = s.t[y * MW + x];
    if (V.armed && LG.TILE_HP[t] && s.seen[vt][y * MW + x]) {
      if (touch && !(V.touchPrev && V.touchPrev.x === x && V.touchPrev.y === y)) { V.touchPrev = { x: x, y: y }; return; }
      fireAt({ x: x, y: y }); return;
    }
    if (t === T.DOOR && LG.cheb(u.x, u.y, x, y) <= 1 && (u.x === x || u.y === y)) { if (!game.interact(u, 'door')) why('ap'); V.dirty = true; return; }
    if (touch && !(V.touchPrev && V.touchPrev.x === x && V.touchPrev.y === y)) { V.touchPrev = { x: x, y: y }; V.dirty = true; return; }
    if (game.moveTo(u, x, y)) { V.touchPrev = null; V.armed = false; } else if (!(x === u.x && y === u.y)) why('ap');
    V.dirty = true;
  }

  // ---------- Подсказки при наведении ----------
  function refresh() {
    var s = S(); if (!s) return;
    var u = selU(), h = V.hover, key = [h ? h.x + ',' + h.y : '-', V.sel, V.mode, V.fire, V.armed, s.side, s.turn, u ? u.ap + ',' + u.x + ',' + u.y : '', human()].join('|');
    if (!V.dirty && key === V.key) return;
    V.dirty = false; V.key = key; V.objText = objText();
    V.preview = null; V.aim = null; V.blast = null; V.target = null; V.costPreview = 0; V.reach = null; V.actLabel = '';
    var P = pal(), info = [];
    if (u) { var io = game.interactOptions(u)[0]; if (io) V.actLabel = g.t('i_' + io.kind) + ' (' + io.cost + ')'; }
    if (u && human()) {
      if (V.mode === 'move') { V.reach = game.reach(u); V.reachSafe = u.ap - C.snap; }
      if (h) {
        var v = game.unitAt(h.x, h.y), vt = viewTeam(), enemy = v && v.team !== vt && s.spot[vt].indexOf(v.id) >= 0, t = s.t[h.y * MW + h.x];
        if (V.mode === 'gear') {
          var I = game.gearInfo(u, h.x, h.y);
          V.blast = { x: h.x, y: h.y, ok: I.ok, text: I.ok ? I.chance + '% · ' + I.cost + ' ' + g.t('ap') : g.t('why_' + I.why) };
          V.costPreview = I.cost || C.gear; V.costOk = I.ok;
        } else if (V.mode === 'turn') { V.costPreview = C.turn; V.costOk = u.ap >= C.turn; }
        else if (enemy) {
          V.target = v;
          var I2 = game.shotInfo(u, v, V.fire);
          V.aim = { x0: u.x, y0: u.y, x1: v.x, y1: v.y, ok: I2.ok, text: I2.chance != null ? I2.chance + '%' : '—' };
          V.costPreview = I2.cost || C[V.fire]; V.costOk = I2.ok;
          info.push({ text: nm(v) + ' · ' + g.t('hp') + ' ' + v.hp + '/' + v.hpMax, color: P.bad, bold: true });
          var cov = game.coverOf(v.x, v.y, u.x, u.y);
          info.push({ text: g.t('cover' + cov) + (v.crouch ? ' · ' + g.t('crouched') : '') + (LG.elevOf(s.t[u.y * MW + u.x]) > LG.elevOf(t) ? ' · ' + g.t('high') : ''), color: P.muted });
          ['aimed', 'snap', 'burst'].forEach(function (m) { var J = game.shotInfo(u, v, m); if (J.why === 'noburst' || J.why === 'noweapon') return; info.push({ text: g.t('b_' + m) + ': ' + (J.chance != null ? J.chance + '%' : '—') + (J.rounds > 1 ? ' ×' + J.rounds : '') + ' · ' + (J.cost || C[m]) + ' ' + g.t('ap') + (J.ok ? '' : ' · ' + g.t('ws_' + J.why, '✕')), color: m === V.fire ? (J.ok ? P.ink : P.bad) : P.muted, bold: m === V.fire }); });
        } else if (V.armed && LG.TILE_HP[t] && s.seen[vt][h.y * MW + h.x]) {
          var I3 = game.shotInfo(u, { x: h.x, y: h.y }, V.fire);
          V.aim = { x0: u.x, y0: u.y, x1: h.x, y1: h.y, ok: I3.ok, text: I3.chance != null ? I3.chance + '%' : '—' };
          V.costPreview = I3.cost || C[V.fire]; V.costOk = I3.ok;
        } else if (V.mode === 'move' && !(h.x === u.x && h.y === u.y)) {
          var PP = game.planPath(u, h.x, h.y);
          if (PP) { V.preview = { path: PP.path, cost: PP.cost, ok: true }; V.costPreview = PP.cost; V.costOk = true; }
        }
      }
    }
    if (!info.length) {
      if (V.armed && u) info.push({ text: g.t('b_' + V.fire) + ' ▸', color: P.warn, bold: true });
      V.log.forEach(function (l) { info.push(l); });
    }
    V.info = info;
  }
  function buttonsState() {
    var u = selU(), on = human() && u, B = {}, W = u && LG.WEAPONS[u.weapon];
    var keys = { aimed: '1', snap: '2', burst: '3', gear: 'G', crouch: 'C', reload: 'R', act: 'F', turn: 'Z', kit: 'K', end: 'N' };
    ['aimed', 'snap', 'burst'].forEach(function (k) { B[k] = { en: !!on && !!W && (k !== 'burst' || W.burst) && u.ap >= C[k], on: V.fire === k && (V.armed || !!on), cost: C[k], key: keys[k], label: g.t('b_' + k) + (V.fire === k && V.armed ? ' ◎' : '') }; });
    B.gear = { en: on && u.gear > 0 && u.ap >= C.gear, on: V.mode === 'gear', cost: C.gear, key: keys.gear, label: g.t('b_gear') + (u ? ' ×' + (u.gear | 0) : '') };
    B.crouch = { en: on && u.ap >= C.crouch, on: u && u.crouch, cost: C.crouch, key: keys.crouch, label: g.t(u && u.crouch ? 'b_stand' : 'b_crouch') };
    B.reload = { en: on && W && u.clip < W.clip && (u.clips > 0 || u.inf) && u.ap >= C.reload, cost: C.reload, key: keys.reload };
    var io = u && game.interactOptions(u)[0];
    B.act = { en: !!(on && io && !io.used && u.ap >= io.cost), cost: io ? io.cost : null, key: keys.act, label: io ? g.t('i_' + io.kind) : g.t('b_act') };
    B.turn = { en: on && u.ap >= C.turn, on: V.mode === 'turn', cost: C.turn, key: keys.turn };
    B.kit = { en: on && u.kit > 0 && u.ap >= C.kit, on: V.mode === 'kit', cost: C.kit, key: keys.kit, label: g.t('b_kit') + (u ? ' ×' + (u.kit | 0) : '') };
    B.end = { en: !!human(), key: keys.end };
    return B;
  }

  // ---------- Указатель ----------
  var cv = g.canvas;
  function toCanvas(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * g.W / r.width, y: (e.clientY - r.top) * g.H / r.height }; }
  function tileAt(p) { if (p.x < 0 || p.x >= LY.MAPW || p.y < LY.HUD || p.y >= LY.HUD + LY.MAPH) return null; return { x: Math.floor(p.x / LY.TS), y: Math.floor((p.y - LY.HUD) / LY.TS) }; }
  function btnAt(p) { for (var i = 0; i < LY.BTNS.length; i++) { var r = LY.btn(i); if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return LY.BTNS[i]; } return null; }
  function rowAt(p) { if (p.x < LY.PX || p.y < LY.rowY - 4) return -1; var i = Math.floor((p.y - LY.rowY + 4) / LY.rowH); return i >= 0 && i < 7 ? i : -1; }
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('pointerdown', function (e) {
    var sn = g._sceneName, p = toCanvas(e), touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (sn === 'equip') { e.preventDefault(); equipClick(p); return; }
    if (sn === 'debrief') { e.preventDefault(); afterDebrief(); return; }
    if (sn === 'handoff') { e.preventDefault(); g.goto('play', { resume: true }); return; }
    if (sn !== 'play' || !game) return;
    e.preventDefault();
    if (e.button === 2) { V.mode = 'move'; V.armed = false; V.touchPrev = null; V.dirty = true; return; }
    var b = btnAt(p); if (b) { act(b); return; }
    var ri = rowAt(p); if (ri >= 0) { var L = roster(); if (L[ri] && L[ri].alive && !L[ri].evac) { V.sel = L[ri].id; V.mode = 'move'; V.dirty = true; } return; }
    var t = tileAt(p); if (t) { V.hover = t; V.dirty = true; refresh(); tileClick(t.x, t.y, touch); }
  });
  cv.addEventListener('pointermove', function (e) {
    var p = toCanvas(e), sn = g._sceneName;
    if (sn === 'equip') { var r = regionAt(p); if (r && r.i != null) E.row = r.i; return; }
    if (sn !== 'play' || !game || e.pointerType === 'touch') return;
    var t = tileAt(p); V.hoverBtn = btnAt(p);
    if (t && (!V.hover || t.x !== V.hover.x || t.y !== V.hover.y)) { V.hover = t; V.touchPrev = null; }
    else if (!t && V.hover && !V.kbd) V.hover = null;
    V.kbd = false;
  });

  // ---------- Клавиши боя ----------
  addEventListener('keydown', function (e) {
    var sn = g._sceneName;
    if (sn === 'equip') { equipKey(e); return; }
    if (sn !== 'play' || !game) return;
    if (e.code === 'Tab') e.preventDefault();
    if (e.repeat && e.code !== 'Tab') return;
    var map = { Digit1: 'aimed', Digit2: 'snap', Digit3: 'burst', Numpad1: 'aimed', Numpad2: 'snap', Numpad3: 'burst', KeyG: 'gear', KeyC: 'crouch', KeyR: 'reload', KeyF: 'act', KeyZ: 'turn', KeyK: 'kit', KeyN: 'end' };
    if (map[e.code]) { act(map[e.code]); return; }
    if (e.code === 'Tab') cycle(e.shiftKey ? -1 : 1);
    else if (e.code === 'KeyE') cycle(1);
    else if (e.code === 'KeyQ') cycle(-1);
  });
  // тач-кнопки под канвой: следующий боец, конец хода, пауза
  var pad = document.querySelector('.pad');
  if (pad) pad.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); var k = b.getAttribute('data-key'), sn = g._sceneName;
      if (b.hasAttribute('data-pause')) { if (sn === 'play') g.pause(); else if (sn === 'pause') g.goto('play', { resume: true }); return; }
      if (sn !== 'play' || !game) return;
      if (k === 'Tab') cycle(1); else if (k === 'KeyN') act('end');
    });
  });
  function cursor(dx, dy) {
    var u = selU(); if (!V.hover) V.hover = u ? { x: u.x, y: u.y } : { x: 1, y: 1 };
    V.hover = { x: Math.max(0, Math.min(MW - 1, V.hover.x + dx)), y: Math.max(0, Math.min(MH - 1, V.hover.y + dy)) }; V.kbd = true; V.touchPrev = null;
  }

  // ---------- Снаряжение ----------
  function regionAt(p) { var r = E.regions; for (var i = r.length - 1; i >= 0; i--) { var q = r[i]; if (p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h) return q; } return null; }
  function equipDo(a, i, d) {
    var r = camp.roster[i];
    if (a === 'go') { Camp.save(Store, camp); startMission(); return; }
    if (!r) return;
    if (a === 'sel') { if (!Camp.toggle(camp, r.id)) g.audio.beep(160, 0.05); }
    else if (a === 'weapon') Camp.cycleWeapon(r, d || 1);
    else Camp.cycleItem(r, a, d || 1);
    g.audio.beep(700, 0.03, 'triangle', 0.03); Camp.save(Store, camp);
  }
  function equipClick(p) { var r = regionAt(p); if (!r) return; if (r.i != null) E.row = r.i; equipDo(r.act, r.i); }
  function equipKey(e) {
    var m = { KeyG: 'gear', KeyK: 'kit', KeyO: 'clips' };
    if (m[e.code]) { equipDo(m[e.code], E.row, e.shiftKey ? -1 : 1); }
  }
  g.scene('equip', {
    realtime: true,
    enter: function () { if (!camp) newCamp(); Camp.fitSquad(camp); E.diff = diff; },
    draw: function (ctx) { O.ui.equip(g, ctx, camp, pal(), E); },
    press: function (a) {
      if (a === 'up') E.row = (E.row + camp.roster.length - 1) % camp.roster.length;
      else if (a === 'down') E.row = (E.row + 1) % camp.roster.length;
      else if (a === 'left' || a === 'right') equipDo('weapon', E.row, a === 'left' ? -1 : 1);
      else if (a === 'action') equipDo('sel', E.row);
      else if (a === 'start') equipDo('go');
      else if (a === 'pause') this.goto('title');
    }
  });
  g.scene('debrief', { realtime: true, draw: function (ctx) { if (DB) O.ui.debrief(g, ctx, pal(), DB); }, press: function (a) { if (a === 'start' || a === 'action' || a === 'pause') afterDebrief(); } });
  g.scene('handoff', { realtime: true, enter: function (d) { V.handSide = d && d.side != null ? d.side : S() ? S().side : 0; },
    draw: function (ctx) { O.ui.handoff(g, ctx, pal(), V.handSide); }, press: function (a) { if (a === 'start' || a === 'action') this.goto('play', { resume: true }); else if (a === 'pause') this.goto('title'); } });

  // ---------- Сцена боя ----------
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!game) { this.goto('title'); return; } V.lock = 0.2; V.dirty = true; },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (!game) return;
      if (a === 'up') cursor(0, -1); else if (a === 'down') cursor(0, 1); else if (a === 'left') cursor(-1, 0); else if (a === 'right') cursor(1, 0);
      else if ((a === 'action' || a === 'start') && V.hover) { refresh(); tileClick(V.hover.x, V.hover.y, false); }
    },
    update: function (dt) {
      if (!game) return;
      dt = Math.min(dt, 0.05);
      var s = S(), A = V.anims;
      A.beams.forEach(function (b) { b.t -= dt; }); A.beams = A.beams.filter(function (b) { return b.t > 0; });
      A.lobs.forEach(function (b) { b.t -= dt; }); A.lobs = A.lobs.filter(function (b) { return b.t > 0; });
      A.booms.forEach(function (b) { if (b.delay > 0) b.delay -= dt; else b.t -= dt; }); A.booms = A.booms.filter(function (b) { return b.t > 0; });
      A.floats.forEach(function (f) { f.t -= dt; }); A.floats = A.floats.filter(function (f) { return f.t > 0; });
      if (V.banner) V.banner.t -= dt;
      if (V.lock > 0) V.lock -= dt;
      // плавные позиции
      s.units.forEach(function (u) {
        var p = V.pos[u.id]; if (!p) { V.pos[u.id] = { x: u.x, y: u.y }; return; }
        var dx = u.x - p.x, dy = u.y - p.y, d = Math.hypot(dx, dy), st = dt * 11;
        if (d > 3 || d <= st) { p.x = u.x; p.y = u.y; } else { p.x += dx / d * st; p.y += dy / d * st; }
      });
      // микрошаги движения и хода Совета
      if (V.wait > 0) V.wait -= dt;
      else if (game.busy() && s.phase === 'play' && !(V.banner && V.banner.t > 0.6 && s.ai)) {
        var r = game.tick(); V.dirty = true;
        if (r) V.wait = Math.max(V.wait, r.kind === 'step' ? 0.1 : r.kind === 'door' ? 0.2 : r.kind === 'aimove' ? 0.15 : r.kind === 'crouch' || r.kind === 'reload' ? 0.25 : 0.12);
      }
      V.aiThinking = !!s.ai && !s.hotseat;
      if (V.endT != null) { V.endT -= dt; if (V.endT <= 0) { V.endT = null; finishMission(); return; } }
      refresh(); syncScore();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = S(), u = selU();
      V.btns = buttonsState(); V.viewTeam = viewTeam(); V.selU = u; V.roster = roster(); V.time = g.time;
      R.frame(g, ctx, s, pal(), V);
    }
  });

  // ---------- Заставка ----------
  var demo = null;
  function newDemo() {
    var squad = Camp.ROSTER.map(function (r) { return Camp.statsOf({ id: r.id, lvl: 0, load: r.load }); });
    var gm = O.Game({ spec: O.MISSIONS[5], seed: 7, squad: squad }), s = gm.state();
    for (var i = 0; i < s.seen[0].length; i++) { s.seen[0][i] = 1; s.vis[0][i] = 1; }
    var pos = [[7, 5], [6, 7], [7, 9], [3, 5], [4, 8], [2, 10]];
    s.units.filter(function (u) { return u.team === 0; }).forEach(function (u, i) { u.x = pos[i][0]; u.y = pos[i][1]; u.face = 0; u.crouch = i % 2 === 1; });
    demo = { game: gm, V: { viewTeam: 0, pos: null, anims: { beams: [{ x: 7, y: 5, tx: 11, ty: 6, hit: true, team: 0, mode: 'aimed', t: 0.3, ox: 0, oy: 0 }], booms: [], floats: [], lobs: [] }, time: 0, noDim: true } };
  }
  var title = g.scenes.title, tEnter = title.enter, menu = title._menu;
  function refreshMenu() {
    g.menu.addItem({ key: 'play', index: 0,
      label: function () { return camp ? g.t('cont') + ' · ' + g.t('mission') + ' ' + Camp.spec(camp).id : g.t('play'); },
      onSelect: function () {
        if (!camp) { newCamp(); g.goto('equip'); return; }
        var b = Camp.loadBattle(Store, camp); if (b) { try { startMission(b); return; } catch (e) { Camp.clearBattle(Store); } }
        g.goto('equip');
      } });
    if (camp) g.menu.addItem({ key: 'newc', after: 'play', label: function () { return sure ? g.t('newcSure') : g.t('newc'); },
      onSelect: function () { if (!sure) { sure = true; g.audio.beep(300, 0.06); return; } sure = false; newCamp(); g.goto('equip'); } });
    else g.menu.removeItem('newc');
    g.menu.addItem({ key: 'hot', after: camp ? 'newc' : 'play', label: function () { return g.t('hot'); }, onSelect: startHot });
    g.menu.addItem({ key: 'diff', after: 'hot', label: function () { return g.t('diff') + ': ' + g.t('d_' + diff); },
      onSelect: function () { diff = DIFFS[(DIFFS.indexOf(diff) + 1) % DIFFS.length]; Store.set(DKEY, diff); E.diff = diff; } });
  }
  title.enter = function () { tEnter.call(this); sure = false; game = null; hot = false; camp = camp || Camp.load(Store); refreshMenu(); g.state.score = 0; };
  title.update = function (dt) { if (demo) { demo.V.time += dt; var b = demo.V.anims.beams[0]; b.t -= dt; if (b.t < -1.2) b.t = 0.3; } };
  title.draw = function (ctx) {
    var P = pal(), W = this.W, H = this.H;
    if (!demo) newDemo();
    ctx.fillStyle = P.hud; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate((W - LY.MAPW) / 2, (H - LY.MAPH) / 2); demo.V.time = this.time; R.drawWorld(ctx, demo.game.state(), P, demo.V, LY.TS); ctx.restore();
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.55)' : 'rgba(8,10,14,.6)'; ctx.fillRect(0, 0, W, H);
    var pw = 460, ph = 360, px = (W - pw) / 2, py = 88;
    R.box(ctx, px, py, pw, ph, P, P.panel, P.accent, 16);
    R.txt(this, this.t('title'), W / 2, py + 70, { size: 54, align: 'center', color: P.accent, weight: 900 }, P);
    R.txt(this, this.t('subtitle'), W / 2, py + 98, { size: 12, align: 'center', color: P.muted, weight: 600, shadow: false }, P);
    menu.draw(this, W / 2, py + 148, 32);
    if (this.state.best) R.txt(this, this.t('best') + ': ' + this.state.best, W / 2, py + ph - 16, { size: 12, align: 'center', color: P.muted, weight: 700, shadow: false }, P);
    O.ui.wrap(this, this.t('hintKeys'), W / 2, H - 70, 700, 16, { size: 12, align: 'center', color: P.ink, weight: 700, shadow: false }, P);
  };
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) { baseClear.call(this, c); };

  refreshMenu();
  g.start('title');
  O.app = { g: g, game: function () { return game; }, camp: function () { return camp; }, V: function () { return V; }, startMission: startMission, startHot: startHot,
    newCamp: newCamp, setCamp: function (c) { camp = c; Camp.save(Store, c); }, act: act, tileClick: tileClick, endTurn: endTurn };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
