(() => {
const IMAGENES = [
  { nombre: 'Corrientes y temperatura del mar', src: 'img/global-sea-surface-currents-and-temperature.jpg',
    descripcion: 'Mapa del mundo sobre fondo oscuro, con los continentes en gris. En los océanos se ven finas líneas arremolinadas que siguen las corrientes marinas, coloreadas por temperatura: rojo y naranja en el ecuador y las aguas tropicales, amarillo y verde en latitudes medias, y azul oscuro cerca de los polos.' },
  { nombre: 'Anomalías de temperatura global', src: 'img/global-temperature-anomalies.jpg',
    descripcion: 'Mapa del mundo en colores que muestra cuánto más cálida o fría está cada zona respecto a lo normal. El rojo oscuro cubre el Ártico, Asia y el norte de América; el amarillo y el naranja dominan el resto; y hay pequeñas zonas azules y blancas, más frías, cerca de la Antártida.' },
  { nombre: 'Humedad cerca de la superficie', src: 'img/near-surface-humidity.png',
    descripcion: 'Mapa del mundo con la humedad del aire cerca de la superficie. Los continentes y los polos se ven en color café, más secos, y una franja azul ancha rodea el ecuador sobre los océanos, donde el aire es más húmedo. Arriba a la izquierda hay un logotipo de la NASA y abajo la fecha.' },
  { nombre: 'Viento cerca de la superficie', src: 'img/near-surface-wind-speed.png',
    descripcion: 'Mapa del mundo con la velocidad del viento. Las zonas tranquilas, sobre todo en los trópicos, aparecen en morado oscuro; el azul marca vientos moderados; y el amarillo, naranja y rojo marcan vientos fuertes en remolinos de tormenta, sobre todo en el océano del sur y en el norte del Pacífico. Los continentes se ven en blanco y gris.' },
  { nombre: 'Precipitación y nubes', src: 'img/precipitation-and-clouds.png',
    descripcion: 'La Tierra vista como desde un satélite, con océanos azul oscuro, desiertos café y bosques verdes. Las nubes son blancas y la lluvia aparece como manchas verdes, azules y rojas, más abundantes en el ecuador y en espirales de tormenta del hemisferio sur.' },
  { nombre: 'Lluvia y nieve', src: 'img/rain-and-snow.jpeg',
    descripcion: 'Mapa del mundo con los continentes en gris y los océanos en negro. La lluvia aparece en manchas verdes, amarillas y rojas, las más intensas en el centro de Estados Unidos, el sureste de Asia y el océano Índico; la nieve se ve en azul claro cerca de los polos y en el norte de Canadá y Rusia.' },
];

const DIVISOR_DETALLE = 16;

const $ = (id) => document.getElementById(id);
const selImagen = $('sel-imagen'), selRecorrido = $('sel-recorrido');
const rngUmbral = $('rng-umbral'), outUmbral = $('out-umbral');
const btnPlay = $('btn-reproducir'), btnStop = $('btn-detener');
const img = $('img-principal'), cv = $('cv-resalte');
const txtDesc = $('descripcion'), txtEstado = $('estado'), txtNota = $('nota-actual');

let reproduciendo = false;
let cancelar = false;
let analisis = null;
let dimAncho = 0;
let dimAlto = 0;
let turnoCarga = 0;

function obtenerCola(umbral, recorrido) {
  try {
    if (analisis && typeof construirArbol === 'function' && typeof recorrer === 'function') {
      const tamanoMinimo = Math.max(8, Math.round(dimAncho / DIVISOR_DETALLE));
      const raiz = construirArbol(dimAncho, dimAlto, (x, y, w, h) => analisis.analizar(x, y, w, h), { umbral, tamanoMinimo });
      return recorrer(raiz, recorrido);
    }
  } catch (e) {
    console.warn('Módulos reales no disponibles, usando mock:', e.message);
  }
  return mockCola(dimAncho, dimAlto, umbral);
}

let reproductor = null;
let resolverActual = null;

function reproducirCola(cola, alNota) {
  if (typeof ReproductorSonificacion === 'function' && !(cola instanceof Array)) {
    reproductor = reproductor || new ReproductorSonificacion();
    return new Promise((resolver) => {
      resolverActual = resolver;
      reproductor.reproducirCola(
        cola,
        dimAncho,
        dimAlto,
        (nodo) => {
          if (!nodo) return;
          alNota({
            region: nodo,
            frecuencia: reproductor.calcularFrecuencia(nodo.color || { r: 128, g: 128, b: 128 }),
          });
        },
        resolver
      );
    });
  }
  return mockReproducir(cola, alNota);
}

function detenerAudio() {
  cancelar = true;
  if (reproductor) reproductor.detener();
  if (resolverActual) resolverActual();
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
    osc.type = 'sine';
    osc.frequency.value = nota.frecuencia;
    gan.gain.value = 0.25;
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
  const k = img.clientWidth / dimAncho;
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
  const turno = ++turnoCarga;
  dimAncho = 0;
  dimAlto = 0;
  limpiarResalte();
  img.onload = () => {
    ajustarCanvas();
    if (typeof Imagen !== 'function') {
      dimAncho = img.naturalWidth;
      dimAlto = img.naturalHeight;
    }
  };
  img.src = info.src;
  img.alt = info.nombre;
  txtDesc.textContent = info.descripcion;
  txtNota.textContent = '';
  if (typeof Imagen === 'function') {
    analisis = analisis || new Imagen('cv-analisis', 0, 8);
    analisis.cargar(info.src).then(() => {
      if (turno !== turnoCarga) return;
      dimAncho = analisis.ancho;
      dimAlto = analisis.alto;
    }).catch((e) => ponerEstado('No se pudo cargar la imagen: ' + e.message));
  }
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
  if (!dimAncho) { ponerEstado('La imagen todavía se está cargando. Inténtalo de nuevo en un momento.'); return; }
  cancelar = false;
  marcarReproduciendo(true);
  ponerEstado('Reproduciendo ' + IMAGENES[selImagen.value].nombre + '.');
  let contador = 0;
  try {
    const cola = obtenerCola(Number(rngUmbral.value), selRecorrido.value);
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
})();
