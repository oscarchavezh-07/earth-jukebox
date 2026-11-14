const { NodoArbol, dividir, construirArbol,
        contarNodos, contarHojas, altura } = require('./arbol.js');

let fallos = 0;
function verificar(descripcion, obtenido, esperado) {
  const ok = obtenido === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${descripcion}: obtenido ${obtenido}, esperado ${esperado}`);
}

function sumarAreaHojas(nodo) {
  if (nodo === null) return 0;
  if (nodo.esHoja()) return nodo.ancho * nodo.alto;
  return sumarAreaHojas(nodo.izq) + sumarAreaHojas(nodo.der);
}

// Imágenes simuladas
const color = { r: 10, g: 10, b: 10 };
const uniforme = () => ({ promedio: color, variacion: 0 });
const detallada = () => ({ promedio: color, variacion: 100 });
const mitadDetallada = (x, y, ancho, alto) =>
  ({ promedio: color, variacion: (x + ancho > 16) ? 50 : 5 });

// Caso 1: imagen de un solo color
let a = construirArbol(800, 600, uniforme, { umbral: 30, tamanoMinimo: 8 });
verificar('Caso 1 nodos', contarNodos(a), 1);
verificar('Caso 1 hojas', contarHojas(a), 1);
verificar('Caso 1 altura', altura(a), 1);

// Caso 2: imagen más pequeña que el tamaño mínimo
a = construirArbol(4, 4, detallada, { umbral: 30, tamanoMinimo: 8 });
verificar('Caso 2 nodos', contarNodos(a), 1);

// Caso 3: imagen muy detallada (llega al tamaño mínimo en todas partes)
a = construirArbol(64, 64, detallada, { umbral: 30, tamanoMinimo: 8 });
verificar('Caso 3 nodos', contarNodos(a), 63);
verificar('Caso 3 hojas', contarHojas(a), 32);
verificar('Caso 3 altura', altura(a), 6);

// Caso 4: umbral muy alto y umbral 0
a = construirArbol(32, 16, mitadDetallada, { umbral: 1000, tamanoMinimo: 8 });
verificar('Caso 4 (umbral 1000) nodos', contarNodos(a), 1);
a = construirArbol(32, 16, mitadDetallada, { umbral: 0, tamanoMinimo: 8 });
verificar('Caso 4 (umbral 0) nodos', contarNodos(a), 7);
verificar('Caso 4 (umbral 0) hojas', contarHojas(a), 4);

// Caso 5: dimensiones impares, no se pierde ningún píxel
const h = dividir(new NodoArbol(0, 0, 7, 10, 0));
verificar('Caso 5 ancho izquierdo', h.izq.ancho, 3);
verificar('Caso 5 ancho derecho', h.der.ancho, 4);
a = construirArbol(33, 17, detallada, { umbral: 30, tamanoMinimo: 4 });
verificar('Caso 5 área total de las hojas', sumarAreaHojas(a), 33 * 17);
verificar('Caso 5 nodos = 2 x hojas - 1', contarNodos(a), 2 * contarHojas(a) - 1);

// Extra: árbol vacío
verificar('Extra árbol vacío', contarNodos(null), 0);

console.log(fallos === 0 ? '\nTodas las pruebas pasaron' : `\n${fallos} prueba(s) fallaron`);