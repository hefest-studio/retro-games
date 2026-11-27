/* СТАРАТЕЛЬ · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — СТАРАТЕЛЬ, остальные — GOLDFLUME.
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var SW = global.STARATEL = global.STARATEL || {};
  SW.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Шахта', best: 'Рекорд',
      win: 'ВСЕ ШАХТЫ ПРОМЫТЫ!', gameover: 'СМЕНА ОКОНЧЕНА', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'СТАРАТЕЛЬ', subtitle: 'Шлюзы и шурфы · направь воду, подними вагонетки', back: 'Каталог', lives: 'Жизни',
      lb: 'Лидеры', lbAll: 'Звёзды', rwHint: 'Реклама: подсказка', oldBest: 'Прежний рекорд', migrated: 'Игра обновлена: теперь это пазл про воду, звёзды — с нуля',
      moves: 'Ходы', norm: 'Норма', undo: 'Отмена', restart: 'Заново', hint: 'Подсказка', stuck: 'Тупик: отмени ход или начни заново', cleared: 'ВАГОНЕТКИ НАВЕРХУ',
      next: 'Дальше', again: 'Ещё раз', shafts: 'Шахты', stars: 'Звёзды', locked: 'Закрыто: пройди предыдущую', cont: 'Продолжить', go: 'ОТКРОЙ ШЛЮЗ', newStar: 'НОВЫЙ РЕКОРД',
      tut1: 'Тронь шлюз: вода пойдёт и увезёт вагонетку к подъёмнику', tut2: 'Рыхлую породу можно пробить шурфом: тронь её',
      tut3: 'Вода несёт вагонетку вдоль течения. Лишний спуск закрой', tut4: 'Вагонетка встанет там, где кончается вода. Закрой шлюз у подъёмника заранее',
      tutK1: 'Стрелки выбирают клетку, Пробел — открыть шлюз или пробить породу', tutK2: 'Рыхлую породу можно пробить шурфом: Пробел',
      tutK3: 'Вода несёт вагонетку вдоль течения. Лишний спуск закрой', tutK4: 'Вагонетка встанет там, где кончается вода. Закрой шлюз у подъёмника заранее',
      hint0: 'Стрелки — выбрать · Пробел — шлюз/шурф · Z — отмена · R — заново · C — подсказка', hintTouch: 'Тронь шлюз или породу · ↶ отмена · ⟲ заново · ? подсказка',
      foot: '<b>СТАРАТЕЛЬ</b> · стрелки — выбрать, Пробел или клик — шлюз/шурф, Z — отмена, R — заново, C — подсказка · P/Esc — пауза · L язык, T тема, M звук'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Mine', best: 'Best',
      win: 'ALL MINES WASHED!', gameover: 'SHIFT OVER', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GOLDFLUME', subtitle: 'Gates and shafts · steer the water, lift the carts', back: 'Catalog', lives: 'Lives',
      lb: 'Leaderboard', lbAll: 'Stars', rwHint: 'Watch ad: hint', oldBest: 'Previous best', migrated: 'Game updated: now it is a water puzzle, stars start from zero',
      moves: 'Moves', norm: 'Par', undo: 'Undo', restart: 'Restart', hint: 'Hint', stuck: 'Dead end: undo a move or restart', cleared: 'CARTS ARE UP',
      next: 'Next', again: 'Again', shafts: 'Mines', stars: 'Stars', locked: 'Locked: clear the previous mine', cont: 'Continue', go: 'OPEN A GATE', newStar: 'NEW BEST',
      tut1: 'Tap the gate: the water flows and carries the cart to the lift', tut2: 'Loose rock can be broken with a shaft: tap it',
      tut3: 'Water carries the cart along the current. Shut the wrong chute', tut4: 'The cart stops where the water ends. Shut the gate by the lift first',
      tutK1: 'Arrows pick a tile, Space opens a gate or breaks the rock', tutK2: 'Loose rock can be broken with a shaft: Space',
      tutK3: 'Water carries the cart along the current. Shut the wrong chute', tutK4: 'The cart stops where the water ends. Shut the gate by the lift first',
      hint0: 'Arrows: pick · Space: gate/shaft · Z: undo · R: restart · C: hint', hintTouch: 'Tap a gate or rock · ↶ undo · ⟲ restart · ? hint',
      foot: '<b>GOLDFLUME</b> · arrows: pick, Space or click: gate/shaft, Z: undo, R: restart, C: hint · P/Esc: pause · L language, T theme, M sound'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Maden', best: 'Rekor',
      win: 'TÜM MADENLER YIKANDI!', gameover: 'VARDİYA BİTTİ', pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'GOLDFLUME', subtitle: 'Kapaklar ve kuyular · suyu yönlendir, vagonları çıkar', back: 'Katalog', lives: 'Can',
      lb: 'Sıralama', lbAll: 'Yıldız', rwHint: 'Reklam: ipucu', oldBest: 'Önceki rekor', migrated: 'Oyun güncellendi: artık bir su bulmacası, yıldızlar sıfırdan başlar',
      moves: 'Hamle', norm: 'Hedef', undo: 'Geri al', restart: 'Yeniden', hint: 'İpucu', stuck: 'Çıkmaz: hamleyi geri al veya yeniden başla', cleared: 'VAGONLAR YUKARIDA',
      next: 'Sonraki', again: 'Tekrar', shafts: 'Madenler', stars: 'Yıldız', locked: 'Kilitli: önceki madeni bitir', cont: 'Devam', go: 'BİR KAPAĞI AÇ', newStar: 'YENİ REKOR',
      tut1: 'Kapağa dokun: su akar ve vagonu asansöre taşır', tut2: 'Gevşek kaya kuyu açarak kırılır: ona dokun',
      tut3: 'Su vagonu akıntı yönünde taşır. Yanlış oluğu kapat', tut4: 'Vagon suyun bittiği yerde durur. Önce asansörün yanındaki kapağı kapat',
      tutK1: 'Oklar kareyi seçer, Boşluk kapağı açar veya kayayı kırar', tutK2: 'Gevşek kaya kuyu açarak kırılır: Boşluk',
      tutK3: 'Su vagonu akıntı yönünde taşır. Yanlış oluğu kapat', tutK4: 'Vagon suyun bittiği yerde durur. Önce asansörün yanındaki kapağı kapat',
      hint0: 'Oklar: seç · Boşluk: kapak/kuyu · Z: geri al · R: yeniden · C: ipucu', hintTouch: 'Kapağa veya kayaya dokun · ↶ geri al · ⟲ yeniden · ? ipucu',
      foot: '<b>GOLDFLUME</b> · oklar: seç, Boşluk veya tık: kapak/kuyu, Z: geri al, R: yeniden, C: ipucu · P/Esc: duraklat · L dil, T tema, M ses'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Mina', best: 'Récord',
      win: '¡TODAS LAS MINAS LAVADAS!', gameover: 'TURNO TERMINADO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'GOLDFLUME', subtitle: 'Compuertas y pozos · guía el agua, sube las vagonetas', back: 'Catálogo', lives: 'Vidas',
      lb: 'Clasificación', lbAll: 'Estrellas', rwHint: 'Anuncio: pista', oldBest: 'Récord anterior', migrated: 'Juego actualizado: ahora es un puzle de agua, las estrellas empiezan de cero',
      moves: 'Jugadas', norm: 'Meta', undo: 'Deshacer', restart: 'Reiniciar', hint: 'Pista', stuck: 'Callejón sin salida: deshaz una jugada o reinicia', cleared: 'VAGONETAS ARRIBA',
      next: 'Siguiente', again: 'Otra vez', shafts: 'Minas', stars: 'Estrellas', locked: 'Bloqueada: termina la mina anterior', cont: 'Continuar', go: 'ABRE UNA COMPUERTA', newStar: 'NUEVO RÉCORD',
      tut1: 'Toca la compuerta: el agua corre y lleva la vagoneta al elevador', tut2: 'La roca suelta se rompe con un pozo: tócala',
      tut3: 'El agua lleva la vagoneta con la corriente. Cierra la bajada que sobra', tut4: 'La vagoneta se detiene donde acaba el agua. Cierra antes la compuerta junto al elevador',
      tutK1: 'Las flechas eligen la casilla, Espacio abre la compuerta o rompe la roca', tutK2: 'La roca suelta se rompe con un pozo: Espacio',
      tutK3: 'El agua lleva la vagoneta con la corriente. Cierra la bajada que sobra', tutK4: 'La vagoneta se detiene donde acaba el agua. Cierra antes la compuerta junto al elevador',
      hint0: 'Flechas: elegir · Espacio: compuerta/pozo · Z: deshacer · R: reiniciar · C: pista', hintTouch: 'Toca compuerta o roca · ↶ deshacer · ⟲ reiniciar · ? pista',
      foot: '<b>GOLDFLUME</b> · flechas: elegir, Espacio o clic: compuerta/pozo, Z: deshacer, R: reiniciar, C: pista · P/Esc: pausa · L idioma, T tema, M sonido'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Mina', best: 'Recorde',
      win: 'TODAS AS MINAS LAVADAS!', gameover: 'TURNO ENCERRADO', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'GOLDFLUME', subtitle: 'Comportas e poços · guie a água, suba os vagões', back: 'Catálogo', lives: 'Vidas',
      lb: 'Classificação', lbAll: 'Estrelas', rwHint: 'Anúncio: dica', oldBest: 'Recorde anterior', migrated: 'Jogo atualizado: agora é um quebra-cabeça de água, as estrelas começam do zero',
      moves: 'Jogadas', norm: 'Meta', undo: 'Desfazer', restart: 'Reiniciar', hint: 'Dica', stuck: 'Beco sem saída: desfaça uma jogada ou reinicie', cleared: 'VAGÕES NO TOPO',
      next: 'Próxima', again: 'De novo', shafts: 'Minas', stars: 'Estrelas', locked: 'Bloqueada: termine a mina anterior', cont: 'Continuar', go: 'ABRA UMA COMPORTA', newStar: 'NOVO RECORDE',
      tut1: 'Toque na comporta: a água corre e leva o vagão ao elevador', tut2: 'A rocha solta quebra com um poço: toque nela',
      tut3: 'A água leva o vagão com a corrente. Feche a descida que sobra', tut4: 'O vagão para onde a água acaba. Feche antes a comporta junto ao elevador',
      tutK1: 'As setas escolhem a casa, Espaço abre a comporta ou quebra a rocha', tutK2: 'A rocha solta quebra com um poço: Espaço',
      tutK3: 'A água leva o vagão com a corrente. Feche a descida que sobra', tutK4: 'O vagão para onde a água acaba. Feche antes a comporta junto ao elevador',
      hint0: 'Setas: escolher · Espaço: comporta/poço · Z: desfazer · R: reiniciar · C: dica', hintTouch: 'Toque em comporta ou rocha · ↶ desfazer · ⟲ reiniciar · ? dica',
      foot: '<b>GOLDFLUME</b> · setas: escolher, Espaço ou clique: comporta/poço, Z: desfazer, R: reiniciar, C: dica · P/Esc: pausa · L idioma, T tema, M som'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
