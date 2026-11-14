/**
 * Persona 4: Motor de Audio y Sonificación (Web Audio API)
 * Convierte una cola de nodos (regiones de imagen) en música pentatónica espacializada.
 */

class ReproductorSonificacion {
  constructor() {
    this.audioCtx = null;
    this.estaReproduciendo = false;
    this.estaPausado = false;
    this.temporizador = null;

    // Escala Pentatónica Mayor en 3 octavas (Do, Re, Mi, Sol, La)
    // Va desde notas graves (C3) hasta agudas (A5) para mapear frío -> cálido
    this.escalaPentatonica = [
      130.81, 146.83, 164.81, 196.00, 220.00, // Octava 3 (Graves / Fríos)
      261.63, 293.66, 329.63, 392.00, 440.00, // Octava 4 (Medios)
      523.25, 587.33, 659.25, 783.99, 880.00  // Octava 5 (Agudos / Cálidos)
    ];

    // Estado actual de reproducción (para poder reanudar tras pausa)
    this.colaActual = null;
    this.dimensionesImagen = { ancho: 1, alto: 1 };
    this.onNotaSonando = null; // Callback para Persona 5
    this.onFinalizar = null;   // Callback opcional al vaciar la cola
  }

  /**
   * Inicializa o despierta el AudioContext (requiere interacción del usuario por políticas del navegador)
   */
  inicializarContexto() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * 1. COLOR -> TONO (0 a 1 -> Frecuencia Pentatónica)
   * Mapea temperatura de color: Azul/Frío (cercano a 0) -> Grave | Rojo/Cálido (cercano a 1) -> Agudo
   */
  calcularFrecuencia(color) {
    const r = color.r ?? 0;
    const g = color.g ?? 0;
    const b = color.b ?? 0;

    // Índice de calidez normalizado entre 0 y 1
    // Rojo suma calidez, Azul resta calidez, Verde aporta brillo intermedio
    const calidezRaw = (r - b + 255) / 510; // Rango [0, 1]
    const brillo = (r + g + b) / (3 * 255); // Rango [0, 1]
    
    // Combinamos 75% temperatura de color + 25% luminosidad
    let valorNormalizado = (calidezRaw * 0.75) + (brillo * 0.25);
    valorNormalizado = Math.max(0, Math.min(1, valorNormalizado)); // Clamp [0, 1]

    const indice = Math.floor(valorNormalizado * (this.escalaPentatonica.length - 1));
    return this.escalaPentatonica[indice];
  }

  /**
   * 2. TAMAÑO DE ZONA -> DURACIÓN Y VOLUMEN
   * Zonas grandes = notas más largas y con mayor presencia.
   */
  calcularDuracionYVolumen(nodo, anchoTotal, altoTotal) {
    const areaNodo = (nodo.ancho || 10) * (nodo.alto || 10);
    const areaTotal = (anchoTotal || 100) * (altoTotal || 100);
    
    // Proporción del área (usamos raíz cuadrada para suavizar diferencias extremas)
    const proporcion = Math.min(1, Math.sqrt(areaNodo / areaTotal));

    // Duración entre 0.15s (región pequeña/detalle) y 0.85s (región grande/fondo)
    const duracion = 0.15 + (proporcion * 0.70);

    // Volumen (ganancia) entre 0.08 y 0.45 (evita saturación si se solapan notas)
    const volumen = 0.08 + (proporcion * 0.37);

    return { duracion, volumen };
  }

  /**
   * 3. POSICIÓN HORIZONTAL -> PANEADO ESTÉREO (-1 izquierda a +1 derecha)
   */
  calcularPaneo(nodo, anchoTotal) {
    const centroX = (nodo.x || 0) + ((nodo.ancho || 0) / 2);
    const paneo = ((centroX / (anchoTotal || 1)) * 2) - 1;
    return Math.max(-1, Math.min(1, paneo)); // Clamp [-1, 1]
  }

  /**
   * Sintetiza y dispara una sola nota usando Web Audio API
   */
  tocarNota(nodo, anchoTotal, altoTotal) {
    this.inicializarContexto();
    const ahora = this.audioCtx.currentTime;

    const frecuencia = this.calcularFrecuencia(nodo.color || { r: 128, g: 128, b: 128 });
    const { duracion, volumen } = this.calcularDuracionYVolumen(nodo, anchoTotal, altoTotal);
    const paneo = this.calcularPaneo(nodo, anchoTotal);

    // Nodos de audio: Oscilador -> Ganancia (Envolvente) -> Paneo Estéreo -> Salida
    const oscilador = this.audioCtx.createOscillator();
    const ganancia = this.audioCtx.createGain();
    const panner = this.audioCtx.createStereoPanner();

    // 'triangle' o 'sine' producen un timbre cálido tipo marimba/sintetizador suave
    oscilador.type = 'triangle';
    oscilador.frequency.setValueAtTime(frecuencia, ahora);

    // Envolvente ADSR suave para evitar "clics" al iniciar o cortar el audio
    ganancia.gain.setValueAtTime(0.0001, ahora);
    ganancia.gain.linearRampToValueAtTime(volumen, ahora + 0.03); // Ataque rápido (30ms)
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + duracion); // Desvanecimiento suave

    // Posición espacial
    panner.pan.setValueAtTime(paneo, ahora);

    // Conexiones
    oscilador.connect(ganancia);
    ganancia.connect(panner);
    panner.connect(this.audioCtx.destination);

    // Ejecución
    oscilador.start(ahora);
    oscilador.stop(ahora + duracion + 0.02);

    return duracion;
  }

  /**
   * 4. REPRODUCTOR: Desencola notas una por una y las programa en el tiempo
   * @param {Cola} colaNotas - Instancia de la cola propia (Persona 2)
   * @param {number} anchoImg - Ancho del canvas/imagen
   * @param {number} altoImg - Alto del canvas/imagen
   * @param {Function} onNotaCallback - Callback(nodo) para que Persona 5 ilumine la región
   * @param {Function} onFinCallback - Callback() opcional cuando termina toda la cola
   */
  reproducirCola(colaNotas, anchoImg, altoImg, onNotaCallback = null, onFinCallback = null) {
    // Si estaba pausado sobre la misma cola, simplemente reanuda
    if (this.estaPausado && this.colaActual) {
      this.estaPausado = false;
      this.estaReproduciendo = true;
      this.procesarSiguienteNota();
      return;
    }

    // Si había una reproducción previa, la limpiamos
    this.detener();

    this.colaActual = colaNotas;
    this.dimensionesImagen = { ancho: anchoImg, alto: altoImg };
    this.onNotaSonando = onNotaCallback;
    this.onFinalizar = onFinCallback;
    this.estaReproduciendo = true;
    this.estaPausado = false;

    this.procesarSiguienteNota();
  }

  /**
   * Ciclo interno que desencola, suena, notifica a la UI y programa la siguiente nota
   */
  procesarSiguienteNota() {
    if (!this.estaReproduciendo || this.estaPausado) return;

    // Verificamos si la cola ya está vacía (soporta .vacia() o .estaVacia())
    const sinNotas = typeof this.colaActual.vacia === 'function'
      ? this.colaActual.vacia()
      : this.colaActual.estaVacia();

    if (sinNotas) {
      this.estaReproduciendo = false;
      if (this.onNotaSonando) this.onNotaSonando(null); // Apagar resaltado en UI
      if (this.onFinalizar) this.onFinalizar();
      return;
    }

    // Desencolar el siguiente nodo
    const nodoActual = this.colaActual.desencolar();

    // Avisar a la interfaz (Persona 5) qué zona iluminar
    if (this.onNotaSonando) {
      this.onNotaSonando(nodoActual);
    }

    // Tocar el sonido y obtener cuánto dura esta nota
    const duracionNota = this.tocarNota(
      nodoActual,
      this.dimensionesImagen.ancho,
      this.dimensionesImagen.alto
    );

    // Programar la siguiente nota ligeramente antes de que acabe la actual (85% de su duración)
    // Esto crea un flujo musical continuo y orgánico en lugar de pausas robóticas
    const tiempoSiguienteMs = Math.max(120, duracionNota * 850);

    this.temporizador = setTimeout(() => {
      this.procesarSiguienteNota();
    }, tiempoSiguienteMs);
  }

  /**
   * Pausa la reproducción conservando el estado actual de la cola
   */
  pausar() {
    if (!this.estaReproduciendo) return;
    this.estaPausado = true;
    this.estaReproduciendo = false;
    clearTimeout(this.temporizador);
  }

  /**
   * Detiene por completo la reproducción y limpia el estado
   */
  detener() {
    this.estaReproduciendo = false;
    this.estaPausado = false;
    clearTimeout(this.temporizador);
    this.colaActual = null;

    if (this.onNotaSonando) {
      this.onNotaSonando(null); // Limpia cualquier resaltado activo en la interfaz
    }
  }
}
