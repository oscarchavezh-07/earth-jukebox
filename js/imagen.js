
class Imagen {
    constructor(canvasId, umbral, tamMinimo) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");

        this.img = new Image();

        this.ancho = 0;
        this.alto = 0;

        this.umbral = umbral;
        this.tamMinimo = tamMinimo;
        this.cargada = false;
    }

    // Carga una imagen y la dibuja en el canvas.
    cargar(ruta) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                this.ancho = img.naturalWidth;
                this.alto = img.naturalHeight;

                this.canvas.width = this.ancho;
                this.canvas.height = this.alto;

                this.ctx.drawImage(
                    img, 0, 0, this.ancho, this.alto
                );

                this.cargada = true;
                resolve(this);
            };

            img.onerror = () => {
                reject(new Error("No se pudo cargar la imagen"));
            };

            img.src = ruta;
        });
    }

    // Obtiene los píxeles de una región rectangular.
    obtenerRegion(x, y, ancho, alto) {
        if (!this.cargada) {
            throw new Error("La imagen no está cargada");
        }

        if (
            x < 0 || y < 0 ||
            ancho <= 0 || alto <= 0 ||
            x + ancho > this.ancho ||
            y + alto > this.alto
        ) {
            throw new Error("Región fuera de los límites");
        }

        return this.ctx.getImageData(
            x, y, ancho, alto
        );
    }

    // Analiza el color promedio y la variación de una región.
    analizarRegion(imgData, ancho, alto) {
        const datos = imgData.data;
        const n = ancho * alto;

        let sumaR = 0;
        let sumaG = 0;
        let sumaB = 0;

        // Primer recorrido: promedio RGB.
        for (let i = 0; i < datos.length; i += 4) {
            sumaR += datos[i];
            sumaG += datos[i + 1];
            sumaB += datos[i + 2];
        }

        const promedio = {
            r: sumaR / n,
            g: sumaG / n,
            b: sumaB / n
        };

        // Segundo recorrido: variación respecto al promedio.
        let varianza = 0;

        for (let i = 0; i < datos.length; i += 4) {
            const dr = datos[i] - promedio.r;
            const dg = datos[i + 1] - promedio.g;
            const db = datos[i + 2] - promedio.b;

            varianza += dr * dr + dg * dg + db * db;
        }

        varianza /= n;

        return {
            promedio,
            varianza,
            variacion: Math.sqrt(varianza)
        };
    }

    // Obtiene el análisis completo de una región.
    analizar(x, y, ancho, alto) {
        const imgData = this.obtenerRegion(
            x, y, ancho, alto
        );

        return this.analizarRegion(
            imgData, ancho, alto
        );
    }

    // Determina si una región debe ser hoja.
    esHoja(variacion, ancho, alto, umbral, minSize = 8) {
        return (
            variacion < umbral ||
            ancho <= minSize ||
            alto <= minSize
        );
    }

    // Determina cómo dividir una región según la profundidad.
    obtenerDivision(x, y, ancho, alto, profundidad) {
        if (profundidad % 2 === 0) {
            // Corte vertical.
            const mitad = Math.floor(ancho / 2);

            return {
                tipo: "vertical",
                izquierda: {
                    x, y,
                    ancho: mitad,
                    alto
                },
                derecha: {
                    x: x + mitad,
                    y,
                    ancho: ancho - mitad,
                    alto
                }
            };
        }

        // Corte horizontal.
        const mitad = Math.floor(alto / 2);

        return {
            tipo: "horizontal",
            izquierda: {
                x, y,
                ancho,
                alto: mitad
            },
            derecha: {
                x,
                y: y + mitad,
                ancho,
                alto: alto - mitad
            }
        };
    }

    // Devuelve dimensiones de la imagen.
    obtenerDimensiones() {
        return {
            ancho: this.ancho,
            alto: this.alto
        };
    }
}
