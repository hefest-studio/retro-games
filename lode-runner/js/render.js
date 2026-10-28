/* ==========================================================================
   LODE RUNNER · Погружение — рендерер
   Две темы: RETRO (8-бит, 448×256, nearest-neighbour) и NEON (векторный, 2×).
   Интерфейс, HUD и меню — в DOM; здесь только игровое поле и эффекты.
   ========================================================================== */
(function () {
  'use strict';

  var COLS = 28, ROWS = 16;
  var TILE = 32, W = COLS * TILE, H = ROWS * TILE;   // логические 896×512
  var SCALE = 2;                                     // backing store 1792×1024
  var RTILE = 16, RW = COLS * RTILE, RH = ROWS * RTILE; // retro 448×256

  var C = {
    bg: '#05070f',
    ink: '#08101f',
    stone: '#2b3350',
    stoneLight: '#515d82',
    stoneDark: '#111625',
    brick: '#2a53c6',
    brickLight: '#5c88ff',
    brickDark: '#0a1533',
    ladder: '#f3bd4b',
    ladderLight: '#ffe090',
    rope: '#64f0c4',
    ropeDark: '#14705e',
    gold: '#ffd34d',
    goldLight: '#fff3ae',
    goldDark: '#8a5a00',
    player: '#f2fbff',
    playerAccent: '#45e6ff',
    playerDark: '#173a52',
    enemy: '#7d1b3d',
    enemyLight: '#ff5c8a',
    exit: '#74f7ff'
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function r(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function radial(ctx, x, y, r0, color, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r0);
    g.addColorStop(0, 'rgba(' + color + ',' + alpha + ')');
    g.addColorStop(0.55, 'rgba(' + color + ',' + (alpha * 0.35) + ')');
    g.addColorStop(1, 'rgba(' + color + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r0, y - r0, r0 * 2, r0 * 2);
  }

  function Renderer(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = 'retro';
    this.t = 0;
    this.flash = 0;

    this.retroCv = document.createElement('canvas');
    this.retroCv.width = RW;
    this.retroCv.height = RH;
    this.rctx = this.retroCv.getContext('2d');
    this.rctx.imageSmoothingEnabled = false;

    this.cache = document.createElement('canvas');
    this.cache.width = W * SCALE;
    this.cache.height = H * SCALE;
    this.cctx = this.cache.getContext('2d');
    this.cacheSig = '';
  }

  Renderer.prototype.setTheme = function (theme, silent) {
    if (theme !== 'neon' && theme !== 'retro') theme = 'neon';
    if (theme === this.theme) return;
    this.theme = theme;
    this.cacheSig = '';
    if (!silent) this.flash = 1;
  };

  Renderer.prototype.draw = function (game, dt) {
    this.t += Math.min(dt, 0.08);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.8);
    if (this.theme === 'retro') this._drawRetro(game);
    else this._drawNeon(game);
    if (this.flash > 0) {
      var c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = 'rgba(210,245,255,' + (this.flash * 0.14) + ')';
      c.fillRect(0, 0, this.cv.width, this.cv.height);
    }
  };

  /* =====================================================================
     RETRO 8-BIT
     ===================================================================== */

  Renderer.prototype._drawRetro = function (game) {
    var g = this.rctx;
    var t = this.t;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = C.bg;
    g.fillRect(0, 0, RW, RH);
    this._retroBackdrop(g, game);

    var sh = game.shake || 0;
    g.save();
    if (sh > 0.2) g.translate(Math.round((Math.random() - 0.5) * sh * 0.7), Math.round((Math.random() - 0.5) * sh * 0.5));

    var y, x;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        var ch = game.base[y][x];
        if (ch === '.') continue;
        this._retroTile(g, ch, x * RTILE, y * RTILE, x, y, t);
      }
    }

    // золото
    game.gold.forEach(function (k) {
      var p = k.split(',');
      var gx = +p[0], gy = +p[1];
      this._retroGold(g, gx * RTILE, gy * RTILE, t, gx);
    }, this);

    this._retroExit(g, game, t);
    this._retroHoles(g, game, t);

    // враги
    for (var i = 0; i < game.enemies.length; i++) {
      var en = game.enemies[i];
      if (en.state === 'dead') continue;
      this._retroEnemy(g, game, en, t);
    }
    // игрок
    if (game.state !== 'gameover') this._retroPlayer(g, game, t);

    this._retroParticles(g, game);
    this._retroFloaters(g, game);

    g.restore();

    // CRT-виньетка
    var vg = g.createRadialGradient(RW / 2, RH / 2, RH * 0.28, RW / 2, RH / 2, RH * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg;
    g.fillRect(0, 0, RW, RH);

    var c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.retroCv, 0, 0, this.cv.width, this.cv.height);
  };

  Renderer.prototype._retroBackdrop = function (g, game) {
    var seed = (game.levelIndex + 3) * 37;
    g.fillStyle = '#05070f';
    g.fillRect(0, 0, RW, RH);
    for (var i = 0; i < 70; i++) {
      var x = (i * 61 + seed * 7) % RW;
      var y = (i * 97 + seed * 13) % RH;
      var a = ((i * 31) % 3);
      if (a === 0) { g.fillStyle = 'rgba(90,120,200,0.20)'; }
      else if (a === 1) { g.fillStyle = 'rgba(70,220,255,0.13)'; }
      else { g.fillStyle = 'rgba(255,120,200,0.10)'; }
      g.fillRect(x, y, 1, 1);
    }
    // пара крупных «искр» на фоне
    var pulse = 0.18 + Math.abs(Math.sin(this.t * 1.4)) * 0.24;
    g.fillStyle = 'rgba(70,230,255,' + pulse.toFixed(3) + ')';
    g.fillRect((seed * 23) % RW, (seed * 17) % (RH - 30), 2, 2);
    g.fillStyle = 'rgba(255,92,138,' + pulse.toFixed(3) + ')';
    g.fillRect(RW - 20 - (seed * 11) % 30, 22 + (seed * 5) % (RH - 40), 2, 2);
  };

  Renderer.prototype._retroTile = function (g, ch, x, y, gx, gy, t) {
    var i;
    if (ch === '#') {
      r(g, x, y, RTILE, RTILE, '#242b40');
      r(g, x, y, RTILE, 1, '#4a5578');
      r(g, x, y, 1, RTILE, '#3a4464');
      r(g, x, y + RTILE - 1, RTILE, 1, '#0c0f18');
      r(g, x + RTILE - 1, y, 1, RTILE, '#161b2b');
      r(g, x + 3, y + 3, 2, 2, '#151a28');
      r(g, x + RTILE - 6, y + RTILE - 6, 2, 2, '#3d4863');
      r(g, x + 7, y + 8, 2, 2, '#1b2134');
      r(g, x + 4, y + 12, 8, 1, '#333c57');
    } else if (ch === '=') {
      r(g, x, y, RTILE, RTILE, '#0a1226');
      for (var row = 0; row < 2; row++) {
        for (var col = 0; col < 2; col++) {
          var bx = x + 1 + col * 8;
          var by = y + 1 + row * 8;
          r(g, bx, by, 7, 6, C.brick);
          r(g, bx, by, 7, 1, C.brickLight);
          r(g, bx, by + 5, 7, 1, '#1b3a8f');
          r(g, bx + 5, by + 1, 1, 4, '#1e3fa0');
        }
      }
      r(g, x, y + RTILE - 1, RTILE, 1, '#050912');
    } else if (ch === 'H') {
      r(g, x + 4, y, 2, RTILE, '#8f6416');
      r(g, x + 11, y, 2, RTILE, '#8f6416');
      r(g, x + 4, y, 1, RTILE, C.ladder);
      r(g, x + 11, y, 1, RTILE, C.ladder);
      for (i = 0; i < 4; i++) {
        var ry = y + 2 + i * 4;
        r(g, x + 4, ry, 9, 2, '#b07a1b');
        r(g, x + 4, ry, 9, 1, C.ladderLight);
      }
    } else if (ch === '-') {
      r(g, x, y + 13, RTILE, 2, C.ropeDark);
      r(g, x, y + 13, RTILE, 1, C.rope);
      r(g, x, y + 14, RTILE, 1, '#2aa98a');
      r(g, x + 2, y + 12, 1, 2, '#9dffe4');
      r(g, x + RTILE - 3, y + 12, 1, 2, '#9dffe4');
    }
  };

  Renderer.prototype._retroGold = function (g, x, y, t, seed) {
    var bob = Math.round(Math.sin(t * 3 + seed) * 1);
    var cx = x + 8, cy = y + 9 + bob;
    // тень
    g.fillStyle = 'rgba(255,211,77,0.13)';
    g.fillRect(x + 3, y + 14, 10, 2);
    // монета 8×7
    r(g, cx - 3, cy - 3, 6, 6, C.goldDark);
    r(g, cx - 2, cy - 4, 4, 1, C.goldDark);
    r(g, cx - 4, cy - 2, 8, 4, C.goldDark);
    r(g, cx - 3, cy - 3, 6, 5, C.gold);
    r(g, cx - 2, cy - 3, 4, 1, C.goldLight);
    r(g, cx - 2, cy - 1, 1, 2, '#fffbe0');
    r(g, cx + 2, cy + 1, 1, 1, C.goldLight);
    // блик
    var gl = Math.sin(t * 5 + seed * 2);
    if (gl > 0.4) {
      g.fillStyle = 'rgba(255,255,220,' + (0.5 + gl * 0.4).toFixed(2) + ')';
      g.fillRect(cx + 4, cy - 4, 1, 1);
    }
  };

  Renderer.prototype._retroExit = function (g, game, t) {
    var x = game.exit.x * RTILE, y = game.exit.y * RTILE;
    var open = game.exit.open && game.gold.size === 0;
    // тёмный проём
    r(g, x + 2, y + 1, 12, 15, '#050812');
    r(g, x + 1, y + 1, 1, 15, '#32406a');
    r(g, x + 14, y + 1, 1, 15, '#32406a');
    r(g, x + 2, y, 12, 1, '#53638f');
    if (!open) {
      for (var i = 0; i < 4; i++) r(g, x + 4, y + 3 + i * 3, 8, 1, '#7d2a45');
      r(g, x + 7, y + 9, 2, 3, '#b13e5c');
      r(g, x + 6, y + 8, 4, 1, '#b13e5c');
    } else {
      var glow = 0.5 + Math.abs(Math.sin(t * 4)) * 0.5;
      g.fillStyle = 'rgba(116,247,255,' + (0.15 + glow * 0.2).toFixed(2) + ')';
      g.fillRect(x + 2, y + 2, 12, 14);
      r(g, x + 5, y + 3, 6, 12, '#0e5560');
      r(g, x + 6, y + 3, 4, 12, '#74f7ff');
      r(g, x + 7, y + 4, 2, 10, '#eaffff');
      // стрелка вверх
      var ay = y + 6 + Math.round((t * 10) % 6);
      r(g, x + 7, ay, 2, 4, '#043340');
      r(g, x + 6, ay + 1, 4, 1, '#043340');
      r(g, x + 7, ay - 1, 2, 1, '#043340');
    }
  };

  Renderer.prototype._retroHoles = function (g, game, t) {
    game.holes.forEach(function (h) {
      var x = h.x * RTILE, y = h.y * RTILE;
      r(g, x, y + 2, RTILE, 14, '#02030a');
      r(g, x, y + 2, RTILE, 2, '#1b0e08');
      r(g, x, y + 15, RTILE, 1, '#4a2a16');
      // рваные края
      r(g, x + 1, y + 1, 3, 2, '#2b4bb0');
      r(g, x + 10, y + 1, 4, 2, '#2b4bb0');
      r(g, x + 2, y + 2, 1, 2, '#0a1226');
      r(g, x + 13, y + 2, 1, 2, '#0a1226');
      // падающие крупицы
      var ph = (t * 22 + h.x * 7) % 12;
      r(g, x + 4, y + 3 + ph, 1, 2, '#6b4a2b');
      r(g, x + 11, y + 3 + ((ph + 5) % 12), 1, 1, '#8b6336');
      // таймер закрытия по краям
      var k = clamp(h.timer / h.max, 0, 1);
      if (k < 0.35) {
        g.fillStyle = 'rgba(255,120,80,' + (0.35 - k).toFixed(2) + ')';
        g.fillRect(x + 2, y + 1, 12, 1);
      }
    });
  };

  Renderer.prototype._retroPlayer = function (g, game, t) {
    var p = game.player;
    var x = Math.round(p.px * RTILE), y = Math.round(p.py * RTILE);
    var dying = game.state === 'dying';
    if (dying && game.deathTimer < 0.75) return;

    g.save();
    g.translate(x, y);
    if (p.dir < 0) { g.translate(RTILE, 0); g.scale(-1, 1); }

    var state = p.state;
    var climbing = (p.move && p.move.kind === 'climb');
    var walking = (p.move && p.move.kind === 'walk');
    var falling = (p.move && p.move.kind === 'fall');
    var digging = state === 'digging';
    var trapped = state === 'hole';
    var phase = p.stepPhase + (p.move ? p.move.t / p.move.dur : 0);
    var leg = walking ? (Math.sin(phase * Math.PI * 2) > 0 ? 1 : -1) : 0;
    var bob = walking ? (leg > 0 ? 0 : 1) : 0;

    // тень
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(3, 15, 10, 1);

    if (trapped) {
      // из ямы торчат голова и руки
      r(g, 4, 2, 8, 1, C.ink);
      r(g, 4, 1, 8, 2, C.playerAccent);
      r(g, 5, 3, 6, 4, '#ffd9b3');
      r(g, 4, 3, 1, 4, C.ink);
      r(g, 11, 3, 1, 4, C.ink);
      r(g, 8, 4, 1, 1, C.ink);
      r(g, 9, 4, 1, 1, C.ink);
      r(g, 3, 9, 2, 2, '#ffd9b3');
      r(g, 11, 9, 2, 2, '#ffd9b3');
      r(g, 4, 11, 8, 1, 'rgba(0,0,0,0.6)');
      g.restore();
      return;
    }

    // ноги
    if (falling) {
      r(g, 3, 12, 3, 3, '#2b5cff'); r(g, 10, 12, 3, 3, '#2b5cff');
      r(g, 2, 15, 4, 1, '#ffcf5c'); r(g, 10, 15, 4, 1, '#ffcf5c');
    } else if (climbing) {
      r(g, 4, 12, 3, 3, '#2b5cff'); r(g, 9, 11, 3, 4, '#2b5cff');
      r(g, 4, 15, 3, 1, '#ffcf5c'); r(g, 9, 15, 3, 1, '#ffcf5c');
    } else if (digging) {
      r(g, 4, 13, 3, 2, '#2b5cff'); r(g, 9, 13, 3, 2, '#2b5cff');
      r(g, 3, 15, 4, 1, '#ffcf5c'); r(g, 9, 15, 4, 1, '#ffcf5c');
    } else {
      r(g, 4 + leg, 13, 3, 2, '#2b5cff');
      r(g, 9 - leg, 13, 3, 2, '#2b5cff');
      r(g, 3 + leg, 15, 4, 1, '#ffcf5c');
      r(g, 9 - leg, 15, 4, 1, '#ffcf5c');
    }

    // торс
    r(g, 3, 6, 10, 7, C.ink);
    r(g, 4, 6 + bob, 8, 6, C.player);
    r(g, 6, 8 + bob, 3, 2, C.playerAccent);
    r(g, 4, 12, 8, 1, '#243355');

    // руки
    if (climbing) {
      r(g, 2, 3, 1, 5, C.ink); r(g, 13, 3, 1, 5, C.ink);
      r(g, 2, 2, 1, 2, '#ffd9b3'); r(g, 13, 2, 1, 2, '#ffd9b3');
      r(g, 3, 7, 1, 3, C.player); r(g, 12, 7, 1, 3, C.player);
    } else if (digging) {
      r(g, 2, 8, 1, 3, C.ink); r(g, 2, 10, 1, 2, '#ffd9b3');
      r(g, 12, 8, 2, 1, C.ink);
      r(g, 13, 9, 1, 2, '#ffd9b3');
      r(g, 14, 11, 1, 1, C.playerAccent);
    } else if (falling) {
      r(g, 2, 6, 1, 3, C.ink); r(g, 13, 6, 1, 3, C.ink);
      r(g, 2, 9, 1, 1, '#ffd9b3'); r(g, 13, 9, 1, 1, '#ffd9b3');
    } else {
      r(g, 3, 7 + bob, 1, 4, C.ink);
      r(g, 12, 7 + bob, 1, 4, C.ink);
      r(g, 3, 11 + bob, 1, 1, '#ffd9b3');
      r(g, 12, 11 + bob, 1, 1, '#ffd9b3');
    }

    // голова
    var hy = 0 + bob;
    r(g, 4, hy, 8, 1, C.ink);
    r(g, 4, hy + 1, 8, 2, C.playerAccent);
    r(g, 9, hy + 2, 3, 1, '#29b6d6');
    r(g, 5, hy + 3, 6, 4, '#ffd9b3');
    r(g, 4, hy + 3, 1, 4, C.ink);
    r(g, 11, hy + 3, 1, 4, C.ink);
    r(g, 8, hy + 4, 1, 1, C.ink);
    r(g, 9, hy + 4, 1, 1, C.ink);
    r(g, 5, hy + 6, 1, 1, '#e7b78f');
    r(g, 10, hy + 6, 1, 1, '#e7b78f');

    g.restore();
  };

  Renderer.prototype._retroEnemy = function (g, game, en, t) {
    var x = Math.round(en.px * RTILE), y = Math.round(en.py * RTILE);
    g.save();
    g.translate(x, y);
    if (en.dir < 0) { g.translate(RTILE, 0); g.scale(-1, 1); }
    var trapped = en.state === 'hole';
    var spawning = en.state === 'spawn';
    var phase = en.stepPhase + (en.move ? en.move.t / en.move.dur : 0);
    var leg = Math.sin(phase * Math.PI * 2) > 0 ? 1 : -1;
    var bob = Math.sin(t * 6 + (en.id || 0)) > 0 ? 0 : 1;

    if (spawning && Math.floor(t * 20) % 2 === 0) {
      g.globalAlpha = 0.55;
    }

    if (trapped) {
      r(g, 4, 2, 8, 1, C.ink);
      r(g, 4, 2, 8, 4, C.enemy);
      r(g, 5, 3, 6, 2, '#1d0710');
      r(g, 6, 3, 1, 1, C.enemyLight);
      r(g, 9, 3, 1, 1, C.enemyLight);
      r(g, 3, 9, 2, 2, C.enemy);
      r(g, 11, 9, 2, 2, C.enemy);
      g.globalAlpha = 1;
      g.restore();
      return;
    }

    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(3, 15, 10, 1);

    // ноги
    r(g, 3 + leg, 12, 3, 3, '#25101a');
    r(g, 10 - leg, 12, 3, 3, '#25101a');
    r(g, 2 + leg, 15, 4, 1, '#5f1228');
    r(g, 9 - leg, 15, 4, 1, '#5f1228');
    // плащ/тело
    r(g, 3, 6 + bob, 10, 7, C.ink);
    r(g, 4, 6 + bob, 8, 6, C.enemy);
    r(g, 4, 11 + bob, 8, 1, '#3b0b1c');
    r(g, 6, 8 + bob, 4, 2, '#a52a4d');
    // руки
    r(g, 2, 7 + bob, 1, 4, C.enemy);
    r(g, 13, 7 + bob, 1, 4, C.enemy);
    r(g, 2, 10 + bob, 1, 2, '#ffb0c5');
    r(g, 13, 10 + bob, 1, 2, '#ffb0c5');
    // капюшон
    r(g, 4, bob, 8, 2, '#4a0f24');
    r(g, 3, bob + 1, 1, 3, '#4a0f24');
    r(g, 12, bob + 1, 1, 3, '#4a0f24');
    r(g, 5, bob + 2, 6, 3, '#1d0710');
    r(g, 6, bob + 3, 1, 1, C.enemyLight);
    r(g, 9, bob + 3, 1, 1, C.enemyLight);
    r(g, 6, bob + 3, 1, 1, '#fff');
    r(g, 9, bob + 3, 1, 1, '#fff');
    // блик на капюшоне
    r(g, 5, bob, 2, 1, '#7b1b3a');

    if (spawning) {
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,92,138,0.6)';
      g.strokeRect(2.5, 2.5, 11, 12);
    }
    g.globalAlpha = 1;
    g.restore();
  };

  Renderer.prototype._retroParticles = function (g, game) {
    for (var i = 0; i < game.particles.length; i++) {
      var p = game.particles[i];
      var a = clamp(p.life / p.max, 0, 1);
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x * RTILE), Math.round(p.y * RTILE), Math.abs(p.size) > 0.09 ? 2 : 1, Math.abs(p.size) > 0.09 ? 2 : 1);
    }
    g.globalAlpha = 1;
  };

  Renderer.prototype._retroFloaters = function (g, game) {
    g.textAlign = 'center';
    g.font = 'bold 8px "Courier New", monospace';
    for (var i = 0; i < game.floaters.length; i++) {
      var f = game.floaters[i];
      var a = clamp(f.life / f.max, 0, 1);
      g.globalAlpha = a;
      g.fillStyle = '#05070f';
      g.fillText(f.text, f.x * RTILE + 9, f.y * RTILE + 1);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x * RTILE + 8, f.y * RTILE);
    }
    g.globalAlpha = 1;
  };

  /* =====================================================================
     NEON / MODERN
     ===================================================================== */

  Renderer.prototype._drawNeon = function (game) {
    var ctx = this.ctx;
    var t = this.t;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, W, H);
    this._neonBackdrop(ctx, game, t);

    var sig = game.levelIndex + '|' + Array.from(game.holes.keys()).sort().join(';');
    if (sig !== this.cacheSig) {
      this.cacheSig = sig;
      this._buildCache(game);
    }

    var sh = game.shake || 0;
    ctx.save();
    if (sh > 0.2) ctx.translate((Math.random() - 0.5) * sh * 0.55, (Math.random() - 0.5) * sh * 0.4);

    ctx.drawImage(this.cache, 0, 0, W, H);

    this._neonExit(ctx, game, t);
    this._neonHoles(ctx, game, t);

    game.gold.forEach(function (k) {
      var p = k.split(',');
      this._neonGold(ctx, +p[0], +p[1], t);
    }, this);

    for (var i = 0; i < game.enemies.length; i++) {
      var en = game.enemies[i];
      if (en.state === 'dead') continue;
      this._neonEnemy(ctx, game, en, t);
    }
    if (game.state !== 'gameover') this._neonPlayer(ctx, game, t);

    this._neonParticles(ctx, game);
    this._neonFloaters(ctx, game);
    ctx.restore();

    // мягкая виньетка
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  };

  Renderer.prototype._neonBackdrop = function (ctx, game, t) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#060713');
    g.addColorStop(0.5, '#080a1c');
    g.addColorStop(1, '#0b0718');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    radial(ctx, W * 0.22 + Math.sin(t * 0.11) * 120, H * 0.28 + Math.cos(t * 0.08) * 70, 360, '0,190,255', 0.10);
    radial(ctx, W * 0.82 + Math.cos(t * 0.09) * 130, H * 0.7 + Math.sin(t * 0.07) * 80, 380, '255,45,140', 0.09);
    radial(ctx, W * 0.55, H * 0.2 + Math.sin(t * 0.13) * 40, 280, '120,90,255', 0.07);
    ctx.restore();

    // сетка
    ctx.save();
    ctx.strokeStyle = 'rgba(120,160,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= W; x += TILE) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (var y = 0; y <= H; y += TILE) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
    ctx.restore();

    // плавающая пыль
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 34; i++) {
      var px = ((i * 137 + t * (6 + (i % 5) * 3)) % (W + 40)) - 20;
      var py = ((i * 89 + Math.sin(t * 0.4 + i) * 20) % H + H) % H;
      var a = 0.05 + (Math.sin(t * 1.3 + i) + 1) * 0.05;
      ctx.fillStyle = 'rgba(160,220,255,' + a.toFixed(3) + ')';
      ctx.fillRect(px, py, 1.5, 1.5);
    }
    ctx.restore();
  };

  Renderer.prototype._buildCache = function (game) {
    var ctx = this.cctx;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var ch = game.base[y][x];
        if (ch === '.' || game.holes.has(x + ',' + y)) continue;
        this._neonTile(ctx, ch, x * TILE, y * TILE, x, y);
      }
    }
  };

  Renderer.prototype._neonTile = function (ctx, ch, px, py, gx, gy) {
    var x, y, i;
    if (ch === '#') {
      var g = ctx.createLinearGradient(px, py, px, py + TILE);
      g.addColorStop(0, '#323c60');
      g.addColorStop(0.45, '#252d49');
      g.addColorStop(1, '#151a2c');
      rr(ctx, px + 1.5, py + 1.5, TILE - 3, TILE - 3, 7);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,175,255,0.20)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,235,255,0.16)';
      ctx.beginPath();
      ctx.moveTo(px + 6, py + 4);
      ctx.lineTo(px + TILE - 6, py + 4);
      ctx.stroke();
      // заклёпки
      ctx.fillStyle = 'rgba(160,185,240,0.25)';
      ctx.beginPath(); ctx.arc(px + 7, py + TILE - 7, 1.4, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(px + TILE - 7, py + TILE - 7, 1.4, 0, 6.283); ctx.fill();
    } else if (ch === '=') {
      // тёплые кирпичи: 2×2 блока
      for (var row = 0; row < 2; row++) {
        for (var col = 0; col < 2; col++) {
          var bx = px + 1.5 + col * 15;
          var by = py + 1.5 + row * 15;
          var bg = ctx.createLinearGradient(bx, by, bx + 14, by + 14);
          bg.addColorStop(0, '#ff8a5b');
          bg.addColorStop(0.55, '#e05050');
          bg.addColorStop(1, '#a92c4b');
          rr(ctx, bx, by, 13, 13, 3);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.strokeStyle = 'rgba(30,6,20,0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,220,190,0.35)';
          ctx.beginPath();
          ctx.moveTo(bx + 3, by + 2);
          ctx.lineTo(bx + 10, by + 2);
          ctx.stroke();
        }
      }
    } else if (ch === 'H') {
      ctx.save();
      ctx.shadowColor = 'rgba(90,255,180,0.55)';
      ctx.shadowBlur = 9;
      ctx.strokeStyle = '#78ffbe';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + 9, py);
      ctx.lineTo(px + 9, py + TILE);
      ctx.moveTo(px + 23, py);
      ctx.lineTo(px + 23, py + TILE);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(210,255,235,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + TILE - 6, py + 6);
      ctx.moveTo(px + 6, py + 16); ctx.lineTo(px + TILE - 6, py + 16);
      ctx.moveTo(px + 6, py + 26); ctx.lineTo(px + TILE - 6, py + 26);
      ctx.stroke();
      ctx.restore();
    } else if (ch === '-') {
      ctx.save();
      ctx.shadowColor = 'rgba(170,130,255,0.6)';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#b79cff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py + 24);
      ctx.quadraticCurveTo(px + TILE / 2, py + 28, px + TILE, py + 24);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,230,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py + 23);
      ctx.quadraticCurveTo(px + TILE / 2, py + 27, px + TILE, py + 23);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,180,255,0.9)';
      ctx.beginPath(); ctx.arc(px + 2, py + 24, 1.7, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(px + TILE - 2, py + 24, 1.7, 0, 6.283); ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype._neonGold = function (ctx, gx, gy, t) {
    var cx = (gx + 0.5) * TILE;
    var cy = (gy + 0.5) * TILE + Math.sin(t * 2.6 + gx * 1.7) * 2.5;
    var spin = 0.32 + Math.abs(Math.cos(t * 2.2 + gy * 0.9)) * 0.68;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(spin, 1);
    ctx.shadowColor = 'rgba(255,205,80,0.9)';
    ctx.shadowBlur = 18;
    var g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 12);
    g.addColorStop(0, '#fff6c8');
    g.addColorStop(0.35, '#ffd75a');
    g.addColorStop(0.8, '#f0a726');
    g.addColorStop(1, '#9a5c08');
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 11, 0, 0, 6.283);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,220,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,80,0,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 7, 0, 0, 6.283);
    ctx.stroke();
    ctx.restore();
    // блик-звезда
    var sa = 0.35 + Math.abs(Math.sin(t * 3 + gx)) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,250,210,' + sa.toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 10);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype._neonExit = function (ctx, game, t) {
    var cx = (game.exit.x + 0.5) * TILE;
    var cy = (game.exit.y + 0.5) * TILE;
    var open = game.exit.open && game.gold.size === 0;
    ctx.save();
    if (open) {
      ctx.globalCompositeOperation = 'lighter';
      var beam = ctx.createLinearGradient(cx, cy - 90, cx, cy + 20);
      beam.addColorStop(0, 'rgba(116,247,255,0)');
      beam.addColorStop(0.6, 'rgba(116,247,255,0.15)');
      beam.addColorStop(1, 'rgba(180,255,255,0.35)');
      ctx.fillStyle = beam;
      ctx.fillRect(cx - 15, cy - 90, 30, 110);
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = 'rgba(116,247,255,0.9)';
      ctx.shadowBlur = 28;
      ctx.strokeStyle = 'rgba(160,252,255,0.95)';
      ctx.lineWidth = 2;
      var rot = t * 1.4;
      for (var i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, 15 + i * 4, 7 + i * 2, rot + i * 1.1, 0, 6.283);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, 6.283);
      ctx.fillStyle = 'rgba(116,247,255,0.13)';
      ctx.fill();
      ctx.strokeStyle = '#eaffff';
      ctx.stroke();
      // шевроны
      ctx.shadowBlur = 12;
      for (var k = 0; k < 3; k++) {
        var yy = cy + 12 - ((t * 22 + k * 8) % 22);
        ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 3 + k);
        ctx.beginPath();
        ctx.moveTo(cx - 5, yy);
        ctx.lineTo(cx, yy - 4);
        ctx.lineTo(cx + 5, yy);
        ctx.strokeStyle = '#c9ffff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    } else {
      ctx.shadowColor = 'rgba(255,70,130,0.5)';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(255,100,160,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, 6.283);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, 6.283);
      ctx.fillStyle = 'rgba(255,60,120,0.08)';
      ctx.fill();
      // замок
      ctx.fillStyle = 'rgba(255,180,200,0.85)';
      ctx.fillRect(cx - 4, cy - 2, 8, 7);
      ctx.strokeStyle = 'rgba(255,180,200,0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy - 3, 3, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#3a0b1d';
      ctx.fillRect(cx - 1, cy, 2, 3);
    }
    ctx.restore();
  };

  Renderer.prototype._neonHoles = function (ctx, game, t) {
    game.holes.forEach(function (h) {
      var cx = (h.x + 0.5) * TILE, cy = (h.y + 0.5) * TILE;
      ctx.save();
      var g = ctx.createRadialGradient(cx, cy + 2, 2, cx, cy, 19);
      g.addColorStop(0, '#000000');
      g.addColorStop(0.65, '#07040c');
      g.addColorStop(1, 'rgba(255,95,60,0.35)');
      rr(ctx, cx - 15, cy - 10, 30, 26, 7);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,70,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // рваный край
      ctx.strokeStyle = 'rgba(255,150,100,0.6)';
      ctx.beginPath();
      for (var i = 0; i < 5; i++) {
        var xx = cx - 13 + i * 6;
        ctx.moveTo(xx, cy - 10);
        ctx.lineTo(xx + 3, cy - 6);
      }
      ctx.stroke();
      // искры
      var k = clamp(h.timer / h.max, 0, 1);
      ctx.globalCompositeOperation = 'lighter';
      for (var j = 0; j < 3; j++) {
        var ph = (t * 26 + j * 13) % 18;
        ctx.fillStyle = 'rgba(255,' + (120 + j * 30) + ',80,' + (0.5 - ph / 60).toFixed(2) + ')';
        ctx.fillRect(cx - 8 + j * 7, cy + 8 - ph, 1.5, 2.5);
      }
      if (k < 0.32) {
        ctx.strokeStyle = 'rgba(255,80,80,' + (0.35 - k).toFixed(2) + ')';
        ctx.lineWidth = 2;
        rr(ctx, cx - 15, cy - 10, 30, 26, 7);
        ctx.stroke();
      }
      ctx.restore();
    });
  };

  Renderer.prototype._neonPlayer = function (ctx, game, t) {
    var p = game.player;
    var dying = game.state === 'dying';
    if (dying && game.deathTimer < 0.85) return;

    var cx = (p.px + 0.5) * TILE;
    var cy = (p.py + 0.5) * TILE;
    var state = p.state;
    var moving = !!p.move;
    var walking = moving && p.move.kind === 'walk';
    var climbing = moving && p.move.kind === 'climb';
    var falling = moving && p.move.kind === 'fall';
    var digging = state === 'digging';
    var trapped = state === 'hole';
    var bob = walking ? Math.sin(p.anim * 15) * 1.2 : Math.sin(p.anim * 2) * 0.7;
    var swing = walking ? Math.sin(p.anim * 15) * 5 : 0;
    var dir = p.dir < 0 ? -1 : 1;

    ctx.save();
    ctx.translate(cx, cy + (trapped ? 7 : 0));
    // тень
    if (!trapped) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 15, 11, 3.4, 0, 0, 6.283);
      ctx.fill();
    }
    ctx.scale(dir, 1);
    ctx.translate(0, bob);

    var alpha = 1;
    if (dying) alpha = 0.4 + Math.abs(Math.sin(game.deathTimer * 30)) * 0.6;
    ctx.globalAlpha = alpha;

    if (trapped) {
      // голова и руки над ямой
      ctx.save();
      ctx.shadowColor = 'rgba(69,230,255,0.8)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#eaffff';
      ctx.beginPath(); ctx.arc(0, -7, 6, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#06121f';
      rr(ctx, -4.5, -9, 9, 3.5, 1.6); ctx.fill();
      ctx.fillStyle = 'rgba(69,230,255,0.9)';
      ctx.fillRect(-3, -8, 6, 1);
      ctx.restore();
      ctx.strokeStyle = '#bff9ff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-9, 5); ctx.lineTo(-6, 10);
      ctx.moveTo(9, 5); ctx.lineTo(6, 10); ctx.stroke();
      ctx.restore();
      return;
    }

    // шлейф-шарф
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,170,80,0.8)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.bezierCurveTo(-8, -7, -12 - swing * 0.5, -5 + Math.sin(t * 5) * 2, -16 - swing * 0.4, -8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,150,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3, -2);
    ctx.bezierCurveTo(-8, 1, -10, 3 + Math.sin(t * 4) * 2, -13, 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,170,80,0.95)';
    ctx.beginPath(); ctx.arc(-3, -4, 2, 0, 6.283); ctx.fill();
    ctx.restore();

    var legColor = '#122a4a';
    var legAccent = '#3fc9ff';
    // ноги
    ctx.lineCap = 'round';
    ctx.strokeStyle = legColor;
    ctx.lineWidth = 5.5;
    if (climbing) {
      ctx.beginPath();
      ctx.moveTo(-3, 4); ctx.lineTo(-5, 10 + Math.sin(p.anim * 10) * 2);
      ctx.moveTo(3, 4); ctx.lineTo(5, 10 - Math.sin(p.anim * 10) * 2);
      ctx.stroke();
      ctx.fillStyle = legAccent;
      ctx.beginPath(); ctx.arc(-5, 11, 2.2, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(5, 11, 2.2, 0, 6.283); ctx.fill();
    } else if (falling) {
      ctx.beginPath();
      ctx.moveTo(-3, 4); ctx.lineTo(-8, 11);
      ctx.moveTo(3, 4); ctx.lineTo(8, 11);
      ctx.stroke();
      ctx.fillStyle = legAccent;
      ctx.beginPath(); ctx.arc(-8, 13, 2.2, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(8, 13, 2.2, 0, 6.283); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-3, 4); ctx.lineTo(-3, 13 - Math.abs(swing) * 0.4);
      ctx.moveTo(3, 4); ctx.lineTo(3, 13 - (5 - Math.abs(swing)) * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4.5, 14 - Math.abs(swing) * 0.3); ctx.lineTo(-2, 14 - Math.abs(swing) * 0.3);
      ctx.moveTo(4.5, 14 - (5 - Math.abs(swing)) * 0.15); ctx.lineTo(2, 14 - (5 - Math.abs(swing)) * 0.15);
      ctx.strokeStyle = legAccent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // торс
    ctx.save();
    ctx.shadowColor = 'rgba(69,230,255,0.65)';
    ctx.shadowBlur = 16;
    var bg = ctx.createLinearGradient(0, -8, 0, 8);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.45, '#d9f9ff');
    bg.addColorStop(1, '#5cd8ff');
    rr(ctx, -5.5, -6, 11, 13, 5.5);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(4,15,28,0.9)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    // воротник
    ctx.strokeStyle = 'rgba(69,230,255,0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, -5, 3.4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    // ядро
    ctx.fillStyle = 'rgba(255,195,80,0.95)';
    ctx.shadowColor = 'rgba(255,195,80,0.9)';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(1, -1, 2.1, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;

    // руки
    var arm = function (w) {
      ctx.lineWidth = w;
      ctx.strokeStyle = w > 4 ? 'rgba(4,15,28,0.9)' : '#dff9ff';
      ctx.beginPath();
      if (climbing) {
        ctx.moveTo(-4, -3); ctx.lineTo(-7, -10);
        ctx.moveTo(4, -3); ctx.lineTo(7, -10);
      } else if (digging) {
        ctx.moveTo(-4, -2); ctx.lineTo(-8, 3);
        ctx.moveTo(4, -2); ctx.lineTo(10, 6 + (p.digT * 5));
      } else if (falling) {
        ctx.moveTo(-4, -2); ctx.lineTo(-9, -6);
        ctx.moveTo(4, -2); ctx.lineTo(9, -6);
      } else {
        ctx.moveTo(-4, -2); ctx.lineTo(-6 + swing * 0.5, 4);
        ctx.moveTo(4, -2); ctx.lineTo(6 - swing * 0.5, 4);
      }
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    arm(5.6);
    arm(3);
    // кисти / перчатка
    ctx.fillStyle = '#9df4ff';
    ctx.beginPath(); ctx.arc(climbing ? -7 : -6, climbing ? -11 : 4, 1.9, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(digging ? 10 : climbing ? 7 : 6, digging ? 7 : climbing ? -11 : 4, 1.9, 0, 6.283); ctx.fill();

    // голова
    ctx.save();
    ctx.shadowColor = 'rgba(69,230,255,0.7)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#071422';
    ctx.beginPath(); ctx.arc(0, -11.5, 6.5, 0, 6.283); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f2fcff';
    ctx.beginPath(); ctx.arc(0, -11.5, 5.3, 0, 6.283); ctx.fill();
    ctx.restore();
    // визор
    ctx.fillStyle = '#071422';
    rr(ctx, -4.2, -13, 8.4, 3.6, 1.7);
    ctx.fill();
    var eyeGlow = 0.6 + Math.abs(Math.sin(t * 2.2)) * 0.4;
    ctx.fillStyle = 'rgba(69,230,255,' + eyeGlow.toFixed(2) + ')';
    ctx.fillRect(-2.2, -12, 5, 1.3);
    ctx.fillStyle = '#bff9ff';
    ctx.fillRect(1.4, -12, 1.4, 1.3);

    ctx.restore();
  };

  Renderer.prototype._neonEnemy = function (ctx, game, en, t) {
    var cx = (en.px + 0.5) * TILE;
    var cy = (en.py + 0.5) * TILE;
    var bob = Math.sin(t * 2.2 + (en.id || 0) * 1.7) * 3;
    var trapped = en.state === 'hole';
    var spawning = en.state === 'spawn';
    var hue = (en.id || 0) % 2 === 0 ? '255,46,136' : '255,100,60';
    ctx.save();
    ctx.translate(cx, cy + bob + (trapped ? 9 : 0));
    var scale = trapped ? 0.75 : 1;
    ctx.scale(scale, scale);

    // тень
    if (!trapped) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(0, 17 - bob, 11, 3, 0, 0, 6.283); ctx.fill();
    }

    if (spawning) {
      var sp = clamp(en.spawnTimer / 0.55, 0, 1);
      ctx.globalAlpha = 0.5 + sp * 0.5;
      ctx.strokeStyle = 'rgba(' + hue + ',0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 20 * (1 - sp) + 8, 0, 6.283); ctx.stroke();
    }

    // орбитальные кольца
    ctx.save();
    ctx.rotate(t * 0.9 + (en.id || 0));
    ctx.strokeStyle = 'rgba(' + hue + ',0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 6, 0.35, 0, 6.283); ctx.stroke();
    ctx.restore();

    // корпус дрона
    ctx.save();
    ctx.shadowColor = 'rgba(' + hue + ',0.85)';
    ctx.shadowBlur = 20;
    var bg = ctx.createRadialGradient(-4, -5, 1, 0, 0, 14);
    bg.addColorStop(0, '#ff9dbb');
    bg.addColorStop(0.3, '#b81c55');
    bg.addColorStop(0.75, '#4c0a25');
    bg.addColorStop(1, '#1a030d');
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 11, 0, 0, 6.283);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,200,0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // глаз
    ctx.save();
    ctx.shadowColor = 'rgba(' + hue + ',0.95)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(' + hue + ',0.95)';
    var eyeDir = en.dir < 0 ? -1 : 1;
    rr(ctx, -5 + eyeDir * 1.5, -2.5, 8, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#fff3f8';
    rr(ctx, -2 + eyeDir * 2, -1.7, 5, 2.4, 1.2);
    ctx.fill();
    ctx.restore();

    // боковые «уши»
    ctx.fillStyle = 'rgba(255,120,160,0.8)';
    ctx.beginPath(); ctx.arc(-12, 1, 2.2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(12, 1, 2.2, 0, 6.283); ctx.fill();
    // нижние дюзы
    ctx.fillStyle = 'rgba(' + hue + ',0.55)';
    ctx.beginPath(); ctx.arc(-5, 10, 1.7, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 10, 1.7, 0, 6.283); ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  };

  Renderer.prototype._neonParticles = function (ctx, game) {
    ctx.save();
    for (var i = 0; i < game.particles.length; i++) {
      var p = game.particles[i];
      var a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a * 0.95;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * TILE, p.y * TILE, Math.max(1, p.size * TILE * 1.8), 0, 6.283);
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype._neonFloaters = function (ctx, game) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 16px system-ui, -apple-system, "Segoe UI", sans-serif';
    for (var i = 0; i < game.floaters.length; i++) {
      var f = game.floaters[i];
      var a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * TILE + TILE / 2, f.y * TILE);
    }
    ctx.restore();
  };

  window.LR = window.LR || {};
  window.LR.Renderer = Renderer;
})();
