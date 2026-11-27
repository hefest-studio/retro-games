/* ОБВАЛ · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — ОБВАЛ, остальные — PITPROP («pit prop» — шахтная стойка).
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var OB = global.OBVAL = global.OBVAL || {};
  OB.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Шахта', best: 'Рекорд',
      win: 'ВСЕ ШАХТЫ УКРЕПЛЕНЫ!', gameover: 'СМЕНА ОКОНЧЕНА', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ОБВАЛ', subtitle: 'Крепильщик · выбей опору, обрушь породу', back: 'Каталог', lives: 'Жизни',
      lb: 'Лидеры', lbAll: 'Звёзды', rwHint: 'Реклама: подсказка', oldBest: 'Прежний рекорд', migrated: 'Игра обновлена: теперь это пазл про крепи, звёзды — с нуля',
      moves: 'Ходы', norm: 'Норма', undo: 'Отмена', restart: 'Заново', hint: 'Подсказка', stuck: 'Тупик: отмени ход или начни заново', dead: 'Шахтёра засыпало: отмени ход',
      cleared: 'ШАХТА ОЧИЩЕНА', props: 'Крепи', saved: 'Спасены', hazards: 'Очаги',
      next: 'Дальше', again: 'Ещё раз', shafts: 'Шахты', stars: 'Звёзды', locked: 'Закрыто: пройди предыдущую', cont: 'Продолжить', go: 'ВЫБЕЙ КРЕПЬ', newStar: 'НОВЫЙ РЕКОРД',
      tut1: 'Тронь крепь: порода, что на ней держалась, рухнет в очаг', tut2: 'Выбей крепь под шахтёром: он упадёт и выйдет. 1–2 клетки — безопасно',
      tut3: 'С высоты 3 клеток шахтёр гибнет. Поставь крепь внизу: тронь пустую клетку у пола', tut4: 'Порода держится опорой или зажата с двух сторон. Выбей опору, и ряд рухнет цепью',
      tut5: 'Шахтёр идёт вперёд, пока может. Засыпь обрыв упавшей породой, и он пройдёт', tut6: 'Порядок важен: сначала мост из породы, потом спуск шахтёра',
      tutK1: 'Стрелки выбирают клетку, Пробел выбивает крепь: порода рухнет в очаг', tutK2: 'Выбей крепь под шахтёром (Пробел): он упадёт и выйдет. 1–2 клетки — безопасно',
      tutK3: 'С высоты 3 клеток шахтёр гибнет. Поставь крепь внизу: стрелки и Пробел на пустой клетке у пола', tutK4: 'Порода держится опорой или зажата с двух сторон. Выбей опору, и ряд рухнет цепью',
      tutK5: 'Шахтёр идёт вперёд, пока может. Засыпь обрыв упавшей породой, и он пройдёт', tutK6: 'Порядок важен: сначала мост из породы, потом спуск шахтёра',
      hint0: 'Стрелки — выбрать · Пробел — крепь · Z — отмена · R — заново · C — подсказка', hintTouch: 'Тронь крепь или пустую клетку · ↶ отмена · ⟲ заново · ? подсказка',
      foot: '<b>ОБВАЛ</b> · стрелки — выбрать, Пробел или клик — поставить/выбить крепь, Z — отмена, R — заново, C — подсказка · P/Esc — пауза · L язык, T тема, M звук'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Mine', best: 'Best',
      win: 'ALL MINES SHORED UP!', gameover: 'SHIFT OVER', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'PITPROP', subtitle: 'Knock out the props, bring the rock down', back: 'Catalog', lives: 'Lives',
      lb: 'Leaderboard', lbAll: 'Stars', rwHint: 'Watch ad: hint', oldBest: 'Previous best', migrated: 'Game updated: now it is a prop puzzle, stars start from zero',
      moves: 'Moves', norm: 'Par', undo: 'Undo', restart: 'Restart', hint: 'Hint', stuck: 'Dead end: undo a move or restart', dead: 'A miner is buried: undo a move',
      cleared: 'MINE CLEARED', props: 'Props', saved: 'Rescued', hazards: 'Hazards',
      next: 'Next', again: 'Again', shafts: 'Mines', stars: 'Stars', locked: 'Locked: clear the previous mine', cont: 'Continue', go: 'KNOCK OUT A PROP', newStar: 'NEW BEST',
      tut1: 'Tap a prop: the rock it held will fall into the hazard pit', tut2: 'Knock out the prop under the miner: he drops to the exit. 1–2 cells is safe',
      tut3: 'A fall of 3 cells kills a miner. Place a prop below: tap an empty cell at the floor', tut4: 'Rock holds on a support or wedged on both sides. Knock out the support and the row collapses in a chain',
      tut5: 'The miner walks on while he can. Fill the drop with falling rock and he crosses', tut6: 'Order matters: lay the rock bridge first, then lower the miner',
      tutK1: 'Arrows pick a tile, Space knocks out the prop: the rock falls into the hazard pit', tutK2: 'Knock out the prop under the miner (Space): he drops to the exit. 1–2 cells is safe',
      tutK3: 'A fall of 3 cells kills a miner. Place a prop below: arrows and Space on an empty floor tile', tutK4: 'Rock holds on a support or wedged on both sides. Knock out the support and the row collapses in a chain',
      tutK5: 'The miner walks on while he can. Fill the drop with falling rock and he crosses', tutK6: 'Order matters: lay the rock bridge first, then lower the miner',
      hint0: 'Arrows: pick · Space: prop · Z: undo · R: restart · C: hint', hintTouch: 'Tap a prop or an empty tile · ↶ undo · ⟲ restart · ? hint',
      foot: '<b>PITPROP</b> · arrows: pick, Space or click: place/knock out a prop, Z: undo, R: restart, C: hint · P/Esc: pause · L language, T theme, M sound'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Maden', best: 'Rekor',
      win: 'TÜM MADENLER DESTEKLENDİ!', gameover: 'VARDİYA BİTTİ', pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'PITPROP', subtitle: 'Direkleri çek, kayayı indir', back: 'Katalog', lives: 'Can',
      lb: 'Sıralama', lbAll: 'Yıldız', rwHint: 'Reklam: ipucu', oldBest: 'Önceki rekor', migrated: 'Oyun güncellendi: artık bir direk bulmacası, yıldızlar sıfırdan başlar',
      moves: 'Hamle', norm: 'Hedef', undo: 'Geri al', restart: 'Yeniden', hint: 'İpucu', stuck: 'Çıkmaz: hamleyi geri al veya yeniden başla', dead: 'İşçi gömüldü: hamleyi geri al',
      cleared: 'MADEN TEMİZ', props: 'Direk', saved: 'Kurtulan', hazards: 'Tehlike',
      next: 'Sonraki', again: 'Tekrar', shafts: 'Madenler', stars: 'Yıldız', locked: 'Kilitli: önceki madeni bitir', cont: 'Devam', go: 'BİR DİREĞİ ÇEK', newStar: 'YENİ REKOR',
      tut1: 'Direğe dokun: tuttuğu kaya tehlike çukuruna düşer', tut2: 'İşçinin altındaki direği çek: işçi düşüp çıkışa varır. 1–2 kare güvenlidir',
      tut3: '3 kare düşen işçi ölür. Aşağıya direk koy: zemindeki boş kareye dokun', tut4: 'Kaya bir dayanakla veya iki yandan sıkışarak durur. Dayanağı çek, sıra zincirleme çöker',
      tut5: 'İşçi yürüyebildiği sürece ilerler. Boşluğu düşen kayayla doldur, geçsin', tut6: 'Sıra önemli: önce kaya köprüyü kur, sonra işçiyi indir',
      tutK1: 'Oklar kareyi seçer, Boşluk direği çeker: kaya tehlike çukuruna düşer', tutK2: 'İşçinin altındaki direği çek (Boşluk): işçi düşüp çıkışa varır. 1–2 kare güvenlidir',
      tutK3: '3 kare düşen işçi ölür. Aşağıya direk koy: oklar ve Boşluk ile zemindeki boş kare', tutK4: 'Kaya bir dayanakla veya iki yandan sıkışarak durur. Dayanağı çek, sıra zincirleme çöker',
      tutK5: 'İşçi yürüyebildiği sürece ilerler. Boşluğu düşen kayayla doldur, geçsin', tutK6: 'Sıra önemli: önce kaya köprüyü kur, sonra işçiyi indir',
      hint0: 'Oklar: seç · Boşluk: direk · Z: geri al · R: yeniden · C: ipucu', hintTouch: 'Direğe veya boş kareye dokun · ↶ geri al · ⟲ yeniden · ? ipucu',
      foot: '<b>PITPROP</b> · oklar: seç, Boşluk veya tık: direk koy/çek, Z: geri al, R: yeniden, C: ipucu · P/Esc: duraklat · L dil, T tema, M ses'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Mina', best: 'Récord',
      win: '¡TODAS LAS MINAS ENTIBADAS!', gameover: 'TURNO TERMINADO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'PITPROP', subtitle: 'Quita los puntales, haz caer la roca', back: 'Catálogo', lives: 'Vidas',
      lb: 'Clasificación', lbAll: 'Estrellas', rwHint: 'Anuncio: pista', oldBest: 'Récord anterior', migrated: 'Juego actualizado: ahora es un puzle de puntales, las estrellas empiezan de cero',
      moves: 'Jugadas', norm: 'Meta', undo: 'Deshacer', restart: 'Reiniciar', hint: 'Pista', stuck: 'Callejón sin salida: deshaz una jugada o reinicia', dead: 'Un minero quedó sepultado: deshaz la jugada',
      cleared: 'MINA DESPEJADA', props: 'Puntales', saved: 'Rescatados', hazards: 'Peligros',
      next: 'Siguiente', again: 'Otra vez', shafts: 'Minas', stars: 'Estrellas', locked: 'Bloqueada: termina la mina anterior', cont: 'Continuar', go: 'QUITA UN PUNTAL', newStar: 'NUEVO RÉCORD',
      tut1: 'Toca el puntal: la roca que sostenía caerá en el foco de peligro', tut2: 'Quita el puntal bajo el minero: cae y llega a la salida. 1–2 casillas son seguras',
      tut3: 'Una caída de 3 casillas mata al minero. Pon un puntal abajo: toca una casilla vacía en el suelo', tut4: 'La roca se sostiene con un apoyo o encajada a ambos lados. Quita el apoyo y la fila se derrumba en cadena',
      tut5: 'El minero avanza mientras pueda. Rellena el desnivel con roca caída y pasará', tut6: 'El orden importa: primero el puente de roca, luego baja al minero',
      tutK1: 'Las flechas eligen la casilla, Espacio quita el puntal: la roca cae en el foco de peligro', tutK2: 'Quita el puntal bajo el minero (Espacio): cae y llega a la salida. 1–2 casillas son seguras',
      tutK3: 'Una caída de 3 casillas mata al minero. Pon un puntal abajo: flechas y Espacio en una casilla vacía del suelo', tutK4: 'La roca se sostiene con un apoyo o encajada a ambos lados. Quita el apoyo y la fila se derrumba en cadena',
      tutK5: 'El minero avanza mientras pueda. Rellena el desnivel con roca caída y pasará', tutK6: 'El orden importa: primero el puente de roca, luego baja al minero',
      hint0: 'Flechas: elegir · Espacio: puntal · Z: deshacer · R: reiniciar · C: pista', hintTouch: 'Toca un puntal o una casilla vacía · ↶ deshacer · ⟲ reiniciar · ? pista',
      foot: '<b>PITPROP</b> · flechas: elegir, Espacio o clic: poner/quitar puntal, Z: deshacer, R: reiniciar, C: pista · P/Esc: pausa · L idioma, T tema, M sonido'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Mina', best: 'Recorde',
      win: 'TODAS AS MINAS ESCORADAS!', gameover: 'TURNO ENCERRADO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'PITPROP', subtitle: 'Tire as escoras, derrube a rocha', back: 'Catálogo', lives: 'Vidas',
      lb: 'Classificação', lbAll: 'Estrelas', rwHint: 'Anúncio: dica', oldBest: 'Recorde anterior', migrated: 'Jogo atualizado: agora é um quebra-cabeça de escoras, as estrelas começam do zero',
      moves: 'Jogadas', norm: 'Meta', undo: 'Desfazer', restart: 'Reiniciar', hint: 'Dica', stuck: 'Beco sem saída: desfaça uma jogada ou reinicie', dead: 'Um mineiro foi soterrado: desfaça a jogada',
      cleared: 'MINA LIMPA', props: 'Escoras', saved: 'Resgatados', hazards: 'Perigos',
      next: 'Próxima', again: 'De novo', shafts: 'Minas', stars: 'Estrelas', locked: 'Bloqueada: termine a mina anterior', cont: 'Continuar', go: 'TIRE UMA ESCORA', newStar: 'NOVO RECORDE',
      tut1: 'Toque na escora: a rocha que ela segurava cai no foco de perigo', tut2: 'Tire a escora sob o mineiro: ele cai e chega à saída. 1–2 casas são seguras',
      tut3: 'Uma queda de 3 casas mata o mineiro. Coloque uma escora embaixo: toque numa casa vazia no chão', tut4: 'A rocha se sustenta num apoio ou encaixada dos dois lados. Tire o apoio e a fileira desaba em cadeia',
      tut5: 'O mineiro segue enquanto puder. Preencha o desnível com rocha caída e ele passa', tut6: 'A ordem importa: faça primeiro a ponte de rocha, depois desça o mineiro',
      tutK1: 'As setas escolhem a casa, Espaço tira a escora: a rocha cai no foco de perigo', tutK2: 'Tire a escora sob o mineiro (Espaço): ele cai e chega à saída. 1–2 casas são seguras',
      tutK3: 'Uma queda de 3 casas mata o mineiro. Coloque uma escora embaixo: setas e Espaço numa casa vazia do chão', tutK4: 'A rocha se sustenta num apoio ou encaixada dos dois lados. Tire o apoio e a fileira desaba em cadeia',
      tutK5: 'O mineiro segue enquanto puder. Preencha o desnível com rocha caída e ele passa', tutK6: 'A ordem importa: faça primeiro a ponte de rocha, depois desça o mineiro',
      hint0: 'Setas: escolher · Espaço: escora · Z: desfazer · R: reiniciar · C: dica', hintTouch: 'Toque numa escora ou casa vazia · ↶ desfazer · ⟲ reiniciar · ? dica',
      foot: '<b>PITPROP</b> · setas: escolher, Espaço ou clique: pôr/tirar escora, Z: desfazer, R: reiniciar, C: dica · P/Esc: pausa · L idioma, T tema, M som'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
