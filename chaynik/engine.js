/*! Гефест Arcade — фреймворк браузерных игр. vanilla JS, 0 зависимостей.
 * Общие системы, которые игры дублировали: цикл, ввод (клавиатура+тач-дпад), звук (WebAudio
 * SFX + чиптюн-секвенсор музыки, тембр по теме), i18n (RU/EN), темы (retro/modern), меню (title/пауза/
 * настройки: язык/тема/звук), сцены, сетка, частицы, HUD, счёт+рекорд (localStorage по игре).
 * Встроены критерии: проходимость (win/lose+финал, difficulty), играбельность (отклик, фидбек),
 * непресность (нарастание). Игры самодостаточны: build.sh копирует файл в игру. API — README.
 * (c) Студия «Гефест». v2.2.0 (API пунктов меню g.menu, ввод по игрокам g.input.player(i) + g.usePlayers, g.input.touchOnly)
 */
(function (global) {
  'use strict';
  var doc = global.document;

  // ---------- Хранилище (localStorage с try/catch) ----------
  var Store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    getNum: function (k, d) { var v = this.get(k, null); return v == null ? d : (parseFloat(v) || d); },
  };

  // ---------- i18n ----------
  function I18n(tables, lang) {
    this.tables = tables || { ru: {}, en: {} };
    this.lang = lang || Store.get('arcade.lang', 'ru');
  }
  I18n.prototype.t = function (key, fallback) {
    var tb = this.tables[this.lang] || {};
    return tb[key] != null ? tb[key] : (fallback != null ? fallback : key);
  };
  I18n.prototype.set = function (lang) { this.lang = lang; Store.set('arcade.lang', lang); };
  I18n.prototype.toggle = function () { this.set(this.lang === 'ru' ? 'en' : 'ru'); return this.lang; };

  // ---------- Темы (retro / modern). modern — основная (вместо неона). ----------
  var THEMES = {
    modern: { // чистый современный дизайн
      bg: '#0e1016', panel: '#161a24', ink: '#eef2f8', muted: '#9aa4b5', accent: '#4f8cff',
      good: '#37d67a', bad: '#ff5d6c', warn: '#ffb020', grid: '#222838',
      font: 'Inter, system-ui, sans-serif', pixel: false, glow: true, radius: 10,
    },
    retro: { // 8-бит/CGA-дух
      bg: '#101014', panel: '#1b1620', ink: '#f3e9da', muted: '#8a7f6e', accent: '#ea6a12',
      good: '#55ff55', bad: '#ff5555', warn: '#ffd15e', grid: '#2b2230',
      font: '"Courier New", ui-monospace, monospace', pixel: true, glow: false, radius: 2,
    },
    neon: { // опциональная тема (дёшево — оставлена)
      bg: '#04050c', panel: '#0b1026', ink: '#eafcff', muted: '#6ad0e6', accent: '#39e7ff',
      good: '#49ffb0', bad: '#ff2f9c', warn: '#ffe14d', grid: '#13204a',
      font: 'Inter, system-ui, sans-serif', pixel: false, glow: true, radius: 8,
    },
  };

  // ---------- Ввод: клавиатура + тач-дпад (унифицировано) ----------
  // Горячие клавиши движка (e.code): их нельзя отдавать игрокам (Space допустим у И1 как действие).
  var HOTKEYS = ['KeyP', 'Escape', 'KeyM', 'KeyL', 'KeyT', 'Enter', 'NumpadEnter', 'Space'];
  var DIRN = { left: 1, right: 1, up: 1, down: 1 };
  function now() { var p = global.performance; return p && p.now ? p.now() : Date.now(); }
  // bind: [раскладкаИ1, раскладкаИ2] или { p1:{…}, p2:{…} }; раскладка = { имя: ['KeyCode', …] }
  function normBind(b) { if (!b) return [{}, {}]; if (Array.isArray(b)) return [b[0] || {}, b[1] || {}]; return [b.p1 || {}, b.p2 || {}]; }
  // Проверка раскладок: горячие клавиши движка (+ o.reserved) и клавиши, общие для двух игроков.
  // → [{ player, name, code, why:'hotkey'|'shared' }] (пусто — конфликтов нет).
  function checkBindings(bind, o) {
    o = o || {}; var list = normBind(bind), out = [], hot = HOTKEYS.concat(o.reserved || []), owner = Object.create(null);
    list.forEach(function (m, pi) {
      Object.keys(m).forEach(function (name) {
        (m[name] || []).forEach(function (code) {
          if (hot.indexOf(code) >= 0 && !(code === 'Space' && pi === 0 && !DIRN[name])) out.push({ player: pi, name: name, code: code, why: 'hotkey' });
          if (owner[code] != null && owner[code] !== pi) out.push({ player: pi, name: name, code: code, why: 'shared' });
          owner[code] = pi;
        });
      });
    });
    return out;
  }
  function Input() {
    this.keys = Object.create(null); this.dir = { x: 0, y: 0 }; this._press = [];
    this.codes = Object.create(null); // сырые e.code, зажатые сейчас
    // «Только тач»: устройство с грубым указателем без hover и ещё ни одного keydown (снимается первым keydown).
    this.touchOnly = false;
    try { this.touchOnly = !!(global.matchMedia && global.matchMedia('(hover: none) and (pointer: coarse)').matches); } catch (e) {}
    this.playerCount = 1; this._pl = null; this._plCbs = [[], []]; this._touch = Object.create(null); this._players = [];
    this._inPlay = null; this._armedAt = -1e9; this.conflicts = [];
    var map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right', Space: 'action', Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyL: 'lang', KeyT: 'theme' };
    var self = this;
    this._kd = function (e) {
      if (e.isTrusted !== false) self.touchOnly = false; // физическая клавиатура есть (синтетические события тач-кнопок не в счёт)
      self._plKey(e, true);
      var a = map[e.code]; if (!a) return; if (!self.keys[a]) self._emit(a); self.keys[a] = true; self._setDir(); if (a !== 'mute' && a !== 'lang' && a !== 'theme') e.preventDefault();
    };
    this._ku = function (e) { self._plKey(e, false); var a = map[e.code]; if (!a) return; self.keys[a] = false; self._setDir(); };
    addEventListener('keydown', this._kd, { passive: false }); addEventListener('keyup', this._ku);
    addEventListener('blur', function () { self.codes = Object.create(null); self._touch = Object.create(null); });
  }
  Input.prototype._setDir = function () { this.dir.x = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0); this.dir.y = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0); };
  Input.prototype.onPress = function (cb) { this._press.push(cb); };
  Input.prototype._emit = function (a) { for (var i = 0; i < this._press.length; i++) this._press[i](a); };
  Input.prototype.pressed = function (a) { return !!this.keys[a]; };
  Input.prototype.bindDpad = function (root) {
    if (!root) return; var self = this; var keyFor = { U: 'up', D: 'down', L: 'left', R: 'right', A: 'action' };
    root.querySelectorAll('[data-d]').forEach(function (btn) {
      var d = btn.dataset.d, a = keyFor[d]; if (!a) return;
      var on = function (e) { e.preventDefault(); if (!self.keys[a]) self._emit(a); self.keys[a] = true; self._setDir(); self._padPl(d, true); };
      var off = function (e) { e.preventDefault(); self.keys[a] = false; self._setDir(); self._padPl(d, false); };
      btn.addEventListener('touchstart', on, { passive: false }); btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false }); btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
    });
  };

  // --- Ввод по игрокам (локальный кооп за одной клавиатурой) ---
  // g.input.setPlayers({ bind:{p1:{left:['ArrowLeft'],…,fire:['Slash']}, p2:{…}}, actions:['fire'], repeat:['fire'],
  //   touch:{L:'left',R:'right',U:'up',D:'down',A:'fire'}, count:1|2, reserved:['Digit1'] }) → конфликты (+ console.warn).
  // g.input.player(i) → { index, dir{x,y}, pressed(name), onPress(cb(name)) }. playerCount=1 — обе раскладки ведут И1.
  // onPress игроков срабатывает только в сцене play (через 120 мс после входа — чтобы не «дострелить» клавишей старта);
  // в play у привязанных клавиш снимается действие браузера (Slash — быстрый поиск и т.п.). Тач-дпад — только И1.
  Input.prototype.setPlayers = function (cfg) {
    cfg = cfg || {}; var b = normBind(cfg.bind), acts = cfg.actions;
    if (!acts) { acts = []; b.forEach(function (m) { Object.keys(m).forEach(function (n) { if (!DIRN[n] && acts.indexOf(n) < 0) acts.push(n); }); }); }
    this._pl = { bind: b, actions: acts, repeat: cfg.repeat || [], touch: cfg.touch || null };
    if (cfg.count) this.setPlayerCount(cfg.count);
    var c = checkBindings(b, { reserved: cfg.reserved });
    c.forEach(function (x) { if (global.console && console.warn) console.warn('Arcade: раскладка И' + (x.player + 1) + ' «' + x.name + '» — ' + x.code + (x.why === 'hotkey' ? ' занята горячей клавишей движка' : ' уже у другого игрока')); });
    this.conflicts = c; return c;
  };
  Input.prototype.setPlayerCount = function (n) { this.playerCount = n === 2 ? 2 : 1; return this.playerCount; };
  Input.prototype.player = function (i) { i = i ? 1 : 0; return this._players[i] || (this._players[i] = new PlayerInput(this, i)); };
  Input.prototype._live = function () { return (!this._inPlay || this._inPlay()) && now() - this._armedAt > 120; };
  Input.prototype._isAct = function (name) { return this._pl.actions.indexOf(name) >= 0; };
  Input.prototype._emitPl = function (pi, name) { var l = this._plCbs[pi]; for (var i = 0; i < l.length; i++) l[i](name); };
  Input.prototype._lookup = function (code) { // code → [{pi,name}]; в одиночке P2-клавиши тоже ведут И1
    var out = [], b = this._pl.bind, two = this.playerCount === 2;
    for (var p = 0; p < 2; p++) for (var name in b[p]) if ((b[p][name] || []).indexOf(code) >= 0) out.push({ pi: two ? p : 0, name: name });
    return out;
  };
  Input.prototype._plKey = function (e, down) {
    this.codes[e.code] = !!down;
    if (!down || !this._pl) return;
    var hits = this._lookup(e.code); if (!hits.length) return;
    if (this._inPlay && !this._inPlay()) return;
    if (e.preventDefault) e.preventDefault();
    if (!this._live()) return;
    for (var i = 0; i < hits.length; i++) { var h = hits[i]; if (this._isAct(h.name) && (!e.repeat || this._pl.repeat.indexOf(h.name) >= 0)) this._emitPl(h.pi, h.name); }
  };
  Input.prototype._padPl = function (d, on) {
    var pl = this._pl, name = pl && pl.touch && pl.touch[d]; if (!name) return;
    if (!on) { this._touch[name] = false; return; }
    if (this._touch[name]) return; this._touch[name] = true;
    if (this._live() && this._isAct(name)) this._emitPl(0, name);
  };
  Input.prototype._held = function (pi, name) {
    if (!this._pl) return false;
    if (pi === 0 && this._touch[name]) return true;
    var b = this._pl.bind, lists = [];
    if (pi === 0) { lists.push(b[0][name]); if (this.playerCount === 1) lists.push(b[1][name]); }
    else if (this.playerCount === 2) lists.push(b[1][name]);
    for (var i = 0; i < lists.length; i++) { var l = lists[i] || []; for (var j = 0; j < l.length; j++) if (this.codes[l[j]]) return true; }
    return false;
  };
  function PlayerInput(input, i) { this.input = input; this.index = i; }
  PlayerInput.prototype.pressed = function (name) { return this.input._held(this.index, name); };
  PlayerInput.prototype.onPress = function (cb) { this.input._plCbs[this.index].push(cb); return this; };
  Object.defineProperty(PlayerInput.prototype, 'dir', { get: function () {
    return { x: (this.pressed('right') ? 1 : 0) - (this.pressed('left') ? 1 : 0), y: (this.pressed('down') ? 1 : 0) - (this.pressed('up') ? 1 : 0) };
  } });

  // ---------- Звук: 8-бит SFX + процедурная чиптюн-музыка (секвенсор на WebAudio) ----------
  // Политика автоплея: AudioContext создаётся/возобновляется ТОЛЬКО после первого жеста
  // (клавиша/тап/клик). До жеста beep() и музыка молчат (музыка «ждёт» и стартует на жесте).
  function Audio() {
    this.enabled = Store.get('arcade.sound', '1') !== '0';
    this.ac = null; this._music = {}; this._cur = null; this.unlocked = false;
    this.music = new Music(this);
    var self = this, w = global;
    if (w && typeof w.addEventListener === 'function') {
      var unlock = function () {
        self.unlocked = true; var ac = self._ctx();
        if (ac && ac.state === 'suspended' && !self._hidden) { try { ac.resume(); } catch (e) {} }
        self.music._sync();
      };
      ['pointerdown', 'keydown', 'touchstart', 'mousedown'].forEach(function (ev) { w.addEventListener(ev, unlock, true); });
      if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', function () { // вкладка скрыта — звук спит
        self._hidden = doc.hidden; var ac = self.ac; if (!ac) return;
        try { if (doc.hidden) ac.suspend(); else if (self.unlocked) ac.resume(); } catch (e) {}
      });
    }
  }
  Audio.prototype._ctx = function () { if (this.ac) return this.ac; if (!this.unlocked) return null; try { this.ac = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) { this.ac = null; } return this.ac; };
  Audio.prototype.beep = function (f, d, type, vol) {
    if (!this.enabled) return; var ac = this._ctx(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'square'; o.frequency.value = f || 440;
    o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(vol == null ? 0.07 : vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (d || 0.1)); o.start(); o.stop(ac.currentTime + (d || 0.1));
  };
  Audio.prototype.toggle = function () {
    this.enabled = !this.enabled; Store.set('arcade.sound', this.enabled ? '1' : '0');
    if (!this.enabled) this._stopLegacy();
    this.music._sync(); // выкл — музыка на паузе (позиция сохраняется), вкл — продолжит, если идёт игра
    return this.enabled;
  };
  // Музыка. Основной путь — трек-данные для встроенного секвенсора: g.audio.setMusic(track).
  // registerMusic(name, X): X — трек-данные (под тему name: 'retro'/'modern') ИЛИ legacy-плеер
  // { start(ctx), stop() } (как в v2.0); null — ничего (совместимость с hrum).
  Audio.prototype.setMusic = function (track) { this.music.set(track); };
  Audio.prototype.registerMusic = function (name, player) {
    if (player && typeof player.start !== 'function') { this.music.setFor(name, player); return; }
    this._music[name] = player;
  };
  Audio.prototype.playMusic = function (name) {
    var p = this._music[name];
    if (p && typeof p.start === 'function') { // legacy-плеер
      if (!this.enabled) return; this._stopLegacy(); this._cur = p; try { p.start(this._ctx()); } catch (e) {} return;
    }
    this.music.play();
  };
  Audio.prototype._stopLegacy = function () { if (this._cur && this._cur.stop) { try { this._cur.stop(); } catch (e) {} } this._cur = null; };
  Audio.prototype.stopMusic = function () { this._stopLegacy(); this.music.stop(); };

  // --- Нотация трека ---
  // track = { bpm:132, div:2 (шагов на долю; 2 = восьмые), melody:'…', bass:'…', drums:'…',
  //           lead:{retro:'square',modern:'triangle'} (необяз.), vol:1 (необяз.) }
  // Голос — строка токенов через пробел, 1 токен = 1 шаг: 'C5' 'F#4' 'Bb3' — нота, '-' — тянуть
  // предыдущую, '.' — пауза, '|' — разделитель тактов (игнорируется). Ударные: 'k' бочка,
  // 's' малый, 'h' хэт, 'o' открытый хэт, комбинации 'kh'. Голоса зацикливаются НЕЗАВИСИМО:
  // бас на 2 такта под мелодию на 16 — норма. Можно передать массив строк (склеится).
  var NOTE_IX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(tok) {
    var m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(tok); if (!m) return 0;
    var midi = NOTE_IX[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function parseVoice(src, drums) {
    if (Array.isArray(src)) src = src.join(' ');
    var toks = String(src || '').replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean), out = [], last = -1;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t === '-') { if (last >= 0) out[last].len++; out.push(null); continue; }
      if (t === '.') { out.push(null); last = -1; continue; }
      if (drums) { if (!/^[ksho]+$/.test(t)) throw new Error('music: неизвестный удар «' + t + '»'); out.push({ hit: t, len: 1 }); last = -1; continue; }
      var f = noteFreq(t); if (!f) throw new Error('music: неизвестная нота «' + t + '»');
      out.push({ f: f, len: 1 }); last = out.length - 1;
    }
    return out;
  }
  function parseTrack(t) {
    if (!t) return null; if (t._compiled) return t._compiled;
    var c = { bpm: t.bpm || 120, div: t.div || 2, vol: t.vol == null ? 1 : t.vol, lead: t.lead || {},
      melody: parseVoice(t.melody), bass: parseVoice(t.bass), drums: parseVoice(t.drums, true), src: t };
    c.steps = Math.max(c.melody.length, c.bass.length, c.drums.length, 1);
    try { Object.defineProperty(t, '_compiled', { value: c, enumerable: false }); } catch (e) {}
    return c;
  }

  // --- Секвенсор: lookahead-планировщик (setInterval 25 мс, окно 0.15 с) ---
  // Состояние «хочу»: want = 'play' | 'pause' | 'stop' (задаёт движок по сцене или игра);
  // реально звучит, только если want==='play' && звук вкл && был жест && есть трек.
  function Music(audio) {
    this.audio = audio; this.track = null; this.byTheme = {}; this.want = 'stop';
    this.playing = false; this.step = 0; this.next = 0; this.timer = null; this.bus = null;
    this.volume = 0.8; this.theme = function () { return 'modern'; };
    this.stats = { scheduled: 0, started: 0, errors: 0 }; // отладочные счётчики (для автотестов)
  }
  Music.prototype.set = function (track) { this.track = parseTrack(track); this._restartIfPlaying(); };
  Music.prototype.setFor = function (theme, track) { this.byTheme[theme] = parseTrack(track); this._restartIfPlaying(); };
  Music.prototype.current = function () { return this.byTheme[this.theme()] || this.track; };
  Music.prototype.has = function () { return !!this.current(); };
  Music.prototype._restartIfPlaying = function () { if (this.playing) { this._halt(); this._sync(); } };
  Music.prototype.play = function (restart) { if (restart) this.step = 0; this.want = 'play'; this._sync(); };
  Music.prototype.pause = function () { this.want = 'pause'; this._sync(); };
  Music.prototype.stop = function () { this.want = 'stop'; this.step = 0; this._sync(); };
  Music.prototype._sync = function () {
    var a = this.audio, should = this.want === 'play' && a.enabled && a.unlocked && this.has();
    if (should && !this.playing) this._begin(); else if (!should && this.playing) this._halt();
    if (this.want === 'stop') this.step = 0;
  };
  Music.prototype._begin = function () {
    var ac = this.audio._ctx(); if (!ac) return; var self = this;
    try { if (ac.state === 'suspended' && !this.audio._hidden) ac.resume(); } catch (e) {}
    this.bus = ac.createGain(); this.bus.gain.value = this.volume; this.bus.connect(ac.destination);
    this.next = ac.currentTime + 0.06; this.playing = true; this.stats.started++;
    this.timer = setInterval(function () { self._tick(); }, 25); this._tick();
  };
  Music.prototype._halt = function () { // быстрый fade и отключение шины — уже запланированные ноты обрываются
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    var bus = this.bus, ac = this.audio.ac, c = this.current(); this.bus = null; this.playing = false;
    if (ac && c) { var ahead = Math.floor((this.next - ac.currentTime) * c.bpm * c.div / 60); if (ahead > 0) this.step = Math.max(0, this.step - ahead); } // вернуть оборванные шаги
    if (bus && ac) { try { bus.gain.setTargetAtTime(0, ac.currentTime, 0.02); } catch (e) {} setTimeout(function () { try { bus.disconnect(); } catch (e) {} }, 150); }
  };
  Music.prototype._tick = function () {
    var ac = this.audio.ac, c = this.current(); if (!ac || !c || !this.bus) return;
    var spb = 60 / c.bpm / c.div, now = ac.currentTime;
    if (this.next < now - 0.05) this.next = now + 0.02; // вкладка спала/лаг — не играем «догоняющую» пачку
    var guard = 0;
    while (this.next < now + 0.15 && guard++ < 64) {
      try { this._stepAt(c, this.step, this.next, spb); } catch (e) { this.stats.errors++; }
      this.next += spb; this.step++;
    }
  };
  Music.prototype._stepAt = function (c, step, t, spb) {
    var retro = this.theme() === 'retro', ev;
    if (c.bass.length && (ev = c.bass[step % c.bass.length])) this._tone('bass', ev.f, t, ev.len * spb, retro, c);
    if (c.melody.length && (ev = c.melody[step % c.melody.length])) this._tone('lead', ev.f, t, ev.len * spb, retro, c);
    if (c.drums.length && (ev = c.drums[step % c.drums.length])) for (var i = 0; i < ev.hit.length; i++) this._drum(ev.hit[i], t, retro, c);
  };
  // Тембры: retro — квадрат/треугольник «как на 8-бит приставке», жёсткие огибающие;
  // modern — мягче: синус+треугольник через НЧ-фильтр, плавная атака, длиннее хвост.
  Music.prototype._tone = function (part, f, t, dur, retro, c) {
    var ac = this.audio.ac, out = this.bus, vol = c.vol, g = ac.createGain(), o = ac.createOscillator(), o2 = null, end;
    if (retro) {
      o.type = part === 'bass' ? 'triangle' : (c.lead.retro || 'square');
      var pk = (part === 'bass' ? 0.11 : (o.type === 'triangle' ? 0.08 : 0.035)) * vol;
      end = t + Math.max(0.04, dur * 0.92);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.004);
      g.gain.setValueAtTime(pk * 0.8, t + Math.min(0.05, dur * 0.4)); g.gain.linearRampToValueAtTime(0, end);
      o.frequency.setValueAtTime(f, t); o.connect(g);
    } else {
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = part === 'bass' ? 700 : 2400; lp.Q.value = 0.7;
      o.type = part === 'bass' ? 'sine' : (c.lead.modern || 'triangle'); o.frequency.setValueAtTime(f, t);
      if (part !== 'bass') { o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t); o2.detune.value = 7; }
      var pk2 = (part === 'bass' ? 0.16 : 0.075) * vol;
      end = t + Math.max(0.08, dur * 0.95) + 0.12;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk2, t + 0.02);
      g.gain.setTargetAtTime(pk2 * 0.55, t + 0.03, 0.12); g.gain.setTargetAtTime(0, t + Math.max(0.06, dur * 0.95), 0.05);
      o.connect(lp); if (o2) { var g2 = ac.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(lp); }
      lp.connect(g);
    }
    g.connect(out); o.start(t); o.stop(end + 0.05); if (o2) { o2.start(t); o2.stop(end + 0.05); }
    this.stats.scheduled++;
  };
  Music.prototype._noise = function () {
    var ac = this.audio.ac; if (this._nb && this._nbCtx === ac) return this._nb;
    var len = Math.floor(ac.sampleRate * 0.5), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nb = b; this._nbCtx = ac; return b;
  };
  Music.prototype._drum = function (k, t, retro, c) {
    var ac = this.audio.ac, out = this.bus, vol = c.vol, g = ac.createGain(), dur;
    if (k === 'k') { // бочка — тон с падающей частотой
      var o = ac.createOscillator(); o.type = retro ? 'triangle' : 'sine'; dur = retro ? 0.11 : 0.18;
      o.frequency.setValueAtTime(retro ? 170 : 130, t); o.frequency.exponentialRampToValueAtTime(42, t + dur);
      g.gain.setValueAtTime((retro ? 0.16 : 0.2) * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
    } else { // шумовые: малый / хэт / открытый хэт
      var n = ac.createBufferSource(), fl = ac.createBiquadFilter(); n.buffer = this._noise();
      if (k === 's') { fl.type = retro ? 'highpass' : 'bandpass'; fl.frequency.value = retro ? 1200 : 1800; dur = retro ? 0.1 : 0.14; g.gain.setValueAtTime((retro ? 0.07 : 0.05) * vol, t); }
      else { fl.type = 'highpass'; fl.frequency.value = retro ? 6500 : 8000; dur = k === 'o' ? 0.16 : (retro ? 0.035 : 0.05); g.gain.setValueAtTime((retro ? 0.035 : 0.022) * vol, t); }
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(fl); fl.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.02);
    }
    this.stats.scheduled++;
  };

  // ---------- Частицы / Сетка (как v1) ----------
  function Particles() { this.list = []; }
  Particles.prototype.spawn = function (x, y, o) { o = o || {}; var n = o.count || 8; for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = (o.speed || 60) * (0.3 + Math.random()); this.list.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: o.life || 0.5, t: o.life || 0.5, color: o.color || '#ffd15e', size: o.size || 3 }); } };
  Particles.prototype.update = function (dt) { for (var i = 0; i < this.list.length; i++) { var p = this.list[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; p.t -= dt; } this.list = this.list.filter(function (p) { return p.t > 0; }); };
  Particles.prototype.draw = function (ctx) { for (var i = 0; i < this.list.length; i++) { var p = this.list[i]; ctx.globalAlpha = Math.max(0, p.t / p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); } ctx.globalAlpha = 1; };
  function Grid(cols, rows, tile, fill) { this.cols = cols; this.rows = rows; this.tile = tile; this.cells = new Array(cols * rows).fill(fill == null ? 0 : fill); }
  Grid.prototype.idx = function (x, y) { return y * this.cols + x; };
  Grid.prototype.inside = function (x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; };
  Grid.prototype.get = function (x, y) { return this.inside(x, y) ? this.cells[this.idx(x, y)] : undefined; };
  Grid.prototype.set = function (x, y, v) { if (this.inside(x, y)) this.cells[this.idx(x, y)] = v; };
  Grid.prototype.fill = function (v) { this.cells.fill(v); };
  Grid.prototype.forEach = function (cb) { for (var y = 0; y < this.rows; y++) for (var x = 0; x < this.cols; x++) cb(x, y, this.cells[this.idx(x, y)]); };
  Grid.prototype.px = function (x, y) { return { x: x * this.tile, y: y * this.tile }; };

  function loadSprites(map, done) { var out = {}, keys = Object.keys(map), left = keys.length; if (!left) { done && done(out); return out; } keys.forEach(function (k) { var img = new Image(); img.onload = img.onerror = function () { out[k] = img; if (--left === 0) done && done(out); }; img.src = map[k]; }); return out; }

  // ---------- Меню (навигация стрелками + action + клик/тап) ----------
  // Пункт: { key, label: строка|()=>строка, onSelect() }. key — для add/remove (встроенные: title — play/lang/theme/sound,
  // pause — resume/sound/menu).
  function Menu(items) { this.items = items; this.sel = 0; }
  Menu.prototype.move = function (d) { this.sel = (this.sel + d + this.items.length) % this.items.length; };
  Menu.prototype.current = function () { return this.items[this.sel]; };
  Menu.prototype.indexOf = function (key) { for (var i = 0; i < this.items.length; i++) if (this.items[i].key === key) return i; return -1; };
  Menu.prototype.keys = function () { return this.items.map(function (it) { return it.key; }); };
  // where: { after:key } | { before:key } | { index:n }; без where (или ключ не найден) — в конец. Тот же key — заменяется.
  Menu.prototype.add = function (item, where) {
    where = where || {}; var cur = this.items[this.sel];
    if (item.key != null) { var old = this.indexOf(item.key); if (old >= 0) this.items.splice(old, 1); }
    var i = this.items.length, j;
    if (where.after != null) { j = this.indexOf(where.after); if (j >= 0) i = j + 1; }
    else if (where.before != null) { j = this.indexOf(where.before); if (j >= 0) i = j; }
    else if (where.index != null) i = Math.max(0, Math.min(this.items.length, where.index | 0));
    this.items.splice(i, 0, item); this._keep(cur); return item;
  };
  Menu.prototype.remove = function (key) { var i = this.indexOf(key); if (i < 0) return false; var cur = this.items[this.sel]; this.items.splice(i, 1); this._keep(cur); return true; };
  Menu.prototype._keep = function (cur) { var i = this.items.indexOf(cur); this.sel = i >= 0 ? i : Math.max(0, Math.min(this.sel, this.items.length - 1)); };
  Menu.prototype.draw = function (g, x, y, lh) {
    lh = lh || 30; var c = g.ctx, th = g.th();
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i], on = i === this.sel, label = typeof it.label === 'function' ? it.label() : it.label;
      g.text((on ? '▸ ' : '  ') + label, x, y + i * lh, { size: 17, align: 'center', color: on ? th.accent : th.muted, weight: on ? 800 : 600 });
      it._y = y + i * lh;
    }
  };
  Menu.prototype.pointer = function (py) { for (var i = 0; i < this.items.length; i++) { if (this.items[i]._y != null && Math.abs(py - (this.items[i]._y - 6)) < 16) { this.sel = i; return true; } } return false; };

  // Публичный API меню стандартных экранов: g.menu.addItem/removeItem/items/get/setHint.
  // Можно звать до useStandardScreens — пункты применятся, когда меню появится.
  function MenuApi(g) { this.g = g; this._menus = Object.create(null); this._pending = []; this._hints = Object.create(null); }
  // o = { key, label, onSelect, scene:'title'|'pause' (по умолч. title), after|before|index }
  MenuApi.prototype.addItem = function (o) {
    var sc = o.scene || 'title', item = { key: o.key, label: o.label, onSelect: o.onSelect }, where = { after: o.after, before: o.before, index: o.index };
    var m = this._menus[sc]; if (m) m.add(item, where); else this._pending.push({ scene: sc, item: item, where: where });
    return this;
  };
  MenuApi.prototype.removeItem = function (key, scene) {
    var sc = scene || 'title', m = this._menus[sc];
    this._pending = this._pending.filter(function (p) { return !(p.scene === sc && p.item.key === key); });
    return m ? m.remove(key) : false;
  };
  MenuApi.prototype.get = function (scene) { return this._menus[scene || 'title'] || null; };
  MenuApi.prototype.items = function (scene) { var m = this.get(scene); return m ? m.keys() : []; };
  // Подсказка под меню: fn() → строки или { text, dim } (dim — приглушённо); рисуется внизу экрана сцены.
  MenuApi.prototype.setHint = function (fn, scene) { this._hints[scene || 'title'] = fn || null; return this; };
  MenuApi.prototype._register = function (scene, menu) {
    this._menus[scene] = menu; var rest = [];
    this._pending.forEach(function (p) { if (p.scene === scene) menu.add(p.item, p.where); else rest.push(p); });
    this._pending = rest;
  };
  MenuApi.prototype._drawHint = function (scene) {
    var fn = this._hints[scene]; if (!fn) return; var g = this.g, th = g.th(), lines = fn.call(g) || [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], txt = typeof ln === 'string' ? ln : ln.text, dim = typeof ln === 'object' && ln && ln.dim;
      g.text(txt, g.W / 2, g.H - 72 + i * 20, { size: 13, align: 'center', weight: 700, color: dim ? th.muted : th.ink });
    }
  };

  // ---------- Движок ----------
  function Engine(opts) {
    opts = opts || {};
    this.canvas = typeof opts.canvas === 'string' ? doc.querySelector(opts.canvas) : opts.canvas;
    if (!this.canvas) throw new Error('Arcade: canvas not found');
    this.gameId = opts.gameId || 'game';
    this.W = opts.width || this.canvas.width || 480; this.H = opts.height || this.canvas.height || 480;
    this.canvas.width = this.W; this.canvas.height = this.H; this.ctx = this.canvas.getContext('2d');
    this.input = new Input(); this.audio = new Audio(); this.particles = new Particles();
    this.menu = new MenuApi(this);
    this.musicAuto = opts.musicAuto !== false; // музыка по сценам: play — звучит, pause — пауза, прочие — стоп
    this.i18n = new I18n(opts.strings, opts.lang);
    this.themeName = Store.get('arcade.theme', opts.theme || 'modern'); // modern по умолчанию
    this.themesMap = Object.assign({}, THEMES, opts.themes || {});
    this.step = opts.step || 1 / 60; this.scenes = Object.create(null); this.current = null;
    this.state = { score: 0, lives: opts.lives || 3, level: 1, best: this.loadBest() };
    this.running = false; this._acc = 0; this._last = 0; this._raf = 0; this.time = 0;
    this._applyPixel();
    var self = this;
    this.audio.music.theme = function () { return self.themeName; };
    this.input._inPlay = function () { return self._sceneName === 'play'; }; // ввод игроков — только в play
    var preset = opts.music || (Arcade.tracks && Arcade.tracks[this.gameId]); // трек из js/music.js игры
    if (preset) this.audio.setMusic(preset);
    this.canvas.addEventListener('click', function (e) { self._click(e); });
    this.canvas.addEventListener('touchstart', function (e) { if (self.current && self.current._menu) { e.preventDefault(); self._click(e.changedTouches[0]); } }, { passive: false });
  }
  Engine.prototype.th = function () { return this.themesMap[this.themeName] || THEMES.modern; };
  Engine.prototype.t = function (k, f) { return this.i18n.t(k, f); };
  Engine.prototype._applyPixel = function () { this.ctx.imageSmoothingEnabled = !this.th().pixel; };
  Engine.prototype.setTheme = function (name) { this.themeName = name; Store.set('arcade.theme', name); this._applyPixel(); };
  Engine.prototype.toggleTheme = function () { var order = ['modern', 'retro']; if (this.themesMap.neon && this._allowNeon) order.push('neon'); this.setTheme(order[(order.indexOf(this.themeName) + 1) % order.length]); return this.themeName; };
  Engine.prototype.loadBest = function () { return Store.getNum('arcade.best.' + this.gameId, 0); };
  Engine.prototype.saveBest = function () { if (this.state.score > this.state.best) { this.state.best = this.state.score; Store.set('arcade.best.' + this.gameId, String(this.state.best)); } };

  Engine.prototype.scene = function (name, def) { this.scenes[name] = def; return this; };
  Engine.prototype.goto = function (name, data) { this.current = this.scenes[name]; this._sceneName = name; this._acc = 0; if (name === 'play') this.input._armedAt = now(); this._musicScene(name, data || {}); if (this.current && this.current.enter) this.current.enter.call(this, data || {}); };
  // Музыка следует за сценой (если musicAuto): play — играет (resume — с того же места, иначе с начала),
  // pause — пауза, title/win/gameover и прочие — стоп (на win/gameover звучит SFX движка, музыка не мешает).
  Engine.prototype._musicScene = function (name, data) {
    if (!this.musicAuto) return; var m = this.audio.music;
    if (name === 'play') m.play(!data.resume); else if (name === 'pause') m.pause(); else m.stop();
  };
  Engine.prototype._click = function (e) {
    var r = this.canvas.getBoundingClientRect(), py = (e.clientY - r.top) * (this.H / r.height);
    var sc = this.current; if (sc && sc._menu) { if (sc._menu.pointer(py)) { this._selectMenu(); } }
  };
  Engine.prototype._selectMenu = function () { var sc = this.current; if (sc && sc._menu) { var it = sc._menu.current(); if (it && it.onSelect) it.onSelect.call(this); } };
  Engine.prototype.start = function (name) {
    var self = this;
    this.input.onPress(function (a) {
      var sc = self.current;
      if (a === 'mute') { self.audio.toggle(); return; }
      if (sc && sc._menu) {
        if (a === 'up') { sc._menu.move(-1); self.audio.beep(600, 0.03); return; }
        if (a === 'down') { sc._menu.move(1); self.audio.beep(600, 0.03); return; }
        if (a === 'action' || a === 'start') { self._selectMenu(); return; }
      }
      if (a === 'lang') self.i18n.toggle();
      if (a === 'theme') self.toggleTheme();
      if (sc && sc.press) sc.press.call(self, a);
    });
    this.goto(name || 'title'); this.running = true; this._last = performance.now();
    var loop = function (t) {
      self._raf = requestAnimationFrame(loop);
      var dt = (t - self._last) / 1000; self._last = t; if (dt > 0.25) dt = 0.25;
      self.time += dt; self.particles.update(dt);
      var sc = self.current; if (!sc) return;
      if (sc.realtime) { if (sc.update) sc.update.call(self, dt); }
      else { self._acc += dt; while (self._acc >= self.step) { self._acc -= self.step; if (sc.update) sc.update.call(self, self.step); } }
      self.ctx.save(); if (sc.draw) sc.draw.call(self, self.ctx); self.particles.draw(self.ctx); self.ctx.restore();
    };
    this._raf = requestAnimationFrame(loop); return this;
  };
  Engine.prototype.stop = function () { cancelAnimationFrame(this._raf); this.running = false; };

  // Рисование (учитывает тему)
  Engine.prototype.clear = function (c) { var th = this.th(); this.ctx.fillStyle = c || th.bg; this.ctx.fillRect(0, 0, this.W, this.H); };
  Engine.prototype.rect = function (x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, w, h); };
  Engine.prototype.sprite = function (img, x, y, w, h) { if (img) this.ctx.drawImage(img, x, y, w, h); };
  Engine.prototype.text = function (s, x, y, o) { o = o || {}; var c = this.ctx, th = this.th(); c.fillStyle = o.color || th.ink; c.font = (o.weight || 800) + ' ' + (o.size || 16) + 'px ' + (o.font || th.font); c.textAlign = o.align || 'left'; c.textBaseline = o.baseline || 'alphabetic'; c.fillText(s, x, y); };
  Engine.prototype.hud = function (o) {
    o = o || this.state; var th = this.th(); this.ctx.save();
    this.text(this.t('score', 'Счёт') + ' ' + (o.score | 0), 10, 22, { size: 14 });
    if (o.level != null) this.text(this.t('level', 'Ур.') + ' ' + o.level, this.W / 2, 22, { size: 14, align: 'center' });
    if (o.lives != null) this.text('♥ ' + o.lives, this.W - 10, 22, { size: 14, align: 'right', color: th.bad });
    this.ctx.restore();
  };
  Engine.prototype.overlay = function (title, sub, color) {
    var th = this.th(), c = this.ctx; c.save();
    c.fillStyle = 'rgba(6,8,12,.82)'; c.fillRect(0, 0, this.W, this.H);
    this.text(title, this.W / 2, this.H / 2 - 20, { size: Math.min(44, this.W / 9), align: 'center', color: color || th.accent });
    if (sub) this.text(sub, this.W / 2, this.H / 2 + 14, { size: 15, align: 'center', color: th.muted, weight: 600 });
    c.restore();
  };

  // Меню: title/pause/settings + помощники проходимости
  Engine.prototype.useStandardScreens = function (cfg) {
    cfg = cfg || {}; var self = this; this._allowNeon = !!cfg.neon;
    var startPlay = function () { self.state.score = 0; self.state.lives = cfg.lives || 3; self.state.level = 1; self.goto('play'); };
    var titleMenu = new Menu([
      { key: 'play', label: function () { return self.t('play', 'Играть'); }, onSelect: startPlay },
      { key: 'lang', label: function () { return (self.t('language', 'Язык') + ': ' + (self.i18n.lang === 'ru' ? 'RU' : 'EN')); }, onSelect: function () { self.i18n.toggle(); } },
      { key: 'theme', label: function () { return (self.t('theme', 'Тема') + ': ' + self.themeName); }, onSelect: function () { self.toggleTheme(); } },
      { key: 'sound', label: function () { return (self.t('sound', 'Звук') + ': ' + (self.audio.enabled ? self.t('on', 'вкл') : self.t('off', 'выкл'))); }, onSelect: function () { self.audio.toggle(); } },
    ]);
    this.scene('title', { realtime: true, _menu: titleMenu, enter: function () { this.audio.beep(520, 0.08); },
      draw: function () { this.clear(); this.text(cfg.title || this.t('title', 'ИГРА'), this.W / 2, this.H / 2 - 70, { size: Math.min(40, this.W / 9), align: 'center', color: this.th().accent }); if (cfg.subtitle) this.text(cfg.subtitle, this.W / 2, this.H / 2 - 42, { size: 13, align: 'center', color: this.th().muted, weight: 600 }); titleMenu.draw(this, this.W / 2, this.H / 2, 30); if (this.state.best) this.text((this.t('best', 'Рекорд')) + ': ' + this.state.best, this.W / 2, this.H - 20, { size: 12, align: 'center', color: this.th().muted, weight: 600 }); this.menu._drawHint('title'); } });
    this.menu._register('title', titleMenu);
    var pauseMenu = new Menu([
      { key: 'resume', label: function () { return self.t('resume', 'Продолжить'); }, onSelect: function () { self.goto('play', { resume: true }); } },
      { key: 'sound', label: function () { return (self.t('sound', 'Звук') + ': ' + (self.audio.enabled ? self.t('on', 'вкл') : self.t('off', 'выкл'))); }, onSelect: function () { self.audio.toggle(); } },
      { key: 'menu', label: function () { return self.t('menu', 'В меню'); }, onSelect: function () { self.goto('title'); } },
    ]);
    this.scene('pause', { realtime: true, _menu: pauseMenu, draw: function () { if (this.scenes.play && this.scenes.play.draw) this.scenes.play.draw.call(this, this.ctx); this.overlay(this.t('pause', 'ПАУЗА'), '', this.th().warn); pauseMenu.draw(this, this.W / 2, this.H / 2 + 20, 28); this.menu._drawHint('pause'); } });
    this.menu._register('pause', pauseMenu);
    this.scene('win', { realtime: true, enter: function () { this.saveBest(); this.audio.beep(1200, 0.2, 'triangle'); }, draw: function () { this.clear(); this.overlay(this.t('win', 'ПОБЕДА!'), this.t('score', 'Счёт') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best', 'Рекорд') + ': ' + this.state.best : ''), this.th().good); this.text(this.t('tapstart', 'пробел / тап'), this.W / 2, this.H - 24, { size: 12, align: 'center', color: this.th().muted, weight: 600 }); }, press: function () { this.goto('title'); } });
    this.scene('gameover', { realtime: true, enter: function () { this.saveBest(); this.audio.beep(140, 0.3, 'sawtooth'); }, draw: function () { this.clear(); this.overlay(this.t('gameover', 'КОНЕЦ ИГРЫ'), this.t('score', 'Счёт') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best', 'Рекорд') + ': ' + this.state.best : ''), this.th().bad); this.text(this.t('tapstart', 'пробел / тап'), this.W / 2, this.H - 24, { size: 12, align: 'center', color: this.th().muted, weight: 600 }); }, press: function () { this.goto('title'); } });
    return this;
  };
  // Локальный кооп «1–2 игрока за одной клавиатурой» поверх g.input.setPlayers (cfg — те же поля + hint, pad):
  // пункт меню «Игроки: 1/2» (key 'players', после «Играть») + клавиши 1/2 на заставке; выбор — arcade.players.<gameId>;
  // на «только тач» — 1 игрок (2 недоступно до первой физической клавиши); подсказка раскладки cfg.hint{ru,en}
  // под меню заставки (вторая строка яркая только при 2 игроках); кнопка [data-pause] в cfg.pad — пауза/продолжить.
  // → { count(), set(n) }; ввод — g.input.player(i).
  Engine.prototype.usePlayers = function (cfg) {
    cfg = cfg || {}; var self = this, inp = this.input, key = 'arcade.players.' + this.gameId, NUM = ['Digit1', 'Digit2', 'Numpad1', 'Numpad2'];
    inp.setPlayers({ bind: cfg.bind, actions: cfg.actions, repeat: cfg.repeat, touch: cfg.touch, reserved: NUM.concat(cfg.reserved || []) });
    inp.setPlayerCount(Store.get(key, '1') === '2' && !inp.touchOnly ? 2 : 1);
    var setN = function (v) {
      if (inp.touchOnly && v === 2) { self.audio.beep(200, 0.06); return; }
      inp.setPlayerCount(v); Store.set(key, String(inp.playerCount)); self.audio.beep(700, 0.04);
    };
    addEventListener('keydown', function (e) { // capture: раньше ввода движка
      if (e.isTrusted !== false) inp.touchOnly = false;
      if (self._sceneName !== 'title') return;
      if (e.code === 'Digit1' || e.code === 'Numpad1') setN(1); else if (e.code === 'Digit2' || e.code === 'Numpad2') setN(2);
    }, true);
    this.menu.addItem({ key: 'players', after: 'play',
      label: function () { return self.t('players', 'Игроки') + ': ' + inp.playerCount + (inp.touchOnly ? ' · ' + self.t('touch1p', 'тач — 1 игрок') : ''); },
      onSelect: function () { setN(inp.playerCount === 2 ? 1 : 2); } });
    if (cfg.hint) this.menu.setHint(function () {
      var lines = cfg.hint[self.i18n.lang] || cfg.hint.ru || [];
      if (inp.touchOnly) lines = lines.slice(0, 1);
      return lines.map(function (s, i) { return { text: s, dim: !(i === 0 || (i === 1 && inp.playerCount === 2)) }; });
    }, 'title');
    var pb = cfg.pad && cfg.pad.querySelector && cfg.pad.querySelector('[data-pause]');
    if (pb) {
      var hp = function (e) { e.preventDefault(); if (self._sceneName === 'play') self.pause(); else if (self._sceneName === 'pause') self.goto('play', { resume: true }); };
      pb.addEventListener('touchstart', hp, { passive: false }); pb.addEventListener('mousedown', hp);
    }
    this.players = { count: function () { return inp.playerCount; }, set: setN };
    return this.players;
  };
  Engine.prototype.win = function () { this.goto('win'); };
  Engine.prototype.gameover = function () { this.goto('gameover'); };
  Engine.prototype.pause = function () { this.goto('pause'); };
  Engine.prototype.nextLevel = function () { this.state.level++; };
  Engine.prototype.difficulty = function (base, step, max) { var v = base + (this.state.level - 1) * step; return max == null ? v : (step >= 0 ? Math.min(v, max) : Math.max(v, max)); };
  // Музыка: g.setMusic(track) — трек для встроенного секвенсора (тембр — по текущей теме: retro 8-бит,
  // modern мягкий). Совместимость v2.0: g.playMusic()/stopMusic() и registerMusic(theme, player|track).
  Engine.prototype.setMusic = function (track) { this.audio.setMusic(track); return this; };
  Engine.prototype.playMusic = function () { this.audio.playMusic(this.themeName); };
  Engine.prototype.stopMusic = function () { this.audio.stopMusic(); };
  Engine.prototype.fit = function (maxCssWidth) { var w = Math.min(maxCssWidth || 520, (this.canvas.parentElement || doc.body).clientWidth || this.W); this.canvas.style.width = w + 'px'; this.canvas.style.height = (w * this.H / this.W) + 'px'; };

  // Arcade.tracks[gameId] = track — так js/music.js игры регистрирует свою мелодию до createGame.
  var Arcade = (global.Arcade && global.Arcade.tracks) ? global.Arcade : {};
  Object.assign(Arcade, { createGame: function (o) { return new Engine(o); }, loadSprites: loadSprites, Grid: Grid, Input: Input, Audio: Audio, Music: Music, parseTrack: parseTrack, noteFreq: noteFreq, Particles: Particles, Menu: Menu, MenuApi: MenuApi, PlayerInput: PlayerInput, hotkeys: HOTKEYS.slice(), checkBindings: checkBindings, themes: THEMES, Store: Store, version: '2.2.0' });
  Arcade.tracks = Arcade.tracks || {};
  if (typeof module !== 'undefined' && module.exports) module.exports = Arcade;
  global.Arcade = Arcade;
})(typeof window !== 'undefined' ? window : globalThis);
