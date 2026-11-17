import { S } from './dsp.js';

// Filas de arriba abajo. Cada canal tiene dos samples conmutables (A/B), como en el instrumento real.
export const ROWS = 5, COLS = 8, MAX_BEATS = 30;
const n = (name, spec) => ({ name, spec });

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10],
};

// Loops: 4 compases (64 semicorcheas). prog = grado del acorde por compás.
// pat = 16 caracteres por compás: '.' silencio, '-' mantener, dígito = grado sobre el acorde, 'x' = acorde.
const loops = (root, scale, prog, bass, chord, lead, arp) => ({
  root, scale, prog,
  parts: [
    { name: 'Bajo', oct: 0, ...bass }, { name: 'Acordes', oct: 24, ...chord },
    { name: 'Melodía', oct: 36, ...lead }, { name: 'Arpegio', oct: 24, ...arp },
  ],
});
const p = (tim, pat) => ({ tim, pat });

export const KITS = [
  {
    id: '808', name: '808', bpm: 92, swing: 20,
    sounds: [
      [n('Hat cerrado', S.hat(0.035, 8000)), n('Hat abierto', S.hat(0.25, 7500))],
      [n('Cencerro', S.cow(545)), n('Clave', S.rim(2400, 0.03))],
      [n('Palmas', S.clap(1200, 0.14)), n('Rimshot', S.rim(1650))],
      [n('Caja', S.snare(180, 0.15, 1600)), n('Caja aguda', S.snare(240, 0.11, 2600, 0.8))],
      [n('Bombo largo', S.kick(46, 150, 0.55, 0.04, 1.6)), n('Bombo corto', S.kick(55, 180, 0.2, 0.03, 2.2))],
    ],
    loops: loops(41, 'minor', [0, 0, 5, 4],
      p('sub', '0--...0-....0.4.'), p('pad', 'x---------------'),
      p('bell', '4...2...0..2....'), p('pluck', '0.2.4.7.4.2.0.2.')),
  },
  {
    id: 'acoustic', name: 'Acústica', bpm: 104, swing: 0,
    sounds: [
      [n('Hi-hat', S.hat(0.045, 6500, 380)), n('Ride', S.hat(0.5, 5000, 520))],
      [n('Tom agudo', S.tom(170, 0.22)), n('Tom grave', S.tom(95, 0.32))],
      [n('Aro', S.rim(1300, 0.03)), n('Crash', S.hat(0.9, 4500, 350))],
      [n('Caja', S.snare(200, 0.2, 1200, 0.5)), n('Caja rimshot', S.snare(260, 0.16, 1500, 0.9))],
      [n('Bombo', S.kick(58, 130, 0.22, 0.02, 1.4, 0.5)), n('Bombo seco', S.kick(66, 140, 0.13, 0.015, 1.6, 0.6))],
    ],
    loops: loops(40, 'dorian', [0, 3, 0, 4],
      p('sq', '0...0.4.0...4.6.'), p('organ', 'x-..x-....x-x...'),
      p('ep', '4.2.0...2.4.6-..'), p('pluck', '0.4.7.4.0.4.7.4.')),
  },
  {
    id: 'lm', name: 'LM Drum', bpm: 112, swing: 0,
    sounds: [
      [n('Hat', S.hat(0.05, 7000, 450)), n('Hat abierto', S.hat(0.3, 6500, 450))],
      [n('Conga', S.conga(240)), n('Cabasa', S.shaker(0.06, 6000))],
      [n('Palmas', S.clap(1500, 0.11)), n('Pandereta', S.tamb(0.1))],
      [n('Caja gate', S.snare(170, 0.22, 900, 0.7)), n('Caja fina', S.snare(220, 0.12, 2000))],
      [n('Bombo punch', S.kick(60, 220, 0.18, 0.02, 2.5, 0.4)), n('Bombo grave', S.kick(50, 180, 0.3, 0.03, 2))],
    ],
    loops: loops(38, 'mixo', [0, 0, 3, 4],
      p('saw', '0.0.7.0.0.0.6.7.'), p('stab', 'x..x..x...x.x...'),
      p('bell', '7...4.2.4.......'), p('pluck', '0247024702470247')),
  },
  {
    id: 'ukclub', name: 'UK Club', bpm: 132, swing: 45,
    sounds: [
      [n('Hat', S.hat(0.03, 9000, 500)), n('Shaker', S.shaker(0.05))],
      [n('Rim', S.rim(1900)), n('Blip', S.bell(1320, 0.07, 2, 1))],
      [n('Palmas', S.clap(1700, 0.1)), n('Snap', S.snap())],
      [n('Caja', S.snare(210, 0.1, 2400, 0.7)), n('Caja ruido', S.snare(160, 0.2, 3000, 0.2))],
      [n('Bombo sub', S.kick(44, 190, 0.35, 0.025, 2.4)), n('Bombo seco', S.kick(56, 200, 0.15, 0.02, 3))],
    ],
    loops: loops(43, 'minor', [0, 5, 3, 4],
      p('sub', '0-...0.0..7..0..'), p('stab', '..x...x..x....x.'),
      p('bell', '....4...2...0-..'), p('pluck', '.0.2.4.2.0.2.4.7')),
  },
  {
    id: 'tablas', name: 'Tablas', bpm: 96, swing: 10,
    sounds: [
      [n('Na', S.tabla(620, 0.12, 1, 2.5)), n('Tin', S.tabla(520, 0.35, 1, 1))],
      [n('Te', S.tabla(900, 0.04, 1, 3)), n('Tun', S.tabla(330, 0.45, 1, 0.6))],
      [n('Ke', S.conga(150, 0.05)), n('Tak', S.rim(1100, 0.02))],
      [n('Ge', S.tabla(110, 0.4, 0.7, 1)), n('Ge alto', S.tabla(150, 0.3, 0.6, 1))],
      [n('Dha', S.tabla(90, 0.5, 1.4, 1.2)), n('Dhin', S.tabla(100, 0.7, 1.15, 0.8))],
    ],
    loops: loops(38, 'phrygian', [0, 0, 1, 0],
      p('sub', '0-------0---4---'), p('organ', 'x---------------'),
      p('ep', '0.1.3.4...3.1...'), p('pluck', '0..4..7.0..4..1.')),
  },
  {
    id: 'dub', name: 'Dub', bpm: 76, swing: 30,
    sounds: [
      [n('Hat', S.hat(0.04, 6000, 400)), n('Hat abierto', S.hat(0.35, 5500, 400))],
      [n('Timbal', S.tom(260, 0.14)), n('Bloque', S.rim(900, 0.04))],
      [n('Rimshot', S.rim(1500, 0.035)), n('Palmas', S.clap(1000, 0.18))],
      [n('Caja profunda', S.snare(150, 0.2, 800, 0.9)), n('Caja', S.snare(200, 0.14, 1500))],
      [n('Bombo sub', S.kick(42, 120, 0.5, 0.05, 1.4, 0.15)), n('Bombo', S.kick(52, 150, 0.25, 0.03, 1.8))],
    ],
    loops: loops(45, 'minor', [0, 0, 3, 3],
      p('sub', '0-..0.2.4-..2.0.'), p('organ', '..x...x...x...x.'),
      p('ep', '........4.2.0-..'), p('pluck', '0...4...7...4...')),
  },
  {
    id: 'disco', name: 'Disco', bpm: 118, swing: 0,
    sounds: [
      [n('Hat', S.hat(0.04, 8000, 440)), n('Hat abierto', S.hat(0.22, 7000, 440))],
      [n('Cencerro', S.cow(700, 0.12)), n('Pandereta', S.tamb(0.08))],
      [n('Palmas', S.clap(1400, 0.16)), n('Tom syn', S.tom(200, 0.3))],
      [n('Caja', S.snare(195, 0.17, 1400, 0.6)), n('Caja brillante', S.snare(230, 0.13, 2200, 0.5))],
      [n('Bombo', S.kick(56, 160, 0.2, 0.025, 1.8, 0.4)), n('Bombo redondo', S.kick(50, 140, 0.3, 0.03, 1.5))],
    ],
    loops: loops(36, 'dorian', [0, 3, 0, 4],
      p('saw', '0.7.0.7.0.7.6.7.'), p('stab', '.x...x.x.x...x..'),
      p('ep', '4...6.4.2...0...'), p('pluck', '0.2.4.7.0.2.4.7.')),
  },
  {
    id: 'soul', name: 'Electro Soul', bpm: 84, swing: 55,
    sounds: [
      [n('Hat lo-fi', S.hat(0.03, 5500, 360)), n('Shaker', S.shaker(0.07, 4000))],
      [n('Campana', S.bell(784, 0.4)), n('Acorde', S.stab(196))],
      [n('Snap', S.snap(0.06)), n('Palmas', S.clap(1100, 0.15))],
      [n('Caja lo-fi', S.snare(170, 0.14, 1000, 0.8)), n('Aro', S.rim(1400, 0.03))],
      [n('Bombo cálido', S.kick(50, 130, 0.3, 0.035, 1.3, 0.2)), n('Bombo duro', S.kick(58, 190, 0.2, 0.02, 2.6))],
    ],
    loops: loops(39, 'dorian', [0, 4, 5, 3],
      p('sub', '0-...0..4.0-....'), p('ep', 'x--...x-....x-..'),
      p('bell', '..4...2...0.....'), p('pluck', '0..2..4.7..4..2.')),
  },
];

// Patrones de ejemplo. Por celda: '.' vacío, 'x' Beat (1.ª semicorchea), 'f' volteado (2.ª), 's' apilado (ambas).
const cell = { '.': 0, x: 1, f: 2, s: 3 };
export const parseGrid = rows => rows.map(r => [...r.padEnd(COLS, '.')].map(c => cell[c] ?? 0));
export const emptyGrid = () => parseGrid(Array(ROWS).fill(''));

export const PATTERNS = [
  { name: 'Boom bap', kit: 0, bpm: 90, swing: 50, rows: ['xxxxxxxx', '.......f', '........', '..x...x.', 'x..f.x..'] },
  { name: 'Rock básico', kit: 1, bpm: 104, swing: 0, rows: ['xxxxxxxx', '.......s', '........', '..x...x.', 'x...xx..'] },
  { name: 'Electro', kit: 2, bpm: 112, swing: 0, rows: ['ssssssss', '.f...f..', '......x.', '..x...x.', 'x..x..x.'] },
  { name: '2-step', kit: 3, bpm: 132, swing: 45, rows: ['.x.x.x.x', 'f..f..f.', '..x...x.', '......xf', 'x....x..'] },
  { name: 'Keherwa', kit: 4, bpm: 96, swing: 10, rows: ['.x.s.x.s', '..f...f.', '...x...x', '.x...x..', 'x...x.x.'] },
  { name: 'One drop', kit: 5, bpm: 76, swing: 30, rows: ['xxxsxxxs', '.x.x.x.x', '....x...', '....x...', '....x...'] },
  { name: 'Four on the floor', kit: 6, bpm: 118, swing: 0, rows: ['.x.x.x.x', 'x..x..x.', '..x...x.', '..x...x.', 'x.x.x.x.'] },
  { name: 'Neo soul', kit: 7, bpm: 84, swing: 55, rows: ['xxxxxsxx', 'x.......', '..x...x.', '......f.', 'x..x.f..'] },
];

// Librería principal anunciada en musicalbeings.com (no incluida aquí; solo referencia).
export const ANNOUNCED_PACKS = ['TR-808', 'Acoustic Drums', 'Linn Drum', 'UK Clubs', 'Heavy Metal', 'Tablas', 'Dub', 'Indian Rhythms', 'Sounds of Cambodia', 'Roda de Samba', 'Balkan Beats', 'Caribbean Flow', 'Disco', 'Electro Soul', 'Bongo Herman (artista)', 'Kumina (artista)'];

export function degToMidi(kit, deg, oct) {
  const sc = SCALES[kit.loops.scale], k = sc.length;
  return kit.loops.root + oct + 12 * Math.floor(deg / k) + sc[((deg % k) + k) % k];
}
