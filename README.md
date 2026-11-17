# timbou

Secuenciador magnético virtual para el navegador: una recreación personal y no oficial para practicar antes de tener el instrumento real. No está afiliada al fabricante ni contiene sus samples: todos los sonidos se sintetizan en el navegador.

## Cómo abrirlo

Es una web estática sin dependencias ni compilación. Los módulos de JavaScript necesitan servirse por HTTP:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`. También funciona con GitHub Pages sirviendo la raíz de `main`.

## Qué incluye

- **Instrumento virtual** con la disposición del modelo A-001: rejilla 8×5 con Beats normales, volteados y apilados (30 Beats); channel on/off; sample assign/flip; un dial de FX por canal, selector de FX y cantidad global; play/stop, grabación de sesión y dial de BPM/swing; selector de kit; 4 loops; sampler por micrófono; volumen; shift.
- **Biblioteca:** 8 kits, 8 patrones de ejemplo, tus patrones guardados, exportar e importar en JSON.
- **Canales:** cargar un archivo de audio o grabar en cualquier canal, y resamplear el patrón a un loop.
- **Aprender:** 7 tutoriales interactivos, dos juegos y enlaces a vídeos.

El estado se guarda en el navegador (localStorage; los samples propios, en IndexedDB).

## Atajos

- Arrastrar un dial hacia arriba o a la derecha sube el valor; doble clic lo restablece.
- Volumen de canal: mantener el botón del canal (o la tecla 1–5) y girar Volumen, o arrastrar sobre el propio botón.
- Shift: la pestaña del lateral izquierdo o la tecla Mayús. Shift + BPM = swing; Shift + selector de kit = pasos del patrón.
- Espacio: play/stop. Clic derecho en una casilla: quitar el Beat.

## Qué es fiel y qué es interpretación

La posición y el nombre de cada control siguen el diagrama oficial; la mecánica sale de fuentes públicas: ver [docs/RESEARCH.md](docs/RESEARCH.md). Esto lo he decidido yo, porque no está documentado:

- Los cinco efectos del selector (delay, reverb, tono, gate, filtro), que actúe uno a la vez y lo que hace la cantidad global en cada uno.
- Que Shift + BPM sea el swing y Shift + selector de kit, la longitud del patrón.
- El contenido de los kits, los loops, los patrones, las lecciones y los juegos.

No incluye MIDI, Wi-Fi/Bluetooth, la transferencia al instrumento físico ni los plug-ins.

## Estructura

| Archivo | Contenido |
|---|---|
| `js/dsp.js` | Síntesis de los sonidos de percusión |
| `js/kits.js` | Kits, loops y patrones |
| `js/engine.js` | Motor Web Audio: secuenciador, efectos, sampler, grabación |
| `js/device.js` | Instrumento virtual en SVG y sus controles |
| `js/main.js` | Panel lateral |
| `js/learn.js` | Tutoriales, niveles y vídeos |
| `js/store.js` | Estado y persistencia |
