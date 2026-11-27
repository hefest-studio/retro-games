/* МУРАВЕЙНИК · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — МУРАВЕЙНИК, EN/TR/ES/PT — GALLERYTRAIL
   (одно имя внутри языка, Яндекс 5.1.3). Ключи play/language/theme/… — для экранов движка, остальные — игре.
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var MU = global.MURAV = global.MURAV || {};
  MU.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Ярус', best: 'Рекорд',
      win: 'МУРАВЕЙНИК ПОЛОН!', gameover: 'КОЛОНИЮ РАЗОРИЛИ', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'МУРАВЕЙНИК', subtitle: 'Колония идёт по туннелям, которые ты роешь', back: 'Каталог', lives: 'Жизни',
      lb: 'Лидеры', lbAll: 'Очки', rwBonus: 'Реклама: +2 муравья в колонию', oldBest: 'Прежний рекорд', migrated: 'Игра обновлена: теперь это «МУРАВЕЙНИК», новый рекорд — с нуля',
      clear: 'ЯРУС ГОТОВ', crumbs: 'Крошки', collapse: 'Обвал', life: '+1 ЖИЗНЬ', bite: 'УКУС', hatch: '+1 МУРАВЕЙ', entomb: 'ЖУК ЗАМУРОВАН', go: 'РОЙ ВНИЗ!', bonus: 'Бонус', nextUp: 'пробел / тап — дальше', load: 'Груз', ants: 'Муравьи',
      tut1: 'Веди стик вниз: головной муравей роет туннель. Подбери крошку и неси её в камеру наверху', tut2: 'Каждый муравей несёт одну крошку. За две сданные крошки вылупляется новый муравей',
      tut3: 'Жук! Укус в середину отрывает хвост колонны, укус в голову — минус жизнь', tut4: 'Жук спереди? Потяни назад: колонна развернётся. Затем ▼ Обвал — жук замурован', tut5: 'Грызун прокапывает землю сам. Не давай ему догнать',
      tutK1: 'Стрелки вниз: головной муравей роет туннель. Подбери крошку и неси её в камеру наверху', tutK2: 'Каждый муравей несёт одну крошку. За две сданные крошки вылупляется новый муравей',
      tutK3: 'Жук! Укус в середину отрывает хвост колонны, укус в голову — минус жизнь', tutK4: 'Жук спереди? Стрелка назад — колонна развернётся. Затем Пробел — обвал: жук замурован', tutK5: 'Грызун прокапывает землю сам. Не давай ему догнать',
      hint: 'Стрелки — вести колонну · Пробел — обвал · P — пауза', hintTouch: 'Стик — вести колонну · ▼ обвал · II — пауза',
      foot: '<b>МУРАВЕЙНИК</b> · стрелки/WASD — вести колонну, Пробел — обвал за хвостом · P/Esc — пауза · L язык, T тема, M звук'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Tier', best: 'Best',
      win: 'THE COLONY THRIVES!', gameover: 'THE COLONY FELL', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GALLERYTRAIL', subtitle: 'An ant colony follows the tunnels you dig', back: 'Catalog', lives: 'Lives',
      lb: 'Leaderboard', lbAll: 'Score', rwBonus: 'Watch ad: +2 ants for the colony', oldBest: 'Previous best', migrated: 'Game updated: now it is GALLERYTRAIL, new best starts from zero',
      clear: 'TIER DONE', crumbs: 'Crumbs', collapse: 'Cave-in', life: '+1 LIFE', bite: 'BITTEN', hatch: '+1 ANT', entomb: 'BEETLE SEALED', go: 'DIG DOWN!', bonus: 'Bonus', nextUp: 'space / tap — next', load: 'Load', ants: 'Ants',
      tut1: 'Hold the stick down: the lead ant digs a tunnel. Grab a crumb and carry it to the chamber on top', tut2: 'Each ant carries one crumb. Every two crumbs delivered hatch a new ant',
      tut3: 'A beetle! A bite mid-column cuts the tail off; a bite on the head costs a life', tut4: 'Beetle ahead? Pull back: the column turns around. Then ▼ Cave-in seals the beetle', tut5: 'The gnawer digs through soil on its own. Do not let it catch you',
      tutK1: 'Arrow down: the lead ant digs a tunnel. Grab a crumb and carry it to the chamber on top', tutK2: 'Each ant carries one crumb. Every two crumbs delivered hatch a new ant',
      tutK3: 'A beetle! A bite mid-column cuts the tail off; a bite on the head costs a life', tutK4: 'Beetle ahead? Press back: the column turns around. Then Space cave-in seals the beetle', tutK5: 'The gnawer digs through soil on its own. Do not let it catch you',
      hint: 'Arrows: lead the colony · Space: cave-in · P: pause', hintTouch: 'Stick: lead the colony · ▼ cave-in · II: pause',
      foot: '<b>GALLERYTRAIL</b> · arrows/WASD: lead the colony, Space: cave-in behind the tail · P/Esc: pause · L language, T theme, M sound'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Kat', best: 'Rekor',
      win: 'KOLONİ GELİŞTİ!', gameover: 'KOLONİ YIKILDI', pause: 'DURAKLAT', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
      title: 'GALLERYTRAIL', subtitle: 'Karınca kolonisi kazdığın tünellerden ilerler', back: 'Katalog', lives: 'Can',
      lb: 'Sıralama', lbAll: 'Puan', rwBonus: 'Reklam: koloniye +2 karınca', oldBest: 'Önceki rekor', migrated: 'Oyun güncellendi: artık GALLERYTRAIL, yeni rekor sıfırdan başlar',
      clear: 'KAT TAMAM', crumbs: 'Kırıntı', collapse: 'Çökertme', life: '+1 CAN', bite: 'ISIRILDI', hatch: '+1 KARINCA', entomb: 'BÖCEK GÖMÜLDÜ', go: 'AŞAĞI KAZ!', bonus: 'Bonus', nextUp: 'boşluk / dokun — devam', load: 'Yük', ants: 'Karıncalar',
      tut1: 'Çubuğu aşağı tut: öndeki karınca tünel kazar. Kırıntıyı al, üstteki odaya taşı', tut2: 'Her karınca bir kırıntı taşır. Teslim edilen her iki kırıntıda yeni bir karınca çıkar',
      tut3: 'Böcek! Orta kısımdan ısırık kolonun kuyruğunu koparır, baştan ısırık can götürür', tut4: 'Böcek önde mi? Geri çek: kolon döner. Sonra ▼ Çökertme böceği gömer', tut5: 'Kemirgen toprağı kendi kazar. Seni yakalamasın',
      tutK1: 'Aşağı ok: öndeki karınca tünel kazar. Kırıntıyı al, üstteki odaya taşı', tutK2: 'Her karınca bir kırıntı taşır. Teslim edilen her iki kırıntıda yeni bir karınca çıkar',
      tutK3: 'Böcek! Orta kısımdan ısırık kolonun kuyruğunu koparır, baştan ısırık can götürür', tutK4: 'Böcek önde mi? Geri ok: kolon döner. Sonra Boşluk çökertmesi böceği gömer', tutK5: 'Kemirgen toprağı kendi kazar. Seni yakalamasın',
      hint: 'Oklar: koloniyi yönlendir · Boşluk: çökertme · P: duraklat', hintTouch: 'Çubuk: koloniyi yönlendir · ▼ çökertme · II: duraklat',
      foot: '<b>GALLERYTRAIL</b> · oklar/WASD: koloniyi yönlendir, Boşluk: kuyruğun arkasını çökert · P/Esc: duraklat · L dil, T tema, M ses'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Nivel', best: 'Récord',
      win: '¡LA COLONIA PROSPERA!', gameover: 'CAYÓ LA COLONIA', pause: 'PAUSA', resume: 'Continuar', menu: 'Menú', tapstart: 'espacio / toca',
      title: 'GALLERYTRAIL', subtitle: 'Una colonia de hormigas sigue los túneles que cavas', back: 'Catálogo', lives: 'Vidas',
      lb: 'Clasificación', lbAll: 'Puntos', rwBonus: 'Anuncio: +2 hormigas para la colonia', oldBest: 'Récord anterior', migrated: 'Juego actualizado: ahora es GALLERYTRAIL, el nuevo récord empieza de cero',
      clear: 'NIVEL LISTO', crumbs: 'Migas', collapse: 'Derrumbe', life: '+1 VIDA', bite: 'MORDIDA', hatch: '+1 HORMIGA', entomb: 'ESCARABAJO SELLADO', go: '¡CAVA HACIA ABAJO!', bonus: 'Bono', nextUp: 'espacio / toca — seguir', load: 'Carga', ants: 'Hormigas',
      tut1: 'Mantén el stick hacia abajo: la hormiga guía cava un túnel. Toma una miga y llévala a la cámara de arriba', tut2: 'Cada hormiga lleva una miga. Cada dos migas entregadas nace una hormiga nueva',
      tut3: '¡Un escarabajo! Una mordida en medio corta la cola de la columna; en la cabeza cuesta una vida', tut4: '¿Escarabajo delante? Tira hacia atrás: la columna da la vuelta. Luego ▼ Derrumbe lo sella', tut5: 'El roedor cava la tierra solo. No dejes que te alcance',
      tutK1: 'Flecha abajo: la hormiga guía cava un túnel. Toma una miga y llévala a la cámara de arriba', tutK2: 'Cada hormiga lleva una miga. Cada dos migas entregadas nace una hormiga nueva',
      tutK3: '¡Un escarabajo! Una mordida en medio corta la cola de la columna; en la cabeza cuesta una vida', tutK4: '¿Escarabajo delante? Flecha atrás: la columna da la vuelta. Luego Espacio (derrumbe) lo sella', tutK5: 'El roedor cava la tierra solo. No dejes que te alcance',
      hint: 'Flechas: guiar la colonia · Espacio: derrumbe · P: pausa', hintTouch: 'Stick: guiar la colonia · ▼ derrumbe · II: pausa',
      foot: '<b>GALLERYTRAIL</b> · flechas/WASD: guiar la colonia, Espacio: derrumbe tras la cola · P/Esc: pausa · L idioma, T tema, M sonido'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Nível', best: 'Recorde',
      win: 'A COLÔNIA PROSPERA!', gameover: 'A COLÔNIA CAIU', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
      title: 'GALLERYTRAIL', subtitle: 'Uma colônia de formigas segue os túneis que você cava', back: 'Catálogo', lives: 'Vidas',
      lb: 'Classificação', lbAll: 'Pontos', rwBonus: 'Anúncio: +2 formigas para a colônia', oldBest: 'Recorde anterior', migrated: 'Jogo atualizado: agora é GALLERYTRAIL, o novo recorde começa do zero',
      clear: 'NÍVEL PRONTO', crumbs: 'Migalhas', collapse: 'Desabamento', life: '+1 VIDA', bite: 'MORDIDA', hatch: '+1 FORMIGA', entomb: 'BESOURO SELADO', go: 'CAVE PARA BAIXO!', bonus: 'Bônus', nextUp: 'espaço / toque — seguir', load: 'Carga', ants: 'Formigas',
      tut1: 'Segure o stick para baixo: a formiga líder cava um túnel. Pegue uma migalha e leve à câmara no alto', tut2: 'Cada formiga leva uma migalha. A cada duas migalhas entregues nasce uma formiga nova',
      tut3: 'Um besouro! Uma mordida no meio corta a cauda da coluna; na cabeça custa uma vida', tut4: 'Besouro à frente? Puxe para trás: a coluna se vira. Depois ▼ Desabamento sela o besouro', tut5: 'O roedor cava a terra sozinho. Não deixe que ele alcance você',
      tutK1: 'Seta para baixo: a formiga líder cava um túnel. Pegue uma migalha e leve à câmara no alto', tutK2: 'Cada formiga leva uma migalha. A cada duas migalhas entregues nasce uma formiga nova',
      tutK3: 'Um besouro! Uma mordida no meio corta a cauda da coluna; na cabeça custa uma vida', tutK4: 'Besouro à frente? Seta para trás: a coluna se vira. Depois Espaço (desabamento) sela o besouro', tutK5: 'O roedor cava a terra sozinho. Não deixe que ele alcance você',
      hint: 'Setas: guiar a colônia · Espaço: desabamento · P: pausa', hintTouch: 'Stick: guiar a colônia · ▼ desabamento · II: pausa',
      foot: '<b>GALLERYTRAIL</b> · setas/WASD: guiar a colônia, Espaço: desabamento atrás da cauda · P/Esc: pausa · L idioma, T tema, M som'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
