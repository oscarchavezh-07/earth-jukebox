'use strict';
/*
Pruebas de la cola y los recorridos
   Navegador:  cargar cola.js, recorridos.js y este archivo; luego llamar ejecutarPruebasRol2() y mostrar el arreglo que devuelve.
*/
if (typeof module !== 'undefined' && typeof require !== 'undefined') {
  Object.assign(globalThis, require('./cola.js'), require('./recorridos.js'));
}

/* Árbol de ejemplo (binario), con los mismos campos que usaría arbol.js:
              A
            /   \
           B     C
          / \     \
         D   E     F
            /
           G                                   Hojas: D, G, F            */
           
const hoja = n => ({ nombre: n, izq: null, der: null });
function arbolDeEjemplo() {
  const E = { nombre: 'E', izq: hoja('G'), der: null };
  const B = { nombre: 'B', izq: hoja('D'), der: E };
  const C = { nombre: 'C', izq: null, der: hoja('F') };
  return { nombre: 'A', izq: B, der: C };
}
const nombres = cola => cola.aArreglo().map(n => n.nombre).join('');

const PRUEBAS_ROL2 = [
  ["Cola: sale en el mismo orden en que entró (FIFO)", "normal", () => {
    const c = new Cola();
    [10, 20, 30].forEach(v => c.encolar(v));
    return c.tamano() === 3 && c.frente() === 10 && c.final() === 30 &&
      c.desencolar() === 10 && c.desencolar() === 20 && c.frente() === 30 && c.tamano() === 1;
  }],
  ["Cola vacía: desencolar, frente y final devuelven undefined sin fallar", "límite", () => {
    const c = new Cola();
    return c.vacia() && c.tamano() === 0 && c.desencolar() === undefined && c.frente() === undefined &&
      c.final() === undefined && c.aArreglo().length === 0;
  }],
  ["Cola de un elemento: al sacarlo queda vacía y se puede volver a usar", "límite", () => {
    const c = new Cola();
    c.encolar('x');
    const ok1 = c.frente() === 'x' && c.final() === 'x' && c.desencolar() === 'x' && c.vacia() && c.final() === undefined;
    c.encolar('y'); c.encolar('z');
    return ok1 && c.aArreglo().join('') === 'yz' && c.final() === 'z';
  }],
  ["Cola: 10 000 elementos entran y salen en orden; limpiar la deja vacía", "límite", () => {
    const c = new Cola();
    for (let i = 0; i < 10000; i++) c.encolar(i);
    let enOrden = true;
    for (let i = 0; i < 5000; i++) if (c.desencolar() !== i) enOrden = false;
    const mitad = c.tamano() === 5000 && c.frente() === 5000;
    c.limpiar();
    return enOrden && mitad && c.vacia() && c.tamano() === 0;
  }],
  ["Recorridos con todos los nodos: orden correcto de los cuatro", "normal", () => {
    const a = arbolDeEjemplo();
    return nombres(preorden(a, false)) === 'ABDEGCF' && nombres(inorden(a, false)) === 'DBGEACF' &&
      nombres(posorden(a, false)) === 'DGEBFCA' && nombres(porNiveles(a, false)) === 'ABCDEFG';
  }],
  ["Recorridos solo de hojas (la cola de notas): mismas hojas, sin nodos internos", "normal", () => {
    const a = arbolDeEjemplo();
    return nombres(preorden(a)) === 'DGF' && nombres(inorden(a)) === 'DGF' &&
      nombres(posorden(a)) === 'DGF' && nombres(porNiveles(a)) === 'DFG';
  }],
  ["Árbol vacío (null): los cuatro recorridos devuelven una cola vacía", "límite", () => {
    return ['preorden', 'inorden', 'posorden', 'niveles'].every(t => recorrer(null, t).vacia()) && recorrer(undefined).vacia();
  }],
  ["Árbol de un solo nodo: la raíz es hoja y es la única nota", "límite", () => {
    const solo = hoja('R');
    return ['preorden', 'inorden', 'posorden', 'niveles'].every(t => nombres(recorrer(solo, t)) === 'R');
  }],
  ["Árbol degenerado de 2 000 niveles (como lista): no se pierde ningún nodo", "límite", () => {
    let raiz = hoja(0);
    for (let i = 1; i < 2000; i++) raiz = { nombre: i, izq: raiz, der: null };
    return preorden(raiz, false).tamano() === 2000 && porNiveles(raiz, false).tamano() === 2000 &&
      posorden(raiz).tamano() === 1 && posorden(raiz, false).frente().nombre === 0;
  }],
  ["Otras formas de nodo: izquierdo/derecho y hijos[] de 4 (quadtree)", "normal", () => {
    const largo = { nombre: 'A', izquierdo: { nombre: 'B' }, derecho: { nombre: 'C' } };
    const h = n => ({ nombre: n, hijos: [] });
    const quad = { nombre: 'R', hijos: [h('1'), { nombre: 'X', hijos: [h('a'), h('b'), h('c'), h('d')] }, h('3'), h('4')] };
    return nombres(inorden(largo, false)) === 'BAC' && nombres(preorden(quad, false)) === 'R1Xabcd34' &&
      nombres(porNiveles(quad, false)) === 'R1X34abcd' && nombres(posorden(quad)) === '1abcd34' &&
      nombres(inorden(quad, false)) === '1abXcdR34';
  }],
  ["Recorrido con nombre desconocido: avisa con un error claro", "límite", () => {
    try { recorrer(arbolDeEjemplo(), 'zigzag'); return false; } catch (e) { return /desconocido/.test(e.message); }
  }],
];

function ejecutarPruebasRol2() {
  return PRUEBAS_ROL2.map(([nombre, tipo, fn]) => {
    let ok = false, error = '';
    try { ok = fn() === true; } catch (e) { error = String(e.message || e); }
    return { nombre, tipo, ok, error };
  });
}

if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
  const r = ejecutarPruebasRol2();
  r.forEach(p => console.log((p.ok ? 'PASA   ' : 'FALLA  ') + `[${p.tipo}] ` + p.nombre + (p.error ? '  -> ' + p.error : '')));
  console.log(`\n${r.filter(p => p.ok).length} de ${r.length} pruebas pasan`);
  process.exit(r.every(p => p.ok) ? 0 : 1);
}
if (typeof module !== 'undefined') module.exports = { ejecutarPruebasRol2 };