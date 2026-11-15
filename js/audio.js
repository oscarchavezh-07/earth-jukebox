class ReproductorSonificacion {
  constructor() {
    this.masterGain = null;
    this.compressor = null;

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
    this.onNotaSonando = null;
    this.onFinalizar = null;   // Callback opcional al vaciar la cola
  }

  /**
   * Inicializa o despierta el AudioContext (requiere interacción del usuario por políticas del navegador)
   */
  
  inicializarContexto() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;

      this.audioCtx = new AudioContext();

      // Volumen general de la aplicación.
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.85;

      // Compresión para mantener un volumen más consistente.
      this.compressor = this.audioCtx.createDynamicsCompressor();

      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.15;

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === "suspended") {
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

    const proporcion = Math.min( 1, Math.sqrt(areaNodo / areaTotal));

    // Duración base más perceptible.
    const duracion = 0.25 + proporcion * 0.65;

    // Mayor ganancia en regiones pequeñas.
    // Las regiones grandes conservan mayor presencia.
    const volumen = 0.22 + proporcion * 0.38;

    return { duracion, volumen };
  }


  /**
   * 3. POSICIÓN HORIZONTAL -> PANEADO ESTÉREO (-1 izquierda a +1 derecha)
   */
  calcularPaneo(nodo, anchoTotal) {
    const centroX = (nodo.x || 0) + ((nodo.ancho || 0) / 2);
    const paneo = ((centroX / (anchoTotal || 1)) * 1.3) - 0.65;
    return Math.max(-0.65, Math.min(0.65, paneo)); // Clamp [-1, 1]
  }

  /**
   * Sintetiza y dispara una sola nota usando Web Audio API
   */


  seleccionarInstrumento(nodo, frecuencia) {
    const area = (nodo.ancho || 1) * (nodo.alto || 1);

    // Regiones grandes y graves: pad suave.
    if (frecuencia <= 300 && area > 1000) {
      return "pad";
    }

    // Regiones graves: sonido suave.
    if (frecuencia <= 220) {
      return "suave";
    }

    // Frecuencias medias: marimba.
    if (frecuencia <= 230) {
      return "marimba";
    }

    // Frecuencias medias-altas: piano.
    if (frecuencia <= 400) {
      return "piano";
    }

    // Frecuencias altas: campana.
    return "bell";
  }



  variacionNatural(valor, porcentaje) {
    const factor = 1 + (Math.random() * 2 - 1) * porcentaje;
    return valor * factor;
  }


tocarNota(nodo, anchoTotal, altoTotal) {
  this.inicializarContexto();

  const ahora = this.audioCtx.currentTime;

  const frecuencia = this.calcularFrecuencia(
    nodo.color || { r: 128, g: 128, b: 128 }
  );

  const { duracion: duracionBase, volumen } =
    this.calcularDuracionYVolumen(
      nodo, anchoTotal, altoTotal
    );

  // 1. Reducir duración en frecuencias altas.
  const factorDuracion = Math.max(
    0.45,
    1 - Math.max(0, frecuencia - 440) / 1600
  );

  const duracion = duracionBase * factorDuracion;

  const paneo = this.calcularPaneo(nodo, anchoTotal);

  // 2. Seleccionar instrumento.
  const instrumento = this.seleccionarInstrumento(
    nodo, frecuencia
  );

  const config = this.getInstrumentConfig(
    instrumento
  );

  // 3. Crear nodos de audio.
  const salida = this.audioCtx.createGain();
  const panner = this.audioCtx.createStereoPanner();

  const ataque = Math.min(
    config.ataque,
    duracion * 0.25
  );

  const finAtaque = ahora + ataque;
  const finNota = ahora + duracion;

  salida.gain.setValueAtTime(0.0001, ahora);

  salida.gain.linearRampToValueAtTime(
    Math.max(0.0001, volumen * config.volumen),
    finAtaque
  );

  salida.gain.exponentialRampToValueAtTime(
    0.0001,
    finNota
  );

  // 4. Paneo y conexiones.
  panner.pan.setValueAtTime(paneo, ahora);

  salida.connect(panner);
  panner.connect(this.masterGain);

  // 5. Generador de osciladores.
  const crearOscilador = (tipo, freq, amplitud) => {
    const osc = this.audioCtx.createOscillator();
    const gan = this.audioCtx.createGain();

    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, ahora);
    gan.gain.value = amplitud;

    osc.connect(gan);
    gan.connect(salida);

    osc.start(ahora);
    osc.stop(ahora + duracion + 0.03);
  };

  // 6. Selección de timbre.
  switch (instrumento) {
    case "pad":
      crearOscilador("sine", frecuencia, 0.8);
      crearOscilador("triangle", frecuencia * 2, 0.15);
      crearOscilador("sine", frecuencia * 0.5, 0.2);
      break;

    case "suave":
      crearOscilador("sine", frecuencia, 0.8);
      crearOscilador("triangle", frecuencia * 2, 0.1);
      break;

    case "marimba":
      crearOscilador("triangle", frecuencia, 0.7);
      crearOscilador("sine", frecuencia * 2, 0.35);
      crearOscilador("sine", frecuencia * 3, 0.12);
      break;

    case "piano":
      crearOscilador("triangle", frecuencia * 2, 0.65);
      crearOscilador("sine", frecuencia * 2, 0.25);
      crearOscilador("sine", frecuencia * 3, 0.12);
      crearOscilador("sine", frecuencia * 4, 0.06);
      break;

    case "bell":
      crearOscilador("sine", frecuencia, 0.45);
      crearOscilador("sine", frecuencia * 2.4, 0.25);
      crearOscilador("sine", frecuencia * 3.8, 0.12);
      crearOscilador("sine", frecuencia * 5.1, 0.06);
      break;
  }

  return duracion;
}




  getInstrumentConfig(tipo) {
  const instrumentos = {
    pad: {
      ataque: 0.12,
      volumen: 0.65,
      release: 0.18
    },
    suave: {
      ataque: 0.06,
      volumen: 0.75,
      release: 0.10
    },
    marimba: {
      ataque: 0.008,
      volumen: 1.00,
      release: 0.04
    },
    piano: {
      ataque: 0.015,
      volumen: 0.85,
      release: 0.08
    },
    bell: {
      ataque: 0.005,
      volumen: 0.60,
      release: 0.02
    }
  };

  return instrumentos[tipo] || instrumentos.suave;
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
    let duracionNota;

    try {
      duracionNota = this.tocarNota(
        nodoActual,
        this.dimensionesImagen.ancho,
        this.dimensionesImagen.alto
      );
    } catch (e) {
      console.error("Error al tocar nota:", e);

      // Intentar continuar con la siguiente nota.
      this.temporizador = setTimeout(() => {
        this.procesarSiguienteNota();
      }, 120);

      return;
    }

    // Programar la siguiente nota ligeramente antes de que acabe la actual (85% de su duración)
    // Esto crea un flujo musical continuo y orgánico en lugar de pausas robóticas
    const tiempoSiguienteMs = Math.max(150, duracionNota * 900);

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
