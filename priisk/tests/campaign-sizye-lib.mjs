/* ПРИИСК · tests/campaign-sizye-lib.mjs — помощники тестов стороны Сизого Перевала (публичных и полной сборки):
   поиск места под здание, протянуть опоры канатки к точке, поставить забой у жилы. Всё — через обычные действия игрока
   (startBuild → ждать готовности → placeBuild), как это делал бы человек; бот сам решает только «где». */
export function sizyeHelpers(L) {
  // ближайшее к (x,y) место, где можно поставить здание type (левый верхний угол), в радиусе rmax
  function spotNear(W, o, type, x, y, rmax = 12, pred) {
    const d = L.BLDS[type], cx = Math.round(x - d.w / 2), cy = Math.round(y - d.h / 2);
    for (let r = 0; r <= rmax; r++) for (let j = cy - r; j <= cy + r; j++) for (let i = cx - r; i <= cx + r; i++) {
      if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== r) continue;
      if (L.canPlace(W, o, type, i, j) && (!pred || pred(i, j))) return { i, j };
    }
    return null;
  }
  const nodes = (W, o) => L.cableNodes(W, o).concat(W.blds.filter(b => b.owner === o && b.type === 'hq'));
  // следующая опора к цели: самая близкая к цели клетка в пролёте от любого своего узла (или конторы)
  function pylonToward(W, o, tx, ty) {
    let best = null, bd = 1e9;
    for (const n of nodes(W, o)) {
      const c = L.center(n);
      for (let j = Math.floor(c.y - 7); j <= c.y + 7; j++) for (let i = Math.floor(c.x - 7); i <= c.x + 7; i++) {
        if (Math.hypot(i + 0.5 - c.x, j + 0.5 - c.y) > L.SPAN - 0.3 || !L.canPlace(W, o, 'pylon', i, j)) continue;
        const d = Math.hypot(i + 0.5 - tx, j + 0.5 - ty); if (d < bd) { bd = d; best = { i, j }; }
      }
    }
    return best;
  }
  // место под забой у жилы рядом с (x,y), в пролёте от своего узла
  const faceSpot = (W, o, x, y) => spotNear(W, o, 'face', x, y, 8);
  // место под ветряк: на гребне, с наибольшей выработкой при текущем ветре, недалеко от (x,y)
  function millSpot(W, o, x, y, rmax = 10) {
    let best = null, bv = -1;
    for (let j = Math.floor(y - rmax); j <= y + rmax; j++) for (let i = Math.floor(x - rmax); i <= x + rmax; i++) {
      if (!L.canPlace(W, o, 'mill', i, j)) continue;
      const v = L.millOut(W, { tx: i, ty: j, w: 2, h: 2 }) * 10 - Math.hypot(i - x, j - y) * 0.1; if (v > bv) { bv = v; best = { i, j }; }
    }
    return best;
  }
  // заказать и поставить здание (если стройка свободна): 'started' | 'placed' | null
  function buildAt(W, o, type, spot) {
    const p = W.players[o];
    if (!p.build) return L.startBuild(W, o, type) ? 'started' : null;
    if (p.build.ready && p.build.type === type && spot) return L.placeBuild(W, o, spot.i, spot.j) ? 'placed' : null;
    return null;
  }
  return { spotNear, pylonToward, faceSpot, millSpot, buildAt };
}
