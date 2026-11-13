/* ============================================================
   НЕОН × ЯРОСТЬ: NEON YAROST
   game.js — состояние, меню, бой, волны, босс, камера, отладка.
   Владелец: Lead. Контракт: docs/CONTRACT.md.
   ============================================================ */
(function () {
  'use strict';

  var W = 480, H = 270;
  var WORLD_W = 2400;

  /* ---------- утилиты ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function chance(p) { return Math.random() < p; }
  function sign(v) { return v < 0 ? -1 : 1; }
  function nowT() { return 0; }
  function T(key, vars) {
    try { return window.NR_T ? window.NR_T(key, vars) : key; } catch (e) { return key; }
  }
  function saveTry(fn) { try { fn(); } catch (e) { /* localStorage/file:// может быть недоступен */ } }

  /* ---------- данные ---------- */
  var STORE_KEY = 'neon-yarost.settings';
  /* Устаревший ключ (прежнее имя) — только для однократной миграции:
     старый → новый (если нового ещё нет) → удалить старый. */
  var LEGACY_STORE_KEY = 'dd-neon-settings-v1';
  saveTry(function () {
    var old = window.localStorage.getItem(LEGACY_STORE_KEY);
    if (old == null) return;
    if (window.localStorage.getItem(STORE_KEY) == null) window.localStorage.setItem(STORE_KEY, old);
    window.localStorage.removeItem(LEGACY_STORE_KEY);
  });
  var DIFF_IDS = ['easy', 'normal', 'hard'];
  var DIFFS = {
    easy:   { hp: 0.78, dmg: 0.62, speed: 0.90, score: 0.80, label: 'diff.easy' },
    normal: { hp: 1.00, dmg: 1.00, speed: 1.00, score: 1.00, label: 'diff.normal' },
    hard:   { hp: 1.22, dmg: 1.32, speed: 1.09, score: 1.30, label: 'diff.hard' }
  };

  var CHARS = [
    {
      id: 'comet', nameKey: 'char.comet.name', aliasKey: 'char.comet.alias',
      descKey: 'char.comet.desc', specKey: 'char.comet.spec',
      hp: 110, speed: 120, depth: 80, power: 1.0, jump: 345,
      specialR: 100, specialDmg: 28,
      stats: { power: 3, speed: 5, armor: 3, range: 4 }
    },
    {
      id: 'hammer', nameKey: 'char.hammer.name', aliasKey: 'char.hammer.alias',
      descKey: 'char.hammer.desc', specKey: 'char.hammer.spec',
      hp: 138, speed: 96, depth: 62, power: 1.18, jump: 315,
      specialR: 124, specialDmg: 34,
      stats: { power: 5, speed: 3, armor: 5, range: 3 }
    }
  ];

  var ZONES = [
    { id: 'street', nameKey: 'zone.street', subKey: 'zone.streetSub', start: 0, end: 760, accent: '#ff2e88' },
    { id: 'arcade', nameKey: 'zone.arcade', subKey: 'zone.arcadeSub', start: 760, end: 1400, accent: '#22e6ff' },
    { id: 'roof', nameKey: 'zone.roof', subKey: 'zone.roofSub', start: 1400, end: 2400, accent: '#b6ff3a' }
  ];

  var WAVES = [
    { zone: 0, trigger: 300, arena: [140, 660], spawns: ['punk', 'punk'] },
    { zone: 0, trigger: 760, arena: [620, 1120], spawns: ['punk', 'punk', 'ninja'] },
    { zone: 1, trigger: 1220, arena: [1040, 1560], spawns: ['punk', 'ninja', 'brute'] },
    { zone: 2, trigger: 1640, arena: [1460, 1980], spawns: ['brute', 'brute', 'ninja', 'ninja'] },
    { zone: 2, trigger: 2000, arena: [1800, 2320], boss: true, spawns: ['boss'] }
  ];

  var ENEMY_STATS = {
    punk:  { hp: 28, speed: 68, depth: 52, dmg: 6,  reach: 30, depthReach: 18, wind: 0.34, active: 0.09, recover: 0.52, cd: 1.35, score: 100, scale: 1.00, push: 70 },
    ninja: { hp: 23, speed: 98, depth: 64, dmg: 7,  reach: 32, depthReach: 19, wind: 0.25, active: 0.09, recover: 0.42, cd: 1.05, score: 160, scale: 0.96, push: 90 },
    brute: { hp: 64, speed: 47, depth: 40, dmg: 12, reach: 38, depthReach: 20, wind: 0.54, active: 0.11, recover: 0.72, cd: 1.95, score: 260, scale: 1.18, armor: true, push: 50 }
  };

  var BOSS_STATS = {
    hp: 360, speed: 62, dmg: 13, score: 2500, scale: 1.45
  };

  var PROPS_LAYOUT = [
    { x: 430,  y: 234, type: 'crate',   contains: 'food' },
    { x: 880,  y: 198, type: 'barrel',  contains: 'coin' },
    { x: 1092, y: 192, type: 'vending', contains: 'food' },
    { x: 1320, y: 236, type: 'crate',   contains: 'coin' },
    { x: 1710, y: 202, type: 'barrel',  contains: 'food' },
    { x: 2180, y: 234, type: 'crate',   contains: 'coin' }
  ];

  function defaultSettings() {
    return {
      lang: 'ru', gfx: 'retro', audioStyle: 'chip',
      music: true, sfx: true, volume: 0.8, crt: true,
      difficulty: 'normal', best: 0
    };
  }

  function loadSettings() {
    var s = defaultSettings();
    saveTry(function () {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return;
      if (o.lang === 'ru' || o.lang === 'en') s.lang = o.lang;
      if (o.gfx === 'retro' || o.gfx === 'modern') s.gfx = o.gfx;
      if (o.audioStyle === 'chip' || o.audioStyle === 'synth') s.audioStyle = o.audioStyle;
      if (typeof o.music === 'boolean') s.music = o.music;
      if (typeof o.sfx === 'boolean') s.sfx = o.sfx;
      if (typeof o.volume === 'number') s.volume = clamp(o.volume, 0, 1);
      if (typeof o.crt === 'boolean') s.crt = o.crt;
      if (DIFF_IDS.indexOf(o.difficulty) >= 0) s.difficulty = o.difficulty;
      if (typeof o.best === 'number') s.best = Math.max(0, Math.floor(o.best));
    });
    return s;
  }

  /* ---------- состояние ---------- */
  var NR = window.NR = {};
  NR.W = W; NR.H = H;
  NR.t = T;
  NR.settings = loadSettings();
  NR.input = {
    left: false, right: false, up: false, down: false,
    jump: false, punch: false, kick: false, special: false,
    pointer: { x: 240, y: 135 }
  };
  NR.wantFullscreen = false;

  var UID = 1;
  function uid() { return UID++; }

  function makePlayer(charIdx) {
    var c = CHARS[clamp(charIdx || 0, 0, CHARS.length - 1)];
    return {
      id: uid(), kind: 'player', char: c.id, charIdx: CHARS.indexOf(c),
      x: 70, y: 214, z: 0, vx: 0, vy: 0, vz: 0, facing: 1,
      hp: c.hp, maxHp: c.hp, state: 'idle', anim: 'idle', animT: 0,
      attack: null, punchStep: 0, punchWindow: 0, chainQueued: false,
      hurtT: 0, invuln: 0, flash: 0, dead: false, deadT: 0,
      rage: 0, maxRage: 100, specialReady: false, comboStep: 0,
      scale: 1, alpha: 1, airAttack: false,
      jumpBuffer: 0, punchBuffer: 0, kickBuffer: 0, specialBuffer: 0
    };
  }

  function makeRun(charIdx, diffId) {
    return {
      char: clamp(charIdx || 0, 0, 1),
      difficulty: DIFF_IDS.indexOf(diffId) >= 0 ? diffId : 'normal',
      score: 0, best: NR.settings.best, newBest: false, lives: 3,
      wave: 0, waveCount: WAVES.length, waveActive: false, zone: 0,
      elapsed: 0, kills: 0, maxCombo: 0,
      combo: 0, comboT: 0, hitstop: 0, shake: 0, flash: 0,
      bossIntro: 0, bossDefeated: false, victoryT: 0, deadT: 0,
      advance: false, banner: null,
      gate: { active: false, left: 0, right: 0 },
      stats: { hits: 0, kills: 0, maxCombo: 0 },
      startTime: 0
    };
  }

  function createState() {
    return {
      mode: 'title', modeT: 0, t: 0, freeze: false, prevMode: 'title',
      menuIndex: 0, pauseIndex: 0, settingsIndex: 0, endIndex: 0,
      settingsFrom: 'title', helpFrom: 'title', aboutFrom: 'title',
      select: { char: 0, diff: DIFF_IDS.indexOf(NR.settings.difficulty) },
      uiRects: null,
      camera: { x: 0, shakeX: 0, shakeY: 0, shake: 0 },
      world: {
        width: WORLD_W, minX: 24, maxX: WORLD_W - 24,
        minY: 174, maxY: 250, groundTop: 158, groundBottom: 260
      },
      zones: ZONES,
      run: makeRun(0, NR.settings.difficulty),
      player: makePlayer(0), enemies: [], boss: null,
      props: [], pickups: [], projectiles: [], particles: [], popups: [],
      toast: null
    };
  }

  NR.state = createState();
  var S = NR.state;

  /* ---------- UI-прямоугольники ---------- */
  function R(x, y, w, h, extra) {
    var o = { x: x, y: y, w: w, h: h };
    if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }

  function buildUIRects() {
    var menu = [], quick = [], pause = [], settings = [], chars = [], diffs = [], end = [];
    var menuActions = ['play', 'help', 'settings', 'about'];
    var quickActions = ['gfx', 'lang', 'music', 'fullscreen'];
    var pauseActions = ['resume', 'settings', 'restart', 'title'];
    var settingIds = ['lang', 'gfx', 'music', 'audioStyle', 'sfx', 'volume', 'crt', 'difficulty', 'reset'];
    var i;
    for (i = 0; i < 4; i++) menu.push(R(160, 164 + i * 21, 160, 18, { action: menuActions[i] }));
    for (i = 0; i < 4; i++) quick.push(R(250 + i * 56, 8, 52, 13, { action: quickActions[i] }));
    for (i = 0; i < 4; i++) pause.push(R(160, 112 + i * 21, 160, 18, { action: pauseActions[i] }));
    for (i = 0; i < settingIds.length; i++) settings.push(R(96, 76 + i * 17, 288, 15, { id: settingIds[i] }));
    chars.push(R(36, 52, 198, 150, { index: 0 }));
    chars.push(R(246, 52, 198, 150, { index: 1 }));
    for (i = 0; i < 3; i++) diffs.push(R(112 + i * 84, 214, 76, 14, { index: i }));
    end.push(R(170, 188, 140, 18, { action: 'retry' }));
    end.push(R(170, 210, 140, 18, { action: 'title' }));
    return {
      menu: menu, quick: quick, pause: pause, settings: settings,
      chars: chars, diffs: diffs, end: end,
      back: R(364, 248, 104, 14, { action: 'back' }),
      selectStart: R(180, 242, 120, 16, { action: 'start' })
    };
  }

  /* ---------- звук ---------- */
  var lastTrack = null;

  function sfx(id) {
    try { if (window.NR_AUDIO && window.NR_AUDIO.sfx) window.NR_AUDIO.sfx(id); } catch (e) { /* тихо */ }
  }

  function applyAudioSettings() {
    var A = window.NR_AUDIO;
    if (!A) return;
    try {
      if (A.setMusic) A.setMusic(NR.settings.music);
      if (A.setSfx) A.setSfx(NR.settings.sfx);
      if (A.setVolume) A.setVolume(NR.settings.volume);
      if (A.setStyle) A.setStyle(NR.settings.audioStyle);
    } catch (e) { /* тихо */ }
  }

  function trackForMode() {
    var m = S.mode;
    if (m === 'title' || m === 'help' || m === 'about') return 'title';
    if (m === 'settings') return S.settingsFrom === 'paused' ? null : 'title';
    if (m === 'select' || m === 'intro') return 'select';
    if (m === 'play' || m === 'dead') {
      if (S.run.bossIntro > 0 || (S.run.wave === 4 && !S.run.bossDefeated)) return 'boss';
      return 'battle';
    }
    if (m === 'paused') return null;
    if (m === 'gameover') return 'gameover';
    if (m === 'victory') return 'victory';
    return null;
  }

  function ducked() {
    return S.mode === 'paused' || (S.mode === 'settings' && S.settingsFrom === 'paused');
  }

  function syncMusic(force) {
    var A = window.NR_AUDIO;
    if (!A) return;
    try {
      if (A.duck) A.duck(ducked());
      var track = trackForMode();
      if (track) {
        if (force || track !== lastTrack) {
          if (A.playMusic) A.playMusic(track);
          lastTrack = track;
        }
      }
    } catch (e) { /* тихо */ }
  }

  NR.syncAudio = function () {
    applyAudioSettings();
    syncMusic(true);
  };

  function setIntensity(v) {
    try { if (window.NR_AUDIO && window.NR_AUDIO.intensity) window.NR_AUDIO.intensity(clamp(v, 0, 1)); } catch (e) { /* тихо */ }
  }

  /* ---------- настройки / DOM ---------- */
  function saveSettings() {
    saveTry(function () { window.localStorage.setItem(STORE_KEY, JSON.stringify(NR.settings)); });
  }

  function applyDom() {
    try {
      document.documentElement.lang = NR.settings.lang;
      document.documentElement.setAttribute('data-gfx', NR.settings.gfx);
    } catch (e) { /* тихо */ }
  }

  NR.toggleGfx = function () {
    NR.settings.gfx = NR.settings.gfx === 'retro' ? 'modern' : 'retro';
    saveSettings(); applyDom(); sfx('ui_select');
  };
  NR.toggleLang = function () {
    NR.settings.lang = NR.settings.lang === 'ru' ? 'en' : 'ru';
    saveSettings(); applyDom(); sfx('ui_select');
  };
  NR.toggleMusic = function () {
    NR.settings.music = !NR.settings.music;
    saveSettings();
    applyAudioSettings();
    if (NR.settings.music) syncMusic(true);
    sfx('ui_select');
  };
  NR.toggleSfx = function () {
    NR.settings.sfx = !NR.settings.sfx;
    saveSettings(); applyAudioSettings(); sfx('ui_select');
  };
  NR.toggleCrt = function () {
    NR.settings.crt = !NR.settings.crt;
    saveSettings(); sfx('ui_select');
  };
  NR.toggleAudioStyle = function () {
    NR.settings.audioStyle = NR.settings.audioStyle === 'chip' ? 'synth' : 'chip';
    saveSettings(); applyAudioSettings(); sfx('ui_select');
  };

  function setDifficulty(id) {
    if (DIFF_IDS.indexOf(id) < 0) return;
    NR.settings.difficulty = id;
    S.select.diff = DIFF_IDS.indexOf(id);
    saveSettings();
  }

  function resetBest() {
    NR.settings.best = 0;
    S.run.best = 0;
    S.run.newBest = false;
    saveSettings();
    S.toast = { text: T('settings.resetDone'), t: 0, dur: 1.8 };
    sfx('ui_select');
  }

  function adjustSetting(id, dir) {
    if (id === 'lang') NR.toggleLang();
    else if (id === 'gfx') NR.toggleGfx();
    else if (id === 'music') NR.toggleMusic();
    else if (id === 'audioStyle') NR.toggleAudioStyle();
    else if (id === 'sfx') NR.toggleSfx();
    else if (id === 'crt') NR.toggleCrt();
    else if (id === 'volume') {
      NR.settings.volume = Math.round(clamp(NR.settings.volume + dir * 0.1, 0, 1) * 10) / 10;
      saveSettings(); applyAudioSettings(); sfx('ui_move');
    } else if (id === 'difficulty') {
      var i = DIFF_IDS.indexOf(NR.settings.difficulty);
      i = (i + (dir > 0 ? 1 : DIFF_IDS.length - 1)) % DIFF_IDS.length;
      setDifficulty(DIFF_IDS[i]);
      sfx('ui_move');
    } else if (id === 'reset') {
      resetBest();
    }
  }

  /* ---------- режимы ---------- */
  function setMode(mode) {
    if (S.mode === mode) { S.modeT = 0; syncMusic(false); return; }
    S.prevMode = S.mode;
    S.mode = mode;
    S.modeT = 0;
    if (mode === 'paused') S.pauseIndex = 0;
    if (mode === 'settings') S.settingsIndex = 0;
    if (mode === 'gameover' || mode === 'victory') S.endIndex = 0;
    if (NR.settings.audioStyle) applyAudioSettings();
    try {
      if (window.NR_AUDIO && window.NR_AUDIO.duck) {
        window.NR_AUDIO.duck(mode === 'paused' || (mode === 'settings' && S.settingsFrom === 'paused'));
      }
    } catch (e) { /* тихо */ }
    applyDom();
    syncMusic(false);
  }

  function pauseGame() {
    if (S.mode !== 'play') return;
    S.prevMode = S.mode;
    setMode('paused');
    sfx('ui_select');
  }

  function resumeGame() {
    if (S.mode !== 'paused') return;
    setMode('play');
    sfx('ui_back');
  }

  function openSettings(from) {
    S.settingsFrom = from || S.mode;
    setMode('settings');
    sfx('ui_select');
  }

  function closeSettings() {
    var back = S.settingsFrom || 'title';
    if (back === 'paused') {
      S.mode = 'paused';
      S.modeT = 0;
      S.pauseIndex = 0;
      try { if (window.NR_AUDIO && window.NR_AUDIO.duck) window.NR_AUDIO.duck(true); } catch (e) { /* тихо */ }
      sfx('ui_back');
      return;
    }
    setMode(back);
    sfx('ui_back');
  }

  function openHelp() {
    S.helpFrom = S.mode;
    setMode('help');
    sfx('ui_select');
  }
  function openAbout() {
    S.aboutFrom = S.mode;
    setMode('about');
    sfx('ui_select');
  }
  function closeHelp() {
    setMode(S.helpFrom || 'title');
    sfx('ui_back');
  }
  function closeAbout() {
    setMode(S.aboutFrom || 'title');
    sfx('ui_back');
  }

  function startRun(charIdx, diffId, skipIntro) {
    if (typeof charIdx !== 'number') charIdx = S.select.char;
    charIdx = clamp(charIdx, 0, CHARS.length - 1);
    if (typeof diffId !== 'string' || DIFF_IDS.indexOf(diffId) < 0) {
      diffId = DIFF_IDS[clamp(S.select.diff, 0, 2)];
    }
    setDifficulty(diffId);
    S.select.char = charIdx;
    S.select.diff = DIFF_IDS.indexOf(diffId);
    S.run = makeRun(charIdx, diffId);
    S.player = makePlayer(charIdx);
    S.enemies = [];
    S.boss = null;
    S.props = createProps();
    S.pickups = [];
    S.projectiles = [];
    S.particles = [];
    S.popups = [];
    S.camera = { x: 0, shakeX: 0, shakeY: 0, shake: 0 };
    S.freeze = false;
    S.run.best = NR.settings.best;
    if (skipIntro) beginRun();
    else setMode('intro');
  }

  function beginRun() {
    S.run.lives = 3;
    S.run.score = 0;
    S.run.elapsed = 0;
    S.run.kills = 0;
    S.run.maxCombo = 0;
    S.run.combo = 0;
    S.run.comboT = 0;
    S.run.stats = { hits: 0, kills: 0, maxCombo: 0 };
    S.run.wave = 0;
    S.run.waveActive = false;
    S.run.advance = false;
    S.run.zone = 0;
    S.run.bossIntro = 0;
    S.run.bossDefeated = false;
    S.run.victoryT = 0;
    S.run.deadT = 0;
    S.run.hitstop = 0;
    S.run.shake = 0;
    S.run.flash = 0;
    S.run.banner = null;
    S.run.gate = { active: false, left: 0, right: 0 };
    S.run.startTime = S.t;
    S.run.best = NR.settings.best;
    S.enemies = [];
    S.boss = null;
    S.props = createProps();
    S.pickups = [];
    S.projectiles = [];
    S.particles = [];
    S.popups = [];
    S.camera = { x: 0, shakeX: 0, shakeY: 0, shake: 0 };
    S.player = makePlayer(S.run.char);
    S.player.x = 70; S.player.y = 214; S.player.hp = S.player.maxHp;
    S.player.invuln = 0.8;
    setBanner('zone', 'zone.street', 'zone.streetSub', null, 2.4);
    setMode('play');
    setIntensity(0.25);
    syncMusic(true);
    sfx('ui_select');
  }

  function finishRun(victory) {
    if (S.mode === 'gameover' || S.mode === 'victory') return;
    if (S.run.score > NR.settings.best) {
      NR.settings.best = S.run.score;
      S.run.newBest = true;
      saveSettings();
    }
    S.run.best = NR.settings.best;
    S.run.victory = !!victory;
    if (S.player) {
      S.player.dead = !victory;
      if (victory) { S.player.state = 'victory'; S.player.anim = 'victory'; S.player.animT = 0; }
    }
    setMode(victory ? 'victory' : 'gameover');
    sfx(victory ? 'win' : 'gameover');
    syncMusic(true);
    saveSettings();
  }

  /* ---------- волны, зоны, босс ---------- */
  function setBanner(kind, titleKey, subKey, vars, dur) {
    S.run.banner = {
      kind: kind, titleKey: titleKey, subKey: subKey || null,
      vars: vars || null, t: 0, dur: dur || 2.1
    };
  }

  function updateBanner(dt) {
    var b = S.run.banner;
    if (!b) return;
    b.t += dt;
    if (b.t >= b.dur) S.run.banner = null;
  }

  function createProps() {
    var out = [];
    for (var i = 0; i < PROPS_LAYOUT.length; i++) {
      var p = PROPS_LAYOUT[i];
      out.push({
        id: uid(), type: p.type, x: p.x, y: p.y,
        w: p.type === 'barrel' ? 18 : p.type === 'vending' ? 26 : 22,
        h: p.type === 'vending' ? 34 : 24,
        hp: 1, broken: false, breakT: 0, shakeT: 0,
        contains: p.contains
      });
    }
    return out;
  }

  function spawnEnemy(kind, x, y) {
    var st = ENEMY_STATS[kind] || ENEMY_STATS.punk;
    var diff = DIFFS[S.run.difficulty] || DIFFS.normal;
    var hp = Math.max(8, Math.round(st.hp * diff.hp));
    var e = {
      id: uid(), kind: kind, char: kind,
      x: x, y: y, z: 0, vx: 0, vy: 0, vz: 0,
      facing: S.player && S.player.x > x ? 1 : -1,
      hp: hp, maxHp: hp, state: 'idle', anim: 'idle', animT: 0,
      attack: null, hurtT: 0, invuln: 0, flash: 0, dead: false, deadT: 0,
      rage: 0, maxRage: 0, specialReady: false, comboStep: 0,
      scale: st.scale, alpha: 1,
      dmg: st.dmg * diff.dmg, speed: st.speed * diff.speed,
      reach: st.reach, depthReach: st.depthReach,
      wind: st.wind, active: st.active, recover: st.recover,
      baseCd: st.cd, score: st.score, armor: !!st.armor, push: st.push,
      isBoss: false,
      ai: {
        side: x < S.player.x ? -1 : 1,
        offY: rand(-18, 18),
        cd: rand(0.7, 1.6),
        jumpCd: kind === 'ninja' ? rand(1.4, 2.6) : 0,
        think: 0
      }
    };
    S.enemies.push(e);
    return e;
  }

  function spawnBoss(arena) {
    var diff = DIFFS[S.run.difficulty] || DIFFS.normal;
    var hp = Math.round(BOSS_STATS.hp * (0.85 + (diff.hp - 0.78) * 0.55));
    var b = {
      id: uid(), kind: 'boss', char: 'khrom',
      x: arena[1] - 180, y: 214, z: 16, vx: 0, vy: 0, vz: 0,
      facing: -1,
      hp: hp, maxHp: hp, state: 'idle', anim: 'idle', animT: 0,
      attack: null, hurtT: 0, invuln: 3, flash: 0, dead: false, deadT: 0,
      rage: 0, maxRage: 0, specialReady: false, comboStep: 0,
      scale: BOSS_STATS.scale, alpha: 1,
      dmg: BOSS_STATS.dmg * diff.dmg, speed: BOSS_STATS.speed,
      score: BOSS_STATS.score, isBoss: true, armor: true,
      phase2: false, phaseT: 0, summoned: false,
      ai: { cd: 1.4, tick: 0 }
    };
    S.enemies.push(b);
    S.boss = b;
    return b;
  }

  function startWave(idx) {
    var w = WAVES[idx];
    if (!w) return;
    S.run.wave = idx;
    S.run.waveActive = true;
    S.run.advance = false;
    S.run.zone = w.zone;
    S.run.waveT = 0;
    S.run.gate = { active: true, left: w.arena[0], right: w.arena[1] };
    S.enemies = S.enemies.filter(function (e) { return !e.dead; });
    S.popups = [];
    S.projectiles = [];
    var arena = w.arena;
    if (w.boss) {
      var b = spawnBoss(arena);
      S.run.bossIntro = 2.9;
      b.invuln = 99;
      b.anim = 'roar';
      b.animT = 0;
      S.player.invuln = Math.max(S.player.invuln, 3.2);
      setBanner('boss', 'banner.boss', 'banner.bossSub', null, 2.9);
      setIntensity(0.45);
    } else {
      for (var i = 0; i < w.spawns.length; i++) {
        var kind = w.spawns[i];
        var side = i % 2 === 0 ? -1 : 1;
        var sx = side < 0 ? arena[0] - 42 - i * 12 : arena[1] + 42 + i * 12;
        var sy = clamp(200 + rand(-26, 26), 184, 244);
        var e = spawnEnemy(kind, sx, sy);
        e.ai.side = side;
        e.ai.cd = rand(0.8, 2.0) + i * 0.16;
      }
      setBanner('wave', 'banner.wave', null, { n: idx + 1, total: WAVES.length }, 2.2);
      setIntensity((idx + 1) / WAVES.length * 0.75 + 0.1);
    }
    sfx('wave');
    syncMusic(true);
  }

  function clearWave() {
    S.run.waveActive = false;
    S.run.advance = true;
    S.run.gate.active = false;
    S.run.wave += 1;
    S.run.score += 200 + S.run.wave * 50;
    setBanner('clear', 'banner.clear', null, null, 1.9);
    setIntensity(clamp(0.25 + S.run.wave * 0.12, 0, 0.85));
    sfx('wave');
    syncMusic(true);
  }

  function bossDefeated() {
    if (S.run.bossDefeated) return;
    S.run.bossDefeated = true;
    S.run.waveActive = false;
    S.run.gate.active = false;
    S.run.victoryT = 2.6;
    S.run.score += BOSS_STATS.score;
    S.run.kills += 1;
    S.run.stats.kills += 1;
    S.run.flash = 1;
    S.run.shake = 12;
    S.player.invuln = 99;
    S.player.state = 'victory';
    S.player.anim = 'victory';
    S.player.animT = 0;
    S.player.vx = 0; S.player.vy = 0; S.player.z = 0;
    setBanner('victory', 'banner.victory', 'end.victorySub', null, 2.6);
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e !== S.boss && !e.dead) {
        e.dead = true; e.deadT = 0; e.state = 'down'; e.anim = 'down';
        e.vx = rand(-80, 80);
      }
    }
    sfx('win');
    setIntensity(0);
  }

  function zoneIndexForX(x) {
    if (x >= ZONES[1].start) return x >= ZONES[2].start ? 2 : 1;
    return 0;
  }

  function updateZone(dt) {
    if (S.run.waveActive || S.run.bossDefeated) return;
    var z = zoneIndexForX(S.player.x);
    if (z !== S.run.zone) {
      S.run.zone = z;
      if (!S.run.banner) {
        setBanner('zone', ZONES[z].nameKey, ZONES[z].subKey, null, 2.3);
      }
      sfx('ui_move');
    }
  }

  /* ---------- пункты меню ---------- */
  function titleMenuAction() {
    var a = S.uiRects.menu[S.menuIndex] && S.uiRects.menu[S.menuIndex].action;
    if (a === 'play') { S.select.char = S.select.char || 0; setMode('select'); sfx('ui_select'); }
    else if (a === 'help') { openHelp(); }
    else if (a === 'settings') { openSettings('title'); }
    else if (a === 'about') { openAbout(); }
  }

  function selectStart() {
    startRun(S.select.char, DIFF_IDS[clamp(S.select.diff, 0, 2)], false);
    sfx('ui_select');
  }

  function pauseMenuAction() {
    var a = S.uiRects.pause[S.pauseIndex] && S.uiRects.pause[S.pauseIndex].action;
    if (a === 'resume') resumeGame();
    else if (a === 'settings') { S.settingsFrom = 'paused'; openSettings('paused'); }
    else if (a === 'restart') { startRun(S.run.char, S.run.difficulty, true); sfx('ui_select'); }
    else if (a === 'title') { setMode('title'); sfx('ui_back'); }
  }

  function endMenuAction() {
    var a = S.uiRects.end[S.endIndex] && S.uiRects.end[S.endIndex].action;
    if (a === 'retry') {
      startRun(S.run.char, S.run.difficulty, true);
      sfx('ui_select');
    } else {
      setMode('title');
      sfx('ui_back');
    }
  }

  function pressList(n, idx, delta) {
    return (idx + (delta > 0 ? 1 : n - 1) + n) % n;
  }

  /* ---------- ввод ---------- */
  NR.setHeld = function (name, on) {
    if (!name) return;
    if (Object.prototype.hasOwnProperty.call(NR.input, name) && typeof NR.input[name] === 'boolean') {
      NR.input[name] = !!on;
    }
  };

  function isMenuMode() {
    return S.mode === 'title' || S.mode === 'select' || S.mode === 'help' ||
      S.mode === 'settings' || S.mode === 'about' || S.mode === 'paused' ||
      S.mode === 'gameover' || S.mode === 'victory' || S.mode === 'intro';
  }

  NR.press = function (action) {
    if (!action) return;
    /* быстрые переключатели работают везде */
    if (action === 'gfx') { NR.toggleGfx(); return; }
    if (action === 'lang') { NR.toggleLang(); return; }
    if (action === 'music') { NR.toggleMusic(); return; }
    if (action === 'fullscreen') { NR.wantFullscreen = true; return; }

    if (S.mode === 'play' || S.mode === 'dead') {
      if (S.mode === 'dead') return;
      if (action === 'pause' || action === 'back') { pauseGame(); return; }
      var p = S.player;
      if (!p || p.dead) return;
      if (action === 'jump') { p.jumpBuffer = 0.14; }
      else if (action === 'punch') { p.punchBuffer = 0.16; }
      else if (action === 'kick') { p.kickBuffer = 0.16; }
      else if (action === 'special') { p.specialBuffer = 0.18; }
      return;
    }

    if (S.mode === 'paused') {
      if (action === 'pause' || action === 'back') { resumeGame(); return; }
      if (action === 'up' || action === 'down') {
        S.pauseIndex = pressList(4, S.pauseIndex, action === 'up' ? -1 : 1);
        sfx('ui_move'); return;
      }
      if (action === 'confirm') { pauseMenuAction(); return; }
      return;
    }

    if (S.mode === 'title') {
      if (action === 'up' || action === 'down') {
        S.menuIndex = pressList(4, S.menuIndex, action === 'up' ? -1 : 1);
        sfx('ui_move'); return;
      }
      if (action === 'confirm') { titleMenuAction(); return; }
      return;
    }

    if (S.mode === 'select') {
      if (action === 'left' || action === 'right') {
        S.select.char = S.select.char === 0 ? 1 : 0;
        sfx('ui_move'); return;
      }
      if (action === 'up' || action === 'down') {
        S.select.diff = pressList(3, S.select.diff, action === 'up' ? -1 : 1);
        sfx('ui_move'); return;
      }
      if (action === 'confirm') { selectStart(); return; }
      if (action === 'back') { setMode('title'); sfx('ui_back'); return; }
      return;
    }

    if (S.mode === 'intro') {
      if (action === 'confirm' || action === 'back') {
        beginRun();
      }
      return;
    }

    if (S.mode === 'settings') {
      if (action === 'up' || action === 'down') {
        S.settingsIndex = pressList(S.uiRects.settings.length, S.settingsIndex, action === 'up' ? -1 : 1);
        sfx('ui_move'); return;
      }
      if (action === 'left') {
        adjustSetting(S.uiRects.settings[S.settingsIndex].id, -1); return;
      }
      if (action === 'right' || action === 'confirm') {
        adjustSetting(S.uiRects.settings[S.settingsIndex].id, 1); return;
      }
      if (action === 'back' || action === 'pause') { closeSettings(); return; }
      return;
    }

    if (S.mode === 'help') {
      if (action === 'back' || action === 'confirm' || action === 'pause') closeHelp();
      return;
    }
    if (S.mode === 'about') {
      if (action === 'back' || action === 'confirm' || action === 'pause') closeAbout();
      return;
    }
    if (S.mode === 'gameover' || S.mode === 'victory') {
      if (action === 'up' || action === 'down') {
        S.endIndex = pressList(2, S.endIndex, action === 'up' ? -1 : 1);
        sfx('ui_move'); return;
      }
      if (action === 'confirm') { endMenuAction(); return; }
      if (action === 'back' || action === 'pause') { setMode('title'); sfx('ui_back'); return; }
    }
  };

  /* ---------- мышь / тач ---------- */
  function hitRect(r, x, y) {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function findQuick(x, y) {
    var q = S.uiRects && S.uiRects.quick;
    if (!q) return null;
    for (var i = 0; i < q.length; i++) if (hitRect(q[i], x, y)) return q[i];
    return null;
  }

  NR.pointerDown = function (x, y) {
    S.pointer = { x: x, y: y };
    if (!S.uiRects) return;
    var q = findQuick(x, y);
    if (q && (S.mode === 'title' || S.mode === 'select' || S.mode === 'help' ||
      S.mode === 'settings' || S.mode === 'about' || S.mode === 'paused')) {
      NR.press(q.action);
      return;
    }
    var i;
    if (S.mode === 'title') {
      for (i = 0; i < S.uiRects.menu.length; i++) {
        if (hitRect(S.uiRects.menu[i], x, y)) {
          S.menuIndex = i; titleMenuAction(); return;
        }
      }
    } else if (S.mode === 'select') {
      for (i = 0; i < S.uiRects.chars.length; i++) {
        if (hitRect(S.uiRects.chars[i], x, y)) { S.select.char = S.uiRects.chars[i].index; sfx('ui_move'); return; }
      }
      for (i = 0; i < S.uiRects.diffs.length; i++) {
        if (hitRect(S.uiRects.diffs[i], x, y)) { S.select.diff = S.uiRects.diffs[i].index; sfx('ui_move'); return; }
      }
      if (hitRect(S.uiRects.selectStart, x, y)) { selectStart(); return; }
    } else if (S.mode === 'settings') {
      for (i = 0; i < S.uiRects.settings.length; i++) {
        if (hitRect(S.uiRects.settings[i], x, y)) {
          S.settingsIndex = i;
          adjustSetting(S.uiRects.settings[i].id, 1);
          return;
        }
      }
      if (hitRect(S.uiRects.back, x, y)) { closeSettings(); return; }
    } else if (S.mode === 'paused') {
      for (i = 0; i < S.uiRects.pause.length; i++) {
        if (hitRect(S.uiRects.pause[i], x, y)) { S.pauseIndex = i; pauseMenuAction(); return; }
      }
    } else if (S.mode === 'gameover' || S.mode === 'victory') {
      for (i = 0; i < S.uiRects.end.length; i++) {
        if (hitRect(S.uiRects.end[i], x, y)) { S.endIndex = i; endMenuAction(); return; }
      }
    } else if (S.mode === 'help') {
      if (hitRect(S.uiRects.back, x, y)) closeHelp();
    } else if (S.mode === 'about') {
      if (hitRect(S.uiRects.back, x, y)) closeAbout();
    } else if (S.mode === 'intro') {
      beginRun();
    } else if (S.mode === 'play') {
      /* тап по игровому полю — только подсказка-фокус; тач-кнопки отдельно */
      NR.input.pointer.x = x; NR.input.pointer.y = y;
    }
  };

  NR.pointerUp = function () { /* пока не требуется */ };

  /* ---------- инициализация ---------- */
  NR.init = function () {
    S = NR.state;
    S.uiRects = buildUIRects();
    applyDom();
    syncMusic(false);
  };

  /* ============================================================
     БОЙ
     ============================================================ */
  function charOf(p) { return CHARS[p && p.charIdx != null ? p.charIdx : 0] || CHARS[0]; }

  function faceNearest(p) {
    var best = null, bestD = 1e9;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      var dx = Math.abs(e.x - p.x), dy = Math.abs(e.y - p.y);
      if (dx < 110 && dy < 54) {
        var d = dx + dy * 0.5;
        if (d < bestD) { bestD = d; best = e; }
      }
    }
    if (best) p.facing = best.x >= p.x ? 1 : -1;
  }

  function playerAttackDef(p, type) {
    var c = charOf(p);
    var slow = c.id === 'hammer' ? 1.14 : 1;
    var pow = c.power;
    if (type === 'jab') return {
      wind: 0.055 * slow, active: 0.075, recover: 0.11 * slow,
      dmg: 6 * pow, reach: 36, depth: 21, knock: 70, maxTargets: 1, sfx: 'punch'
    };
    if (type === 'cross') return {
      wind: 0.06 * slow, active: 0.08, recover: 0.13 * slow,
      dmg: 7.5 * pow, reach: 39, depth: 22, knock: 95, maxTargets: 1, sfx: 'punch'
    };
    if (type === 'finisher') return {
      wind: 0.09 * slow, active: 0.10, recover: 0.22 * slow,
      dmg: 13 * pow, reach: 43, depth: 24, knock: 250, maxTargets: 2, sfx: 'hit_heavy'
    };
    if (type === 'kick') return {
      wind: 0.11 * slow, active: 0.11, recover: 0.21 * slow,
      dmg: 11.5 * pow, reach: 49, depth: 25, knock: 210, maxTargets: 2, sfx: 'kick'
    };
    if (type === 'jumpkick') return {
      wind: 0.045, active: 0.30, recover: 0.10,
      dmg: 14 * pow, reach: 44, depth: 26, knock: 240, maxTargets: 3, sfx: 'kick'
    };
    return {
      wind: 0.26, active: 0.24, recover: 0.30,
      dmg: c.specialDmg, radius: c.specialR, depth: 54,
      knock: 300, maxTargets: 99, sfx: 'special'
    };
  }

  function startAttack(p, type) {
    var d = playerAttackDef(p, type);
    var anim = type;
    if (type === 'jab') anim = 'punch1';
    else if (type === 'cross') anim = 'punch2';
    else if (type === 'finisher') anim = 'punch3';
    p.attack = { type: type, phase: 'wind', t: 0, def: d, done: false, hitIds: [] };
    p.state = 'attack';
    p.anim = anim;
    p.animT = 0;
    p.chainQueued = false;
    p.vx = 0; p.vy = 0;
    if (type === 'special') {
      p.invuln = Math.max(p.invuln, 0.75);
      S.run.flash = Math.max(S.run.flash, 0.55);
      S.run.shake = Math.max(S.run.shake, 7);
      sfx('special');
    } else {
      sfx(d.sfx === 'hit_heavy' ? 'punch' : d.sfx);
    }
  }

  function startPunch(p) {
    if (p.punchWindow > 0 && p.punchStep > 0 && p.punchStep < 3) p.punchStep += 1;
    else p.punchStep = 1;
    var type = p.punchStep === 1 ? 'jab' : p.punchStep === 2 ? 'cross' : 'finisher';
    p.punchWindow = 0;
    faceNearest(p);
    startAttack(p, type);
  }

  function startKick(p) {
    faceNearest(p);
    p.punchStep = 0;
    p.punchWindow = 0;
    startAttack(p, 'kick');
  }

  function startSpecial(p) {
    if (p.rage < p.maxRage) return false;
    p.rage = 0;
    p.specialReady = false;
    faceNearest(p);
    startAttack(p, 'special');
    return true;
  }

  function endPlayerAttack(p) {
    var wasPunch = p.attack && (p.attack.type === 'jab' || p.attack.type === 'cross');
    var wasFinisher = p.attack && p.attack.type === 'finisher';
    p.attack = null;
    if (p.dead || p.hurtT > 0) return;
    p.state = 'idle';
    p.anim = 'idle';
    p.animT = 0;
    if (wasPunch) p.punchWindow = 0.25;
    if (wasFinisher) { p.punchStep = 0; p.punchWindow = 0; }
    if (p.chainQueued && wasPunch) {
      p.chainQueued = false;
      startPunch(p);
      return;
    }
    if (p.kickBuffer > 0) { p.kickBuffer = 0; startKick(p); return; }
    if (p.specialBuffer > 0 && p.rage >= p.maxRage) {
      p.specialBuffer = 0;
      startSpecial(p);
      return;
    }
  }

  function inFront(a, b, reach, depth, zRange) {
    var dx = (b.x - a.x) * a.facing;
    if (dx < -10) return false;
    if (dx > reach + (b.scale || 1) * 9) return false;
    if (Math.abs(b.y - a.y) > depth + (b.scale || 1) * 4) return false;
    if (Math.abs((b.z || 0) - (a.z || 0)) > (zRange || 54)) return false;
    return true;
  }

  function registerCombo() {
    S.run.combo += 1;
    S.run.comboT = 2.1;
    if (S.run.combo > S.run.maxCombo) S.run.maxCombo = S.run.combo;
    if (S.run.combo > S.run.stats.maxCombo) S.run.stats.maxCombo = S.run.combo;
    S.run.stats.hits += 1;
  }

  function addScoreHit(dmg) {
    var mult = 1 + S.run.combo * 0.08;
    S.run.score += Math.round((7 + dmg * 1.4) * mult);
  }

  function addPopup(text, x, y, z, color, kind, dur) {
    S.popups.push({
      text: String(text), sub: '', x: x, y: y, z: z || 0,
      t: 0, dur: dur || 0.85, color: color || '#ffd34d', kind: kind || 'damage'
    });
    if (S.popups.length > 40) S.popups.shift();
  }

  function sparkBurst(x, y, z, n, color, power) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2), sp = rand(30, 150) * (power || 1);
      S.particles.push({
        kind: i % 3 === 0 ? 'star' : 'spark',
        x: x, y: y, z: z || 0,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.35,
        vz: rand(20, 130) * (power || 1),
        life: rand(0.18, 0.46), maxLife: 0.46,
        size: rand(1, 3), color: color || '#ffd34d', rot: rand(0, 6)
      });
    }
    if (S.particles.length > 300) S.particles.splice(0, S.particles.length - 300);
  }

  function dust(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      S.particles.push({
        kind: 'dust', x: x + rand(-8, 8), y: y + rand(-3, 3), z: rand(0, 5),
        vx: rand(-35, 35), vy: rand(-8, 8), vz: rand(4, 22),
        life: rand(0.25, 0.55), maxLife: 0.55, size: rand(2, 5),
        color: color || '#7b6cae', rot: 0
      });
    }
  }

  function ringFx(x, y, z, size, color) {
    S.particles.push({
      kind: 'ring', x: x, y: y, z: z || 0,
      vx: 0, vy: 0, vz: 0,
      life: 0.4, maxLife: 0.4, size: size, color: color || '#22e6ff', rot: 0
    });
  }

  function shards(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      S.particles.push({
        kind: 'shard', x: x, y: y, z: rand(4, 20),
        vx: rand(-90, 90), vy: rand(-20, 20), vz: rand(40, 150),
        life: rand(0.35, 0.7), maxLife: 0.7, size: rand(1, 3),
        color: color || '#c98b3c', rot: rand(0, 6)
      });
    }
  }

  function doPlayerHits(p, a, d) {
    var i, hits = 0, maxTargets = a.type === 'special' ? 99 : (d.maxTargets || 1);
    var targets = [];
    if (a.type === 'special') {
      for (i = 0; i < S.enemies.length; i++) {
        var e0 = S.enemies[i];
        if (e0.dead) continue;
        if (Math.abs(e0.x - p.x) < (d.radius + 12) * (e0.scale || 1) && Math.abs(e0.y - p.y) < d.depth &&
          Math.abs((e0.z || 0) - p.z) < 70) targets.push(e0);
      }
    } else {
      for (i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (e.dead || a.hitIds.indexOf(e.id) >= 0) continue;
        if (inFront(p, e, d.reach, d.depth)) targets.push(e);
      }
      targets.sort(function (m, n) {
        return Math.abs(m.x - p.x) - Math.abs(n.x - p.x);
      });
    }
    for (i = 0; i < targets.length && hits < maxTargets; i++) {
      var t = targets[i];
      if (a.hitIds.indexOf(t.id) >= 0) continue;
      a.hitIds.push(t.id);
      hits += 1;
      if (t.isBoss) damageBoss(t, d.dmg, p);
      else damageEnemy(t, d.dmg, p, d);
    }
    /* ящики/бочки */
    if (a.type === 'special') {
      for (i = 0; i < S.props.length; i++) {
        var pr = S.props[i];
        if (!pr.broken && Math.abs(pr.x - p.x) < d.radius + 16 && Math.abs(pr.y - p.y) < d.depth + 10) breakProp(pr);
      }
    } else {
      for (i = 0; i < S.props.length; i++) {
        var prop = S.props[i];
        if (!prop.broken && inFront(p, prop, d.reach + 12, d.depth + 8)) breakProp(prop);
      }
    }
    if (hits > 0) {
      S.run.hitstop = Math.max(S.run.hitstop, a.type === 'special' ? 0.085 : 0.045);
      S.run.shake = Math.max(S.run.shake, a.type === 'special' ? 9 : 3.5);
      if (a.type === 'special') {
        ringFx(p.x, p.y, p.z + 16, d.radius, '#22e6ff');
        ringFx(p.x, p.y, p.z + 10, d.radius * 0.65, '#ff2e88');
      }
    }
  }

  function damageEnemy(e, dmg, attacker, def) {
    if (!e || e.dead || e.invuln > 0) return false;
    e.hp -= dmg;
    e.flash = 0.17;
    e.animT = 0;
    var heavy = dmg >= 12 || (def && def.type === 'special');
    if (!(e.armor && dmg < 13)) {
      e.hurtT = heavy ? 0.34 : 0.22;
      e.state = 'hurt';
      e.anim = 'hurt';
      e.attack = null;
      var dir = attacker ? (e.x >= attacker.x ? 1 : -1) : 1;
      e.vx = dir * (def ? def.knock : 120) * 0.85;
      e.vy = rand(-18, 18);
      if (heavy) e.vz = 95;
    }
    registerCombo();
    addScoreHit(dmg);
    var pc = attacker ? attacker.rage : null;
    if (pc != null) pc = Math.min(S.player.maxRage, pc + (heavy ? 4 : 3));
    if (attacker && attacker.kind === 'player') {
      attacker.rage = Math.min(attacker.maxRage, attacker.rage + (heavy ? 4 : 3));
      attacker.specialReady = attacker.rage >= attacker.maxRage;
    }
    sparkBurst(e.x, e.y, (e.z || 0) + 30 * (e.scale || 1), heavy ? 12 : 7,
      e.isBoss ? '#ff2e88' : '#ffd34d', heavy ? 1.3 : 0.9);
    addPopup(Math.round(dmg), e.x, e.y, (e.z || 0) + 46 * (e.scale || 1),
      heavy ? '#ff2e88' : '#f4f0ff', 'damage', 0.7);
    sfx(heavy ? 'hit_heavy' : 'hit');
    if (e.hp <= 0) killEnemy(e, attacker);
    return true;
  }

  function killEnemy(e, attacker) {
    if (e.dead) return;
    e.dead = true;
    e.deadT = 0;
    e.hp = 0;
    e.state = 'down';
    e.anim = 'down';
    e.animT = 0;
    e.attack = null;
    e.vx = (e.vx || 0) * 1.4;
    S.run.kills += 1;
    S.run.stats.kills += 1;
    registerCombo();
    var mult = 1 + S.run.combo * 0.08;
    var pts = Math.round(e.score * (DIFFS[S.run.difficulty] || DIFFS.normal).score * mult);
    S.run.score += pts;
    addPopup('+' + pts, e.x, e.y, (e.z || 0) + 54, '#b6ff3a', 'score', 0.95);
    sparkBurst(e.x, e.y, (e.z || 0) + 26, 16, '#ff2e88', 1.2);
    sfx('ko');
  }

  function damageBoss(b, dmg, attacker) {
    if (!b || b.dead || b.invuln > 0) return false;
    b.hp -= dmg;
    b.flash = 0.14;
    registerCombo();
    addScoreHit(dmg * 1.6);
    if (attacker && attacker.kind === 'player') {
      attacker.rage = Math.min(attacker.maxRage, attacker.rage + 4);
      attacker.specialReady = attacker.rage >= attacker.maxRage;
    }
    sparkBurst(b.x, b.y, (b.z || 0) + 40, 11, '#ff2e88', 1.2);
    addPopup(Math.round(dmg), b.x, b.y, (b.z || 0) + 66, '#ff2e88', 'damage', 0.75);
    sfx('hit_heavy');
    S.run.hitstop = Math.max(S.run.hitstop, 0.05);
    S.run.shake = Math.max(S.run.shake, 4);
    if (!b.phase2 && b.hp <= b.maxHp * 0.5) {
      b.phase2 = true;
      b.phaseT = 1.6;
      b.invuln = 1.7;
      b.attack = null;
      b.anim = 'roar';
      b.animT = 0;
      S.run.flash = 0.75;
      S.run.shake = 11;
      setBanner('boss', 'boss.phase2', 'boss.sub', null, 2.2);
      sfx('boss_roar');
      spawnBossAdds();
    }
    if (b.hp <= 0) {
      b.hp = 0;
      b.dead = true;
      b.deadT = 0;
      b.state = 'down';
      b.anim = 'down';
      b.animT = 0;
      b.attack = null;
      b.vx = 0;
      sparkBurst(b.x, b.y, 50, 30, '#ff2e88', 1.8);
      sparkBurst(b.x, b.y, 32, 26, '#22e6ff', 1.5);
      ringFx(b.x, b.y, 20, 130, '#ff2e88');
      S.run.flash = 1;
      S.run.shake = 14;
      sfx('explosion');
      bossDefeated();
    }
    return true;
  }

  function spawnBossAdds() {
    if (S.run.bossDefeated) return;
    var g = S.run.gate;
    var src = [Math.max(80, g.left - 30), g.right + 30];
    for (var i = 0; i < 2; i++) {
      var e = spawnEnemy('ninja', src[i], clamp(S.player.y + rand(-30, 30), 188, 242));
      e.ai.side = i === 0 ? -1 : 1;
      e.ai.cd = 0.7 + i * 0.3;
      e.invuln = 0.35;
      e.flash = 0.2;
    }
  }

  function hurtPlayer(dmg, attacker) {
    var p = S.player;
    if (!p || p.dead || p.invuln > 0 || S.run.bossDefeated) return false;
    p.hp -= dmg;
    p.flash = 0.2;
    p.invuln = 0.95;
    p.hurtT = 0.31;
    p.state = 'hurt';
    p.anim = 'hurt';
    p.animT = 0;
    p.attack = null;
    p.vx = attacker && attacker.x < p.x ? 150 : -150;
    p.vy = rand(-16, 16);
    S.run.combo = 0;
    S.run.comboT = 0;
    p.rage = Math.min(p.maxRage, p.rage + 2);
    S.run.hitstop = Math.max(S.run.hitstop, 0.055);
    S.run.shake = Math.max(S.run.shake, 6);
    S.run.flash = Math.max(S.run.flash, 0.3);
    sparkBurst(p.x, p.y, p.z + 30, 12, '#ff2e88', 1);
    addPopup('-' + Math.round(dmg), p.x, p.y, p.z + 48, '#ff6b81', 'damage', 0.8);
    sfx('player_hurt');
    if (p.hp <= 0) playerDown();
    return true;
  }

  function playerDown() {
    var p = S.player;
    p.hp = 0;
    p.dead = true;
    p.deadT = 0;
    p.state = 'down';
    p.anim = 'down';
    p.animT = 0;
    p.attack = null;
    p.z = 0; p.vz = 0;
    S.run.lives = Math.max(0, S.run.lives - 1);
    S.run.deadT = 0;
    S.run.combo = 0;
    S.run.comboT = 0;
    S.run.hitstop = 0;
    S.run.banner = null;
    S.run.flash = 0;
    sfx('ko');
    setMode('dead');
  }

  function respawnPlayer() {
    var p = S.player;
    var g = S.run.gate;
    p.dead = false;
    p.hp = p.maxHp;
    p.state = 'idle';
    p.anim = 'idle';
    p.animT = 0;
    p.attack = null;
    p.z = 0; p.vz = 0; p.vx = 0; p.vy = 0;
    p.invuln = 2.5;
    p.flash = 0;
    p.rage = Math.min(p.rage, 50);
    p.facing = 1;
    p.x = g.active ? clamp((g.left + g.right) / 2, g.left + 24, g.right - 24)
                    : clamp(S.camera.x + W / 2, S.world.minX + 30, S.world.maxX - 30);
    p.y = clamp(p.y || 214, S.world.minY + 10, S.world.maxY - 10);
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.ai) e.ai.cd = Math.max(e.ai.cd || 0, 1.4);
    }
    S.run.deadT = 0;
    S.run.shake = 0;
    setBanner('ready', 'hud.ready', null, null, 1.3);
    setMode('play');
    sfx('land');
    syncMusic(true);
  }

  /* ---------- игрок ---------- */
  function updateJumpPhysics(p, dt) {
    if (p.z > 0 || p.vz !== 0) {
      p.z += p.vz * dt;
      p.vz -= 1050 * dt;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = 0;
        p.airAttack = false;
        dust(p.x, p.y, 5, '#8a7ab8');
        sfx('land');
        if (!p.attack && p.state === 'jump') { p.state = 'idle'; p.anim = 'idle'; }
      }
    }
  }

  function updatePlayer(dt) {
    var p = S.player;
    if (!p) return;
    p.animT += dt;
    if (p.flash > 0) p.flash -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.punchWindow > 0) {
      p.punchWindow -= dt;
      if (p.punchWindow <= 0) { p.punchStep = 0; p.punchWindow = 0; }
    }
    if (p.jumpBuffer > 0) p.jumpBuffer -= dt;
    if (p.punchBuffer > 0) p.punchBuffer -= dt;
    if (p.kickBuffer > 0) p.kickBuffer -= dt;
    if (p.specialBuffer > 0) p.specialBuffer -= dt;

    if (p.dead) { p.deadT += dt; return; }

    if (S.run.bossIntro > 0) {
      p.state = 'idle'; p.anim = 'idle'; p.vx = 0; p.vy = 0;
      updateJumpPhysics(p, dt);
      return;
    }
    if (p.state === 'victory') {
      p.anim = 'victory'; p.vx = 0; p.vy = 0;
      return;
    }

    if (p.hurtT > 0) {
      p.hurtT -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-5 * dt);
      p.vy *= Math.exp(-5 * dt);
      updateJumpPhysics(p, dt);
      clampActor(p);
      if (p.hurtT <= 0 && !p.dead) { p.state = 'idle'; p.anim = 'idle'; p.animT = 0; }
      return;
    }

    if (p.attack) { updatePlayerAttack(p, dt); return; }

    /* прыжок с земли */
    if (p.jumpBuffer > 0 && p.z <= 0) {
      p.jumpBuffer = 0;
      p.z = 0.01;
      p.vz = charOf(p).jump;
      p.state = 'jump';
      p.anim = 'jump';
      p.animT = 0;
      p.airAttack = false;
      dust(p.x, p.y, 3, '#8a7ab8');
      sfx('jump');
    }

    if (p.z > 0) {
      var airMx = (NR.input.left ? -1 : 0) + (NR.input.right ? 1 : 0);
      var airMy = (NR.input.down ? 1 : 0) + (NR.input.up ? -1 : 0);
      if (airMx) { p.x += airMx * charOf(p).speed * 0.65 * dt; p.facing = airMx; }
      if (airMy) p.y += airMy * charOf(p).depth * 0.55 * dt;
      clampActor(p);
      updateJumpPhysics(p, dt);
      if (!p.airAttack && p.z > 1 && (p.punchBuffer > 0 || p.kickBuffer > 0)) {
        p.punchBuffer = 0; p.kickBuffer = 0;
        p.airAttack = true;
        faceNearest(p);
        startAttack(p, 'jumpkick');
      }
      return;
    }

    /* земля: движение */
    var mx = (NR.input.left ? -1 : 0) + (NR.input.right ? 1 : 0);
    var my = (NR.input.down ? 1 : 0) + (NR.input.up ? -1 : 0);
    var moving = false;
    if (mx) {
      p.x += mx * charOf(p).speed * dt;
      p.facing = mx;
      moving = true;
    }
    if (my) {
      p.y += my * charOf(p).depth * dt;
      moving = true;
    }
    if (!mx && my) p.facing = p.facing;
    clampActor(p);
    if (moving) {
      p.state = 'walk';
      p.anim = 'walk';
      if (p.animT > 10) p.animT = 0;
    } else {
      p.state = 'idle';
      p.anim = 'idle';
      /* лёгкое автонаведение на ближайшего врага */
      if (!p.attack) {
        var best = null, bd = 1e9;
        for (var i = 0; i < S.enemies.length; i++) {
          var e = S.enemies[i];
          if (e.dead) continue;
          var dx = Math.abs(e.x - p.x);
          if (dx < 54 && Math.abs(e.y - p.y) < 34) {
            if (dx < bd) { bd = dx; best = e; }
          }
        }
        if (best) p.facing = best.x >= p.x ? 1 : -1;
      }
    }

    /* атаки с земли */
    if (p.specialBuffer > 0) {
      if (p.rage >= p.maxRage) { p.specialBuffer = 0; startSpecial(p); return; }
      p.specialBuffer = 0;
    }
    if (p.kickBuffer > 0) { p.kickBuffer = 0; startKick(p); return; }
    if (p.punchBuffer > 0) { p.punchBuffer = 0; startPunch(p); return; }
  }

  function updatePlayerAttack(p, dt) {
    var a = p.attack;
    if (!a) return;
    var d = a.def;
    a.t += dt;
    p.animT += dt;
    updateJumpPhysics(p, dt);
    if (p.z > 0) {
      var airMx = (NR.input.left ? -1 : 0) + (NR.input.right ? 1 : 0);
      if (airMx) { p.x += airMx * charOf(p).speed * 0.4 * dt; p.facing = airMx; }
      clampActor(p);
    }
    if (a.t < d.wind) {
      a.phase = 'wind';
    } else if (a.t < d.wind + d.active) {
      a.phase = 'hit';
      if (!a.done) {
        a.done = true;
        doPlayerHits(p, a, d);
      }
    } else if (a.t < d.wind + d.active + d.recover) {
      a.phase = 'recover';
    } else {
      endPlayerAttack(p);
      return;
    }
    /* буфер следующей атаки */
    if (p.punchBuffer > 0 && (a.type === 'jab' || a.type === 'cross' || a.type === 'finisher')) {
      p.chainQueued = true;
      p.punchBuffer = 0;
    }
    if (p.kickBuffer > 0 && a.type !== 'jumpkick') {
      /* оставляем буфер до конца — endPlayerAttack начнёт пинок */
    }
  }

  function updateDead(dt) {
    S.run.deadT += dt;
    updateParticles(dt);
    updatePopups(dt);
    updateCamera(dt);
    updateBanner(dt);
    if (S.run.deadT > 1.9) {
      if (S.run.lives > 0) respawnPlayer();
      else finishRun(false);
    }
  }

  /* ---------- враги ---------- */
  function activeAttackers() {
    var n = 0;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (!e.dead && !e.isBoss && e.attack) n += 1;
    }
    return n;
  }

  function startEnemyAttack(e) {
    if (e.attack || e.dead) return;
    var limit = S.run.difficulty === 'hard' ? 3 : S.run.difficulty === 'easy' ? 1 : 2;
    if (activeAttackers() >= limit) return;
    var jump = e.kind === 'ninja' && e.ai.jumpCd <= 0 &&
      Math.abs(S.player.x - e.x) > 56 && Math.abs(S.player.x - e.x) < 145 &&
      chance(0.55);
    if (jump) { startNinjaJump(e); return; }
    e.anim = e.kind === 'ninja' ? 'kick' : e.kind === 'brute' ? 'punch3' : 'punch1';
    e.attack = {
      type: 'melee', phase: 'wind', t: 0, done: false,
      def: { wind: e.wind, active: e.active, recover: e.recover, dmg: e.dmg, reach: e.reach, depth: e.depthReach }
    };
    e.state = 'attack';
    e.animT = 0;
    e.vx = 0; e.vy = 0;
    e.facing = S.player.x >= e.x ? 1 : -1;
    e.ai.cd = 0;
  }

  function startNinjaJump(e) {
    e.anim = 'jumpkick';
    e.attack = {
      type: 'jumpkick', phase: 'wind', t: 0, done: false,
      def: { wind: 0.08, active: 0.34, recover: 0.25, dmg: e.dmg + 2, reach: 42, depth: 24 }
    };
    e.state = 'attack';
    e.animT = 0;
    e.z = 0.01;
    e.vz = 330;
    e.vx = (S.player.x >= e.x ? 1 : -1) * e.speed * 1.7;
    e.vy = clamp(S.player.y - e.y, -90, 90) * 1.2;
    e.facing = S.player.x >= e.x ? 1 : -1;
    e.ai.jumpCd = rand(2.6, 4.2);
    e.ai.cd = 0;
    sfx('jump');
  }

  function updateEnemyAttack(e, dt) {
    var a = e.attack;
    if (!a) return;
    var d = a.def;
    a.t += dt;
    e.animT += dt;
    if (a.type === 'jumpkick' && (e.z > 0 || e.vz !== 0)) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= Math.exp(-1.2 * dt);
      e.vy *= Math.exp(-1.2 * dt);
    }
    if (a.t < d.wind) {
      a.phase = 'wind';
    } else if (a.t < d.wind + d.active) {
      a.phase = 'hit';
      if (!a.done) {
        a.done = true;
        if (!S.player.dead && inFront(e, S.player, d.reach, d.depth, 46)) {
          hurtPlayer(d.dmg, e);
        }
      }
    } else if (a.t < d.wind + d.active + d.recover) {
      a.phase = 'recover';
    } else {
      e.attack = null;
      e.state = 'idle';
      e.anim = 'idle';
      e.animT = 0;
      e.ai.cd = e.baseCd * rand(0.9, 1.3);
    }
  }

  function updateEnemy(e, dt) {
    if (e.flash > 0) e.flash -= dt;
    if (e.invuln > 0) e.invuln -= dt;
    e.animT += dt;
    if (e.z > 0 || e.vz !== 0) {
      e.z += e.vz * dt;
      e.vz -= 1050 * dt;
      if (e.z <= 0) {
        e.z = 0; e.vz = 0;
        if (!e.dead) { dust(e.x, e.y, 4, '#6f5c94'); sfx('land'); }
      }
    }
    if (e.dead) {
      e.deadT += dt;
      e.x += (e.vx || 0) * dt;
      e.vx *= Math.exp(-3 * dt);
      if (e.deadT > 0.8) e.alpha = clamp(1 - (e.deadT - 0.8) / 0.7, 0, 1);
      return;
    }
    if (e.hurtT > 0) {
      e.hurtT -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= Math.exp(-5 * dt);
      e.vy *= Math.exp(-5 * dt);
      clampActor(e);
      if (e.hurtT <= 0) { e.state = 'idle'; e.anim = 'idle'; e.animT = 0; }
      return;
    }
    if (S.run.bossIntro > 0 || S.player.dead) {
      e.state = 'idle'; e.anim = 'idle';
      return;
    }
    if (e.attack) { updateEnemyAttack(e, dt); clampActor(e); return; }
    if (e.ai.cd > 0) e.ai.cd -= dt;
    if (e.ai.jumpCd > 0) e.ai.jumpCd -= dt;

    /* цель: держаться сбоку от игрока */
    var side = e.x >= S.player.x ? 1 : -1;
    e.facing = S.player.x >= e.x ? 1 : -1;
    var tx = S.player.x + side * 33;
    var ty = S.player.y + e.ai.offY;
    var dx = tx - e.x, dy = ty - e.y;
    var step = e.speed * dt;
    var moved = false;
    if (Math.abs(dx) > 4) {
      var s = Math.abs(dx) > 70 ? e.speed * 1.15 : e.speed;
      e.x += clamp(dx, -s * dt, s * dt);
      moved = true;
    }
    if (Math.abs(dy) > 3) {
      e.y += clamp(dy, -e.speed * 0.7 * dt, e.speed * 0.7 * dt);
      moved = true;
    }
    /* расталкивание */
    for (var j = 0; j < S.enemies.length; j++) {
      var o = S.enemies[j];
      if (o === e || o.dead || o.isBoss) continue;
      var ox = e.x - o.x, oy = e.y - o.y;
      if (Math.abs(ox) < 17 && Math.abs(oy) < 10) {
        e.x += (ox >= 0 ? 1 : -1) * 12 * dt;
        e.y += (oy >= 0 ? 1 : -1) * 8 * dt;
      }
    }
    clampActor(e);
    if (moved) { e.state = 'walk'; e.anim = 'walk'; }
    else { e.state = 'idle'; e.anim = 'idle'; }

    var adx = Math.abs(S.player.x - e.x), ady = Math.abs(S.player.y - e.y);
    var canAttack = e.ai.cd <= 0 && !S.player.dead && S.mode === 'play' &&
      adx < e.reach + 8 && ady < e.depthReach + 5;
    if (canAttack) startEnemyAttack(e);
  }

  /* ---------- босс ---------- */
  function bossDef(b, type) {
    if (type === 'cable') return { wind: 0.62, active: 0.34, recover: 0.7, dmg: b.dmg + 2, reach: 168, depth: 38, anim: 'cable', type: type };
    if (type === 'orbs') return { wind: 0.58, active: 0.16, recover: 0.66, dmg: b.dmg - 2, reach: 0, depth: 0, anim: 'cast', type: type };
    if (type === 'slam') return { wind: 0.5, active: 0.16, recover: 0.8, dmg: b.dmg, reach: 0, depth: 0, anim: 'slam', type: type };
    return { wind: 0.34, active: 0.16, recover: 0.5, dmg: 0, reach: 0, depth: 0, anim: 'cast', type: 'teleport' };
  }

  function startBossAttack(b, type) {
    var d = bossDef(b, type);
    b.attack = { type: type, phase: 'wind', t: 0, done: false, def: d };
    b.anim = d.anim;
    b.animT = 0;
    b.facing = S.player.x >= b.x ? 1 : -1;
  }

  function updateBoss(b, dt) {
    if (b.flash > 0) b.flash -= dt;
    if (b.invuln > 0) b.invuln -= dt;
    b.animT += dt;
    b.z = 18 + Math.sin(S.t * 2.1) * 4;
    if (b.dead) {
      b.deadT += dt;
      b.z = Math.max(0, b.z - 24 * dt);
      b.alpha = clamp(1 - (b.deadT - 1.1) / 1.1, 0, 1);
      return;
    }
    if (S.run.bossIntro > 0) {
      b.invuln = Math.max(b.invuln, 10);
      b.anim = 'roar';
      return;
    }
    if (b.phaseT > 0) {
      b.phaseT -= dt;
      b.invuln = Math.max(b.invuln, 0.8);
      b.anim = 'roar';
      b.animT += dt;
      if (chance(0.25)) sparkBurst(b.x + rand(-20, 20), b.y, b.z + rand(10, 50), 2, '#ff2e88', 0.6);
      if (b.phaseT <= 0) { b.anim = 'idle'; b.animT = 0; }
      return;
    }
    if (b.attack) { updateBossAttack(b, dt); return; }
    if (S.player.dead) { b.anim = 'idle'; return; }

    b.ai.cd -= dt;
    b.facing = S.player.x >= b.x ? 1 : -1;
    var targetX = S.player.x + (b.x < S.player.x ? -84 : 84);
    var targetY = clamp(S.player.y, 194, 242);
    var sp = b.phase2 ? (b.speed || 62) * 1.35 : (b.speed || 62);
    b.x += clamp(targetX - b.x, -sp * dt, sp * dt);
    b.y += clamp(targetY - b.y, -sp * 0.6 * dt, sp * 0.6 * dt);
    clampActor(b);
    if (!b.attack) { b.anim = 'idle'; }
    if (b.ai.cd <= 0 && S.mode === 'play') {
      var dist = Math.abs(S.player.x - b.x);
      var r = Math.random();
      var type;
      if (dist > 125) {
        type = r < 0.55 ? 'orbs' : r < 0.8 ? 'teleport' : 'cable';
      } else {
        if (b.phase2) type = r < 0.36 ? 'cable' : r < 0.64 ? 'slam' : r < 0.85 ? 'orbs' : 'teleport';
        else type = r < 0.5 ? 'cable' : r < 0.8 ? 'slam' : 'teleport';
      }
      startBossAttack(b, type);
    }
  }

  function updateBossAttack(b, dt) {
    var a = b.attack;
    if (!a) return;
    var d = a.def;
    a.t += dt;
    b.animT += dt;
    if (a.t < d.wind) {
      a.phase = 'wind';
    } else if (a.t < d.wind + d.active) {
      a.phase = 'hit';
      if (!a.done) {
        a.done = true;
        bossAttackFire(b, a);
      }
    } else if (a.t < d.wind + d.active + d.recover) {
      a.phase = 'recover';
    } else {
      b.attack = null;
      b.anim = 'idle';
      b.animT = 0;
      b.ai.cd = b.phase2 ? 0.85 : 1.3;
    }
  }

  function bossAttackFire(b, a) {
    var d = a.def;
    var p = S.player;
    if (a.type === 'cable') {
      var dx = (p.x - b.x) * b.facing;
      if (dx > -14 && dx < d.reach && Math.abs(p.y - b.y) < d.depth && Math.abs((p.z || 0) - b.z) < 80) {
        hurtPlayer(d.dmg, b);
      }
      for (var i = 0; i < 7; i++) {
        S.particles.push({
          kind: 'spark', x: b.x + b.facing * (30 + i * 20), y: b.y, z: b.z + 10,
          vx: b.facing * rand(40, 120), vy: rand(-20, 20), vz: rand(-10, 50),
          life: 0.3, maxLife: 0.3, size: 2, color: '#ff2e88', rot: 0
        });
      }
      sfx('kick');
      S.run.shake = Math.max(S.run.shake, 5);
      return;
    }
    if (a.type === 'orbs') {
      var baseAng = Math.atan2(p.y - b.y, p.x - b.x);
      for (var k = -1; k <= 1; k++) {
        var ang = baseAng + k * 0.22;
        spawnOrb(b.x, b.y, b.z + 12, Math.cos(ang), Math.sin(ang), 155, d.dmg);
      }
      sfx('special');
      return;
    }
    if (a.type === 'slam') {
      spawnShock(b.x, b.y + 14, 1, d.dmg);
      spawnShock(b.x, b.y - 14, -1, d.dmg);
      ringFx(b.x, b.y, 4, 95, '#ff2e88');
      S.run.shake = Math.max(S.run.shake, 9);
      sfx('explosion');
      return;
    }
    if (a.type === 'teleport') {
      sparkBurst(b.x, b.y, b.z + 20, 16, '#b15cff', 1.2);
      var dir = p.x >= b.x ? -1 : 1;
      b.x = clamp(p.x + dir * 88, S.world.minX + 30, S.world.maxX - 30);
      b.y = clamp(p.y, 190, 242);
      b.z = 18;
      b.invuln = Math.max(b.invuln, 0.75);
      sparkBurst(b.x, b.y, b.z + 20, 16, '#22e6ff', 1.2);
      sfx('ui_move');
    }
  }

  function spawnOrb(x, y, z, dx, dy, speed, dmg) {
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    S.projectiles.push({
      id: uid(), kind: 'orb', x: x, y: y, z: z,
      vx: dx / len * speed, vy: dy / len * speed, vz: 0,
      life: 3.2, maxLife: 3.2, r: 8, dmg: dmg, owner: 'boss', facing: 1
    });
  }

  function spawnShock(x, y, dir, dmg) {
    S.projectiles.push({
      id: uid(), kind: 'shock', x: x, y: y, z: 0,
      vx: dir * 225, vy: 0, vz: 0,
      life: 2.4, maxLife: 2.4, r: 10, dmg: dmg, owner: 'boss', facing: dir
    });
  }

  function updateProjectiles(dt) {
    for (var i = S.projectiles.length - 1; i >= 0; i--) {
      var pr = S.projectiles[i];
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += (pr.vz || 0) * dt;
      if (pr.kind === 'orb' && chance(0.6)) {
        S.particles.push({
          kind: 'spark', x: pr.x, y: pr.y, z: pr.z,
          vx: rand(-10, 10), vy: rand(-10, 10), vz: rand(-10, 10),
          life: 0.25, maxLife: 0.25, size: 2, color: '#b15cff', rot: 0
        });
      }
      if (pr.life <= 0 || pr.x < -30 || pr.x > WORLD_W + 30) {
        S.projectiles.splice(i, 1);
        continue;
      }
      var p = S.player;
      if (p && !p.dead && p.invuln <= 0) {
        var hit = false;
        if (pr.kind === 'orb') {
          hit = Math.abs(pr.x - p.x) < pr.r + 13 && Math.abs(pr.y - p.y) < 16 &&
            Math.abs(pr.z - (p.z + 30)) < 30;
        } else {
          hit = Math.abs(pr.x - p.x) < 17 && Math.abs(pr.y - p.y) < 17 && (p.z || 0) < 23;
        }
        if (hit) {
          hurtPlayer(pr.dmg, { x: pr.x < p.x ? pr.x - 1 : pr.x + 1 });
          sparkBurst(pr.x, pr.y, pr.z + 12, 8, '#b15cff', 1);
          S.projectiles.splice(i, 1);
        }
      }
    }
  }

  function updateEnemies(dt) {
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      if (e.isBoss) updateBoss(e, dt);
      else updateEnemy(e, dt);
      if (e.dead && !e.isBoss && e.deadT > 1.6) S.enemies.splice(i, 1);
      else if (e.dead && e.isBoss && e.deadT > 4) S.enemies.splice(i, 1);
    }
  }

  /* ---------- пропы, пикапы, эффекты ---------- */
  function breakProp(prop) {
    if (prop.broken) return;
    prop.broken = true;
    prop.breakT = 0;
    prop.shakeT = 0.2;
    S.run.score += Math.round(40 * (1 + S.run.combo * 0.05));
    shards(prop.x, prop.y, 9, prop.type === 'vending' ? '#22e6ff' : '#c98b3c');
    sfx('crate');
    var kind = prop.contains || 'coin';
    S.pickups.push({
      id: uid(), kind: kind, x: prop.x, y: prop.y, z: 10,
      life: 15, value: kind === 'coin' ? 250 : 0, heal: kind === 'food' ? 28 : 0,
      bob: rand(0, 6)
    });
  }

  function updateProps(dt) {
    for (var i = S.props.length - 1; i >= 0; i--) {
      var pr = S.props[i];
      if (pr.shakeT > 0) pr.shakeT -= dt;
      if (pr.broken) {
        pr.breakT += dt;
        if (pr.breakT > 1.2) S.props.splice(i, 1);
      }
    }
  }

  function updatePickups(dt) {
    var p = S.player;
    for (var i = S.pickups.length - 1; i >= 0; i--) {
      var it = S.pickups[i];
      it.life -= dt;
      it.bob += dt;
      if (it.life <= 0) { S.pickups.splice(i, 1); continue; }
      if (!p || p.dead) continue;
      if (Math.abs(it.x - p.x) < 21 && Math.abs(it.y - p.y) < 18 && (p.z || 0) < 45) {
        if (it.kind === 'coin') {
          var mult = 1 + S.run.combo * 0.08;
          var pts = Math.round(it.value * mult);
          S.run.score += pts;
          addPopup('+' + pts, it.x, it.y, 28, '#ffd34d', 'score', 0.9);
          sfx('coin');
        } else {
          var heal = Math.min(it.heal || 28, p.maxHp - p.hp);
          p.hp = Math.min(p.maxHp, p.hp + (it.heal || 28));
          addPopup(T('popup.heal', { n: Math.round(heal) }), it.x, it.y, 30, '#b6ff3a', 'heal', 0.95);
          sfx('heal');
        }
        S.pickups.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (var i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.life -= dt;
      if (p.life <= 0) { S.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += (p.vz || 0) * dt;
      p.vz = (p.vz || 0) - 420 * dt;
      p.vx *= Math.exp(-1.2 * dt);
      p.vy *= Math.exp(-1.2 * dt);
      if (p.z < 0) { p.z = 0; p.vz = Math.abs(p.vz) * 0.2; }
    }
  }

  function updatePopups(dt) {
    for (var i = S.popups.length - 1; i >= 0; i--) {
      var p = S.popups[i];
      p.t += dt;
      p.z += 20 * dt;
      if (p.t >= p.dur) S.popups.splice(i, 1);
    }
  }

  function updateEffects(dt) {
    updateParticles(dt);
    updatePopups(dt);
    if (S.run.flash > 0) S.run.flash = Math.max(0, S.run.flash - dt * 4.5);
  }

  /* ---------- камера ---------- */
  function updateShake(dt) {
    S.run.shake = Math.max(0, S.run.shake - dt * 26);
    S.camera.shake = S.run.shake;
    if (S.run.shake > 0.1) {
      S.camera.shakeX = rand(-1, 1) * S.run.shake;
      S.camera.shakeY = rand(-1, 1) * S.run.shake * 0.6;
    } else {
      S.camera.shakeX = 0; S.camera.shakeY = 0;
    }
  }

  function updateCamera(dt) {
    var maxCam = WORLD_W - W;
    var target;
    if (S.run.gate.active) {
      target = (S.run.gate.left + S.run.gate.right) / 2 - W / 2;
    } else {
      target = S.player ? S.player.x - W * 0.44 : 0;
    }
    target = clamp(target, 0, maxCam);
    S.camera.x = lerp(S.camera.x, target, Math.min(1, dt * 5.5));
    if (Math.abs(S.camera.x - target) < 0.2) S.camera.x = target;
    S.camera.x = clamp(S.camera.x, 0, maxCam);
    updateShake(dt);
  }

  function clampActor(a) {
    var minX = S.world.minX, maxX = S.world.maxX;
    if (a === S.player && S.run.gate.active) {
      minX = Math.max(minX, S.run.gate.left + 12);
      maxX = Math.min(maxX, S.run.gate.right - 12);
    }
    a.x = clamp(a.x, minX, maxX);
    a.y = clamp(a.y, S.world.minY, S.world.maxY);
  }

  /* ---------- обновление ---------- */
  function updateCombo(dt) {
    if (S.run.comboT > 0) {
      S.run.comboT -= dt;
      if (S.run.comboT <= 0) { S.run.comboT = 0; S.run.combo = 0; }
    }
    if (S.player) {
      S.player.specialReady = S.player.rage >= S.player.maxRage;
    }
  }

  function updateWave(dt) {
    if (S.run.bossDefeated) return;
    if (S.run.waveActive) {
      if (S.run.wave === WAVES.length - 1) {
        if (S.boss && S.boss.dead) bossDefeated();
      } else {
        var alive = false;
        for (var i = 0; i < S.enemies.length; i++) {
          if (!S.enemies[i].dead) { alive = true; break; }
        }
        if (!alive) clearWave();
      }
      return;
    }
    if (S.run.wave >= WAVES.length) return;
    if (S.player.x > WAVES[S.run.wave].trigger) startWave(S.run.wave);
  }

  function updatePlay(dt) {
    if (S.run.hitstop > 0) {
      S.run.hitstop -= dt;
      updateShake(dt);
      updateBanner(dt);
      return;
    }
    S.run.elapsed += dt;
    if (S.run.bossIntro > 0) {
      S.run.bossIntro -= dt;
      if (S.run.bossIntro <= 0) {
        S.run.bossIntro = 0;
        if (S.boss) {
          S.boss.invuln = 0;
          S.boss.anim = 'idle';
          S.boss.animT = 0;
          S.boss.ai.cd = 1.1;
        }
        if (S.player) S.player.invuln = Math.max(S.player.invuln, 0.8);
        setIntensity(0.95);
        sfx('boss_roar');
      }
      updateParticles(dt);
      updatePopups(dt);
      updateCamera(dt);
      updateBanner(dt);
      return;
    }
    if (S.run.bossDefeated) {
      S.run.victoryT -= dt;
      updateParticles(dt);
      updatePopups(dt);
      updateCamera(dt);
      updateBanner(dt);
      if (S.run.victoryT <= 0) finishRun(true);
      return;
    }
    if (!S.player) return;
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateProps(dt);
    updatePickups(dt);
    updateEffects(dt);
    updateCamera(dt);
    updateBanner(dt);
    updateCombo(dt);
    updateZone(dt);
    updateWave(dt);
    if (S.toast) {
      S.toast.t += dt;
      if (S.toast.t >= S.toast.dur) S.toast = null;
    }
  }

  NR.update = function (dt) {
    dt = clamp(dt, 0, 0.045);
    S.t += dt;
    S.modeT += dt;
    if (S.mode === 'play' && !S.freeze) {
      updatePlay(dt);
    } else if (S.mode === 'dead') {
      updateDead(dt);
    } else if (S.mode === 'paused') {
      updateShake(dt);
    } else {
      if (S.run.shake > 0) updateShake(dt);
    }
    if (S.toast && S.mode !== 'play') {
      S.toast.t += dt;
      if (S.toast.t >= S.toast.dur) S.toast = null;
    }
  };

  /* ============================================================
     ОТЛАДКА / СКРИНШОТЫ
     ============================================================ */
  function snapCamera() {
    var maxCam = WORLD_W - W;
    var target = S.run.gate.active
      ? (S.run.gate.left + S.run.gate.right) / 2 - W / 2
      : (S.player ? S.player.x - W * 0.44 : 0);
    S.camera.x = clamp(target, 0, maxCam);
    S.camera.shakeX = 0;
    S.camera.shakeY = 0;
  }

  function debugPlayScene(waveIdx, zone, px, py) {
    startRun(0, 'normal', true);
    S.player.x = px; S.player.y = py || 214;
    S.player.facing = 1;
    startWave(waveIdx);
    S.player.invuln = 99;
    S.player.rage = 72;
    S.player.specialReady = false;
    S.run.combo = 6;
    S.run.comboT = 2;
    for (var i = 0; i < 4; i++) {
      S.particles.push({
        kind: i % 2 ? 'star' : 'spark',
        x: S.player.x + rand(-40, 80), y: S.player.y + rand(-20, 20), z: rand(4, 42),
        vx: rand(-30, 30), vy: rand(-10, 10), vz: rand(0, 20),
        life: 1.2, maxLife: 1.2, size: rand(1, 3), color: i % 2 ? '#22e6ff' : '#ff2e88', rot: 0
      });
    }
    if (zone != null) S.run.zone = zone;
    snapCamera();
  }

  /* публичные функции для QA/консоли */
  NR.startRun = startRun;
  NR.beginRun = beginRun;
  NR.finishRun = finishRun;
  NR.saveSettings = saveSettings;
  NR.setDifficulty = setDifficulty;
  NR.pauseGame = pauseGame;
  NR.resumeGame = resumeGame;

  NR.debug = {
    freeze: function (on) { S.freeze = !!on; },
    scene: function (name) {
      name = String(name || 'title');
      if (name === 'title') { S.freeze = false; setMode('title'); return; }
      if (name === 'select') { S.freeze = false; setMode('select'); return; }
      if (name === 'help') { S.helpFrom = 'title'; S.freeze = false; setMode('help'); return; }
      if (name === 'settings') { S.settingsFrom = 'title'; S.freeze = false; setMode('settings'); return; }
      if (name === 'about') { S.aboutFrom = 'title'; S.freeze = false; setMode('about'); return; }
      if (name === 'intro') { startRun(0, 'normal', false); S.freeze = false; return; }
      if (name === 'paused') {
        startRun(0, 'normal', true); startWave(0); S.player.invuln = 99;
        snapCamera(); S.freeze = false; setMode('paused'); return;
      }
      if (name === 'gameover') {
        startRun(0, 'normal', true);
        S.run.score = 8450; S.run.kills = 12; S.run.maxCombo = 9; S.run.elapsed = 214;
        S.run.lives = 0; S.freeze = false; finishRun(false); return;
      }
      if (name === 'victory') {
        startRun(1, 'normal', true);
        S.run.score = 24680; S.run.kills = 17; S.run.maxCombo = 14; S.run.elapsed = 372;
        S.run.lives = 2; S.freeze = false; finishRun(true); return;
      }
      if (name === 'dead') {
        startRun(0, 'normal', true); startWave(0);
        S.player.invuln = 0; S.player.hp = 1; hurtPlayer(5, { x: S.player.x - 10, y: S.player.y });
        S.freeze = false; return;
      }
      if (name === 'play') { debugPlayScene(0, 0, 430, 214); S.freeze = false; return; }
      if (name === 'arcade') { debugPlayScene(2, 1, 1300, 214); S.freeze = false; return; }
      if (name === 'roof') { debugPlayScene(3, 2, 1740, 214); S.freeze = false; return; }
      if (name === 'boss' || name === 'boss2') {
        startRun(0, 'normal', true);
        S.player.x = 2110; S.player.y = 218; S.player.facing = 1;
        S.player.invuln = 99;
        S.player.rage = 100;
        startWave(4);
        S.run.bossIntro = 0;
        if (S.boss) {
          S.boss.invuln = 0;
          S.boss.anim = 'idle';
          S.boss.animT = 0;
          S.boss.x = 2180; S.boss.y = 216;
          if (name === 'boss2') {
            S.boss.hp = Math.floor(S.boss.maxHp * 0.42);
            S.boss.phase2 = true;
            S.boss.phaseT = 0;
            S.boss.invuln = 0;
          }
        }
        S.run.combo = 4;
        S.run.comboT = 2;
        snapCamera();
        S.freeze = false;
        return;
      }
      if (name === 'waveclear') {
        startRun(0, 'normal', true); startWave(0);
        S.run.waveActive = false; S.run.advance = true; S.run.gate.active = false;
        S.run.wave = 1;
        setBanner('clear', 'banner.clear', null, null, 20);
        S.freeze = false; return;
      }
      debugPlayScene(0, 0, 430, 214);
    },
    wave: function (idx) {
      startRun(S.run.char || 0, S.run.difficulty || 'normal', true);
      startWave(clamp(idx, 0, WAVES.length - 1));
      S.player.invuln = 99;
      snapCamera();
    },
    zone: function (idx) {
      startRun(S.run.char || 0, S.run.difficulty || 'normal', true);
      S.player.x = idx === 0 ? 400 : idx === 1 ? 1280 : 1740;
      S.player.invuln = 99;
      S.run.zone = clamp(idx, 0, 2);
      startWave(idx === 0 ? 0 : idx === 1 ? 2 : 3);
      S.player.x = idx === 0 ? 400 : idx === 1 ? 1280 : 1740;
      snapCamera();
    },
    spawn: function (kind) {
      if (!ENEMY_STATS[kind]) kind = 'punk';
      var x = S.player ? S.player.x + 90 : 400;
      var y = S.player ? S.player.y : 214;
      var e = spawnEnemy(kind, x, y);
      e.ai.cd = 0.3;
      return e;
    },
    killAll: function () {
      for (var i = 0; i < S.enemies.length; i++) {
        var e = S.enemies[i];
        if (e.dead) continue;
        if (e.isBoss) { e.invuln = 0; damageBoss(e, e.hp + 10, S.player); }
        else { e.invuln = 0; e.hp = 1; damageEnemy(e, 999, S.player, { knock: 100 }); }
      }
    },
    rage: function () { if (S.player) { S.player.rage = S.player.maxRage; S.player.specialReady = true; } },
    hp: function (n) {
      if (!S.player) return;
      S.player.hp = clamp(n, 1, S.player.maxHp);
      S.player.dead = false;
    },
    demo: function () {
      startRun(0, 'normal', true);
      S.player.x = 420; S.player.y = 214;
      startWave(0);
      spawnEnemy('ninja', 540, 200);
      spawnEnemy('brute', 600, 232);
      S.run.combo = 9;
      S.run.comboT = 2;
      S.player.rage = 100;
      S.player.specialReady = true;
      S.player.invuln = 99;
      for (var i = 0; i < 18; i++) {
        S.particles.push({
          kind: i % 3 ? 'spark' : 'star',
          x: 430 + rand(-60, 130), y: 210 + rand(-30, 30), z: rand(8, 60),
          vx: rand(-60, 60), vy: rand(-20, 20), vz: rand(-20, 60),
          life: rand(0.5, 1.2), maxLife: 1.2, size: rand(1, 3),
          color: ['#ff2e88', '#22e6ff', '#b6ff3a'][i % 3], rot: 0
        });
      }
      snapCamera();
    },
    state: function () {
      return {
        mode: S.mode, gfx: NR.settings.gfx, lang: NR.settings.lang,
        wave: S.run.wave, waveActive: S.run.waveActive, zone: S.run.zone,
        score: S.run.score, lives: S.run.lives, combo: S.run.combo,
        hp: S.player ? S.player.hp : 0, enemies: S.enemies.length,
        bossHp: S.boss ? S.boss.hp : null, paused: S.mode === 'paused',
        frozen: S.freeze, track: lastTrack
      };
    }
  };

})();
