/* ОТБОЙНИК · мета-прогрессия между забегами (DOM-free, тестируется в Node). OTBOYNIK.meta
   Открытия — за достижения (дальность забега), без покупок: сила не продаётся.
   - Карты построек в раздаче: горн и пружинная стенка — сразу; колокольня — дойти до волны 2; магнит — до 4; делитель — до 6.
     Ремонт ворот и кованые флипперы — всегда.
   - Стартовая колода (выбор на заставке): постройка уже стоит на столе с начала забега. «Верстак» (пустой стол) — сразу;
     «Горн» — волна 3; «Колокол» — 5; «Магнит» — 7; «Делитель» — 9; «Мастер» (горн + колокольня) — победа над Копром.
   - Хранение: дальность — arcade.otboynik.wave (как и раньше, 'max'), победы — arcade.otboynik.wins ('max'),
     выбранная колода — arcade.otboynik.deck ('last'); всё через g.persist/g.storeSet → облако площадки. */
(function (global) {
  'use strict';
  var OB = global.OTBOYNIK = global.OTBOYNIK || {};
  var KEYS = { wave: 'arcade.otboynik.wave', wins: 'arcade.otboynik.wins', deck: 'arcade.otboynik.deck' };
  var CARDS = [{ id: 'forge', need: 0 }, { id: 'spring', need: 0 }, { id: 'bell', need: 2 }, { id: 'magnet', need: 4 }, { id: 'splitter', need: 6 }];
  var DECKS = [
    { id: 'bench', need: 0, starter: [] },
    { id: 'forge', need: 3, starter: ['forge'] },
    { id: 'bell', need: 5, starter: ['bell'] },
    { id: 'magnet', need: 7, starter: ['magnet'] },
    { id: 'splitter', need: 9, starter: ['splitter'] },
    { id: 'master', need: 0, wins: 1, starter: ['forge', 'bell'] }
  ];
  function deckOpen(d, best, wins) { return best >= d.need && (wins | 0) >= (d.wins | 0); }
  function pool(best) { return CARDS.filter(function (c) { return best >= c.need; }).map(function (c) { return c.id; }); }
  function decks(best, wins) { return DECKS.filter(function (d) { return deckOpen(d, best, wins); }).map(function (d) { return d.id; }); }
  function deck(id) { for (var i = 0; i < DECKS.length; i++) if (DECKS[i].id === id) return DECKS[i]; return DECKS[0]; }
  // опции забега для OB.Game: { pool, starter }; закрытая колода → «Верстак»
  function runOpts(id, best, wins) { var d = deck(id); if (!deckOpen(d, best, wins)) d = DECKS[0]; return { deck: d.id, pool: pool(best), starter: d.starter.slice() }; }
  // ближайшее закрытое: { kind:'card'|'deck', id, need, wins } или null
  function next(best, wins) {
    var c = CARDS.filter(function (x) { return best < x.need; })[0], d = DECKS.filter(function (x) { return !deckOpen(x, best, wins) && !x.wins; })[0];
    var n = !c ? (d ? { kind: 'deck', id: d.id, need: d.need } : null) : (!d || c.need <= d.need ? { kind: 'card', id: c.id, need: c.need } : { kind: 'deck', id: d.id, need: d.need });
    if (!n && (wins | 0) < 1) n = { kind: 'deck', id: 'master', need: 0, wins: 1 };
    return n;
  }
  // что открылось между двумя состояниями → [{ kind, id }]
  function gained(b0, w0, b1, w1) {
    var out = [];
    CARDS.forEach(function (c) { if (b0 < c.need && b1 >= c.need) out.push({ kind: 'card', id: c.id }); });
    DECKS.forEach(function (d) { if (!deckOpen(d, b0, w0) && deckOpen(d, b1, w1)) out.push({ kind: 'deck', id: d.id }); });
    return out;
  }
  function cycle(id, best, wins, dir) { var l = decks(best, wins), i = l.indexOf(id); if (i < 0) i = 0; return l[(i + (dir || 1) + l.length) % l.length]; }
  OB.meta = { KEYS: KEYS, CARDS: CARDS, DECKS: DECKS, pool: pool, decks: decks, deck: deck, runOpts: runOpts, next: next, gained: gained, cycle: cycle };
})(typeof window !== 'undefined' ? window : globalThis);
