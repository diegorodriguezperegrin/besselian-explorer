# Reporte de Auditoría y Revisión de Código (Modelo Local LM Studio)
**Fecha:** 17/8/2026  
**Proyecto:** Cosmos Mataró — *Simulador 3D* & *Besselian Explorer*  
**Motor de Análisis:** LLM Local en LM Studio (`http://127.0.0.1:1234`)  

---

## Índice de Módulos Analizados
1. [SIM-01: Simulador 3D: Sistema de Diseño CSS, Paneles y Reset](#sim-01-simulador-3d-sistema-de-dise-o-css-paneles-y-reset)
2. [SIM-02: Simulador 3D: Controles Deslizadores, Chevrons y Modales](#sim-02-simulador-3d-controles-deslizadores-chevrons-y-modales)
3. [SIM-03: Simulador 3D: Estructura HTML del DOM de Paneles Izquierdo y Derecho](#sim-03-simulador-3d-estructura-html-del-dom-de-paneles-izquierdo-y-derecho)
4. [SIM-04: Simulador 3D: Estado Inicial, Constantes Orbitales y Calibración de Velocidades](#sim-04-simulador-3d-estado-inicial-constantes-orbitales-y-calibraci-n-de-velocidades)
5. [SIM-05: Simulador 3D: Gestión de Memoria GPU (dispose3DObject) e Inicialización Three.js](#sim-05-simulador-3d-gesti-n-de-memoria-gpu-dispose3dobject-e-inicializaci-n-three-js)
6. [SIM-06: Simulador 3D: Creación de Cuerpos Celestes, Iluminación y Mallas de Órbitas](#sim-06-simulador-3d-creaci-n-de-cuerpos-celestes-iluminaci-n-y-mallas-de-rbitas)
7. [SIM-07: Simulador 3D: Bóveda Celeste, Constelaciones, Rejilla y Guías de Precesión](#sim-07-simulador-3d-b-veda-celeste-constelaciones-rejilla-y-gu-as-de-precesi-n)
8. [SIM-08: Simulador 3D: Bucle Físico Principal y Matemáticas de Movimiento Orbital (updatePositionsAndTilts)](#sim-08-simulador-3d-bucle-f-sico-principal-y-matem-ticas-de-movimiento-orbital-updatepositionsandtilts-)
9. [SIM-09: Simulador 3D: Registro de Eventos Astronómicos (Estaciones, Fases y Eclipses)](#sim-09-simulador-3d-registro-de-eventos-astron-micos-estaciones-fases-y-eclipses-)
10. [SIM-10: Simulador 3D: Itinerario Educativo de Meses Lunares y Resonancia de Exeligmos](#sim-10-simulador-3d-itinerario-educativo-de-meses-lunares-y-resonancia-de-exeligmos)
11. [BES-01: Besselian Explorer: Catálogo de Eclipses y Estructura de Coeficientes Polinomiales](#bes-01-besselian-explorer-cat-logo-de-eclipses-y-estructura-de-coeficientes-polinomiales)
12. [BES-02: Besselian Explorer: Matemáticas del Plano Fundamental de Bessel (besselianCoordsAtTime)](#bes-02-besselian-explorer-matem-ticas-del-plano-fundamental-de-bessel-besseliancoordsattime-)
13. [BES-03: Besselian Explorer: Transformación a Coordenadas Geográficas (Lat/Lon) y Franja de Totalidad](#bes-03-besselian-explorer-transformaci-n-a-coordenadas-geogr-ficas-lat-lon-y-franja-de-totalidad)
14. [BES-04: Besselian Explorer: Líneas de Isomagnitud, Curvas de Tiempo UT y Gradiente Penumbral](#bes-04-besselian-explorer-l-neas-de-isomagnitud-curvas-de-tiempo-ut-y-gradiente-penumbral)
15. [BES-05: Besselian Explorer: Renderizado 3D de la Tierra, Texturas e Iluminación en Three.js](#bes-05-besselian-explorer-renderizado-3d-de-la-tierra-texturas-e-iluminaci-n-en-three-js)
16. [BES-06: Besselian Explorer: Motor de Reproducción Temporal y Predicciones Geográficas Locales](#bes-06-besselian-explorer-motor-de-reproducci-n-temporal-y-predicciones-geogr-ficas-locales)

---

## SIM-01: Simulador 3D: Sistema de Diseño CSS, Paneles y Reset
* **Archivo:** `simulador3D.html`
* **Módulo:** Variables CSS, sistema de diseño (--font-heading Outfit, --font-body Plus Jakarta Sans), estructura de paneles laterales (.control-panel, .settings-panel, .reopen-btn) y resets responsivos.
* **Fecha/Hora:** 18/8/2026, 4:52:51
* **Tiempo de inferencia:** 441.9s (868 tokens)

### Análisis del Modelo Local:
Este fragmento es **CSS y estructura de UI**, no contiene las fórmulas físicas ni el renderizado WebGL (que residen en JS). Por tanto, la evaluación se centra en diseño, rendimiento del DOM y usabilidad:

**1. Evaluación de Fórmulas y Lógica Físico-Matemática**
*   **No aplicable a este fragmento**: No hay ecuaciones orbitales aquí; el motor físico es JavaScript externo. El CSS solo define cómo se visualizan los resultados.

**2. Rendimiento, Memoria y Optimización WebGL/DOM**
*   **`backdrop-filter: blur(12px)`**: Es costoso en GPU (requiere un pase de desenfoque por cada frame). En una app con canvas 3D activo es aceptable para un solo panel, pero no debe extenderse a elementos dinámicos.
*   **Selección global `user-select: none`**: **Problema**. Desactiva la selección de texto en toda la página —los usuarios no pueden copiar valores ni leer detenidamente las etiquetas—. Debería aplicarse solo a controles interactivos, nunca al body o a textos informativos.
*   **Unidades mixtas (px y rem)**: Se usan ambos sin definir `font-size` base en html/body; esto puede causar inconsistencias visuales entre navegadores sobre la densidad de píxeles.

**3. Casos Límite y Robustez**
*   **Accesibilidad**: Los inputs no tienen `<label>` asociados (solo texto decorativo), lo que los hace inoperables para lectores de pantalla. El contraste en `.text-secondary` es bajo contra el fondo oscuro.
*   **Layout fijo `100vh`/`overflow: hidden`**: En móviles, la barra del navegador puede ocultar elementos superiores al redimensionarse; una unidad más robusta sería `dvh`.
*   **Falta de estados `:focus-visible`**: Los sliders no tienen indicador visual para navegación por teclado.

**4. Veredicto y Recomendaciones Clave**
*   **Eliminar `user-select: none` global**. Si se desea evitar la selección accidental en controles, aplicarlo selectivamente a los elementos interactivos (`input`, `.button`).
*   **Añadir etiquetas `<label>` reales**, aunque sean visualmente ocultas (clase `.sr-only`), para cumplir con WCAG y mejorar la semántica.
*   **Unificar unidades de diseño**: Definir un `font-size` base en html y usar rem, o estandarizar el panel a una sola unidad para evitar desfases de alineación entre navegadores.

---

## SIM-02: Simulador 3D: Controles Deslizadores, Chevrons y Modales
* **Archivo:** `simulador3D.html`
* **Estado:** ERROR / TIMEOUT en la llamada al modelo local.
* **Detalle:** Timeout de inactividad: no se recibieron tokens durante 300s

---

## SIM-02: Simulador 3D: Controles Deslizadores, Chevrons y Modales
* **Archivo:** `simulador3D.html`
* **Módulo:** Estilos de controles (.control-row, input[type=range], .checkbox-row, subpaneles de precesión), ventana modal de fenómenos físicos y animaciones de rotación de chevrons.
* **Fecha/Hora:** 18/8/2026, 10:04:46
* **Tiempo de inferencia:** 262.9s (583 tokens)

### Análisis del Modelo Local:
1. **Evaluación Físico-Matemática**: Este fragmento es puramente presentación CSS; no contiene fórmulas físicas ni cálculos astronómicos, por lo que la lógica de simulación está desacoplada del DOM y el rendimiento visual no se ve afectado por complejidad matemática en esta capa.

2. **Rendimiento y WebGL/DOM**: El `backdrop-filter: blur(12px)` sobre `.camera-presets` es costoso (requiere un buffer offscreen) y puede generar microstutter durante transiciones de cámara rápidas; el resto son propiedades estándar sin impacto en el loop de renderizado de WebGL.

3. **Casos Límite y Robustez**: Los anchos fijos (`118px`/`40px`) pueden romper el diseño si las etiquetas o valores se alargan (ej: "Precession Rate" vs "Mass"); `-webkit-appearance: none` no cubre Firefox, que requiere `-moz-appearance`.

4. **Recomendaciones Clave**: Sustituir anchos fijos por `min-content`/`max-content` para evitar desbordamientos; añadir el fallback `-moz-appearance`; debundear cualquier listener JS vinculado a los sliders para evitar cálculos redundantes en cada frame de interacción.

---

## SIM-03: Simulador 3D: Estructura HTML del DOM de Paneles Izquierdo y Derecho
* **Archivo:** `simulador3D.html`
* **Módulo:** Estructura semántica HTML de Parámetros Orbitales, Reproducción, Capas y botones flotantes de reapertura.
* **Fecha/Hora:** 18/8/2026, 10:16:58
* **Tiempo de inferencia:** 727.4s (995 tokens)

### Análisis del Modelo Local:
**1) Rigor físico/matemático**: El modelo es excelente — incluye los parámetros correctos para el sistema Tierra-Luna: oblicuidad terrestre ($23.4^\circ$), inclinación lunar ($\sim5.1^\circ$), excentricidad lunisolar ($0.055$) y rotura de simetría por marea (rotación síncrona). Las fórmulas en los tooltips son precisas: la precesión axial escala con $M/r^3$ (torque de marea), la de nodos con $\Omega \propto M/(r^3 n)$ y la de ábsides es efectivamente el doble que la de nodos ($\sim8.9$ años).

**2) Rendimiento WebGL/DOM**: El DOM es pequeño, así que los handlers inline no penalizan; cada `oninput` dispara una actualización O(1) sobre un solo valor por frame — coste despreciable. Las capas (órbita, eclíptica, ejes) deben renderizarse con banderas de visibilidad (`visible`) en el shader o mediante uniformos, **no** eliminando/añadiendo elementos del DOM, para evitar re-subidas de buffers a la GPU cada vez que se marca una casilla.

**3) Casos límite y robustez**: Los rangos son seguros: excentricidad $[0, 0.25]$ (siempre $<1$), amplitudes de nutación hasta $15^\circ$ (real $\sim9.2^s$). El estado `disabled` en los controles anidados evita entradas inválidas cuando la función está apagada. Un riesgo técnico menor: si la excentricidad se acerca a cero, las coordenadas polares simples pueden producir jitter visual; usar elementos keplerianos para el trazado de órbitas es más estable numéricamente.

**4) Recomendaciones clave**:
- **Renderizado condicional**: Controlar visibilidad con un uniform `u_showOrbits` en lugar de manipular el DOM, manteniendo todos los objetos cargados pero no dibujados.
- **Modo "Realista" vs "Visual"**: Añadir un toggle global; la malla del plano eclíptico es densa y puede saturar pantallas pequeñas si se muestra siempre junto a las constelaciones.
- **Contextualización temporal**: Mostrar los periodos orbitales reales (13m para la Luna, 365d para la Tierra) como texto de referencia; ayuda al usuario a interpretar qué significa "Aceleración temporal: 2x".

---

## SIM-04: Simulador 3D: Estado Inicial, Constantes Orbitales y Calibración de Velocidades
* **Archivo:** `simulador3D.html`
* **Módulo:** Objeto BASE_SPEEDS (precessionEarth: 0.002, precessionMoon: 0.003, apsidesMoon: 0.001), multiplicadores de velocidad, ángulos astronómicos (obliqEarth, incMoon, eccMoon) y flags de estado.
* **Fecha/Hora:** 18/8/2026, 10:25:28
* **Tiempo de inferencia:** 506.2s (659 tokens)

### Análisis del Modelo Local:
**1) Rigor físico/matemático**: El algoritmo de PCSS es conceptualmente correcto — estima la profundidad media del bloqueador mediante muestreo Poisson y escala el radio de filtrado por distancia relativa `(zReceiver - avgBlockerDepth)/zReceiver`, lo que genera penumbras más anchas para oclusores lejanos. La detección de `-1` evita divisiones por cero cuando no hay bloqueadores.

**2) Rendimiento y WebGL**: El coste es elevado: 34 lecturas de textura por fragmento (17 en `findBlocker` + 17 en PCF). Ejecutar `initPoissonSamples` cada frame para cada píxel degrada el rendimiento; el disco debería precomputarse una sola vez como array uniform.

**3) Casos límite y robustez**: Falta un término de bias, lo que puede producir "shadow acne" a ángulos rasantes. El radio del filtro sin límite superior genera banding en mapas de sombra de baja resolución. `unpackRGBAToDepth` requiere que la textura sea RGBA32Float; una DepthTexture estándar requeriría código distinto.

**4) Recomendaciones clave**: Precomputar el disco Poisson y pasarlo como uniform (ganancia ~10-50% en rendimiento). Añadir un pequeño bias al cálculo de profundidad para mitigar artefactos visuales. Considerar fallback a PCF simple cuando el radio sea muy grande o para objetos distantes.

---

## SIM-05: Simulador 3D: Gestión de Memoria GPU (dispose3DObject) e Inicialización Three.js
* **Archivo:** `simulador3D.html`
* **Módulo:** Funciones de liberación de memoria VRAM (dispose3DObject, disposeMaterial), eventos webglcontextlost / webglcontextrestored y setup del WebGLRenderer.
* **Fecha/Hora:** 18/8/2026, 11:46:32
* **Tiempo de inferencia:** 389.1s (645 tokens)

### Análisis del Modelo Local:
**1. Rigor físico-matemático:** Correcto. `raDecToWan` proyecta RA/Dec sobre la esfera celeste mediante coordenadas esféricas estándar con corrección de oblicuidad (`applyAxisAngle`), lo que sitúa las constelaciones en su posición astronómica real respecto al Sol (centro). El catálogo usa magnitudes reales y nombres científicos, aportando fidelidad científica.

**2. Rendimiento WebGL/DOM:** Eficiente. Agrupa todas las estrellas en un único `Points` con una sola llamada de dibujo (`drawCall`), usando `BufferGeometry`. La transparencia y el `sizeAttenuation` son adecuados para la escala; sin embargo, demasiados puntos transparentes podrían generar artefactos por orden de profundidad (poco crítico aquí dada la baja densidad).

**3. Casos límite y robustez:** Incluye manejadores críticos: `webglcontextlost`/`restored`, esenciales en móviles y iframes donde el contexto puede caerse; reanuda con `resetSimulation`. El uso de `requestAnimationFrame` garantiza un timestamp válido para cálculos temporales sin saltos.

**4. Recomendaciones clave:**
- Sustituir el listener `'resize'` por un **ResizeObserver**, que es más preciso y evita ráfagas de redibujado durante el arrastre del usuario.
- Añadir una propiedad `emissive` al material de las estrellas para que brillen contra fondos oscuros sin depender solo de la iluminación ambiental (que ya está en 0.08).

---

## SIM-06: Simulador 3D: Creación de Cuerpos Celestes, Iluminación y Mallas de Órbitas
* **Archivo:** `simulador3D.html`
* **Módulo:** Construcción del Sol (con PointLight), Tierra (textura NASA, inclinación axial), Luna, órbita lunar elíptica con nodos y líneas de ábsides.
* **Fecha/Hora:** 18/8/2026, 11:56:45
* **Tiempo de inferencia:** 609.2s (821 tokens)

### Análisis del Modelo Local:
1) **Evaluación Físico-Matemática**: La jerarquía de grupos es brillante: cada cuerpo tiene su propio grupo de inclinación axial y precesión, permitiendo que la Tierra gire sobre un eje inclinado 23.5° y la Luna mantenga su propia oblicuidad (~1.54°) respecto a la eclíptica independientemente del movimiento terrestre. El Sol usa `MeshBasicMaterial` (no necesita iluminación) con una corona de brillo aditivo, lo cual es físicamente coherente como aproximación visual.

2) **Rendimiento y WebGL/DOM**: La función recursiva `dispose3DObject` es crítica en WebGL; sin ella cada recreación dejaría texturas y geometrías huérfanas en la VRAM (memory leak). El mapa de sombras 2048x2048 con bias `-0.0003` mitiga el "shadow acne" típico a estas escalas. `linewidth: 2` no es respetado por WebGL pero es inofensivo para líneas decorativas.

3) **Casos Límite y Robustez**: El frustum de la sombra (`near=20`, `far=130`) está ajustado al radio orbital; si el objeto se acerca a 20 o supera los ~65, la resolución del mapa de sombras decae por linealidad en profundidad. La recursión sobre `children` maneja correctamente las múltiples capas de grupos anidados sin omitir ningún recurso.

4) **Recomendaciones Clave**:
- Simplificar: usa una sola luz para sombras y deja el `PointLight` solo como iluminación global suave; la dualidad actual funciona pero es redundante.
- Para escenas grandes, sustituye la cámara de sombra por una ortogonal (`Orthographic`) para evitar distorsión por perspectiva a gran distancia.
- Si añades más cuerpos celestes, usa un único `InstancedMesh` para las estrellas en lugar de objetos individuales (reduce cientos de draw calls a uno).

---

## SIM-07: Simulador 3D: Bóveda Celeste, Constelaciones, Rejilla y Guías de Precesión
* **Archivo:** `simulador3D.html`
* **Módulo:** Starfield de estrellas, líneas de constelaciones, rejilla celeste esférica, círculo de precesión axial y cruz de proyección polar.
* **Fecha/Hora:** 18/8/2026, 12:07:32
* **Tiempo de inferencia:** 643.0s (711 tokens)

### Análisis del Modelo Local:
1. **Rigor Físico**: La fórmula del sector de eclipse es geométricamente correcta — proyecta la sección transversal del cono de umbra sobre el plano eclíptico a distancia $D_{EM}$ y resuelve para el ángulo central $\Delta\lambda$ donde la Luna entra/sale; usar radios 3D reales mantiene la física independiente de la escala visual.

2. **Rendimiento WebGL**: Recrear geometrías (`remove`/`add`) en cada frame provoca basura GC y microstutter; es mejor actualizar atributos existentes con `geometry.attributes.position.needsUpdate = true`. Las múltiples líneas pequeñas deberían consolidarse en menos BufferGeometries compartiendo un único array de posiciones donde sea posible para reducir draw calls.

3. **Casos Límite**: El guardado `< 1e-6` evita la división por cero cuando $\sin(i) \approx 0$ (baja inclinación); sin embargo, si `moonOrbitRadius * Math.sin(i)` es muy pequeño en geometrías extremas el denominador puede colapsar — añadir un umbral mínimo explícito antes de dividir protege contra valores NaN inesperados.

4. **Recomendaciones**: Sustituir la creación/destrucción por actualizaciones de atributos; consolidar líneas del horizonte y ejes en menos objetos BufferGeometry; usar `LineSegments` para el círculo de precesión si se desea un aspecto más definido que `LineLoop`.

---

## SIM-08: Simulador 3D: Bucle Físico Principal y Matemáticas de Movimiento Orbital (updatePositionsAndTilts)
* **Archivo:** `simulador3D.html`
* **Módulo:** Cálculo de posiciones 3D de Tierra y Luna, precesión axial (rotación sobre normal eclíptica), nutación (cabeceo periódico), precesión regresiva de nodos y rotación de ábsides.
* **Fecha/Hora:** 18/8/2026, 12:17:48
* **Tiempo de inferencia:** 611.8s (617 tokens)

### Análisis del Modelo Local:
1. **Rigor físico**: Nutación simplificada pero funcional (ciclo lunar de 18.6 años vía `precessionMoon`); vector del eje terrestre bien derivado desde coordenadas esféricas; las constelaciones son aproximaciones visuales sobre R=1200, no un catálogo estelar real.

2. **Rendimiento/WebGL**: Geometría única para la malla celeste (~360 vértices), shader con fade suave en el borde (smoothstep 300-1500); las inyecciones de código son seguras pero se podrían centralizar fuera del bucle de renderizado.

3. **Casos límite**: Evita singularidad por eje vertical (`abs(axisDir.y) > 0.999`) antes del producto cruz; la dependencia implícita en que los `#include` existan podría fallar silenciosamente si el shader base cambia sin aviso.

4. **Recomendaciones**: Reutilizar objetos `Vector3` (evitar nuevas instanciaciones por frame); usar InstancedMesh para las estrellas/líneas si aumenta la escala; mover la construcción de shaders fuera del ciclo de creación de objetos.

---

## SIM-09: Simulador 3D: Registro de Eventos Astronómicos (Estaciones, Fases y Eclipses)
* **Archivo:** `simulador3D.html`
* **Módulo:** Detección geométrica de equinoccios, solsticios, alineaciones de eclipse (nodos en eje Sol-Tierra) y logging dinámico en panel de eventos.
* **Fecha/Hora:** 18/8/2026, 12:27:37
* **Tiempo de inferencia:** 585.5s (645 tokens)

### Análisis del Modelo Local:
1) **Rigor físico**: Kepler's equation solved via Newton (5 iterations), orbital plane to ecliptic rotation through argument of perigee, and nutation as a 18.6-year lunar perturbation — all standard and correct for visualization.

2) **Rendimiento WebGL**: Rebuilding `moonOrbitLine` geometry (`setFromPoints`) every frame is costly (GPU buffer re-upload); the eclipse sectors mesh's shape may become stale since it isn't updated when orbit parameters change; canvas texture generation should be cached, not redrawn per frame.

3) **Casos límite**: The Kepler denominator `1 - e * cos(E)` can approach zero for high eccentricity (not an issue here: lunar e ≈ 0.0549); the fixed ecliptic grid is static and doesn't need recomputation; fewer than 72 segments may alias at low resolutions.

4) **Recomendaciones**: Cache static geometries (`regLines`, `primeLines`) as immutable buffers; only rebuild dynamic ones on parameter change; use a single BufferGeometry with attribute offsets for time-varying positions instead of rebuilding geometry each frame.

---

## SIM-10: Simulador 3D: Itinerario Educativo de Meses Lunares y Resonancia de Exeligmos
* **Archivo:** `simulador3D.html`
* **Módulo:** Motor del tour guiado (mes sinódico, sidéreo, anomalístico, draconítico, tropical) y cálculo de resonancia entera del ciclo Exeligmos (3 Saros = 669 meses).
* **Fecha/Hora:** 18/8/2026, 13:05:32
* **Tiempo de inferencia:** 399.9s (762 tokens)

### Análisis del Modelo Local:
1. **Evaluación Físico-Matemática**: Los valores de referencia son órdenes de magnitud correctos para un simulador visual (excentricidad lunar ~0.055, oblicuidad terrestre 23.4°, amplitud de nutación ~2°). No es una efeméride de alta precisión pero funciona bien pedagógicamente. El reset devuelve todos los parámetros a valores estándar coherentes tras cada reinicio del tour.

2. **Rendimiento y WebGL/DOM**: Múltiples `document.getElementById` en el flujo crítico; cachear estos elementos una sola vez mejora la velocidad de ejecución. La recreación completa del universo (`createUniverse`) es costosa — debe invocarse solo tras acciones explícitas (reset, cambio radical), no en cada resize o frame. Las manipulaciones inline de `display: none/flex` provocan reflows; para transiciones suaves usa clases CSS y opacidad.

3. **Casos Límite y Robustez**: Los límites fijos del shadow camera (`near=20`, `far=130`) pueden causar artefactos visuales (clipping) si la Luna se desplaza fuera de ese volumen durante las animaciones de eclipse; ampliar el far plane o usar una cámara dinámica es más robusto. El código ya incluye comprobaciones defensivas para elementos opcionales (`if(gridSlider)`), lo cual previene errores en configuraciones mínimas.

4. **Recomendaciones Clave**:
- Cachear los selectores DOM al inicio del módulo y evitar búsquedas repetidas por ID.
- Debounceear cualquier evento que reinicie la escena (resize, cambios de escala) para no saturar el hilo principal.
- Expandir ligeramente las dimensiones de la cámara de sombras o usar una caja dinámica en lugar de valores fijos para evitar artefactos durante eclipses.

---

## BES-01: Besselian Explorer: Catálogo de Eclipses y Estructura de Coeficientes Polinomiales
* **Archivo:** `besselianexplorer.html`
* **Módulo:** Estructura de datos PRESET_ECLIPSES, polinomios besselianos (x, y, d, mu, l1, l2) y parámetros de Saros.
* **Fecha/Hora:** 18/8/2026, 15:03:27
* **Tiempo de inferencia:** 529.8s (733 tokens)

### Análisis del Modelo Local:
1. **Rigor físico-matemático**: Los parámetros son coeficientes besselianos estándar para predecir eclipses desde el siglo XIX hasta catálogos modernos; los valores de gamma y duración coinciden con eclipses reales (2026 T, 2028 A). La estructura permite calcular tiempos de contacto en cualquier latitud/longitud mediante trigonometría esférica —método correcto para un visualizador global—.

2. **Rendimiento y WebGL**: `antialias` activo con `pixelRatio` topado a 2 (bueno para pantallas Retina sin sobrecarga); `OrbitControls` con amortiguación; iluminación direccional simulando el Sol. El único riesgo es la falta de mipmaps explícitos en la textura base64, aunque WebGL suele generarlos automáticamente si no se especifica lo contrario.

3. **Casos límite y robustez**: Fallback silencioso para `OrbitControls` cuando falta (evita crash pero desactiva interacción sin aviso); `minDistance: 70` impide que la cámara atraviese el globo; no hay manejo de errores sobre la cadena Base64 ni sobre redimensionado del canvas.

4. **Recomendaciones clave**: Añadir un listener para `resize` (actualizar aspect y tamaño del renderer), incluir un shader simple que oscurezca el lado nocturno (`dot(normal, sunDir)`) en lugar de solo luz ambiental, y validar la longitud antes de proyecciones esféricas para evitar singularidades en los polos.

---

## BES-02: Besselian Explorer: Matemáticas del Plano Fundamental de Bessel (besselianCoordsAtTime)
* **Archivo:** `besselianexplorer.html`
* **Módulo:** Evaluación de polinomios en función del tiempo t (horas desde t0), cálculo de posición de la sombra (x,y), declinación solar d, ángulo horario Greenwich mu y radios L1/L2.
* **Fecha/Hora:** 18/8/2026, 17:10:55
* **Tiempo de inferencia:** 271.9s (605 tokens)

### Análisis del Modelo Local:
1. **Físico-Matemático**: Implementa la proyección del plano fundamental de Bessel (x=sin lat·cos lon, y=sin lat·sin lon) para proyectar un círculo sobre una esfera; el test `dot(vLocalPosition, uSunDir)` limita correctamente la sombra a la cara diurna.

2. **Rendimiento/WebGL**: Un ShaderMaterial con geometría compartida es eficiente; TextureLoader asíncrono evita bloqueos y las banderas `.needsUpdate` son correctas tras cargar la textura base64.

3. **Casos Límite**: `uSunDir=(0,0,1)` fija el Sol en el cenit — si se mueve fuera del zenit la proyección falla; añadir un epsilon antes de dividir por sin(lat) evitaría singularidades polares cuando rL2 es pequeño.

4. **Recomendaciones**: Actualizar dinámicamente `uSunDir` según la posición solar real (no hardcodear); usar InstancedMesh si se añaden más etiquetas; añadir un margen mínimo a los denominadores en el shader para robustez numérica.

---

## BES-03: Besselian Explorer: Transformación a Coordenadas Geográficas (Lat/Lon) y Franja de Totalidad
* **Archivo:** `besselianexplorer.html`
* **Módulo:** Proyección inversa del plano fundamental a la esfera terrestre, cálculo del eje del cono de sombra, límites norte/sur de totalidad/anularidad y duración local.
* **Fecha/Hora:** 18/8/2026, 17:20:01
* **Tiempo de inferencia:** 541.8s (815 tokens)

### Análisis del Modelo Local:
1. **Rigor físico-matemático**: Implementa el método de Meeus para geometría solar con precisión astronómica real. La corrección Delta T (-1.0027379 * dt/240) convierte tiempo dinámico a UT y la proyección geodésica WGS84 (factor 1.00336409 sobre tan(beta)) es lo que se necesita para mapear una esfera sobre un elipsoide sin distorsión en los polos.

2. **Rendimiento WebGL**: Dos mallas de sombra son aceptables; la descartada fuera de L1 mantiene bajo el conteo de fragmentos. Papa.parse con `worker: true` desplaza el parsing del CSV (que puede ser grande) a un hilo separado, evitando bloqueos en el main thread durante la carga inicial.

3. **Casos límite y robustez**: Protecciones críticas contra NaN: `Math.max(0, 1-r2)` evita raíces negativas antes de acos/asin y beta se clampa a [-1,1]. El fallback de datos (local → CDN → presets) garantiza que la app arranque siempre; el chequeo r^2 > 1.001 descarta silenciosamente filas corruptas en lugar de propagar errores.

4. **Recomendaciones**:
- Unificar las dos mallas de sombra en una sola con un shader que varíe color/alpha por uniformes (un solo draw call, código más limpio).
- Añadir un listener real para `webglcontextlost` que recree texturas y buffers tras la pérdida.
- El factor WGS84 es fijo; si se requiere precisión sub-metro en latitudes extremas usaría el formulario geodésico completo (G1), pero para visualización esto basta.

---

## BES-04: Besselian Explorer: Líneas de Isomagnitud, Curvas de Tiempo UT y Gradiente Penumbral
* **Archivo:** `besselianexplorer.html`
* **Módulo:** Trazado de curvas de igual magnitud (0.2 a 0.8), curvas horarias UT, elipses de penumbra instantánea y renderizado sobre Canvas 2D.
* **Fecha/Hora:** 18/8/2026, 17:31:35
* **Tiempo de inferencia:** 689.8s (995 tokens)

### Análisis del Modelo Local:
**1) Rigor Físico-Matemático:** El cálculo del camino de la sombra usa r0, v=(x1-x0, y1-y2), l10=0.54 para el radio de penumbra y tClosest = -r0·v / |v|^2; es la aproximación lineal estándar (elipse de sombra sobre esfera) y las fórmulas son correctas. El valor fijo l10≈0,54 asume radios solar/lunar típicos —válido para eclipses totales/anulares pero menos preciso en parciales donde el ancho penumbral varía mucho; como visualización es aceptable.

**2) Rendimiento y WebGL/DOM:** La graticula genera ~120 vértices por paralelo más meridianos (unas pocas cientos), despreciable para GPUs modernas. Las funciones `dispose` son exhaustivas: liberan geometría, arrays de materiales y texturas recursivamente —patrón Three.js correcto para evitar fugas en VRAM tras cambiar escenas—. El uso de innerText evita inyecciones XSS y es más rápido que innerHTML.

**3) Casos Límite y Robustez:** Protege contra división por cero con `v2=0` (fallback rMin_sq, deltaT); el bucle de normalización UT (`totalSec += 86400`) maneja correctamente desfases negativos comunes en datos astronómicos. **Bug detectado**: `dispose3DObject(obj.children[0])` solo libera el primer hijo; si hay múltiples objetos hijos la recursión debe ser un bucle sobre todos los hijos para no dejar geometría huérfana.

**4) Recomendaciones Clave:**
- Cambiar a `for (let child of obj.children)` en `dispose3DObject` para liberar **todos** los hijos, no solo el primero.
- Para múltiples líneas de graticula usar un único BufferGeometry con offsetMatrix o InstancedMesh si la cantidad crece; aquí es menor pero buena práctica.
- Añadir una advertencia visual cuando se use l10 fijo en eclipses parciales (donde la geometría real diverge).

---

## BES-05: Besselian Explorer: Renderizado 3D de la Tierra, Texturas e Iluminación en Three.js
* **Archivo:** `besselianexplorer.html`
* **Módulo:** Esfera terrestre con texturas dinámicas, atmósfera, marcador de punto subsolar, modos de iluminación (solar realista vs luz global blanca).
* **Fecha/Hora:** 18/8/2026, 17:43:10
* **Tiempo de inferencia:** 691.0s (672 tokens)

### Análisis del Modelo Local:
1. **Rigor físico-matemático**: Implementa geometría de eclipse besseliana (trayectoria, ancho de penumbra $l_0$, isolíneas de magnitud) mediante proyecciones sobre la superficie terrestre y corrección por velocidad orbital; el buscador bisectante de 40 iteraciones garantiza precisión subpíxel en las intersecciones del borde.

2. **Rendimiento WebGL**: Genera múltiples objetos `THREE.Line` (uno por segmento); para escenas con muchos elementos conviene consolidar líneas en un único `BufferGeometry` con atributos de tipo, reduciendo draw calls; la gestión explícita de memoria (`dispose3DObject`) es correcta y evita fugas de texturas/geometrías.

3. **Casos límite**: Protegidos contra divisiones por cero (vlen), valores rMin negativos y geometrías degeneradas ($l_2 \approx 0$); el patrón de detección de cruce de borde (`prev.r2 > 1`) evita duplicados en los vértices de unión sin perder la intersección exacta.

4. **Recomendaciones**: Consolidar las líneas en menos objetos WebGL; usar un shader con atributos por tipo para dibujar todas las trayectorias en una pasada; precalcular isolíneas si no cambian dinámicamente durante el renderizado.

---

## BES-06: Besselian Explorer: Motor de Reproducción Temporal y Predicciones Geográficas Locales
* **Archivo:** `besselianexplorer.html`
* **Módulo:** Timeline interactivo (animación de la sombra t), interpolación suave, cálculo de circunstancias locales (C1, C2, Max, C3, C4) y gestión de eventos de usuario.
* **Fecha/Hora:** 18/8/2026, 17:55:00
* **Tiempo de inferencia:** 706.2s (732 tokens)

### Análisis del Modelo Local:
1. **Rigor físico/matemático**: Implementa geometría de eclipses besseliana (x0–3, y0–3, l10, l11) con bisección para el contacto en el limbo r=|1±l1| — estándar NASA/Espenak. El cálculo del máximo usa la aproximación analítica de Espenak sobre una malla densa (~7s por paso), lo que da precisión sub-arcosegundo.

2. **Rendimiento y WebGL**: Dos bucles pesados (bisección + barrido Espenak) se ejecutan cada render — deberían precomputarse una vez por eclipse, no en el loop principal. `createSegmentedLine` probablemente crea geometrías nuevas continuamente; lo ideal es un único BufferGeometry con muchos segmentos o InstancedMesh para las líneas de magnitud.

3. **Casos límite y robustez**: La bisección tiene 35 iteraciones fijas (garantiza convergencia sin bucles infinitos) y protege `RMid===0`. El redondeo a intervalos de media hora en UT maneja bien duraciones cortas; el margen +0.005 en la condición del limbo evita descartar puntos por precisión numérica.

4. **Recomendaciones**: Cachear las geometrías una sola vez tras cargar los datos (no regenerarlas cada frame); consolidar todas las líneas de magnitud en un único BufferGeometry con múltiples segmentos; precalcular el camino del máximo y contactos fuera del loop principal para liberar ciclos de renderizado.

---
