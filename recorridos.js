'use strict';
/* 
   Recorridos
   Cada recorrido visita todos los nodos del árbol en un orden distinto y
   devuelve una Cola con el resultado: la "cola de notas" que el
   reproductor va vaciando. Cambiar de recorrido cambia el orden
   en que suenan las regiones, o sea, cambia la melodía.

   Necesita: cola.js

Funciona con cualquiera de estas formas:
     a) nodo.izq y nodo.der                 (árbol binario)
     b) nodo.izquierdo y nodo.derecho       (árbol binario)
     c) nodo.hijos = [ ... ]                (2 hijos, o 4 si es quadtree)
   Un nodo sin hijos (null, undefined o arreglo vacío) es una hoja.
   Si el Rol 1 usa otros nombres, solo hay que cambiar hijosDe y ladosDe. */

if (typeof module !== 'undefined' && typeof require !== 'undefined') {
  globalThis.Cola = require('./cola.js').Cola;
}

/* Devuelve los hijos de un nodo como arreglo (vacío si es hoja). O(1) */
function hijosDe(nodo) {
  if (Array.isArray(nodo.hijos)) return nodo.hijos.filter(h => h != null);
  const izq = nodo.izq ?? nodo.izquierdo ?? null;
  const der = nodo.der ?? nodo.derecho ?? null;
  const salida = [];
  if (izq) salida.push(izq);
  if (der) salida.push(der);
  return salida;
}

/* Para el inorden: separa los hijos en "lado izquierdo" y "lado derecho". 
Así un nodo que solo tiene hijo derecho se visita antes que ese hijo. O(1) */
function ladosDe(nodo) {
  if (Array.isArray(nodo.hijos)) {
    const mitad = Math.ceil(nodo.hijos.length / 2);
    return [nodo.hijos.slice(0, mitad).filter(h => h != null), nodo.hijos.slice(mitad).filter(h => h != null)];
  }
  const izq = nodo.izq ?? nodo.izquierdo ?? null, der = nodo.der ?? nodo.derecho ?? null;
  return [izq ? [izq] : [], der ? [der] : []];
}

function esHoja(nodo) { return hijosDe(nodo).length === 0; }

/* Decide si un nodo entra a la cola de notas. Por omisión solo entran las hojas, porque son las regiones finales de la
   imagen (las que suenan). Con soloHojas = false entran todos los nodos. */
function agregar(cola, nodo, soloHojas) {
  if (!soloHojas || esHoja(nodo)) cola.encolar(nodo);
}

/* Preorden: raíz, luego hijos de izquierda a derecha.
   En la imagen: baja hasta el detalle de una zona antes de pasar a la siguiente.
   Tiempo O(n). Espacio extra O(h) por la recursión (h = altura del árbol). */
function preorden(raiz, soloHojas = true, cola = new Cola()) {
  if (!raiz) return cola;
  agregar(cola, raiz, soloHojas);
  for (const hijo of hijosDe(raiz)) preorden(hijo, soloHojas, cola);
  return cola;
}

/* Inorden: hijo izquierdo, raíz, hijo derecho.
   Si el nodo tiene 4 hijos (quadtree): primera mitad, raíz, segunda mitad.
   Tiempo O(n). Espacio extra O(h). */
function inorden(raiz, soloHojas = true, cola = new Cola()) {
  if (!raiz) return cola;
  const [izquierda, derecha] = ladosDe(raiz);
  for (const hijo of izquierda) inorden(hijo, soloHojas, cola);
  agregar(cola, raiz, soloHojas);
  for (const hijo of derecha) inorden(hijo, soloHojas, cola);
  return cola;
}

/* Posorden: primero todos los hijos, al final la raíz. Tiempo O(n). Espacio extra O(h). */
function posorden(raiz, soloHojas = true, cola = new Cola()) {
  if (!raiz) return cola;
  for (const hijo of hijosDe(raiz)) posorden(hijo, soloHojas, cola);
  agregar(cola, raiz, soloHojas);
  return cola;
}

/* Por niveles (anchura): la raíz, luego sus hijos, luego los nietos.
   Aquí la Cola trabaja dos veces: una cola de "pendientes" para visitar el árbol y otra con el resultado. 
   En la imagen: primero suenan las regiones grandes (poco profundas) y al final las más pequeñas.
   Tiempo O(n). Espacio extra O(a), a = ancho máximo de un nivel. */
function porNiveles(raiz, soloHojas = true) {
  const cola = new Cola();
  if (!raiz) return cola;
  const pendientes = new Cola();
  pendientes.encolar(raiz);
  while (!pendientes.vacia()) {
    const nodo = pendientes.desencolar();
    agregar(cola, nodo, soloHojas);
    for (const hijo of hijosDe(nodo)) pendientes.encolar(hijo);
  }
  return cola;
}

/* Punto de entrada para la interfaz y el audio
   tipo: preorden | inorden | posorden | niveles
   Devuelve la Cola de notas lista para reproducir.
   Ejemplo:
       const notas = recorrer(arbol.raiz, 'niveles');
       while (!notas.vacia()) { const region = notas.desencolar(); tocar(region); }      */
const RECORRIDOS = { preorden, inorden, posorden, niveles: porNiveles };

function recorrer(raiz, tipo = 'preorden', soloHojas = true) {
  const fn = RECORRIDOS[tipo];
  if (!fn) throw new Error(`Recorrido desconocido: "${tipo}". Usa preorden, inorden, posorden o niveles.`);
  return fn(raiz, soloHojas);
}

/* Texto para el menú de la interfaz */
const NOMBRES_RECORRIDO = {
  preorden: 'Preorden (raíz, izquierda, derecha)',
  inorden: 'Inorden (izquierda, raíz, derecha)',
  posorden: 'Posorden (izquierda, derecha, raíz)',
  niveles: 'Por niveles (de regiones grandes a pequeñas)',
};

if (typeof module !== 'undefined') {
  module.exports = { hijosDe, ladosDe, esHoja, preorden, inorden, posorden, porNiveles, recorrer, RECORRIDOS, NOMBRES_RECORRIDO };
}