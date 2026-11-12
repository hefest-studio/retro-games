/* ============================================================================
   КЛАДКА · движок логики (без DOM, детерминированный при заданном rng)
   Жанр — разбивание блоков: мастерок (платформа) внизу отбивает ядро (мяч)
   в стену кладки. Блоки разной прочности, чугунные — неразрушимы. Из блоков
   выпадают слитки-бонусы. 10 уровней (ASCII-карты ниже), на 10-м — «Плавильня»:
   сердце печи под потолком, по которому надо попадать ядром; печь плюётся искрами.
   Интерфейс — CONTRACT.md.
   ========================================================================== */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};

  // ---------- Геометрия поля (px канвы 480×640) ----------
  var W = 480, H = 640;
  var FX0 = 16, FX1 = 464, FY0 = 52;          // внутренние грани стен и потолка
  var COLS = 14, BW = 32, BH = 16, BY0 = 84;   // сетка кладки: 14 × 32 px
  var PADDLE_Y = 596, PADDLE_H = 12, BALL_R = 5;
  var PW_BASE = 72, PW_WIDE = 108, PW_NARROW = 46;
  var MAX_LEVEL = 10, MAX_LIVES = 5, MAX_BALLS = 8;
  var MAX_ANGLE = 62 * Math.PI / 180;          // крайний угол отскока от края мастерка
  var MIN_VY = 0.3;                            // доля скорости по вертикали — без «вечных горизонталей»
  var KEY_SPEED = 560, PTR_SPEED = 1700;       // px/с: клавиши / мышь-палец
  var DRAFT_LEFT = 5, DRAFT_AFTER = 4, DRAFT_TURN = 0.9; // «тяга печи»: ≤5 блоков и 4 с без разбитых — ядро тянет к кладке
  var BOLT_SPEED = 640, CAP_SPEED = 115, CAP_W = 26, CAP_H = 12;

  // Слитки-бонусы: t — длительность, w — вес выпадения
  var POWERS = {
    wide:   { t: 15, w: 20 },   // РАЗМАХ — мастерок шире
    narrow: { t: 12, w: 11 },   // ТЕСНОТА — уже (подвох)
    triple: { t: 0,  w: 17 },   // ТРОЙНЯ — каждое ядро делится на три
    glue:   { t: 15, w: 13 },   // СМОЛА — ядро прилипает, пуск по пробелу
    cutter: { t: 11, w: 14 },   // РЕЗАК — пара лучей по пробелу
    chill:  { t: 10, w: 15 },   // ОСТУДА — ядро медленнее
    life:   { t: 0,  w: 3 }     // ЗАПАС — +1 жизнь
  };
  var POWER_KEYS = ['wide', 'narrow', 'triple', 'glue', 'cutter', 'chill', 'life'];

  // ---------- Уровни: 14 символов в строке ----------
  // . пусто · a–f обычный блок (цвет) · + блок-«подарок» (всегда слиток)
  // 2 / 3 — прочный блок на 2 / 3 удара · # — чугун (неразрушим)
  var LEVELS = [
    { name: 'base', map: [
      '..............',
      '.aaaaaaaaaaaa.',
      '.bbbbbbbbbbbb.',
      '.cccc++++cccc.',
      '.dddd....dddd.',
      '.eeee....eeee.',
      '.ffffffffffff.'] },
    { name: 'arch', map: [
      '......ff......',
      '....ffeeff....',
      '...feeddeef...',
      '..fedc++cdef..',
      '..fed....def..',
      '..fed....def..',
      '..2ed....de2..',
      '..22......22..'] },
    { name: 'checker', map: [
      '..............',
      'a.b.c.d.e.f.a.',
      '.2.2.2.2.2.2.2',
      'b.c.+.e.f.a.b.',
      '.2.2.2.2.2.2.2',
      'c.d.e.f.+.b.c.',
      '.d.e.f.a.b.c.d'] },
    { name: 'gates', map: [
      '..............',
      '#aaaaa..aaaaa#',
      '#bbbbb..bbbbb#',
      '#22222..22222#',
      '#ccccc++ccccc#',
      '#ddddd..ddddd#',
      '#............#',
      '#eeeeeeeeeeee#'] },
    { name: 'flue', map: [
      '.##.##..##.##.',
      '.ff.ff..ff.ff.',
      '.33.22..22.33.',
      '.ee.ee..ee.ee.',
      '.dd.dd..dd.dd.',
      '.cc.cc++cc.cc.',
      '.bb.bb..bb.bb.',
      '.aa.aa..aa.aa.'] },
    { name: 'stairs', map: [
      'a............f',
      'ab..........ef',
      'abc........def',
      '2bcd......cde2',
      '22cde....bcd22',
      '222def++abc222',
      '..............',
      '..aa..33..aa..'] },
    { name: 'grate', map: [
      '..............',
      '.#a#b#cc#b#a#.',
      '.#2#2#22#2#2#.',
      '.#a#b#++#b#a#.',
      '.#3#d#ee#d#3#.',
      '.#a#b#cc#b#a#.',
      '..............',
      'ffffffffffffff'] },
    { name: 'bastion', map: [
      '..............',
      '...#......#...',
      '...#333333#...',
      '...#3+22+3#...',
      '...#333333#...',
      '...#......#...',
      '..............',
      'aabbccddeeffaa',
      '.2.2.2..2.2.2.'] },
    { name: 'hearth', map: [
      '3a3b3c33c3b3a3',
      '..............',
      'ffeeddccddeeff',
      'ff22dd++dd22ff',
      'ee22cc33cc22ee',
      'eeddcc33ccddee',
      '2..2..22..2..2',
      '#.....33.....#',
      'dccbbaaaabbccd'] },
    { name: 'smelter', boss: true, map: [
      '..............',
      '..............',
      '..............',
      '..aabbccbbaa..',
      '#..2..++..2..#',
      '..............',
      '.c..d....d..c.',
      '##..........##'] }
  ];

  function defaultDiff(level, base, step, max) {
    var v = base + (level - 1) * step;
    return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max));
  }

  // Параметры уровня (рост скорости ядра) — через g.difficulty движка
  function params(level, diff) {
    diff = diff || defaultDiff;
    var base = diff(level, 295, 24, 520);
    return {
      speed: base,                       // стартовая скорость ядра, px/с
      maxSpeed: base * diff(level, 1.45, 0.025, 1.68), // потолок разгона: ×1.45 → ×1.67
      gain: diff(level, 3, 0.2, 5),      // +px/с за каждый удар по блоку
      drop: 0.15,                        // шанс слитка из обычного блока
      bossHp: 30
    };
  }

  function parseMap(rows) {
    var bricks = [];
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].length !== COLS) throw new Error('КЛАДКА: строка ' + r + ' карты длиной ' + rows[r].length + ' (нужно ' + COLS + ')');
      for (var c = 0; c < COLS; c++) {
        var ch = rows[r][c]; if (ch === '.') continue;
        var b = { c: c, r: r, x: FX0 + c * BW, y: BY0 + r * BH, w: BW, h: BH, hp: 1, max: 1, iron: false, gift: false, tone: 0, flash: 0 };
        if (ch === '#') { b.iron = true; b.hp = b.max = Infinity; }
        else if (ch === '2' || ch === '3') { b.hp = b.max = +ch; }
        else if (ch === '+') { b.gift = true; }
        else if (ch >= 'a' && ch <= 'f') { b.tone = ch.charCodeAt(0) - 97; }
        else throw new Error('КЛАДКА: неизвестный символ карты «' + ch + '»');
        bricks.push(b);
      }
    }
    return bricks;
  }

  // Отскок от мастерка: угол зависит от точки удара (центр — вверх, края — до 62°)
  function paddleBounce(bx, px, w, sp) {
    var rel = Math.max(-1, Math.min(1, (bx - px) / (w / 2)));
    var a = rel * MAX_ANGLE;
    return { vx: sp * Math.sin(a), vy: -sp * Math.cos(a), rel: rel };
  }

  // Пересечение круга с прямоугольником
  function circleRect(x, y, r, o) {
    var cx = Math.max(o.x, Math.min(x, o.x + o.w)), cy = Math.max(o.y, Math.min(y, o.y + o.h));
    var dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy < r * r;
  }

  // Ось отражения: по положению центра до шага (px,py) относительно прямоугольника
  function hitAxis(px, py, vx, vy, o) {
    var inX = px >= o.x && px <= o.x + o.w, inY = py >= o.y && py <= o.y + o.h;
    if (inX && !inY) return 'y';
    if (inY && !inX) return 'x';
    // угол: какая грань «ближе» по времени входа
    var tx = vx > 0 ? (o.x - px) / vx : vx < 0 ? (o.x + o.w - px) / vx : -Infinity;
    var ty = vy > 0 ? (o.y - py) / vy : vy < 0 ? (o.y + o.h - py) / vy : -Infinity;
    return tx > ty ? 'x' : 'y';
  }

  function clampVy(b, sp) {
    var m = Math.hypot(b.vx, b.vy) || 1; b.vx = b.vx / m * sp; b.vy = b.vy / m * sp;
    if (Math.abs(b.vy) < sp * MIN_VY) {
      var sy = b.vy < 0 ? -1 : 1, sx = b.vx < 0 ? -1 : 1;
      b.vy = sy * sp * MIN_VY; b.vx = sx * sp * Math.sqrt(1 - MIN_VY * MIN_VY);
    }
  }

  function Game(opts) {
    opts = opts || {};
    var rng = opts.rng || Math.random, emit = opts.onEvent || function () {};
    var diff = opts.difficulty || null;
    var S = {
      level: opts.level || 1, maxLevel: opts.maxLevel || MAX_LEVEL, lives: opts.lives == null ? 3 : opts.lives,
      score: 0, phase: 'play', phaseT: 0, time: 0, over: false, won: false,
      paddle: { x: W / 2, w: PW_BASE, stun: 0, hitT: 0 },
      balls: [], bricks: [], grid: [], left: 0, caps: [], bolts: [], sparks: [], boss: null,
      pow: { wide: 0, narrow: 0, glue: 0, cutter: 0, chill: 0 },
      speed: 0, prm: null, sinceTouch: 0, sinceBreak: 0, draft: false, banner: 0, name: '', boltCd: 0, served: false, clearBonus: 0
    };
    var dirX = 0, target = null, fireHeld = false;

    function ev(t, d) { emit(t, d || {}); }

    function loadLevel() {
      var L = LEVELS[(S.level - 1) % LEVELS.length];
      S.prm = params(S.level, diff); S.speed = S.prm.speed; S.name = L.name;
      S.bricks = parseMap(L.map); S.grid = new Array(COLS * 24);
      S.left = 0;
      for (var i = 0; i < S.bricks.length; i++) { var b = S.bricks[i]; S.grid[b.r * COLS + b.c] = b; if (!b.iron) S.left++; }
      S.caps = []; S.bolts = []; S.sparks = [];
      S.boss = L.boss ? { x: W / 2, y: FY0, w: 104, h: 62, hp: S.prm.bossHp, max: S.prm.bossHp, vx: 50, fireT: 2.6, mouth: 0, flash: 0, hitCd: 0, aim: W / 2 } : null;
      S.banner = 1.8; S.sinceBreak = 0; S.draft = false; resetPowers(); serve();
    }
    function resetPowers() { for (var k in S.pow) S.pow[k] = 0; S.paddle.stun = 0; }
    function serve() {
      S.balls = [{ x: S.paddle.x, y: PADDLE_Y - BALL_R - 0.5, vx: 0, vy: 0, stuck: true, off: (rng() - 0.5) * 0.5 * (S.paddle.w / 2), stuckT: 0, serve: true }];
      S.sinceTouch = 0; S.served = false;
    }

    function sp() { return S.pow.chill > 0 ? Math.max(S.prm.speed * 0.72, S.speed * 0.7) : S.speed; }

    function release(b) {
      var v = paddleBounce(S.paddle.x + b.off, S.paddle.x, S.paddle.w, sp());
      b.vx = v.vx; b.vy = v.vy; b.stuck = false; b.y = PADDLE_Y - BALL_R - 1;
      if (b.serve) { b.serve = false; S.served = true; ev('launch'); } else ev('unstick');
    }

    function addScore(n) { S.score += Math.round(n); }

    function dropCap(b) {
      var tot = 0, ws = [];
      for (var i = 0; i < POWER_KEYS.length; i++) {
        var k = POWER_KEYS[i], w = POWERS[k].w;
        if (k === 'life' && S.lives >= MAX_LIVES) w = 0;
        if (k === 'triple' && S.balls.length >= 4) w = 0;
        ws.push(w); tot += w;
      }
      var r = rng() * tot, kind = 'wide';
      for (var j = 0; j < ws.length; j++) { r -= ws[j]; if (r < 0) { kind = POWER_KEYS[j]; break; } }
      S.caps.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, kind: kind, t: 0 });
      ev('drop', { kind: kind });
    }

    function damage(b, byBolt) {
      if (b.iron) { b.flash = 0.15; ev('iron', { x: b.x + b.w / 2, y: b.y + b.h / 2 }); return; }
      b.hp--; b.flash = 0.15;
      S.speed = Math.min(S.prm.maxSpeed, S.speed + S.prm.gain * (byBolt ? 0.3 : 1));
      if (b.hp > 0) { addScore(5 * S.level); ev('hit', { x: b.x + b.w / 2, y: b.y + b.h / 2, hp: b.hp }); return; }
      S.grid[b.r * COLS + b.c] = null; b.dead = true; S.left--; S.sinceBreak = 0;
      addScore(10 * b.max * (1 + 0.1 * (S.level - 1)));
      ev('break', { x: b.x + b.w / 2, y: b.y + b.h / 2, tone: b.tone, max: b.max, gift: b.gift });
      if (b.gift || rng() < S.prm.drop) dropCap(b);
    }

    function brickAt(c, r) { if (c < 0 || c >= COLS || r < 0) return null; return S.grid[r * COLS + c] || null; }

    // Блок, с которым пересекается ядро (самый глубокий)
    function touchBrick(x, y) {
      var c0 = Math.floor((x - BALL_R - FX0) / BW), c1 = Math.floor((x + BALL_R - FX0) / BW);
      var r0 = Math.floor((y - BALL_R - BY0) / BH), r1 = Math.floor((y + BALL_R - BY0) / BH);
      var best = null, bd = 1e9;
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
        var b = brickAt(c, r); if (!b || !circleRect(x, y, BALL_R, b)) continue;
        var dx = x - (b.x + b.w / 2), dy = y - (b.y + b.h / 2), d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }

    function moveBall(b, dt) {
      var s = sp(), n = Math.max(1, Math.ceil(s * dt / 3)), h = dt / n;
      clampVy(b, s);
      for (var i = 0; i < n; i++) {
        var px = b.x, py = b.y;
        b.x += b.vx * h; b.y += b.vy * h;
        // стены и потолок
        if (b.x - BALL_R < FX0) { b.x = FX0 + BALL_R; b.vx = Math.abs(b.vx); ev('wall'); }
        else if (b.x + BALL_R > FX1) { b.x = FX1 - BALL_R; b.vx = -Math.abs(b.vx); ev('wall'); }
        if (b.y - BALL_R < FY0) { b.y = FY0 + BALL_R; b.vy = Math.abs(b.vy); ev('wall'); }
        // блоки
        var k = touchBrick(b.x, b.y);
        if (k) {
          var ax = hitAxis(px, py, b.vx, b.vy, k);
          if (ax === 'x') { b.vx = px < k.x + k.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x = px; }
          else { b.vy = py < k.y + k.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y = py; }
          damage(k, false); clampVy(b, s);
        }
        // сердце Плавильни
        var B = S.boss;
        if (B && B.hp > 0 && circleRect(b.x, b.y, BALL_R, { x: B.x - B.w / 2, y: B.y, w: B.w, h: B.h })) {
          var rect = { x: B.x - B.w / 2, y: B.y, w: B.w, h: B.h };
          var a2 = py > rect.y + rect.h ? 'y' : hitAxis(px, py, b.vx, b.vy, rect);
          if (a2 === 'y') { b.vy = Math.abs(b.vy); b.y = rect.y + rect.h + BALL_R + 0.5; }
          else {
            var left = b.x < B.x, nx = left ? rect.x - BALL_R - 0.5 : rect.x + rect.w + BALL_R + 0.5;
            if (nx - BALL_R < FX0 || nx + BALL_R > FX1) { b.vy = Math.abs(b.vy); b.y = rect.y + rect.h + BALL_R + 0.5; }
            else { b.x = nx; b.vx = left ? -Math.abs(b.vx) : Math.abs(b.vx); }
          }
          clampVy(b, s);
          if (B.hitCd <= 0) {
            B.hp--; B.flash = 0.25; B.hitCd = 0.15; addScore(100);
            if (B.hp <= 0) { addScore(3000); ev('bossDie', { x: B.x, y: B.y + B.h / 2 }); }
            else ev('bossHit', { x: b.x, y: b.y, hp: B.hp });
          }
        }
        // мастерок
        var P = S.paddle;
        if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && py + BALL_R <= PADDLE_Y + 6 && Math.abs(b.x - P.x) <= P.w / 2 + BALL_R) {
          var v = paddleBounce(b.x, P.x, P.w, s);
          b.vx = v.vx; b.vy = v.vy; b.y = PADDLE_Y - BALL_R;
          S.sinceTouch = 0; P.hitT = 0.12;
          if (S.pow.glue > 0) { b.stuck = true; b.off = b.x - P.x; b.stuckT = 0; ev('stick'); return; }
          ev('paddle', { rel: v.rel });
        }
        if (b.y - BALL_R > H) { b.lost = true; return; }
      }
    }

    function draft(b, dt) {
      if (b.stuck || b.vy >= 0) return;
      var best = null, bd = 1e12;
      for (var i = 0; i < S.bricks.length; i++) {
        var k = S.bricks[i]; if (k.dead || k.iron) continue;
        var dx = k.x + k.w / 2 - b.x, dy = k.y + k.h / 2 - b.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      }
      if (!best) return;
      var want = Math.atan2(best.y + best.h / 2 - b.y, best.x + best.w / 2 - b.x), cur = Math.atan2(b.vy, b.vx);
      var da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      var turn = Math.max(-DRAFT_TURN * dt, Math.min(DRAFT_TURN * dt, da)), s = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(cur + turn) * s; b.vy = Math.sin(cur + turn) * s;
    }

    function applyPower(kind) {
      var P = S.pow;
      if (kind === 'wide') { P.wide = POWERS.wide.t; P.narrow = 0; }
      else if (kind === 'narrow') { P.narrow = POWERS.narrow.t; P.wide = 0; }
      else if (kind === 'glue') P.glue = POWERS.glue.t;
      else if (kind === 'cutter') P.cutter = POWERS.cutter.t;
      else if (kind === 'chill') P.chill = POWERS.chill.t;
      else if (kind === 'life') S.lives = Math.min(MAX_LIVES, S.lives + 1);
      else if (kind === 'triple') {
        var add = [];
        for (var i = 0; i < S.balls.length; i++) {
          var b = S.balls[i]; if (b.stuck) release(b);
          var a = Math.atan2(b.vy, b.vx);
          for (var k = -1; k <= 1; k += 2) {
            if (S.balls.length + add.length >= MAX_BALLS) break;
            var an = a + k * 0.42, s = sp();
            add.push({ x: b.x, y: b.y, vx: Math.cos(an) * s, vy: Math.sin(an) * s, stuck: false, off: 0, stuckT: 0 });
          }
        }
        S.balls = S.balls.concat(add);
      }
      addScore(50);
      ev('power', { kind: kind });
    }

    function fireBolts() {
      if (S.pow.cutter <= 0 || S.boltCd > 0 || S.phase !== 'play') return false;
      var P = S.paddle;
      S.bolts.push({ x: P.x - P.w / 2 + 6, y: PADDLE_Y - 2 }, { x: P.x + P.w / 2 - 6, y: PADDLE_Y - 2 });
      S.boltCd = 0.3; ev('bolt'); return true;
    }

    function updateBoss(dt) {
      var B = S.boss; if (!B) return;
      B.flash = Math.max(0, B.flash - dt); B.hitCd = Math.max(0, B.hitCd - dt);
      if (B.hp <= 0) return;
      var rage = 1 - B.hp / B.max;
      var vx = (B.vx < 0 ? -1 : 1) * (48 + rage * 70);
      B.x += vx * dt; B.vx = vx;
      var lo = FX0 + B.w / 2 + 8, hi = FX1 - B.w / 2 - 8;
      if (B.x < lo) { B.x = lo; B.vx = Math.abs(B.vx); } if (B.x > hi) { B.x = hi; B.vx = -Math.abs(B.vx); }
      if (!S.served) return;                       // ждёт, пока ядро в игре
      if (B.mouth > 0) {
        B.mouth -= dt;
        if (B.mouth <= 0) {
          var sx = B.x, sy = B.y + B.h - 4, tx = B.aim + (rng() - 0.5) * 50, ty = PADDLE_Y;
          var d = Math.hypot(tx - sx, ty - sy) || 1, v = 175 + rage * 85;
          S.sparks.push({ x: sx, y: sy, vx: (tx - sx) / d * v, vy: (ty - sy) / d * v });
          if (rage >= 0.5) {                        // разъярённая печь — веер из трёх искр
            for (var q = -1; q <= 1; q += 2) { var a = Math.atan2(ty - sy, tx - sx) + q * 0.32; S.sparks.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); }
          }
          ev('spark', { x: sx, y: sy });
        }
      } else {
        B.fireT -= dt;
        if (B.fireT <= 0) { B.mouth = 0.45; B.aim = S.paddle.x; B.fireT = 2.1 - rage * 1.0 + rng() * 0.5; ev('mouth'); }
      }
    }

    function stepPlay(dt) {
      var P = S.paddle;
      for (var k in S.pow) if (S.pow[k] > 0) S.pow[k] = Math.max(0, S.pow[k] - dt);
      S.boltCd = Math.max(0, S.boltCd - dt); P.hitT = Math.max(0, P.hitT - dt);
      if (S.banner > 0) S.banner -= dt;
      // ширина мастерка — плавно к цели
      var tw = S.pow.wide > 0 ? PW_WIDE : S.pow.narrow > 0 ? PW_NARROW : PW_BASE;
      P.w += Math.max(-dt * 160, Math.min(dt * 160, tw - P.w));
      // движение мастерка
      if (P.stun > 0) P.stun -= dt;
      else if (target != null) { var d = target - P.x, m = PTR_SPEED * dt; P.x += Math.max(-m, Math.min(m, d)); }
      else P.x += dirX * KEY_SPEED * dt;
      P.x = Math.max(FX0 + P.w / 2, Math.min(FX1 - P.w / 2, P.x));
      if (fireHeld) fireBolts();
      // ядра
      S.sinceTouch += dt;
      for (var i = 0; i < S.balls.length; i++) {
        var b = S.balls[i];
        if (b.stuck) {
          b.x = P.x + b.off; b.y = PADDLE_Y - BALL_R - 0.5; b.stuckT += dt;
          if (b.stuckT > (b.serve ? 3 : 2)) release(b);
          continue;
        }
        moveBall(b, dt);
      }
      // «тяга печи»: последние блоки долго не поддаются — летящее вверх ядро слегка
      // доворачивает к ближайшему блоку (без телепортов, скорость не меняется)
      S.sinceBreak += dt;
      S.draft = !S.boss && S.left > 0 && S.left <= DRAFT_LEFT && S.sinceBreak > DRAFT_AFTER;
      if (S.draft) for (var dq = 0; dq < S.balls.length; dq++) draft(S.balls[dq], dt);
      // «зацикливание» (ядро долго не касается мастерка) — лёгкий поворот траектории
      if (S.sinceTouch > 9) {
        S.sinceTouch = 5;
        for (var q = 0; q < S.balls.length; q++) {
          var bb = S.balls[q]; if (bb.stuck) continue;
          var an = Math.atan2(bb.vy, bb.vx) + (rng() < 0.5 ? -1 : 1) * (0.18 + rng() * 0.17), s = Math.hypot(bb.vx, bb.vy);
          bb.vx = Math.cos(an) * s; bb.vy = Math.sin(an) * s;
        }
      }
      S.balls = S.balls.filter(function (b) { return !b.lost; });
      for (var f = 0; f < S.bricks.length; f++) if (S.bricks[f].flash > 0) S.bricks[f].flash -= dt;
      // лучи резака
      for (var j = 0; j < S.bolts.length; j++) {
        var o = S.bolts[j]; o.y -= BOLT_SPEED * dt;
        var c = Math.floor((o.x - FX0) / BW), r = Math.floor((o.y - BY0) / BH), hb = r >= 0 ? brickAt(c, r) : null;
        if (hb) { damage(hb, true); o.dead = true; continue; }
        var B = S.boss;
        if (B && B.hp > 0 && o.x > B.x - B.w / 2 && o.x < B.x + B.w / 2 && o.y < B.y + B.h) { o.dead = true; ev('iron', { x: o.x, y: o.y }); continue; }
        if (o.y < FY0) o.dead = true;
      }
      S.bolts = S.bolts.filter(function (o) { return !o.dead; });
      // слитки
      for (var n = 0; n < S.caps.length; n++) {
        var cp = S.caps[n]; cp.y += CAP_SPEED * dt; cp.t += dt;
        if (cp.y + CAP_H / 2 >= PADDLE_Y && cp.y - CAP_H / 2 <= PADDLE_Y + PADDLE_H && Math.abs(cp.x - P.x) <= P.w / 2 + CAP_W / 2) { cp.dead = true; applyPower(cp.kind); }
        else if (cp.y > H + 10) cp.dead = true;
      }
      S.caps = S.caps.filter(function (c2) { return !c2.dead; });
      // босс и искры
      updateBoss(dt);
      for (var z = 0; z < S.sparks.length; z++) {
        var sk = S.sparks[z]; sk.x += sk.vx * dt; sk.y += sk.vy * dt;
        if (sk.x < FX0 + 3 || sk.x > FX1 - 3) sk.vx = -sk.vx;
        if (sk.y + 4 >= PADDLE_Y && sk.y - 4 <= PADDLE_Y + PADDLE_H && Math.abs(sk.x - P.x) <= P.w / 2 + 3) {
          sk.dead = true; P.stun = 0.8; S.pow.wide = 0; ev('burn', { x: sk.x, y: PADDLE_Y });
        } else if (sk.y > H + 10) sk.dead = true;
      }
      S.sparks = S.sparks.filter(function (s2) { return !s2.dead; });
      // исходы
      if (S.boss ? S.boss.hp <= 0 : S.left <= 0) {
        S.phase = 'clear'; S.phaseT = 2.0; S.clearBonus = 300 * S.level; addScore(S.clearBonus);
        S.caps = []; S.sparks = []; S.bolts = [];
        ev('clear', { level: S.level, bonus: S.clearBonus });
        return;
      }
      if (!S.balls.length) {
        S.lives--; resetPowers(); S.caps = []; S.sparks = []; S.bolts = [];
        ev('lose', { lives: S.lives, x: P.x });
        if (S.lives <= 0) { S.over = true; S.phase = 'over'; ev('gameover', { score: S.score }); }
        else { S.phase = 'dead'; S.phaseT = 1.1; }
      }
    }

    var api = {
      start: function () { loadLevel(); ev('level', { level: S.level }); return api; },
      update: function (dt) {
        if (S.over) return;
        S.time += dt;
        if (S.phase === 'play') stepPlay(dt);
        else if (S.phase === 'dead') { S.phaseT -= dt; if (S.phaseT <= 0) { S.phase = 'play'; serve(); ev('respawn'); } }
        else if (S.phase === 'clear') {
          S.phaseT -= dt; if (S.boss) { S.boss.flash = Math.max(0, S.boss.flash - dt); }
          if (S.phaseT <= 0) {
            if (S.level >= S.maxLevel) { S.over = true; S.won = true; S.phase = 'over'; ev('win', { score: S.score }); }
            else { S.level++; S.phase = 'play'; loadLevel(); ev('level', { level: S.level }); }
          }
        }
      },
      setDir: function (dx) { dirX = dx; if (dx) target = null; },
      setTarget: function (x) { target = x == null ? null : x; },
      setFire: function (on) { fireHeld = !!on; },
      action: function () {
        if (S.phase !== 'play') return;
        var any = false;
        for (var i = 0; i < S.balls.length; i++) if (S.balls[i].stuck) { release(S.balls[i]); any = true; }
        if (!any) fireBolts();
      },
      state: function () { return S; },
      _S: S, _damage: damage, _applyPower: applyPower, _loadLevel: loadLevel
    };
    return api;
  }

  K.Game = Game;
  K.logic = {
    W: W, H: H, FX0: FX0, FX1: FX1, FY0: FY0, COLS: COLS, BW: BW, BH: BH, BY0: BY0,
    PADDLE_Y: PADDLE_Y, PADDLE_H: PADDLE_H, BALL_R: BALL_R, PW_BASE: PW_BASE, PW_WIDE: PW_WIDE, PW_NARROW: PW_NARROW,
    MAX_ANGLE: MAX_ANGLE, MAX_LEVEL: MAX_LEVEL, MAX_LIVES: MAX_LIVES, CAP_W: CAP_W, CAP_H: CAP_H,
    LEVELS: LEVELS, POWERS: POWERS, POWER_KEYS: POWER_KEYS,
    parseMap: parseMap, paddleBounce: paddleBounce, circleRect: circleRect, hitAxis: hitAxis, params: params
  };
})(typeof window !== 'undefined' ? window : globalThis);
