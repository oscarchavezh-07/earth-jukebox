class NodoArbol {
  constructor(x, y, ancho, alto, profundidad) {
    this.x = x;
    this.y = y;
    this.ancho = ancho;
    this.alto = alto;
    this.profundidad = profundidad;
    this.color = null;   // { r, g, b }, solo en hojas
    this.izq = null;
    this.der = null;
  }

  esHoja() {
    return this.izq === null && this.der === null;
  }
}

const CONFIG = {
  umbral: 30,        // variación máxima para considerar la región uniforme
  tamanoMinimo: 8    // ancho o alto mínimo (en píxeles)
};

function debeSerHoja(nodo, variacion, config) {
  const muyPequena = nodo.ancho <= config.tamanoMinimo ||
                     nodo.alto <= config.tamanoMinimo;
  const uniforme = variacion < config.umbral;
  return muyPequena || uniforme;
}

function dividir(nodo) {
  const prof = nodo.profundidad + 1;
  let izq, der;

  if (nodo.profundidad % 2 === 0) {
    // Corte Vertical
    const mitad = Math.floor(nodo.ancho / 2);
    izq = new NodoArbol(nodo.x, nodo.y, mitad, nodo.alto, prof); 
    der = new NodoArbol(nodo.x + mitad, nodo.y, nodo.ancho - mitad, nodo.alto, prof);
  } else {
    // COrte Horizontal
    const mitad = Math.floor(nodo.alto / 2);
    izq = new NodoArbol(nodo.x, nodo.y, nodo.ancho, mitad, prof);
    der = new NodoArbol(nodo.x, nodo.y + mitad, nodo.ancho, nodo.alto - mitad, prof);
  }

  return { izq, der };
}

function construirNodo(nodo, analizar, config) {
  const info = analizar(nodo.x, nodo.y, nodo.ancho, nodo.alto);

  if (debeSerHoja(nodo, info.variacion, config)) {
    nodo.color = info.promedio;   
    return nodo;
  }

  const hijos = dividir(nodo);
  nodo.izq = construirNodo(hijos.izq, analizar, config);
  nodo.der = construirNodo(hijos.der, analizar, config);
  return nodo;
}

function construirArbol(ancho, alto, analizar, config) {
  const raiz = new NodoArbol(0, 0, ancho, alto, 0);
  return construirNodo(raiz, analizar, config);
}

function contarNodos(nodo) {
  if (nodo === null) return 0;
  return 1 + contarNodos(nodo.izq) + contarNodos(nodo.der);
}

function contarHojas(nodo) {
  if (nodo === null) return 0;
  if (nodo.esHoja()) return 1;
  return contarHojas(nodo.izq) + contarHojas(nodo.der);
}

function altura(nodo) {
  if (nodo === null) return 0;
  return 1 + Math.max(altura(nodo.izq), altura(nodo.der));
}

if (typeof module !== 'undefined') {
  module.exports = { NodoArbol, CONFIG, debeSerHoja, dividir, construirArbol,
                     contarNodos, contarHojas, altura };
}