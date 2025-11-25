# Guía simple paso a paso – Simulador PI de inflado de neumáticos

## 1. ¿Qué es este simulador?

Este simulador permite observar cómo un **controlador PI** regula la presión de un neumático para alcanzar un valor deseado y mantenerse dentro de una banda aceptable, incluso cuando se produce una fuga de aire (leak).

Está pensado como herramienta didáctica para visualizar en tiempo real los conceptos de control automático.

A diferencia de modelos ideales, este simulador incorpora limitaciones físicas que atenúan comportamientos extremos, permitiendo una representación más fiel de un sistema neumático real.

---

## 2. Cómo ejecutar el simulador

1. Descargar los documentos `index.html`, `styles.css` y `script.js` en una misma carpeta en su ordenador.
  
2. Abrir el archivo `index.html` en cualquier navegador (Chrome, Edge, Firefox, etc.).

3. Aparecerá una pantalla con:

   * Controles en la parte superior.
   * Gráficos en la parte inferior.

4. Configurar los parámetros deseados.

5. Presionar el botón **Iniciar**.

La simulación comienza automáticamente.

PD: A lo largo de la simulación, se pueden modificar: la presión de referencia, las ganancias del controlador y las perturbaciones.

---

## 3. Parámetros que puede modificar el docente

### Control principal

* **Presión objetivo (PSI):** valor que el sistema intenta alcanzar. 
* **Kp:** ganancia proporcional (define qué tan rápido responde).
* **Ki:** ganancia integral (corrige el error residual).

### Simulación

* **Ruido σ:** simula imperfecciones del sensor.
* **Tiempo total:** duración de la simulación.
* **dt:** paso temporal del cálculo.

### Perturbación

* **Valor leak:** intensidad de la fuga simulada.
* **Duración leak:** cuánto tiempo actúa la fuga.

### Inicialización

* **Presión inicial:** valor desde el cual parte el sistema. (Recomendamos iniciar con un numero entre 100 y 110 PSI)

---

## 4. Qué hace el sistema internamente

En cada instante de tiempo el simulador realiza:

1. Mide la presión actual con ruido (sensor).
2. Calcula el error con respecto a la presión objetivo.
3. El controlador PI genera una señal de control.
4. El sistema modifica su presión en función de esa señal.
5. Si hay leak activo, se resta presión adicionalmente.

Este proceso se repite muchas veces por segundo y se grafica en tiempo real.

---

## 5. Cómo interpretar los gráficos

### Presión P(t)

Muestra la evolución de la presión real del neumático.

* Banda sombreada: rango aceptable 115 – 130 PSI.
* Línea roja: valor actual de la presión.

### Error e(t)

Diferencia entre presión deseada y medida.

### u(t)

Señal de control generada por el controlador PI.

### leak(t)

Fuga aplicada como perturbación externa.

### f(t)

Presión medida por el sensor (con ruido).

### Presión de referencia

Valor de presión que se quiere mantener en el sistema

---

## 6. Cómo probar la perturbación leak

1. Iniciar la simulación.
2. Esperar a que la presión se estabilice.
3. Presionar **Aplicar leak**.
4. Observar cómo:

   * La presión desciende.
   * El controlador corrige para recuperarla.
   * La presión vuelve al valor objetivo.

Esto permite evaluar el rechazo a perturbaciones.

---

## 7. Casos sugeridos para evaluación

Los siguientes valores fueron ajustados según el comportamiento real observado en el simulador:

### 🟢 Caso estable
Kp = 0.6  
Ki = 0.04  
→ Llegada progresiva al setpoint, sin sobreimpulso ni oscilaciones.

---

### 🟡 Caso rápido
Kp = 1.5  
Ki = 0.07  
→ Respuesta más veloz que el caso estable, con leve tendencia a sobreimpulso pero aún controlada.

---

### 🔴 Caso agresivo
Kp = 3.5  
Ki = 0.15  
→ Sobreimpulso evidente y pequeña oscilación inicial antes de estabilizarse.

Este caso muestra claramente los efectos de una ganancia proporcional elevada (En sistemas reales, el sobreimpulso no se manifiesta salvo con ganancias excesivas debido a la inercia del proceso).


---

## 8. Objetivo pedagógico

Este simulador permite al docente:

* Visualizar la respuesta de un sistema controlado
* Analizar estabilidad
* Observar efectos de perturbaciones
* Comprender la influencia de Kp y Ki

---

## 9. Recomendación para la evaluación

Se sugiere modificar los parámetros PI y aplicar el leak en distintos momentos para observar la capacidad del sistema de recuperar la presión deseada y mantenerse dentro de la banda especificada.

---

✍ Alumnos: Gianlucca Santucho, María Lucía Gandur

📚 Asignatura y Curso: Teoría de Control K4521

🏫 Universidad Tecnológica Nacional 2025

