/* МАЯЧНИЦА · stats.js — локальная статистика прохождения для плейтеста владельца.
   Неинвазивно: только слушает события игры (onEvent) и считает время по сценам. НИКАКОЙ отправки наружу — данные лежат
   в localStorage этого браузера (ключ arcade.kvest.stats) и выгружаются только кнопкой (файл JSON).
   Что считается: время в каждой сцене (и число заходов), подсказки (бесплатные / по таймеру / после светлячков) и где их брали,
   ошибки (предмет не туда, неверная комбинация, неверный ход механизма или ноты), осмотры, решённые головоломки с отметкой
   времени, общее время, финал. Время идёт только в игровой сцене и только пока вкладка видима (пауза и меню не считаются). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var KEY = 'arcade.kvest.stats', V = 1;

  function blank(meta) {
    return { v: V, started: new Date().toISOString(), meta: meta || {}, time: 0, scenes: {}, order: [],
      hints: { free: 0, timer: 0, game: 0, total: 0 }, errors: { item: 0, combo: 0, mech: 0, total: 0 }, looks: 0,
      puzzles: [], finished: false, finishTime: null, sessions: 1, fps: { n: 0, sum: 0, min: 0 } };
  }
  function create(opts) {
    opts = opts || {};
    var store = opts.store !== undefined ? opts.store : (function () { try { return global.localStorage || null; } catch (e) { return null; } })();
    var S = null, cur = null, dirty = false;
    function load() { try { var s = store && store.getItem(KEY); if (!s) return null; var o = JSON.parse(s); return o && o.v === V && o.scenes ? o : null; } catch (e) { return null; } }
    function save() { if (!S || !store) return; try { store.setItem(KEY, JSON.stringify(S)); } catch (e) {} dirty = false; }
    function sc(id) { return S.scenes[id] || (S.scenes[id] = { time: 0, visits: 0, hints: 0, errors: 0, looks: 0 }); }
    var api = {
      KEY: KEY,
      // новая игра — новая статистика; «Продолжить» — продолжаем прежнюю (если её нет — заводим)
      begin: function (cont, meta) {
        var old = cont ? load() : null;
        S = old || blank(meta); if (old) { S.sessions++; if (meta) S.meta = meta; }
        cur = null; dirty = true; save(); return S;
      },
      event: function (type, d) {
        if (!S) return; d = d || {};
        if (type === 'scene') { cur = d.id; var s = sc(cur); s.visits++; if (S.order[S.order.length - 1] !== cur) S.order.push(cur); }
        else if (type === 'hint') { var how = d.how || 'free'; S.hints[how] = (S.hints[how] || 0) + 1; S.hints.total++; if (cur) sc(cur).hints++; }
        else if (type === 'error') { var k = d.kind || 'item'; S.errors[k] = (S.errors[k] || 0) + 1; S.errors.total++; if (cur) sc(cur).errors++; }
        else if (type === 'look') { S.looks++; if (cur) sc(cur).looks++; }
        else if (type === 'puzzle') S.puzzles.push({ id: d.id, t: Math.round(S.time), scene: cur });
        else if (type === 'win') { S.finished = true; S.finishTime = Math.round(S.time); save(); return; }
        else return;
        dirty = true;
      },
      // dt — секунды реального времени; active — идёт ли игра (сцена play, вкладка видима)
      tick: function (dt, active, fps) {
        if (!S || !active || !(dt > 0)) return;
        dt = Math.min(dt, 0.25); S.time += dt; if (cur) sc(cur).time += dt;
        if (fps > 0) { S.fps.n++; S.fps.sum += fps; S.fps.min = S.fps.min ? Math.min(S.fps.min, fps) : fps; }
        dirty = true;
      },
      flush: function () { if (dirty) save(); },
      data: function () { return S; },
      reset: function () { S = null; try { if (store) store.removeItem(KEY); } catch (e) {} },
      // сводка для экрана отладки: строки «сцена — время»
      summary: function () {
        if (!S) return null;
        var rows = Object.keys(S.scenes).map(function (id) { var s = S.scenes[id]; return { id: id, time: Math.round(s.time), visits: s.visits, hints: s.hints, errors: s.errors }; });
        return { time: Math.round(S.time), rows: rows, hints: S.hints, errors: S.errors, looks: S.looks, solved: S.puzzles.length, finished: S.finished,
          fps: S.fps.n ? Math.round(S.fps.sum / S.fps.n) : 0, fpsMin: Math.round(S.fps.min || 0) };
      },
      exportJSON: function (extra) {
        var o = JSON.parse(JSON.stringify(S || blank()));
        o.exported = new Date().toISOString(); o.summary = api.summary(); if (extra) o.extra = extra;
        return JSON.stringify(o, null, 2);
      }
    };
    return api;
  }
  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  K.Stats = { create: create, fmt: fmt, KEY: KEY };
})(typeof window !== 'undefined' ? window : globalThis);
