/* ПОДГОРЬЕ · game.js — логика игры без DOM: героиня, комнаты, предметы, враги, боссы, смерть и сохранения.
   PODGORYE.Game(opts) → api. opts: { world, save (данные слота), seed, onEvent(type, data), god, dmgMul, noEnemies }.
   api: start() · update(dt) · setInput({x,y,jump,shoot,dash,hook,beam}) · state() · snapshot() (данные для слота) ·
   liftMove(d) · liftGo() · liftCancel() · percent() · хуки тестов: _place(room,x,y), _give(ab…), _enter(room), _bossNow(). */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};

  function Game(opts) {
    opts = opts || {};
    var W = opts.world || P.WORLD(), ph = P.phys, K = P.K, T = P.T, EN = P.EN, BS = P.BS;
    var rng = P.mulberry32(opts.seed || 7), emit = opts.onEvent || function () {};
    var DT = 1 / 60;
    var S = {
      W: W, phase: 'play', time: 0, deaths: 0, t: 0, room: -1, R: null, boss: null, msg: null, liftSel: 0,
      prog: { ab: {}, items: {}, forges: {}, bosses: {}, opened: {}, visited: new Uint8Array(W.rooms.length), lifts: {}, anvil: W.start.anvil, hpMax: 5, tanks: 2, ups: {} },
      hero: null, hp: 5, spark: 2, inv: 0, shootCd: 0, chargeT: 0, charging: false, beam: false, deadT: 0, heatCd: 0, safe: null,
      zone: -1, kills: 0, lastAnvilRoom: -1, near: null
    };
    var inp = {}, prevShoot = false, prevUp = false;
    function ev(t, d) { emit(t, d || {}); }

    // ---------- сохранение / загрузка прогресса ----------
    function applySave(sv) {
      var p = S.prog;
      (sv.ab || []).forEach(function (a) { p.ab[a] = true; });
      (sv.items || []).forEach(function (i) { p.items[i] = true; });
      (sv.forges || []).forEach(function (i) { p.forges[i] = true; });
      (sv.bosses || []).forEach(function (b) { p.bosses[b] = true; });
      (sv.opened || []).forEach(function (g) { p.opened[g] = true; });
      (sv.lifts || []).forEach(function (l) { p.lifts[l] = true; });
      (sv.ups || []).forEach(function (u) { p.ups[u] = true; });
      if (sv.visited) for (var i = 0; i < sv.visited.length && i < p.visited.length; i++) p.visited[i] = sv.visited[i] ? 1 : 0;
      p.anvil = sv.anvil != null && W.anvils[sv.anvil] ? sv.anvil : W.start.anvil;
      p.hpMax = sv.hpMax || 5; p.tanks = sv.tanks || 2;
      S.time = sv.time || 0; S.deaths = sv.deaths || 0;
    }
    function snapshot() {
      var p = S.prog, keys = function (o) { return Object.keys(o).filter(function (k) { return o[k]; }); };
      return { v: P.SAVE_VERSION || 2, time: Math.round(S.time * 10) / 10, deaths: S.deaths, anvil: p.anvil, hpMax: p.hpMax, tanks: p.tanks,
        ab: keys(p.ab), items: keys(p.items).map(Number), forges: keys(p.forges).map(Number), bosses: keys(p.bosses), opened: keys(p.opened).map(Number),
        lifts: keys(p.lifts).map(Number), ups: keys(p.ups), visited: Array.prototype.slice.call(p.visited), pct: percent(), zone: S.zone };
    }
    function percent() {
      var n = 0, tot = W.items.length + W.forges.length;
      for (var k in S.prog.items) if (S.prog.items[k]) n++;
      for (var f in S.prog.forges) if (S.prog.forges[f]) n++;
      return Math.floor(n * 100 / tot);
    }
    function forgesLit() { var n = 0; for (var f in S.prog.forges) if (S.prog.forges[f]) n++; return n; }

    // ---------- комнаты ----------
    function enterRoom(ri, how) {
      var rm = W.rooms[ri];
      var R = { i: ri, W: rm.W, H: rm.H, gx: rm.gx, gy: rm.gy, t: new Uint8Array(rm.t), rings: rm.rings, fWater: rm.fWater, fSteam: rm.fSteam, fHaz: rm.fHaz,
        ens: [], shots: [], eshots: [], drops: [], haz: [], src: rm, dark: rm.dark, kind: rm.kind };
      rm.groups.forEach(function (g) { if (S.prog.opened[g]) openTiles(R, g); });
      if (forgesLit() >= 5) rm.groups.forEach(function (g) { if (W.groups[g].kind === T.SEAL) openTiles(R, g); });
      if (!opts.noEnemies && rm.kind !== 'arena') rm.ens.forEach(function (d) { R.ens.push(EN.make(d, rng)); });
      S.R = R; S.room = ri; S.boss = null;
      if (!S.prog.visited[ri]) { S.prog.visited[ri] = 1; ev('newRoom', { room: ri }); }
      if (rm.zone !== S.zone) { S.zone = rm.zone; ev('zone', { zone: rm.zone, id: W.zones[rm.zone].id }); }
      ev('room', { room: ri, how: how });
    }
    function openTiles(R, g) { var G = W.groups[g], wet = R.src.wet; G.cells.forEach(function (p) { R.t[p[1] * R.W + p[0]] = wet ? T.WATER : T.AIR; }); P.phys.roomFlags(R); R.rev = (R.rev || 0) + 1; }
    function openGroup(g, why) {
      if (S.prog.opened[g]) return; S.prog.opened[g] = true;
      var G = W.groups[g]; if (S.R && G.room === S.R.i) openTiles(S.R, g);
      ev('open', { kind: G.kind, g: g, why: why, x: G.cells[0][0] + 0.5, y: G.cells[0][1] + 0.5 });
    }
    function tileAt(c, r) { return ph.tile(S.R, c, r); }
    function solid(c, r) { var k = tileAt(c, r); return P.SOLID[k] || k === T.STEAM; }
    function solidE(c, r) { var k = tileAt(c, r); return P.SOLID[k] || k === T.ONE || k === T.STEAM; }   // для врагов мостки — пол
    function water(c, r) { return ph.isWater(tileAt(c, r)); }
    function los(x0, y0, x1, y1) { var dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.sqrt(dx * dx + dy * dy) * 2); for (var i = 1; i < n; i++) { if (solid(Math.floor(x0 + dx * i / n), Math.floor(y0 + dy * i / n))) return false; } return true; }

    function start() {
      if (opts.save) applySave(opts.save);
      var a = W.anvils[S.prog.anvil];
      S.hero = ph.newHero(a.x, a.y);
      enterRoom(a.room, 'start');
      S.hp = S.prog.hpMax; S.spark = S.prog.tanks; S.phase = 'play';
      S.lastAnvilRoom = a.room;
      ev('start', { fresh: !opts.save });
      return api;
    }

    // ---------- урон и смерть ----------
    function hurt(n, why, fromX) {
      if (S.phase !== 'play') return;
      if (why !== 'heat' && S.inv > 0) return;
      if (opts.god) { ev('hurtGod', { why: why }); return; }
      var h = S.hero;
      S.hp -= n * (opts.dmgMul == null ? 1 : opts.dmgMul); S.inv = 1.0;
      if (why !== 'heat' && why !== 'spike') { h.hook = null; h.slam = false; h.dashT = 0; h.vx = (h.x >= (fromX == null ? h.x - h.face : fromX) ? 1 : -1) * 8; h.vy = -9; h.cling = 0; h.ground = false; }
      ev('hurt', { why: why, x: h.x, y: h.y, hp: S.hp });
      if (S.hp <= 0) { S.hp = 0; S.phase = 'dead'; S.deadT = 1.6; S.deaths++; ev('die', { why: why, x: h.x, y: h.y }); }
    }
    function respawn() {
      var a = W.anvils[S.prog.anvil];
      S.hero = ph.newHero(a.x, a.y); enterRoom(a.room, 'respawn');
      S.hp = S.prog.hpMax; S.spark = S.prog.tanks; S.inv = 1.2; S.phase = 'play'; S.chargeT = 0;
      ev('respawn', {});
    }

    // ---------- выстрелы ----------
    function fire(big) {
      var h = S.hero, up = inp.y < 0 && !big ? true : inp.y < 0, ox = h.x + h.face * 0.55, oy = h.y - 0.95;
      var sp = 22, list = [];
      if (big) { list.push({ vx: up ? 0 : h.face * 17, vy: up ? -17 : 0 }); }
      else if (S.prog.ups.spread) { [-0.2, 0, 0.2].forEach(function (a) { list.push(up ? { vx: Math.sin(a) * sp, vy: -Math.cos(a) * sp } : { vx: Math.cos(a) * sp * h.face, vy: Math.sin(a) * sp }); }); }
      else list.push({ vx: up ? 0 : h.face * sp, vy: up ? -sp : 0 });
      list.forEach(function (v) {
        S.R.shots.push({ x: up ? h.x : ox, y: up ? h.y - 1.8 : oy, vx: v.vx, vy: v.vy, life: big ? 1.0 : 0.7, dmg: big ? (S.prog.ups.charge ? 6 : 4) : (S.prog.ups.spread ? 0.7 : 1),
          big: !!big, pierce: !!S.prog.ups.pierce || !!big, hit: {} });
      });
      ev(big ? 'bigShot' : 'shot', { x: ox, y: oy, up: up });
    }
    function chargeNeed() { return S.prog.ups.charge ? 0.45 : 0.75; }

    // ---------- шаг ----------
    function update(dt) {
      dt = dt || DT;
      S.t += dt;
      if (S.phase === 'dead') { S.deadT -= dt; if (S.deadT <= 0) respawn(); return; }
      if (S.phase !== 'play') return;
      S.time += dt;
      var h = S.hero, R = S.R, ab = S.prog.ab;
      if (S.inv > 0) S.inv -= dt; if (S.shootCd > 0) S.shootCd -= dt; if (S.heatCd > 0) S.heatCd -= dt;
      // ввод: выстрел/заряд/удар молотом
      var shootE = inp.shoot && !prevShoot, shootR = !inp.shoot && prevShoot; prevShoot = !!inp.shoot;
      var upE = inp.y < 0 && !prevUp; prevUp = inp.y < 0;
      var slam = false;
      if (shootE && ab.hammer && !h.ground && inp.y > 0 && !h.wet && !h.hook) slam = true;
      else if (shootE && !h.hook && !slam) { if (S.shootCd <= 0) { fire(false); S.shootCd = S.prog.ups.rapid ? 0.12 : 0.24; } S.charging = true; S.chargeT = 0; }
      if (S.charging && inp.shoot) { var was = S.chargeT; S.chargeT += dt; if (was < chargeNeed() && S.chargeT >= chargeNeed() && S.spark >= 1) ev('charged', {}); }
      if (shootR && S.charging) { if (S.chargeT >= chargeNeed() && S.spark >= 1) { S.spark -= 1; fire(true); } S.charging = false; S.chargeT = 0; }
      // физика героини
      var pin = { x: inp.x || 0, y: inp.y || 0, jump: !!inp.jump, dash: !!inp.dash, hook: !!inp.hook, slam: slam };
      ph.stepHero(h, pin, R, dt, ab, physEv);
      // переход между комнатами
      var nr = P.cross(W, S.room, h);
      if (nr !== S.room) { enterRoom(nr, 'door'); R = S.R; }
      if (h.y > R.H + 4 || h.x < -3 || h.x > R.W + 3) { h.x = S.safe ? S.safe.x : W.anvils[S.prog.anvil].x; h.y = S.safe ? S.safe.y : W.anvils[S.prog.anvil].y; h.vx = h.vy = 0; }
      // опасности клеток
      if (h.hit === 'spike') { hurt(1, 'spike'); if (S.phase === 'play' && S.safe) { h.x = S.safe.x; h.y = S.safe.y; h.vx = 0; h.vy = 0; h.hook = null; h.dashT = 0; h.slam = false; ev('back', {}); } }
      else if (h.hit === 'heat' && S.heatCd <= 0) { S.heatCd = 0.4; hurt(1, 'heat'); }
      if (h.ground && !h.hit && R.t[Math.round(h.y) * R.W + Math.floor(h.x)] !== T.SPIKE && !ph.overlapsKind(R, { x: h.x, y: h.y + 0.6 }, function (k) { return k === T.SPIKE; })) S.safe = { x: h.x, y: h.y };
      // луч фонаря
      S.beam = !!(ab.light && inp.beam);
      if (S.beam) {
        var cx = h.x, cy = h.y - 0.85;
        R.src.groups.forEach(function (g) {
          var G = W.groups[g]; if (G.kind !== T.LIGHT || S.prog.opened[g]) return;
          for (var i = 0; i < G.cells.length; i++) { var dx = G.cells[i][0] + 0.5 - cx, dy = G.cells[i][1] + 0.5 - cy; if (dx * dx + dy * dy < K.LIGHT_R * K.LIGHT_R) { openGroup(g, 'light'); break; } }
        });
      }
      // искра восстанавливается
      S.spark = Math.min(S.prog.tanks, S.spark + dt / 6);
      objects(upE);
      if (S.phase !== 'play') return;
      shots(dt);
      enemies(dt);
      boss(dt);
      hazards(dt);
    }
    function physEv(t, d) {
      if (t === 'slamLand') {
        var h = S.hero, R = S.R, r = Math.round(h.y);
        for (var c = Math.floor(h.x - K.HW); c <= Math.floor(h.x + K.HW); c++) {
          var k = ph.tile(R, c, r);
          if ((k === T.CRACK || k === T.IRON) && c >= 0 && c < R.W) { var g = R.src.gAt[r * R.W + c]; if (g >= 0) openGroup(g, 'hammer'); }
        }
        R.ens.forEach(function (e) { if (!e.dead && Math.abs(e.x - h.x) < 2 && Math.abs(e.y - h.y) < 1.5) damageEnemy(e, 3, h.x); });
        if (S.boss && !S.boss.dead) { var hp = BS.hitPart(S.boss, h.x, h.y - 0.5, 1); if (hp && hp.weak) damageBoss(3); }
        h.ground = false;
      }
      ev(t, d);
    }

    // ---------- объекты комнаты ----------
    function objects(upE) {
      var h = S.hero, R = S.R, rm = R.src; S.near = null;
      // предметы
      rm.items.forEach(function (it) {
        if (S.prog.items[it.id]) return;
        if (it.boss && !S.prog.bosses[it.boss]) return;
        if (Math.abs(h.x - it.x) < 0.9 && h.y > it.y - 2.2 && h.y - K.HH < it.y + 0.2) collect(it);
      });
      rm.objs.forEach(function (o) {
        var near = Math.abs(h.x - o.x) < 1.6 && Math.abs(h.y - o.y) < 1.2;
        if (!near) return;
        if (o.type === 'anvil') { S.near = 'anvil'; if (upE && h.ground) { S.prog.anvil = o.id; S.hp = S.prog.hpMax; S.spark = S.prog.tanks; S.lastAnvilRoom = R.i; ev('save', { data: snapshot(), anvil: o.id }); } }
        else if (o.type === 'lift') {
          if (!S.prog.lifts[o.id]) { S.prog.lifts[o.id] = true; ev('liftOn', { id: o.id }); }
          S.near = 'lift'; if (upE && h.ground) { var L = liftList(); S.liftSel = Math.max(0, L.indexOf(o.id)); S.phase = 'lift'; ev('liftMenu', {}); }
        } else if (o.type === 'forge') {
          if (!S.prog.forges[o.fid]) { S.near = 'forge'; if (upE || Math.abs(h.x - o.x) < 1) lightForge(o.fid); }
        } else if (o.type === 'heart') {
          if (S.prog.bosses.scale) { S.phase = 'won'; ev('win', { time: S.time, pct: percent(), deaths: S.deaths }); }
        }
      });
    }
    function lightForge(fid) {
      S.prog.forges[fid] = true; var n = forgesLit();
      ev('forge', { id: fid, n: n });
      if (n >= 5) { W.groups.forEach(function (G) { if (G.kind === T.SEAL) { S.prog.opened[G.id] = true; if (S.R && G.room === S.R.i) openTiles(S.R, G.id); } }); ev('sealOpen', {}); }
    }
    function collect(it) {
      S.prog.items[it.id] = true; var p = S.prog;
      if (it.type.indexOf('ab:') === 0) { p.ab[it.type.slice(3)] = true; ev('ability', { ab: it.type.slice(3), x: it.x, y: it.y }); }
      else if (it.type === 'vessel') { p.hpMax += 1; S.hp = p.hpMax; ev('vessel', { n: p.hpMax, x: it.x, y: it.y }); }
      else if (it.type === 'tank') { p.tanks += 1; S.spark = p.tanks; ev('tank', { n: p.tanks, x: it.x, y: it.y }); }
      else if (it.type.indexOf('up:') === 0) { p.ups[it.type.slice(3)] = true; ev('upgrade', { up: it.type.slice(3), x: it.x, y: it.y }); }
      ev('item', { type: it.type, pct: percent() });
    }
    function liftList() { return W.lifts.filter(function (l) { return S.prog.lifts[l.id]; }).map(function (l) { return l.id; }); }

    // ---------- снаряды ----------
    function shots(dt) {
      var R = S.R, h = S.hero;
      R.shots = R.shots.filter(function (s) {
        s.life -= dt; if (s.life <= 0) return false;
        s.x += s.vx * dt; s.y += s.vy * dt;
        var c = Math.floor(s.x), r = Math.floor(s.y), k = ph.tile(R, c, r);
        if (k === T.FALSE) { var g = R.src.gAt[r * R.W + c]; if (g >= 0) openGroup(g, 'shot'); ev('hitWall', { x: s.x, y: s.y }); return false; }
        if (P.SOLID[k]) { ev('hitWall', { x: s.x, y: s.y }); return false; }
        for (var i = 0; i < R.ens.length; i++) {
          var e = R.ens[i]; if (e.dead || s.hit[i]) continue;
          if (e.type === 'icicle' && e.st === 'gone') continue;
          var b = EN.box(e);
          if (s.x > b.x0 - 0.15 && s.x < b.x1 + 0.15 && s.y > b.y0 - 0.15 && s.y < b.y1 + 0.15) {
            if (EN.blocks(e, s)) { ev('clang', { x: s.x, y: s.y }); return false; }
            damageEnemy(e, s.dmg, s.x - s.vx); s.hit[i] = 1;
            if (!s.pierce) return false;
          }
        }
        for (var j = 0; j < R.eshots.length; j++) { var q = R.eshots[j]; if (q.hp && Math.abs(q.x - s.x) < 0.6 && Math.abs(q.y - s.y) < 0.6) { q.life = 0; ev('pop', { x: q.x, y: q.y }); if (!s.pierce) return false; } }
        if (S.boss && !S.boss.dead && S.boss.st !== 'intro' && !s.hitBoss) {
          var hp = BS.hitPart(S.boss, s.x, s.y, 0.2);
          if (hp) { s.hitBoss = 1; if (hp.weak) damageBoss(s.dmg); else ev('clang', { x: s.x, y: s.y }); return false; }
        }
        return true;
      });
      // вражеские снаряды
      R.eshots = R.eshots.filter(function (q) {
        q.life -= dt; if (q.life <= 0) return false;
        if (q.g) q.vy += (q.gk || 24) * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (P.SOLID[ph.tile(R, Math.floor(q.x), Math.floor(q.y))]) { ev('splat', { x: q.x, y: q.y, kind: q.kind }); return false; }
        if (Math.abs(q.x - h.x) < K.HW + 0.3 && q.y > h.y - K.HH - 0.2 && q.y < h.y + 0.2) { hurt(1, 'shot', q.x); return false; }
        return true;
      });
      R.drops = R.drops.filter(function (d) {
        d.t += dt; if (d.t > 8) return false;
        if (!solidE(Math.floor(d.x), Math.floor(d.y + 0.1))) d.y += 6 * dt;
        if (Math.abs(d.x - h.x) < 0.9 && d.y > h.y - K.HH - 0.4 && d.y < h.y + 0.5) {
          if (d.kind === 'hp') S.hp = Math.min(S.prog.hpMax, S.hp + 1); else S.spark = Math.min(S.prog.tanks, S.spark + 1);
          ev('pickup', { kind: d.kind }); return false;
        }
        return true;
      });
    }
    function damageEnemy(e, n, fromX) {
      if (e.dead) return;
      e.hp -= n; e.flash = 0.15;
      if (e.type !== 'turret' && e.type !== 'vine' && e.type !== 'icicle') e.x += (e.x > fromX ? 1 : -1) * 0.15;
      if (e.hp <= 0) {
        if (e.type === 'icicle') { e.st = 'gone'; e.t = 0; ev('shatter', { x: e.x, y: e.y }); return; }
        e.dead = true; S.kills++; ev('kill', { x: e.x, y: e.y - e.h / 2, type: e.type });
        if (rng() < 0.35) S.R.drops.push({ x: e.x, y: e.y - 0.3, kind: rng() < 0.55 ? 'hp' : 'spark', t: 0 });
      } else ev('hit', { x: e.x, y: e.y - e.h / 2 });
    }
    var G = {
      get hero() { return S.hero; }, get R() { return S.R; }, rng: rng,
      solid: function (c, r) { return solidE(c, r); }, water: water, los: los,
      shot: function (x, y, vx, vy, o) { S.R.eshots.push(Object.assign({ x: x, y: y, vx: vx, vy: vy, life: 3, kind: 'soot' }, o || {})); },
      haz: function (o) { S.R.haz.push(Object.assign({ vx: 0, vy: 0, life: 1, warn: 0, t: 0 }, o)); },
      spawn: function (type, x, y) { if (S.R.ens.length < 14) S.R.ens.push(EN.make({ type: type, x: x, y: y }, rng)); },
      ev: ev
    };
    function enemies(dt) {
      var R = S.R, h = S.hero;
      for (var i = 0; i < R.ens.length; i++) {
        var e = R.ens[i]; if (e.dead) continue;
        EN.update(e, G, dt);
        if (e.type === 'icicle' && e.st === 'gone') continue;
        var b = EN.box(e);
        if (h.x + K.HW > b.x0 && h.x - K.HW < b.x1 && h.y > b.y0 && h.y - K.HH < b.y1) {
          if (h.slam && h.y < b.y1) { damageEnemy(e, 3, h.x); continue; }
          hurt(e.dmg, 'enemy', e.x);
          if (e.type === 'icicle' && e.st === 'fall') { e.st = 'gone'; e.t = 0; }
        }
      }
      if (R.ens.length > 20) R.ens = R.ens.filter(function (e) { return !e.dead; });
    }

    // ---------- босс ----------
    function bossId() { var o = S.R.src.objs.filter(function (x) { return x.type === 'boss'; })[0]; return o ? o.boss : null; }
    function setShut(on) {
      var R = S.R; R.src.doors.forEach(function (d) {
        if (d.side !== 'L' && d.side !== 'R') return; var col = d.side === 'L' ? 0 : R.W - 1;
        for (var r = d.k * 22 + 16; r <= d.k * 22 + 18; r++) R.t[r * R.W + col] = on ? T.SHUT : T.AIR;
      });
      R.rev = (R.rev || 0) + 1;
    }
    function startBoss() {
      var id = bossId(); if (!id || S.prog.bosses[id]) return;
      S.boss = BS.make(id, S.R); setShut(true);
      ev('bossStart', { id: id });
    }
    function boss(dt) {
      var R = S.R, h = S.hero;
      if (R.kind !== 'arena') return;
      var id = bossId();
      if (!S.boss && id && !S.prog.bosses[id] && h.x > 4.5 && h.x < R.W - 4.5) startBoss();
      var B = S.boss; if (!B || B.dead) return;
      BS.update(B, G, dt);
      if (B.st !== 'intro') for (var i = 0; i < B.parts.length; i++) {
        var p = B.parts[i];
        if (Math.abs(h.x - p.x) < p.w / 2 + K.HW && h.y > p.y - p.h / 2 && h.y - K.HH < p.y + p.h / 2) { hurt(1, 'boss', p.x); break; }
      }
    }
    function damageBoss(n) {
      var B = S.boss; if (!B || B.dead || B.st === 'intro' || B.st === 'shed') return;
      B.hp -= n; B.flash = 0.12; ev('bossHit', { hp: B.hp, max: B.max });
      if (B.hp <= 0) {
        B.hp = 0; B.dead = true; S.prog.bosses[B.id] = true; setShut(false); S.R.eshots = []; S.R.haz = [];
        S.R.ens.forEach(function (e) { if (e.type === 'spark') e.dead = true; });
        ev('bossDown', { id: B.id, x: B.parts[0].x, y: B.parts[0].y });
      }
    }
    function hazards(dt) {
      var R = S.R, h = S.hero;
      R.haz = R.haz.filter(function (z) {
        z.t += dt;
        if (z.t < z.warn) return true;
        z.life -= dt; if (z.life <= 0) return false;
        z.x0 += z.vx * dt; z.x1 += z.vx * dt; if (z.vy) { z.y0 += z.vy * dt; z.y1 += z.vy * dt; }
        if (z.x1 < 0 || z.x0 > R.W || z.y0 > R.H) return false;
        if (z.vy && solid(Math.floor((z.x0 + z.x1) / 2), Math.floor(z.y1))) { ev('splat', { x: (z.x0 + z.x1) / 2, y: z.y1, kind: z.kind }); return false; }
        if (h.x + K.HW > z.x0 && h.x - K.HW < z.x1 && h.y > z.y0 && h.y - K.HH < z.y1) hurt(1, 'haz', (z.x0 + z.x1) / 2);
        return true;
      });
    }

    // ---------- лифты ----------
    function liftMove(d) { var L = liftList(); if (!L.length) return; S.liftSel = (S.liftSel + d + L.length) % L.length; ev('liftSel', {}); }
    function liftGo() {
      var L = liftList(), id = L[S.liftSel]; if (id == null) { S.phase = 'play'; return; }
      var l = W.lifts[id]; S.hero = ph.newHero(l.x, l.y); enterRoom(l.room, 'lift'); S.phase = 'play'; ev('travel', { id: id });
    }
    function liftCancel() { if (S.phase === 'lift') { S.phase = 'play'; ev('liftClose', {}); } }

    var api = {
      start: start, update: update, state: function () { return S; }, snapshot: snapshot, percent: percent, forgesLit: forgesLit,
      setInput: function (o) { inp = o || {}; }, liftMove: liftMove, liftGo: liftGo, liftCancel: liftCancel, liftList: liftList,
      // тестовые хуки
      _place: function (ri, x, y) { if (ri !== S.room) enterRoom(ri, 'test'); S.hero = ph.newHero(x, y); S.hero.ground = false; S.safe = { x: x, y: y }; },
      _give: function () { for (var i = 0; i < arguments.length; i++) S.prog.ab[arguments[i]] = true; },
      _enter: function (ri) { enterRoom(ri, 'test'); }, _bossNow: function () { startBoss(); return S.boss; },
      _hurt: hurt, _open: openGroup, _forge: lightForge
    };
    return api;
  }
  P.Game = Game;
  P.pctOf = function (S) {
    var n = 0, tot = S.W.items.length + S.W.forges.length;
    for (var k in S.prog.items) if (S.prog.items[k]) n++;
    for (var f in S.prog.forges) if (S.prog.forges[f]) n++;
    return Math.floor(n * 100 / tot);
  };
})(typeof window !== 'undefined' ? window : globalThis);
