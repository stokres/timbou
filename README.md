# Tembo Studio (no oficial)

Recreación personal del Studio de Musical Beings para practicar con un Tembo virtual antes de que llegue la beta oficial. No está afiliada a Musical Beings ni contiene sus samples: todos los sonidos se sintetizan en el navegador.

## Cómo abrirlo

Es una web estática sin dependencias ni compilación. Los módulos de JavaScript necesitan servirse por HTTP:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`. También funciona con GitHub Pages sirviendo la raíz de `main`. Usa Chrome, Edge, Firefox o Safari recientes.

## Qué incluye

- **Tembo virtual:** rejilla 8×5 con Beats normales, volteados y apilados (30 Beats), 5 canales con mute, sample flip A/B, volumen, tono (±24), delay y reverb; filtro; tempo, swing y longitud de patrón; 4 loops de acompañamiento; sampler por micrófono; grabación de sesión.
- **Biblioteca:** 8 kits, 8 patrones de ejemplo, tus patrones guardados, exportar e importar en JSON.
- **Canales:** cargar un archivo de audio o grabar en cualquier canal, y resamplear el patrón a un loop.
- **Aprender:** 6 tutoriales interactivos, dos juegos y enlaces a los vídeos oficiales.

El estado se guarda en el navegador (localStorage; los samples propios, en IndexedDB).

## Qué es fiel y qué es interpretación

La mecánica y las funciones salen de fuentes públicas: ver [docs/RESEARCH.md](docs/RESEARCH.md). No existe manual del diseño nuevo, así que esto lo he decidido yo:

- La asignación de cada botón del panel: mutes a la izquierda, sample flip a la derecha, el tercer botón de transporte como selector de kit, el botón inferior derecho como selector de efecto.
- Que los diales de canal cambien de función por modos, y que la pantalla alterne BPM, swing y pasos.
- El contenido de los kits, los loops, los patrones, las lecciones y los juegos.

No incluye MIDI, Wi-Fi/Bluetooth, la transferencia al Tembo físico ni los plug-ins.

## Estructura

| Archivo | Contenido |
|---|---|
| `js/dsp.js` | Síntesis de los sonidos de percusión |
| `js/kits.js` | Kits, loops y patrones |
| `js/engine.js` | Motor Web Audio: secuenciador, efectos, sampler, grabación |
| `js/device.js` | Tembo virtual en SVG y sus controles |
| `js/main.js` | Panel del Studio |
| `js/learn.js` | Tutoriales, niveles y vídeos |
| `js/store.js` | Estado y persistencia |
