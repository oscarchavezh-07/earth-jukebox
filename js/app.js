(() => {
'use strict';

/* ---------- Content ---------- */

const IMAGES = [
  {
    name: 'Ocean currents and temperature',
    src: 'img/global-sea-surface-currents-and-temperature.jpg',
    thumb: 'img/thumbs/global-sea-surface-currents-and-temperature.jpg',
    description: 'World map on a dark background with the continents in gray. Across the oceans, thin swirling lines trace the paths of sea-surface currents, colored by water temperature: red and orange along the equator and in tropical waters, yellow and green at middle latitudes, and dark blue near the poles.',
  },
  {
    name: 'Global temperature anomalies',
    src: 'img/global-temperature-anomalies.jpg',
    thumb: 'img/thumbs/global-temperature-anomalies.jpg',
    description: 'World map showing how much warmer or cooler each area is compared with a baseline average. Dark red covers the Arctic, most of Asia and northern North America. Yellow and orange cover most of the rest of the planet. A few small blue and white patches, the coolest areas, appear in the Southern Ocean near Antarctica.',
  },
  {
    name: 'Near-surface humidity',
    src: 'img/near-surface-humidity.png',
    thumb: 'img/thumbs/near-surface-humidity.jpg',
    description: 'World map of the humidity of the air near the surface. Land and polar regions, including the Sahara and Arabia, are tan or brown, the driest areas. A wide blue band follows the equator over the oceans, the Amazon and Southeast Asia, where the air is most humid. A NASA logo appears at the top left and a date label at the bottom left.',
  },
  {
    name: 'Near-surface wind speed',
    src: 'img/near-surface-wind-speed.png',
    thumb: 'img/thumbs/near-surface-wind-speed.jpg',
    description: 'World map of wind speed near the surface. Calm areas, mostly in the tropics, are dark purple. Blue marks moderate winds. Yellow, orange and red mark strong winds inside large storm swirls, especially across the Southern Ocean, the North Pacific and near Greenland. Continents are white and light gray. A NASA logo appears at the top left and a date label at the bottom left.',
  },
  {
    name: 'Precipitation and clouds',
    src: 'img/precipitation-and-clouds.png',
    thumb: 'img/thumbs/precipitation-and-clouds.jpg',
    description: 'Flat world map in satellite-style colors: dark blue oceans, tan deserts and green forests, with white clouds. Rain appears as patches of green and blue with a few red spots, most common along the equator and inside large spiral storms in the Southern Hemisphere. A NASA logo appears at the top left and a date label at the bottom left.',
  },
  {
    name: 'Rain and snow',
    src: 'img/rain-and-snow.jpeg',
    thumb: 'img/thumbs/rain-and-snow.jpg',
    description: 'World map with the continents in gray and the oceans in black. Rain appears as patches of green, yellow and red, with the heaviest rain over the central United States, eastern Asia and the tropical Indian and western Pacific oceans. Snow appears in light blue near the poles, over northern Europe and Russia, and in the Canadian Arctic.',
  },
];

const DETAIL_MIN = 1;
const DETAIL_MAX = 10;
const MIN_SIZE_DIVISOR = 16;            // smallest region = image width / 16 (never below 8 px)
const TEXT_SIZES = [100, 125, 150, 175, 200];

const PREF_TEXT = 'earthjukebox.textSize';
const PREF_CONTRAST = 'earthjukebox.contrast';

/* ---------- Page elements ---------- */

const $ = (id) => document.getElementById(id);
const el = {
  image: $('main-image'),
  highlight: $('highlight'),
  name: $('image-name'),
  counter: $('counter'),
  description: $('description'),
  prev: $('btn-prev'),
  play: $('btn-play'),
  next: $('btn-next'),
  progress: $('progress'),
  status: $('status'),
  nowPlaying: $('now-playing'),
  gallery: $('gallery'),
  order: $('sel-order'),
  detail: $('rng-detail'),
  detailOut: $('out-detail'),
  chkHighlight: $('chk-highlight'),
  contrast: $('btn-contrast'),
  smaller: $('btn-text-smaller'),
  larger: $('btn-text-larger'),
  textSize: $('text-size'),
};

/* ---------- State ---------- */

let current = 0;                        // index of the image on screen
let dims = { width: 0, height: 0 };     // size of the analysed image (0 until it has loaded)
let analysis = null;                    // Imagen instance (reads pixels)
let player = null;                      // ReproductorSonificacion instance
let run = null;                         // the active playback session, or null
let resolveCurrent = null;
let loadTurn = 0;                       // lets us ignore image loads that are no longer wanted
let loadChain = Promise.resolve();
let imageReady = Promise.resolve();
let textIndex = 0;
const radios = [];

/* ---------- Small helpers ---------- */

function setStatus(text) { el.status.textContent = text; }
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readPref(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}
function savePref(key, value) {
  try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable: ignore */ }
}

/* The slider is "detail": more detail = more notes = a lower variation threshold. */
function detailToThreshold(detail) {
  return Math.round(60 - ((detail - DETAIL_MIN) * 50) / (DETAIL_MAX - DETAIL_MIN));
}

/* ---------- Display options (high contrast, text size) ---------- */

function applyContrast(on) {
  document.documentElement.dataset.contrast = on ? 'high' : 'normal';
  el.contrast.setAttribute('aria-pressed', String(on));
}

function applyTextSize() {
  const size = TEXT_SIZES[textIndex];
  document.documentElement.style.fontSize = size + '%';
  el.textSize.textContent = size + '%';
  // aria-disabled (not disabled) so a button never loses keyboard focus when it reaches its limit
  el.smaller.setAttribute('aria-disabled', String(textIndex === 0));
  el.larger.setAttribute('aria-disabled', String(textIndex === TEXT_SIZES.length - 1));
}

function changeTextSize(step) {
  const next = textIndex + step;
  if (next < 0 || next >= TEXT_SIZES.length) return;
  textIndex = next;
  savePref(PREF_TEXT, String(textIndex));
  applyTextSize();
}

function initDisplayOptions() {
  const savedContrast = readPref(PREF_CONTRAST);
  const wantsHigh = savedContrast !== null
    ? savedContrast === 'high'
    : window.matchMedia('(prefers-contrast: more)').matches;
  applyContrast(wantsHigh);

  const savedText = Number(readPref(PREF_TEXT));
  textIndex = Number.isInteger(savedText) && savedText >= 0 && savedText < TEXT_SIZES.length ? savedText : 0;
  applyTextSize();

  el.contrast.addEventListener('click', () => {
    const on = el.contrast.getAttribute('aria-pressed') !== 'true';
    applyContrast(on);
    savePref(PREF_CONTRAST, on ? 'high' : 'normal');
  });
  el.smaller.addEventListener('click', () => changeTextSize(-1));
  el.larger.addEventListener('click', () => changeTextSize(1));
}

/* ---------- Highlight drawn over the image ---------- */

function fitHighlight() {
  const ratio = window.devicePixelRatio || 1;
  el.highlight.width = Math.round(el.image.clientWidth * ratio);
  el.highlight.height = Math.round(el.image.clientHeight * ratio);
  return ratio;
}

function clearHighlight() {
  el.highlight.getContext('2d').clearRect(0, 0, el.highlight.width, el.highlight.height);
}

function drawHighlight(region) {
  if (!el.chkHighlight.checked || !dims.width || !el.image.clientWidth) return;
  const ratio = fitHighlight();                       // resizing the canvas also clears it
  const k = (el.image.clientWidth / dims.width) * ratio;
  const g = el.highlight.getContext('2d');
  const x = region.x * k, y = region.y * k, w = region.ancho * k, h = region.alto * k;
  g.fillStyle = 'rgba(255, 214, 10, 0.30)';
  g.fillRect(x, y, w, h);
  g.lineJoin = 'round';
  g.lineWidth = 7 * ratio;                            // dark outline under the yellow one: visible on any colors
  g.strokeStyle = '#000000';
  g.strokeRect(x, y, w, h);
  g.lineWidth = 3.5 * ratio;
  g.strokeStyle = '#ffd60a';
  g.strokeRect(x, y, w, h);
}

/* ---------- Loading the image for analysis ---------- */

/* Loads happen one at a time and in order, so the analysis canvas always matches the image on screen. */
function loadAnalysis(src, turn) {
  const job = loadChain
    .catch(() => {})
    .then(() => {
      if (turn !== loadTurn) return null;             // the person already moved on
      if (!analysis) analysis = new Imagen('analysis-canvas', 0, 8);
      return analysis.cargar(src);
    })
    .then((loaded) => {
      if (loaded && turn === loadTurn) dims = { width: analysis.ancho, height: analysis.alto };
    });
  loadChain = job;
  job.catch(() => {});                                // the error is reported when the person presses Play
  return job;
}

/* ---------- Navigating between images ---------- */

function showImage(index) {
  index = (index + IMAGES.length) % IMAGES.length;    // wraps around: there is no dead end
  stopPlayback(null);
  current = index;
  const info = IMAGES[index];
  const turn = ++loadTurn;
  dims = { width: 0, height: 0 };
  clearHighlight();
  radios[index].checked = true;
  el.counter.textContent = 'Image ' + (index + 1) + ' of ' + IMAGES.length;
  el.name.textContent = info.name;
  el.description.textContent = info.description;
  el.nowPlaying.textContent = '';
  el.progress.value = 0;
  el.image.alt = info.name;
  el.image.src = info.src;
  setStatus('Image ' + (index + 1) + ' of ' + IMAGES.length + ': ' + info.name + '. Press Play sound to listen.');
  imageReady = loadAnalysis(info.src, turn);
}

function buildGallery() {
  IMAGES.forEach((info, i) => {
    const label = document.createElement('label');
    label.className = 'thumb';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'image';
    input.value = String(i);
    input.addEventListener('change', () => { if (input.checked) showImage(i); });

    const picture = document.createElement('img');
    picture.src = info.thumb;
    picture.alt = '';                                 // the label text already names the image
    picture.loading = 'lazy';
    picture.decoding = 'async';

    const text = document.createElement('span');
    text.className = 'thumb-name';
    text.textContent = info.name;

    label.append(input, picture, text);
    el.gallery.append(label);
    radios.push(input);
  });
}

/* ---------- Building the notes ---------- */

function buildQueue() {
  if (!analysis || typeof construirArbol !== 'function' || typeof recorrer !== 'function') {
    throw new Error('The sound engine did not load.');
  }
  const threshold = detailToThreshold(Number(el.detail.value));
  const minSize = Math.max(8, Math.round(dims.width / MIN_SIZE_DIVISOR));
  const root = construirArbol(
    dims.width,
    dims.height,
    (x, y, w, h) => analysis.analizar(x, y, w, h),
    { umbral: threshold, tamanoMinimo: minSize }
  );
  return recorrer(root, el.order.value);
}

/* ---------- Playback ---------- */

function setPlaying(value) {
  el.play.textContent = value ? 'Stop sound' : 'Play sound';
  el.play.dataset.state = value ? 'playing' : 'idle';
}

/* Stops the current session (if any). Pass a message to show it, or null to stay quiet. */
function stopPlayback(message) {
  if (!run) return;
  run.cancelled = true;
  run = null;
  if (player) player.detener();
  if (resolveCurrent) resolveCurrent();
  clearHighlight();
  setPlaying(false);
  if (message) setStatus(message);
}

function playQueue(queue, onNote) {
  if (typeof ReproductorSonificacion !== 'function') throw new Error('The audio engine did not load.');
  return new Promise((resolve) => {
    resolveCurrent = () => { resolveCurrent = null; resolve(); };
    player.reproducirCola(
      queue,
      dims.width,
      dims.height,
      (node) => { if (node) onNote(node); },
      () => { if (resolveCurrent) resolveCurrent(); }
    );
  });
}

function describeError(error) {
  if (error && error.name === 'SecurityError') {
    return 'The browser blocked access to the image pixels. Open this page from a web server, such as GitHub Pages or the VS Code Live Server extension, instead of opening the file directly.';
  }
  return 'The sound could not be played. Try another image or reload the page.';
}

async function play() {
  if (run) return;
  const mine = { cancelled: false };
  run = mine;
  setPlaying(true);

  try {
    if (typeof ReproductorSonificacion === 'function') {
      player = player || new ReproductorSonificacion();
      player.inicializarContexto();
    }
  } catch (error) {
    console.error(error);
  }

  const info = IMAGES[current];
  const ready = imageReady;
  try {
    setStatus('Preparing ' + info.name + '…');
    await ready;                                      // waits here if the image is still downloading
    if (mine.cancelled) return;
    if (!dims.width) throw new Error('The image is not ready.');
    await pause(30);                                 
    if (mine.cancelled) return;

    const queue = buildQueue();
    const total = typeof queue.tamano === 'function' ? queue.tamano() : 0;
    el.progress.max = Math.max(total, 1);
    el.progress.value = 0;
    setStatus('Playing ' + info.name + ': ' + total + ' notes.');

    let count = 0;
    await playQueue(queue, (node) => {
      if (mine.cancelled) return;
      count++;
      const frequency = player.calcularFrecuencia(node.color || { r: 128, g: 128, b: 128 });
      el.progress.value = count;
      el.nowPlaying.textContent = 'Note ' + count + ' of ' + total + ' · ' + Math.round(frequency) + ' Hz';
      drawHighlight(node);
    });
    if (run === mine) stopPlayback('Finished. ' + count + ' notes played.');
  } catch (error) {
    console.error(error);
    if (run === mine) stopPlayback(describeError(error));
  }
}

function togglePlayback() {
  if (run) stopPlayback('Stopped.');
  else play();
}

/* ---------- Start ---------- */

function init() {
  initDisplayOptions();
  buildGallery();

  el.chkHighlight.checked = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateDetail = () => {
    const text = el.detail.value + ' of ' + DETAIL_MAX;
    el.detailOut.textContent = text;
    el.detail.setAttribute('aria-valuetext', text);
  };
  el.detail.addEventListener('input', updateDetail);
  updateDetail();

  el.prev.addEventListener('click', () => showImage(current - 1));
  el.next.addEventListener('click', () => showImage(current + 1));
  el.play.addEventListener('click', togglePlayback);
  el.image.addEventListener('load', fitHighlight);
  window.addEventListener('resize', () => { if (!run) fitHighlight(); });

  // Esc stops the sound from anywhere. It is not a character key, so it cannot clash with typing.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && run) stopPlayback('Stopped.');
  });

  showImage(0);
}

init();
})();