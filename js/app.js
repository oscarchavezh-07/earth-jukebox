const IMAGENES = [
  { nombre: 'Luces nocturnas, 2012 y 2023', src: 'img/temp.png',
    descripcion: 'Vista nocturna de la Tierra: el fondo es oscuro y las ciudades aparecen como puntos de luz amarilla, más densos en zonas urbanas.' },
  { nombre: 'Corrientes y temperatura del océano', src: 'img/temp.png',
    descripcion: 'Mapa del océano con remolinos y corrientes en gradientes de azul a naranja según la temperatura del agua.' },
  { nombre: 'Aerosoles (GEOS)', src: 'img/temp.png',
    descripcion: 'Globo con nubes de partículas: polvo, humo y sal marina en tonos distintos sobre un océano oscuro.' },
  { nombre: 'Dióxido de carbono (DYAMOND)', src: 'img/temp.png',
    descripcion: 'Mapa global del CO2 con regiones de mayor concentración en colores cálidos y menor en colores fríos.' },
  { nombre: 'Altura de bosques (GEDI)', src: 'img/temp.png',
    descripcion: 'Mapa de la altura de la vegetación: verdes intensos donde los árboles son altos y tonos claros donde son bajos.' },
  { nombre: 'Rayos desde la estación espacial', src: 'img/temp.png',
    descripcion: 'Mapa oscuro de la Tierra con destellos de color donde se detectaron rayos, más frecuentes cerca del ecuador.' },
];

const ANCHO_ANALISIS = 512;
const TAM_MINIMO = 8;

const $ = (id) => document.getElementById(id);
const selImagen = $('sel-imagen'), selRecorrido = $('sel-recorrido');
const rngUmbral = $('rng-umbral'), outUmbral = $('out-umbral');
const btnPlay = $('btn-reproducir'), btnStop = $('btn-detener');
const img = $('img-principal'), cv = $('cv-resalte');
const txtDesc = $('descripcion'), txtEstado = $('estado'), txtNota = $('nota-actual');

let reproduciendo = false;
let cancelar = false;
let ctxAnalisis = null;
let altoAnalisis = 0;

function obtenerCola(ctx, ancho, alto, umbral, recorrido) {
  try {
    if (typeof construirArbol === 'function' && typeof Cola === 'function') {
      const raiz = construirArbol(ctx, 0, 0, ancho, alto, umbral, TAM_MINIMO);
      const cola = new Cola();
      const recorrer = { preorden: window.preorden, inorden: window.inorden,
                         posorden: window.posorden, niveles: window.porNiveles }[recorrido];
      if (typeof recorrer !== 'function') throw new Error('Falta la función de recorrido: ' + recorrido);
      recorrer(raiz, cola);
      return cola;
    }
  } catch (e) {
    console.warn('Módulos reales no disponibles, usando mock:', e.message);
  }
  return mockCola(ancho, alto, umbral);
}

async function reproducirCola(cola, alNota) {
  if (typeof window.reproducir === 'function' && !(cola instanceof Array)) {
    await window.reproducir(cola, alNota);
    return;
  }
  await mockReproducir(cola, alNota);
}

function detenerAudio() {
  cancelar = true;
  if (typeof window.detenerReproduccion === 'function') window.detenerReproduccion();
}

function mockCola(ancho, alto, umbral) {
  const niveles = Math.max(1, Math.round(6 - umbral / 12));
  const columnas = 2 ** niveles, filas = Math.max(1, Math.round(columnas * alto / ancho));
  const w = ancho / columnas, h = alto / filas, notas = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < columnas; c++) {
    notas.push({ frecuencia: 220 * 2 ** (((c * 3 + f * 5) % 12) / 12),
                 duracion: 0.25, region: { x: c * w, y: f * h, ancho: w, alto: h } });
  }
  return notas;
}

async function mockReproducir(notas, alNota) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  for (const nota of notas) {
    if (cancelar) break;
    const osc = ac.createOscillator(), gan = ac.createGain();
    osc.frequency.value = nota.frecuencia;
    gan.gain.value = 0.15;
    osc.connect(gan).connect(ac.destination);
    osc.start();
    alNota(nota);
    await new Promise((r) => setTimeout(r, nota.duracion * 1000));
    osc.stop();
  }
  ac.close();
}

function ajustarCanvas() {
  cv.width = img.clientWidth;
  cv.height = img.clientHeight;
}

function limpiarResalte() {
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}

function resaltarRegion(r) {
  ajustarCanvas();
  const k = img.clientWidth / ANCHO_ANALISIS;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(242, 169, 0, 0.35)';
  g.fillRect(r.x * k, r.y * k, r.ancho * k, r.alto * k);
  g.lineWidth = 3;
  g.strokeStyle = '#f2a900';
  g.strokeRect(r.x * k, r.y * k, r.ancho * k, r.alto * k);
}

function cargarImagen(indice) {
  const info = IMAGENES[indice];
  ctxAnalisis = null;
  img.onload = () => {
    const c = document.createElement('canvas');
    altoAnalisis = Math.round(ANCHO_ANALISIS * img.naturalHeight / img.naturalWidth);
    c.width = ANCHO_ANALISIS; c.height = altoAnalisis;
    ctxAnalisis = c.getContext('2d', { willReadFrequently: true });
    ctxAnalisis.drawImage(img, 0, 0, ANCHO_ANALISIS, altoAnalisis);
    ajustarCanvas();
    limpiarResalte();
  };
  img.src = info.src;
  img.alt = info.descripcion;
  txtDesc.textContent = info.descripcion;
  txtNota.textContent = '';
}

function ponerEstado(texto) { txtEstado.textContent = texto; }

function marcarReproduciendo(valor) {
  reproduciendo = valor;
  btnPlay.disabled = valor;
  btnStop.disabled = !valor;
  [selImagen, selRecorrido, rngUmbral].forEach((e) => (e.disabled = valor));
}

async function reproducir() {
  if (reproduciendo) return;
  if (!ctxAnalisis) { ponerEstado('La imagen todavía se está cargando. Inténtalo de nuevo en un momento.'); return; }
  cancelar = false;
  marcarReproduciendo(true);
  ponerEstado('Reproduciendo ' + IMAGENES[selImagen.value].nombre + '.');
  let contador = 0;
  try {
    const cola = obtenerCola(ctxAnalisis, ANCHO_ANALISIS, altoAnalisis, Number(rngUmbral.value), selRecorrido.value);
    await reproducirCola(cola, (nota) => {
      contador++;
      resaltarRegion(nota.region);
      txtNota.textContent = 'Nota ' + contador + ': ' + Math.round(nota.frecuencia) + ' Hz';
    });
    ponerEstado(cancelar ? 'Reproducción detenida.' : 'Terminó la reproducción. Se tocaron ' + contador + ' notas.');
  } catch (e) {
    console.error(e);
    ponerEstado('No se pudo reproducir. Revisa la consola para más detalles.');
  } finally {
    limpiarResalte();
    marcarReproduciendo(false);
    btnPlay.focus();
  }
}

function detener() {
  if (!reproduciendo) return;
  detenerAudio();
}

IMAGENES.forEach((im, i) => selImagen.add(new Option(im.nombre, i)));

selImagen.addEventListener('change', () => cargarImagen(Number(selImagen.value)));
rngUmbral.addEventListener('input', () => (outUmbral.textContent = rngUmbral.value));
btnPlay.addEventListener('click', reproducir);
btnStop.addEventListener('click', detener);
window.addEventListener('resize', () => { if (!reproduciendo) ajustarCanvas(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') detener();
  const enControl = ['SELECT', 'INPUT', 'BUTTON'].includes(document.activeElement.tagName);
  if (e.code === 'Space' && !enControl) {
    e.preventDefault();
    reproduciendo ? detener() : reproducir();
  }
});

cargarImagen(0);
