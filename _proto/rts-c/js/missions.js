/* ГАТЬ · миссии данными. Карта собирается генератором (game.js genMap) из островов и мостков-гатей:
   isles — острова {x,y (центр в клетках), rx,ry (полуоси), pt: 'home'|'post'|'nest' (веха), spawn: 'S'|'B', trees},
   gat — мостки между островами [i,j] (по воде, ширина 2), ford — броды-мели [i,j] (медленно).
   waves — волны из омутов: first (с), every (с), состав по номеру волны k: [база, прирост на волну].
   boss — мини-босс: вид, время появления (если гнёзда ещё не разорены), омут появления. */
(function (root) {
  'use strict';
  var GAT = root.GAT = root.GAT || {};
  GAT.missions = [
    { id: 1, w: 50, h: 32, seed: 1101, start: 130,
      squads: ['shield', 'bow'], allow: ['bow', 'shield', 'cart'],
      isles: [
        { x: 6, y: 16, rx: 5.5, ry: 6, pt: 'home', trees: 2 },
        { x: 17, y: 7, rx: 4.2, ry: 3.4, pt: 'post', trees: 1 },
        { x: 18, y: 25, rx: 4.5, ry: 3.4, pt: 'post', trees: 1 },
        { x: 29, y: 16, rx: 5, ry: 4.4, pt: 'nest', trees: 2 },
        { x: 40, y: 7, rx: 4.4, ry: 3.6, pt: 'nest', trees: 1 },
        { x: 40, y: 25, rx: 4.4, ry: 3.8, pt: 'post', trees: 1 },
        { x: 46, y: 16, rx: 3.4, ry: 4.4, spawn: 'S', boss: true },
      ],
      gat: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6], [1, 4]],
      ford: [[2, 5]],
      waves: { first: 80, every: 70, kochkar: [3, 0.7], plevun: [1, 0.5], tinnik: [0, 0] },
      guards: { kochkar: 3, plevun: 1 }, nestCap: 5,
      boss: { kind: 'koryazhnik', min: 420, time: 600 } },

    { id: 2, w: 56, h: 34, seed: 2207, start: 150,
      squads: ['shield', 'bow'], allow: ['bow', 'shield', 'cart'],
      isles: [
        { x: 6, y: 27, rx: 5.5, ry: 5, pt: 'home', trees: 2 },
        { x: 9, y: 9, rx: 4, ry: 3.6, pt: 'post', trees: 1 },
        { x: 21, y: 21, rx: 4.6, ry: 4, pt: 'post', trees: 2 },
        { x: 24, y: 6, rx: 4.4, ry: 3.4, pt: 'nest', trees: 1 },
        { x: 35, y: 27, rx: 4.6, ry: 3.8, pt: 'nest', trees: 1 },
        { x: 37, y: 14, rx: 5, ry: 4.4, pt: 'post', trees: 2 },
        { x: 49, y: 6, rx: 4, ry: 3.6, pt: 'nest', trees: 1 },
        { x: 51, y: 27, rx: 3.6, ry: 4, spawn: 'S' },
        { x: 52, y: 16, rx: 3, ry: 3.4, spawn: 'B', boss: true },
      ],
      gat: [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [2, 5], [3, 5], [5, 6], [4, 7], [5, 8], [6, 8], [4, 5]],
      ford: [[1, 2]],
      waves: { first: 75, every: 65, kochkar: [3, 0.7], plevun: [1, 0.6], tinnik: [0, 0.25] },
      guards: { kochkar: 2, plevun: 2 }, nestCap: 6,
      boss: { kind: 'kamyshnitsa', min: 450, time: 630 } },

    { id: 3, w: 58, h: 36, seed: 3313, start: 170,
      squads: ['shield', 'bow', 'cart'], allow: ['bow', 'shield', 'cart'],
      isles: [
        { x: 7, y: 18, rx: 5.5, ry: 5.5, pt: 'home', trees: 2 },
        { x: 18, y: 7, rx: 4.2, ry: 3.4, pt: 'post', trees: 1 },
        { x: 18, y: 29, rx: 4.2, ry: 3.4, pt: 'post', trees: 1 },
        { x: 27, y: 18, rx: 4.8, ry: 4.2, pt: 'nest', trees: 2 },
        { x: 34, y: 6, rx: 4.2, ry: 3.4, pt: 'nest', trees: 1 },
        { x: 34, y: 30, rx: 4.2, ry: 3.4, pt: 'nest', trees: 1 },
        { x: 42, y: 18, rx: 4.6, ry: 4.2, pt: 'post', trees: 2 },
        { x: 51, y: 8, rx: 3.8, ry: 3.4, pt: 'nest', trees: 1 },
        { x: 52, y: 26, rx: 3.6, ry: 3.6, spawn: 'S' },
        { x: 53, y: 17, rx: 3.4, ry: 3.6, spawn: 'B', boss: true },
      ],
      gat: [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [2, 5], [3, 6], [4, 6], [5, 6], [6, 7], [6, 9], [7, 9], [5, 8], [8, 9]],
      ford: [[3, 4]],
      waves: { first: 70, every: 60, kochkar: [3, 0.8], plevun: [1, 0.6], tinnik: [0, 0.4] },
      guards: { kochkar: 2, plevun: 1, tinnik: 1 }, nestCap: 6,
      boss: { kind: 'omutnik', min: 480, time: 660 } },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
