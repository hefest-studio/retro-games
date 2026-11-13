/* РИКОШЕТ · уровни кампании (30 рисунков из блоков — оригинальные, студия «Гефест») и генератор стен режима «Бесконечный».
   Сетка 16×16 клеток (блок 38×16 px). Легенда клеток:
     .  пусто
     a…f  обычные блоки, 1 удар (a — красная руда, b — медь, c — золото, d — стекло, e — малахит, f — аметист)
     2 3  прочные (железо — 2 удара, сталь — 3)
     #  неразрушимый (кованое железо)
     X  взрывной (бочонок с порохом, цепная реакция по 8 соседям)
     M  движущийся (катится по своему ряду, отскакивает от стен и блоков)
     R  регенерирующий (живая руда — отрастает через 7 с, пока на стене есть другие обязательные блоки)
     K  блок-ключ; G — решётка: неразрушима, пока не разбиты ВСЕ ключи уровня, потом исчезает
   boss: 1..3 — уровень с механизмом-боссом (ряды 0–6 оставлены ему). RIK.LEVELS, RIK.genLevel(n, rng). */
(function (global) {
  'use strict';
  var R = global.RIK = global.RIK || {};
  var E = '................';
  function top(n) { var a = []; for (var i = 0; i < n; i++) a.push(E); return a; }

  R.LEVELS = [
    { id: 1, rows: [E, 'aaaaaaaaaaaaa...', '.bbbbbbbbbbbbb..', '....cccccccc....', '.....dddddd.....', '....eeeeeeee....', '..ffffffffffff..'] },
    { id: 2, rows: [E, E, '..aaaaaa........', '..aaaaaabbbbbbbb', '..aaaaaabbbbbbbb', '..aaaaaa........', E, 'cccc..cccc..cccc', '.dddd..dddd..ddd'] },
    { id: 3, rows: [E, 'd.d.d.d.d.d.d.d.', '.e.e.e.e.e.e.e.e', 'f.f.f.f.f.f.f.f.', '.c.c.c.c.c.c.c.c', 'a.a.a.a.a.a.a.a.', '.b.b.b.b.b.b.b.b'] },
    { id: 4, rows: [E, '.22..........22.', '..22........22..', '...22......22...', '....22aaaa22....', '.....2aaaa2.....', '....22cccc22....', '...22......22...', '..bb........bb..', '.bb..........bb.'] },
    { id: 5, rows: [E, '....########....', '...#aaaaaaaa#...', '..#bbbbbbbbbb#..', '..#cc2cccc2cc#..', '..#cccccccccc#..', '..####....####..', E, 'dddddddddddddddd', 'e.e.e.e..e.e.e.e'] },
    { id: 6, rows: [E, 'aXaaaXaaaaXaaaXa', 'bbbbbbbbbbbbbbbb', '2222X222222X2222', 'cccccccccccccccc', 'dXddddXddXddddXd', E, '..ee..ee..ee..ee'] },
    { id: 7, rows: [E, 'M.......M.......', 'aaaaaaaaaaaaaaaa', '....M.......M...', 'bbbbbbbbbbbbbbbb', '..M.......M.....', 'cccccccccccccccc', E, 'd2d2d2d2d2d2d2d2'] },
    { id: 8, rows: [E, '..RRRR....RRRR..', '..R22R....R22R..', '..RRRR....RRRR..', E, 'eeeeeeeeeeeeeeee', '.ffffffffffffff.', E, 'aa..bb..cc..dd..'] },
    { id: 9, rows: [E, '.##GGGGGGGGGG##.', '.#cccccccccccc#.', '.#c3cccccccc3c#.', '.#cccccccccccc#.', '.##GGGGGGGGGG##.', E, 'K.bbbbbbbbbbbb.K', '..aaaaaaaaaaaa..'] },
    { id: 10, boss: 1, rows: top(7).concat(['..a.b.c.d.e.f.a.', '.2.2.2.2.2.2.2.2', '##............##']) },
    { id: 11, rows: [E, '.aaa..bbb..aaa..', '.a.a..b.b..a.a..', '.aaaXXbbbXXaaa..', '.a.a..b.b..a.a..', '.aaa..bbb..aaa..', E, '..ccc..ddd..eee.', '..c.c..d.d..e.e.', '..cccXXdddXXeee.', '..c.c..d.d..e.e.', '..ccc..ddd..eee.'] },
    { id: 12, rows: ['......2..2......', '....22222222....', '...2eeeeeeee2...', '..22ee####ee22..', '...2ee####ee2...', '..22ee####ee22..', '...2eeeeeeee2...', '....22222222....', '......2..2......', E, 'ffff........ffff'] },
    { id: 13, rows: ['.......a........', '......aab.......', '.....aabba......', '....aabXbba.....', '...aabbXXbbaa...', '...abbcXXcbba...', '..aabccXXccbaa..', '..abbccccccbba..', '...abbccccbba...', '....aabbbbaa....', '......####......', '.....#3333#.....'] },
    { id: 14, rows: [E, '....33333333....', '...3bbbbbbbb3...', '..3bb######bb3..', '..3b#......#b3..', '..3b#..MM..#b3..', '..3b#......#b3..', '..3bb#....#bb3..', '..333#....#333..', E, 'cc.cc.cc.cc.cc.c'] },
    { id: 15, rows: ['.......dd.......', '......dddd......', '.....dd22dd.....', '....dd2RR2dd....', '...dd2RffR2dd...', '..dd2RffffR2dd..', '...dd2RffR2dd...', '....dd2RR2dd....', '.....dd22dd.....', '......dddd......', '.......dd.......'] },
    { id: 16, rows: [E, '#GGGG#....#GGGG#', '#eeee#....#eeee#', '#e33e#.KK.#e33e#', '#eeee#....#eeee#', '######....######', '....aaaaaaaa....', '...bbbbbbbbbb...', '..cccccccccccc..'] },
    { id: 17, rows: [E, '#.#.#.#..#.#.#.#', '##2###2##2###2##', 'aaaaaaaaaaaaaaaa', 'a22a22a22a22a22a', 'aaaaaaaaaaaaaaaa', E, '.bb.bb.bb.bb.bb.', '...XX......XX...'] },
    { id: 18, rows: [E, '#.####.##.####.#', '#aaaaa.aa.aaaaa#', '#a###a.##.a###a#', '#a#bbb2..2bbb#a#', '#a#bbbbbbbbbb#a#', '#a####.##.####a#', '#aaaaa....aaaaa#', '####........####', 'c.c.c.c..c.c.c.c'] },
    { id: 19, rows: ['.......cc.......', '......c33c......', 'eeeeeecXXceeeeee', '.eeeeec33ceeeee.', '...eeecccceee...', '....eeccccee....', '...eeec..ceee...', '..eee..##..eee..', '.ee....##....ee.', E, '2.2.2.2..2.2.2.2'] },
    { id: 20, boss: 2, rows: top(7).concat(['2a2a2a2..a2a2a2a', E, '#X............X#', 'R.R.R.R..R.R.R.R']) },
    { id: 21, rows: [E, '..#..........#..', '..#ffffffffff#..', '..#f3fXffXf3f#..', '..#ffffffffff#..', '...#eeeeeeee#...', '....##eeee##....', '......####......', '....M......M....', 'aaaaaaaaaaaaaaaa'] },
    { id: 22, rows: ['.3333......3333.', '.3aa3......3aa3.', '.3aa3..MM..3aa3.', '.3bb3......3bb3.', '.3bb3..XX..3bb3.', '.3cc3......3cc3.', '.3cc3..##..3cc3.', '.3dd3......3dd3.', '.3dd3..22..3dd3.', '.####......####.'] },
    { id: 23, rows: [E, '#.###.#..#.###.#', '#ab#ab#..#ba#ba#', '#2c#c2#..#2c#c2#', '#.###.#..#.###.#', '#de#ed#..#de#ed#', '#3f#f3#..#3f#f3#', '#.###.#..#.###.#', E] },
    { id: 24, rows: [E, 'M.....M.........', '2222222222222222', '..M.....M.......', 'aaaaaaaaaaaaaaaa', '....M.....M.....', 'bbbbbbbbbbbbbbbb', '......M.....M...', 'cccccccccccccccc'] },
    { id: 25, rows: [E, 'X2X2X2X22X2X2X2X', '3333333333333333', 'X..............X', 'aXaXaXaXaXaXaXaX', 'bbbbbbbbbbbbbbbb', 'XccccccXXccccccX', E, '####..####..####'] },
    { id: 26, rows: [E, '..22....cc..22..', '..22...cc...22..', '..22..cc....22..', '..22.cccccc.22..', '..22....cc..22..', '..22...cc...22..', '..22..cc....22..', '..22.c......22..', E, 'fXf.fXf..fXf.fXf'] },
    { id: 27, rows: [E, '.#GGGG#..#GGGG#.', '.#3cc3#..#3cc3#.', '.#c22c#KK#c22c#.', '.#3cc3#..#3cc3#.', '.######..######.', E, 'dd.dd.dd.dd.dd.d', '.R.R.R.R.R.R.R.R'] },
    { id: 28, rows: [E, 'dddddddddddddddd', 'd33d33d33d33d33d', 'dddddddddddddddd', E, '#.#.#.#.#.#.#.#.', 'ffffffffffffffff', 'f22f22f22f22f22f', 'ffffffffffffffff'] },
    { id: 29, rows: ['3..3..3..3..3..3', 'XRRX2RR22RR2XRRX', '3333333333333333', '#..M........M..#', '#aaaaaaaaaaaaaa#', '#b2b2b2bb2b2b2b#', '#cccccXccXccccc#', '##............##', '..ee..ee..ee..ee'] },
    { id: 30, boss: 3, rows: top(7).concat(['3.3.3.3..3.3.3.3', E, '##..##....##..##', 'R..R..R..R..R..R']) }
  ];

  // ---------- «Бесконечный»: случайные симметричные стены ----------
  // Сложность растёт с номером n: больше рядов, прочных, неразрушимых и особых блоков.
  // Каждая стена проверяется на достижимость (RIK.logic.reach); не прошла — неразрушимые заменяются на сталь.
  R.genLevel = function (n, rng) {
    rng = rng || Math.random;
    var rows = [], nRows = Math.min(13, 6 + Math.floor(n / 2) + Math.floor(rng() * 3));
    var startRow = rng() < 0.5 ? 1 : 0, cols = 'abcdef';
    var pStrong = Math.min(0.35, 0.05 + n * 0.025), pHard = Math.min(0.12, n * 0.012), pSpecial = Math.min(0.12, 0.03 + n * 0.008);
    var style = Math.floor(rng() * 4);   // 0 — сплошные ряды, 1 — шахматка, 2 — ромб, 3 — колонны
    for (var r = 0; r < startRow; r++) rows.push(E);
    for (r = 0; r < nRows; r++) {
      var half = '', color = cols[Math.floor(rng() * 6)];
      if (rng() < 0.12 && n > 2) { half = '........'; var mc = Math.floor(rng() * 6); half = half.slice(0, mc) + 'M' + half.slice(mc + 1); rows.push(half + half.split('').reverse().join('')); continue; }
      for (var c = 0; c < 8; c++) {
        var on = true;
        if (style === 1) on = (r + c) % 2 === 0;
        else if (style === 2) on = Math.abs(c - 7) + Math.abs(r - nRows / 2) < 8.5;
        else if (style === 3) on = c % 3 !== 2;
        if (rng() < 0.08) on = !on;
        var ch = '.';
        if (on) {
          var q = rng();
          if (q < pHard && r > 0) ch = '#';
          else if (q < pHard + pSpecial) ch = ['X', 'R', 'X', 'R'][Math.floor(rng() * 4)];
          else if (q < pHard + pSpecial + pStrong) ch = n > 6 && rng() < 0.4 ? '3' : '2';
          else ch = color;
        }
        half += ch;
      }
      rows.push(half + half.split('').reverse().join(''));
    }
    var L = R.logic;
    if (L && L.reach && !L.reach(rows).ok) rows = rows.map(function (s) { return s.replace(/#/g, '3'); });
    if (!rows.some(function (s) { return /[a-f23XRK]/.test(s); })) rows.push('aaaaaaaaaaaaaaaa');
    return rows;
  };
})(typeof window !== 'undefined' ? window : globalThis);
