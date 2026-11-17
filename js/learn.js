import { parseGrid } from './kits.js';

const any = (g, r, vals) => g[r].some(v => vals.includes(v));

// Tutoriales interactivos: cada paso se completa solo cuando el estado cumple check().
export const LESSONS = [
  {
    id: 'first', title: 'Tu primer ritmo', steps: [
      { text: 'Coloca un Beat en la fila de abajo (el bombo), en la primera columna.', check: c => [1, 3].includes(c.s.grid[4][0]) },
      { text: 'Pulsa Play: el botón de la izquierda de la caja de transporte (o la barra espaciadora).', check: c => c.e.playing },
      { text: 'Añade bombo también en las columnas 3, 5 y 7. Eso es un «four on the floor».', check: c => [0, 2, 4, 6].every(k => [1, 3].includes(c.s.grid[4][k])) },
      { text: 'Pon una caja (cuarta fila) en las columnas 3 y 7.', check: c => [2, 6].every(k => c.s.grid[3][k] > 0) },
    ],
  },
  {
    id: 'stack', title: 'Apilar y voltear', steps: [
      { text: 'Cada columna son dos semicorcheas. Un Beat normal suena en la primera. Elige «Apilado» en la bandeja y pon uno en la fila de arriba: sonarán las dos.', check: c => any(c.s.grid, 0, [3]) },
      { text: 'Ahora elige «Volteado» y coloca uno en cualquier fila: suena solo en la segunda semicorchea (a contratiempo).', check: c => c.s.grid.some((_, r) => any(c.s.grid, r, [2])) },
      { text: 'Llena la fila de arriba con al menos 4 apilados para un hi-hat en semicorcheas.', check: c => c.s.grid[0].filter(v => v === 3).length >= 4 },
    ],
  },
  {
    id: 'groove', title: 'Tempo, swing y longitud', steps: [
      { text: 'Arrastra el dial grande hacia arriba o a la derecha para subir el tempo. Llévalo por encima de 130 BPM.', check: c => c.s.bpm > 130 },
      { text: 'Haz clic en la pantalla hasta que marque SWING y sube el swing a 50 o más.', check: c => c.s.swing >= 50 },
      { text: 'Clic otra vez en la pantalla (PASOS) y reduce el patrón a 6 columnas o menos: compases de 3/4, 6/8…', check: c => c.s.length <= 6 },
      { text: 'Devuelve el patrón a 8 columnas.', check: c => c.s.length === 8 },
    ],
  },
  {
    id: 'channels', title: 'Canales y efectos', steps: [
      { text: 'Silencia un canal con los botones de la izquierda de la rejilla.', check: c => c.s.ch.some(x => x.mute) },
      { text: 'Cada canal tiene dos samples. Cambia alguno al sample B con los botones de la derecha de la rejilla.', check: c => c.s.ch.some(x => x.side === 1) },
      { text: 'Pulsa el botón de efectos (abajo a la derecha) hasta ver TONO y gira el dial de un canal para afinarlo.', check: c => c.s.ch.some(x => x.pitch !== 0) },
      { text: 'Pasa a DELAY y manda un canal al delay por encima del 30 %.', check: c => c.s.ch.some(x => x.delay > 0.3) },
      { text: 'Gira el dial de filtro (encima del botón de efectos) hacia cualquier lado.', check: c => c.s.filter !== 0 },
    ],
  },
  {
    id: 'kits', title: 'Kits y loops', steps: [
      { text: 'Cambia de kit con el tercer botón de transporte (el que muestra un número).', check: c => c.s.kit !== c.snap.kit },
      { text: 'Activa un loop de acompañamiento con los cuatro botones bajo el dial grande.', check: c => c.s.loops.some(Boolean) },
      { text: 'Activa al menos tres loops a la vez y dale a Play.', check: c => c.s.loops.filter(Boolean).length >= 3 && c.e.playing },
    ],
  },
  {
    id: 'sampler', title: 'El sampler', steps: [
      { text: 'Pulsa el botón del sampler (la cápsula con el micro): los botones de canal parpadean.', check: c => c.e.micArmed || c.e.micRec || c.e.hasCustom() },
      { text: 'Pulsa el botón de un canal (columna derecha) y haz un sonido; vuelve a pulsar para parar. También puedes cargar un archivo desde la pestaña Canales.', check: c => c.e.hasCustom() },
    ],
  },
];

// Juego «Copia el ritmo»: escucha el objetivo y reconstrúyelo.
export const LEVELS = [
  { name: 'Pulso', bpm: 110, rows: ['', '', '', '', 'x.x.x.x.'] },
  { name: 'Bombo y caja', bpm: 100, rows: ['', '', '', '..x...x.', 'x...x...'] },
  { name: 'Corcheas', bpm: 100, rows: ['xxxxxxxx', '', '', '..x...x.', 'x...xx..'] },
  { name: 'Semicorcheas', bpm: 96, rows: ['s.s.s.s.', '', '', '..x...x.', 'x.x.x.x.'] },
  { name: 'Contratiempo', bpm: 96, rows: ['xxxxxxxx', '', '', '..x...x.', 'x..f.x..'] },
  { name: 'Todo junto', bpm: 104, rows: ['xsxsxsxs', '...f...f', '......x.', '..x...x.', 'x..f.x..'] },
].map(l => ({ ...l, grid: parseGrid(l.rows) }));

export const diffCount = (a, b) => a.flat().reduce((n, v, i) => n + (v !== b.flat()[i] ? 1 : 0), 0);

const V = 'https://s3.amazonaws.com/webflow-prod-assets/69b688cfeed3eb70897a8d30/';
export const VIDEOS = [
  ['Tembo Features Demo (oficial)', V + '69b8666a477d41700d67ce91_Tembo%20Features%20Demo.mp4'],
  ['Damian Kulash (OK Go)', V + '69b974a2d3818133a91e12d5_%40damiankulash.mp4'],
  ['Taetro', V + '69b973abe3c93e1713f234c1_%40taetro.mp4'],
  ['Cloudchord', V + '69b973a1fc3188b5762a4b21_%40cloudchord.mp4'],
  ['Zeale', V + '69b97540bfc400cdde0c106b_%40zeale.mp4'],
  ['Pack de artista: Bongo Herman', V + '6a44e31958ad22521bdd60c3_Bongo%20Herman.mp4'],
];
