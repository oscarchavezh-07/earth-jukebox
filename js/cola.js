'use strict';
/*
Cola (FIFO) implementada con Linked List.
   El primero que entra es el primero que sale. Se guarda un apuntador al frente (por donde se saca) y otro al final (por donde se mete), así
   encolar y desencolar cuestan O(1) sin recorrer nada.

   Uso:
   - La "cola de notas": los recorridos meten aquí las regiones del árbol
     y el reproductor las va sacando en orden para tocarlas.
   - El recorrido por niveles usa esta misma cola para visitar el árbol.

   No depende de ningún archivo. */

class NodoCola {
  constructor(valor) {
    this.valor = valor;
    this.siguiente = null;     // "el que va detrás de mí en la fila"
  }
}

class Cola {
  constructor() {
    this._frente = null;       // primer nodo: el próximo en salir
    this._final = null;        // último nodo: el más reciente en entrar
    this._tamano = 0;
  }

  /* ¿No hay elementos? O(1) */
  vacia() { return this._frente === null; }

  /* Cuántos elementos hay. O(1) porque se lleva la cuenta */
  tamano() { return this._tamano; }

  /* Mete un valor al final de la fila. O(1) */
  encolar(valor) {
    const nuevo = new NodoCola(valor);
    if (this.vacia()) {
      this._frente = nuevo;            // cola vacía: es frente y final a la vez
    } else {
      this._final.siguiente = nuevo;   // se forma detrás del último
    }
    this._final = nuevo;
    this._tamano++;
    return this._tamano;
  }

  /* Saca y devuelve el valor del frente. O(1). Si la cola está vacía devuelve undefined (no se truena). */
  desencolar() {
    if (this.vacia()) return undefined;
    const valor = this._frente.valor;
    this._frente = this._frente.siguiente;
    if (this._frente === null) this._final = null;   // salió el último: la cola queda vacía
    this._tamano--;
    return valor;
  }

  /* Mira el valor del frente sin sacarlo. O(1) */
  frente() { return this.vacia() ? undefined : this._frente.valor; }

  /* Mira el valor del final sin sacarlo. O(1) */
  final() { return this.vacia() ? undefined : this._final.valor; }

  /* Vacía la cola. O(1) */
  limpiar() { this._frente = null; this._final = null; this._tamano = 0; }

  /* Copia los valores a un arreglo, del frente al final, sin modificar la cola. O(n).
    Sirve para mostrar la cola en pantalla o para las pruebas. */
  aArreglo() {
    const salida = [];
    for (let nodo = this._frente; nodo !== null; nodo = nodo.siguiente) salida.push(nodo.valor);
    return salida;
  }
}

if (typeof module !== 'undefined') module.exports = { NodoCola, Cola };