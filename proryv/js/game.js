/* ПРОРЫВ HTML5 — сгенерировано tools/build.mjs, не редактировать вручную */
'use strict';
/* ==== src/font.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — пиксельный моноширинный шрифт 6×8 с кириллицей
   ------------------------------------------------------------
   Знакоместо 6×8: 5 px на глиф (колонки 0–4) + 1 px пробела (колонка 5).
   Заглавные и цифры занимают 7 px (строки 0–6), строчные — 5 px
   x-height (строки 2–6), выносные элементы — строки 6–7.
   В байте строки: бит 5 = левый пиксель, бит 0 = правый (6 колонок).

   API (docs/CONTRACT.md §1):
     PR_FONT.W, PR_FONT.H      — размер знакоместа (6, 8)
     PR_FONT.glyphs            — { 'A': [b0..b7], ... }
     PR_FONT.has(ch)           — есть ли глиф
     PR_FONT.glyph(ch)         — массив 8 байт (для неизвестного — глиф '?')

   Сгенерировано из пиксельной раскладки (инструмент — proryv/tools/gen-font.mjs).
   Правки вносить в генератор, а не в этот файл.
   ============================================================ */
(function () {
  'use strict';

  /* каждый глиф: 8 строк, бит 5 = левый пиксель, 6 колонок */
  const G = {};

  /* ---------- ASCII 32–47 — пробел, знаки препинания ---------- */
  G[" "] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // SP
  G["!"] = [0x08, 0x08, 0x08, 0x08, 0x08, 0x00, 0x08, 0x00]; // !
  G["\""] = [0x14, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // "
  G["#"] = [0x14, 0x14, 0x3E, 0x14, 0x3E, 0x14, 0x14, 0x00]; // #
  G["$"] = [0x08, 0x1E, 0x28, 0x1C, 0x0A, 0x3C, 0x08, 0x00]; // $
  G["%"] = [0x32, 0x34, 0x04, 0x08, 0x10, 0x16, 0x26, 0x00]; // %
  G["&"] = [0x18, 0x24, 0x28, 0x10, 0x2A, 0x24, 0x1A, 0x00]; // &
  G["'"] = [0x08, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // '
  G["("] = [0x04, 0x08, 0x10, 0x10, 0x10, 0x08, 0x04, 0x00]; // (
  G[")"] = [0x10, 0x08, 0x04, 0x04, 0x04, 0x08, 0x10, 0x00]; // )
  G["*"] = [0x00, 0x08, 0x2A, 0x1C, 0x2A, 0x08, 0x00, 0x00]; // *
  G["+"] = [0x00, 0x08, 0x08, 0x3E, 0x08, 0x08, 0x00, 0x00]; // +
  G[","] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x08, 0x10]; // ,
  G["-"] = [0x00, 0x00, 0x00, 0x3E, 0x00, 0x00, 0x00, 0x00]; // -
  G["."] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00]; // .
  G["/"] = [0x02, 0x02, 0x04, 0x08, 0x10, 0x20, 0x20, 0x00]; // /

  /* ---------- ASCII 48–57 — цифры ---------- */
  G["0"] = [0x1C, 0x22, 0x26, 0x2A, 0x32, 0x22, 0x1C, 0x00]; // 0
  G["1"] = [0x08, 0x18, 0x08, 0x08, 0x08, 0x08, 0x1C, 0x00]; // 1
  G["2"] = [0x1C, 0x22, 0x02, 0x04, 0x08, 0x10, 0x3E, 0x00]; // 2
  G["3"] = [0x3E, 0x04, 0x08, 0x04, 0x02, 0x22, 0x1C, 0x00]; // 3
  G["4"] = [0x04, 0x0C, 0x14, 0x24, 0x3E, 0x04, 0x04, 0x00]; // 4
  G["5"] = [0x3E, 0x20, 0x3C, 0x02, 0x02, 0x22, 0x1C, 0x00]; // 5
  G["6"] = [0x0C, 0x10, 0x20, 0x3C, 0x22, 0x22, 0x1C, 0x00]; // 6
  G["7"] = [0x3E, 0x02, 0x04, 0x08, 0x10, 0x10, 0x10, 0x00]; // 7
  G["8"] = [0x1C, 0x22, 0x22, 0x1C, 0x22, 0x22, 0x1C, 0x00]; // 8
  G["9"] = [0x1C, 0x22, 0x22, 0x1E, 0x02, 0x04, 0x18, 0x00]; // 9

  /* ---------- ASCII 58–64 — знаки ---------- */
  G[":"] = [0x00, 0x08, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00]; // :
  G[";"] = [0x00, 0x08, 0x00, 0x00, 0x08, 0x08, 0x10, 0x00]; // ;
  G["<"] = [0x00, 0x04, 0x08, 0x10, 0x08, 0x04, 0x00, 0x00]; // <
  G["="] = [0x00, 0x00, 0x3E, 0x00, 0x3E, 0x00, 0x00, 0x00]; // =
  G[">"] = [0x00, 0x10, 0x08, 0x04, 0x08, 0x10, 0x00, 0x00]; // >
  G["?"] = [0x1C, 0x22, 0x02, 0x04, 0x08, 0x00, 0x08, 0x00]; // ?
  G["@"] = [0x1C, 0x22, 0x2E, 0x2A, 0x2E, 0x20, 0x1C, 0x00]; // @

  /* ---------- ASCII 65–90 — латинские заглавные (7 px) ---------- */
  G["A"] = [0x1C, 0x22, 0x22, 0x3E, 0x22, 0x22, 0x22, 0x00]; // A
  G["B"] = [0x3C, 0x22, 0x22, 0x3C, 0x22, 0x22, 0x3C, 0x00]; // B
  G["C"] = [0x1C, 0x22, 0x20, 0x20, 0x20, 0x22, 0x1C, 0x00]; // C
  G["D"] = [0x38, 0x24, 0x22, 0x22, 0x22, 0x24, 0x38, 0x00]; // D
  G["E"] = [0x3E, 0x20, 0x20, 0x3C, 0x20, 0x20, 0x3E, 0x00]; // E
  G["F"] = [0x3E, 0x20, 0x20, 0x3C, 0x20, 0x20, 0x20, 0x00]; // F
  G["G"] = [0x1C, 0x22, 0x20, 0x2E, 0x22, 0x22, 0x1E, 0x00]; // G
  G["H"] = [0x22, 0x22, 0x22, 0x3E, 0x22, 0x22, 0x22, 0x00]; // H
  G["I"] = [0x1C, 0x08, 0x08, 0x08, 0x08, 0x08, 0x1C, 0x00]; // I
  G["J"] = [0x0E, 0x04, 0x04, 0x04, 0x04, 0x24, 0x18, 0x00]; // J
  G["K"] = [0x22, 0x24, 0x28, 0x30, 0x28, 0x24, 0x22, 0x00]; // K
  G["L"] = [0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x3E, 0x00]; // L
  G["M"] = [0x22, 0x36, 0x2A, 0x2A, 0x22, 0x22, 0x22, 0x00]; // M
  G["N"] = [0x22, 0x32, 0x32, 0x2A, 0x26, 0x26, 0x22, 0x00]; // N
  G["O"] = [0x1C, 0x22, 0x22, 0x22, 0x22, 0x22, 0x1C, 0x00]; // O
  G["P"] = [0x3C, 0x22, 0x22, 0x3C, 0x20, 0x20, 0x20, 0x00]; // P
  G["Q"] = [0x1C, 0x22, 0x22, 0x22, 0x2A, 0x24, 0x1A, 0x00]; // Q
  G["R"] = [0x3C, 0x22, 0x22, 0x3C, 0x28, 0x24, 0x22, 0x00]; // R
  G["S"] = [0x1C, 0x22, 0x20, 0x1C, 0x02, 0x22, 0x1C, 0x00]; // S
  G["T"] = [0x3E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x00]; // T
  G["U"] = [0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x1C, 0x00]; // U
  G["V"] = [0x22, 0x22, 0x22, 0x22, 0x14, 0x14, 0x08, 0x00]; // V
  G["W"] = [0x22, 0x22, 0x22, 0x2A, 0x2A, 0x36, 0x22, 0x00]; // W
  G["X"] = [0x22, 0x22, 0x14, 0x08, 0x14, 0x22, 0x22, 0x00]; // X
  G["Y"] = [0x22, 0x22, 0x14, 0x08, 0x08, 0x08, 0x08, 0x00]; // Y
  G["Z"] = [0x3E, 0x02, 0x04, 0x08, 0x10, 0x20, 0x3E, 0x00]; // Z

  /* ---------- ASCII 91–96 — скобки, обратный слеш, каретка, подчёркивание, бэктик ---------- */
  G["["] = [0x1C, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1C, 0x00]; // [
  G["\\"] = [0x20, 0x20, 0x10, 0x08, 0x04, 0x02, 0x02, 0x00]; // \
  G["]"] = [0x1C, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1C, 0x00]; // ]
  G["^"] = [0x08, 0x14, 0x22, 0x00, 0x00, 0x00, 0x00, 0x00]; // ^
  G["_"] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3E, 0x00]; // _
  G["`"] = [0x10, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // `

  /* ---------- ASCII 97–122 — латинские строчные (x-height 5 px; выносные — в строках 6–7) ---------- */
  G["a"] = [0x00, 0x00, 0x1C, 0x02, 0x1E, 0x22, 0x1E, 0x00]; // a
  G["b"] = [0x20, 0x20, 0x3C, 0x22, 0x22, 0x22, 0x3C, 0x00]; // b
  G["c"] = [0x00, 0x00, 0x1C, 0x20, 0x20, 0x20, 0x1C, 0x00]; // c
  G["d"] = [0x02, 0x02, 0x1E, 0x22, 0x22, 0x22, 0x1E, 0x00]; // d
  G["e"] = [0x00, 0x00, 0x1C, 0x22, 0x3E, 0x20, 0x1C, 0x00]; // e
  G["f"] = [0x0C, 0x10, 0x38, 0x10, 0x10, 0x10, 0x10, 0x00]; // f
  G["g"] = [0x00, 0x00, 0x1C, 0x22, 0x22, 0x1E, 0x02, 0x1C]; // g
  G["h"] = [0x20, 0x20, 0x3C, 0x22, 0x22, 0x22, 0x22, 0x00]; // h
  G["i"] = [0x08, 0x00, 0x08, 0x08, 0x08, 0x08, 0x1C, 0x00]; // i
  G["j"] = [0x04, 0x00, 0x0C, 0x04, 0x04, 0x04, 0x24, 0x18]; // j
  G["k"] = [0x20, 0x20, 0x24, 0x28, 0x30, 0x28, 0x24, 0x00]; // k
  G["l"] = [0x18, 0x08, 0x08, 0x08, 0x08, 0x08, 0x1C, 0x00]; // l
  G["m"] = [0x00, 0x00, 0x14, 0x2A, 0x2A, 0x2A, 0x2A, 0x00]; // m
  G["n"] = [0x00, 0x00, 0x3C, 0x22, 0x22, 0x22, 0x22, 0x00]; // n
  G["o"] = [0x00, 0x00, 0x1C, 0x22, 0x22, 0x22, 0x1C, 0x00]; // o
  G["p"] = [0x00, 0x00, 0x3C, 0x22, 0x22, 0x3C, 0x20, 0x20]; // p
  G["q"] = [0x00, 0x00, 0x1E, 0x22, 0x22, 0x1E, 0x02, 0x02]; // q
  G["r"] = [0x00, 0x00, 0x2C, 0x30, 0x20, 0x20, 0x20, 0x00]; // r
  G["s"] = [0x00, 0x00, 0x1E, 0x20, 0x1C, 0x02, 0x3C, 0x00]; // s
  G["t"] = [0x00, 0x10, 0x38, 0x10, 0x10, 0x10, 0x0C, 0x00]; // t
  G["u"] = [0x00, 0x00, 0x22, 0x22, 0x22, 0x22, 0x1E, 0x00]; // u
  G["v"] = [0x00, 0x00, 0x22, 0x22, 0x22, 0x14, 0x08, 0x00]; // v
  G["w"] = [0x00, 0x00, 0x22, 0x22, 0x2A, 0x2A, 0x14, 0x00]; // w
  G["x"] = [0x00, 0x00, 0x22, 0x14, 0x08, 0x14, 0x22, 0x00]; // x
  G["y"] = [0x00, 0x00, 0x22, 0x22, 0x14, 0x08, 0x10, 0x20]; // y
  G["z"] = [0x00, 0x00, 0x3E, 0x04, 0x08, 0x10, 0x3E, 0x00]; // z

  /* ---------- ASCII 123–126 ---------- */
  G["{"] = [0x04, 0x08, 0x08, 0x10, 0x08, 0x08, 0x04, 0x00]; // {
  G["|"] = [0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x00]; // |
  G["}"] = [0x10, 0x08, 0x08, 0x04, 0x08, 0x08, 0x10, 0x00]; // }
  G["~"] = [0x00, 0x00, 0x10, 0x2A, 0x04, 0x00, 0x00, 0x00]; // ~

  /* ---------- Кириллица: заглавные А–Я (7 px); Ё и Й — со знаком в строке 0 ---------- */
  G["А"] = [0x1C, 0x22, 0x22, 0x3E, 0x22, 0x22, 0x22, 0x00]; // А
  G["Б"] = [0x3E, 0x20, 0x20, 0x3C, 0x22, 0x22, 0x3C, 0x00]; // Б
  G["В"] = [0x3C, 0x22, 0x22, 0x3C, 0x22, 0x22, 0x3C, 0x00]; // В
  G["Г"] = [0x3E, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x00]; // Г
  G["Д"] = [0x1C, 0x14, 0x14, 0x3E, 0x22, 0x22, 0x22, 0x00]; // Д
  G["Е"] = [0x3E, 0x20, 0x20, 0x3C, 0x20, 0x20, 0x3E, 0x00]; // Е
  G["Ё"] = [0x14, 0x3E, 0x20, 0x3C, 0x20, 0x20, 0x3E, 0x00]; // Ё
  G["Ж"] = [0x2A, 0x2A, 0x1C, 0x08, 0x1C, 0x2A, 0x2A, 0x00]; // Ж
  G["З"] = [0x1C, 0x22, 0x02, 0x0C, 0x02, 0x22, 0x1C, 0x00]; // З
  G["И"] = [0x22, 0x22, 0x26, 0x2A, 0x32, 0x22, 0x22, 0x00]; // И
  G["Й"] = [0x1C, 0x22, 0x26, 0x2A, 0x32, 0x22, 0x22, 0x00]; // Й
  G["К"] = [0x22, 0x24, 0x28, 0x30, 0x28, 0x24, 0x22, 0x00]; // К
  G["Л"] = [0x0E, 0x12, 0x12, 0x12, 0x12, 0x22, 0x22, 0x00]; // Л
  G["М"] = [0x22, 0x36, 0x2A, 0x2A, 0x22, 0x22, 0x22, 0x00]; // М
  G["Н"] = [0x22, 0x22, 0x22, 0x3E, 0x22, 0x22, 0x22, 0x00]; // Н
  G["О"] = [0x1C, 0x22, 0x22, 0x22, 0x22, 0x22, 0x1C, 0x00]; // О
  G["П"] = [0x3E, 0x22, 0x22, 0x22, 0x22, 0x22, 0x22, 0x00]; // П
  G["Р"] = [0x3C, 0x22, 0x22, 0x3C, 0x20, 0x20, 0x20, 0x00]; // Р
  G["С"] = [0x1C, 0x22, 0x20, 0x20, 0x20, 0x22, 0x1C, 0x00]; // С
  G["Т"] = [0x3E, 0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x00]; // Т
  G["У"] = [0x22, 0x22, 0x14, 0x08, 0x08, 0x10, 0x20, 0x00]; // У
  G["Ф"] = [0x08, 0x1C, 0x2A, 0x2A, 0x2A, 0x1C, 0x08, 0x00]; // Ф
  G["Х"] = [0x22, 0x22, 0x14, 0x08, 0x14, 0x22, 0x22, 0x00]; // Х
  G["Ц"] = [0x22, 0x22, 0x22, 0x22, 0x22, 0x3E, 0x02, 0x00]; // Ц
  G["Ч"] = [0x22, 0x22, 0x22, 0x1E, 0x02, 0x02, 0x02, 0x00]; // Ч
  G["Ш"] = [0x2A, 0x2A, 0x2A, 0x2A, 0x2A, 0x2A, 0x3E, 0x00]; // Ш
  G["Щ"] = [0x2A, 0x2A, 0x2A, 0x2A, 0x2A, 0x2A, 0x3E, 0x02]; // Щ
  G["Ъ"] = [0x38, 0x20, 0x20, 0x3C, 0x22, 0x22, 0x3C, 0x00]; // Ъ
  G["Ы"] = [0x21, 0x21, 0x21, 0x3D, 0x25, 0x25, 0x3D, 0x00]; // Ы
  G["Ь"] = [0x20, 0x20, 0x20, 0x3C, 0x22, 0x22, 0x3C, 0x00]; // Ь
  G["Э"] = [0x3C, 0x02, 0x02, 0x0E, 0x02, 0x02, 0x3C, 0x00]; // Э
  G["Ю"] = [0x26, 0x29, 0x29, 0x29, 0x29, 0x29, 0x26, 0x00]; // Ю
  G["Я"] = [0x0E, 0x12, 0x12, 0x0E, 0x04, 0x08, 0x10, 0x00]; // Я

  /* ---------- Кириллица: строчные а–я (x-height 5 px); ё и й — со знаком в строке 0 ---------- */
  G["а"] = [0x00, 0x00, 0x1C, 0x02, 0x1E, 0x22, 0x1E, 0x00]; // а
  G["б"] = [0x0C, 0x10, 0x3C, 0x22, 0x22, 0x22, 0x3C, 0x00]; // б
  G["в"] = [0x00, 0x00, 0x3C, 0x22, 0x3C, 0x22, 0x3C, 0x00]; // в
  G["г"] = [0x00, 0x00, 0x3E, 0x20, 0x20, 0x20, 0x20, 0x00]; // г
  G["д"] = [0x00, 0x00, 0x0C, 0x14, 0x14, 0x3E, 0x22, 0x22]; // д
  G["е"] = [0x00, 0x00, 0x1C, 0x22, 0x3E, 0x20, 0x1C, 0x00]; // е
  G["ё"] = [0x14, 0x00, 0x1C, 0x22, 0x3E, 0x20, 0x1C, 0x00]; // ё
  G["ж"] = [0x00, 0x00, 0x2A, 0x1C, 0x08, 0x1C, 0x2A, 0x00]; // ж
  G["з"] = [0x00, 0x00, 0x1C, 0x02, 0x0C, 0x02, 0x1C, 0x00]; // з
  G["и"] = [0x00, 0x00, 0x22, 0x26, 0x2A, 0x32, 0x22, 0x00]; // и
  G["й"] = [0x1C, 0x00, 0x22, 0x26, 0x2A, 0x32, 0x22, 0x00]; // й
  G["к"] = [0x00, 0x00, 0x24, 0x28, 0x30, 0x28, 0x24, 0x00]; // к
  G["л"] = [0x00, 0x00, 0x0E, 0x12, 0x12, 0x12, 0x22, 0x00]; // л
  G["м"] = [0x00, 0x00, 0x22, 0x36, 0x2A, 0x22, 0x22, 0x00]; // м
  G["н"] = [0x00, 0x00, 0x22, 0x22, 0x3E, 0x22, 0x22, 0x00]; // н
  G["о"] = [0x00, 0x00, 0x1C, 0x22, 0x22, 0x22, 0x1C, 0x00]; // о
  G["п"] = [0x00, 0x00, 0x3E, 0x22, 0x22, 0x22, 0x22, 0x00]; // п
  G["р"] = [0x00, 0x00, 0x3C, 0x22, 0x22, 0x3C, 0x20, 0x20]; // р
  G["с"] = [0x00, 0x00, 0x1C, 0x20, 0x20, 0x20, 0x1C, 0x00]; // с
  G["т"] = [0x00, 0x00, 0x3E, 0x08, 0x08, 0x08, 0x08, 0x00]; // т
  G["у"] = [0x00, 0x00, 0x22, 0x22, 0x14, 0x08, 0x10, 0x20]; // у
  G["ф"] = [0x08, 0x08, 0x1C, 0x2A, 0x2A, 0x2A, 0x1C, 0x08]; // ф
  G["х"] = [0x00, 0x00, 0x22, 0x14, 0x08, 0x14, 0x22, 0x00]; // х
  G["ц"] = [0x00, 0x00, 0x22, 0x22, 0x22, 0x22, 0x3E, 0x02]; // ц
  G["ч"] = [0x00, 0x00, 0x22, 0x22, 0x1E, 0x02, 0x02, 0x00]; // ч
  G["ш"] = [0x00, 0x00, 0x2A, 0x2A, 0x2A, 0x2A, 0x3E, 0x00]; // ш
  G["щ"] = [0x00, 0x00, 0x2A, 0x2A, 0x2A, 0x2A, 0x3E, 0x02]; // щ
  G["ъ"] = [0x00, 0x00, 0x30, 0x20, 0x3C, 0x24, 0x3C, 0x00]; // ъ
  G["ы"] = [0x00, 0x00, 0x21, 0x21, 0x3D, 0x25, 0x3D, 0x00]; // ы
  G["ь"] = [0x00, 0x00, 0x20, 0x20, 0x3C, 0x24, 0x3C, 0x00]; // ь
  G["э"] = [0x00, 0x00, 0x3C, 0x02, 0x0E, 0x02, 0x3C, 0x00]; // э
  G["ю"] = [0x00, 0x00, 0x26, 0x29, 0x29, 0x29, 0x26, 0x00]; // ю
  G["я"] = [0x00, 0x00, 0x0E, 0x12, 0x0E, 0x04, 0x10, 0x00]; // я

  /* ---------- Типографика и пиктограммы ---------- */
  G["«"] = [0x00, 0x09, 0x12, 0x24, 0x12, 0x09, 0x00, 0x00]; // «
  G["»"] = [0x00, 0x24, 0x12, 0x09, 0x12, 0x24, 0x00, 0x00]; // »
  G["„"] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x14, 0x28, 0x00]; // „
  G["“"] = [0x00, 0x14, 0x28, 0x00, 0x00, 0x00, 0x00, 0x00]; // “
  G["”"] = [0x00, 0x14, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00]; // ”
  G["—"] = [0x00, 0x00, 0x00, 0x00, 0x3F, 0x00, 0x00, 0x00]; // —
  G["–"] = [0x00, 0x00, 0x00, 0x00, 0x1E, 0x00, 0x00, 0x00]; // –
  G["…"] = [0x00, 0x00, 0x00, 0x00, 0x00, 0x15, 0x00, 0x00]; // …
  G["№"] = [0x27, 0x35, 0x37, 0x2C, 0x2C, 0x24, 0x24, 0x00]; // №
  G["°"] = [0x1C, 0x14, 0x1C, 0x00, 0x00, 0x00, 0x00, 0x00]; // °
  G["·"] = [0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00]; // ·
  G["•"] = [0x00, 0x00, 0x00, 0x18, 0x18, 0x00, 0x00, 0x00]; // •
  G["←"] = [0x00, 0x08, 0x10, 0x3E, 0x10, 0x08, 0x00, 0x00]; // ←
  G["→"] = [0x00, 0x08, 0x04, 0x3E, 0x04, 0x08, 0x00, 0x00]; // →
  G["↑"] = [0x00, 0x08, 0x1C, 0x2A, 0x08, 0x08, 0x08, 0x00]; // ↑
  G["↓"] = [0x00, 0x08, 0x08, 0x08, 0x2A, 0x1C, 0x08, 0x00]; // ↓
  G["█"] = [0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F, 0x3F]; // █
  G["♥"] = [0x00, 0x1B, 0x3F, 0x3F, 0x1E, 0x0C, 0x04, 0x00]; // ♥
  G["★"] = [0x08, 0x1C, 0x3E, 0x1C, 0x08, 0x14, 0x22, 0x00]; // ★
  G["☆"] = [0x08, 0x14, 0x2A, 0x1C, 0x08, 0x14, 0x22, 0x00]; // ☆
  G["►"] = [0x00, 0x20, 0x38, 0x3E, 0x38, 0x20, 0x00, 0x00]; // ►
  G["◄"] = [0x00, 0x01, 0x07, 0x1F, 0x07, 0x01, 0x00, 0x00]; // ◄
  G["▲"] = [0x00, 0x0C, 0x0C, 0x1E, 0x1E, 0x3F, 0x00, 0x00]; // ▲
  G["▼"] = [0x00, 0x3F, 0x1E, 0x1E, 0x0C, 0x0C, 0x00, 0x00]; // ▼
  G["×"] = [0x00, 0x00, 0x00, 0x14, 0x08, 0x14, 0x00, 0x00]; // ×
  G["✓"] = [0x00, 0x00, 0x02, 0x04, 0x28, 0x10, 0x00, 0x00]; // ✓
  G["●"] = [0x00, 0x00, 0x1C, 0x3E, 0x3E, 0x3E, 0x1C, 0x00]; // ●

  const has = (ch) => Object.prototype.hasOwnProperty.call(G, ch);

  window.PR_FONT = {
    W: 6,
    H: 8,
    glyphs: G,
    has,
    /* для отсутствующего символа возвращаем глиф '?' */
    glyph(ch) { return has(ch) ? G[ch] : G['?']; }
  };
})();

/* ==== src/i18n.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — локализация RU / EN
   PR_I18N.ручные строки; PR_T(key, vars) — доступ с подстановкой {var}.
   ============================================================ */
(function () {
  'use strict';

  const RU = {
    'brand': 'ПРОРЫВ',
    'brand.ru': 'ШТУРМОВИК',
    'tagline': 'ОТ 8 БИТ К НЕОНУ',
    'tagline.full': 'оригинал студии «Гефест»',
    'loading': 'ЗАГРУЗКА...',

    /* ---- меню ---- */
    'menu.play': 'ИГРАТЬ',
    'menu.help': 'КАК ИГРАТЬ',
    'menu.settings': 'НАСТРОЙКИ',
    'menu.about': 'ОБ ИГРЕ',
    'menu.continue': 'ПРОДОЛЖИТЬ',
    'menu.hint': '↑↓ — выбор      ENTER — ввод',
    'menu.hint.quick': 'L язык · G графика · M музыка',
    'hint.nav': '↑↓ · ENTER · ESC',

    /* ---- экраны ---- */
    'help.title': 'КАК ИГРАТЬ',
    'help.goal': 'Пробейся через 5 секторов и уйди за правый край экрана.',
    'help.back': 'ESC — назад',
    'about.title': 'ОБ ИГРЕ',
    'settings.title': 'НАСТРОЙКИ',
    'settings.back': 'ESC — назад',
    'settings.lang': 'ЯЗЫК',
    'settings.gfx': 'ГРАФИКА',
    'settings.music': 'МУЗЫКА',
    'settings.sfx': 'ЗВУКИ',
    'settings.crt': 'CRT-ЭФФЕКТ',
    'settings.reset': 'СБРОСИТЬ РЕКОРД',
    'settings.resetConfirm': 'ТОЧНО? ENTER — ДА',
    'settings.build': 'СБОРКА {v} · RETRO ПО УМОЛЧАНИЮ',
    'settings.build.short': 'RETRO · СБОРКА {v}',
    'settings.on': 'ВКЛ',
    'settings.off': 'ВЫКЛ',
    'gfx.retro': '8-BIT',
    'gfx.modern': 'NEON 2026',
    'lang.ru': 'РУССКИЙ',
    'lang.en': 'ENGLISH',

    /* ---- управление ---- */
    'key.left': '← →  или  A D',
    'key.left.act': 'идти влево / вправо',
    'key.jump': '↑  или  W',
    'key.jump.act': 'прыжок',
    'key.duck': '↓  или  S',
    'key.duck.act': 'присесть · телепорт',
    'key.fire': 'SPACE  или  Z',
    'key.fire.act': 'бластер / граната',
    'key.pause': 'ESC  или  P',
    'key.pause.act': 'пауза',
    'key.l': 'L', 'key.l.act': 'язык RU / EN',
    'key.g': 'G', 'key.g.act': 'графика RETRO / NEON',
    'key.m': 'M', 'key.m.act': 'музыка вкл / выкл',
    'key.n': 'N', 'key.n.act': 'звуки вкл / выкл',
    'key.f': 'F', 'key.f.act': 'полный экран',
    'key.enter': 'ENTER', 'key.enter.act': 'подтвердить · старт',

    /* ---- брифинг / подсказки ---- */
    'hint.title': 'ЦЕЛЬ',
    'hint.goal': 'Пробейся через 5 секторов Тарна: уничтожай врагов, собирай патроны и уйди за правый край экрана.',
    'hint.exo': 'Экзоскелет в середине сектора даёт броню и двойной темп огня — но отнимает бонус 10000.',
    'hint.grenade': 'Бластер берёт органику. Пушки, танки и коконы бронированы — только граната.',
    'hint.teleport': 'Встань на телепорт и нажми ↓, чтобы уйти в парный. Там обычно награда.',
    'hint.launcher': 'Войди в статую-пушку — получишь 2000 или 3000 очков.',
    'hint.ammo': 'Синие патроны — заряд бластера, малиновые — гранаты.',
    'hint.death': 'Кайр гибнет от любого попадания. На экзоскелете держится три удара.',

    /* ---- бриф уровня ---- */
    'level.sector': 'СЕКТОР {n} · {name}',
    'level.of': 'из 5',
    'level.start': 'ENTER — В БОЙ',
    'level.screens': 'ЭКРАНОВ: {n}',

    /* ---- HUD ---- */
    'hud.score': 'ОЧКИ',
    'hud.lives': 'ЖИЗНИ',
    'hud.laser': 'ЛАЗЕР',
    'hud.rockets': 'ГРАНАТЫ',
    'hud.armor': 'БРОНЯ',
    'hud.sector': 'СЕКТОР',
    'hud.screen': 'ЭКРАН',

    /* ---- игровые сообщения ---- */
    'msg.paused': 'ПАУЗА',
    'msg.paused.hint': '↑↓ — выбор · ENTER — ввод · ESC — назад',
    'msg.exo.on': 'ЭКЗОСКЕЛЕТ АКТИВЕН',
    'msg.exo.off': 'ЭКЗОСКЕЛЕТ РАЗРУШЕН',
    'msg.teleport': 'ТЕЛЕПОРТ',
    'msg.nogrenade': 'НЕТ ГРАНАТ',
    'msg.nolaser': 'НЕТ ЗАРЯДА',
    'msg.levelclear': 'СЕКТОР ОЧИЩЕН',
    'msg.bonus': 'БОНУС ЗА СЕКТОР',
    'msg.bonus.lives': 'ЖИЗНИ × 1000',
    'msg.bonus.noexo': 'БЕЗ ЭКЗОСКЕЛЕТА +10000',
    'msg.bonus.exo': 'ЭКЗОСКЕЛЕТ: БЕЗ БОНУСА',
    'msg.bonus.extra': 'ДОПОЛНИТЕЛЬНАЯ ЖИЗНЬ',
    'msg.bonus.pick': 'ВЫБЕРИ ОЧКИ: SPACE',
    'msg.bonus.pick2': 'ЖМИ SPACE НА БОЛЬШЕМ ЧИСЛЕ',
    'msg.gameover': 'ИГРА ОКОНЧЕНА',
    'msg.continue': 'ENTER — ЗАНОВО',
    'msg.win': 'ТАРН ПАЛ',
    'msg.win.sub': 'КАЙР ПРОБИЛСЯ ЧЕРЕЗ 5 СЕКТОРОВ',
    'msg.newrecord': 'НОВЫЙ РЕКОРД!',
    'msg.record': 'РЕКОРД',
    'msg.score': 'ИТОГО',
    'msg.dead': 'КАЙР ПОГИБ',
    'msg.press': 'НАЖМИ ENTER',
    'msg.pressfire': 'НАЖМИ SPACE',
    'msg.tips': 'подсказка:',
    'msg.sector.clear': 'СЕКТОР {n} ОЧИЩЕН',
    'msg.togo': 'ДО ВЫХОДА',
    'msg.shield': 'БРОНЯ {n}',

    /* ---- настройки / прочее ---- */
    'credits.original': 'ОРИГИНАЛ · ГЕФЕСТ',
    'credits.port': 'HTML5 CANVAS · WEB AUDIO · 2026',
    'credits.fan': 'Оригинальная игра студии «Гефест» по мотивам жанра.',
    'credits.thanks': 'Графика и музыка — из кода. Внешних файлов нет.',
    'about.goal': 'Сюжет',
    'about.text': 'Планета Тарн — каторжная колония корпорации. Кайр, штурмовик-одиночка, пробивается через пять секторов: периметр, пещеры, реактор, улей и ядро. Бластер — против органики, гранаты — против брони. В середине каждого сектора ждёт капсула гиперсплавного экзоскелета: он держит удар, но лишает выходного бонуса.',
    'record.new': 'НОВЫЙ РЕКОРД',
    'record.beaten': 'РЕКОРД ПОБИТ',
    'touch.left': '◄', 'touch.right': '►', 'touch.jump': '▲', 'touch.fire': '●', 'touch.duck': '▼',

    /* ---- пауза ---- */
    'pause.resume': 'ПРОДОЛЖИТЬ',
    'pause.restart': 'ЗАНОВО С ЭКРАНА',
    'pause.settings': 'НАСТРОЙКИ',
    'pause.menu': 'В МЕНЮ',
    'pause.gfx': 'ГРАФИКА: {v}',
    'pause.music': 'МУЗЫКА: {v}',
    'pause.sfx': 'ЗВУКИ: {v}',
    'pause.lang': 'ЯЗЫК: {v}',

    /* ---- тесты ---- */
    'test.title': 'ПРОРЫВ TESTS',
    'test.ok': 'OK',
    'test.fail': 'FAIL'
  };

  const EN = {
    'brand': 'ПРОРЫВ',
    'brand.ru': 'ПРОРЫВ',
    'tagline': 'FROM 8-BIT TO NEON',
    'tagline.full': 'original by Hefest studio',
    'loading': 'LOADING...',

    'menu.play': 'PLAY',
    'menu.help': 'HOW TO PLAY',
    'menu.settings': 'OPTIONS',
    'menu.about': 'ABOUT',
    'menu.continue': 'RESUME',
    'menu.hint': '↑↓ select      ENTER confirm',
    'menu.hint.quick': 'L language · G graphics · M music',
    'hint.nav': '↑↓ · ENTER · ESC',

    'help.title': 'HOW TO PLAY',
    'help.goal': 'Fight through 5 sectors and reach the right edge.',
    'help.back': 'ESC back',
    'about.title': 'ABOUT',
    'settings.title': 'OPTIONS',
    'settings.back': 'ESC back',
    'settings.lang': 'LANGUAGE',
    'settings.gfx': 'GRAPHICS',
    'settings.music': 'MUSIC',
    'settings.sfx': 'SOUND FX',
    'settings.crt': 'CRT EFFECT',
    'settings.reset': 'RESET RECORD',
    'settings.resetConfirm': 'SURE? ENTER = YES',
    'settings.build': 'BUILD {v} · RETRO DEFAULT',
    'settings.build.short': 'RETRO · BUILD {v}',
    'settings.on': 'ON',
    'settings.off': 'OFF',
    'gfx.retro': '8-BIT',
    'gfx.modern': 'NEON 2026',
    'lang.ru': 'РУССКИЙ',
    'lang.en': 'ENGLISH',

    'key.left': '← →  or  A D',
    'key.left.act': 'walk left / right',
    'key.jump': '↑  or  W',
    'key.jump.act': 'jump',
    'key.duck': '↓  or  S',
    'key.duck.act': 'duck · teleport',
    'key.fire': 'SPACE  or  Z',
    'key.fire.act': 'blaster / grenade',
    'key.pause': 'ESC  or  P',
    'key.pause.act': 'pause',
    'key.l': 'L', 'key.l.act': 'язык RU / EN',
    'key.g': 'G', 'key.g.act': 'graphics RETRO / NEON',
    'key.m': 'M', 'key.m.act': 'music on / off',
    'key.n': 'N', 'key.n.act': 'sound fx on / off',
    'key.f': 'F', 'key.f.act': 'fullscreen',
    'key.enter': 'ENTER', 'key.enter.act': 'confirm · start',

    'hint.title': 'OBJECTIVE',
    'hint.goal': 'Fight through the 5 sectors of Tarn: kill everything, grab ammo packs and reach the right edge of the screen.',
    'hint.exo': 'The exoskeleton pod mid-sector gives armour and double fire rate — but costs the 10000 bonus.',
    'hint.grenade': 'The blaster kills organics. Guns, tanks and pods are armoured — grenades only.',
    'hint.teleport': 'Stand on a teleporter and press ↓ to warp to its twin. Usually a reward there.',
    'hint.launcher': 'Walk into a launcher statue for 2000 or 3000 points.',
    'hint.ammo': 'Blue packs refill the blaster, magenta packs refill grenades.',
    'hint.death': 'Kair dies from a single hit. The exoskeleton takes three.',

    'level.sector': 'SECTOR {n} · {name}',
    'level.of': 'of 5',
    'level.start': 'ENTER — DEPLOY',
    'level.screens': 'SCREENS: {n}',

    'hud.score': 'SCORE',
    'hud.lives': 'LIVES',
    'hud.laser': 'LASER',
    'hud.rockets': 'ROCKETS',
    'hud.armor': 'ARMOUR',
    'hud.sector': 'SECTOR',
    'hud.screen': 'SCREEN',

    'msg.paused': 'PAUSED',
    'msg.paused.hint': '↑↓ select · ENTER confirm · ESC back',
    'msg.exo.on': 'EXOSKELETON ONLINE',
    'msg.exo.off': 'EXOSKELETON DESTROYED',
    'msg.teleport': 'TELEPORT',
    'msg.nogrenade': 'NO GRENADES',
    'msg.nolaser': 'NO CHARGE',
    'msg.levelclear': 'SECTOR SECURED',
    'msg.bonus': 'SECTOR BONUS',
    'msg.bonus.lives': 'LIVES × 1000',
    'msg.bonus.noexo': 'NO EXOSKELETON +10000',
    'msg.bonus.exo': 'EXOSKELETON: NO BONUS',
    'msg.bonus.extra': 'EXTRA LIFE',
    'msg.bonus.pick': 'PICK A SCORE: SPACE',
    'msg.bonus.pick2': 'HIT SPACE ON THE HIGHEST',
    'msg.gameover': 'GAME OVER',
    'msg.continue': 'ENTER — RETRY',
    'msg.win': 'TARN HAS FALLEN',
    'msg.win.sub': 'KAIR BROKE THROUGH 5 SECTORS',
    'msg.newrecord': 'NEW RECORD!',
    'msg.record': 'RECORD',
    'msg.score': 'TOTAL',
    'msg.dead': 'KAIR DOWN',
    'msg.press': 'PRESS ENTER',
    'msg.pressfire': 'PRESS SPACE',
    'msg.tips': 'tip:',
    'msg.sector.clear': 'SECTOR {n} SECURED',
    'msg.togo': 'TO EXIT',
    'msg.shield': 'ARMOUR {n}',

    'credits.original': 'ОРИГИНАЛ · ГЕФЕСТ',
    'credits.port': 'HTML5 CANVAS · WEB AUDIO · 2026',
    'credits.fan': 'An original game by Hefest studio.',
    'credits.thanks': 'Graphics & music from code only.',
    'about.goal': 'Story',
    'about.text': 'The planet Tarn is a corporate penal colony. Kair, a lone stormtrooper, cuts through five sectors: perimeter, caves, reactor, hive and core. Blaster for organics, grenades for armour. Mid-sector a hyper-alloy exoskeleton pod waits: it soaks damage but forfeits the end bonus.',
    'record.new': 'NEW RECORD',
    'record.beaten': 'RECORD BEATEN',
    'touch.left': '◄', 'touch.right': '►', 'touch.jump': '▲', 'touch.fire': '●', 'touch.duck': '▼',

    'pause.resume': 'RESUME',
    'pause.restart': 'RESTART SCREEN',
    'pause.settings': 'OPTIONS',
    'pause.menu': 'MAIN MENU',
    'pause.gfx': 'GRAPHICS: {v}',
    'pause.music': 'MUSIC: {v}',
    'pause.sfx': 'SFX: {v}',
    'pause.lang': 'LANGUAGE: {v}',

    'test.title': 'ПРОРЫВ TESTS',
    'test.ok': 'OK',
    'test.fail': 'FAIL'
  };

  window.PR_I18N = { ru: RU, en: EN };

  /**
   * Перевод по ключу. Порядок: текущий язык → ru → en → сам ключ.
   * Подставляет {name} из vars.
   */
  window.PR_T = function (key, vars) {
    const pr = window.PR;
    const lang = (pr && pr.settings && pr.settings.lang) === 'en' ? 'en' : 'ru';
    let s = (window.PR_I18N[lang] && window.PR_I18N[lang][key]);
    if (s == null) s = window.PR_I18N.ru[key];
    if (s == null) s = window.PR_I18N.en[key];
    if (s == null) return String(key);
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m;
      });
    }
    return s;
  };
})();

/* ==== src/audio.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — 8-битный звуковой движок (WebAudio, без сэмплов)
   API: docs/CONTRACT.md §2, музыка: docs/MUSIC.md.

   4 канала, как на 8-битных приставках:
     lead  — pulse 1 (мелодия), duty + вибрато;
     harm  — pulse 2 (гармония/арпеджио), другой duty;
     bass  — triangle (бас);
     drums — noise (ударные/перкуссия).

   Секвенсор: setInterval 25 мс, горизонт 0.12 с, время берётся из
   AudioContext.currentTime; шаг = 1/16 (stepsPerBeat = 4), луп бесшовный.

   Порядок в файле:
     0. константы и утилиты;
     1. теория нот + ДАННЫЕ ТРЕКОВ (правится композитором, без движка);
     2. компиляция данных в события;
     3. граф WebAudio;
     4. синтез голосов (pulse / triangle / noise);
     5. секвенсор с lookahead + кроссфейд;
     6. SFX;
     7. публичный API.

   Нотация паттернов (16 шагов = 1 такт 4/4):
     '.'      — пауза;
     '-'      — продление предыдущей ноты;
     '|'      — визуальный разделитель (на музыку не влияет);
     'A4'     — нота (доступны # и b: C#5, Bb3);
     '!A4'    — акцент (громче);
     'A4~'    — вибрато на ноте;
     '>A4'    — портаменто: слайд из предыдущей высоты канала;
     'A4>C5'  — глиссандо: непрерывный слайд A4 -> C5 за длительность ноты;
     барабаны: K/k kick, S/s snare, H/h hat, O open hat, C crash, T tom
               (строчная буква — тише).
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     0. КОНСТАНТЫ И УТИЛИТЫ
     ============================================================ */

  const AC = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
  const DEBUG = (typeof window !== 'undefined') && window.__PR_AUDIO_DEBUG__ === true;

  const LOOKAHEAD_MS = 25;        // период планировщика
  const SCHEDULE_AHEAD = 0.12;    // на сколько секунд вперёд планируем
  const CROSSFADE = 0.4;          // кроссфейд между треками, секунды

  const MASTER_LEVEL = 0.9;       // максимум общей громкости
  const MUSIC_LEVEL = 0.32;       // музыка тише эффектов, чтобы не перекрывать
  const SFX_LEVEL = 1.0;
  const DUCK_FACTOR = 0.25;       // duck(true) — музыка до ~25% громкости

  const MAX_VOICES = 24;          // суммарный лимит одновременных голосов
  const MAX_SFX_PER_ID = 6;       // лимит голосов на один звуковой эффект

  const STEPS_PER_BEAT = 4;       // шаг секвенсора = 1/16

  function clamp(v, lo, hi) {
    if (v !== v) return lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* ============================================================
     1. ТЕОРИЯ НОТ + ДАННЫЕ ТРЕКОВ
     Ниже до [MUSIC-DATA-END] — только данные и чистые формулы,
     без WebAudio: этот блок можно проверять офлайн
     (proryv/tmp/validate-music.mjs).
     ============================================================ */

  /* [MUSIC-DATA-BEGIN] */

  const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // префиксы (! >) + нота + необязательное глиссандо (>нота) + необязательное вибрато (~)
  const NOTE_RE = /^([!>]*)([A-G])([#b]?)(\d)(?:>([A-G])([#b]?)(\d))?(~?)$/;

  function midiOf(letter, accidental, octave) {
    let pc = NOTE_BASE[letter];
    if (accidental === '#') pc += 1;
    else if (accidental === 'b') pc -= 1;
    return (parseInt(octave, 10) + 1) * 12 + pc;
  }

  function midiName(midi) {
    const pc = ((midi % 12) + 12) % 12;
    return SHARP_NAMES[pc] + (Math.floor(midi / 12) - 1);
  }

  // Транспонирование паттерна: '-'/'.'/'|' и барабанные буквы не трогаем.
  function transposePattern(pattern, semitones) {
    if (!semitones) return pattern;
    const tokens = pattern.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const m = NOTE_RE.exec(tokens[i]);
      if (!m) continue;
      let out = m[1] + midiName(midiOf(m[2], m[3], m[4]) + semitones);
      if (m[5]) out += '>' + midiName(midiOf(m[5], m[6], m[7]) + semitones);
      tokens[i] = out + m[8];
    }
    return tokens.join(' ');
  }

  // Копия канала с выбранными тактами (indices) и необязательным транспонированием.
  function variantChannel(channel, indices, semitones) {
    const out = {
      gain: channel.gain,
      duty: channel.duty,
      vibrato: channel.vibrato,
      patterns: {},
      order: indices ? indices.map(function (i) { return channel.order[i]; }) : channel.order.slice()
    };
    const names = Object.keys(channel.patterns);
    for (let i = 0; i < names.length; i++) {
      const src = channel.patterns[names[i]];
      out.patterns[names[i]] = semitones ? transposePattern(src, semitones) : src;
    }
    return out;
  }

  /* ---------- Барабанные рисунки (16 шагов = такт) ---------- */

  const DRUMS_BASIC = {
    Db:     'K . H . | S . H . | K . H . | S . H H',
    Db2:    'K . H . | S . H . | K . H . | S . h H',
    Dfill:  'K . H . | S . H . | K . H . | S . S S',
    Dfill2: 'K . H . | S . H . | K . S . | T . T T',
    Dbuild: 'K . H h | S . H h | K . K h | S . S S'
  };

  /* ============================================================
     ТРЕК 'GAME' — основной боевой трек
     150 BPM, ля минор (с дорийской G# в E7), 32 такта = 51.2 c.
     Форма: A (1-8) — B (9-16) — A' (17-24) — C (25-32).
     ============================================================ */

  const GAME_LEAD = {
    gain: 0.30,
    duty: 0.25,
    vibrato: { rate: 5.4, depth: 13, delay: 0.14 },
    patterns: {
      // A: зацепка «вопрос-ответ» по тонам Am / F / G
      gL1:  'A4 . C5 . | E5 - D5 - | C5 - B4 - | A4 - - .',
      gL2:  'A4 . C5 . | E5 - A5 - | G5 - E5 - | D5 - C5 .',
      gL3:  'A4 . C5 . | F5 - A5 - | G5 - F5 - | C5 - - .',
      gL4:  'G4 . B4 . | D5 - G5 - | F5 - D5 - | B4 - - .',
      gL6:  'C5 - B4 - | A4 - E5 - | D5 - C5 - | B4 - - .',
      gL7:  'C5 - D5 - | F5 - A5 - | G5 - F5 - | D5 - C5 -',
      gL8:  'E5 . B4 . | G#4 - B4 - | D5 - E5 - | B4 - - .',
      // B: Dm -> Am -> F -> G -> E7, ответная фраза
      gL9:  '>D5 . F5 . | A5 - G5 - | F5 - E5 - | D5 - - .',
      gL10: 'F5 - A5 - | D5 - A4 - | D5 - F5 - | D5 - - -',
      gL11: 'E5 . A5 . | C5 - B4 - | A4 - E4 - | A4 - - .',
      gL12: 'C5 - B4 - | A4 - E4 - | A4 - C5 - | B4 - - .',
      gL13: 'A4 . C5 . | F5 - A5 - | G5 - F5 - | C5 - - .',
      gL14: 'B4 . D5 . | G5 - F5 - | D5 - B4 - | G4 - - .',
      gL15: 'E5 - G#4 - | B4 - E5 - | D5 - B4 - | G#4 - - .',
      gL16: 'B4 . D5 . | E5 - G#5 - | E5 - D5 - | B4 - - .',
      gL19: 'C5 - B4 - | A4 - E5 - | D5 - E5 - | A4 - - .',
      gL24: 'E5 . B4 . | G#4 - B4 - | D5 - B4>G#5 - | E5 - - .',
      // C: гимновая кульминация
      gL25: '>F5 - - - | A5 - - - | G5 - F5 - | C5 - - .',
      gL26: 'G5 - - - | D5 - - - | B4 - D5 - | G5 - - .',
      gL27: 'E5 - - - | A5 - - - | G5 - E5 - | C5 - - .',
      gL28: 'A5 - G5 - | E5 - C5 - | D5 - E5 - | A4 - - .',
      gL29: 'F5 - - - | A5 - - - | G5 - F5 - | C5 - - .',
      gL30: 'G5 - F5 - | D5 - B4 - | D5 - G5 - | B4 - - .',
      gL31: 'E5 - G#4 - | B4 - E5 - | B4>G#5 - E5 - | D5 - - .',
      gL32: 'A4 - - - | E5 - - - | A5~ - - - | - - - -'
    },
    order: [
      'gL1', 'gL2', 'gL3', 'gL4', 'gL1', 'gL6', 'gL7', 'gL8',
      'gL9', 'gL10', 'gL11', 'gL12', 'gL13', 'gL14', 'gL15', 'gL16',
      'gL1', 'gL2', 'gL3', 'gL4', 'gL1', 'gL19', 'gL7', 'gL24',
      'gL25', 'gL26', 'gL27', 'gL28', 'gL29', 'gL30', 'gL31', 'gL32'
    ]
  };

  const GAME_HARM = {
    gain: 0.12,
    duty: 0.125,
    patterns: {
      hAm:  'A3 C4 E4 A4 | C5 A4 E4 A3 | A3 C4 E4 A4 | C5 A4 E4 C4',
      hAm2: 'E4 A4 A4 E4 | E4 C4 A3 C4 | E4 A4 A4 E5 | A4 A4 E4 C4',
      hF:   'F3 A3 C4 F4 | A4 F4 C4 A3 | F3 A3 C4 F4 | A4 C5 A4 F4',
      hG:   'G3 B3 D4 G4 | B4 G4 D4 B3 | G3 B3 D4 G4 | B4 D5 B4 G4',
      hE:   'E3 G#3 B3 E4 | G#4 E4 B3 G#3 | E3 G#3 B3 E4 | G#4 B4 G#4 E4',
      hDm:  'D3 F3 A3 D4 | F4 D4 A3 F3 | D3 F3 A3 D4 | F4 A4 F4 D4'
    },
    order: [
      'hAm', 'hAm2', 'hF', 'hG',
      'hAm', 'hAm2', 'hF', 'hE',
      'hDm', 'hDm', 'hAm', 'hAm2',
      'hF', 'hG', 'hE', 'hE',
      'hAm', 'hAm2', 'hF', 'hG',
      'hAm', 'hAm2', 'hF', 'hE',
      'hF', 'hG', 'hAm', 'hAm2',
      'hF', 'hG', 'hE', 'hAm'
    ]
  };

  const GAME_BASS = {
    gain: 0.55,
    patterns: {
      bAm:    'A2 - A3 - | A2 - A3 - | A2 - A3 - | A2 - A3 -',
      bF:     'F2 - F3 - | F2 - F3 - | F2 - F3 - | F2 - F3 -',
      bG:     'G2 - G3 - | G2 - G3 - | G2 - G3 - | G2 - G3 -',
      bE:     'E2 - E3 - | E2 - E3 - | E2 - E3 - | E2 - E3 -',
      bDm:    'D2 - D3 - | D2 - D3 - | D2 - D3 - | D2 - D3 -',
      // подъём в конце 8-тактового блока: E -> G -> B
      bEfill: 'E2 - E3 - | E2 - E3 - | B2 - B3 - | D3 - B2 -',
      // разрешение в Am на стыке лупа: A -> E -> C -> B -> A
      bAfill: 'A2 - A3 - | A2 - E3 - | A2 - A3 - | C3 - E3 -'
    },
    order: [
      'bAm', 'bAm', 'bF', 'bG',
      'bAm', 'bAm', 'bF', 'bEfill',
      'bDm', 'bDm', 'bAm', 'bAm',
      'bF', 'bG', 'bE', 'bEfill',
      'bAm', 'bAm', 'bF', 'bG',
      'bAm', 'bAm', 'bF', 'bEfill',
      'bF', 'bG', 'bAm', 'bAm',
      'bF', 'bG', 'bE', 'bAfill'
    ]
  };

  const GAME_DRUMS = {
    gain: 0.32,
    patterns: DRUMS_BASIC,
    order: [
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2',
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2',
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2',
      'Db', 'Db', 'Db', 'Dfill',
      'Db', 'Db2', 'Dbuild', 'Dfill2'
    ]
  };

  /* ============================================================
     ТРЕК 'EXO' — тот же материал, но агрессивнее
     156 BPM: мелодия и бас те же, гармония на октаву выше,
     хэты 16-ми, больше томов. Звучит при экзоскелете.
     ============================================================ */

  const EXO_HARM = variantChannel(GAME_HARM, null, 12);
  EXO_HARM.gain = 0.10;

  const EXO_DRUMS = {
    gain: 0.33,
    patterns: Object.assign({}, DRUMS_BASIC, {
      e1: 'K H h H | S H h H | K H h H | S H h O',
      e2: 'K H h H | S H h H | K H h H | S . S h',
      ef: 'K H h H | S H h H | K S h H | T . T T',
      eb: 'K H h H | S H h H | K H K H | S S S S'
    }),
    order: [
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef',
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef',
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef',
      'e1', 'e1', 'e1', 'ef', 'e1', 'e2', 'eb', 'ef'
    ]
  };

  /* ============================================================
     ТРЕК 'FINAL' — финальный сектор, 160 BPM, ре минор
     Тот же тематический материал, транспонированный A-moll -> D-moll
     (мелодия/гармония -7 полутонов, бас +5 — та же гармония, ниже),
     порядок тактов B-C-A, плотные барабаны.
     ============================================================ */

  const FINAL_BARS = [
    0, 1, 2, 3, 4, 5, 6, 7,       // A-секция: главный мотив в Dm
    8, 9, 10, 11, 12, 13, 14, 15, // B-секция: Gm/Dm/Bb/C -> A7
    24, 25, 26, 27, 28, 29, 30, 31 // C-секция: кульминация, упирается в Dm
  ];

  const FINAL_DRUMS = {
    gain: 0.34,
    patterns: Object.assign({}, DRUMS_BASIC, {
      F1: 'K H h H | S H h H | K H h H | S H h C',
      F2: 'K H h H | S H h H | K H h H | S . S h',
      Ff: 'K H h H | S H h H | K S h H | T . T T',
      Fb: 'K H h H | S H h H | K K h H | S S S S'
    }),
    order: [
      'F1', 'F1', 'F2', 'Ff', 'F1', 'F2', 'Fb', 'Ff',
      'F1', 'F1', 'F2', 'Ff', 'F1', 'F2', 'Fb', 'Ff',
      'F1', 'F2', 'F1', 'Ff', 'F1', 'F2', 'Fb', 'Ff'
    ]
  };

  /* ============================================================
     ТРЕК 'TITLE' — титульный экран, 132 BPM, ля минор, 16 тактов
     Вступление (1-4): восходящие арпеджио, редкие барабаны.
     Тема (5-12): героическая мелодия, полная ритм-секция.
     Кода (13-16): вариация и возврат к арпеджио.
     ============================================================ */

  const TITLE_LEAD = {
    gain: 0.30,
    duty: 0.25,
    vibrato: { rate: 5.0, depth: 11, delay: 0.16 },
    patterns: {
      tI1: 'A4 C5 E5 A5 | E5 C5 A4 C5 | E5 A5 E5 C5 | A4 C5 E5 A5',
      tI2: 'F4 A4 C5 F5 | A5 F5 C5 A4 | F4 A4 C5 F5 | A5 G5 F5 C5',
      tI3: 'G4 B4 D5 G5 | D5 B4 G4 B4 | D5 G5 D5 B4 | G4 B4 D5 G5',
      tI4: 'A4 C5 E5 A5 | C6 A5 E5 C5 | A4 E5 A5 C6 | E5 C5 C5>A4 -',
      tT5:  'E5 - - A5 | - - E5 - | D5 - C5 - | A4 - - -',
      tT6:  'C5 - - E5 | - - A4 - | B4 - C5 - | D5 - - -',
      tT7:  'F5 - - C5 | - - A4 - | C5 - F4 - | A4 - - -',
      tT8:  'G5 - - D5 | - - B4 - | D5 - G4 - | B4 - - -',
      tT9:  'A5 - - E5 | - - A4 - | C5 - B4 - | A4 - - -',
      tT10: 'E5 - G5 - | >A5~ - - - | G5 - E5 - | D5 - - -',
      tT11: 'F5 - A5 - | G5 - F5 - | C5 - A4 - | F4 - - -',
      tT12: 'E5 - G#4 - | B4 - E5 - | D5 - B4 - | G#4 - - -',
      tT13: 'A4 . C5 . | E5 - D5 - | C5 - B4 - | A4 - - .',
      tT14: 'F4 . A4 . | C5 - F5 - | G5 - F5 - | C5 - - .',
      tT15: 'G4 . B4 . | D5 - G5 - | F5 - D5 - | B4 - - .',
      tT16: 'E5 . B4 . | G#4 - B4 - | D5 - E5 - | B4 - - .'
    },
    order: [
      'tI1', 'tI2', 'tI3', 'tI4',
      'tT5', 'tT6', 'tT7', 'tT8', 'tT9', 'tT10', 'tT11', 'tT12',
      'tT13', 'tT14', 'tT15', 'tT16'
    ]
  };

  const TITLE_HARM = {
    gain: 0.11,
    duty: 0.125,
    patterns: Object.assign({ rRest: '. . . . | . . . . | . . . . | . . . .' }, GAME_HARM.patterns),
    order: [
      'rRest', 'rRest', 'rRest', 'rRest',
      'hAm', 'hAm2', 'hF', 'hG', 'hAm', 'hAm2', 'hF', 'hE',
      'hAm', 'hF', 'hG', 'hE'
    ]
  };

  const TITLE_BASS = {
    gain: 0.55,
    patterns: {
      tBAmIn: 'A2 - - - - - - - | E3 - - - A3 - - -',
      tBFIn:  'F2 - - - - - - - | C3 - - - F3 - - -',
      tBGIn:  'G2 - - - - - - - | D3 - - - G3 - - -',
      tBAm4:  'A2 - - - E3 - - - | A3 - - - E3 - - -',
      tBAm:   'A2 - - - A3 - - - | A2 - - - E3 - - -',
      tBF:    'F2 - - - F3 - - - | F2 - - - C3 - - -',
      tBG:    'G2 - - - G3 - - - | G2 - - - D3 - - -',
      tBE:    'E2 - - - E3 - - - | E2 - - - B2 - - -'
    },
    order: [
      'tBAmIn', 'tBFIn', 'tBGIn', 'tBAm4',
      'tBAm', 'tBAm', 'tBF', 'tBG', 'tBAm', 'tBAm', 'tBF', 'tBE',
      'tBAm', 'tBF', 'tBG', 'tBE'
    ]
  };

  const TITLE_DRUMS = {
    gain: 0.30,
    patterns: Object.assign({
      tD1: 'H . . . | H . . . | H . . . | H . . .',
      tD2: 'K . . . | H . . . | K . . . | H . . .',
      tD3: 'K . . . | H . . . | K . H . | T . T T'
    }, DRUMS_BASIC),
    order: [
      'tD1', 'tD1', 'tD2', 'Dfill',
      'Db', 'Db2', 'Db', 'Dfill', 'Db', 'Db2', 'Db', 'Dfill2',
      'Db', 'Db2', 'Dbuild', 'Dfill'
    ]
  };

  /* ============================================================
     ДЖИНГЛЫ: clear (3.0 c), gameover (2.9 c), win (6.9 c).
     loop: false — играют один раз и замолкают.
     ============================================================ */

  const TRACKS = {
    title: {
      bpm: 132, loop: true,
      lead: TITLE_LEAD, harm: TITLE_HARM, bass: TITLE_BASS, drums: TITLE_DRUMS
    },
    game: {
      bpm: 150, loop: true, intensity: true,
      lead: GAME_LEAD, harm: GAME_HARM, bass: GAME_BASS, drums: GAME_DRUMS
    },
    exo: {
      bpm: 156, loop: true,
      lead: GAME_LEAD, harm: EXO_HARM, bass: GAME_BASS, drums: EXO_DRUMS
    },
    final: {
      bpm: 160, loop: true,
      lead: variantChannel(GAME_LEAD, FINAL_BARS, -7),
      harm: variantChannel(GAME_HARM, FINAL_BARS, -7),
      bass: variantChannel(GAME_BASS, FINAL_BARS, 5),
      drums: FINAL_DRUMS
    },

    /* --- победный джингл: C-dur, восходящая фраза, 160 BPM, 2 такта --- */
    clear: {
      bpm: 160, loop: false,
      lead: {
        gain: 0.30, duty: 0.25, vibrato: { rate: 6.0, depth: 10, delay: 0.1 },
        patterns: {
          cL1: 'C5 . E5 . | G5 . C6 . | G5 . E5 . | G5 - - -',
          cL2: 'E5 . G5 . | C6 . G5 . | E5 - G5 - | C6~ - - -'
        },
        order: ['cL1', 'cL2']
      },
      harm: {
        gain: 0.13, duty: 0.125,
        patterns: {
          cH1: 'C4 E4 G4 C5 | E5 C5 G4 E4 | C4 E4 G4 C5 | E5 G5 C6 G5',
          cH2: 'C4 E4 G4 C5 | E5 G5 C6 G5 | E5 C5 G4 E4 | C4 - - -'
        },
        order: ['cH1', 'cH2']
      },
      bass: {
        gain: 0.55,
        patterns: {
          cB1: 'C3 - - - G3 - - - | C3 - - - G2 - - -',
          cB2: 'C3 - - - E3 - - - | G3 - - - C4 - - -'
        },
        order: ['cB1', 'cB2']
      },
      drums: {
        gain: 0.30,
        patterns: {
          cD1: 'C K . H | K . H . | C K . H | K . S S',
          cD2: 'K . H . | S . H . | K . H . | S S S S'
        },
        order: ['cD1', 'cD2']
      }
    },

    /* --- проигрыш: d-moll, нисходящая фраза, 165 BPM, 2 такта --- */
    gameover: {
      bpm: 165, loop: false,
      lead: {
        gain: 0.30, duty: 0.5, vibrato: { rate: 4.5, depth: 16, delay: 0.12 },
        patterns: {
          oL1: 'D5 - - - | C5 - A4 - | F4 - D4 - | A3 - - -',
          oL2: 'D4 - - - | A4 - - - | F4 - - - | D4 - - -'
        },
        order: ['oL1', 'oL2']
      },
      harm: {
        gain: 0.12, duty: 0.125,
        patterns: {
          oH1: 'D3 - - - | A3 - - - | F3 - - - | A3 - - -',
          oH2: 'D3 - - - | A3 - - - | F3 - - - | D3 - - -'
        },
        order: ['oH1', 'oH2']
      },
      bass: {
        gain: 0.55,
        patterns: {
          oB1: 'D2 - - - D3 - - - | D2 - - - A2 - - -',
          oB2: 'D2 - - - F2 - - - | A2 - - - D3 - - -'
        },
        order: ['oB1', 'oB2']
      },
      drums: {
        gain: 0.28,
        patterns: {
          oD1: 'K . . . | T . . . | K . . . | S . . .',
          oD2: 'K . . . | S . . . | K . . . | S S S S'
        },
        order: ['oD1', 'oD2']
      }
    },

    /* --- финальный триумф: C-dur, фанфара, 140 BPM, 4 такта (~6.9 c) --- */
    win: {
      bpm: 140, loop: false,
      lead: {
        gain: 0.30, duty: 0.25, vibrato: { rate: 5.6, depth: 12, delay: 0.14 },
        patterns: {
          wL1: 'C5 . E5 . | G5 . C6 . | G5 - E5 - | C5 - - -',
          wL2: 'F5 - - - | A5 - - - | C6 - A5 - | F5 - - -',
          wL3: 'G5 - - - | D5 - B4 - | D5 - G5 - | B4 - - -',
          wL4: 'C6~ - - - | G5 - E5 - | C5 - E5 - | G5 - - -'
        },
        order: ['wL1', 'wL2', 'wL3', 'wL4']
      },
      harm: {
        gain: 0.13, duty: 0.125,
        patterns: {
          wH1: 'C4 E4 G4 C5 | E5 C5 G4 E4 | C4 E4 G4 C5 | E5 G5 C6 G5',
          wH2: 'F4 A4 C5 F5 | A5 F5 C5 A4 | F4 A4 C5 F5 | A5 C6 A5 F5',
          wH3: 'G4 B4 D5 G5 | B4 D5 G5 B5 | D5 B4 G4 B4 | D5 G5 D5 B4',
          wH4: 'C5 E5 G5 C6 | G5 E5 C5 E5 | G5 C6 G5 E5 | C5 - - -'
        },
        order: ['wH1', 'wH2', 'wH3', 'wH4']
      },
      bass: {
        gain: 0.55,
        patterns: {
          wB1: 'C3 - - - G3 - - - | C3 - - - G2 - - -',
          wB2: 'F2 - - - C3 - - - | F2 - - - A2 - - -',
          wB3: 'G2 - - - D3 - - - | G2 - - - B2 - - -',
          wB4: 'C3 - - - E3 - - - | G3 - - - C4 - - -'
        },
        order: ['wB1', 'wB2', 'wB3', 'wB4']
      },
      drums: {
        gain: 0.32,
        patterns: {
          wD1: 'C K . H | S . H . | C K . H | S . S S',
          wD2: 'K . H . | S . H . | K . H . | S . S S',
          wD3: 'K . H . | S . H . | K . K . | S . S S',
          wD4: 'C K . . | S . . . | K . . . | S S S S'
        },
        order: ['wD1', 'wD2', 'wD3', 'wD4']
      }
    }
  };

  /* [MUSIC-DATA-END] */

  /* ============================================================
     2. КОМПИЛЯЦИЯ ТРЕКОВ: строки паттернов -> события по шагам
     ============================================================ */

  const DRUM_RE = /^[KSHOCTkshoct]$/;
  const compiledTracks = {};

  function tokensOf(pattern) {
    if (typeof pattern !== 'string') return [];
    const raw = pattern.split(/\s+/);
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] && raw[i] !== '|') out.push(raw[i]);
    }
    return out;
  }

  function parseNoteToken(token) {
    const m = NOTE_RE.exec(token);
    if (!m) return null;
    return {
      midi: midiOf(m[2], m[3], m[4]),
      fromPrev: m[1].indexOf('>') >= 0,
      accent: m[1].indexOf('!') >= 0,
      toMidi: m[5] ? midiOf(m[5], m[6], m[7]) : 0,
      vib: m[8] === '~'
    };
  }

  function channelLength(def) {
    if (!def || !def.patterns || !def.order) return 0;
    let total = 0;
    for (let i = 0; i < def.order.length; i++) total += tokensOf(def.patterns[def.order[i]]).length;
    return total;
  }

  function compileChannel(def, kind, totalSteps) {
    const out = {
      kind: kind,
      gain: (def && typeof def.gain === 'number') ? def.gain : 0.2,
      duty: (def && def.duty) ? def.duty : 0.25,
      vibrato: (def && def.vibrato) || null,
      byStep: new Array(totalSteps),
      count: 0
    };
    if (!def || !def.patterns || !def.order) return out;
    let step = 0;
    let last = null;
    for (let oi = 0; oi < def.order.length; oi++) {
      const tokens = tokensOf(def.patterns[def.order[oi]]);
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const at = step + i;
        if (at >= totalSteps) continue;
        if (kind === 'drums') {
          if (DRUM_RE.test(token)) pushEvent(out, { step: at, hit: token });
        } else if (token === '-') {
          if (last) last.dur += 1;
        } else if (token === '.') {
          /* пауза: last не сбрасываем — '-' и '>' работают через паузы */
        } else {
          const note = parseNoteToken(token);
          if (!note) continue;
          last = {
            step: at, midi: note.midi, dur: 1,
            vib: note.vib, accent: note.accent,
            toMidi: note.toMidi, fromMidi: 0, prev: note.fromPrev
          };
          pushEvent(out, last);
        }
      }
      step += tokens.length;
    }

    // длительности не должны вылезать за конец лупа
    const flat = [];
    for (let s = 0; s < totalSteps; s++) {
      const list = out.byStep[s];
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const ev = list[j];
        if (ev.dur > totalSteps - ev.step) ev.dur = totalSteps - ev.step;
        if (ev.dur < 1) ev.dur = 1;
        flat.push(ev);
      }
    }

    // портаменто: стартуем из высоты предыдущего события канала (с учётом лупа)
    if (flat.length > 1) {
      for (let i = 0; i < flat.length; i++) {
        if (flat[i].prev) flat[i].fromMidi = flat[(i - 1 + flat.length) % flat.length].midi;
      }
    }
    return out;
  }

  function pushEvent(channel, ev) {
    let list = channel.byStep[ev.step];
    if (!list) {
      list = [];
      channel.byStep[ev.step] = list;
    }
    list.push(ev);
    channel.count++;
  }

  function compileTrack(id, def) {
    const bpm = def.bpm || 150;
    const total = channelLength(def.lead) || channelLength(def.harm) || 16;
    return {
      id: id,
      bpm: bpm,
      stepDur: 60 / bpm / STEPS_PER_BEAT,
      loop: def.loop !== false,
      intensity: !!def.intensity,
      totalSteps: total,
      bars: total / 16,
      channels: {
        lead: compileChannel(def.lead, 'lead', total),
        harm: compileChannel(def.harm, 'harm', total),
        bass: compileChannel(def.bass, 'bass', total),
        drums: compileChannel(def.drums, 'drums', total)
      }
    };
  }

  function getTrack(id) {
    if (compiledTracks[id]) return compiledTracks[id];
    const def = TRACKS[id];
    if (!def) return null;
    try {
      compiledTracks[id] = compileTrack(id, def);
    } catch (err) {
      compiledTracks[id] = null;
    }
    return compiledTracks[id];
  }

  /* ============================================================
     3. ГРАФ WEBAUDIO
     ============================================================ */

  let ctx = null;
  let master = null;
  let limiter = null;
  let musicBus = null;
  let musicFilter = null;
  let sfxBus = null;
  let noiseBuf = null;
  const waveCache = {};

  let musicOn = true;
  let sfxOn = true;
  let volume = 0.8;
  let ducked = false;
  let intensity = 0.35;

  let currentTrack = null;    // id трека (помним даже при mute)
  let currentSong = null;     // объект играющего трека
  let tickTimer = null;
  let hidden = false;

  let activeVoices = 0;
  const sfxVoices = {};       // id эффекта -> число одновременных голосов
  const stats = { notes: 0 };

  function isRunning() {
    return !!ctx && ctx.state === 'running';
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function filterCutoff() {
    return 4200 + intensity * 4800;   // яркость растёт с напряжением
  }

  function buildNoise() {
    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let seed = 0x2545f491;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = volume * MASTER_LEVEL;

    // мягкий лимитер на мастере: защита от clipping при залпах SFX
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? (ducked ? MUSIC_LEVEL * DUCK_FACTOR : MUSIC_LEVEL) : 0;

    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = filterCutoff();
    musicFilter.Q.value = 0.6;

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? SFX_LEVEL : 0;

    musicBus.connect(musicFilter);
    musicFilter.connect(master);
    sfxBus.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);
  }

  function init() {
    if (ctx) return true;
    if (!AC) return false;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (err) {
      try {
        ctx = new AC();
      } catch (err2) {
        ctx = null;
        return false;
      }
    }
    buildNoise();
    buildGraph();
    ctx.onstatechange = onCtxState;
    return true;
  }

  function onCtxState() {
    if (!ctx) return;
    if (ctx.state === 'running') {
      if (currentTrack && !currentSong) startTrack(currentTrack);
      else if (currentSong && !currentSong.done) {
        currentSong.nextTime = ctx.currentTime + 0.05;
        startTicker();
      }
    } else {
      stopTicker();
    }
  }

  // Импульсная волна заданной скважности (duty control через PeriodicWave).
  function pulseWave(duty) {
    const key = 'd' + duty.toFixed(3);
    if (waveCache[key]) return waveCache[key];
    const harmonics = 48;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let n = 1; n <= harmonics; n++) {
      real[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
    }
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    waveCache[key] = wave;
    return wave;
  }

  /* ============================================================
     4. СИНТЕЗ ГОЛОСОВ
     ============================================================ */

  function canStartVoice(sfxId) {
    if (activeVoices >= MAX_VOICES) return false;
    if (sfxId && (sfxVoices[sfxId] || 0) >= MAX_SFX_PER_ID) return false;
    return true;
  }

  function voiceStarted(sfxId) {
    activeVoices++;
    stats.notes++;
    if (sfxId) sfxVoices[sfxId] = (sfxVoices[sfxId] || 0) + 1;
  }

  function voiceEnded(sfxId) {
    activeVoices = Math.max(0, activeVoices - 1);
    if (sfxId) sfxVoices[sfxId] = Math.max(0, (sfxVoices[sfxId] || 1) - 1);
  }

  // Универсальный тон: pulse/saw/square/triangle/sine + ADSR без щелчков,
  // вибрато, портаменто и глиссандо.
  function startTone(t, o) {
    if (!ctx || !canStartVoice(o.sfxId)) return false;
    const gate = Math.max(0.02, o.gate || o.dur || 0.1);
    const attack = Math.max(0.001, o.attack === undefined ? 0.004 : o.attack);
    const release = Math.max(0.008, o.release === undefined ? 0.03 : o.release);
    const tPeak = t + Math.min(attack, gate * 0.5);
    const tRelease = Math.max(tPeak, t + gate);
    const stopAt = tRelease + release + 0.02;
    const vol = Math.max(0.0001, o.vol || 0);

    const osc = ctx.createOscillator();
    if (o.duty) {
      try {
        osc.setPeriodicWave(pulseWave(o.duty));
      } catch (err) {
        osc.type = 'square';
      }
    } else {
      osc.type = o.type || 'square';
    }

    const f0 = Math.max(20, o.f0 || 440);
    const glideAt = t + Math.max(0.01, Math.min(o.glide || 0.06, gate * 0.6));
    if (o.fromFreq && o.fromFreq > 20) {
      osc.frequency.setValueAtTime(o.fromFreq, t);
      osc.frequency.exponentialRampToValueAtTime(f0, glideAt);
    } else {
      osc.frequency.setValueAtTime(f0, t);
    }
    if (o.f1 && o.f1 > 20) {
      osc.frequency.exponentialRampToValueAtTime(o.f1, Math.max(glideAt + 0.005, t + gate));
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, tPeak);
    if (tRelease > tPeak) g.gain.setValueAtTime(vol, tRelease);
    g.gain.linearRampToValueAtTime(0, tRelease + release);

    let tail = g;
    let filt = null;
    osc.connect(g);
    if (o.filter) {
      filt = ctx.createBiquadFilter();
      filt.type = o.filter.type || 'lowpass';
      filt.Q.value = o.filter.q === undefined ? 0.8 : o.filter.q;
      filt.frequency.setValueAtTime(Math.max(30, o.filter.f0 || 2000), t);
      if (o.filter.f1) {
        filt.frequency.exponentialRampToValueAtTime(Math.max(30, o.filter.f1), t + gate);
      }
      g.connect(filt);
      tail = filt;
    }
    tail.connect(o.bus || sfxBus);

    let lfo = null;
    let lfoGain = null;
    if (o.vib && o.vib.depth > 0) {
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = o.vib.rate || 5.5;
      lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(o.vib.depth, t + Math.max(0.02, o.vib.delay || 0.1));
      lfo.connect(lfoGain);
      lfoGain.connect(osc.detune);
      lfo.start(t);
      lfo.stop(stopAt);
    }

    osc.start(t);
    osc.stop(stopAt);

    voiceStarted(o.sfxId);
    osc.onended = function () {
      voiceEnded(o.sfxId);
      try { osc.disconnect(); } catch (err) {}
      try { g.disconnect(); } catch (err) {}
      if (filt) { try { filt.disconnect(); } catch (err) {} }
      if (lfo) { try { lfo.disconnect(); lfoGain.disconnect(); } catch (err) {} }
    };
    return true;
  }

  // Шумовой голос: ударные и взрывы. Буфер шума генерируется в init().
  function startNoise(t, o) {
    if (!ctx || !noiseBuf || !canStartVoice(o.sfxId)) return false;
    const dur = Math.max(0.02, o.dur || 0.1);
    const attack = Math.max(0.001, o.attack === undefined ? 0.002 : o.attack);
    const end = Math.max(t + attack + 0.005, t + dur);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;

    const filt = ctx.createBiquadFilter();
    filt.type = o.filter || 'lowpass';
    filt.Q.value = o.q === undefined ? 0.8 : o.q;
    filt.frequency.setValueAtTime(Math.max(30, o.f0 || 1200), t);
    if (o.f1) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t + (o.sweep || dur));
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, o.vol || 0), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    src.connect(filt);
    filt.connect(g);
    g.connect(o.bus || sfxBus);

    src.start(t, o.offset || 0);
    src.stop(end + 0.03);

    voiceStarted(o.sfxId);
    src.onended = function () {
      voiceEnded(o.sfxId);
      try { src.disconnect(); } catch (err) {}
      try { filt.disconnect(); } catch (err) {}
      try { g.disconnect(); } catch (err) {}
    };
    return true;
  }

  /* ---------- ударные ---------- */

  const DRUM_KIT = {
    K: { vol: 1.00, filter: 'lowpass', f0: 1000, f1: 52, q: 6.5, dur: 0.20, sweep: 0.16, rate: 0.85, attack: 0.002, offset: 0.011 },
    k: { vol: 0.55, filter: 'lowpass', f0: 900, f1: 60, q: 6.0, dur: 0.16, sweep: 0.13, rate: 0.85, attack: 0.002, offset: 0.013 },
    S: { vol: 0.85, filter: 'bandpass', f0: 2000, f1: 1500, q: 1.0, dur: 0.13, sweep: 0.10, rate: 1.0, attack: 0.001, offset: 0.211 },
    s: { vol: 0.48, filter: 'bandpass', f0: 1800, f1: 1400, q: 1.0, dur: 0.10, sweep: 0.08, rate: 1.0, attack: 0.001, offset: 0.213 },
    H: { vol: 0.55, filter: 'highpass', f0: 7200, q: 0.7, dur: 0.035, rate: 1.0, attack: 0.001, offset: 0.371 },
    h: { vol: 0.24, filter: 'highpass', f0: 7200, q: 0.7, dur: 0.030, rate: 1.0, attack: 0.001, offset: 0.373 },
    O: { vol: 0.45, filter: 'highpass', f0: 6200, q: 0.7, dur: 0.24, rate: 1.0, attack: 0.002, offset: 0.531 },
    C: { vol: 0.50, filter: 'highpass', f0: 3800, q: 0.6, dur: 0.60, rate: 1.0, attack: 0.002, offset: 0.611 },
    T: { vol: 0.85, filter: 'bandpass', f0: 260, f1: 180, q: 1.8, dur: 0.18, sweep: 0.13, rate: 0.8, attack: 0.002, offset: 0.771 }
  };

  function scheduleDrum(song, channel, ev, t) {
    const kit = DRUM_KIT[ev.hit];
    if (!kit) return;
    startNoise(t, {
      bus: song.gain,
      vol: kit.vol * channel.gain,
      filter: kit.filter, f0: kit.f0, f1: kit.f1, q: kit.q,
      dur: kit.dur, sweep: kit.sweep, rate: kit.rate,
      attack: kit.attack, offset: kit.offset
    });
  }

  function scheduleNote(song, channel, ev, t) {
    const gate = Math.max(0.035, Math.min(ev.dur * song.track.stepDur * 0.92, 1.2));
    // при высоком напряжении гармония уходит на октаву вверх — плотнее и злее
    const transpose = (channel.kind === 'harm' && song.track.intensity && song.intensity > 0.7) ? 12 : 0;
    const o = {
      bus: song.gain,
      gate: gate,
      release: channel.kind === 'bass' ? 0.05 : 0.045,
      attack: channel.kind === 'bass' ? 0.005 : 0.006,
      vol: channel.gain * (ev.accent ? 1.25 : 1),
      f0: midiToFreq(ev.midi + transpose),
      fromFreq: ev.fromMidi ? midiToFreq(ev.fromMidi + transpose) : 0,
      glide: Math.min(0.10, gate * 0.5),
      f1: ev.toMidi ? midiToFreq(ev.toMidi + transpose) : 0,
      duty: channel.kind === 'bass' ? 0 : channel.duty,
      type: channel.kind === 'bass' ? 'triangle' : 'square'
    };
    if (channel.kind === 'lead' && channel.vibrato && (ev.vib || ev.dur >= 3)) {
      o.vib = {
        rate: channel.vibrato.rate,
        depth: channel.vibrato.depth * (ev.vib ? 1.6 : 1),
        delay: channel.vibrato.delay
      };
    }
    startTone(t, o);
  }

  function scheduleStep(song, step, t) {
    const track = song.track;
    const chans = track.channels;

    const lead = chans.lead.byStep[step];
    if (lead) for (let i = 0; i < lead.length; i++) scheduleNote(song, chans.lead, lead[i], t);

    const harm = chans.harm.byStep[step];
    if (harm) for (let i = 0; i < harm.length; i++) scheduleNote(song, chans.harm, harm[i], t);

    const bass = chans.bass.byStep[step];
    if (bass) for (let i = 0; i < bass.length; i++) scheduleNote(song, chans.bass, bass[i], t);

    const drums = chans.drums.byStep[step];
    let hasHat = false;
    if (drums) {
      for (let i = 0; i < drums.length; i++) {
        const hit = drums[i].hit;
        if (hit === 'H' || hit === 'h' || hit === 'O') hasHat = true;
        scheduleDrum(song, chans.drums, drums[i], t);
      }
    }

    // слой напряжения: добавочные призрачные хэты на слабых долях
    if (track.intensity && song.intensity > 0.5 && !hasHat && (step % 2 === 1)) {
      const hat = DRUM_KIT.H;
      startNoise(t, {
        bus: song.gain,
        vol: hat.vol * chans.drums.gain * 0.45 * song.intensity,
        filter: hat.filter, f0: hat.f0, q: hat.q,
        dur: hat.dur, rate: hat.rate, attack: hat.attack, offset: hat.offset
      });
    }
  }

  /* ============================================================
     5. СЕКВЕНСОР (lookahead + кроссфейд)
     ============================================================ */

  function startTicker() {
    if (tickTimer || !ctx) return;
    tickTimer = setInterval(tick, LOOKAHEAD_MS);
    tick();
  }

  function stopTicker() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function tick() {
    if (!ctx || !currentSong || currentSong.done) return;
    if (ctx.state !== 'running') return;
    const song = currentSong;
    // после паузы/зависания не выстреливаем пачкой «прошлые» ноты
    if (song.nextTime < ctx.currentTime - 0.25) song.nextTime = ctx.currentTime + 0.05;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD;
    let guard = 0;
    while (song.nextTime < horizon && guard++ < 128) {
      // сбойный шаг пропускаем, но время двигаем: секвенсор не должен вставать
      try {
        scheduleStep(song, song.step, song.nextTime);
      } catch (err) {}
      song.step++;
      song.nextTime += song.track.stepDur;
      if (song.step >= song.track.totalSteps) {
        if (song.track.loop) {
          song.step = 0;
        } else {
          finishSong(song);
          return;
        }
      }
    }
  }

  function createSong(track, id, fade) {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    gain.connect(musicBus);
    return {
      id: id,
      track: track,
      gain: gain,
      step: 0,
      nextTime: now + 0.06,
      done: false,
      intensity: intensity
    };
  }

  function fadeOutSong(song, fade) {
    if (!ctx || !song) return;
    const now = ctx.currentTime;
    try {
      const p = song.gain.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(Math.max(0.0001, p.value), now);
      p.linearRampToValueAtTime(0, now + fade);
    } catch (err) {}
    setTimeout(function () {
      try { song.gain.disconnect(); } catch (err) {}
    }, Math.ceil(fade * 1000) + 250);
  }

  function startTrack(id) {
    if (!ctx || ctx.state !== 'running') return false;
    const track = getTrack(id);
    if (!track) return false;
    const old = currentSong;
    const fade = old ? CROSSFADE : 0.08;
    if (old) {
      old.done = true;
      fadeOutSong(old, CROSSFADE);
    }
    const song = createSong(track, id, fade);
    currentSong = song;
    currentTrack = id;
    startTicker();
    return true;
  }

  function finishSong(song) {
    song.done = true;
    stopTicker();
    if (currentSong === song) {
      currentSong = null;
      currentTrack = null;
    }
    // хвост последних нот доигрывает, узлы потом освобождаем
    setTimeout(function () {
      try { song.gain.disconnect(); } catch (err) {}
    }, 1500);
  }

  function stopMusic() {
    currentTrack = null;
    stopTicker();
    const song = currentSong;
    currentSong = null;
    if (song) fadeOutSong(song, 0.3);
  }

  function playMusic(id) {
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(TRACKS, id)) return;
    if (currentTrack === id && currentSong && !currentSong.done) return; // тот же трек не перезапускаем
    currentTrack = id;
    if (!ctx) init();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && p.then) p.then(tryStartPending).catch(function () {});
      return;
    }
    startTrack(id);
  }

  function tryStartPending() {
    if (!ctx || ctx.state !== 'running') return;
    if (currentTrack && !currentSong) startTrack(currentTrack);
  }

  /* ============================================================
     6. SFX — короткие сухие звуки, всё синтезом
     ============================================================ */

  function sfxTone(t, o) {
    o.bus = sfxBus;
    return startTone(t, o);
  }

  function sfxNoise(t, o) {
    o.bus = sfxBus;
    return startNoise(t, o);
  }

  const SFX_TABLE = {
    laser: function (t) {
      sfxTone(t, { sfxId: 'laser', duty: 0.5, f0: 1850, f1: 250, gate: 0.095, attack: 0.001, release: 0.045, vol: 0.32 });
    },
    grenade: function (t) {
      sfxTone(t, { sfxId: 'grenade', duty: 0.25, f0: 400, f1: 120, gate: 0.18, attack: 0.003, release: 0.08, vol: 0.24 });
      sfxNoise(t + 0.01, { sfxId: 'grenade', filter: 'bandpass', f0: 800, f1: 260, q: 1.2, dur: 0.16, vol: 0.14, rate: 1.3, offset: 0.13 });
    },
    explosion: function (t) {
      sfxNoise(t, { sfxId: 'explosion', filter: 'lowpass', f0: 1600, f1: 90, q: 0.8, dur: 0.42, vol: 0.40, offset: 0.19 });
      sfxTone(t, { sfxId: 'explosion', type: 'sine', f0: 110, f1: 38, gate: 0.30, attack: 0.002, release: 0.08, vol: 0.16 });
    },
    bigexpl: function (t) {
      sfxNoise(t, { sfxId: 'bigexpl', filter: 'lowpass', f0: 1100, f1: 50, q: 0.9, dur: 0.80, vol: 0.46, offset: 0.29 });
      sfxNoise(t + 0.04, { sfxId: 'bigexpl', filter: 'bandpass', f0: 300, f1: 120, q: 2.5, dur: 0.55, vol: 0.20, offset: 0.31 });
      sfxTone(t, { sfxId: 'bigexpl', type: 'sine', f0: 80, f1: 32, gate: 0.55, attack: 0.002, release: 0.12, vol: 0.16 });
    },
    hit: function (t) {
      sfxNoise(t, { sfxId: 'hit', filter: 'highpass', f0: 2600, q: 0.8, dur: 0.05, vol: 0.28, offset: 0.41 });
      sfxTone(t, { sfxId: 'hit', duty: 0.5, f0: 240, f1: 120, gate: 0.05, attack: 0.001, release: 0.03, vol: 0.20 });
    },
    death: function (t) {
      sfxTone(t, { sfxId: 'death', type: 'sawtooth', f0: 640, f1: 90, gate: 0.55, attack: 0.004, release: 0.12, vol: 0.28 });
      sfxNoise(t, { sfxId: 'death', filter: 'lowpass', f0: 900, f1: 120, dur: 0.35, vol: 0.13, offset: 0.47 });
    },
    pickup: function (t) {
      sfxTone(t, { sfxId: 'pickup', duty: 0.25, f0: midiToFreq(84), gate: 0.055, attack: 0.001, release: 0.03, vol: 0.26 });
      sfxTone(t + 0.06, { sfxId: 'pickup', duty: 0.25, f0: midiToFreq(91), gate: 0.08, attack: 0.001, release: 0.05, vol: 0.24 });
    },
    powerup: function (t) {
      const notes = [72, 76, 79, 84];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.055, {
          sfxId: 'powerup', duty: 0.25, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.14 : 0.06,
          attack: 0.001, release: 0.04, vol: 0.22
        });
      }
    },
    teleport: function (t) {
      sfxTone(t, { sfxId: 'teleport', duty: 0.125, f0: 180, f1: 2400, gate: 0.36, attack: 0.004, release: 0.10, vol: 0.26 });
      sfxNoise(t, { sfxId: 'teleport', filter: 'highpass', f0: 4000, dur: 0.30, vol: 0.09, offset: 0.53 });
    },
    jump: function (t) {
      sfxTone(t, { sfxId: 'jump', duty: 0.25, f0: 240, f1: 740, gate: 0.13, attack: 0.002, release: 0.05, vol: 0.28 });
    },
    land: function (t) {
      sfxNoise(t, { sfxId: 'land', filter: 'lowpass', f0: 600, f1: 90, dur: 0.09, vol: 0.26, offset: 0.47 });
      sfxTone(t, { sfxId: 'land', type: 'triangle', f0: 150, f1: 70, gate: 0.07, attack: 0.002, release: 0.04, vol: 0.20 });
    },
    exo: function (t) {
      for (let i = 0; i < 3; i++) {
        sfxTone(t + i * 0.06, {
          sfxId: 'exo', type: 'sawtooth', f0: 180 - i * 28, f1: 150 - i * 24,
          gate: 0.05, attack: 0.002, release: 0.02, vol: 0.13
        });
        sfxNoise(t + i * 0.06, {
          sfxId: 'exo', filter: 'bandpass', f0: 2200, q: 2.0, dur: 0.035, vol: 0.08, offset: 0.23 + i * 0.07
        });
      }
    },
    menu: function (t) {
      sfxTone(t, { sfxId: 'menu', duty: 0.5, f0: 990, gate: 0.035, attack: 0.001, release: 0.02, vol: 0.20 });
    },
    select: function (t) {
      sfxTone(t, { sfxId: 'select', duty: 0.25, f0: 660, gate: 0.04, attack: 0.001, release: 0.02, vol: 0.20 });
      sfxTone(t + 0.055, { sfxId: 'select', duty: 0.25, f0: 990, gate: 0.055, attack: 0.001, release: 0.03, vol: 0.20 });
    },
    deny: function (t) {
      sfxTone(t, { sfxId: 'deny', duty: 0.5, f0: 170, f1: 130, gate: 0.13, attack: 0.002, release: 0.03, vol: 0.22 });
      sfxTone(t + 0.09, { sfxId: 'deny', duty: 0.5, f0: 150, gate: 0.10, attack: 0.002, release: 0.03, vol: 0.18 });
    },
    alarm: function (t) {
      sfxTone(t, { sfxId: 'alarm', duty: 0.5, f0: 950, gate: 0.14, attack: 0.003, release: 0.03, vol: 0.20 });
      sfxTone(t + 0.18, { sfxId: 'alarm', duty: 0.5, f0: 700, gate: 0.14, attack: 0.003, release: 0.03, vol: 0.20 });
    },
    missile: function (t) {
      sfxTone(t, {
        sfxId: 'missile', type: 'sawtooth', f0: 950, f1: 250,
        gate: 0.30, attack: 0.004, release: 0.08, vol: 0.22,
        vib: { rate: 18, depth: 70, delay: 0.02 }
      });
      sfxNoise(t, { sfxId: 'missile', filter: 'bandpass', f0: 500, f1: 1700, q: 2.0, dur: 0.28, vol: 0.18, rate: 1.2, offset: 0.61 });
    },
    crusher: function (t) {
      sfxNoise(t, { sfxId: 'crusher', filter: 'lowpass', f0: 400, f1: 70, q: 1.2, dur: 0.50, vol: 0.38, offset: 0.71 });
      sfxTone(t, { sfxId: 'crusher', duty: 0.5, f0: 70, f1: 38, gate: 0.42, attack: 0.004, release: 0.06, vol: 0.18 });
      sfxNoise(t + 0.12, { sfxId: 'crusher', filter: 'lowpass', f0: 800, f1: 100, dur: 0.30, vol: 0.18, offset: 0.77 });
    },
    clear: function (t) {
      const notes = [72, 76, 79, 84];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.07, {
          sfxId: 'clear', duty: 0.25, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.28 : 0.07,
          attack: 0.001, release: 0.06, vol: 0.24
        });
      }
    },
    gameover: function (t) {
      const notes = [69, 67, 65, 64, 62];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.14, {
          sfxId: 'gameover', duty: 0.5, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.30 : 0.13,
          attack: 0.002, release: 0.05, vol: 0.24
        });
      }
    },
    win: function (t) {
      const notes = [72, 76, 79, 84, 79, 84, 88, 84];
      for (let i = 0; i < notes.length; i++) {
        sfxTone(t + i * 0.08, {
          sfxId: 'win', duty: 0.25, f0: midiToFreq(notes[i]),
          gate: i === notes.length - 1 ? 0.42 : 0.09,
          attack: 0.001, release: 0.08, vol: 0.22
        });
      }
    }
  };

  function sfx(id) {
    if (!sfxOn || !ctx || ctx.state !== 'running' || !noiseBuf) return;
    const fn = SFX_TABLE[id];
    if (!fn) return;
    try {
      fn(ctx.currentTime + 0.006);
    } catch (err) {
      /* звук не должен ломать игровой цикл */
    }
  }

  /* ============================================================
     7. ПУБЛИЧНЫЙ API (docs/CONTRACT.md §2)
     ============================================================ */

  function ready() {
    return !!ctx && ctx.state === 'running';
  }

  function unlock() {
    if (!ctx) init();
    if (!ctx) return false;
    const activate = function () {
      tryStartPending();
      if (currentSong && !currentSong.done) startTicker();
    };
    if (ctx.state === 'running') {
      activate();
      return true;
    }
    const p = ctx.resume();
    if (p && p.then) p.then(activate).catch(function () {});
    else activate();
    return true;
  }

  function applyMusicBus(ramp) {
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime;
    const target = musicOn ? (ducked ? MUSIC_LEVEL * DUCK_FACTOR : MUSIC_LEVEL) : 0;
    try {
      const p = musicBus.gain;
      p.cancelScheduledValues(now);
      if (ramp <= 0) {
        p.setValueAtTime(target, now);
      } else {
        p.setValueAtTime(p.value, now);
        p.linearRampToValueAtTime(target, now + ramp);
      }
    } catch (err) {}
  }

  function setMusic(on) {
    musicOn = !!on;
    if (!ctx) return;
    applyMusicBus(musicOn ? 0.06 : 0);
    if (musicOn) tryStartPending();
  }

  function setSfx(on) {
    sfxOn = !!on;
    if (!ctx || !sfxBus) return;
    const now = ctx.currentTime;
    try {
      sfxBus.gain.cancelScheduledValues(now);
      sfxBus.gain.setValueAtTime(sfxOn ? SFX_LEVEL : 0, now);
    } catch (err) {}
  }

  function setVolume(v) {
    volume = clamp(v, 0, 1);
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    try {
      const p = master.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(volume * MASTER_LEVEL, now + 0.03);
    } catch (err) {}
  }

  function duck(on) {
    ducked = !!on;
    if (ctx) applyMusicBus(ducked ? 0.15 : 0.25);
  }

  function setIntensity(x) {
    intensity = clamp(typeof x === 'number' ? x : 0, 0, 1);
    if (currentSong) currentSong.intensity = intensity;
    if (!ctx || !musicFilter) return;
    const now = ctx.currentTime;
    try {
      const p = musicFilter.frequency;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(filterCutoff(), now + 0.3);
    } catch (err) {}
  }

  const api = {
    init: init,
    unlock: unlock,
    ready: ready,
    setMusic: setMusic,
    setSfx: setSfx,
    setVolume: setVolume,
    playMusic: playMusic,
    stopMusic: stopMusic,
    sfx: sfx,
    duck: duck,
    setIntensity: setIntensity
  };

  // boolean-геттер музыки: именно его ждёт контракт.
  Object.defineProperty(api, 'music', {
    get: function () { return musicOn; },
    enumerable: true
  });
  // SFX-состояние: `sfx` уже занят методом воспроизведения,
  // поэтому boolean-геттер эффектов доступен как sfxOn.
  Object.defineProperty(api, 'sfxOn', {
    get: function () { return sfxOn; },
    enumerable: true
  });

  if (DEBUG) {
    api._debug = function () {
      return {
        ctxState: ctx ? ctx.state : 'none',
        ready: ready(),
        track: currentTrack,
        step: currentSong ? currentSong.step : 0,
        totalSteps: currentSong ? currentSong.track.totalSteps : 0,
        scheduledNotes: stats.notes,
        voices: activeVoices,
        musicOn: musicOn,
        sfxOn: sfxOn,
        volume: volume,
        intensity: intensity,
        ducked: ducked,
        masterGain: master ? +master.gain.value.toFixed(4) : 0,
        musicBusGain: musicBus ? +musicBus.gain.value.toFixed(4) : 0,
        sfxBusGain: sfxBus ? +sfxBus.gain.value.toFixed(4) : 0,
        filterHz: musicFilter ? Math.round(musicFilter.frequency.value) : 0
      };
    };
    api._tracks = TRACKS;
  }

  window.PR_AUDIO = api;

  /* ---------- автопробуждение по первому жесту и пауза во вкладке ---------- */

  // Автопробуждение: первый жест пользователя поднимает AudioContext.
  // Вызывается заново, если после возврата во вкладку контекст не проснулся.
  function armGestureUnlock() {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const events = ['pointerdown', 'keydown', 'touchstart', 'mousedown'];
    const handler = function () {
      try { unlock(); } catch (err) {}
      for (let i = 0; i < events.length; i++) {
        window.removeEventListener(events[i], handler, true);
      }
    };
    for (let i = 0; i < events.length; i++) {
      window.addEventListener(events[i], handler, true);
    }
  }

  armGestureUnlock();

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) {
        hidden = true;
        stopTicker();
        try { ctx.suspend(); } catch (err) {}
      } else {
        hidden = false;
        const resume = function () {
          if (currentSong && !currentSong.done) {
            currentSong.nextTime = ctx.currentTime + 0.06;
            startTicker();
          }
        };
        if (ctx.state === 'suspended') {
          const p = ctx.resume();
          if (p && p.then) p.then(resume).catch(function () { armGestureUnlock(); });
          else resume();
        } else {
          resume();
        }
      }
    });
    window.addEventListener('pagehide', function () {
      hidden = true;
      stopTicker();
      try { if (ctx) ctx.suspend(); } catch (err) {}
    });
  }
})();

/* ==== src/levels.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — данные уровней
   5 секторов × 5 экранов = 25 экранов по 32×24 тайла (256×192 px).
   Механика флип-скрина: ушёл за правый край — следующий экран.

   Формат: docs/LEVELS.md · проверка: node proryv/tools/validate-levels.mjs

   Тайлы:
     ' '  пусто              '#'  твёрдый блок (порода / металл)
     '='  тонкая платформа   '%'  разрушаемый камень (граната)
     '^'  шипы (смертельно)  'x'  декоративная флора

   Координаты сущностей — в тайлах; y — тайл, на нижнюю границу которого
   опирается сущность (низ = (y+1)*8).
   Игрок стартует слева, цель — уйти за правый край (нужна опора у x=30..31).

   Баланс: ур.1 — 3–6 врагов/экран, ур.5 — 7–12; капсула exo — screens[2];
   1 пара телепортов на уровень; патроны и статуи-бонусы — по 1–2 на уровень.
   ============================================================ */
(function () {
  'use strict';

  /* 1.1 — десант на периметр */
  const S1_1 = {
    name: { ru: 'Десант на периметр', en: 'Landing zone' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '     =====            ======    ',
      '                            ####',
      '                            ####',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'walker', x: 13, y: 20, dir: -1, range: 4 },
      { t: 'walker', x: 20, y: 20, dir: 1, range: 3 },
      { t: 'flyer', x: 16, y: 11, dir: -1 },
      { t: 'mine', x: 24, y: 20 }
    ]
  };

  /* 1.2 — разлом */
  const S1_2 = {
    name: { ru: 'Разлом', en: 'The rift' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '               =====            ',
      '                                ',
      '                                ',
      '             ======             ',
      '                                ',
      '                                ',
      '#########   #######   ##########',
      '#########   #######   ##########',
      '################################',
    ],
    entities: [
      { t: 'walker', x: 6, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 15, y: 20, dir: -1, range: 3 },
      { t: 'flyer', x: 22, y: 9, dir: -1 },
      { t: 'flyer', x: 17, y: 5, dir: 1 },
      { t: 'mine', x: 26, y: 20 }
    ]
  };

  /* 1.3 — капсула скафандра */
  const S1_3 = {
    name: { ru: 'Капсула скафандра', en: 'Exo pod' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                           =====',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                     #######    ',
      '     ====            #######=== ',
      '                 ### #######    ',
      '                 ### #######    ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'exo', x: 24, y: 16 },
      { t: 'teleporter', x: 12, y: 20, group: 1 },
      { t: 'teleporter', x: 29, y: 8, group: 1 },
      { t: 'walker', x: 15, y: 20, dir: -1, range: 3 },
      { t: 'walker', x: 26, y: 16, dir: -1, range: 1 },
      { t: 'flyer', x: 8, y: 7, dir: 1 },
      { t: 'flyer', x: 23, y: 4, dir: -1 },
      { t: 'mine', x: 10, y: 20 },
      { t: 'power_laser', x: 27, y: 8 }
    ]
  };

  /* 1.4 — мёртвый сектор */
  const S1_4 = {
    name: { ru: 'Мёртвый сектор', en: 'Dead sector' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '         ====                   ',
      '                                ',
      '                                ',
      '   =====                        ',
      '                                ',
      '             ##     ##          ',
      '###########################%%%##',
      '###########################   ##',
      '################################',
    ],
    entities: [
      { t: 'walker', x: 6, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 17, y: 20, dir: -1, range: 2 },
      { t: 'flyer', x: 10, y: 8, dir: 1 },
      { t: 'flyer', x: 24, y: 6, dir: -1 },
      { t: 'mine', x: 11, y: 20 },
      { t: 'power_rocket', x: 28, y: 22 }
    ]
  };

  /* 1.5 — стартовая площадка */
  const S1_5 = {
    name: { ru: 'Стартовая площадка', en: 'Launch pad' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '        ======                  ',
      '                                ',
      '                                ',
      '    =====               ########',
      '                      ##########',
      '                      ##########',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'double_launcher', x: 10, y: 14 },
      { t: 'walker', x: 9, y: 20, dir: -1, range: 4 },
      { t: 'walker', x: 14, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 20, y: 20, dir: -1, range: 2 },
      { t: 'flyer', x: 7, y: 6, dir: 1 },
      { t: 'flyer', x: 21, y: 5, dir: -1 },
      { t: 'mine', x: 16, y: 20 }
    ]
  };

  /* 2.1 — вход в пещеры */
  const S2_1 = {
    name: { ru: 'Вход в пещеры', en: 'Cave mouth' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '#############       ############',
      '     #####             #####    ',
      '     #####             #####    ',
      '     ####              #####    ',
      '     ####              #####    ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '          =====                 ',
      '                                ',
      '                                ',
      '    =====        ======         ',
      '                                ',
      '            ##                  ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'walker', x: 7, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 17, y: 20, dir: -1, range: 3 },
      { t: 'walker', x: 26, y: 20, dir: -1, range: 3 },
      { t: 'flyer', x: 14, y: 10, dir: 1 },
      { t: 'mine', x: 21, y: 20 }
    ]
  };

  /* 2.2 — грот шипов */
  const S2_2 = {
    name: { ru: 'Грот шипов', en: 'Spike grotto' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '   #######                      ',
      '   #######                      ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '   =====          ======        ',
      '                                ',
      '                                ',
      '#####  #####^^^#################',
      '#####  #########################',
      '#####^^#########################',
    ],
    entities: [
      { t: 'walker', x: 8, y: 20, dir: 1, range: 2 },
      { t: 'walker', x: 17, y: 20, dir: -1, range: 2 },
      { t: 'walker', x: 25, y: 20, dir: -1, range: 4 },
      { t: 'flyer', x: 10, y: 9, dir: 1 },
      { t: 'flyer', x: 19, y: 5, dir: -1 },
      { t: 'mine', x: 28, y: 20 },
      { t: 'power_laser', x: 21, y: 17 }
    ]
  };

  /* 2.3 — грот капсулы */
  const S2_3 = {
    name: { ru: 'Грот капсулы', en: 'Pod grotto' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '    ######                      ',
      '    ######                      ',
      '                                ',
      '                                ',
      '                                ',
      '                          ======',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                      ##########',
      '                    ############',
      '                  ##############',
      '                  ##############',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'exo', x: 26, y: 16 },
      { t: 'teleporter', x: 11, y: 20, group: 1 },
      { t: 'teleporter', x: 29, y: 6, group: 1 },
      { t: 'combo_launcher', x: 26, y: 6 },
      { t: 'walker', x: 7, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 15, y: 20, dir: -1, range: 1 },
      { t: 'flyer', x: 19, y: 9, dir: 1 },
      { t: 'flyer', x: 25, y: 8, dir: -1 },
      { t: 'mine', x: 17, y: 20 }
    ]
  };

  /* 2.4 — обвал */
  const S2_4 = {
    name: { ru: 'Обвал', en: 'Rockfall' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '  #####                         ',
      '  #####                         ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '          ====                  ',
      '                                ',
      '                                ',
      '   ====          ======         ',
      '                                ',
      '         ##   ###               ',
      '##########################%%%###',
      '##########################   ###',
      '################################',
    ],
    entities: [
      { t: 'tank', x: 20, y: 20, dir: -1 },
      { t: 'walker', x: 6, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 24, y: 20, dir: -1, range: 2 },
      { t: 'flyer', x: 12, y: 8, dir: 1 },
      { t: 'mine', x: 11, y: 20 },
      { t: 'power_rocket', x: 27, y: 22 }
    ]
  };

  /* 2.5 — выход из пещер */
  const S2_5 = {
    name: { ru: 'Выход из пещер', en: 'Cave exit' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '   #####                        ',
      '   #####                        ',
      '   #####                        ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '           =====                ',
      '                                ',
      '                                ',
      '   =====                 #######',
      '                     ##  #######',
      '                     ##  #######',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'double_launcher', x: 5, y: 17 },
      { t: 'turret', x: 14, y: 20 },
      { t: 'homer', x: 13, y: 14 },
      { t: 'walker', x: 9, y: 20, dir: -1, range: 3 },
      { t: 'walker', x: 19, y: 20, dir: 1, range: 2 },
      { t: 'flyer', x: 11, y: 8, dir: 1 },
      { t: 'mine', x: 8, y: 20 }
    ]
  };

  /* 3.1 — техэтаж */
  const S3_1 = {
    name: { ru: 'Техэтаж', en: 'Service deck' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '              #######           ',
      '         ==== #######           ',
      '                                ',
      '                           #####',
      '    ====                   #####',
      '                        ## #####',
      '             ###        ##      ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'crusher', x: 16, y: 17 },
      { t: 'turret', x: 10, y: 14 },
      { t: 'turret', x: 17, y: 20 },
      { t: 'walker', x: 20, y: 20, dir: -1, range: 2 },
      { t: 'walker', x: 28, y: 16, dir: -1, range: 1 },
      { t: 'flyer', x: 11, y: 8, dir: 1 },
      { t: 'mine', x: 23, y: 20 }
    ]
  };

  /* 3.2 — шахта */
  const S3_2 = {
    name: { ru: 'Шахта', en: 'The shaft' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '      ##########################',
      '   ===##########################',
      '                                ',
      '                                ',
      '   ===                          ',
      '                                ',
      '                    ######      ',
      '   === =====        ######      ',
      '                                ',
      '                                ',
      '   ===            ======        ',
      '                                ',
      '                                ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'crusher', x: 22, y: 17 },
      { t: 'tank', x: 20, y: 20, dir: -1 },
      { t: 'turret', x: 15, y: 7 },
      { t: 'walker', x: 8, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 28, y: 20, dir: -1, range: 3 },
      { t: 'flyer', x: 12, y: 10, dir: 1 },
      { t: 'mine', x: 26, y: 20 },
      { t: 'power_laser', x: 13, y: 7 }
    ]
  };

  /* 3.3 — капсула реактора */
  const S3_3 = {
    name: { ru: 'Капсула реактора', en: 'Reactor pod' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                           =====',
      '                                ',
      '                                ',
      '                                ',
      '                      ########  ',
      '                                ',
      '                                ',
      '                                ',
      '                  ###           ',
      '               ## ###==         ',
      '               ## ###           ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'exo', x: 19, y: 17 },
      { t: 'teleporter', x: 25, y: 20, group: 2 },
      { t: 'teleporter', x: 29, y: 9, group: 2 },
      { t: 'double_launcher', x: 27, y: 9 },
      { t: 'crusher', x: 24, y: 16 },
      { t: 'crusher', x: 28, y: 16 },
      { t: 'turret', x: 6, y: 20 },
      { t: 'walker', x: 8, y: 20, dir: 1, range: 3 },
      { t: 'flyer', x: 13, y: 9, dir: -1 },
      { t: 'mine', x: 11, y: 20 }
    ]
  };

  /* 3.4 — шиповой коридор */
  const S3_4 = {
    name: { ru: 'Шиповой коридор', en: 'Spike run' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '           ====                 ',
      '                                ',
      '                                ',
      '    ====            ====        ',
      '                                ',
      '                                ',
      '########^^#####^^^#########%%%##',
      '###########################   ##',
      '################################',
    ],
    entities: [
      { t: 'turret', x: 24, y: 20 },
      { t: 'homer', x: 13, y: 8 },
      { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
      { t: 'walker', x: 20, y: 20, dir: -1, range: 1 },
      { t: 'walker', x: 29, y: 20, dir: -1, range: 1 },
      { t: 'flyer', x: 21, y: 5, dir: -1 },
      { t: 'power_rocket', x: 28, y: 22 }
    ]
  };

  /* 3.5 — к шлюзу */
  const S3_5 = {
    name: { ru: 'К шлюзу', en: 'To the airlock' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '        ############            ',
      '        ############            ',
      '                                ',
      '                                ',
      '   ====                    #####',
      '                        ## #####',
      '                        ## #####',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'crusher', x: 10, y: 17 },
      { t: 'crusher', x: 16, y: 17 },
      { t: 'tank', x: 21, y: 20, dir: -1 },
      { t: 'turret', x: 11, y: 20 },
      { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
      { t: 'flyer', x: 20, y: 8, dir: -1 },
      { t: 'mine', x: 23, y: 20 }
    ]
  };

  /* 4.1 — коконовый зал */
  const S4_1 = {
    name: { ru: 'Коконовый зал', en: 'Cocoon hall' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '   #######                      ',
      '   #######                      ',
      '   #######                      ',
      '   #######                      ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '      =====         =====       ',
      '                                ',
      '                xx           xx ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'pod', x: 8, y: 17 },
      { t: 'pod', x: 22, y: 17 },
      { t: 'walker', x: 6, y: 20, dir: 1, range: 2 },
      { t: 'walker', x: 27, y: 20, dir: -1, range: 3 },
      { t: 'swarmer', x: 17, y: 10 },
      { t: 'swarmer', x: 15, y: 5 },
      { t: 'mine', x: 13, y: 20 }
    ]
  };

  /* 4.2 — органические шахты */
  const S4_2 = {
    name: { ru: 'Органические шахты', en: 'Hive shafts' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '             =====              ',
      '                                ',
      '                                ',
      '          =====                 ',
      '                                ',
      '                                ',
      '       ====                     ',
      '                                ',
      '                                ',
      '    ====                        ',
      '                                ',
      '    xx                          ',
      '####################  ##########',
      '####################  ##########',
      '####################^^##########',
    ],
    entities: [
      { t: 'pod', x: 5, y: 17 },
      { t: 'pod', x: 8, y: 14 },
      { t: 'pod', x: 11, y: 11 },
      { t: 'walker', x: 14, y: 20, dir: 1, range: 3 },
      { t: 'walker', x: 26, y: 20, dir: -1, range: 3 },
      { t: 'flyer', x: 26, y: 9, dir: -1 },
      { t: 'swarmer', x: 16, y: 5 },
      { t: 'swarmer', x: 23, y: 12 },
      { t: 'power_laser', x: 16, y: 8 }
    ]
  };

  /* 4.3 — капсула улья */
  const S4_3 = {
    name: { ru: 'Капсула улья', en: 'Hive pod' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                          ======',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                    ############',
      '                 ## ############',
      '  xx             ## ############',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'exo', x: 22, y: 17 },
      { t: 'teleporter', x: 13, y: 20, group: 3 },
      { t: 'teleporter', x: 29, y: 7, group: 3 },
      { t: 'combo_launcher', x: 27, y: 7 },
      { t: 'pod', x: 5, y: 20 },
      { t: 'pod', x: 24, y: 17 },
      { t: 'walker', x: 10, y: 20, dir: 1, range: 2 },
      { t: 'flyer', x: 9, y: 6, dir: 1 },
      { t: 'swarmer', x: 15, y: 8 },
      { t: 'swarmer', x: 18, y: 12 },
      { t: 'mine', x: 15, y: 20 }
    ]
  };

  /* 4.4 — плотный рой */
  const S4_4 = {
    name: { ru: 'Плотный рой', en: 'The swarm' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '            =====               ',
      '                                ',
      '                                ',
      '     =====          =====       ',
      '                                ',
      '  xx      xx                    ',
      '#########################%%%####',
      '#########################   ####',
      '################################',
    ],
    entities: [
      { t: 'pod', x: 7, y: 17 },
      { t: 'pod', x: 14, y: 14 },
      { t: 'pod', x: 22, y: 17 },
      { t: 'walker', x: 6, y: 20, dir: 1, range: 2 },
      { t: 'walker', x: 29, y: 20, dir: -1, range: 2 },
      { t: 'swarmer', x: 11, y: 9 },
      { t: 'swarmer', x: 17, y: 7 },
      { t: 'swarmer', x: 24, y: 12 },
      { t: 'power_rocket', x: 26, y: 22 }
    ]
  };

  /* 4.5 — матка */
  const S4_5 = {
    name: { ru: 'Матка', en: 'The queen' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                        ########',
      '                        ########',
      '      =======          #########',
      '                     ###########',
      '    xx      xx       ###        ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'double_launcher', x: 10, y: 17 },
      { t: 'pod', x: 15, y: 20 },
      { t: 'pod', x: 26, y: 15 },
      { t: 'homer', x: 29, y: 8 },
      { t: 'walker', x: 6, y: 20, dir: 1, range: 2 },
      { t: 'walker', x: 18, y: 20, dir: -1, range: 1 },
      { t: 'swarmer', x: 6, y: 8 },
      { t: 'swarmer', x: 16, y: 10 },
      { t: 'swarmer', x: 19, y: 5 }
    ]
  };

  /* 5.1 — вход в ядро */
  const S5_1 = {
    name: { ru: 'Вход в ядро', en: 'Core entry' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                      =====     ',
      '                                ',
      '                                ',
      '          ###########           ',
      '          ###########           ',
      '                                ',
      '                                ',
      '      ====                      ',
      '                                ',
      '                         ##     ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'crusher', x: 13, y: 17 },
      { t: 'crusher', x: 17, y: 17 },
      { t: 'tank', x: 28, y: 20, dir: -1 },
      { t: 'turret', x: 8, y: 20 },
      { t: 'walker', x: 11, y: 20, dir: 1, range: 1 },
      { t: 'walker', x: 21, y: 20, dir: -1, range: 2 },
      { t: 'flyer', x: 15, y: 8, dir: 1 },
      { t: 'swarmer', x: 23, y: 6 },
      { t: 'mine', x: 15, y: 20 }
    ]
  };

  /* 5.2 — шлюз */
  const S5_2 = {
    name: { ru: 'Шлюз', en: 'The gate' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '            =====               ',
      '                                ',
      '     ######                     ',
      '     ######      =====          ',
      '                                ',
      '                                ',
      '            ====                ',
      '                                ',
      '                                ',
      '########^^^######^^^############',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'crusher', x: 5, y: 17 },
      { t: 'tank', x: 23, y: 20, dir: -1 },
      { t: 'turret', x: 13, y: 20 },
      { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
      { t: 'walker', x: 28, y: 20, dir: 1, range: 2 },
      { t: 'flyer', x: 11, y: 7, dir: -1 },
      { t: 'swarmer', x: 16, y: 10 },
      { t: 'swarmer', x: 21, y: 5 },
      { t: 'mine', x: 15, y: 20 },
      { t: 'power_laser', x: 19, y: 14 }
    ]
  };

  /* 5.3 — капсула ядра */
  const S5_3 = {
    name: { ru: 'Капсула ядра', en: 'Core pod' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                           =====',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '            #######             ',
      '            #######             ',
      '                                ',
      '                                ',
      '                    =====       ',
      '                                ',
      '                                ',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'exo', x: 22, y: 17 },
      { t: 'teleporter', x: 8, y: 20, group: 1 },
      { t: 'teleporter', x: 29, y: 6, group: 1 },
      { t: 'combo_launcher', x: 27, y: 6 },
      { t: 'crusher', x: 14, y: 17 },
      { t: 'crusher', x: 17, y: 17 },
      { t: 'tank', x: 27, y: 20, dir: -1 },
      { t: 'pod', x: 5, y: 20 },
      { t: 'walker', x: 12, y: 20, dir: 1, range: 2 },
      { t: 'flyer', x: 8, y: 5, dir: 1 },
      { t: 'swarmer', x: 20, y: 6 },
      { t: 'swarmer', x: 24, y: 9 },
      { t: 'mine', x: 16, y: 20 }
    ]
  };

  /* 5.4 — сердце ядра */
  const S5_4 = {
    name: { ru: 'Сердце ядра', en: 'Core heart' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '              #######           ',
      '              #######           ',
      '                                ',
      '                                ',
      '   ====                   ===== ',
      '                                ',
      '                                ',
      '#########^^^##########%%%#######',
      '######################   #######',
      '################################',
    ],
    entities: [
      { t: 'crusher', x: 16, y: 17 },
      { t: 'crusher', x: 19, y: 17 },
      { t: 'tank', x: 28, y: 20, dir: -1 },
      { t: 'turret', x: 13, y: 20 },
      { t: 'turret', x: 21, y: 20 },
      { t: 'walker', x: 5, y: 20, dir: 1, range: 2 },
      { t: 'flyer', x: 30, y: 6, dir: -1 },
      { t: 'swarmer', x: 12, y: 8 },
      { t: 'swarmer', x: 17, y: 6 },
      { t: 'swarmer', x: 25, y: 10 },
      { t: 'swarmer', x: 6, y: 12 },
      { t: 'power_rocket', x: 23, y: 22 }
    ]
  };

  /* 5.5 — последний рубеж */
  const S5_5 = {
    name: { ru: 'Последний рубеж', en: 'Last stand' },
    spawn: { x: 1, y: 20 },
    tiles: [
      //   01234567890123456789012345678901
      '################################',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '                                ',
      '             #####              ',
      '        #####                   ',
      '                                ',
      '                                ',
      '                        ########',
      '                  ##### ########',
      ' ===         ########## ########',
      '        ############### ########',
      '      ################# ########',
      '################################',
      '################################',
      '################################',
    ],
    entities: [
      { t: 'double_launcher', x: 2, y: 17 },
      { t: 'crusher', x: 10, y: 15 },
      { t: 'crusher', x: 15, y: 14 },
      { t: 'turret', x: 28, y: 15 },
      { t: 'pod', x: 15, y: 17 },
      { t: 'pod', x: 20, y: 16 },
      { t: 'homer', x: 19, y: 10 },
      { t: 'flyer', x: 12, y: 6 },
      { t: 'flyer', x: 30, y: 8 },
      { t: 'swarmer', x: 7, y: 10 },
      { t: 'swarmer', x: 9, y: 8 },
      { t: 'swarmer', x: 20, y: 6 },
      { t: 'swarmer', x: 27, y: 10 }
    ]
  };

  window.PR_LEVELS = [
  /* ======================= СЕКТОР 1: ВНЕШНИЙ ПЕРИМЕТР / OUTER PERIMETER ======================= */
  {
    id: 0,
    name: { ru: 'ВНЕШНИЙ ПЕРИМЕТР', en: 'OUTER PERIMETER' },
    theme: 'space',
    intro: {
      ru: 'Орбитальный периметр станции. Патрули, мины, обрыв.\nПробейся к шлюзу.',
      en: 'Orbital perimeter of the station. Patrols, mines, the drop.\nFight your way to the airlock.'
    },
    screens: [S1_1, S1_2, S1_3, S1_4, S1_5]
  },

  /* ======================= СЕКТОР 2: ПЕЩЕРЫ / THE CAVES ======================= */
  {
    id: 1,
    name: { ru: 'ПЕЩЕРЫ', en: 'THE CAVES' },
    theme: 'cavern',
    intro: {
      ru: 'Подземные гроты: камни рушатся, тьма шевелится.\nКапсула скафандра ждёт внутри.',
      en: 'Underground grottos: rocks fall, the dark moves.\nThe exoskeleton pod waits inside.'
    },
    screens: [S2_1, S2_2, S2_3, S2_4, S2_5]
  },

  /* ======================= СЕКТОР 3: РЕАКТОР / REACTOR ======================= */
  {
    id: 2,
    name: { ru: 'РЕАКТОР', en: 'REACTOR' },
    theme: 'reactor',
    intro: {
      ru: 'Сердце станции: этажи, пушки и пневмомолоты.\nДержи ритм — или тебя расплющит.',
      en: 'The station heart: decks, guns and piston hammers.\nKeep the rhythm — or get flattened.'
    },
    screens: [S3_1, S3_2, S3_3, S3_4, S3_5]
  },

  /* ======================= СЕКТОР 4: УЛЕЙ / THE HIVE ======================= */
  {
    id: 3,
    name: { ru: 'УЛЕЙ', en: 'THE HIVE' },
    theme: 'hive',
    intro: {
      ru: 'Коконы вскрываются один за другим.\nРой идёт за тобой, живой коридор сжимается.',
      en: 'Cocoons crack open one by one.\nThe swarm follows, the living corridor closes in.'
    },
    screens: [S4_1, S4_2, S4_3, S4_4, S4_5]
  },

  /* ======================= СЕКТОР 5: ЯДРО / THE CORE ======================= */
  {
    id: 4,
    name: { ru: 'ЯДРО', en: 'THE CORE' },
    theme: 'core',
    intro: {
      ru: 'Ядро. Здесь всё против тебя: молоты, пушки, рой.\nДойди до выхода и выбери награду.',
      en: 'The core. Everything is against you: hammers, guns, swarm.\nReach the exit and choose your reward.'
    },
    screens: [S5_1, S5_2, S5_3, S5_4, S5_5]
  }

  ];
})();

/* ==== src/game.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — ядро игры
   Оригинальная механика жанра (студия «Гефест»)
   256×192 поле + 16 px HUD, тайл 8 px, 32×24 тайла.
   Здесь: настройки, уровни/экраны, физика, враги, оружие,
   состояние (меню/брифинг/игра/бонус), ввод, счёт, тесты.
   ============================================================ */
(function () {
  'use strict';

  const TILE = 8;
  const COLS = 32;
  const ROWS = 24;
  const W = COLS * TILE;          // 256
  const H = ROWS * TILE;          // 192
  const HUD = 16;
  const VH = H + HUD;             // 208

  /* тайлы */
  const T_EMPTY = 0, T_SOLID = 1, T_THIN = 2, T_ROCK = 3, T_SPIKE = 4, T_FLORA = 5;
  const TILE_CHARS = { ' ': T_EMPTY, '#': T_SOLID, '=': T_THIN, '%': T_ROCK, '^': T_SPIKE, 'x': T_FLORA };

  /* 8-битная палитра из 15 цветов */
  const PAL = {
    black: '#000000', blue: '#0000d7', red: '#d70000', magenta: '#d700d7',
    green: '#00d700', cyan: '#00d7d7', yellow: '#d7d700', white: '#d7d7d7',
    bblue: '#0000ff', bred: '#ff0000', bmagenta: '#ff00ff', bgreen: '#00ff00',
    bcyan: '#00ffff', byellow: '#ffff00', bwhite: '#ffffff'
  };
  /* современная неоновая палитра */
  const NEON = {
    void: '#05030f', deep: '#0b0820', panel: 'rgba(14,10,32,0.72)',
    cyan: '#39f6ff', lime: '#b6ff3c', magenta: '#ff3ff0', violet: '#8a5cff',
    amber: '#ffcc55', red: '#ff4d6d', white: '#f2f0ff', dim: '#7c74a8'
  };

  /* ---------- ГСЧ ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

  /* ---------- настройки ---------- */
  const DEFAULTS = { lang: 'ru', gfx: 'retro', music: true, sfx: true, crt: true };
  const SETTINGS_KEY = 'proryv.settings';
  const RECORD_KEY = 'proryv.record';
  /* Устаревшие ключи (до переименования игры) — только для однократной миграции:
     старый → новый (если нового ещё нет) → удалить старый. */
  const LEGACY_KEYS = [['exolon.settings', SETTINGS_KEY], ['exolon.record', RECORD_KEY]];
  function migrateStorage() {
    try {
      LEGACY_KEYS.forEach(function (pair) {
        const v = localStorage.getItem(pair[0]);
        if (v == null) return;
        if (localStorage.getItem(pair[1]) == null) localStorage.setItem(pair[1], v);
        localStorage.removeItem(pair[0]);
      });
    } catch (e) { /* приватный режим */ }
  }
  migrateStorage();

  function parseHash() {
    const out = {};
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return out;
    raw.split('&').forEach((pair) => {
      const i = pair.indexOf('=');
      if (i < 0) out[pair] = true;
      else out[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
    });
    return out;
  }
  const HASH = parseHash();

  function loadSettings() {
    const s = Object.assign({}, DEFAULTS);
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch (e) { /* приватный режим */ }
    /* RETRO — режим по умолчанию всегда: выбор графики живёт только в рамках сессии,
       чтобы после перезапуска игра снова открывалась в аутентичном 8-битном стиле. */
    s.gfx = 'retro';
    if (HASH.lang === 'en' || HASH.lang === 'ru') s.lang = HASH.lang;
    if (HASH.gfx === 'modern' || HASH.gfx === 'retro') s.gfx = HASH.gfx;
    if (HASH.nosound) { s.music = false; s.sfx = false; }
    if (s.gfx !== 'modern') s.gfx = 'retro';
    if (s.lang !== 'en') s.lang = 'ru';
    return s;
  }

  const PR = (window.PR = window.PR || {});
  PR.HASH = HASH;
  PR.TILE = TILE; PR.COLS = COLS; PR.ROWS = ROWS; PR.W = W; PR.H = H;
  PR.HUD = HUD; PR.VH = VH; PR.PAL = PAL; PR.NEON = NEON;
  PR.TILES = { EMPTY: T_EMPTY, SOLID: T_SOLID, THIN: T_THIN, ROCK: T_ROCK, SPIKE: T_SPIKE, FLORA: T_FLORA };
  PR.clamp = clamp;
  PR.settings = loadSettings();

  PR.t = function (key, vars) { return window.PR_T(key, vars); };
  PR.saveSettings = function () {
    try {
      /* gfx не сохраняем: при каждом запуске — RETRO, переключение только на сессию */
      const toSave = {
        lang: PR.settings.lang,
        music: PR.settings.music,
        sfx: PR.settings.sfx,
        crt: PR.settings.crt
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave));
    } catch (e) { /* ok */ }
  };
  PR.loadRecord = function () {
    try { return parseInt(localStorage.getItem(RECORD_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  };
  PR.saveRecord = function (v) {
    try { localStorage.setItem(RECORD_KEY, String(v | 0)); } catch (e) { /* ok */ }
  };

  /* ---------- аудио-хелперы (модуль может быть заглушкой) ---------- */
  const A = () => window.PR_AUDIO;
  function snd(id) { try { const a = A(); if (a && a.sfx) a.sfx(id); } catch (e) { /* ok */ } }
  function music(id) { try { const a = A(); if (a && a.playMusic) a.playMusic(id); } catch (e) { /* ok */ } }
  function duck(on) { try { const a = A(); if (a && a.duck) a.duck(on); } catch (e) { /* ok */ } }
  function intensity(v) { try { const a = A(); if (a && a.setIntensity) a.setIntensity(v); } catch (e) { /* ok */ } }

  /* ============================================================
     ВВОД
     main.js пишет сюда состояния; ядро читает и потребляет actions.
     ============================================================ */
  const input = PR.input = {
    left: false, right: false, up: false, down: false, fire: false,
    actions: [],              // строки: 'enter','escape','pause','lang','gfx','music','sfx','restart','fullscreen','action'
    pointer: { x: -1, y: -1, down: false, clicked: false },
    prevFire: false
  };
  PR.pushAction = function (a) { input.actions.push(a); };

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */
  const state = PR.state = {
    mode: 'boot',
    t: 0,                  // глобальное время, c
    screenT: 0,            // время на текущем экране
    level: 0,
    screen: 0,
    lives: 5,
    score: 0,
    record: 0,
    woreExo: false,
    menuIndex: 0,
    settingsIndex: 0,
    settingsReturn: 'title',
    player: null,
    ents: [],
    shots: [],
    eShots: [],
    particles: [],
    pops: [],
    booms: [],
    world: null,
    transition: 0,         // 0..1 прогресс флипа
    transDir: 1,
    bonus: null,
    message: null,
    deadTimer: 0,
    clearTimer: 0,
    fx: { shake: 0, flash: 0, flashColor: '#ffffff', chroma: 0, hitFlash: 0 },
    tips: 0,
    tutorial: 0,
    debug: {}
  };

  /* ============================================================
     УРОВНИ / ЭКРАНЫ
     ============================================================ */
  function levelData(i) {
    const L = window.PR_LEVELS || [];
    return L[clamp(i, 0, Math.max(0, L.length - 1))] || null;
  }
  PR.levelData = levelData;
  PR.levelCount = function () { return (window.PR_LEVELS || []).length; };
  PR.screenCount = function (li) { const l = levelData(li); return l ? l.screens.length : 0; };

  const TIDX = (x, y) => y * COLS + x;
  const world = (window.PR_WORLD = window.PR_WORLD || {});

  function tileIdAt(tx, ty) {
    const w = state.world;
    if (!w) return T_EMPTY;
    if (tx < 0 || tx >= COLS) return T_EMPTY;
    if (ty >= ROWS) return T_SOLID;       // ниже экрана — пол
    if (ty < 0) return T_EMPTY;
    return w.tiles[TIDX(tx, ty)];
  }
  PR.tileAt = tileIdAt;

  function isBlocking(tx, ty) {
    const t = tileIdAt(tx, ty);
    return t === T_SOLID || t === T_ROCK;
  }
  PR.isBlocking = isBlocking;

  function findSpawn(tiles) {
    for (let y = ROWS - 2; y >= 0; y--) {
      for (let x = 1; x < COLS - 1; x++) {
        const t = tiles[TIDX(x, y)];
        const below = tiles[TIDX(x, y + 1)];
        if ((t === T_EMPTY || t === T_FLORA) && (below === T_SOLID || below === T_THIN)) {
          return { x: x * TILE, y: (y + 1) * TILE - 18 };
        }
      }
    }
    return { x: 16, y: 96 };
  }

  function loadScreen(level, screen, opts) {
    opts = opts || {};
    const lv = levelData(level);
    if (!lv) return;
    const def = lv.screens[clamp(screen, 0, lv.screens.length - 1)];
    state.level = level;
    state.screen = screen;
    state.woreExo = state.woreExo && !!opts.keepExo;
    state.screenT = 0;
    state.transition = 0;
    state.ents = [];
    state.shots = [];
    state.eShots = [];
    state.particles = [];
    state.pops = [];
    state.booms = [];
    state.fx.shake = 0;
    state.fx.flash = 0;
    state.bonus = null;
    state.tutorial = 0;

    const tiles = new Uint8Array(COLS * ROWS);
    const rows = def.tiles || [];
    for (let y = 0; y < ROWS; y++) {
      const row = rows[y] || '';
      for (let x = 0; x < COLS; x++) {
        const ch = row[x] || ' ';
        tiles[TIDX(x, y)] = TILE_CHARS[ch] == null ? T_EMPTY : TILE_CHARS[ch];
      }
    }
    state.world = {
      tiles,
      level,
      screen,
      theme: lv.theme || 'space',
      name: def.name || null
    };
    if (opts.seed != null) state.world.seed = opts.seed;
    else state.world.seed = (level * 131 + screen * 17 + 7) | 0;

    /* сущности */
    (def.entities || []).forEach(function (d) { addEntity(d); });

    /* игрок */
    if (!state.player || opts.fresh) {
      state.player = makePlayer();
    }
    const sp = def.spawn ? { x: def.spawn.x * TILE, y: (def.spawn.y + 1) * TILE - 18 } : findSpawn(tiles);
    const p = state.player;
    p.x = sp.x; p.y = sp.y;
    p.vx = 0; p.vy = 0;
    p.onGround = false;
    p.duck = false;
    p.alive = true;
    p.invuln = opts.invuln != null ? opts.invuln : 1.2;
    p.fireHeld = 0;
    p.cool = 0;
    p.didGrenade = false;
    if (opts.freshAmmo) { p.laser = 60; p.rockets = 2; }
    if (opts.keepExo) { p.exo = true; p.armor = 3; } else if (!opts.keepExo) { p.exo = false; p.armor = 0; }
  }
  PR.loadScreen = loadScreen;

  function makePlayer() {
    return {
      x: 16, y: 100, w: 10, h: 16, vx: 0, vy: 0,
      dir: 1, facing: 1, onGround: false, duck: false,
      laser: 60, maxLaser: 100, rockets: 2, maxRockets: 6,
      exo: false, armor: 0, invuln: 1.5, alive: true,
      fireHeld: 0, cool: 0, didGrenade: false, coyote: 0, jumpBuf: 0,
      anim: 0, step: 0, air: 0, hitT: 0
    };
  }
  PR.makePlayer = makePlayer;

  /* ============================================================
     СУЩНОСТИ
     ============================================================ */
  const ENEMY = {
    walker: { w: 14, h: 12, hp: 1, score: 150, blast: true, grenade: true },
    flyer: { w: 16, h: 12, hp: 1, score: 150, blast: true, grenade: true },
    swarmer: { w: 8, h: 8, hp: 1, score: 50, blast: true, grenade: true },
    turret: { w: 12, h: 10, hp: 1, score: 150, blast: false, grenade: true },
    tank: { w: 16, h: 12, hp: 2, score: 200, blast: false, grenade: true },
    mine: { w: 8, h: 6, hp: 1, score: 50, blast: true, grenade: true },
    crusher: { w: 16, h: 16, hp: 999, score: 0, blast: false, grenade: false },
    pod: { w: 14, h: 12, hp: 1, score: 150, blast: false, grenade: true },
    homer: { w: 14, h: 12, hp: 3, score: 1000, blast: true, grenade: true },
    double_launcher: { w: 12, h: 16, hp: 1, score: 2000, blast: false, grenade: false },
    combo_launcher: { w: 14, h: 16, hp: 1, score: 3000, blast: false, grenade: false },
    power_laser: { w: 8, h: 8, hp: 1, score: 0, blast: false, grenade: false },
    power_rocket: { w: 8, h: 8, hp: 1, score: 0, blast: false, grenade: false },
    exo: { w: 16, h: 20, hp: 1, score: 0, blast: false, grenade: false },
    teleporter: { w: 12, h: 16, hp: 1, score: 0, blast: false, grenade: false }
  };
  PR.ENEMY = ENEMY;

  function addEntity(d) {
    const spec = ENEMY[d.t];
    if (!spec) return null;
    const e = {
      t: d.t,
      x: d.x * TILE, y: (d.y + 1) * TILE - spec.h,
      w: spec.w, h: spec.h,
      vx: 0, vy: 0,
      dir: d.dir != null ? d.dir : -1,
      hp: d.hp != null ? d.hp : spec.hp,
      range: (d.range != null ? d.range : 4) * TILE,
      phase: d.phase != null ? d.phase : Math.random(),
      group: d.group || 0,
      flip: !!d.flip,
      homeX: d.x * TILE, homeY: (d.y + 1) * TILE - spec.h,
      baseY: (d.y + 1) * TILE - spec.h,
      timer: d.t === 'teleporter' ? 0 : 0.4 + Math.random() * 1.2,
      anim: 0, dead: false, hitT: 0, state: 0, used: false,
      score: spec.score
    };
    state.ents.push(e);
    return e;
  }
  PR.addEntity = addEntity;

  /* ============================================================
     ФИЗИКА
     ============================================================ */
  function moveBody(e, dt) {
    const tiles = state.world ? state.world.tiles : null;
    if (!tiles) return;
    /* X */
    if (e.vx) {
      e.x += e.vx * dt;
      const y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.01) / TILE);
      if (e.vx > 0) {
        const tx = Math.floor((e.x + e.w - 0.01) / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          if (isBlocking(tx, ty)) { e.x = tx * TILE - e.w; e.vx = 0; break; }
        }
      } else {
        const tx = Math.floor(e.x / TILE);
        for (let ty = y0; ty <= y1; ty++) {
          if (isBlocking(tx, ty)) { e.x = (tx + 1) * TILE; e.vx = 0; break; }
        }
      }
      if (e.x < 0) { e.x = 0; e.vx = 0; }
      if (e.x > W - e.w) { e.x = W - e.w; e.vx = 0; }
    }
    /* Y */
    const prevBottom = e.y + e.h;
    e.y += e.vy * dt;
    const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
    e.onGround = false;
    if (e.vy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileIdAt(tx, ty);
        const thin = t === T_THIN && prevBottom <= ty * TILE + 1.5;
        if (t === T_SOLID || t === T_ROCK || thin || ty >= ROWS) {
          e.y = ty * TILE - e.h; e.vy = 0; e.onGround = true; break;
        }
      }
    } else if (e.vy < 0) {
      const ty = Math.floor(e.y / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (isBlocking(tx, ty)) { e.y = (ty + 1) * TILE; e.vy = 0; break; }
      }
    }
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function entityBox(e) { return { x: e.x, y: e.y, w: e.w, h: e.h }; }
  function playerBox() {
    const p = state.player;
    const h = p.duck ? 10 : p.h;
    return { x: p.x, y: p.y + (p.h - h), w: p.w, h: h };
  }

  /* ============================================================
     ИГРОК
     ============================================================ */
  const PHYS = {
    speed: 78, accel: 700, airAccel: 520, friction: 900,
    gravity: 900, jump: -252, jumpCut: 0.42, maxFall: 420,
    duckSpeed: 32
  };
  PR.PHYS = PHYS;

  function updatePlayer(dt) {
    const p = state.player;
    if (!p || !p.alive) return;

    const wasFire = input.prevFire;
    input.prevFire = input.fire;

    if (p.invuln > 0) p.invuln -= dt;
    if (p.cool > 0) p.cool -= dt;
    if (p.hitT > 0) p.hitT -= dt;

    const duck = input.down && p.onGround && !p.exo;
    p.duck = duck;

    /* горизонталь */
    const maxSp = duck ? PHYS.duckSpeed : (p.exo ? PHYS.speed * 0.88 : PHYS.speed);
    const acc = p.onGround ? PHYS.accel : PHYS.airAccel;
    let want = 0;
    if (!duck) {
      if (input.left) want -= 1;
      if (input.right) want += 1;
    }
    if (want) {
      p.vx += want * acc * dt;
      p.vx = clamp(p.vx, -maxSp, maxSp);
      p.dir = want;
      p.facing = want;
    } else {
      const f = (p.onGround ? PHYS.friction : PHYS.airAccel * 0.5) * dt;
      if (Math.abs(p.vx) <= f) p.vx = 0; else p.vx -= sign(p.vx) * f;
    }

    /* прыжок */
    if (p.onGround) p.coyote = 0.09; else if (p.coyote > 0) p.coyote -= dt;
    if (input.up && !p.jumpHeld) p.jumpBuf = 0.12;
    p.jumpHeld = !!input.up;
    if (p.jumpBuf > 0) p.jumpBuf -= dt;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = PHYS.jump;
      p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
      snd('jump');
    }
    if (!input.up && p.vy < 0) p.vy *= 1 - (1 - PHYS.jumpCut) * clamp(dt * 22, 0, 1);

    /* гравитация */
    p.vy = clamp(p.vy + PHYS.gravity * dt, -600, PHYS.maxFall);
    p.air = p.onGround ? 0 : p.air + dt;

    const prevOnGround = p.onGround;
    moveBody(p, dt);
    if (!prevOnGround && p.onGround) {
      p.air = 0;
      if (p.invuln <= 0) snd('land');
    }

    /* анимация */
    p.anim += dt * (Math.abs(p.vx) > 6 ? 1 : 0);
    p.step = Math.abs(p.vx) > 6 ? (p.step + dt * 12) % 2 : 0;

    /* шипы */
    if (overlaps(playerBox(), { x: p.x, y: p.y, w: p.w, h: p.h })) {
      const b = playerBox();
      const tx0 = Math.floor(b.x / TILE), tx1 = Math.floor((b.x + b.w - 1) / TILE);
      const ty0 = Math.floor(b.y / TILE), ty1 = Math.floor((b.y + b.h - 1) / TILE);
      let spike = false;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (tileIdAt(tx, ty) === T_SPIKE) spike = true;
      }
      if (spike) hurtPlayer(1, 'spike');
    }

    /* оружие: клик — бластер, удержание — граната */
    const fireEdge = input.fire && !wasFire;
    const fireHeldNow = input.fire;
    if (fireEdge) {
      p.fireHeld = 0;
      p.didGrenade = false;
      fireBlaster();
    }
    if (fireHeldNow && input.fire) {
      p.fireHeld += dt;
      if (!p.didGrenade && p.fireHeld > 0.24) {
        p.didGrenade = true;
        throwGrenade();
      }
    }
    if (!input.fire) { p.fireHeld = 0; p.didGrenade = false; }
  }

  function fireBlaster() {
    const p = state.player;
    if (!p || !p.alive || p.cool > 0) return;
    if (p.laser < 4) { snd('deny'); return; }
    const b = playerBox();
    const dir = p.facing || 1;
    p.laser -= 4;
    p.cool = p.exo ? 0.085 : 0.17;
    const cx = dir > 0 ? b.x + b.w - 1 : b.x + 1;
    const cy = b.y + (p.duck ? 5 : 7);
    state.shots.push({ x: cx, y: cy, vx: dir * 320, vy: 0, w: 7, h: 2, life: 0.85, exo: p.exo });
    snd('laser');
    for (let i = 0; i < 2; i++) {
      state.particles.push({
        x: cx, y: cy, vx: -dir * (20 + Math.random() * 40), vy: (Math.random() - 0.5) * 30,
        life: 0.14, max: 0.14, size: 1.6, color: p.exo ? PAL.bcyan : PAL.byellow, grav: 0
      });
    }
    state.fx.shake = Math.max(state.fx.shake, 0.6);
  }

  function throwGrenade() {
    const p = state.player;
    if (!p || !p.alive) return;
    if (p.rockets <= 0) { snd('deny'); return; }
    p.rockets--;
    const b = playerBox();
    const dir = p.facing || 1;
    state.shots.push({
      x: dir > 0 ? b.x + b.w - 2 : b.x - 2, y: b.y + 4,
      vx: dir * 96 + p.vx * 0.3, vy: -212, w: 5, h: 5,
      life: 2.2, grenade: true, r: 0, spin: 0
    });
    snd('grenade');
  }

  /* ============================================================
     ВЫСТРЕЛЫ И ВРАЖЕСКИЕ СНАРЯДЫ
     ============================================================ */
  function updateShots(dt) {
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i];
      s.life -= dt;
      if (s.grenade) {
        s.vy += 620 * dt;
        s.vx *= 1 - 0.25 * dt;
        s.spin += dt * 12;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.life <= 0) { state.shots.splice(i, 1); continue; }
      if (s.x < -20 || s.x > W + 20 || s.y > H + 20 || s.y < -40) { state.shots.splice(i, 1); continue; }

      if (s.grenade) {
        const hitTerrain = tileIdAt(Math.floor(s.x / TILE), Math.floor((s.y + 4) / TILE)) === T_SOLID ||
          tileIdAt(Math.floor(s.x / TILE), Math.floor((s.y + 4) / TILE)) === T_ROCK ||
          tileIdAt(Math.floor(s.x / TILE), Math.floor((s.y + 4) / TILE)) === T_THIN;
        if (hitTerrain && s.life < 2.1) { explode(s.x, s.y, 22); state.shots.splice(i, 1); }
        else {
          /* дымный след */
          if (Math.random() < 0.5) {
            state.particles.push({
              x: s.x, y: s.y, vx: (Math.random() - 0.5) * 12, vy: -8 - Math.random() * 10,
              life: 0.4, max: 0.4, size: 1.8, color: PAL.white, grav: -6
            });
          }
        }
        continue;
      }

      /* попадание бластера по врагу */
      const sb = { x: s.x, y: s.y, w: s.w, h: s.h };
      let hit = false;
      for (let j = 0; j < state.ents.length; j++) {
        const e = state.ents[j];
        if (e.dead || e.t === 'teleporter') continue;
        if (!ENEMY[e.t] || !ENEMY[e.t].blast) continue;
        if (overlaps(sb, entityBox(e))) {
          damageEntity(e, 1, 'blast');
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (let j = 0; j < state.eShots.length; j++) {
          const es = state.eShots[j];
          if (es.missile && overlaps(sb, { x: es.x - 2, y: es.y - 2, w: 8, h: 8 })) {
            state.eShots.splice(j, 1);
            addScore(50, es.x, es.y);
            boom(es.x, es.y, 8, PAL.bred);
            burst(es.x, es.y, PAL.bred, 6);
            hit = true;
            break;
          }
        }
      }
      if (!hit && (tileIdAt(Math.floor(s.x / TILE), Math.floor(s.y / TILE)) === T_SOLID ||
        tileIdAt(Math.floor(s.x / TILE), Math.floor(s.y / TILE)) === T_ROCK)) {
        burst(s.x, s.y, PAL.byellow, 3);
        hit = true;
      }
      if (hit) state.shots.splice(i, 1);
    }
  }

  function updateEnemyShots(dt) {
    const p = state.player;
    for (let i = state.eShots.length - 1; i >= 0; i--) {
      const s = state.eShots[i];
      s.life -= dt;
      if (s.missile) {
        const tx = p.x + p.w / 2, ty = p.y + p.h / 2;
        const ang = Math.atan2(ty - s.y, tx - s.x);
        s.ang = s.ang == null ? ang : s.ang + clamp(((ang - s.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2.4 * dt, 2.4 * dt);
        s.x += Math.cos(s.ang) * 88 * dt;
        s.y += Math.sin(s.ang) * 88 * dt;
        s.spin = (s.spin || 0) + dt * 14;
      } else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      if (s.life <= 0 || s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) {
        state.eShots.splice(i, 1);
        continue;
      }
      const box = { x: s.x - 3, y: s.y - 3, w: 6, h: 6 };
      if (overlaps(box, playerBox())) {
        hurtPlayer(1, 'shot');
        state.eShots.splice(i, 1);
        continue;
      }
      if (isBlocking(Math.floor(s.x / TILE), Math.floor(s.y / TILE))) {
        burst(s.x, s.y, PAL.magenta, 3);
        state.eShots.splice(i, 1);
      }
    }
  }

  /* ============================================================
     ВЗРЫВ / ЭФФЕКТЫ / СЧЁТ
     ============================================================ */
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 0.25 + Math.random() * 0.4, max: 0.65, size: 1.2 + Math.random() * 1.6,
        color, grav: 180
      });
    }
  }
  function boom(x, y, r, color) {
    state.booms.push({ x, y, r, t: 0, dur: 0.32, color: color || PAL.byellow });
  }

  function explode(x, y, radius) {
    boom(x, y, radius, PAL.byellow);
    burst(x, y, PAL.byellow, 14);
    burst(x, y, PAL.bred, 8);
    state.fx.shake = Math.max(state.fx.shake, 5);
    state.fx.flash = Math.max(state.fx.flash, 0.22);
    state.fx.flashColor = PAL.byellow;
    snd('explosion');
    /* разрушаемые тайлы */
    const r = 2;
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    for (let ty = cy - r; ty <= cy + r; ty++) {
      for (let tx = cx - r; tx <= cx + r; tx++) {
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) continue;
        if (state.world.tiles[TIDX(tx, ty)] !== T_ROCK) continue;
        if (Math.hypot((tx + 0.5) * TILE - x, (ty + 0.5) * TILE - y) > radius + 4) continue;
        state.world.tiles[TIDX(tx, ty)] = T_EMPTY;
        addScore(150);
        burst((tx + 0.5) * TILE, (ty + 0.5) * TILE, PAL.magenta, 4);
      }
    }
    /* враги в радиусе */
    for (let j = state.ents.length - 1; j >= 0; j--) {
      const e = state.ents[j];
      if (e.dead || e.t === 'teleporter') continue;
      const spec = ENEMY[e.t];
      if (!spec || !spec.grenade) continue;
      const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
      if (Math.hypot(ecx - x, ecy - y) < radius + Math.max(e.w, e.h) / 2) damageEntity(e, 1, 'grenade');
    }
    /* мины детонируют цепочкой */
    for (let j = 0; j < state.ents.length; j++) {
      const e = state.ents[j];
      if (e.t === 'mine' && !e.dead && Math.hypot(e.x + 4 - x, e.y + 3 - y) < radius + 10) {
        e.dead = true; addScore(ENEMY.mine.score);
        setTimeout(function () {}, 0);
        boom(e.x + 4, e.y + 3, 10, PAL.bred);
        burst(e.x + 4, e.y + 3, PAL.bred, 5);
      }
    }
  }
  PR.explode = explode;

  function addScore(n, x, y) {
    state.score += n;
    if (x != null) state.pops.push({ x, y, text: (n > 0 ? '+' : '') + n, life: 0.9, max: 0.9, color: PAL.byellow });
  }
  PR.addScore = addScore;

  function damageEntity(e, dmg, src) {
    const spec = ENEMY[e.t];
    if (!spec) return;
    e.hp -= dmg;
    e.hitT = 0.12;
    if (e.hp > 0) { snd('hit'); return; }
    e.dead = true;
    addScore(spec.score, e.x + e.w / 2, e.y);
    if (spec.score) snd(e.t === 'pod' || e.t === 'turret' || e.t === 'tank' ? 'bigexpl' : 'explosion');
    burst(e.x + e.w / 2, e.y + e.h / 2, PAL.bmagenta, 6);
    if (e.t === 'pod') { boom(e.x + e.w / 2, e.y + e.h / 2, 10, PAL.bgreen); }
    if (e.t === 'tank') { boom(e.x + e.w / 2, e.y + e.h / 2, 14, PAL.bred); state.fx.shake = 4; }
  }

  /* ============================================================
     ВРАГИ
     ============================================================ */
  function updateEntities(dt) {
    const p = state.player;
    const pb = playerBox();
    for (let i = 0; i < state.ents.length; i++) {
      const e = state.ents[i];
      if (e.dead) continue;
      e.timer -= dt;
      e.anim += dt;
      if (e.hitT > 0) e.hitT -= dt;

      switch (e.t) {
        case 'walker': {
          const speed = 28;
          e.vx = e.dir * speed;
          e.x += e.vx * dt;
          if (e.x < e.homeX - e.range || e.x > e.homeX + e.range) e.dir *= -1;
          /* край платформы */
          const footY = Math.floor((e.y + e.h + 1) / TILE);
          const aheadX = Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / TILE);
          if (!isBlocking(aheadX, footY) && !isBlocking(Math.floor((e.dir > 0 ? e.x + e.w - 2 : e.x + 1) / TILE), footY)) {
            e.dir *= -1;
          }
          if (isBlocking(Math.floor((e.dir > 0 ? e.x + e.w : e.x - 1) / TILE), Math.floor((e.y + e.h - 2) / TILE))) e.dir *= -1;
          e.x = clamp(e.x, 0, W - e.w);
          break;
        }
        case 'flyer': {
          const speed = 34;
          e.x += e.dir * speed * dt;
          e.baseY += 0;
          e.y = e.baseY + Math.sin((e.anim + e.phase * 6) * 2.4) * 14;
          if (e.x < e.homeX - e.range) e.dir = 1;
          if (e.x > e.homeX + e.range) e.dir = -1;
          e.x = clamp(e.x, 0, W - e.w);
          break;
        }
        case 'swarmer': {
          const dx = (pb.x + pb.w / 2) - (e.x + e.w / 2);
          const dy = (pb.y + pb.h / 2) - (e.y + e.h / 2);
          const d = Math.hypot(dx, dy) || 1;
          e.x += (dx / d) * 26 * dt;
          e.y += (dy / d) * 22 * dt + Math.sin(e.anim * 7) * 12 * dt;
          break;
        }
        case 'turret': {
          if (e.timer <= 0 && Math.abs((e.x + e.w / 2) - (pb.x + pb.w / 2)) < 150) {
            e.timer = 2.0;
            const dir = (pb.x + pb.w / 2) > (e.x + e.w / 2) ? 1 : -1;
            e.dir = dir;
            state.eShots.push({ x: e.x + e.w / 2 + dir * 6, y: e.y + e.h / 2, vx: dir * 120, vy: 0, life: 3, type: 'turret' });
            snd('missile');
          }
          break;
        }
        case 'tank': {
          if (e.timer <= 0) {
            e.timer = 2.4;
            const dir = (pb.x + pb.w / 2) > (e.x + e.w / 2) ? 1 : -1;
            e.dir = dir;
            state.eShots.push({ x: e.x + e.w / 2 + dir * 8, y: e.y + e.h / 2 - 2, vx: dir * 92, vy: -40, life: 3, type: 'tank' });
            snd('missile');
          }
          /* медленно едет к игроку */
          if (Math.abs(e.x - e.homeX) < 40) {
            e.x += (pb.x > e.x ? 1 : -1) * 8 * dt;
          }
          break;
        }
        case 'mine': {
          if (e.timer <= 0) {
            e.timer = 0.05;
            if (Math.abs(pb.x + pb.w / 2 - (e.x + 4)) < 20 && Math.abs(pb.y + pb.h - (e.y + 6)) < 16) {
              e.dead = true;
              explode(e.x + 4, e.y + 3, 14);
            }
          }
          break;
        }
        case 'crusher': {
          /* цикл: 0 — вверху, 1 — удар, 2 — возврат */
          if (e.state === 0) {
            if (e.timer <= 0) { e.state = 1; e.timer = 0.16; snd('crusher'); }
          } else if (e.state === 1) {
            e.y = e.baseY + 16;
            if (e.timer <= 0) { e.state = 2; e.timer = 0.9; }
            if (overlaps({ x: e.x + 1, y: e.y, w: e.w - 2, h: e.h }, pb)) {
              hurtPlayer(1, 'crusher');
              p.vx = (pb.x < e.x ? -1 : 1) * 220;
              p.vy = -160;
            }
          } else {
            e.y = e.baseY;
            if (e.timer <= 0) { e.state = 0; e.timer = 1.6 + e.phase; }
          }
          break;
        }
        case 'pod': {
          if (e.timer <= 0) {
            const alive = state.ents.filter((x) => x.t === 'swarmer' && !x.dead).length;
            if (alive < 3) {
              e.timer = 2.6;
              addEntity({ t: 'swarmer', x: Math.floor((e.x + e.w / 2) / TILE), y: Math.floor((e.y + e.h - 8) / TILE) });
              snd('alarm');
            } else e.timer = 1.2;
          }
          break;
        }
        case 'homer': {
          if (e.timer <= 0) {
            e.timer = 3.0;
            state.eShots.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: 0, vy: 0, life: 6, missile: true, spin: 0, ang: Math.PI / 2 });
            snd('missile');
          }
          e.y = e.baseY + Math.sin((e.anim + e.phase * 4) * 1.7) * 4;
          break;
        }
        case 'double_launcher':
        case 'combo_launcher': {
          if (overlaps(entityBox(e), pb)) {
            e.dead = true;
            addScore(ENEMY[e.t].score, e.x + e.w / 2, e.y);
            snd('pickup');
            burst(e.x + e.w / 2, e.y + e.h / 2, PAL.bcyan, 10);
          }
          break;
        }
        case 'power_laser': {
          if (overlaps(entityBox(e), pb)) {
            e.dead = true;
            state.player.laser = clamp(state.player.laser + 30, 0, state.player.maxLaser);
            addScore(0);
            snd('pickup');
            state.pops.push({ x: e.x, y: e.y, text: '+30', life: 0.8, max: 0.8, color: PAL.bcyan });
          }
          break;
        }
        case 'power_rocket': {
          if (overlaps(entityBox(e), pb)) {
            e.dead = true;
            state.player.rockets = clamp(state.player.rockets + 3, 0, state.player.maxRockets);
            snd('pickup');
            state.pops.push({ x: e.x, y: e.y, text: '+3', life: 0.8, max: 0.8, color: PAL.bmagenta });
          }
          break;
        }
        case 'exo': {
          if (overlaps(entityBox(e), pb) && !p.exo) {
            e.dead = true;
            p.exo = true;
            p.armor = 3;
            state.woreExo = true;
            state.message = { key: 'msg.exo.on', t: 0, dur: 2.2 };
            snd('exo');
            for (let k = 0; k < 18; k++) {
              burst(e.x + e.w / 2, e.y + e.h / 2, k % 2 ? PAL.bcyan : PAL.bwhite, 1);
            }
            state.fx.flash = 0.25;
            state.fx.flashColor = PAL.bcyan;
          }
          break;
        }
        case 'teleporter': {
          if (input.down && overlaps(entityBox(e), pb) && p.onGround && e.timer <= 0) {
            let dest = null;
            for (let j = 0; j < state.ents.length; j++) {
              const o = state.ents[j];
              if (o !== e && o.t === 'teleporter' && o.group === e.group && !o.dead) dest = o;
            }
            if (dest) {
              e.timer = 1.0; dest.timer = 1.0;
              p.x = dest.x + dest.w / 2 - p.w / 2;
              p.y = dest.y + dest.h - p.h;
              p.vx = 0; p.vy = 0;
              state.fx.flash = 0.3;
              state.fx.flashColor = PAL.bwhite;
              snd('teleport');
              burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bcyan, 12);
              state.message = { key: 'msg.teleport', t: 0, dur: 1.2 };
            }
          }
          break;
        }
        default: break;
      }

      /* контакт врага с игроком */
      if (!e.dead && e.t !== 'teleporter' && e.t !== 'power_laser' && e.t !== 'power_rocket' &&
        e.t !== 'exo' && e.t !== 'double_launcher' && e.t !== 'combo_launcher' && e.t !== 'crusher') {
        if (overlaps(entityBox(e), pb)) hurtPlayer(1, e.t);
      }
    }
    /* чистим мёртвых (кроме телепортов/декора) */
    state.ents = state.ents.filter((e) => !e.dead || e.t === 'teleporter');
  }

  /* ============================================================
     УРОН ИГРОКУ / СМЕРТЬ
     ============================================================ */
  function hurtPlayer(dmg, cause) {
    const p = state.player;
    if (!p || !p.alive || p.invuln > 0 || state.mode !== 'play') return;
    if (p.exo && p.armor > 0) {
      p.armor -= dmg;
      p.invuln = 1.05;
      p.hitT = 0.25;
      state.fx.shake = 4;
      state.fx.flash = 0.12;
      state.fx.flashColor = PAL.bcyan;
      snd('hit');
      if (p.armor <= 0) {
        p.armor = 0;
        p.exo = false;
        p.invuln = 1.4;
        state.message = { key: 'msg.exo.off', t: 0, dur: 1.8 };
        snd('bigexpl');
        burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bcyan, 16);
      }
      return;
    }
    die(cause);
  }
  PR.hurtPlayer = hurtPlayer;

  function die(cause) {
    const p = state.player;
    if (!p.alive) return;
    p.alive = false;
    p.exo = false;
    p.armor = 0;
    state.lives -= 1;
    state.deadTimer = 1.4;
    state.mode = 'dead';
    state.fx.shake = 7;
    state.fx.flash = 0.3;
    state.fx.flashColor = PAL.bred;
    burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bwhite, 14);
    burst(p.x + p.w / 2, p.y + p.h / 2, PAL.bred, 12);
    snd('death');
    duck(true);
  }
  PR.die = die;

  /* ============================================================
     ПЕРЕХОД ЭКРАНОВ
     ============================================================ */
  function nextScreen() {
    const prevScreen = state.screen;
    const lv = levelData(state.level);
    if (!lv) return;
    if (prevScreen + 1 < lv.screens.length) {
      loadScreen(state.level, prevScreen + 1, { keepExo: state.player.exo && state.player.armor > 0, invuln: 0.6 });
      state.transDir = 1;
      state.transition = 1;
      music(state.level >= 4 ? 'final' : (state.player.exo ? 'exo' : 'game'));
    } else {
      levelComplete();
    }
  }

  function levelComplete() {
    state.mode = 'levelclear';
    state.clearTimer = 2.0;
    music('clear');
    state.fx.flash = 0.3;
    state.fx.flashColor = PAL.bwhite;
    snd('clear');
  }

  function startBonus() {
    const values = [500, 1000, 2500, 5000];
    state.mode = 'bonus';
    state.bonus = {
      values,
      index: Math.floor(Math.random() * values.length),
      timer: 0,
      speed: 0.085,
      phase: 'pick',
      chosen: 0,
      resultTimer: 0,
      gained: 0,
      bonusText: '',
      extraLife: false
    };
    music('clear');
    duck(true);
  }

  function resolveBonus(chosen) {
    const b = state.bonus;
    b.phase = 'result';
    b.chosen = chosen;
    b.index = b.values.indexOf(chosen);
    let gained = chosen;
    b.lines = [PR.t('msg.bonus.pick2')];
    const livesBonus = state.lives * 1000;
    gained += livesBonus;
    b.livesBonus = livesBonus;
    b.noExoBonus = state.woreExo ? 0 : 10000;
    gained += b.noExoBonus;
    b.extraLife = state.lives < 9;
    if (b.extraLife) { state.lives += 1; }
    state.score += gained;
    b.gained = gained;
    b.resultTimer = 0;
    addScore(0);
    snd('powerup');
  }

  function nextLevel() {
    const lv = levelData(state.level);
    const last = !lv || state.level + 1 >= PR.levelCount();
    if (last) {
      state.mode = 'win';
      state.winTimer = 0;
      music('win');
      snd('win');
      if (state.score > state.record) {
        state.record = state.score;
        PR.saveRecord(state.record);
        state.newRecord = true;
      }
      duck(true);
      return;
    }
    state.level += 1;
    state.woreExo = false;
    state.mode = 'briefing';
    state.briefT = 0;
    state.player.exo = false;
    state.player.armor = 0;
    state.player.laser = 60;
    state.player.rockets = 2;
    music(state.level >= 4 ? 'final' : 'game');
    duck(false);
  }

  function newGame() {
    state.lives = 5;
    state.score = 0;
    state.level = 0;
    state.screen = 0;
    state.woreExo = false;
    state.bonus = null;
    state.newRecord = false;
    state.player = makePlayer();
    loadScreen(0, 0, { fresh: true, freshAmmo: true, invuln: 1.2, seed: 1 });
    state.mode = 'briefing';
    state.briefT = 0;
    duck(false);
    music('game');
    intensity(0);
  }
  PR.newGame = newGame;

  function respawn() {
    state.mode = 'play';
    loadScreen(state.level, state.screen, {
      keepExo: false, freshAmmo: true, invuln: 1.6, seed: (state.level * 131 + state.screen * 17 + 7) | 0
    });
    duck(false);
    music(state.level >= 4 ? 'final' : 'game');
    intensity(state.exo === true ? 0.7 : 0);
  }
  PR.respawn = respawn;

  /* ============================================================
     РЕЖИМЫ / МЕНЮ
     ============================================================ */
  function setMode(mode, opts) {
    opts = opts || {};
    state.mode = mode;
    state.transition = opts.transition || 0;
    if (mode === 'paused') duck(true); else duck(false);
    if (mode === 'title') {
      state.menuIndex = 0;
      music('title');
    }
    if (mode === 'gameover') {
      duck(true);
      if (state.score > state.record) {
        state.record = state.score;
        PR.saveRecord(state.record);
        state.newRecord = true;
      }
      music('gameover');
    }
  }
  PR.setMode = setMode;

  function titleItems() {
    return [
      { key: 'play', label: PR.t('menu.play') },
      { key: 'help', label: PR.t('menu.help') },
      { key: 'settings', label: PR.t('menu.settings') },
      { key: 'about', label: PR.t('menu.about') }
    ];
  }
  function pauseItems() {
    return [
      { key: 'resume', label: PR.t('pause.resume') },
      { key: 'restart', label: PR.t('pause.restart') },
      { key: 'settings', label: PR.t('pause.settings') },
      { key: 'menu', label: PR.t('pause.menu') }
    ];
  }
  function settingsItems() {
    const s = PR.settings;
    return [
      { key: 'lang', label: PR.t('settings.lang'), value: s.lang === 'ru' ? 'РУССКИЙ' : 'ENGLISH' },
      { key: 'gfx', label: PR.t('settings.gfx'), value: s.gfx === 'retro' ? PR.t('gfx.retro') : PR.t('gfx.modern') },
      { key: 'music', label: PR.t('settings.music'), value: s.music ? PR.t('settings.on') : PR.t('settings.off') },
      { key: 'sfx', label: PR.t('settings.sfx'), value: s.sfx ? PR.t('settings.on') : PR.t('settings.off') },
      { key: 'crt', label: PR.t('settings.crt'), value: s.crt ? PR.t('settings.on') : PR.t('settings.off') },
      { key: 'reset', label: PR.t('settings.reset'), value: '' },
      { key: 'back', label: 'ESC', value: PR.t('settings.back') }
    ];
  }
  function gameoverItems() {
    return [
      { key: 'retry', label: PR.t('msg.continue') },
      { key: 'menu', label: PR.t('pause.menu') }
    ];
  }

  const UI = PR.ui = {
    items: function () {
      const m = state.mode;
      if (m === 'title') return titleItems();
      if (m === 'paused') return pauseItems();
      if (m === 'settings') return settingsItems();
      if (m === 'gameover') return gameoverItems();
      if (m === 'win') return [{ key: 'menu', label: PR.t('pause.menu') }];
      return [];
    },
    /* раскладка — общая для обоих рендереров; координаты логические 256×208 */
    layout: function () {
      const m = state.mode;
      const items = UI.items();
      let rowH = 13;
      const gap = 2;
      let y0 = 92;
      let x = 76, w = 104;
      if (m === 'title') { y0 = 124; }
      else if (m === 'settings') { y0 = 56; rowH = 13; }
      else if (m === 'paused') { y0 = 66; }
      else if (m === 'gameover') { y0 = 122; }
      else if (m === 'win') { y0 = 150; }
      return items.map(function (it, i) {
        return {
          item: it, index: i,
          x, y: y0 + i * (rowH + gap), w, h: rowH,
          cx: x + w / 2, cy: y0 + i * (rowH + gap) + rowH / 2
        };
      });
    },
    hit: function (x, y) {
      const rects = UI.layout();
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    }
  };

  function activate(index) {
    const items = UI.items();
    const it = items[index];
    if (!it) return;
    snd('menu');
    const m = state.mode;
    switch (m) {
      case 'title':
        if (it.key === 'play') newGame();
        else if (it.key === 'help') { state.helpReturn = 'title'; setMode('help'); }
        else if (it.key === 'settings') { state.settingsIndex = 0; state.settingsReturn = 'title'; setMode('settings'); }
        else if (it.key === 'about') { state.helpReturn = 'title'; setMode('about'); }
        break;
      case 'paused':
        if (it.key === 'resume') { setMode('play'); music(state.level >= 4 ? 'final' : (state.player.exo ? 'exo' : 'game')); }
        else if (it.key === 'restart') { state.mode = 'play'; respawn(); }
        else if (it.key === 'settings') { state.settingsIndex = 0; state.settingsReturn = 'paused'; setMode('settings'); }
        else if (it.key === 'menu') { setMode('title'); }
        break;
      case 'settings':
        if (it.key === 'lang') { PR.toggleLang(); }
        else if (it.key === 'gfx') { PR.toggleGfx(); }
        else if (it.key === 'music') { PR.toggleMusic(); }
        else if (it.key === 'sfx') { PR.toggleSfx(); }
        else if (it.key === 'crt') { PR.toggleCrt(); }
        else if (it.key === 'reset') { PR.resetRecord(); state.resetAsk = 1.2; }
        else if (it.key === 'back') { leaveSettings(); }
        break;
      case 'gameover':
        if (it.key === 'retry') { newGame(); }
        else if (it.key === 'menu') setMode('title');
        break;
      case 'win':
        setMode('title');
        break;
      default: break;
    }
  }

  function leaveSettings() {
    if (state.settingsReturn === 'paused') { setMode('paused'); }
    else setMode('title');
  }

  /* переключатели настроек */
  PR.toggleLang = function () {
    PR.settings.lang = PR.settings.lang === 'ru' ? 'en' : 'ru';
    PR.saveSettings();
    snd('select');
    if (state.mode === 'briefing' || state.mode === 'levelclear') { /* тексты берутся заново */ }
  };
  PR.toggleGfx = function () {
    PR.settings.gfx = PR.settings.gfx === 'retro' ? 'modern' : 'retro';
    PR.saveSettings();
    snd('select');
    state.fx.flash = 0.18;
    state.fx.flashColor = PR.settings.gfx === 'modern' ? NEON.cyan : PAL.bwhite;
  };
  PR.toggleMusic = function () {
    PR.settings.music = !PR.settings.music;
    PR.saveSettings();
    const a = A();
    if (a && a.setMusic) a.setMusic(PR.settings.music);
    if (PR.settings.music) {
      music(state.mode === 'title' ? 'title' : state.mode === 'gameover' ? 'gameover' : state.level >= 4 ? 'final' : (state.player && state.player.exo ? 'exo' : 'game'));
    } else if (a && a.stopMusic) a.stopMusic();
    snd('select');
  };
  PR.toggleSfx = function () {
    PR.settings.sfx = !PR.settings.sfx;
    PR.saveSettings();
    const a = A();
    if (a && a.setSfx) a.setSfx(PR.settings.sfx);
    snd('select');
  };
  PR.toggleCrt = function () {
    PR.settings.crt = !PR.settings.crt;
    PR.saveSettings();
    snd('select');
  };
  PR.resetRecord = function () {
    state.record = 0;
    PR.saveRecord(0);
    snd('deny');
  };
  PR.setLang = function (lang) { PR.settings.lang = lang === 'en' ? 'en' : 'ru'; PR.saveSettings(); };
  PR.setGfx = function (gfx) { PR.settings.gfx = gfx === 'modern' ? 'modern' : 'retro'; PR.saveSettings(); };

  /* ============================================================
     ОБРАБОТКА ДЕЙСТВИЙ И ХОТКЕЕВ
     ============================================================ */
  function handleActions() {
    const acts = input.actions;
    if (!acts.length) return;
    input.actions = [];
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      /* глобальные переключатели */
      if (a === 'lang') { PR.toggleLang(); continue; }
      if (a === 'gfx') { PR.toggleGfx(); continue; }
      if (a === 'music') { PR.toggleMusic(); continue; }
      if (a === 'sfx') { PR.toggleSfx(); continue; }
      if (a === 'mute') { PR.toggleMusic(); continue; }
      const m = state.mode;
      if (a === 'enter' || a === 'action') {
        if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') {
          if (m === 'settings' && state.resetAsk > 0 && UI.items()[state.menuIndex] && UI.items()[state.menuIndex].key === 'reset') {
            PR.resetRecord(); state.resetAsk = 0; continue;
          }
          activate(state.menuIndex);
        } else if (m === 'help' || m === 'about') {
          setMode(state.helpReturn === 'paused' ? 'paused' : 'title');
        } else if (m === 'briefing') {
          state.mode = 'play';
          snd('select');
        } else if (m === 'dead') {
          /* пропуск анимации */
          state.deadTimer = Math.min(state.deadTimer, 0.1);
        } else if (m === 'bonus') {
          if (state.bonus && state.bonus.phase === 'pick') {
            resolveBonus(state.bonus.values[state.bonus.index]);
          } else if (state.bonus && state.bonus.phase === 'result') {
            state.bonus.resultTimer = 99;
          }
        } else if (m === 'levelclear') {
          state.clearTimer = Math.min(state.clearTimer, 0.05);
        }
        continue;
      }
      if (a === 'escape' || a === 'pause') {
        if (m === 'play') setMode('paused');
        else if (m === 'paused') { setMode('play'); music(state.level >= 4 ? 'final' : (state.player.exo ? 'exo' : 'game')); }
        else if (m === 'settings') leaveSettings();
        else if (m === 'help' || m === 'about') setMode(state.helpReturn === 'paused' ? 'paused' : 'title');
        continue;
      }
      if (a === 'up') { if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') { moveMenu(-1); } continue; }
      if (a === 'down') { if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') { moveMenu(1); } continue; }
      if (a === 'left' || a === 'right') {
        if (m === 'settings') changeSetting(state.menuIndex, a === 'right' ? 1 : -1);
        continue;
      }
      if (a === 'restart') {
        if (m === 'play' || m === 'paused' || m === 'dead') { respawn(); }
        continue;
      }
    }
  }

  function moveMenu(d) {
    const items = UI.items();
    if (!items.length) return;
    state.menuIndex = (state.menuIndex + d + items.length) % items.length;
    snd('select');
  }

  function changeSetting(index, d) {
    const items = UI.items();
    const it = items[index];
    if (!it) return;
    if (it.key === 'lang') { PR.toggleLang(); return; }
    if (it.key === 'gfx') { PR.toggleGfx(); return; }
    if (it.key === 'music') { PR.toggleMusic(); return; }
    if (it.key === 'sfx') { PR.toggleSfx(); return; }
    if (it.key === 'crt') { PR.toggleCrt(); return; }
  }

  /* клик мышью/тапом по меню */
  PR.click = function (x, y) {
    const m = state.mode;
    if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') {
      const idx = UI.hit(x, y);
      if (idx >= 0) { state.menuIndex = idx; activate(idx); }
      return true;
    }
    return false;
  };
  PR.hover = function (x, y) {
    const m = state.mode;
    if (m === 'title' || m === 'paused' || m === 'settings' || m === 'gameover' || m === 'win') {
      const idx = UI.hit(x, y);
      if (idx >= 0 && idx !== state.menuIndex) { state.menuIndex = idx; }
    }
  };

  /* ============================================================
     ШАГ ИГРЫ
     ============================================================ */
  function updatePlay(dt) {
    state.screenT += dt;
    updatePlayer(dt);
    updateEntities(dt);
    updateShots(dt);
    updateEnemyShots(dt);
    if (state.message) {
      state.message.t += dt;
      if (state.message.t > state.message.dur) state.message = null;
    }
    /* выход за правый край */
    const p = state.player;
    if (p.alive && p.x + p.w >= W - 1) nextScreen();
    /* индикатор заряда */
    intensity(p.exo ? 0.75 : clamp(1 - (p.laser + p.rockets * 20) / 120, 0, 0.6));
  }

  function updateFX(dt) {
    const fx = state.fx;
    fx.shake *= Math.pow(0.02, dt);
    if (fx.shake < 0.05) fx.shake = 0;
    fx.flash = Math.max(0, fx.flash - dt * 2.6);
    fx.hitFlash = Math.max(0, fx.hitFlash - dt * 3);

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = state.pops.length - 1; i >= 0; i--) {
      const p = state.pops[i];
      p.life -= dt;
      p.y -= 18 * dt;
      if (p.life <= 0) state.pops.splice(i, 1);
    }
    for (let i = state.booms.length - 1; i >= 0; i--) {
      const b = state.booms[i];
      b.t += dt;
      if (b.t > b.dur) state.booms.splice(i, 1);
    }
    if (state.transition > 0) {
      state.transition = Math.max(0, state.transition - dt * 3.2);
    }
    if (state.resetAsk > 0) state.resetAsk -= dt;
  }

  function updateBonus(dt) {
    const b = state.bonus;
    if (!b) { state.mode = 'play'; return; }
    if (b.phase === 'pick') {
      b.timer += dt;
      if (b.timer > b.speed) {
        b.timer = 0;
        b.index = (b.index + 1) % b.values.length;
        snd('select');
      }
      const p = state.player;
      if (p) p.anim += dt;
    } else {
      b.resultTimer += dt;
      if (b.resultTimer > 3.2 || b.resultTimer > 99) {
        if (state.level + 1 >= PR.levelCount()) {
          nextLevel();
        } else {
          nextLevel();
        }
      }
    }
  }

  PR.update = function (dt) {
    dt = Math.min(dt, 0.05);
    state.t += dt;
    handleActions();
    if (input.pointer.clicked) {
      input.pointer.clicked = false;
      PR.click(input.pointer.x, input.pointer.y);
    }
    const m = state.mode;
    if (m === 'play') updatePlay(dt);
    else if (m === 'dead') {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) {
        if (state.lives <= 0) setMode('gameover');
        else respawn();
      }
    } else if (m === 'levelclear') {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) startBonus();
    } else if (m === 'bonus') {
      updateBonus(dt);
    } else if (m === 'briefing') {
      state.briefT = (state.briefT || 0) + dt;
      if (state.briefBypass) state.briefT = Math.max(state.briefT, 0);
      const p = state.player;
      if (p) p.anim += dt;
    } else if (m === 'win') {
      state.winTimer = (state.winTimer || 0) + dt;
    }
    updateFX(dt);
  };

  /* окно детерминированного шага для тестов */
  PR.stepFixed = function (dt) { PR.update(dt); return state; };

  /* ============================================================
     НАЧАЛЬНОЕ СОСТОЯНИЕ / ДЕМО-РЕЖИМ
     ============================================================ */
  PR.prepareTitle = function () {
    state.record = PR.loadRecord();
    state.mode = 'title';
    state.menuIndex = 0;
    /* фоновая сцена для титульного экрана: первый экран первого уровня */
    state.level = 0;
    state.screen = 0;
    state.lives = 5;
    state.score = 0;
    state.player = makePlayer();
    loadScreen(0, 0, { fresh: true, freshAmmo: true, invuln: 999, seed: 1 });
    state.player.alive = true;
  };

  /* debug-сценарии для скриншотов (#shot=...) */
  PR.prepareShot = function (shot, opts) {
    opts = opts || {};
    const lv = opts.level != null ? opts.level : 0;
    const sc = opts.screen != null ? opts.screen : 0;
    state.record = PR.loadRecord();
    state.lives = 4;
    state.score = 12750;
    state.level = lv;
    state.screen = sc;
    state.woreExo = false;
    state.player = makePlayer();
    loadScreen(lv, sc, { fresh: true, freshAmmo: true, invuln: 999, seed: 1 });
    state.fx.shake = 0;
    state.t = 3.2;
    switch (shot) {
      case 'play':
        state.mode = 'play';
        state.player.laser = 72;
        state.player.rockets = 3;
        break;
      case 'exo':
        state.mode = 'play';
        state.player.exo = true;
        state.player.armor = 3;
        state.player.laser = 44;
        state.player.rockets = 2;
        break;
      case 'paused':
        state.mode = 'paused';
        state.menuIndex = 0;
        break;
      case 'settings':
        state.mode = 'settings';
        state.settingsReturn = 'title';
        state.menuIndex = 1;
        break;
      case 'help':
        state.mode = 'help';
        state.helpReturn = 'title';
        break;
      case 'about':
        state.mode = 'about';
        state.helpReturn = 'title';
        break;
      case 'briefing':
        state.mode = 'briefing';
        state.briefT = 0.4;
        break;
      case 'bonus':
        state.mode = 'levelclear';
        state.clearTimer = 0.01;
        startBonus();
        state.bonus.index = 2;
        break;
      case 'levelclear':
        state.mode = 'levelclear';
        state.clearTimer = 30;   /* не уходить в bonus, чтобы кадр был стабильным */
        break;
      case 'gameover':
        state.mode = 'gameover';
        state.score = 24750;
        state.record = 19800;
        state.newRecord = true;
        break;
      case 'win':
        state.mode = 'win';
        state.score = 84500;
        state.record = 79200;
        state.newRecord = true;
        state.winTimer = 2;
        break;
      case 'title':
      default:
        PR.prepareTitle();
        break;
    }
    state.menuIndex = state.menuIndex || 0;
    return state;
  };

  /* ============================================================
     ТЕСТЫ (#test)
     ============================================================ */
  PR.runTests = function () {
    const res = [];
    const ok = function (name, cond) { res.push({ name, ok: !!cond }); };
    const levels = window.PR_LEVELS || [];

    ok('уровней 5', levels.length === 5);
    ok('экранов по 5', levels.every((l) => l && l.screens && l.screens.length === 5));
    ok('сетка 32×24', levels.every((l) => l.screens.every((s) => s.tiles.length === 24 && s.tiles.every((r) => r.length === 32))));
    ok('только легальные тайлы', levels.every((l) => l.screens.every((s) => s.tiles.every((r) => /^[ #=%^x]+$/.test(r)))));
    ok('капсула exo на 3-м экране', levels.every((l) => l.screens[2].entities.some((e) => e.t === 'exo')));
    ok('телепорты парами', levels.every((l) => l.screens.every((s) => {
      const g = {}; s.entities.forEach((e) => { if (e.t === 'teleporter') g[e.group] = (g[e.group] || 0) + 1; });
      return Object.keys(g).every((k) => g[k] === 2);
    })));

    /* шрифт покрывает все строки локализации */
    const chars = new Set();
    ['ru', 'en'].forEach((lang) => {
      Object.values(window.PR_I18N[lang]).forEach((s) => { for (const ch of String(s)) chars.add(ch); });
    });
    levels.forEach((l) => {
      ['ru', 'en'].forEach((lang) => {
        String(l.name[lang] + l.intro[lang]).split('').forEach((c) => chars.add(c));
      });
    });
    const missing = [];
    chars.forEach((ch) => { if (!/\s/.test(ch) && !window.PR_FONT.has(ch)) missing.push(ch); });
    ok('шрифт: все символы (' + (chars.size) + ')', missing.length === 0);
    if (missing.length) state.debug.missingGlyphs = missing.join('');

    ok('локализация: паритет ключей', (function () {
      const a = Object.keys(window.PR_I18N.ru).sort().join('|');
      const b = Object.keys(window.PR_I18N.en).sort().join('|');
      return a === b;
    })());

    /* физика: игрок падает на землю */
    PR.prepareShot('play', { level: 0, screen: 0 });
    state.player.y = 40;
    for (let i = 0; i < 90; i++) PR.stepFixed(1 / 60);
    ok('игрок стоит на земле', state.player.onGround === true);

    /* бластер убивает ходячего */
    state.ents.forEach((e) => { if (e.t === 'walker') e.dead = true; });
    state.ents = state.ents.filter((e) => !e.dead);
    let w = addEntity({ t: 'walker', x: 10, y: 20 });
    const before = state.score;
    state.player.x = w.x - 40; state.player.y = w.y; state.player.facing = 1; state.player.dir = 1;
    state.player.cool = 0; state.player.laser = 100;
    fireBlaster();
    for (let i = 0; i < 40; i++) PR.stepFixed(1 / 60);
    ok('бластер убивает врага (+150)', w.dead && state.score - before >= 150);

    /* пушка не боится бластера */
    state.ents = [];
    const tur = addEntity({ t: 'turret', x: 12, y: 20 });
    state.score = 0;
    state.shots = [];
    state.player.x = tur.x - 40;
    state.player.cool = 0;
    fireBlaster();
    for (let i = 0; i < 40; i++) PR.stepFixed(1 / 60);
    ok('пушка неуязвима для бластера', !tur.dead);

    /* граната взрывает пушку */
    state.player.facing = 1;
    state.player.rockets = 3;
    throwGrenade();
    for (let i = 0; i < 120 && !tur.dead; i++) PR.stepFixed(1 / 60);
    ok('граната убивает пушку', tur.dead);

    /* разрушаемый камень */
    state.ents = [];
    state.world.tiles[22 * COLS + 20] = T_ROCK;
    explode(20 * TILE + 4, 22 * TILE + 4, 22);
    ok('граната разрушает камень', state.world.tiles[22 * COLS + 20] === T_EMPTY);

    /* бонус за уровень */
    state.lives = 3; state.woreExo = false;
    state.bonus = null; startBonus();
    resolveBonus(5000);
    ok('бонус = очки + жизни×1000 + 10000', state.bonus.gained === 5000 + 3000 + 10000);
    ok('доп. жизнь за уровень', state.lives === 4);

    /* рекорд */
    PR.saveRecord(12345);
    ok('рекорд в localStorage', PR.loadRecord() === 12345);
    PR.saveRecord(0);

    /* переключения */
    const g0 = PR.settings.gfx; PR.toggleGfx(); const g1 = PR.settings.gfx;
    PR.toggleGfx();
    ok('переключение графики', g0 !== g1 && PR.settings.gfx === g0);
    const l0 = PR.settings.lang; PR.toggleLang();
    ok('переключение языка', PR.settings.lang !== l0);
    PR.toggleLang();

    /* меню */
    PR.prepareTitle();
    state.menuIndex = 1;
    PR.pushAction('down');
    PR.stepFixed(1 / 60);
    ok('навигация меню', state.menuIndex === 2);

    /* пауза */
    PR.prepareShot('play');
    PR.pushAction('pause');
    PR.stepFixed(1 / 60);
    ok('пауза', state.mode === 'paused');
    PR.pushAction('pause');
    PR.stepFixed(1 / 60);
    ok('снятие паузы', state.mode === 'play');

    /* переход на следующий экран */
    state.mode = 'play';
    state.screen = 0;
    loadScreen(0, 0, { fresh: true, freshAmmo: true, invuln: 999 });
    state.player.x = W - 2;
    PR.stepFixed(1 / 60);
    ok('выход за правый край = новый экран', state.screen === 1);

    /* последний экран уровня → уровень пройден */
    loadScreen(0, 4, { fresh: true, freshAmmo: true, invuln: 999 });
    state.player.x = W - 2;
    PR.stepFixed(1 / 60);
    ok('конец уровня → зачёт бонуса', state.mode === 'levelclear');

    /* телепорт */
    PR.prepareShot('play');
    state.ents = [];
    addEntity({ t: 'teleporter', x: 2, y: 20, group: 1 });
    addEntity({ t: 'teleporter', x: 26, y: 8, group: 1 });
    const p = state.player;
    p.x = 2 * 8 + 1; p.y = 21 * 8 - p.h; p.onGround = true;
    input.down = true;
    PR.stepFixed(1 / 60);
    input.down = false;
    ok('телепорт переносит', p.x > 100);

    /* --- интеграционные проверки механик --- */
    /* смерть и респавн */
    PR.newGame();
    state.mode = 'play';
    state.player.invuln = 0;
    const lives0 = state.lives;
    hurtPlayer(1, 'test');
    ok('смерть: -1 жизнь, режим dead', state.mode === 'dead' && state.lives === lives0 - 1);
    for (let i = 0; i < 120; i++) PR.stepFixed(1 / 60);
    ok('респавн после смерти', state.mode === 'play' && state.player.alive === true);

    /* экзоскелет: 3 удара */
    PR.newGame();
    state.mode = 'play';
    state.player.exo = true;
    state.player.armor = 3;
    const arm = [];
    for (let i = 0; i < 3; i++) { state.player.invuln = 0; hurtPlayer(1, 't'); arm.push(state.player.armor); }
    ok('экзоскелет: 3 удара, потом потеря', arm.join(',') === '2,1,0' && !state.player.exo && state.player.alive);

    /* формула бонуса без экзо и с экзо */
    PR.prepareShot('bonus');
    state.lives = 2; state.woreExo = false;
    state.bonus.phase = 'pick';
    PR.pushAction('action'); PR.stepFixed(1 / 60);
    const chosenV = state.bonus.chosen;
    const wantNoExo = chosenV + 2 * 1000 + 10000;
    const gotNoExo = state.bonus.gained;
    PR.prepareShot('bonus');
    state.lives = 2; state.woreExo = true;
    state.bonus.phase = 'pick';
    PR.pushAction('action'); PR.stepFixed(1 / 60);
    const wantExo = state.bonus.chosen + 2 * 1000;
    ok('бонус: +10000 без экзо / 0 с экзо', gotNoExo === wantNoExo && state.bonus.gained === wantExo);

    /* полный проход первого уровня */
    PR.newGame();
    state.mode = 'play';
    state.player.invuln = 1e6;
    input.left = input.right = input.up = input.down = input.fire = false;
    let lastMode = 'play';
    for (let scr = 0; scr < 5 && state.mode === 'play'; scr++) {
      let guard = 0;
      while (state.mode === 'play' && state.screen === scr && guard++ < 1200) {
        input.right = true; input.up = (guard % 26) < 4;
        state.player.invuln = 1e6;   /* проверяем геометрию, а не бой */
        PR.stepFixed(1 / 60);
      }
      input.right = false; input.up = false;
      lastMode = state.mode;
    }
    ok('экран за экраном → бонус сектора', lastMode === 'levelclear' || lastMode === 'bonus');

    /* телепорт */
    PR.prepareShot('play');
    state.ents = [];
    addEntity({ t: 'teleporter', x: 2, y: 20, group: 1 });
    addEntity({ t: 'teleporter', x: 26, y: 9, group: 1 });
    state.player.x = 17;
    state.player.y = 152;
    state.player.onGround = true;
    input.down = true;
    PR.stepFixed(1 / 60);
    input.down = false;
    ok('телепорт переносит к паре', state.player.x > 150);

    /* режимы стрельбы: клик vs удержание */
    PR.prepareShot('play');
    state.player.laser = 100;
    state.player.rockets = 3;
    input.fire = false;
    PR.stepFixed(1 / 60);
    input.fire = true;
    PR.stepFixed(1 / 60);
    const firedLaser = state.shots.length >= 1 && state.player.laser < 100;
    for (let i = 0; i < 22; i++) PR.stepFixed(1 / 60);
    const firedGrenade = state.shots.some((sh) => sh.grenade) && state.player.rockets === 2;
    input.fire = false;
    PR.stepFixed(1 / 60);
    ok('клик — бластер, удержание — граната', firedLaser && firedGrenade);

    /* пушка: бластер не берёт, граната берёт */
    PR.prepareShot('play');
    state.ents = [];
    const tur2 = addEntity({ t: 'turret', x: 12, y: 20 });
    state.player.x = tur2.x - 44;
    state.player.facing = 1;
    state.player.cool = 0;
    state.player.laser = 100;
    state.shots = [];
    fireBlaster();
    for (let i = 0; i < 30; i++) PR.stepFixed(1 / 60);
    const turAlive = !tur2.dead;
    state.player.rockets = 3;
    state.player.cool = 0;
    throwGrenade();
    for (let i = 0; i < 150 && !tur2.dead; i++) PR.stepFixed(1 / 60);
    ok('пушка: бластер мимо, граната в цель', turAlive && tur2.dead);

    /* аудио-модуль */
    const A = window.PR_AUDIO || {};
    ok('аудио-API на месте', ['init', 'unlock', 'setMusic', 'setSfx', 'playMusic', 'stopMusic', 'sfx', 'duck'].every((k) => typeof A[k] === 'function'));

    /* меню настроек открывается без исключений */
    let settingsOk = true;
    try {
      PR.prepareShot('settings');
      if (window.PR_RENDER_RETRO) window.PR_RENDER_RETRO.draw(document.createElement('canvas').getContext('2d'), { t: 0 });
    } catch (e) { settingsOk = false; }
    ok('экран настроек рисуется', settingsOk);

    /* режимы не падают */
    ok('режим title', (PR.prepareTitle(), state.mode === 'title'));

    return res;
  };
})();

/* ==== src/render-retro.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — RETRO-рендерер (8 бит)
   Рисует всё в логическом пространстве 256×208, 1 px = 1 пиксель.
   Стиль: чёрный фон, насыщенные цвета, 8×8 «атрибутные» блоки,
   пиксельный шрифт 6×8, минимум сглаживания.
   ============================================================ */
(function () {
  'use strict';

  const PR = window.PR;
  const P = PR.PAL;
  const TILE = 8, COLS = 32, ROWS = 24, W = 256, H = 192, HUD = 16, VH = 208;

  let g = null;              // текущий ctx
  let now = 0;               // время для анимаций

  const px = function (c, x, y, w, h) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };

  /* ---------- шрифт ---------- */
  const FONT = () => window.PR_FONT;
  function textW(str, scale) {
    const f = FONT();
    return str.length * (f ? f.W : 6) * (scale || 1);
  }
  function text(str, x, y, color, scale, align, shadow) {
    const f = FONT();
    if (!f) return;
    scale = scale || 1;
    str = String(str);
    const cw = f.W * scale;
    let ox = x;
    if (align === 'center') ox = x - textW(str, scale) / 2;
    else if (align === 'right') ox = x - textW(str, scale);
    ox = Math.round(ox); y = Math.round(y);
    const draw = function (sx, sy, col) {
      g.fillStyle = col;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === ' ') continue;
        const gl = f.glyph(ch);
        for (let row = 0; row < 8; row++) {
          const bits = gl[row];
          if (!bits) continue;
          for (let col2 = 0; col2 < 6; col2++) {
            if (bits & (1 << (5 - col2))) {
              g.fillRect(sx + i * cw + col2 * scale, sy + row * scale, scale, scale);
            }
          }
        }
      }
    };
    if (shadow) draw(ox + scale, y + scale, shadow);
    draw(ox, y, color);
  }
  function textShadow(str, x, y, color, scale, align) { text(str, x, y, color, scale, align, '#000000'); }

  function wrapMulti(str, maxChars) {
    const out = [];
    String(str).split('\n').forEach(function (par) {
      if (!par.trim()) { out.push(''); return; }
      wrap(par, maxChars).forEach(function (l) { out.push(l); });
    });
    return out;
  }

  function wrap(str, maxChars) {
    const words = String(str).split(' ');
    const lines = [];
    let line = '';
    words.forEach(function (w) {
      if ((line + ' ' + w).trim().length > maxChars) { if (line) lines.push(line); line = w; }
      else line = (line ? line + ' ' : '') + w;
    });
    if (line) lines.push(line);
    return lines;
  }

  /* ---------- примитивы ---------- */
  function panel(x, y, w, h, border, fill) {
    if (fill) px(fill, x, y, w, h);
    g.fillStyle = border;
    g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    /* уголки */
    px(border, x + 1, y + 1, 2, 1); px(border, x + 1, y + 1, 1, 2);
    px(border, x + w - 3, y + 1, 2, 1); px(border, x + w - 2, y + 1, 1, 2);
    px(border, x + 1, y + h - 2, 2, 1); px(border, x + 1, y + h - 3, 1, 2);
    px(border, x + w - 3, y + h - 2, 2, 1); px(border, x + w - 2, y + h - 3, 1, 2);
  }

  /* шахматный дизеринг — «атрибутная» 8-битная фактура */
  function dither(x, y, w, h, c1, c2, phase) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const on = (((x + i) + (y + j) + (phase | 0)) & 1) === 0;
        g.fillStyle = on ? c1 : c2;
        g.fillRect(x + i, y + j, 1, 1);
      }
    }
  }

  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- темы ---------- */
  const THEMES = {
    space:   { sky: ['#000000', P.bblue], block: P.byellow, block2: P.magenta, thin: P.bgreen, rock: P.bmagenta, spike: P.bwhite, star: P.bwhite, accent: P.bcyan },
    cavern:  { sky: ['#000000', P.black], block: P.bgreen, block2: P.yellow, thin: P.bcyan, rock: P.bred, spike: P.bwhite, star: P.bcyan, accent: P.bgreen },
    reactor: { sky: ['#000000', P.blue], block: P.bcyan, block2: P.bblue, thin: P.byellow, rock: P.bred, spike: P.bwhite, star: P.bcyan, accent: P.byellow },
    hive:    { sky: ['#000000', '#120012'], block: P.bgreen, block2: P.bmagenta, thin: P.bgreen, rock: P.magenta, spike: P.byellow, star: P.bgreen, accent: P.bmagenta },
    core:    { sky: ['#000000', '#200000'], block: P.bred, block2: P.bwhite, thin: P.bcyan, rock: P.bmagenta, spike: P.byellow, star: P.bred, accent: P.bwhite }
  };
  function themeOf(world) { return THEMES[(world && world.theme) || 'space'] || THEMES.space; }

  /* ---------- фон ---------- */
  function starfield(seed, t, theme) {
    const r = rng(seed * 977 + 13);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * H);
      const sp = 0.4 + r() * 1.6;
      const yy = Math.floor((y + t * sp * 6) % H);
      const col = i % 9 === 0 ? theme.accent : (i % 3 === 0 ? P.white : theme.star);
      px(col, x, yy, 1, 1);
      if (i % 11 === 0) { px(col, x + 1, yy, 1, 1); px(col, x, yy + 1, 1, 1); }
    }
    /* одна «планета» на экран — как на 8-битных заставках */
    const rr = rng(seed * 31 + 5);
    const cx = 24 + Math.floor(rr() * (W - 48));
    const cy = 28 + Math.floor(rr() * (H - 90));
    const rad = 7 + Math.floor(rr() * 10);
    for (let yy = -rad; yy <= rad; yy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, rad * rad - yy * yy)));
      for (let xx = -half; xx <= half; xx++) {
        const on = ((xx + yy) & 1) === 0 || (xx * xx + yy * yy < rad * rad * 0.45);
        px(on ? theme.accent : theme.sky[1], cx + xx, cy + yy, 1, 1);
      }
    }
    g.strokeStyle = theme.accent;
    g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, rad + 0.5, 0, Math.PI * 2); g.stroke();
  }

  /* ---------- тайлы ---------- */
  function drawTile(id, tx, ty, theme, seed) {
    const x = tx * TILE, y = ty * TILE;
    switch (id) {
      case PR.TILES.SOLID: {
        px(theme.sky[0], x, y, TILE, TILE);
        /* кирпичная «атрибутная» кладка 8×8: 2 цвета на клетку */
        g.fillStyle = theme.block;
        g.fillRect(x, y, 8, 2);
        g.fillRect(x, y + 4, 8, 2);
        dither(x, y + 2, 8, 2, theme.block, theme.sky[0], tx + ty);
        g.fillStyle = '#000000';
        g.fillRect(x + 3, y + 1, 1, 1); g.fillRect(x + 6, y + 5, 1, 1);
        break;
      }
      case PR.TILES.ROCK: {
        px(theme.sky[0], x, y, TILE, TILE);
        const r = rng(tx * 73 + ty * 149 + 11);
        for (let i = 0; i < 12; i++) {
          px(i % 2 ? theme.rock : theme.block2, x + Math.floor(r() * 8), y + Math.floor(r() * 8), 1, 1);
        }
        g.fillStyle = theme.rock;
        g.fillRect(x + 1, y + 1, 6, 6);
        dither(x + 1, y + 1, 6, 6, theme.rock, theme.sky[0], tx * 3 + ty);
        break;
      }
      case PR.TILES.THIN: {
        g.fillStyle = theme.thin;
        g.fillRect(x, y, 8, 1);
        g.fillStyle = theme.block2;
        for (let i = 0; i < 8; i += 2) g.fillRect(x + i, y + 1, 1, 1);
        g.fillStyle = theme.sky[0];
        for (let i = 1; i < 8; i += 2) g.fillRect(x + i, y + 1, 1, 1);
        break;
      }
      case PR.TILES.SPIKE: {
        g.fillStyle = theme.spike;
        for (let i = 0; i < 8; i += 2) {
          g.beginPath();
          g.moveTo(x + i, y + 8);
          g.lineTo(x + i + 1, y + 3);
          g.lineTo(x + i + 2, y + 8);
          g.fill();
        }
        px(theme.block2, x, y + 7, 8, 1);
        break;
      }
      case PR.TILES.FLORA: {
        const r = rng(tx * 41 + ty * 17 + 3);
        const h = 4 + Math.floor(r() * 5);
        g.fillStyle = theme.accent;
        g.fillRect(x + 3, y + 8 - h, 1, h);
        g.fillStyle = theme.block2;
        g.fillRect(x + 2, y + 8 - h, 3, 2);
        g.fillStyle = P.bwhite;
        g.fillRect(x + 3, y + 8 - h, 1, 1);
        break;
      }
      default: break;
    }
  }

  /* ---------- спрайты ---------- */
  function drawWalker(e, theme) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const flip = e.dir > 0;
    const body = e.hitT > 0 ? P.bwhite : P.bgreen;
    /* тело */
    px(body, x + 2, y + 2, 10, 6);
    px(P.bgreen, x + 1, y + 3, 1, 4);
    px(P.bgreen, x + 12, y + 3, 1, 4);
    /* глаза */
    const eyeX = flip ? x + 8 : x + 3;
    px(P.byellow, eyeX, y + 3, 2, 2);
    px(P.black, eyeX + (flip ? 1 : 0), y + 4, 1, 1);
    /* рот/зубы */
    px(P.bmagenta, x + 5, y + 6, 4, 1);
    /* ноги */
    const ph = Math.floor(e.anim * 8) % 2;
    px(P.bgreen, x + 2 + ph, y + 8, 2, 3);
    px(P.bgreen, x + 8 - ph, y + 8, 2, 3);
    /* шипы */
    px(P.byellow, x + 4, y + 1, 1, 1);
    px(P.byellow, x + 8, y + 1, 1, 1);
  }

  function drawFlyer(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const wing = Math.sin(e.anim * 14) > 0 ? 1 : 0;
    const c = e.hitT > 0 ? P.bwhite : P.bmagenta;
    px(c, x + 4, y + 3, 8, 6);
    px(c, x + 2, y + 3 + wing, 3, 2);
    px(c, x + 11, y + 3 + wing, 3, 2);
    px(P.byellow, x + 5, y + 5, 2, 2);
    px(P.byellow, x + 9, y + 5, 2, 2);
    px(P.black, x + 6, y + 6, 1, 1);
    px(P.black, x + 10, y + 6, 1, 1);
    px(P.bcyan, x + 7, y + 1, 2, 2);
  }

  function drawSwarmer(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.byellow;
    px(c, x + 2, y + 2, 4, 4);
    px(P.bred, x + 3, y + 3, 2, 2);
    px(P.bmagenta, x + 1, y + 1, 1, 1);
    px(P.bmagenta, x + 6, y + 1, 1, 1);
    px(P.bmagenta, x + 1, y + 6, 1, 1);
    px(P.bmagenta, x + 6, y + 6, 1, 1);
  }

  function drawTurret(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.white;
    /* основание */
    px(P.bblue, x + 1, y + 7, 10, 3);
    px(c, x + 2, y + 4, 8, 4);
    /* ствол */
    const dir = e.dir || -1;
    px(P.bcyan, dir > 0 ? x + 9 : x - 2, y + 5, 5, 2);
    /* сенсор */
    px(P.bred, x + 5, y + 2, 2, 2);
    g.fillStyle = P.bred;
    g.fillRect(x + 4, y + 1, 4, 1);
    /* заклёпки */
    px(P.byellow, x + 2, y + 4, 1, 1);
    px(P.byellow, x + 9, y + 4, 1, 1);
  }

  function drawTank(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.bblue;
    px(P.bmagenta, x, y + 8, 16, 4);
    px(c, x + 2, y + 4, 12, 4);
    px(P.bcyan, x + 3, y + 6, 3, 2);
    const dir = e.dir || -1;
    px(P.bred, dir > 0 ? x + 12 : x - 2, y + 5, 6, 2);
    px(P.byellow, x + 6, y + 2, 4, 2);
    /* гусеницы */
    for (let i = 0; i < 16; i += 4) px(P.black, x + i, y + 9, 2, 2);
  }

  function drawMine(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    px(P.bred, x + 1, y + 1, 6, 4);
    px(P.byellow, x + 3, y, 2, 2);
    px(P.bwhite, x + 2, y + 2, 1, 1);
    px(P.black, x + 4, y + 2, 2, 2);
  }

  function drawCrusher(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    px(P.byellow, x + 1, y, 14, 3);
    px(P.bwhite, x, y + 3, 16, 8);
    dither(x, y + 3, 16, 8, P.bwhite, P.yellow, 0);
    px(P.bred, x + 2, y + 11, 12, 3);
    px(P.byellow, x + 5, y + 14, 2, 2);
    px(P.byellow, x + 9, y + 14, 2, 2);
  }

  function drawPod(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const pul = Math.sin(e.anim * 5) > 0 ? 0 : 1;
    px(P.bgreen, x + 1, y + 2, 12, 9);
    px(P.green, x + 2, y + 3, 10, 7);
    dither(x + 2, y + 3, 10, 7, P.bgreen, P.green, pul);
    px(P.bmagenta, x + 2, y + 1, 10, 2);
    /* глаз */
    px(P.byellow, x + 5, y + 5, 4, 4);
    px(P.black, x + 6, y + 6, 2, 2);
    px(P.bwhite, x + 6, y + 6, 1, 1);
    /* корни */
    px(P.bgreen, x + 2, y + 11, 2, 1);
    px(P.bgreen, x + 10, y + 11, 2, 1);
  }

  function drawHomer(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = e.hitT > 0 ? P.bwhite : P.bcyan;
    px(c, x + 2, y + 2, 10, 8);
    px(P.bblue, x + 3, y + 3, 8, 6);
    px(P.bred, x + 5, y + 4, 4, 4);
    px(P.bwhite, x + 6, y + 5, 2, 2);
    px(c, x, y + 4, 2, 2); px(c, x + 12, y + 4, 2, 2);
    /* активность */
    if (Math.sin(e.anim * 6) > 0) px(P.byellow, x + 6, y + 1, 2, 1);
  }

  function drawLauncher(e, combo) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const c = combo ? P.bmagenta : P.bcyan;
    const c2 = combo ? P.bcyan : P.bmagenta;
    px(P.white, x + 1, y + 4, e.w - 2, e.h - 4);
    px(c, x + 2, y + 6, e.w - 4, 4);
    px(c2, x + 2, y + 12, e.w - 4, 2);
    px(P.byellow, x + 3, y, e.w - 6, 4);
    px(P.black, x + 4, y + 1, 2, 2);
    px(P.black, x + e.w - 6, y + 1, 2, 2);
    /* свечение */
    px(c, x, y + 8, 1, 2); px(c, x + e.w - 1, y + 8, 1, 2);
  }

  function drawExoPod(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const pul = Math.sin(e.anim * 4) > 0;
    px(P.bblue, x, y + 18, 16, 2);
    px(P.bcyan, x + 1, y + 2, 14, 16);
    px(pul ? P.cyan : P.bblue, x + 2, y + 3, 12, 14);
    px(P.bwhite, x + 3, y + 4, 10, 5);
    px(P.black, x + 4, y + 5, 8, 3);
    px(P.bcyan, x + 5, y + 6, 2, 1);
    px(P.bcyan, x + 9, y + 6, 2, 1);
    px(P.byellow, x + 6, y + 12, 4, 1);
    px(P.bgreen, x + 7, y + 14, 2, 2);
  }

  function drawTeleporter(e) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const t = Math.floor(e.anim * 6) % 2;
    px(P.bblue, x, y + e.h - 2, e.w, 2);
    for (let i = 0; i < 3; i++) {
      const yy = y + e.h - 6 + i * 2;
      px(t ? P.bcyan : P.bblue, x + 2, yy, e.w - 4, 1);
    }
    px(P.bwhite, x + e.w / 2 - 1, y + 4 + (t ? 1 : 0), 2, 6);
    g.fillStyle = t ? P.bcyan : P.bblue;
    g.fillRect(x + 2, y + 1, e.w - 4, 1);
  }

  function drawPower(e, color) {
    const x = Math.round(e.x), y = Math.round(e.y);
    const bob = Math.sin(e.anim * 5 + e.phase * 6) > 0 ? 0 : 1;
    px(P.white, x, y + 1 + bob, 8, 6);
    px(color, x + 1, y + 2 + bob, 6, 4);
    px(P.black, x + 3, y + 3 + bob, 2, 2);
    px(color, x + 2, y + 7 + bob, 4, 1);
  }

  function drawEntity(e, theme) {
    switch (e.t) {
      case 'walker': drawWalker(e); break;
      case 'flyer': drawFlyer(e); break;
      case 'swarmer': drawSwarmer(e); break;
      case 'turret': drawTurret(e); break;
      case 'tank': drawTank(e); break;
      case 'mine': drawMine(e); break;
      case 'crusher': drawCrusher(e); break;
      case 'pod': drawPod(e); break;
      case 'homer': drawHomer(e); break;
      case 'double_launcher': drawLauncher(e, false); break;
      case 'combo_launcher': drawLauncher(e, true); break;
      case 'power_laser': drawPower(e, P.bcyan); break;
      case 'power_rocket': drawPower(e, P.bmagenta); break;
      case 'exo': drawExoPod(e); break;
      case 'teleporter': drawTeleporter(e); break;
      default: break;
    }
  }

  /* ---------- игрок ---------- */
  function drawPlayer(p) {
    if (!p || !p.alive) return;
    const blink = p.invuln > 0 && p.invuln < 5 && Math.floor(now * 18) % 2 === 0;
    if (blink) return;
    const h = p.duck ? 10 : p.h;
    const x = Math.round(p.x), y = Math.round(p.y + p.h - h);
    const dir = p.facing || 1;
    const suit = p.exo ? P.bcyan : P.bwhite;
    const suit2 = p.exo ? P.cyan : P.cyan;
    if (p.exo) {
      /* экзоскелет: крупный, бронированный */
      px(P.bblue, x, y + h - 3, 14, 3);
      px(suit, x + 1, y + 4, 12, h - 7);
      px(P.cyan, x + 2, y + 5, 10, h - 9);
      px(P.byellow, x + 3, y + 1, 8, 4);
      px(P.black, x + 4, y + 2, 6, 2);
      px(P.bcyan, x + 5, y + 2, 2, 1);
      px(P.bcyan, x + 8, y + 2, 2, 1);
      px(P.bcyan, x + 2, y + h - 5, 3, 4);
      px(P.bcyan, x + 11, y + h - 5, 3, 4);
      px(P.bred, dir > 0 ? x + 13 : x - 1, y + 6, 2, 2);
      return;
    }
    /* Кайр: белый костюм, визор */
    px(suit, x + 2, y + 3, 6, h - 7);
    px(suit2, x + 2, y + 3, 2, h - 7);
    px(P.bcyan, x + 3, y, 4, 4);
    px(P.black, x + 3 + (dir > 0 ? 2 : 0), y + 1, 2, 2);
    px(P.bcyan, x + 2, y + 6, 6, 1);
    /* ноги */
    const ph = Math.floor(p.step * 2) % 2;
    const walking = Math.abs(p.vx) > 6 && p.onGround;
    if (!p.onGround) {
      px(suit, x + 2, y + h - 4, 2, 4);
      px(suit, x + 6, y + h - 4, 2, 4);
    } else if (walking) {
      px(suit, x + 2 + (ph ? 1 : 0), y + h - 4, 2, 4);
      px(suit, x + 6 - (ph ? 1 : 0), y + h - 4, 2, 4);
    } else {
      px(suit, x + 2, y + h - 4, 2, 4);
      px(suit, x + 6, y + h - 4, 2, 4);
    }
    /* бластер */
    px(P.byellow, dir > 0 ? x + 8 : x - 1, y + 6, 3, 2);
  }

  /* ---------- выстрелы / эффекты ---------- */
  function drawShots() {
    const st = PR.state;
    st.shots.forEach(function (s) {
      if (s.grenade) {
        px(P.bwhite, s.x - 2, s.y - 2, 5, 5);
        px(P.byellow, s.x - 1, s.y - 1, 3, 3);
        if (Math.floor(s.spin) % 2) px(P.bred, s.x, s.y - 3, 1, 1);
      } else {
        px(P.bwhite, s.x - 2, s.y - 1, 7, 2);
        px(s.exo ? P.bcyan : P.byellow, s.x, s.y, 5, 1);
      }
    });
    st.eShots.forEach(function (s) {
      if (s.missile) {
        px(P.bred, s.x - 3, s.y - 3, 6, 6);
        px(P.byellow, s.x - 2, s.y - 2, 4, 4);
        px(P.bwhite, s.x - 1, s.y - 1, 2, 2);
        px(P.bmagenta, s.x - 1, s.y + 3, 2, 2);
      } else {
        px(P.bmagenta, s.x - 2, s.y - 2, 4, 4);
        px(P.bwhite, s.x - 1, s.y - 1, 2, 2);
      }
    });
  }

  function drawParticles() {
    const st = PR.state;
    st.particles.forEach(function (p) {
      const a = p.life / (p.max || 1);
      g.globalAlpha = a > 0.5 ? 1 : 0.7;
      px(p.color, p.x - p.size / 2, p.y - p.size / 2, Math.max(1, p.size), Math.max(1, p.size));
      g.globalAlpha = 1;
    });
    st.booms.forEach(function (b) {
      const k = b.t / b.dur;
      const r = 2 + b.r * (0.4 + k * 0.9);
      g.globalAlpha = 1 - k;
      g.strokeStyle = b.color;
      g.lineWidth = 2;
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = P.bwhite;
      g.lineWidth = 1;
      g.beginPath(); g.arc(b.x, b.y, r * 0.65, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    });
    st.pops.forEach(function (p) {
      g.globalAlpha = Math.min(1, p.life / 0.4);
      text(p.text, p.x, p.y - 6, p.color, 1, 'center', '#000');
      g.globalAlpha = 1;
    });
  }

  /* ---------- HUD ---------- */
  function drawHUD() {
    const st = PR.state;
    const p = st.player || { laser: 0, maxLaser: 100, rockets: 0, armor: 0, exo: false };
    const y0 = H;
    px(P.black, 0, y0, W, HUD);
    /* верхняя линия */
    g.fillStyle = P.bblue;
    for (let i = 0; i < W; i += 2) g.fillRect(i, y0, 1, 1);

    /* строка 1 */
    text(PR.t('hud.score'), 4, y0, P.bcyan, 1);
    const scoreX = 4 + textW(PR.t('hud.score'), 1) + 4;
    text(String(st.score).padStart(6, '0'), scoreX, y0, P.bwhite, 1);
    const lifeX = scoreX + 42;
    text('♥', lifeX, y0, P.bred, 1);
    text(String(st.lives), lifeX + 7, y0, P.bred, 1);
    text(PR.t('hud.screen') + ' ' + (st.screen + 1) + '/' + PR.screenCount(st.level), 188, y0, P.byellow, 1, 'right');
    text(PR.t('hud.sector') + ' ' + (st.level + 1) + '/' + PR.levelCount(), 252, y0, P.byellow, 1, 'right');

    /* строка 2 */
    const y1 = y0 + 8;
    text('L', 4, y1, P.bcyan, 1);
    px('#06222a', 12, y1 + 2, 52, 4);
    px(P.bcyan, 12, y1 + 2, Math.round(52 * (p.laser / (p.maxLaser || 100))), 4);
    for (let i = 1; i < 8; i++) px('#001014', 12 + Math.round(52 / 8) * i, y1 + 2, 1, 4);
    /* гранаты — пипсы справа */
    for (let i = 0; i < (p.maxRockets || 6); i++) {
      px(i < p.rockets ? P.bmagenta : '#2a0022', 252 - (i + 1) * 6 + 3, y1 + 2, 4, 4);
    }
    /* броня экзоскелета */
    if (p.exo) {
      text(PR.t('hud.armor'), 72, y1, P.byellow, 1);
      for (let i = 0; i < 3; i++) px(i < p.armor ? P.byellow : '#332a00', 72 + PR.t('hud.armor').length * 6 + 2 + i * 5, y1 + 2, 3, 4);
    }
  }

  /* ---------- оверлеи ---------- */
  function dim(alpha) { g.fillStyle = 'rgba(0,0,0,' + alpha + ')'; g.fillRect(0, 0, W, VH); }

  function drawMessage() {
    const st = PR.state;
    if (!st.message) return;
    const s = PR.t(st.message.key);
    const y = 78;
    const w = textW(s, 1) + 16;
    panel((W - w) / 2, y, w, 13, P.byellow, '#000');
    text(s, W / 2, y + 3, P.byellow, 1, 'center');
  }

  function drawMenus() {
    const st = PR.state;
    const rects = PR.ui.layout();
    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      const label = r.item.label + (r.item.value ? '  ' + r.item.value : '');
      if (sel) {
        px(P.bblue, r.x - 10, r.y, 3, r.h);
        px(P.bblue, r.x + r.w + 7, r.y, 3, r.h);
        px('#000033', r.x, r.y, r.w, r.h);
        g.fillStyle = P.bcyan;
        g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y + r.h - 1, r.w, 1);
      }
      const col = sel ? P.bwhite : P.bcyan;
      if (r.item.value) {
        text(r.item.label, r.x + 3, r.y + 3, col, 1);
        text(r.item.value, r.x + r.w - 3, r.y + 3, sel ? P.byellow : P.bblue, 1, 'right');
      } else {
        text(label, r.x + r.w / 2, r.y + 3, col, 1, 'center');
      }
      if (sel) {
        const ax = r.x - 8, ay = r.y + (r.h >> 1) - 3;
        px(P.byellow, ax + 3, ay, 1, 1);
        px(P.byellow, ax + 2, ay + 1, 2, 1);
        px(P.byellow, ax + 1, ay + 2, 3, 1);
        px(P.byellow, ax + 2, ay + 3, 2, 1);
        px(P.byellow, ax + 3, ay + 4, 1, 1);
      }
    });
  }

  /* ---------- экраны ---------- */
  function drawTitle() {
    const st = PR.state;
    background(themeOf({ theme: 'space' }));
    const logo = 'ПРОРЫВ';
    const colors = [P.byellow, P.bcyan, P.bmagenta, P.bgreen, P.bcyan, P.bwhite];
    const sc = 4;
    const tw = textW(logo, sc);
    const lx = Math.round((W - tw) / 2), ly = 30;
    /* подложка-панель под логотип (до текста!) */
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, ly - 6, W, 6 * sc + 12);
    g.fillStyle = P.bblue;
    g.fillRect(20, ly - 6, W - 40, 1);
    g.fillRect(20, ly + 6 * sc + 5, W - 40, 1);
    /* тень и «свечение» */
    for (let pass = 2; pass >= 0; pass--) {
      for (let i = 0; i < logo.length; i++) {
        const col = pass === 0 ? colors[i] : pass === 1 ? '#331133' : '#112233';
        text(logo[i], lx + i * 6 * sc + pass, ly + pass, col, sc);
      }
    }

    text(PR.t('brand.ru'), W / 2, 98, P.bwhite, 1, 'center', '#000');
    text(PR.t('tagline.full'), W / 2, 108, P.bcyan, 1, 'center', '#000');

    drawMenus();

    /* марширующие пришельцы внизу */
    const baseY = 196;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 34 + now * 14) % (W + 40)) - 20;
      drawWalker({ x: x, y: baseY - 12, dir: 1, anim: now * 2 + i, hitT: 0 });
    }
    /* рекорд */
    text(PR.t('msg.record') + ' ' + String(st.record).padStart(6, '0'), W - 4, 2, P.byellow, 1, 'right');
    text('ГЕФЕСТ', 4, 2, P.blue, 1);
    text(PR.t('menu.hint.quick'), W / 2, VH - 9, P.blue, 1, 'center');
    if (PR.BUILD) text(PR.t('settings.build.short', { v: PR.BUILD }), W / 2, 76, P.bblue, 1, 'center');
  }

  function background(theme) {
    const st = PR.state;
    const world = st.world;
    px('#000000', 0, 0, W, VH);
    if (world) starfield(world.seed || 1, now, theme);
    else {
      const r = rng(7);
      for (let i = 0; i < 40; i++) px(i % 4 ? P.white : P.bcyan, Math.floor(r() * W), Math.floor(r() * H), 1, 1);
    }
  }

  function drawDeathOverlay() {
    const st = PR.state;
    dim(0.25);
    const s = PR.t('msg.dead');
    panel(W / 2 - 64, 78, 128, 22, P.bred, '#000');
    text(s, W / 2, 83, P.bred, 2, 'center', '#000');
    text(PR.t('hud.lives') + ': ' + st.lives, W / 2, 92, P.bwhite, 1, 'center');
  }

  function drawWorld() {
    const st = PR.state;
    const world = st.world;
    if (!world) return;
    const theme = themeOf(world);
    background(theme);
    /* тайлы */
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const id = world.tiles[ty * COLS + tx];
        if (id) drawTile(id, tx, ty, theme, world.seed);
      }
    }
    /* сущности */
    st.ents.forEach(function (e) {
      if (e.dead) return;
      drawEntity(e, theme);
    });
    drawShots();
    drawPlayer(st.player);
    drawParticles();
    drawMessage();

    /* вспышка */
    if (st.fx.flash > 0.01) {
      g.globalAlpha = Math.min(0.55, st.fx.flash);
      px(st.fx.flashColor || '#ffffff', 0, 0, W, H);
      g.globalAlpha = 1;
    }
    /* затвор флип-скрина */
    if (st.transition > 0) {
      const k = st.transition;
      const hh = Math.round(k * k * (H / 2) * 1.1);
      px('#000000', 0, 0, W, hh);
      px('#000000', 0, H - hh, W, hh);
    }
    drawHUD();
  }

  function drawPause() {
    drawWorld();
    dim(0.55);
    panel(42, 34, 172, 132, P.bcyan, '#000');
    text(PR.t('msg.paused'), W / 2, 44, P.byellow, 2, 'center', '#000');
    drawMenus();
    text(PR.t('hint.nav'), W / 2, 150, P.bcyan, 1, 'center');
  }

  function drawHelp() {
    const st = PR.state;
    const world = st.world;
    px('#000000', 0, 0, W, VH);
    starfield((world && world.seed) || 3, now * 0.3, THEMES.space);
    panel(3, 3, W - 6, VH - 6, P.bcyan, 'rgba(0,0,0,0.90)');
    text(PR.t('help.title'), W / 2, 7, P.byellow, 2, 'center', '#000');
    g.fillStyle = P.bblue; g.fillRect(16, 26, W - 32, 1);

    const rows = [
      ['← →  A D', 'key.left.act'], ['↑  W', 'key.jump.act'],
      ['↓  S', 'key.duck.act'], ['SPACE  Z', 'key.fire.act'],
      ['ESC  P', 'key.pause.act'], ['L', 'key.l.act'],
      ['G', 'key.g.act'], ['M', 'key.m.act'],
      ['N', 'key.n.act'], ['F', 'key.f.act']
    ];
    let y = 31;
    rows.forEach(function (r) {
      text(r[0], 8, y, P.byellow, 1);
      text(PR.t(r[1]), 80, y, P.bwhite, 1);
      y += 9;
    });

    g.fillStyle = P.bblue; g.fillRect(16, y - 4, W - 32, 1);
    text(PR.t('hint.title'), 8, y + 1, P.bcyan, 1);
    y += 10;
    wrapMulti(PR.t('help.goal'), 40).forEach(function (l) { text(l, 8, y, P.white, 1); y += 8; });
    y += 3;
    text('*', 6, y, P.byellow, 1);
    wrapMulti(PR.t('hint.ammo'), 39).forEach(function (l) { text(l, 14, y, P.white, 1); y += 8; });
    y += 3;
    text('*', 6, y, P.byellow, 1);
    wrapMulti(PR.t('hint.teleport'), 39).forEach(function (l) { text(l, 14, y, P.white, 1); y += 8; });
    text(PR.t('help.back'), W / 2, VH - 11, P.byellow, 1, 'center');
  }

  function drawAbout() {
    px('#000000', 0, 0, W, VH);
    starfield(9, now * 0.2, THEMES.space);
    panel(4, 4, W - 8, VH - 8, P.bmagenta, 'rgba(0,0,0,0.90)');
    text(PR.t('brand'), W / 2, 10, P.byellow, 3, 'center', '#000');
    text(PR.t('tagline'), W / 2, 38, P.bcyan, 1, 'center');
    g.fillStyle = P.bblue; g.fillRect(20, 48, W - 40, 1);
    let y = 53;
    wrapMulti(PR.t('about.text'), 40).forEach(function (l) { text(l, 7, y, P.white, 1); y += 9; });
    y += 5;
    text(PR.t('credits.original'), W / 2, y, P.byellow, 1, 'center'); y += 8;
    text(PR.t('credits.port'), W / 2, y, P.bcyan, 1, 'center'); y += 8;
    wrapMulti(PR.t('credits.thanks'), 40).forEach(function (l) { text(l, W / 2, y, P.bblue, 1, 'center'); y += 8; });
    wrapMulti(PR.t('credits.fan'), 39).forEach(function (l) { text(l, W / 2, y, P.bblue, 1, 'center'); y += 8; });
    text(PR.t('help.back'), W / 2, VH - 10, P.byellow, 1, 'center');
  }

  function drawSettings() {
    const st = PR.state;
    drawWorld();
    dim(0.72);
    panel(20, 34, W - 40, 146, P.bcyan, '#000');
    text(PR.t('settings.title'), W / 2, 38, P.byellow, 2, 'center', '#000');
    const rects = PR.ui.layout();
    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      const x = r.x - 16, w = r.w + 32;
      if (sel) {
        px('#001133', x, r.y, w, r.h);
        g.fillStyle = P.bcyan;
        g.fillRect(x, r.y, w, 1); g.fillRect(x, r.y + r.h - 1, w, 1);
      }
      if (r.item.key === 'back') {
        text(r.item.value || 'ESC', W / 2, r.y + 3, sel ? P.bwhite : P.bblue, 1, 'center');
        return;
      }
      text(r.item.label, x + 4, r.y + 3, sel ? P.bwhite : P.bcyan, 1);
      text(r.item.value || '', x + w - 4, r.y + 3, sel ? P.byellow : P.bblue, 1, 'right');
      if (sel) {
        const ax = x + w + 3, ay = r.y + (r.h >> 1) - 3;
        px(P.byellow, ax, ay + 2, 3, 1);
        px(P.byellow, ax + 3, ay + 1, 1, 3);
        px(P.byellow, ax, ay + 2, 1, 1);
        px(P.byellow, ax + 1, ay + 3, 2, 1);
      }
    });
    if (st.resetAsk > 0) text(PR.t('settings.resetConfirm'), W / 2, 172, P.bred, 1, 'center');
    else text(PR.t('msg.paused.hint'), W / 2, 172, P.blue, 1, 'center');
  }

  function drawBriefing() {
    const st = PR.state;
    const lv = PR.levelData(st.level) || { name: { ru: '', en: '' }, intro: { ru: '', en: '' }, theme: 'space' };
    const theme = THEMES[lv.theme] || THEMES.space;
    px('#000000', 0, 0, W, VH);
    starfield((st.world && st.world.seed) || 1, now * 0.25, THEMES.space);
    panel(4, 4, W - 8, VH - 8, P.bcyan, 'rgba(0,0,0,0.84)');

    text(PR.t('hud.sector') + '  ' + (st.level + 1) + ' / ' + PR.levelCount(), W / 2, 10, theme.accent, 1, 'center');
    const name = (lv.name[PR.settings.lang] || lv.name.ru || '').toUpperCase();
    const nsc = name.length > 16 ? 1 : 2;
    text(name, W / 2, 20, P.byellow, nsc, 'center', '#000');
    text(PR.t('level.screens', { n: PR.screenCount(st.level) }), W / 2, 40, P.bblue, 1, 'center');
    g.fillStyle = P.bblue; g.fillRect(18, 49, W - 36, 1);

    let y = 55;
    wrapMulti(lv.intro[PR.settings.lang] || lv.intro.ru, 40).forEach(function (l) { text(l, 10, y, P.white, 1); y += 8; });
    y += 4;
    ['hint.grenade', 'hint.exo'].forEach(function (k) {
      text('*', 6, y, P.byellow, 1);
      wrapMulti(PR.t(k), 39).forEach(function (l) { text(l, 13, y, P.bcyan, 1); y += 8; });
      y += 2;
    });

    /* декоративная цифра сектора и иконки противников */
    text(String(st.level + 1), 214, 128, '#1a1a33', 5);
    const base = 58;
    drawWalker({ x: base, y: 158, dir: 1, anim: now + 0.5, hitT: 0 });
    drawFlyer({ x: base + 30, y: 158, dir: 1, anim: now + 0.2, hitT: 0 });
    drawTurret({ x: base + 60, y: 160, dir: -1, hitT: 0 });
    drawPod({ x: base + 86, y: 158, anim: now + 0.9, hitT: 0 });

    if (Math.floor(now * 2) % 2 === 0) {
      text(PR.t('level.start'), W / 2, 178, P.byellow, 1, 'center');
    }
    drawHUD();
  }

  function drawBonus() {
    const st = PR.state;
    drawWorld();
    dim(0.7);
    const b = st.bonus;
    if (!b) return;
    panel(16, 34, W - 32, 134, P.byellow, '#000');
    text(PR.t('msg.bonus'), W / 2, 40, P.byellow, 2, 'center', '#000');
    const bx = [42, 84, 126, 168];
    if (b.phase === 'pick') {
      for (let i = 0; i < b.values.length; i++) {
        const x = bx[i];
        const on = i === b.index;
        panel(x, 66, 30, 24, on ? P.bwhite : P.bblue, on ? '#002244' : '#000');
        text(String(b.values[i]), x + 15, 74, on ? P.bwhite : P.bcyan, 1, 'center');
        if (on) text('▼', x + 15, 58, P.byellow, 1, 'center');
      }
      text(PR.t('msg.bonus.pick'), W / 2, 104, P.byellow, 1, 'center');
      text(PR.t('msg.bonus.pick2'), W / 2, 116, P.bwhite, 1, 'center');
    } else {
      text(String(b.chosen), W / 2, 68, P.bwhite, 3, 'center', '#111');
      text(PR.t('msg.bonus.lives') + ' → ' + b.livesBonus, W / 2, 100, P.bcyan, 1, 'center');
      text(b.noExoBonus ? PR.t('msg.bonus.noexo') : PR.t('msg.bonus.exo'), W / 2, 112, b.noExoBonus ? P.bgreen : P.bred, 1, 'center');
      if (b.extraLife) text(PR.t('msg.bonus.extra'), W / 2, 124, P.byellow, 1, 'center');
    }
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 140, P.byellow, 1, 'center');
  }

  function bigCentered(str, y, color, scale) {
    text(str, W / 2, y, color, scale || 3, 'center', '#111');
  }

  function drawLevelClear() {
    const st = PR.state;
    drawWorld();
    dim(0.6);
    bigCentered(PR.t('msg.levelclear'), 62, P.byellow, 2);
    text(PR.t('hud.sector') + ' ' + (st.level + 1), W / 2, 90, P.bcyan, 1, 'center');
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 104, P.bwhite, 1, 'center');
    if (Math.floor(now * 6) % 2 === 0) text('...', W / 2, 120, P.byellow, 2, 'center');
  }

  function drawGameOver() {
    const st = PR.state;
    drawWorld();
    dim(0.78);
    panel(20, 38, 216, 142, P.bred, '#000');
    bigCentered(PR.t('msg.gameover'), 46, P.bred, 2);
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 74, P.bwhite, 1, 'center');
    text(PR.t('msg.record') + ' ' + st.record, W / 2, 86, P.byellow, 1, 'center');
    if (st.newRecord) text(PR.t('msg.newrecord'), W / 2, 98, P.bgreen, 1, 'center');
    drawMenus();
  }

  function drawWin() {
    const st = PR.state;
    px('#000000', 0, 0, W, VH);
    starfield(11, now * 0.5, THEMES.space);
    /* фейерверк */
    for (let i = 0; i < 5; i++) {
      const t = (now * 0.8 + i * 0.7) % 1;
      const cx = 30 + ((i * 53 + 20) % 200);
      const cy = 30 + ((i * 31) % 70);
      const r = t * 34;
      g.globalAlpha = 1 - t;
      g.strokeStyle = [P.byellow, P.bcyan, P.bmagenta, P.bgreen][i % 4];
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    }
    const winT = PR.t('msg.win');
    bigCentered(winT, 40, P.byellow, textW(winT, 3) > 244 ? 2 : 3);
    text(PR.t('msg.win.sub'), W / 2, 76, P.bcyan, 1, 'center');
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 96, P.bwhite, 2, 'center');
    text(PR.t('msg.record') + ' ' + st.record, W / 2, 118, P.byellow, 1, 'center');
    if (st.newRecord) text(PR.t('msg.newrecord'), W / 2, 130, P.bgreen, 1, 'center');
    drawMenus();
    text(PR.t('credits.original'), W / 2, VH - 12, P.blue, 1, 'center');
  }

  /* ---------- главный вход ---------- */
  function draw(ctx, view) {
    g = ctx;
    now = (view && view.t) || PR.state.t;
    const st = PR.state;
    g.save();
    g.imageSmoothingEnabled = false;
    const shake = st.fx.shake;
    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
    const sy = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
    g.translate(sx, sy);

    switch (st.mode) {
      case 'title': drawTitle(); break;
      case 'help': drawHelp(); break;
      case 'about': drawAbout(); break;
      case 'settings': drawSettings(); break;
      case 'briefing': drawBriefing(); break;
      case 'play': drawWorld(); break;
      case 'dead': drawWorld(); drawDeathOverlay(); break;
      case 'paused': drawPause(); break;
      case 'bonus': drawBonus(); break;
      case 'levelclear': drawLevelClear(); break;
      case 'gameover': drawGameOver(); break;
      case 'win': drawWin(); break;
      default:
        px('#000000', 0, 0, W, VH);
        text('ПРОРЫВ', W / 2, 90, P.bwhite, 3, 'center');
        break;
    }
    g.restore();

    /* затемнение по краям — «кинескоп» */
    const grad = g.createRadialGradient(W / 2, VH / 2, 60, W / 2, VH / 2, 180);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, VH);
  }

  window.PR_RENDER_RETRO = { draw: draw, W: W, H: VH };
})();

/* ==== src/render-modern.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — MODERN-рендерер «NEON 2026»
   Тот же мир 256×208, но векторная неоновая графика: свечение,
   параллакс, частицы, стеклянный HUD, современная типографика.
   Координаты — логические (1 юнит = 1 «пиксель» 8-битного экрана), масштаб
   задаёт main.js через transform.
   ============================================================ */
(function () {
  'use strict';

  const PR = window.PR;
  const N = PR.NEON;
  const TILE = 8, COLS = 32, ROWS = 24, W = 256, H = 192, HUD = 16, VH = 208;

  const UI_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const HEAD_FONT = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';

  let g = null;
  let V = null;
  let t = 0;
  const S = () => PR.state;

  /* ---------- палитры тем ---------- */
  const THEMES = {
    space:   { a: '#39f6ff', b: '#8a5cff', c: '#b6ff3c', slab: '#111a3c', slab2: '#0a1026', edge: '#2f4a8f', fog: '#0a0f26', hazard: '#ff3ff0' },
    cavern:  { a: '#b6ff3c', b: '#7affd8', c: '#ffcc55', slab: '#14200f', slab2: '#0a1408', edge: '#3c6f2a', fog: '#0a1408', hazard: '#ff9f3c' },
    reactor: { a: '#ffcc55', b: '#ff7a3c', c: '#39f6ff', slab: '#1e1608', slab2: '#130e04', edge: '#7a5a1c', fog: '#120c04', hazard: '#ff3b3b' },
    hive:    { a: '#ff3ff0', b: '#b6ff3c', c: '#8a5cff', slab: '#1c0a1c', slab2: '#120612', edge: '#6a2a66', fog: '#140614', hazard: '#ffcc55' },
    core:    { a: '#ff4d6d', b: '#39f6ff', c: '#ffcc55', slab: '#1e0a14', slab2: '#13060c', edge: '#7a2438', fog: '#140610', hazard: '#ffffff' }
  };
  const th = () => THEMES[(S().world && S().world.theme) || 'space'] || THEMES.space;

  /* ---------- утилиты рисования ---------- */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function frect(x, y, w, h, style) { g.fillStyle = style; g.fillRect(x, y, w, h); }
  function strokeRR(x, y, w, h, r, color, lw) {
    rr(x, y, w, h, r);
    g.strokeStyle = color; g.lineWidth = lw || 1; g.stroke();
  }
  function text(str, x, y, size, color, align, weight, track, family) {
    g.font = (weight || '600') + ' ' + size + 'px ' + (family || UI_FONT);
    g.fillStyle = color;
    g.textAlign = align || 'left';
    g.textBaseline = 'middle';
    const tr = track || 0;
    if (tr) { try { g.letterSpacing = tr + 'px'; } catch (e) { /* ok */ } }
    g.fillText(str, x, y);
    if (tr) { try { g.letterSpacing = '0px'; } catch (e) { /* ok */ } }
  }
  function glowText(str, x, y, size, color, align, weight, blur, family) {
    g.save();
    g.shadowColor = color;
    g.shadowBlur = blur || 10;
    text(str, x, y, size, color, align, weight, 0, family);
    g.restore();
  }
  function textW(str, size, weight, track) {
    g.font = (weight || '600') + ' ' + size + 'px ' + UI_FONT;
    return g.measureText(str).width + (track || 0) * String(str).length;
  }
  function wrapMulti(str, size, maxW, weight) {
    const out = [];
    String(str).split('\n').forEach(function (par) {
      if (!par.trim()) { out.push(''); return; }
      wrap(par, size, maxW, weight).forEach(function (l) { out.push(l); });
    });
    return out;
  }

  function wrap(str, size, maxW, weight) {
    const words = String(str).split(' ');
    const out = [];
    let line = '';
    g.font = (weight || '400') + ' ' + size + 'px ' + UI_FONT;
    words.forEach(function (w) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = w; }
      else line = test;
    });
    if (line) out.push(line);
    return out;
  }
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vline(x1, y1, x2, y2, color, lw) {
    g.strokeStyle = color; g.lineWidth = lw || 1;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  function dot(x, y, r, color) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function glowDot(x, y, r, color, blur) {
    g.save(); g.shadowColor = color; g.shadowBlur = blur || 6;
    dot(x, y, r, color); g.restore();
  }

  /* ---------- фон ---------- */
  function fullBg() {
    const cw = V.cw, ch = V.ch;
    const grad = g.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#080517');
    grad.addColorStop(0.45, '#0a0722');
    grad.addColorStop(1, '#04030c');
    g.fillStyle = grad; g.fillRect(0, 0, cw, ch);

    /* аврора-пятна */
    const blobs = [
      { x: cw * 0.18, y: ch * 0.22, r: cw * 0.34, c: 'rgba(90,60,255,0.18)' },
      { x: cw * 0.82, y: ch * 0.3, r: cw * 0.3, c: 'rgba(0,220,255,0.12)' },
      { x: cw * 0.5, y: ch * 1.02, r: cw * 0.45, c: 'rgba(255,40,200,0.10)' }
    ];
    blobs.forEach(function (b) {
      const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, b.c); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, cw, ch);
    });

    /* звёзды с параллаксом */
    for (let layer = 0; layer < 3; layer++) {
      const count = [70, 40, 22][layer];
      const speed = [4, 9, 16][layer];
      const alpha = [0.35, 0.55, 0.9][layer];
      for (let i = 0; i < count; i++) {
        const sx = hash(i, layer) * cw;
        const sy = ((hash(i, layer + 7) * ch) + t * speed) % ch;
        g.globalAlpha = alpha;
        dot(sx, sy, layer === 2 ? 1.6 : 1, layer === 1 ? '#9ef9ff' : '#e8e6ff');
        g.globalAlpha = 1;
      }
    }

    /* перспективная сетка снизу */
    g.save();
    g.globalAlpha = 0.16;
    g.strokeStyle = '#39f6ff';
    g.lineWidth = 1;
    const horizon = ch * 0.72;
    for (let i = -12; i <= 12; i++) {
      g.beginPath();
      g.moveTo(cw / 2 + i * 16, ch);
      g.lineTo(cw / 2 + i * cw * 0.06, horizon);
      g.stroke();
    }
    for (let i = 1; i < 10; i++) {
      const y = horizon + Math.pow(i / 10, 2.1) * (ch - horizon);
      g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke();
    }
    g.restore();
  }

  function stageBackdrop() {
    const T = th();
    /* глубина сцены */
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, T.fog);
    grad.addColorStop(1, '#03020a');
    g.fillStyle = grad; g.fillRect(0, 0, W, VH);

    /* звёзды внутри сцены */
    const seed = (S().world && S().world.seed) || 1;
    for (let i = 0; i < 34; i++) {
      const x = (hash(i, seed) * W + t * (2 + (i % 3) * 3)) % W;
      const y = hash(i + 40, seed) * H;
      g.globalAlpha = 0.25 + (i % 5) * 0.11;
      dot(x, y, i % 7 === 0 ? 1.3 : 0.7, T.b);
      g.globalAlpha = 1;
    }
    /* дальний «горизонт» */
    g.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = 120 + i * 14;
      g.strokeStyle = i % 2 ? 'rgba(120,90,255,0.06)' : 'rgba(57,246,255,0.05)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.globalAlpha = 1;
    /* тематические детали дальнего плана */
    const theme = (S().world && S().world.theme) || 'space';
    g.save();
    if (theme === 'space') {
      /* далёкая станция и планета */
      g.globalAlpha = 0.16;
      g.strokeStyle = T.b; g.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        const x = 170 + i * 7, y = 24 + (i % 2) * 5;
        g.strokeRect(x, y, 6, 4);
      }
      const px = 34, py = 30;
      g.globalAlpha = 0.2;
      const pg = g.createRadialGradient(px, py, 2, px, py, 22);
      pg.addColorStop(0, T.b); pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, 22, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.5; dot(px, py, 6, T.a);
    } else if (theme === 'cavern') {
      g.globalAlpha = 0.22;
      g.strokeStyle = T.a; g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const x = 10 + i * 44;
        g.beginPath();
        g.moveTo(x, 0); g.lineTo(x + 10, 14 + (i % 3) * 9); g.lineTo(x + 20, 0); g.stroke();
        g.beginPath();
        g.moveTo(x + 6, H); g.lineTo(x + 16, H - 16 - (i % 2) * 10); g.lineTo(x + 26, H); g.stroke();
      }
    } else if (theme === 'reactor') {
      g.globalAlpha = 0.18;
      g.strokeStyle = T.a; g.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) {
        const x = 24 + i * 62;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 88); g.stroke();
        g.beginPath(); g.arc(x, 88, 7, 0, Math.PI, false); g.stroke();
      }
      g.globalAlpha = 0.1;
      for (let y = 0; y < 100; y += 16) frect(0, y, W, 1, T.a);
    } else if (theme === 'hive') {
      g.globalAlpha = 0.2;
      g.strokeStyle = T.b; g.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const x = 20 + i * 50, y = 26 + (i % 3) * 18, r = 14 + (i % 2) * 8;
        g.beginPath(); g.ellipse(x, y, r, r * 0.6, 0.3, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(x + 4, y + 3, r * 0.55, r * 0.35, 0.3, 0, Math.PI * 2); g.stroke();
      }
    } else if (theme === 'core') {
      g.globalAlpha = 0.22;
      g.strokeStyle = T.a; g.lineWidth = 0.9;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(W / 2, 78, 26 + i * 16 + pulse * 3, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 0.08;
      frect(W / 2 - 1, 0, 2, H, T.a);
      frect(0, 78, W, 1.5, T.a);
    }
    g.restore();
    g.globalAlpha = 1;
    /* пульс темы */
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    g.globalAlpha = 0.05 + pulse * 0.04;
    const rg = g.createRadialGradient(W / 2, H * 0.7, 10, W / 2, H * 0.7, 160);
    rg.addColorStop(0, T.a); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, VH);
    g.globalAlpha = 1;
  }

  /* ---------- тайлы ---------- */
  function tileSolid(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    const hs = hash(tx, ty);
    g.fillStyle = T.slab;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = T.slab2;
    g.fillRect(x, y + 5, TILE, 3);
    /* верхняя кромка светится, если сверху пусто */
    if (PR.tileAt(tx, ty - 1) === PR.TILES.EMPTY || PR.tileAt(tx, ty - 1) === PR.TILES.FLORA) {
      g.strokeStyle = T.a;
      g.globalAlpha = 0.85;
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, y + 0.5); g.lineTo(x + TILE, y + 0.5); g.stroke();
      g.globalAlpha = 0.16;
      g.fillStyle = T.a; g.fillRect(x, y, TILE, 2.2);
      g.globalAlpha = 1;
    }
    /* заклёпки/панель */
    if (hs > 0.72) { g.globalAlpha = 0.5; dot(x + 2, y + 4.5, 0.6, T.edge); dot(x + 6, y + 4.5, 0.6, T.edge); g.globalAlpha = 1; }
    if (hs < 0.18) { g.globalAlpha = 0.35; vline(x + 4, y + 2, x + 4, y + 6, T.edge, 0.7); g.globalAlpha = 1; }
  }

  function tileRock(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    g.beginPath();
    g.moveTo(x + 0.5, y + 2);
    g.lineTo(x + 2.5, y + 0.5);
    g.lineTo(x + 6.5, y + 1.2);
    g.lineTo(x + 7.5, y + 4.5);
    g.lineTo(x + 5.5, y + 7.5);
    g.lineTo(x + 2, y + 7);
    g.lineTo(x + 0.3, y + 4.5);
    g.closePath();
    const grad = g.createLinearGradient(x, y, x + TILE, y + TILE);
    grad.addColorStop(0, '#2a1230');
    grad.addColorStop(1, '#140a1c');
    g.fillStyle = grad; g.fill();
    g.strokeStyle = T.b; g.lineWidth = 0.7; g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1;
    g.globalAlpha = 0.6;
    vline(x + 2.5, y + 2, x + 4, y + 5, T.b, 0.6);
    g.globalAlpha = 1;
  }

  function tileThin(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = T.c; g.globalAlpha = 0.9; g.fillRect(x, y, TILE, 1.1); g.globalAlpha = 1;
    g.globalAlpha = 0.45;
    for (let i = 1; i < TILE; i += 3) { dot(x + i, y + 2.4, 0.5, T.c); }
    g.globalAlpha = 1;
  }

  function tileSpike(tx, ty, T) {
    const x = tx * TILE, y = ty * TILE;
    g.fillStyle = T.hazard;
    g.globalAlpha = 0.9;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(x + i * 3 + 0.5, y + 8);
      g.lineTo(x + i * 3 + 1.5, y + 2.5);
      g.lineTo(x + i * 3 + 2.5, y + 8);
      g.fill();
    }
    g.globalAlpha = 0.25; g.fillRect(x, y + 7, TILE, 1); g.globalAlpha = 1;
  }

  function tileFlora(tx, ty, T) {
    const x = tx * TILE + 4, y = ty * TILE + 8;
    const h = 4 + hash(tx, ty) * 5;
    g.strokeStyle = T.c; g.lineWidth = 0.8; g.globalAlpha = 0.75;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x - 1.5, y - h * 0.6, x - 0.4, y - h);
    g.stroke();
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 1.8, y - h * 0.5, x + 1, y - h * 0.9);
    g.stroke();
    g.globalAlpha = 1;
    glowDot(x - 0.4, y - h, 0.9, T.c, 5);
  }

  function drawTiles(T) {
    const tiles = S().world.tiles;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const id = tiles[ty * COLS + tx];
        if (!id) continue;
        if (id === PR.TILES.SOLID) tileSolid(tx, ty, T);
        else if (id === PR.TILES.ROCK) tileRock(tx, ty, T);
        else if (id === PR.TILES.THIN) tileThin(tx, ty, T);
        else if (id === PR.TILES.SPIKE) tileSpike(tx, ty, T);
        else if (id === PR.TILES.FLORA) tileFlora(tx, ty, T);
      }
    }
  }

  /* ---------- враги ---------- */
  function drawWalker(e, T) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    const c = e.hitT > 0 ? '#ffffff' : '#b6ff3c';
    g.save();
    g.translate(x, y);
    g.scale(e.dir > 0 ? 1 : -1, 1);
    const step = Math.sin(e.anim * 8) * 0.9;
    g.strokeStyle = c; g.lineWidth = 1.1; g.globalAlpha = 0.95;
    /* ноги */
    for (let i = -1; i <= 1; i += 2) {
      g.beginPath();
      g.moveTo(i * 2, 3);
      g.lineTo(i * 4 + (i > 0 ? step : -step), 6);
      g.stroke();
    }
    /* тело */
    g.beginPath();
    g.ellipse(0, 0, 6, 4.2, 0, 0, Math.PI * 2);
    g.fillStyle = 'rgba(182,255,60,0.14)'; g.fill();
    g.strokeStyle = c; g.lineWidth = 1.1; g.stroke();
    /* глаза */
    glowDot(1.8, -1, 1.3, '#ffcc55', 6);
    glowDot(4.2, -1.2, 0.9, '#ffcc55', 5);
    /* шипы */
    g.strokeStyle = '#ff3ff0'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-2, -4); g.lineTo(-1, -6.2); g.moveTo(2, -4.4); g.lineTo(3.4, -6.4); g.stroke();
    g.restore();
  }

  function drawFlyer(e, T) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    const c = e.hitT > 0 ? '#ffffff' : '#ff3ff0';
    const flap = Math.sin(e.anim * 13) * 2.2;
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(255,63,240,0.16)';
    g.beginPath();
    g.moveTo(-8, flap - 1); g.quadraticCurveTo(-3, -4, 0, 0);
    g.quadraticCurveTo(3, -4, 8, flap - 1); g.quadraticCurveTo(2, 3, 0, 4);
    g.quadraticCurveTo(-2, 3, -8, flap - 1); g.closePath(); g.fill();
    g.strokeStyle = c; g.lineWidth = 1; g.stroke();
    glowDot(0, -1, 1.5, '#39f6ff', 7);
    g.restore();
  }

  function drawSwarmer(e) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    g.save(); g.translate(x, y + Math.sin(e.anim * 9) * 0.6);
    const c = e.hitT > 0 ? '#ffffff' : '#ffcc55';
    /* лапки */
    g.strokeStyle = c; g.lineWidth = 0.7; g.globalAlpha = 0.85;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + e.anim * 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 2.6, Math.sin(a) * 2.2); g.stroke();
    }
    /* тело */
    g.globalAlpha = 0.95;
    g.fillStyle = 'rgba(255,204,85,0.22)';
    g.beginPath(); g.ellipse(0, 0, 2.6, 2, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = c; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = c;
    dot(-1.3, -0.6, 0.5, '#ffffff');
    dot(1.3, -0.6, 0.5, '#ffffff');
    g.globalAlpha = 1;
    g.restore();
    g.save(); g.shadowColor = '#ffcc55'; g.shadowBlur = 6; dot(x, y, 0.9, '#ffcc55'); g.restore();
  }

  function drawTurret(e, T) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const dir = e.dir || -1;
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(20,24,52,0.9)';
    g.beginPath();
    g.moveTo(-6, 4); g.lineTo(-4, -4); g.lineTo(4, -4); g.lineTo(6, 4); g.closePath(); g.fill();
    g.strokeStyle = e.hitT > 0 ? '#fff' : '#8a9bd8'; g.lineWidth = 0.9; g.stroke();
    /* ствол */
    g.strokeStyle = '#ff4d6d'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(dir * 2, -1); g.lineTo(dir * 8, -1); g.stroke();
    glowDot(0, 0, 1.6, '#ff4d6d', 8);
    g.restore();
  }

  function drawTank(e, T) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const dir = e.dir || -1;
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(30,40,80,0.95)';
    rr(-8, -2, 16, 7, 1.5); g.fill();
    g.strokeStyle = '#39f6ff'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = 'rgba(57,246,255,0.25)';
    rr(-5, -5, 10, 4, 1.2); g.fill();
    g.strokeStyle = '#ffcc55'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(dir * 2, -3); g.lineTo(dir * 9, -3); g.stroke();
    glowDot(0, -3, 1.3, '#ffcc55', 6);
    g.restore();
  }

  function drawMine(e) {
    const cx = e.x + 4, cy = e.y + 3;
    const danger = Math.sin(e.anim * (e.timer < 0.4 ? 22 : 4)) > 0;
    g.save(); g.translate(cx, cy);
    g.strokeStyle = danger ? '#ff4d6d' : '#7c74a8'; g.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + e.anim * 0.6;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 4.4, Math.sin(a) * 4.4); g.stroke();
    }
    glowDot(0, 0, 1.7, danger ? '#ff4d6d' : '#ffcc55', 7);
    g.restore();
  }

  function drawCrusher(e) {
    const x = e.x, y = e.y, w = e.w, h = e.h;
    /* направляющие */
    g.strokeStyle = 'rgba(255,204,85,0.3)'; g.lineWidth = 0.6;
    vline(x + 2.5, y - 12, x + 2.5, y + 2, 'rgba(255,204,85,0.3)', 0.6);
    vline(x + w - 2.5, y - 12, x + w - 2.5, y + 2, 'rgba(255,204,85,0.3)', 0.6);
    /* корпус */
    g.fillStyle = 'rgba(26,20,10,0.92)';
    rr(x + 1, y, w - 2, h - 7, 1); g.fill();
    g.strokeStyle = 'rgba(255,204,85,0.55)'; g.lineWidth = 0.8;
    rr(x + 1, y, w - 2, h - 7, 1); g.stroke();
    /* предупреждающие полосы */
    g.save();
    g.beginPath(); g.rect(x + 2, y + 2, w - 4, 3); g.clip();
    for (let i = -4; i < w + 4; i += 4) {
      g.strokeStyle = 'rgba(255,204,85,0.5)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x + i, y + 5.5); g.lineTo(x + i + 4, y + 1); g.stroke();
    }
    g.restore();
    /* боёк */
    g.fillStyle = '#ffcc55'; g.globalAlpha = 0.92;
    rr(x + 1.5, y + h - 7, w - 3, 4.5, 1); g.fill();
    g.globalAlpha = 1;
    glowDot(x + w / 2, y + h - 4.5, 1.1, '#ff4d6d', 7);
  }

  function drawPod(e, T) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const pulse = 0.5 + 0.5 * Math.sin(e.anim * 4);
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(140,255,60,0.12)';
    rr(-6, -5, 12, 11, 5); g.fill();
    g.strokeStyle = e.hitT > 0 ? '#fff' : '#b6ff3c'; g.lineWidth = 1; g.stroke();
    g.globalAlpha = 0.5 + pulse * 0.5;
    glowDot(0, 0, 2.2 + pulse, '#ff3ff0', 9);
    g.globalAlpha = 1;
    g.restore();
  }

  function drawHomer(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    g.save(); g.translate(cx, cy); g.rotate(e.anim * 0.8);
    g.fillStyle = 'rgba(20,50,70,0.9)';
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 - Math.PI / 2;
      const x = Math.cos(a) * 6, y = Math.sin(a) * 6;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    g.strokeStyle = e.hitT > 0 ? '#fff' : '#39f6ff'; g.lineWidth = 0.9; g.stroke();
    g.restore();
    glowDot(cx, cy, 1.8, '#ff4d6d', 8);
  }

  function drawLauncher(e, combo, T) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    const c = combo ? '#ff3ff0' : '#39f6ff';
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(18,14,40,0.9)';
    g.fillRect(-5, -2, 10, e.h - 6);
    g.strokeStyle = c; g.lineWidth = 0.9; g.strokeRect(-5, -2, 10, e.h - 6);
    /* голограмма */
    g.globalAlpha = 0.6 + 0.4 * Math.sin(e.anim * 3);
    g.fillStyle = c;
    g.fillRect(-4, -6, 8, 3);
    g.globalAlpha = 1;
    glowDot(0, -2, 2.1, c, 9);
    g.restore();
  }

  function drawPower(e, color) {
    const bob = Math.sin(e.anim * 4 + e.phase * 6) * 1.2;
    const cx = e.x + 4, cy = e.y + 4 + bob;
    g.save();
    g.translate(cx, cy); g.rotate(Math.sin(e.anim * 2) * 0.2);
    rr(-2.6, -3.6, 5.2, 7.2, 1.2);
    g.fillStyle = 'rgba(10,8,24,0.9)'; g.fill();
    g.strokeStyle = color; g.lineWidth = 0.9; g.stroke();
    g.globalAlpha = 0.75; g.fillStyle = color; g.fillRect(-1.2, -2.2, 2.4, 4.4); g.globalAlpha = 1;
    g.restore();
    g.save(); g.shadowColor = color; g.shadowBlur = 8; dot(cx, cy, 1.2, color); g.restore();
  }

  function drawExoPod(e) {
    const x = e.x + e.w / 2, y = e.y;
    const pulse = 0.5 + 0.5 * Math.sin(e.anim * 2.4);
    g.save();
    /* луч */
    const lg = g.createLinearGradient(0, y - 30, 0, y + 4);
    lg.addColorStop(0, 'rgba(57,246,255,0)');
    lg.addColorStop(1, 'rgba(57,246,255,' + (0.12 + pulse * 0.1) + ')');
    g.fillStyle = lg; g.fillRect(x - 7, y - 30, 14, 34);
    /* капсула */
    rr(x - 7, y + 1, 14, e.h - 1, 3);
    g.fillStyle = 'rgba(12,26,50,0.95)'; g.fill();
    g.strokeStyle = '#39f6ff'; g.lineWidth = 1; g.stroke();
    g.globalAlpha = 0.55 + pulse * 0.35;
    rr(x - 4.5, y + 5, 9, e.h - 12, 2);
    g.fillStyle = 'rgba(57,246,255,0.35)'; g.fill();
    g.globalAlpha = 1;
    glowDot(x, y + e.h / 2, 1.6, '#b6ff3c', 8);
    g.restore();
  }

  function drawTeleporter(e, T) {
    const cx = e.x + e.w / 2, base = e.y + e.h;
    g.save();
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.7 + i / 3) % 1);
      const y = base - 2 - k * (e.h - 4);
      g.globalAlpha = 0.6 * (1 - k);
      g.strokeStyle = T.a; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(cx, y, 5 - k * 1.5, 1.6 - k * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(57,246,255,0.15)';
    g.fillRect(cx - 5, base - 2, 10, 2);
    g.strokeStyle = T.a; g.lineWidth = 0.9;
    g.strokeRect(cx - 5, base - 2, 10, 2);
    g.restore();
  }

  function drawEntity(e, T) {
    switch (e.t) {
      case 'walker': drawWalker(e, T); break;
      case 'flyer': drawFlyer(e, T); break;
      case 'swarmer': drawSwarmer(e); break;
      case 'turret': drawTurret(e, T); break;
      case 'tank': drawTank(e, T); break;
      case 'mine': drawMine(e); break;
      case 'crusher': drawCrusher(e); break;
      case 'pod': drawPod(e, T); break;
      case 'homer': drawHomer(e); break;
      case 'double_launcher': drawLauncher(e, false, T); break;
      case 'combo_launcher': drawLauncher(e, true, T); break;
      case 'power_laser': drawPower(e, T.a); break;
      case 'power_rocket': drawPower(e, '#ff3ff0'); break;
      case 'exo': drawExoPod(e); break;
      case 'teleporter': drawTeleporter(e, T); break;
      default: break;
    }
  }

  /* ---------- игрок ---------- */
  function drawPlayer(p, T) {
    if (!p || !p.alive) return;
    if (p.invuln > 0 && p.invuln < 5 && Math.floor(t * 18) % 2 === 0) return;
    const h = p.duck ? 10 : p.h;
    const cx = p.x + p.w / 2;
    const feet = p.y + p.h;
    const dir = p.facing || 1;
    g.save();
    /* тень */
    g.globalAlpha = 0.3;
    g.fillStyle = '#000';
    g.beginPath(); g.ellipse(cx, feet - 0.4, 5, 1.4, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    if (p.exo) {
      /* ЭКЗОСКЕЛЕТ — тяжёлый мех */
      const top = feet - h;
      g.fillStyle = 'rgba(20,50,80,0.95)';
      rr(cx - 5.5, top + 3, 11, h - 5, 2); g.fill();
      g.strokeStyle = '#39f6ff'; g.lineWidth = 1.1; g.stroke();
      /* наплечники */
      g.fillStyle = 'rgba(57,246,255,0.22)';
      rr(cx - 8, top + 4, 4, 5, 1.4); g.fill();
      rr(cx + 4, top + 4, 4, 5, 1.4); g.fill();
      /* шлем */
      g.fillStyle = '#1b2a4a';
      rr(cx - 3.6, top, 7.2, 5, 1.8); g.fill();
      g.strokeStyle = '#b6ff3c'; g.lineWidth = 0.8; g.stroke();
      /* визор */
      g.fillStyle = '#b6ff3c'; g.globalAlpha = 0.95;
      g.fillRect(cx - 2.4 + dir * 0.4, top + 1.6, 4.6, 1.5);
      g.globalAlpha = 1;
      /* ядро */
      glowDot(cx, top + h * 0.55, 1.7, '#ffcc55', 9);
      /* ноги */
      g.strokeStyle = '#39f6ff'; g.lineWidth = 1.4;
      const step = Math.abs(p.vx) > 6 && p.onGround ? Math.sin(p.step * Math.PI * 2) * 1.6 : 0;
      vline(cx - 3, top + h - 5, cx - 3 - step, feet, '#39f6ff', 1.4);
      vline(cx + 3, top + h - 5, cx + 3 + step, feet, '#39f6ff', 1.4);
      /* пушка */
      g.strokeStyle = '#ffcc55'; g.lineWidth = 1.3;
      vline(cx + dir * 4, top + 6, cx + dir * 8.5, top + 6, '#ffcc55', 1.3);
      glowDot(cx + dir * 8.5, top + 6, 1, '#ffcc55', 6);
    } else {
      const top = feet - h;
      /* костюм */
      const grad = g.createLinearGradient(cx - 4, top, cx + 4, feet);
      grad.addColorStop(0, '#f2f0ff');
      grad.addColorStop(1, '#8f9bd8');
      g.fillStyle = grad;
      rr(cx - 3.4, top + 3, 6.8, h - 6, 2.2); g.fill();
      /* шлем */
      g.fillStyle = '#1a2340';
      g.beginPath(); g.arc(cx + dir * 0.5, top + 2.4, 3.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#39f6ff'; g.lineWidth = 0.8; g.stroke();
      /* визор */
      g.fillStyle = '#39f6ff';
      g.globalAlpha = 0.95;
      g.fillRect(cx + (dir > 0 ? 0.6 : -3.4), top + 1.6, 2.8, 1.2);
      g.globalAlpha = 1;
      /* ноги */
      g.strokeStyle = '#e8e6ff'; g.lineWidth = 1.3;
      const walking = Math.abs(p.vx) > 6 && p.onGround;
      const sw = walking ? Math.sin(p.step * Math.PI * 2) * 1.7 : 0;
      if (!p.onGround) {
        vline(cx - 2, top + h - 4, cx - 3.5, feet, '#e8e6ff', 1.3);
        vline(cx + 2, top + h - 4, cx + 3, feet - 1, '#e8e6ff', 1.3);
      } else {
        vline(cx - 1.6, top + h - 5, cx - 1.6 - sw, feet, '#e8e6ff', 1.3);
        vline(cx + 1.6, top + h - 5, cx + 1.6 + sw, feet, '#e8e6ff', 1.3);
      }
      /* бластер */
      g.strokeStyle = '#ffcc55'; g.lineWidth = 1.2;
      vline(cx + dir * 2, top + 7.5, cx + dir * 6.5, top + 7.5, '#ffcc55', 1.2);
      glowDot(cx + dir * 6.5, top + 7.5, 0.9, '#ffcc55', 6);
      /* ранец */
      g.fillStyle = 'rgba(57,246,255,0.35)';
      g.fillRect(cx - dir * 4.2, top + 6, 1.4, 3);
    }
    g.restore();
  }

  /* ---------- снаряды и эффекты ---------- */
  function drawDeathOverlay() {
    const st = S();
    g.fillStyle = 'rgba(20,2,8,0.45)'; g.fillRect(0, 0, W, VH);
    glowText(PR.t('msg.dead'), W / 2, 84, 10, '#ff4d6d', 'center', '800', 16, HEAD_FONT);
    text(PR.t('hud.lives') + '  ' + st.lives, W / 2, 100, 4, 'rgba(235,235,255,0.85)', 'center', '600', 1);
  }

  function drawShots(T) {
    const st = S();
    g.save();
    g.globalCompositeOperation = 'lighter';
    st.shots.forEach(function (s) {
      if (s.grenade) {
        const gr = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, 6);
        gr.addColorStop(0, 'rgba(255,204,85,0.95)');
        gr.addColorStop(1, 'rgba(255,60,60,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(s.x, s.y, 6, 0, Math.PI * 2); g.fill();
        dot(s.x, s.y, 1.8, '#fff6c8');
      } else {
        const lg = g.createLinearGradient(s.x - 10, s.y, s.x + 4, s.y);
        lg.addColorStop(0, 'rgba(57,246,255,0)');
        lg.addColorStop(1, s.exo ? 'rgba(182,255,60,0.95)' : 'rgba(57,246,255,0.95)');
        g.strokeStyle = lg; g.lineWidth = 2;
        g.beginPath(); g.moveTo(s.x - 10, s.y); g.lineTo(s.x + 3, s.y); g.stroke();
        dot(s.x + 2.5, s.y, 1.2, '#ffffff');
      }
    });
    st.eShots.forEach(function (s) {
      if (s.missile) {
        for (let i = 0; i < 4; i++) {
          g.globalAlpha = 0.35 - i * 0.07;
          dot(s.x - Math.cos(s.ang) * i * 3, s.y - Math.sin(s.ang) * i * 3, 2.6 - i * 0.4, '#ff4d6d');
        }
        g.globalAlpha = 1;
        glowDot(s.x, s.y, 2, '#ff4d6d', 10);
      } else {
        g.strokeStyle = 'rgba(255,63,240,0.5)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); g.lineTo(s.x, s.y); g.stroke();
        glowDot(s.x, s.y, 1.7, '#ff3ff0', 8);
      }
    });
    st.particles.forEach(function (p) {
      const a = Math.max(0, p.life / (p.max || 1));
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, Math.max(0.4, p.size * 0.6), 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;
    st.booms.forEach(function (b) {
      const k = b.t / b.dur;
      const r = 2 + b.r * (0.3 + k * 1.1);
      const rg = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.75 * (1 - k)) + ')');
      rg.addColorStop(0.45, 'rgba(255,204,85,' + (0.5 * (1 - k)) + ')');
      rg.addColorStop(1, 'rgba(255,60,60,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,' + (0.6 * (1 - k)) + ')';
      g.lineWidth = 1;
      g.beginPath(); g.arc(b.x, b.y, r * 0.9, 0, Math.PI * 2); g.stroke();
    });
    g.restore();
    /* всплывающие очки — обычный режим, чтобы читались */
    st.pops.forEach(function (p) {
      g.globalAlpha = Math.min(1, p.life / 0.4);
      glowText(p.text, p.x, p.y - 6, 5, p.color, 'center', '700', 6);
      g.globalAlpha = 1;
    });
  }

  /* ---------- HUD ---------- */
  function drawHUD(T) {
    const st = S();
    const p = st.player || { laser: 0, maxLaser: 100, rockets: 0, armor: 0, exo: false };
    const y = H;
    /* стеклянная панель */
    g.fillStyle = 'rgba(6,4,18,0.82)';
    g.fillRect(0, y, W, HUD);
    const lg = g.createLinearGradient(0, y, W, y);
    lg.addColorStop(0, 'rgba(57,246,255,0)');
    lg.addColorStop(0.5, 'rgba(57,246,255,0.75)');
    lg.addColorStop(1, 'rgba(255,63,240,0)');
    g.fillStyle = lg; g.fillRect(0, y, W, 0.7);

    text(PR.t('hud.score'), 6, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text(String(st.score).padStart(6, '0'), 6, y + 10.4, 6.2, N.white, 'left', '700');
    text(PR.t('hud.lives'), 52, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text('×' + st.lives, 52, y + 10.6, 6.2, N.red, 'left', '700');

    text(PR.t('hud.sector'), 84, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text((st.level + 1) + '/' + PR.levelCount(), 84, y + 10.6, 5.4, T.a, 'left', '700');
    text(PR.t('hud.screen'), 108, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    text((st.screen + 1) + '/' + PR.screenCount(st.level), 108, y + 10.6, 5.4, T.a, 'left', '700');

    /* лазер */
    text(PR.t('hud.laser'), 134, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    const bw = 34, bx = 134;
    g.fillStyle = 'rgba(57,246,255,0.12)';
    g.fillRect(bx, y + 9, bw, 3.4);
    const fillW = bw * Math.max(0, Math.min(1, p.laser / (p.maxLaser || 100)));
    const lg2 = g.createLinearGradient(bx, 0, bx + bw, 0);
    lg2.addColorStop(0, '#39f6ff'); lg2.addColorStop(1, '#b6ff3c');
    g.fillStyle = lg2; g.fillRect(bx, y + 9, fillW, 3.4);
    for (let i = 1; i < 8; i++) { g.fillStyle = 'rgba(6,4,18,0.9)'; g.fillRect(bx + (bw / 8) * i, y + 9, 0.6, 3.4); }

    /* гранаты */
    text(PR.t('hud.rockets'), 174, y + 4.2, 3, N.dim, 'left', '600', 0.6);
    const maxR = p.maxRockets || 6;
    const pipW = 4.4, gap = 1.6;
    for (let i = 0; i < maxR; i++) {
      const on = i < p.rockets;
      g.fillStyle = on ? '#ff3ff0' : 'rgba(255,63,240,0.16)';
      rr(174 + i * (pipW + gap), y + 9, pipW, 3.4, 1); g.fill();
    }

    /* броня */
    if (p.exo) {
      text('A' + p.armor, 212, y + 10.6, 5, '#ffcc55', 'left', '700');
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i < p.armor ? '#ffcc55' : 'rgba(255,204,85,0.18)';
        g.fillRect(228 + i * 8, y + 9.2, 5.5, 3.4);
      }
    }
    /* полоса «до выхода» */
    g.globalAlpha = 0.5;
    g.fillStyle = T.a;
    const prog = Math.max(0, Math.min(1, (st.player ? st.player.x : 0) / W));
    g.fillRect(W - 26 * prog, y + 1.4, 26 * prog, 0.7);
    g.globalAlpha = 1;
  }

  /* ---------- рамка сцены и боковые панели ---------- */
  function chrome(T) {
    const s = V.stage;
    g.save();
    /* контур сцены */
    g.strokeStyle = 'rgba(120,150,255,0.22)';
    g.lineWidth = 1;
    g.strokeRect(s.x - 0.5, s.y - 0.5, s.w + 1, s.h + 1);
    /* уголки */
    const L = Math.min(26, s.w * 0.08);
    g.strokeStyle = T.a;
    g.lineWidth = 1.6;
    g.globalAlpha = 0.9;
    const corners = [[s.x, s.y, 1, 1], [s.x + s.w, s.y, -1, 1], [s.x, s.y + s.h, 1, -1], [s.x + s.w, s.y + s.h, -1, -1]];
    corners.forEach(function (c) {
      g.beginPath();
      g.moveTo(c[0], c[1] + c[3] * L); g.lineTo(c[0], c[1]); g.lineTo(c[0] + c[2] * L, c[1]);
      g.stroke();
    });
    g.globalAlpha = 1;

    /* подписи над сценой */
    const st = S();
    const lv = PR.levelData(st.level);
    const inRun = ['play', 'paused', 'dead', 'bonus', 'levelclear', 'briefing', 'gameover', 'win'].indexOf(st.mode) >= 0;
    const label = inRun
      ? 'ПРОРЫВ // ' + PR.t('hud.sector') + ' ' + String(st.level + 1).padStart(2, '0') +
        (lv ? ' · ' + (lv.name[PR.settings.lang] || lv.name.ru) : '')
      : 'ПРОРЫВ // ' + PR.t('tagline');
    g.font = '600 ' + Math.max(10, s.h * 0.016) + 'px ' + UI_FONT;
    const above = s.y > 26;
    const ty = above ? s.y - 8 : s.y + 12;
    g.fillStyle = 'rgba(200,210,255,' + (above ? 0.5 : 0.42) + ')';
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(label, s.x, ty);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(57,246,255,0.55)';
    g.fillText(PR.settings.gfx === 'modern' ? 'NEON 2026' : 'RETRO', s.x + s.w, ty);

    /* боковые панели / вертикальные водяные знаки */
    const side = s.x;
    const right = V.cw - (s.x + s.w);
    if (side > 154) {
      g.textAlign = 'left';
      g.fillStyle = 'rgba(220,225,255,0.85)';
      g.font = '700 ' + Math.round(s.h * 0.028) + 'px ' + HEAD_FONT;
      g.fillText(PR.t('brand'), s.x - side + 20, s.y + s.h * 0.15);
      g.font = '600 ' + Math.round(s.h * 0.013) + 'px ' + UI_FONT;
      g.fillStyle = 'rgba(140,150,200,0.8)';
      const lines = [
        PR.t('hud.score') + ' ' + String(st.score).padStart(6, '0'),
        PR.t('hud.lives') + ' ' + st.lives,
        PR.t('hud.sector') + ' ' + (st.level + 1) + '/' + PR.levelCount(),
        PR.t('hud.screen') + ' ' + (st.screen + 1) + '/' + PR.screenCount(st.level)
      ];
      lines.forEach(function (l, i) { g.fillText(l, s.x - side + 20, s.y + s.h * 0.22 + i * s.h * 0.032); });
      const keysY = s.y + s.h * 0.58;
      const keys = ['← →', 'SPACE', 'G', 'L', 'M', 'ESC'];
      const acts = [PR.t('key.left.act'), PR.t('key.fire.act'), PR.t('key.g.act'), PR.t('key.l.act'), PR.t('key.m.act'), PR.t('key.pause.act')];
      g.font = '600 ' + Math.round(s.h * 0.0125) + 'px ' + UI_FONT;
      keys.forEach(function (k, i) {
        g.fillStyle = 'rgba(57,246,255,0.85)';
        g.fillText(k, s.x - side + 20, keysY + i * s.h * 0.04);
        g.fillStyle = 'rgba(140,150,200,0.6)';
        g.fillText(acts[i], s.x - side + 20 + 54, keysY + i * s.h * 0.04);
      });
      g.fillStyle = 'rgba(255,255,255,0.2)';
      g.fillRect(s.x - side + 20, s.y + s.h * 0.55, side - 46, 1);
    } else if (side > 26) {
      /* узкая полоса: вертикальный водяной знак */
      g.save();
      g.translate(s.x - side * 0.5, s.y + s.h * 0.5);
      g.rotate(-Math.PI / 2);
      g.font = '800 ' + Math.round(side * 0.36) + 'px ' + HEAD_FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(160,175,255,0.10)';
      g.fillText('ПРОРЫВ', 0, 0);
      g.restore();
    }

    if (right > 190) {
      const rx = s.x + s.w + 20;
      g.textAlign = 'left';
      g.fillStyle = 'rgba(255,63,240,0.45)';
      g.fillRect(rx, s.y + s.h * 0.16, 24, 1);
      g.font = '500 ' + Math.round(s.h * 0.0105) + 'px ' + UI_FONT;
      g.fillStyle = 'rgba(140,150,200,0.7)';
      const tip = PR.t('hint.exo');
      const lines = wrap(tip, Math.round(s.h * 0.0105), right - 30, '500');
      lines.slice(0, 10).forEach(function (l, i) { g.fillText(l, rx, s.y + s.h * 0.2 + i * s.h * 0.024); });
      g.fillStyle = 'rgba(160,175,255,0.10)';
      g.font = '800 ' + Math.round(side * 0.3) + 'px ' + HEAD_FONT;
      g.fillText('2026', rx, s.y + s.h * 0.85);
    } else if (right > 26) {
      g.save();
      g.translate(s.x + s.w + right * 0.5, s.y + s.h * 0.5);
      g.rotate(Math.PI / 2);
      g.font = '800 ' + Math.round(right * 0.3) + 'px ' + HEAD_FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,63,240,0.09)';
      g.fillText('2026', 0, 0);
      g.restore();
    }

    g.restore();
  }

  /* ---------- вспомогательные «стеклянные» панели ---------- */
  function glass(x, y, w, h, accent, alpha) {
    g.save();
    g.fillStyle = 'rgba(10,8,28,' + (alpha == null ? 0.72 : alpha) + ')';
    rr(x, y, w, h, 3); g.fill();
    g.strokeStyle = accent; g.globalAlpha = 0.35; g.lineWidth = 0.8;
    rr(x, y, w, h, 3); g.stroke();
    g.globalAlpha = 1;
    /* верхний блик */
    const lg = g.createLinearGradient(x, y, x + w, y);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(x + 2, y, w - 4, 0.6);
    g.restore();
  }

  function menuDraw(accent, title, hintKey) {
    const st = S();
    const rects = PR.ui.layout();
    if (!rects.length) return;
    const first = rects[0], last = rects[rects.length - 1];
    const px0 = first.x - 22, py0 = first.y - 14;
    const pw = first.w + 44, ph = last.y + last.h - first.y + 28;
    glass(px0, py0, pw, ph, accent, 0.5);
    if (title) text(title, first.cx, py0 + 7, 4.6, accent, 'center', '700', 1.2);

    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      if (sel) {
        g.save();
        g.fillStyle = 'rgba(57,246,255,0.10)';
        rr(r.x - 14, r.y, r.w + 28, r.h, 2); g.fill();
        g.fillStyle = accent;
        g.fillRect(r.x - 14, r.y + 1, 1.4, r.h - 2);
        g.restore();
      }
      const col = sel ? '#ffffff' : 'rgba(200,210,255,0.66)';
      if (r.item.key === 'back') {
        text(r.item.value || 'ESC', r.cx, r.cy, 4.2, sel ? accent : 'rgba(140,150,200,0.6)', 'center', '600', 1);
        return;
      }
      text(r.item.label, r.x - 6, r.cy, 4.4, col, 'left', '600', 0.5);
      if (r.item.value) text(r.item.value, r.x + r.w + 6, r.cy, 4.2, sel ? accent : 'rgba(140,150,200,0.75)', 'right', '700', 0.4);
      if (sel) glowDot(r.x - 14, r.cy, 1, accent, 6);
    });
    text(PR.t(hintKey || 'msg.paused.hint'), first.cx, py0 + ph - 4, 3, 'rgba(140,150,200,0.65)', 'center', '500', 0.4);
  }

  /* ---------- экраны ---------- */
  function drawTitle() {
    const st = S();
    const T = THEMES.space;
    /* декоративные кольца */
    g.save();
    for (let i = 0; i < 3; i++) {
      const r = 40 + i * 16 + Math.sin(t * 0.7 + i) * 3;
      g.strokeStyle = 'rgba(57,246,255,' + (0.16 - i * 0.04) + ')';
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(W / 2, 60, r * 1.5, r * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();

    /* логотип */
    const size = 34;
    g.font = '800 ' + size + 'px ' + HEAD_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lg = g.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
    lg.addColorStop(0, '#39f6ff');
    lg.addColorStop(0.45, '#f2f0ff');
    lg.addColorStop(1, '#ff3ff0');
    /* хроматическая аберрация */
    try { g.letterSpacing = '4px'; } catch (e) { /* ok */ }
    g.globalAlpha = 0.5; g.fillStyle = 'rgba(255,63,240,0.55)'; g.fillText('ПРОРЫВ', W / 2 - 1.4, 41);
    g.fillStyle = 'rgba(57,246,255,0.55)'; g.fillText('ПРОРЫВ', W / 2 + 1.4, 42);
    g.globalAlpha = 1;
    g.save();
    g.shadowColor = 'rgba(57,246,255,0.65)';
    g.shadowBlur = 22;
    g.fillStyle = lg;
    g.fillText('ПРОРЫВ', W / 2, 41.5);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.globalAlpha = 0.9;
    g.fillText('ПРОРЫВ', W / 2, 41.5 - 0.35);
    g.globalAlpha = 1;
    try { g.letterSpacing = '0px'; } catch (e) { /* ok */ }

    /* линия и подзаголовок */
    const lg2 = g.createLinearGradient(30, 0, W - 30, 0);
    lg2.addColorStop(0, 'rgba(57,246,255,0)');
    lg2.addColorStop(0.5, 'rgba(57,246,255,0.9)');
    lg2.addColorStop(1, 'rgba(255,63,240,0)');
    g.fillStyle = lg2; g.fillRect(30, 63, W - 60, 0.8);
    text('ШТУРМОВИК', W / 2, 74, 9, 'rgba(240,238,255,0.92)', 'center', '700', 3.5, HEAD_FONT);
    text(PR.t('tagline.full'), W / 2, 87, 4, T.a, 'center', '500', 0.8);

    menuDraw(T.a, null, 'menu.hint');

    /* рекорд */
    text(PR.t('msg.record'), 6, 8, 3.2, 'rgba(140,150,200,0.7)', 'left', '600', 0.8);
    text(String(st.record).padStart(6, '0'), 6, 14, 5, '#ffcc55', 'left', '700');
    text(PR.t('credits.original'), W - 6, 8, 3.2, 'rgba(140,150,200,0.55)', 'right', '500', 0.5);
    text('HTML5 · 2026', W - 6, 14, 3.2, 'rgba(57,246,255,0.7)', 'right', '600', 0.6);
    text(PR.t('menu.hint.quick'), W / 2, VH - 6, 3.2, 'rgba(140,150,200,0.6)', 'center', '500', 0.5);
    if (PR.BUILD) text(PR.t('settings.build', { v: PR.BUILD }), W - 6, VH - 16, 2.6, 'rgba(120,140,220,0.45)', 'right', '500', 0.5);
  }

  function drawWorld() {
    const T = th();
    const st = S();
    stageBackdrop();
    drawTiles(T);
    st.ents.forEach(function (e) { if (!e.dead) drawEntity(e, T); });
    drawShots(T);
    drawPlayer(st.player, T);
    drawHUD(T);
    /* вспышка */
    if (st.fx.flash > 0.01) {
      g.globalAlpha = Math.min(0.4, st.fx.flash);
      g.fillStyle = st.fx.flashColor || '#ffffff';
      g.fillRect(0, 0, W, VH);
      g.globalAlpha = 1;
    }
    /* сообщение */
    if (st.message) {
      const s = PR.t(st.message.key);
      const w = textW(s, 4.2, '700', 1) + 16;
      glass(W / 2 - w / 2, 70, w, 13, '#39f6ff', 0.72);
      glowText(s, W / 2, 76.5, 4.2, '#39f6ff', 'center', '700', 10);
    }
    /* затвор перехода */
    if (st.transition > 0) {
      const k = st.transition;
      const hh = k * k * (H / 2) * 1.1;
      g.fillStyle = '#04030c';
      g.fillRect(0, 0, W, hh);
      g.fillRect(0, H - hh, W, hh);
      g.fillStyle = 'rgba(57,246,255,0.5)';
      g.fillRect(0, hh, W, 0.6);
      g.fillRect(0, H - hh - 0.6, W, 0.6);
    }
  }

  function drawPause() {
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.7)'; g.fillRect(0, 0, W, VH);
    glowText(PR.t('msg.paused'), W / 2, 38, 13, '#ffffff', 'center', '800', 18, HEAD_FONT);
    text(PR.t('pause.gfx', { v: PR.settings.gfx === 'modern' ? 'NEON · 2026' : 'RETRO · 8-BIT' }) + '   [G]', W / 2, 52, 3.2, 'rgba(140,150,200,0.8)', 'center', '500', 0.8);
    menuDraw('#39f6ff', null);
  }

  function drawHelp() {
    const T = THEMES.space;
    stageBackdrop();
    glass(6, 6, W - 12, VH - 12, T.a, 0.82);
    glowText(PR.t('help.title'), W / 2, 18, 10, T.a, 'center', '800', 14, HEAD_FONT);
    g.fillStyle = 'rgba(57,246,255,0.3)';
    g.fillRect(24, 28, W - 48, 0.8);
    const rows = [
      ['key.left', 'key.left.act'], ['key.jump', 'key.jump.act'],
      ['key.duck', 'key.duck.act'], ['key.fire', 'key.fire.act'],
      ['key.pause', 'key.pause.act'], ['key.l', 'key.l.act'],
      ['key.g', 'key.g.act'], ['key.m', 'key.m.act'], ['key.f', 'key.f.act']
    ];
    let y = 37;
    rows.forEach(function (r) {
      text(PR.t(r[0]), 14, y, 3.6, '#ffcc55', 'left', '700', 0.3);
      text(PR.t(r[1]), 84, y, 3.4, 'rgba(235,235,255,0.9)', 'left', '400', 0.1);
      y += 7.2;
    });
    y += 3;
    g.fillStyle = 'rgba(57,246,255,0.25)'; g.fillRect(24, y, W - 48, 0.6); y += 5;
    text(PR.t('hint.title'), 14, y, 3.6, T.a, 'left', '700', 1); y += 7;
    [PR.t('hint.goal'), PR.t('hint.grenade'), PR.t('hint.exo'), PR.t('hint.ammo')].forEach(function (s) {
      wrap(s, 3.2, W - 30, '400').forEach(function (line) {
        text(line, 14, y, 3.2, 'rgba(225,225,250,0.82)', 'left', '400', 0);
        y += 5.6;
      });
      y += 1.2;
    });
    text(PR.t('help.back'), W / 2, VH - 8, 3.4, 'rgba(140,150,200,0.85)', 'center', '500', 0.6);
  }

  function drawAbout() {
    const T = THEMES.hive;
    stageBackdrop();
    glass(8, 8, W - 16, VH - 16, '#ff3ff0', 0.84);
    const lg = g.createLinearGradient(W / 2 - 60, 0, W / 2 + 60, 0);
    lg.addColorStop(0, '#39f6ff'); lg.addColorStop(1, '#ff3ff0');
    g.font = '800 16px ' + HEAD_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = lg;
    g.fillText('ПРОРЫВ', W / 2, 24);
    text(PR.t('tagline'), W / 2, 38, 3.4, 'rgba(235,235,255,0.8)', 'center', '500', 1);
    g.fillStyle = 'rgba(255,63,240,0.3)'; g.fillRect(30, 45, W - 60, 0.7);
    let y = 53;
    wrapMulti(PR.t('about.text'), 3.7, W - 30, '400').forEach(function (l) {
      text(l, 15, y, 3.7, 'rgba(230,230,250,0.9)', 'left', '400', 0); y += 6.4;
    });
    y += 4;
    [PR.t('credits.original'), PR.t('credits.port'), PR.t('credits.thanks'), PR.t('credits.fan')].forEach(function (s, i) {
      text(s, W / 2, y, 3.4, i < 2 ? (i ? '#39f6ff' : '#ffcc55') : 'rgba(150,150,200,0.85)', 'center', '500', 0.3);
      y += 6;
    });
    text(PR.t('help.back'), W / 2, VH - 8, 3.2, 'rgba(140,150,200,0.8)', 'center', '500', 0.6);
  }

  function drawSettings() {
    const st = S();
    const T = THEMES.space;
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.78)'; g.fillRect(0, 0, W, VH);
    glass(20, 22, W - 40, 156, T.a, 0.82);
    glowText(PR.t('settings.title'), W / 2, 36, 9, T.a, 'center', '800', 14, HEAD_FONT);
    g.fillStyle = 'rgba(57,246,255,0.25)'; g.fillRect(36, 44, W - 72, 0.7);
    const rects = PR.ui.layout();
    rects.forEach(function (r, i) {
      const sel = i === st.menuIndex;
      if (sel) {
        g.fillStyle = 'rgba(57,246,255,0.10)';
        rr(r.x - 18, r.y, r.w + 50, r.h, 2); g.fill();
        g.fillStyle = T.a;
        g.fillRect(r.x - 18, r.y + 1, 1.4, r.h - 2);
      }
      if (r.item.key === 'back') {
        text(r.item.value || 'ESC', W / 2, r.cy, 3.6, sel ? T.a : 'rgba(140,150,200,0.7)', 'center', '600', 0.6);
        return;
      }
      text(r.item.label, r.x - 12, r.cy, 3.8, sel ? '#ffffff' : 'rgba(200,210,255,0.72)', 'left', '600', 0.4);
      if (r.item.value) text(r.item.value, r.x + r.w + 44, r.cy, 3.5, sel ? '#ffcc55' : 'rgba(140,150,200,0.75)', 'right', '600', 0.25);
    });
    if (st.resetAsk > 0) glowText(PR.t('settings.resetConfirm'), W / 2, 168, 3.6, '#ff4d6d', 'center', '700', 8);
    else text(PR.t('pause.gfx', { v: PR.settings.gfx === 'modern' ? 'NEON' : 'RETRO' }) + '   G', W / 2, 168, 3, 'rgba(140,150,200,0.7)', 'center', '500', 0.4);
    if (PR.BUILD) text(PR.t('settings.build', { v: PR.BUILD }), W / 2, 190, 2.8, 'rgba(120,140,220,0.5)', 'center', '500', 0.6);
  }

  function drawBriefing() {
    const st = S();
    const lv = PR.levelData(st.level) || { name: { ru: '' }, intro: { ru: '' }, theme: 'space' };
    const T = THEMES[lv.theme] || THEMES.space;
    stageBackdrop();
    /* водяной знак сектора */
    g.save();
    g.globalAlpha = 0.07;
    g.font = '800 120px ' + HEAD_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = T.a;
    g.fillText(String(st.level + 1), W - 52, 96);
    g.restore();
    glass(10, 10, W - 20, VH - 20, T.a, 0.5);
    text(PR.t('hud.sector') + ' ' + (st.level + 1) + ' / ' + PR.levelCount(), 18, 24, 3.4, T.a, 'left', '700', 1.4);
    glowText(lv.name[PR.settings.lang] || lv.name.ru, 18, 38, 9.5, '#ffffff', 'left', '800', 12, HEAD_FONT);
    g.fillStyle = T.a; g.globalAlpha = 0.5; g.fillRect(18, 47, 96, 0.8); g.globalAlpha = 1;
    let y = 56;
    wrapMulti(lv.intro[PR.settings.lang] || lv.intro.ru, 3.4, W - 44, '400').forEach(function (l) {
      text(l, 18, y, 3.4, 'rgba(230,230,250,0.9)', 'left', '400', 0); y += 6;
    });
    y += 4;
    /* цели-карточки */
    const cards = [
      { k: 'hint.grenade', c: '#ffcc55' },
      { k: 'hint.exo', c: '#39f6ff' },
      { k: 'hint.ammo', c: '#ff3ff0' }
    ];
    cards.forEach(function (card) {
      const lines = wrap(PR.t(card.k), 3, W - 58, '400');
      const h = 5 + lines.length * 5.2;
      glass(18, y - 3, W - 36, h, card.c, 0.28);
      g.fillStyle = card.c; g.fillRect(18, y - 3, 1.2, h);
      lines.forEach(function (l, i) { text(l, 24, y + 1 + i * 5.2, 3, 'rgba(225,225,250,0.85)', 'left', '400', 0); });
      y += h + 3;
    });
    /* прогресс экранов */
    const sx0 = W / 2 - (5 * 10) / 2;
    for (let i = 0; i < 5; i++) {
      const dx = sx0 + i * 10;
      g.strokeStyle = 'rgba(57,246,255,0.5)'; g.lineWidth = 0.8;
      g.beginPath(); g.arc(dx + 4, 124, 2.4, 0, Math.PI * 2); g.stroke();
      if (i === 0) { g.fillStyle = '#39f6ff'; g.beginPath(); g.arc(dx + 4, 124, 1.4, 0, Math.PI * 2); g.fill(); }
    }
    /* кто встретится */
    const roster = [
      { draw: function () { drawWalker({ x: 0, y: 0, w: 14, h: 12, dir: 1, anim: 0, hitT: 0 }, T); } },
      { draw: function () { drawFlyer({ x: 0, y: 0, w: 16, h: 12, dir: 1, anim: 0, hitT: 0 }, T); } },
      { draw: function () { drawTurret({ x: 0, y: 0, w: 12, h: 10, dir: 1, hitT: 0 }, T); } },
      { draw: function () { drawPod({ x: 0, y: 0, w: 14, h: 12, dir: 1, anim: 0, hitT: 0 }, T); } }
    ];
    for (let i = 0; i < roster.length; i++) {
      g.save();
      g.translate(W / 2 - 39 + i * 26, 148);
      g.globalAlpha = 0.85;
      roster[i].draw();
      g.restore();
    }
    text('?  ?  ?  ?', 0, 0, 1, 'rgba(0,0,0,0)', 'left', '400', 0);
    /* кнопка старта */
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
    g.globalAlpha = pulse;
    glass(60, VH - 30, W - 120, 14, '#39f6ff', 0.85);
    glowText(PR.t('level.start'), W / 2, VH - 23, 4.6, '#39f6ff', 'center', '700', 12);
    g.globalAlpha = 1;
    text(PR.t('level.screens', { n: PR.screenCount(st.level) }), 18, VH - 6, 3, 'rgba(140,150,200,0.7)', 'left', '500', 0.4);
  }

  function drawBonus() {
    const st = S();
    const b = st.bonus;
    if (!b) return;
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.8)'; g.fillRect(0, 0, W, VH);
    glass(14, 30, W - 28, 140, '#ffcc55', 0.85);
    glowText(PR.t('msg.bonus'), W / 2, 45, 11, '#ffcc55', 'center', '800', 16, HEAD_FONT);
    const bx = [36, 78, 120, 162];
    if (b.phase === 'pick') {
      b.values.forEach(function (v, i) {
        const on = i === b.index;
        const x = bx[i];
        glass(x, 66, 34, 30, on ? '#ffcc55' : 'rgba(140,150,200,0.55)', on ? 0.9 : 0.4);
        if (on) {
          g.save();
          g.shadowColor = '#ffcc55'; g.shadowBlur = 14;
          g.strokeStyle = 'rgba(255,204,85,0.9)'; g.lineWidth = 1;
          rr(x, 66, 34, 30, 3); g.stroke();
          g.restore();
        }
        text(String(v), x + 17, 81, on ? 9 : 7.5, on ? '#ffffff' : 'rgba(200,210,255,0.7)', 'center', '800');
      });
      text(PR.t('msg.bonus.pick'), W / 2, 108, 4, '#ffffff', 'center', '600', 0.8);
      text(PR.t('msg.bonus.pick2'), W / 2, 118, 3.4, 'rgba(200,210,255,0.7)', 'center', '500', 0.4);
    } else {
      glowText(String(b.chosen), W / 2, 74, 16, '#ffcc55', 'center', '800', 18, HEAD_FONT);
      text(PR.t('msg.bonus.lives') + '  →  ' + b.livesBonus, W / 2, 94, 3.6, '#39f6ff', 'center', '600', 0.5);
      text(b.noExoBonus ? PR.t('msg.bonus.noexo') : PR.t('msg.bonus.exo'), W / 2, 104, 3.6, b.noExoBonus ? '#b6ff3c' : '#ff4d6d', 'center', '600', 0.5);
      if (b.extraLife) text(PR.t('msg.bonus.extra'), W / 2, 114, 3.6, '#ffcc55', 'center', '700', 0.5);
    }
    text(PR.t('msg.score') + '  ' + st.score, W / 2, 132, 3.8, 'rgba(235,235,255,0.9)', 'center', '600', 0.6);
  }

  function drawLevelClear() {
    const st = S();
    drawWorld();
    g.fillStyle = 'rgba(4,3,14,0.72)'; g.fillRect(0, 0, W, VH);
    glowText(PR.t('msg.levelclear'), W / 2, 62, 14, '#b6ff3c', 'center', '800', 18, HEAD_FONT);
    text(PR.t('hud.sector') + ' ' + (st.level + 1) + '/' + PR.levelCount(), W / 2, 86, 4, 'rgba(235,235,255,0.9)', 'center', '600', 1.5);
    text(PR.t('msg.score') + ' ' + st.score, W / 2, 100, 4.4, '#ffcc55', 'center', '700', 0.6);
    for (let i = 0; i < 3; i++) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 4 - i * 0.6));
      g.globalAlpha = a;
      glowDot(W / 2 - 12 + i * 12, 118, 1.6, '#b6ff3c', 8);
      g.globalAlpha = 1;
    }
  }

  function drawGameOver() {
    const st = S();
    drawWorld();
    g.fillStyle = 'rgba(6,2,8,0.84)'; g.fillRect(0, 0, W, VH);
    glass(26, 28, W - 52, 152, '#ff4d6d', 0.82);
    glowText(PR.t('msg.gameover'), W / 2, 46, 13, '#ff4d6d', 'center', '800', 18, HEAD_FONT);
    text(PR.t('hud.score'), W / 2, 62, 3.2, 'rgba(140,150,200,0.8)', 'center', '600', 1);
    text(String(st.score), W / 2, 74, 9, '#ffffff', 'center', '700');
    text(PR.t('msg.record') + ' ' + st.record, W / 2, 88, 3.5, 'rgba(255,204,85,0.9)', 'center', '600', 0.4);
    if (st.newRecord) glowText(PR.t('msg.newrecord'), W / 2, 99, 4.2, '#b6ff3c', 'center', '800', 10);
    menuDraw('#ff4d6d', null);
  }

  function drawWin() {
    const st = S();
    stageBackdrop();
    const T = THEMES.space;
    /* частицы-искры */
    for (let i = 0; i < 40; i++) {
      const a = hash(i, 3) * Math.PI * 2;
      const sp = 6 + hash(i, 9) * 30;
      const x = W / 2 + Math.cos(a + t * 0.2) * sp * (1 + (t * 0.15) % 1);
      const y = 100 + Math.sin(a + t * 0.2) * sp * 0.6;
      g.globalAlpha = 0.15 + 0.3 * Math.abs(Math.sin(t * 2 + i));
      dot(x, y, hash(i, 5) > 0.7 ? 1.4 : 0.8, i % 3 ? T.b : T.a);
    }
    g.globalAlpha = 1;
    const winT = PR.t('msg.win');
    glowText(winT, W / 2, 42, textW(winT, 15, '800') > 240 ? 11 : 15, '#ffcc55', 'center', '800', 22, HEAD_FONT);
    text(PR.t('msg.win.sub'), W / 2, 68, 4, '#39f6ff', 'center', '600', 1.2);
    text(PR.t('msg.score'), W / 2, 92, 3.4, 'rgba(140,150,200,0.8)', 'center', '600', 1);
    text(String(st.score), W / 2, 106, 12, '#ffffff', 'center', '700');
    text(PR.t('msg.record') + ' ' + st.record, W / 2, 122, 3.6, '#ffcc55', 'center', '600', 0.4);
    if (st.newRecord) glowText(PR.t('msg.newrecord'), W / 2, 133, 4.6, '#b6ff3c', 'center', '800', 12);
    menuDraw('#ffcc55', null, 'menu.hint');
    text(PR.t('credits.original'), W / 2, VH - 6, 2.8, 'rgba(140,150,200,0.55)', 'center', '500', 0.5);
  }

  /* ---------- внешний вход ---------- */
  function draw(ctx, view) {
    g = ctx;
    V = view;
    t = view.t;
    const st = S();

    fullBg();

    g.save();
    /* клип по сцене */
    g.beginPath();
    g.rect(V.stage.x, V.stage.y, V.stage.w, V.stage.h);
    g.clip();
    g.translate(V.stage.x, V.stage.y);
    const sc = V.stage.w / W;
    g.scale(sc, sc);
    const shake = st.fx.shake;
    if (shake > 0.1) g.translate((Math.random() - 0.5) * shake * 0.8, (Math.random() - 0.5) * shake * 0.8);
    try {
      switch (st.mode) {
        case 'title': drawTitle(); break;
        case 'help': drawHelp(); break;
        case 'about': drawAbout(); break;
        case 'settings': drawSettings(); break;
        case 'briefing': drawBriefing(); break;
        case 'play': drawWorld(); break;
        case 'dead': drawWorld(); drawDeathOverlay(); break;
        case 'paused': drawPause(); break;
        case 'bonus': drawBonus(); break;
        case 'levelclear': drawLevelClear(); break;
        case 'gameover': drawGameOver(); break;
        case 'win': drawWin(); break;
        default: g.fillStyle = '#05030f'; g.fillRect(0, 0, W, VH); break;
      }
    } finally {
      g.restore();
    }

    /* виньетка сцены */
    g.save();
    g.beginPath(); g.rect(V.stage.x, V.stage.y, V.stage.w, V.stage.h); g.clip();
    const vg = g.createRadialGradient(V.stage.x + V.stage.w / 2, V.stage.y + V.stage.h / 2, V.stage.h * 0.35,
      V.stage.x + V.stage.w / 2, V.stage.y + V.stage.h / 2, V.stage.h * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = vg;
    g.fillRect(V.stage.x, V.stage.y, V.stage.w, V.stage.h);
    /* сканлайны */
    if (PR.settings.crt) {
      g.globalAlpha = 0.05;
      g.fillStyle = '#000';
      for (let y = V.stage.y; y < V.stage.y + V.stage.h; y += 3) {
        g.fillRect(V.stage.x, y, V.stage.w, 1);
      }
      g.globalAlpha = 1;
    }
    g.restore();

    chrome(th());
  }

  window.PR_RENDER_MODERN = { draw: draw, W: W, H: VH };
})();

/* ==== src/main.js ==== */
/* ============================================================
   ПРОРЫВ HTML5 — оболочка: загрузка, масштабирование, цикл,
   ввод, звук, отладочные режимы (#test, #shot=...).
   ============================================================ */
(function () {
  'use strict';

  const PR = window.PR;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const errBox = document.getElementById('err');
  const testBox = document.getElementById('testout');

  const W = 256, VH = 208;
  const RETRO = window.PR_RENDER_RETRO;
  const MODERN = window.PR_RENDER_MODERN;
  const HASH = PR.HASH || {};

  /* offscreen для RETRO: ровно 256×208, потом масштабируем целым числом */
  const off = document.createElement('canvas');
  off.width = W; off.height = VH;
  const offCtx = off.getContext('2d', { alpha: false });
  offCtx.imageSmoothingEnabled = false;

  let dpr = 1, cw = 0, ch = 0, stage = { x: 0, y: 0, w: W, h: VH, scale: 1 };
  let acc = 0, last = 0, t = 0, booted = false;

  function reportError(msg) {
    if (!errBox) return;
    errBox.style.display = 'block';
    errBox.textContent += msg + '\n';
  }
  window.addEventListener('error', function (ev) { try { reportError(String(ev.message || ev.error || 'error')); } catch (e) { /* ok */ } });
  window.addEventListener('unhandledrejection', function (ev) { try { reportError('promise: ' + String(ev.reason)); } catch (e) { /* ok */ } });

  /* ---------- размеры ---------- */
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = Math.max(320, window.innerWidth);
    ch = Math.max(240, window.innerHeight);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (PR.settings.gfx === 'retro') {
      const s = Math.max(1, Math.floor(Math.min(cw / W, (ch - 8) / VH)));
      stage = { x: Math.round((cw - W * s) / 2), y: Math.round((ch - VH * s) / 2), w: W * s, h: VH * s, scale: s };
    } else {
      const pad = Math.min(cw, ch) > 700 ? 22 : 6;
      const sw = cw - pad * 2, sh = ch - pad * 2;
      const sc = Math.min(sw / W, sh / VH);
      const w = Math.round(W * sc), h = Math.round(VH * sc);
      stage = { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w, h, scale: sc };
    }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  /* ---------- звук ---------- */
  let audioBooted = false;
  function bootAudio() {
    if (audioBooted) return;
    audioBooted = true;
    const A = window.PR_AUDIO;
    if (!A) return;
    try {
      A.init();
      A.unlock();
      A.setMusic(PR.settings.music);
      A.setSfx(PR.settings.sfx);
      A.setVolume(0.8);
      if (PR.state.mode === 'title') A.playMusic('title');
    } catch (e) { reportError('audio: ' + e.message); }
  }

  /* ---------- ввод ---------- */
  const heldKey = {};
  function setHeld(code, down) {
    heldKey[code] = down;
    const i = PR.input;
    i.left = !!(heldKey.ArrowLeft || heldKey.KeyA);
    i.right = !!(heldKey.ArrowRight || heldKey.KeyD);
    i.up = !!(heldKey.ArrowUp || heldKey.KeyW);
    i.down = !!(heldKey.ArrowDown || heldKey.KeyS);
    i.fire = !!(heldKey.Space || heldKey.KeyZ);
  }

  const GAME_MODES = { play: 1, dead: 1 };

  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const code = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape'].indexOf(code) >= 0) e.preventDefault();
    bootAudio();
    if (e.repeat) { setHeld(code, true); return; }
    switch (code) {
      case 'ArrowLeft': case 'KeyA': setHeld(code, true); PR.pushAction('left'); break;
      case 'ArrowRight': case 'KeyD': setHeld(code, true); PR.pushAction('right'); break;
      case 'ArrowUp': case 'KeyW': setHeld(code, true); PR.pushAction('up'); break;
      case 'ArrowDown': case 'KeyS': setHeld(code, true); PR.pushAction('down'); break;
      case 'Space': case 'KeyZ':
        setHeld(code, true);
        if (GAME_MODES[PR.state.mode]) { /* огонь */ }
        else PR.pushAction('action');
        break;
      case 'Enter': case 'NumpadEnter': PR.pushAction('enter'); break;
      case 'Escape': case 'KeyP': PR.pushAction('pause'); break;
      case 'KeyL': PR.pushAction('lang'); break;
      case 'KeyG': PR.pushAction('gfx'); resize(); break;
      case 'KeyM': PR.pushAction('music'); break;
      case 'KeyN': PR.pushAction('sfx'); break;
      case 'KeyF': toggleFullscreen(); break;
      case 'KeyR': PR.pushAction('restart'); break;
      default: break;
    }
  });
  window.addEventListener('keyup', function (e) { setHeld(e.code, false); });
  window.addEventListener('blur', function () {
    Object.keys(heldKey).forEach(function (k) { heldKey[k] = false; });
    setHeld('x', false);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && PR.state.mode === 'play') PR.setMode('paused');
  });

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) { /* ok */ }
  }

  /* ---------- указатель (мышь/тап) ---------- */
  function logical(x, y) {
    return { x: (x - stage.x) / stage.scale, y: (y - stage.y) / stage.scale };
  }
  canvas.addEventListener('pointerdown', function (e) {
    bootAudio();
    const p = logical(e.clientX, e.clientY);
    PR.input.pointer.x = p.x;
    PR.input.pointer.y = p.y;
    PR.input.pointer.clicked = true;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    const p = logical(e.clientX, e.clientY);
    PR.input.pointer.x = p.x;
    PR.input.pointer.y = p.y;
    if (PR.hover) PR.hover(p.x, p.y);
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- отрисовка ---------- */
  function render() {
    const usingRetro = PR.settings.gfx === 'retro';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    if (usingRetro) {
      /* фон-подложка под «кинескопом» */
      ctx.fillStyle = '#04030a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.imageSmoothingEnabled = false;
      RETRO.draw(offCtx, { w: W, h: VH, t: t });

      const d = dpr;
      /* мягкое свечение вокруг */
      ctx.save();
      ctx.shadowColor = 'rgba(80,120,255,0.35)';
      ctx.shadowBlur = 24 * d;
      ctx.fillStyle = '#000';
      ctx.fillRect(stage.x * d, stage.y * d, stage.w * d, stage.h * d);
      ctx.restore();

      ctx.drawImage(off, 0, 0, W, VH, stage.x * d, stage.y * d, stage.w * d, stage.h * d);

      if (PR.settings.crt) {
        /* фосфорное послесвечение */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.07;
        ctx.drawImage(off, 0, 0, W, VH, stage.x * d, stage.y * d, stage.w * d, stage.h * d);
        ctx.restore();
        /* скан-линии */
        ctx.save();
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = '#000';
        const step = Math.max(2, Math.round(stage.scale * d));
        for (let y = stage.y * d; y < (stage.y + stage.h) * d; y += step) {
          ctx.fillRect(stage.x * d, y, stage.w * d, Math.max(1, Math.round(step * 0.25)));
        }
        ctx.restore();
      }
      /* тонкая рамка */
      ctx.strokeStyle = 'rgba(130,150,255,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(stage.x * d + 0.5, stage.y * d + 0.5, stage.w * d - 1, stage.h * d - 1);
    } else {
      ctx.fillStyle = '#05030f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      MODERN.draw(ctx, {
        cw: cw, ch: ch,
        stage: { x: stage.x * dpr / dpr, y: stage.y, w: stage.w, h: stage.h },
        t: t
      });
      ctx.restore();
    }
  }

  /* ---------- цикл ---------- */
  function frame(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.25) dt = 0.25;
    t += dt;
    acc += dt;
    const STEP = 1 / 60;
    let guard = 0;
    while (acc >= STEP && guard < 4) {
      PR.update(STEP);
      acc -= STEP;
      guard++;
    }
    if (guard >= 4) acc = 0;
    render();
    requestAnimationFrame(frame);
  }

  /* ---------- отладка ---------- */
  function runTests() {
    const res = PR.runTests();
    const fails = res.filter(function (r) { return !r.ok; });
    const lines = res.map(function (r) { return (r.ok ? '  ok  ' : ' FAIL ') + r.name; });
    document.title = 'ПРОРЫВ TESTS ' + (res.length - fails.length) + '/' + res.length + (fails.length ? ' FAIL' : ' PASS');
    if (testBox) {
      testBox.style.display = 'block';
      testBox.textContent = 'ПРОРЫВ TESTS\n' + lines.join('\n') + '\n\n' +
        (fails.length ? 'ПРОВАЛЕНО: ' + fails.length : 'ВСЁ ПРОШЛО: ' + res.length + '/' + res.length) +
        (PR.state.debug.missingGlyphs ? '\nнет глифов: ' + PR.state.debug.missingGlyphs : '');
    }
    return res;
  }
  PR.renderTests = runTests;

  /* ---------- загрузка ---------- */
  function boot() {
    /* RETRO — режим по умолчанию при КАЖДОМ запуске.
       NEON включается только клавишей G в текущей сессии (и #gfx=modern для отладки). */
    PR.settings.gfx = (PR.HASH && PR.HASH.gfx === 'modern') ? 'modern' : 'retro';
    try { PR.saveSettings(); } catch (e) { /* ok */ }
    PR.BUILD = '28.10.2026';
    resize();
    PR.prepareTitle();
    if (PR.settings.gfx === 'modern') resize();

    const shot = HASH.shot;
    if (shot) {
      const level = HASH.level != null ? parseInt(HASH.level, 10) - 1 : 0;
      const screen = HASH.screen != null ? parseInt(HASH.screen, 10) - 1 : 0;
      PR.prepareShot(String(shot), { level: Math.max(0, level), screen: Math.max(0, screen) });
      if (HASH.mode) PR.setMode(String(HASH.mode));
    }
    if (HASH.test) {
      /* кадр для инициализации, затем тесты */
      requestAnimationFrame(function () {
        runTests();
        PR.prepareShot('title');
        if (PR.settings.gfx === 'modern') resize();
      });
    }
    if (HASH.music === 'off') {
      PR.settings.music = false;
      if (window.PR_AUDIO && window.PR_AUDIO.setMusic) window.PR_AUDIO.setMusic(false);
    }
    if (HASH.crt === 'off') PR.settings.crt = false;

    booted = true;
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* экспорт для QA-скриптов */
  window.PR_MAIN = {
    resize: resize,
    render: render,
    tests: runTests,
    stage: function () { return stage; },
    booted: function () { return booted; }
  };
})();

