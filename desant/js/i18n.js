/* ЗАРЕВО (EN/TR/ES/PT — CINDERFRONT; папка desant) · i18n RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings.
   DESANT.STR — таблицы для Arcade.createGame({strings}). Все имена — оригинальные (боец «Ольха», сажевики, зоны и машины-боссы студии «Гефест»). */
(function (global) {
  'use strict';
  var DS = global.DESANT = global.DESANT || {};
  DS.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл', score: 'Счёт', level: 'Зона', best: 'Рекорд',
      win: 'СЕВЕР СВОБОДЕН!', gameover: 'ОТРЯД РАЗБИТ', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап — в меню',
      title: 'ЗАРЕВО', subtitle: 'Пусти огненный вал вперёд и иди за ним — на север', back: 'Каталог',
      hint1: 'WASD / стрелки · F, пробел — огонь (держи — стрейф)', hint2: 'G, E — огненный вал: нажал — идёт, нажал ещё раз — отбой',
      zone: 'ЗОНА', z_1: 'Северная тайга', z_2: 'Торфяные топи', z_3: 'Каменоломня', z_4: 'Сплавные пороги', z_5: 'Старая крепость мастеровых',
      zs_1: 'ельник, ручьи и первый частокол сажевиков', zs_2: 'гати через трясину, катера на протоках', zs_3: 'уступы, вагонетки и дзоты в карьере',
      zs_4: 'мосты над порогами, катера и лесосклады', zs_5: 'частоколы, ворота и Чадная машина во дворе',
      b_icebreaker: 'ЛЕДОКОЛ-ТЯГАЧ', b_dredger: 'ЗЕМЛЕЧЕРПАЛКА', b_crusher: 'КАМНЕДРОБИЛКА', b_dam: 'ПЛОТИНА СО ШЛЮЗАМИ', b_engine: 'ЧАДНАЯ МАШИНА',
      bs_icebreaker: 'выжги две пушки — откроется топка', bs_dredger: 'миномёт и пулемёты прикрывают ковш-ядро', bs_crusher: 'уходи от валунов, жги бункеры, затем жернов',
      bs_dam: 'бей шлюз, пока он открыт', bs_engine: 'четыре котла питают спираль, потом — ядро',
      checkpoint: 'ЧЕКПОИНТ', clear: 'ЗОНА ПРОЙДЕНА', bossDown: 'МАШИНА ПОВЕРЖЕНА', cont: 'ПРОДОЛЖИТЬ?', contHint: 'огонь — с чекпоинта, осталось продолжений: ', continued: 'ЕЩЁ РАЗ',
      p_shell: '+ заряд вала', p_med: '+ здоровье', p_spread: 'ВЕЕР', p_rapid: 'СКОРОСТРЕЛ', life: '+1 ЖИЗНЬ',
      w_rifle: 'карабин', w_spread: 'веер', w_rapid: 'скорострел', barWord: 'ВАЛ', noCharge: 'мало заряда', ready: 'ВПЕРЁД!',
      tipMove: 'стик — ход, ● — огонь', tipBar: 'частокол! ▲ — огненный вал, иди за ним', rwLife: 'Ролик: +1 жизнь', cardNext: 'пробел / тап — дальше',
      foot: '<b>ЗАРЕВО</b> · WASD или стрелки — ход, F или пробел — огонь (держи — стрейф), G или E — огненный вал (ещё раз — отбой) · вал жжёт частоколы, укрытия, пехоту, гнёзда и дзоты, гасит пули — но жжёт и тебя: держись позади · P/Esc пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off', score: 'Score', level: 'Zone', best: 'Best',
      win: 'THE NORTH IS FREE!', gameover: 'SQUAD DOWN', pause: 'PAUSED', resume: 'Resume', menu: 'Main menu', tapstart: 'space / tap — to menu',
      title: 'CINDERFRONT', subtitle: 'Send a wall of fire ahead and follow it north', back: 'Catalog',
      hint1: 'WASD / arrows · F, Space — fire (hold to strafe)', hint2: 'G, E — fire wall: press to launch, press again to cut',
      zone: 'ZONE', z_1: 'Northern Taiga', z_2: 'Peat Bogs', z_3: 'The Quarry', z_4: 'Log-Drive Rapids', z_5: "Old Craftsmen's Fortress",
      zs_1: 'spruce woods, creeks and the first Sooter stockade', zs_2: 'boardwalks over the mire, launches in the channels', zs_3: 'ledges, carts and pillboxes in the pit',
      zs_4: 'bridges over the rapids, launches and timber yards', zs_5: 'stockades, gates and the Smoke Engine in the yard',
      b_icebreaker: 'ICEBREAKER HAULER', b_dredger: 'BOG DREDGER', b_crusher: 'ROCK CRUSHER', b_dam: 'SLUICE DAM', b_engine: 'SMOKE ENGINE',
      bs_icebreaker: 'burn out both cannons to bare the firebox', bs_dredger: 'a mortar and two guns shield the bucket core', bs_crusher: 'dodge the boulders, burn the hoppers, then the millstone',
      bs_dam: 'hit each sluice while it is open', bs_engine: 'four boilers feed the spiral, then the core',
      checkpoint: 'CHECKPOINT', clear: 'ZONE CLEAR', bossDown: 'MACHINE DESTROYED', cont: 'CONTINUE?', contHint: 'fire — from checkpoint, continues left: ', continued: 'ONE MORE TIME',
      p_shell: '+ wall charge', p_med: '+ health', p_spread: 'FAN GUN', p_rapid: 'RAPID GUN', life: '+1 LIFE',
      w_rifle: 'carbine', w_spread: 'fan gun', w_rapid: 'rapid gun', barWord: 'WALL', noCharge: 'low charge', ready: 'MOVE OUT!',
      tipMove: 'stick — move, ● — fire', tipBar: 'stockade! ▲ — fire wall, follow it', rwLife: 'Ad: +1 life', cardNext: 'space / tap — next',
      foot: '<b>CINDERFRONT</b> · WASD or arrows — move, F or Space — fire (hold to strafe), G or E — fire wall (press again to cut) · the wall burns stockades, cover, infantry, nests and pillboxes and eats bullets — but it burns you too: stay behind it · P/Esc pause · L language, T theme, M sound.'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı', score: 'Skor', level: 'Bölge', best: 'Rekor',
      win: 'KUZEY ÖZGÜR!', gameover: 'BİRLİK DÜŞTÜ', pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Ana menü', tapstart: 'boşluk / dokun — menü',
      title: 'CINDERFRONT', subtitle: 'Önüne ateş duvarı sür, arkasından kuzeye yürü', back: 'Katalog',
      hint1: 'WASD / oklar · F, Boşluk — ateş (basılı tut: yan adım)', hint2: 'G, E — ateş duvarı: bas, yürüsün; tekrar bas, dursun',
      zone: 'BÖLGE', z_1: 'Kuzey Tayga', z_2: 'Turba Bataklıkları', z_3: 'Taş Ocağı', z_4: 'Kütük Akıntıları', z_5: 'Eski Ustalar Kalesi',
      zs_1: 'ladin ormanı, dereler ve ilk Isıcı çiti', zs_2: 'bataklıkta tahta yollar, kanallarda motorlar', zs_3: 'basamaklar, vagonetler ve ocakta sığınaklar',
      zs_4: 'akıntı üstünde köprüler, motorlar ve kereste depoları', zs_5: 'çitler, kapılar ve avluda Duman Makinesi',
      b_icebreaker: 'BUZKIRAN ÇEKİCİ', b_dredger: 'BATAKLIK DRAGASI', b_crusher: 'TAŞ KIRICI', b_dam: 'KAPAKLI BARAJ', b_engine: 'DUMAN MAKİNESİ',
      bs_icebreaker: 'iki topu yak, ocak açılsın', bs_dredger: 'havan ve iki silah kova çekirdeğini korur', bs_crusher: 'kayalardan kaç, hazneleri yak, sonra değirmen taşı',
      bs_dam: 'kapak açıkken vur', bs_engine: 'dört kazan sarmalı besler, sonra çekirdek',
      checkpoint: 'KONTROL NOKTASI', clear: 'BÖLGE GEÇİLDİ', bossDown: 'MAKİNE YIKILDI', cont: 'DEVAM?', contHint: 'ateş — kontrol noktasından, kalan hak: ', continued: 'BİR KEZ DAHA',
      p_shell: '+ duvar şarjı', p_med: '+ can', p_spread: 'YELPAZE', p_rapid: 'HIZLI ATEŞ', life: '+1 CAN',
      w_rifle: 'karabina', w_spread: 'yelpaze', w_rapid: 'hızlı ateş', barWord: 'DUVAR', noCharge: 'şarj az', ready: 'İLERİ!',
      tipMove: 'çubuk — yürü, ● — ateş', tipBar: 'çit! ▲ — ateş duvarı, arkasından git', rwLife: 'Reklam: +1 can', cardNext: 'boşluk / dokun — devam',
      foot: '<b>CINDERFRONT</b> · WASD veya oklar — yürü, F veya Boşluk — ateş (basılı tut: yan adım), G veya E — ateş duvarı (tekrar bas: dur) · duvar çitleri, siperleri, piyadeyi, yuvaları ve sığınakları yakar, kurşunları siler — ama seni de yakar: arkasında kal · P/Esc duraklat · L dil, T tema, M ses.'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no', score: 'Puntos', level: 'Zona', best: 'Récord',
      win: '¡EL NORTE ES LIBRE!', gameover: 'ESCUADRA CAÍDA', pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca — menú',
      title: 'CINDERFRONT', subtitle: 'Lanza un muro de fuego y sigue su estela hacia el norte', back: 'Catálogo',
      hint1: 'WASD / flechas · F, Espacio — fuego (mantén: desplazarte)', hint2: 'G, E — muro de fuego: pulsa y avanza, pulsa otra vez y se corta',
      zone: 'ZONA', z_1: 'Taiga del Norte', z_2: 'Turberas', z_3: 'La Cantera', z_4: 'Rápidos de Maderas', z_5: 'Vieja Fortaleza de los Maestros',
      zs_1: 'abetos, arroyos y la primera empalizada hollinera', zs_2: 'pasarelas sobre el fango, lanchas en los canales', zs_3: 'terrazas, vagonetas y fortines en la cantera',
      zs_4: 'puentes sobre los rápidos, lanchas y aserraderos', zs_5: 'empalizadas, puertas y la Máquina de Humo en el patio',
      b_icebreaker: 'TRACTOR ROMPEHIELOS', b_dredger: 'DRAGA DE TURBA', b_crusher: 'TRITURADORA', b_dam: 'PRESA DE COMPUERTAS', b_engine: 'MÁQUINA DE HUMO',
      bs_icebreaker: 'quema los dos cañones y se abre el horno', bs_dredger: 'un mortero y dos armas cubren el núcleo', bs_crusher: 'esquiva rocas, quema las tolvas, luego la muela',
      bs_dam: 'golpea la compuerta mientras está abierta', bs_engine: 'cuatro calderas alimentan la espiral; luego el núcleo',
      checkpoint: 'PUNTO DE CONTROL', clear: 'ZONA SUPERADA', bossDown: 'MÁQUINA DESTRUIDA', cont: '¿CONTINUAR?', contHint: 'fuego — desde el control, continuaciones: ', continued: 'OTRA VEZ',
      p_shell: '+ carga del muro', p_med: '+ salud', p_spread: 'ABANICO', p_rapid: 'RÁFAGA', life: '+1 VIDA',
      w_rifle: 'carabina', w_spread: 'abanico', w_rapid: 'ráfaga', barWord: 'MURO', noCharge: 'poca carga', ready: '¡ADELANTE!',
      tipMove: 'palanca — mover, ● — fuego', tipBar: '¡empalizada! ▲ — muro de fuego, síguelo', rwLife: 'Anuncio: +1 vida', cardNext: 'espacio / toca — seguir',
      foot: '<b>CINDERFRONT</b> · WASD o flechas — mover, F o Espacio — fuego (mantén: desplazarte), G o E — muro de fuego (otra vez: cortar) · el muro quema empalizadas, cobertura, infantería, nidos y fortines y borra balas — pero también te quema: quédate detrás · P/Esc pausa · L idioma, T tema, M sonido.'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'sim', off: 'não', score: 'Pontos', level: 'Zona', best: 'Recorde',
      win: 'O NORTE ESTÁ LIVRE!', gameover: 'ESQUADRA CAIU', pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque — menu',
      title: 'CINDERFRONT', subtitle: 'Lance um muro de fogo à frente e siga-o rumo ao norte', back: 'Catálogo',
      hint1: 'WASD / setas · F, Espaço — fogo (segure: deslocar-se)', hint2: 'G, E — muro de fogo: aperte e ele avança, aperte de novo e corta',
      zone: 'ZONA', z_1: 'Taiga do Norte', z_2: 'Turfeiras', z_3: 'A Pedreira', z_4: 'Corredeiras de Toras', z_5: 'Velha Fortaleza dos Mestres',
      zs_1: 'abetos, riachos e a primeira paliçada fuliginosa', zs_2: 'passarelas sobre o pântano, lanchas nos canais', zs_3: 'degraus, vagonetes e fortins na pedreira',
      zs_4: 'pontes sobre as corredeiras, lanchas e serrarias', zs_5: 'paliçadas, portões e a Máquina de Fumaça no pátio',
      b_icebreaker: 'TRATOR QUEBRA-GELO', b_dredger: 'DRAGA DE TURFA', b_crusher: 'BRITADEIRA', b_dam: 'REPRESA DE COMPORTAS', b_engine: 'MÁQUINA DE FUMAÇA',
      bs_icebreaker: 'queime os dois canhões e a fornalha abre', bs_dredger: 'um morteiro e duas armas protegem o núcleo', bs_crusher: 'desvie das pedras, queime os funis, depois a mó',
      bs_dam: 'acerte a comporta enquanto está aberta', bs_engine: 'quatro caldeiras alimentam a espiral; depois o núcleo',
      checkpoint: 'CHECKPOINT', clear: 'ZONA CONCLUÍDA', bossDown: 'MÁQUINA DESTRUÍDA', cont: 'CONTINUAR?', contHint: 'fogo — do checkpoint, continuações: ', continued: 'DE NOVO',
      p_shell: '+ carga do muro', p_med: '+ saúde', p_spread: 'LEQUE', p_rapid: 'RAJADA', life: '+1 VIDA',
      w_rifle: 'carabina', w_spread: 'leque', w_rapid: 'rajada', barWord: 'MURO', noCharge: 'pouca carga', ready: 'AVANTE!',
      tipMove: 'direcional — mover, ● — fogo', tipBar: 'paliçada! ▲ — muro de fogo, siga-o', rwLife: 'Anúncio: +1 vida', cardNext: 'espaço / toque — seguir',
      foot: '<b>CINDERFRONT</b> · WASD ou setas — mover, F ou Espaço — fogo (segure: deslocar-se), G ou E — muro de fogo (de novo: cortar) · o muro queima paliçadas, abrigos, infantaria, ninhos e fortins e apaga balas — mas também queima você: fique atrás · P/Esc pausa · L idioma, T tema, M som.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
