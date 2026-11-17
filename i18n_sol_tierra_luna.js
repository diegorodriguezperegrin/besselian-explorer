/* =========================================================================
   COSMOS MATARÓ - DICCIONARIO i18n (ES / CA / EN)
   Para sistema_sol-tierra-luna.html (+ simulador3d_engine.js / widgets.js)
   ========================================================================= */
(function () {
  'use strict';

  const HELP_MODAL_CA = `
    <button id="help-close-btn" onclick="toggleHelp()" title="Tancar"><i class="fa-solid fa-xmark"></i></button>
    <div>
      <h2><i class="fa-solid fa-book-open" style="margin-right: 8px; color: var(--solar-yellow);"></i> Guia de Fenòmens Físics</h2>
      <p class="note">Simulador 3D Terra–Lluna–Sol &middot; Cosmos Mataró</p>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-globe" style="margin-right: 6px; color: var(--accent-blue);"></i> Precessió de l'Eix Terrestre &mdash; 26.000 anys</h3>
      <p>L'eix de rotació de la Terra no apunta sempre a Polaris. El Sol i la Lluna exerceixen un <strong>parell gravitatori</strong> sobre l'abombament equatorial de la Terra, fent que l'eix traci lentament un con al voltant del pol eclíptic &mdash; igual que una baldufa que perd velocitat.</p>
      <p>La taxa de precessió escala amb:</p>
      <div class="formula">ψ̇ ∝ (M☉/r☉³ + M☽/r☽³) &middot; cos(ε) / Ω</div>
      <ul>
        <li><strong>Major obliqüitat ε</strong> &rarr; precessió més lenta (cos ε disminueix). A ε = 90°, la precessió s'atura.</li>
        <li><strong>Major massa solar o lunar</strong> &rarr; precessió més ràpida.</li>
        <li><strong>Major distància</strong> &rarr; precessió més lenta (varia amb r³).</li>
      </ul>
      <p class="note">El control lliscant d'Intensitat simula canvis en masses o distàncies, ja que cap no és a escala real.</p>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-moon" style="margin-right: 6px; color: #c084fc;"></i> Precessió dels Nodes Lunars &mdash; 18,6 anys</h3>
      <p>L'òrbita de la Lluna està inclinada ~5,1° respecte a l'eclíptica. Els dos punts on es creuen s'anomenen <strong>nodes</strong>. L'atracció del Sol sobre aquest pla inclinat fa que els nodes girin cap a l'oest amb un període de 18,6 anys.</p>
      <div class="formula">Ω̇ ∝ M☉ / (r☉³ &middot; n☽)</div>
      <ul>
        <li><strong>n☽</strong> = velocitat angular orbital de la Lluna.</li>
        <li>Major massa solar o Lluna en òrbita més àmplia &rarr; els nodes precessen més ràpidament.</li>
      </ul>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-arrows-spin" style="margin-right: 6px; color: #38bdf8;"></i> Nutació de l'Eix Terrestre &mdash; 18,6 anys</h3>
      <p>El mateix parell de forces que fa precessar els nodes lunars <strong>també sacseja l'eix terrestre</strong>: són dues manifestacions del mateix fenomen físic, amb el mateix període. L'eix no recorre el cercle de precessió de manera neta, sinó que oscil·la a banda i banda traçant una petita el·lipse.</p>
      <ul>
        <li><strong>Δε</strong> (obliqüitat): amplitud ~9,2&Prime;, independent de l'obliqüitat actual.</li>
        <li><strong>Δψ</strong> (longitud): amplitud ~17,2&Prime;; l'arc aparent escala amb sin(ε).</li>
        <li>Raó d'eixos de l'el·lipse: Δψ/Δε ≈ 1,87.</li>
      </ul>
      <p class="note">En la simulació l'amplitud està molt exagerada visualment. El control <em>Amplitud nutació</em> regula aquesta exageració.</p>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-compass" style="margin-right: 6px; color: var(--accent-blue);"></i> Obliqüitat i els seus efectes</h3>
      <ul>
        <li><strong>Cercle de precessió</strong>: el seu radi angular és igual a ε. Major obliqüitat = cercle més gran.</li>
        <li><strong>Taxa de precessió</strong>: disminueix amb cos(ε). A ε = 90° el parell de forces és zero i la precessió s'atura. A ε = 0° la precessió és màxima però el cercle degenera en un punt.</li>
        <li><strong>Amplitud Δε de la nutació</strong>: pràcticament independent de ε.</li>
        <li><strong>Arc aparent Δψ</strong>: escala amb sin(ε); l'el·lipse de nutació sobre la volta celeste és més visible a major obliqüitat.</li>
      </ul>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-ring" style="margin-right: 6px; color: #39e69e;"></i> Rastre sobre la Volta Celeste</h3>
      <p>El rastre verd registra la posició històrica de la projecció de l'eix terrestre sobre l'esfera celeste (radi = 220 ua visuals).</p>
      <ul>
        <li><strong>Només precessió</strong>: línia neta sobre el cercle de precessió.</li>
        <li><strong>Precessió + nutació</strong>: línia sinuosa que oscil·la a banda i banda del cercle; una oscil·lació completa = 18,6 anys simulats.</li>
        <li>El rastre s'esborra en reiniciar o en canviar l'amplitud de nutació.</li>
      </ul>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-link" style="margin-right: 6px; color: #fbbf24;"></i> Rotació Síncrona (Frenada de Marea)</h3>
      <p>La Lluna triga el mateix temps a girar sobre si mateixa que a orbitar la Terra. Això és conseqüència de la <strong>frenada de marea</strong>: la distorsió gravitacional que la Terra indueix a la Lluna frena progressivament la seva rotació fins que tots dos períodes s'igualen. Per això sempre veiem la mateixa cara de la Lluna. En desactivar aquesta opció, la Lluna gira lliurement i es pot veure la cara oculta.</p>
    </div>`;

  const HELP_MODAL_EN = `
    <button id="help-close-btn" onclick="toggleHelp()" title="Close"><i class="fa-solid fa-xmark"></i></button>
    <div>
      <h2><i class="fa-solid fa-book-open" style="margin-right: 8px; color: var(--solar-yellow);"></i> Physical Phenomena Guide</h2>
      <p class="note">3D Earth–Moon–Sun Simulator &middot; Cosmos Mataró</p>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-globe" style="margin-right: 6px; color: var(--accent-blue);"></i> Axial Precession of Earth &mdash; 26,000 years</h3>
      <p>Earth's rotation axis does not always point to Polaris. The Sun and Moon exert a <strong>gravitational torque</strong> on Earth's equatorial bulge, causing the axis to slowly trace a cone around the ecliptic pole &mdash; just like a spinning top.</p>
      <p>The precession rate scales with:</p>
      <div class="formula">ψ̇ ∝ (M☉/r☉³ + M☽/r☽³) &middot; cos(ε) / Ω</div>
      <ul>
        <li><strong>Higher obliquity ε</strong> &rarr; slower precession (cos ε decreases). At ε = 90°, precession stops.</li>
        <li><strong>Greater solar or lunar mass</strong> &rarr; faster precession.</li>
        <li><strong>Greater distance</strong> &rarr; slower precession (varies as r³).</li>
      </ul>
      <p class="note">The Intensity slider simulates changes in mass or distance, as neither is shown at true scale.</p>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-moon" style="margin-right: 6px; color: #c084fc;"></i> Lunar Nodal Precession &mdash; 18.6 years</h3>
      <p>The Moon's orbit is tilted ~5.1° relative to the ecliptic. The two intersection points are called <strong>nodes</strong>. Solar gravity pulling on this tilted plane makes the nodes regress westward with an 18.6-year period.</p>
      <div class="formula">Ω̇ ∝ M☉ / (r☉³ &middot; n☽)</div>
      <ul>
        <li><strong>n☽</strong> = orbital angular velocity of the Moon.</li>
        <li>Greater solar mass or wider lunar orbit &rarr; nodes precess faster.</li>
      </ul>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-arrows-spin" style="margin-right: 6px; color: #38bdf8;"></i> Earth's Axial Nutation &mdash; 18.6 years</h3>
      <p>The same torque driving lunar nodal precession <strong>also nods Earth's axis</strong>: both are manifestations of the same physical phenomenon with the same period. Instead of tracing a smooth circle, the axis wobbles back and forth in a tiny ellipse.</p>
      <ul>
        <li><strong>Δε</strong> (obliquity): ~9.2&Prime; amplitude, independent of current obliquity.</li>
        <li><strong>Δψ</strong> (longitude): ~17.2&Prime; amplitude; apparent arc scales with sin(ε).</li>
        <li>Ellipse axis ratio: Δψ/Δε ≈ 1.87.</li>
      </ul>
      <p class="note">In the simulation the amplitude is strongly exaggerated visually. The <em>Nutation amplitude</em> slider controls this exaggeration.</p>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-compass" style="margin-right: 6px; color: var(--accent-blue);"></i> Obliquity and Its Effects</h3>
      <ul>
        <li><strong>Precession circle</strong>: angular radius equals ε. Greater obliquity = larger circle.</li>
        <li><strong>Precession rate</strong>: decreases with cos(ε). At ε = 90° torque is zero and precession stops. At ε = 0° rate is maximum but the circle collapses to a point.</li>
        <li><strong>Nutation amplitude Δε</strong>: practically independent of ε.</li>
        <li><strong>Apparent arc Δψ</strong>: scales with sin(ε); the nutation ellipse on the celestial sphere is more visible at higher obliquity.</li>
      </ul>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-ring" style="margin-right: 6px; color: #39e69e;"></i> Trail on the Celestial Sphere</h3>
      <p>The green trail records the historical path of Earth's axis projected onto the celestial sphere (visual radius = 220 AU).</p>
      <ul>
        <li><strong>Precession only</strong>: clean line along the precession circle.</li>
        <li><strong>Precession + nutation</strong>: wavy line oscillating across the circle; one full oscillation = 18.6 simulated years.</li>
        <li>The trail resets when restarting or changing nutation amplitude.</li>
      </ul>
    </div>

    <div class="help-section">
      <h3><i class="fa-solid fa-link" style="margin-right: 6px; color: #fbbf24;"></i> Synchronous Rotation (Tidal Locking)</h3>
      <p>The Moon takes the same time to spin once on its axis as it takes to orbit Earth. This is caused by <strong>tidal braking</strong>: Earth's gravitational distortion gradually slowed the Moon's rotation until both periods matched, so we always see the same near side. Disable this option to watch the Moon spin freely and reveal the far side.</p>
    </div>`;

  const EXACT_CA = {
    'Cargando Sistema Sol-Tierra-Luna...': 'Carregant Sistema Sol-Terra-Lluna...',
    'Sistema Sol-Tierra-Luna': 'Sistema Sol-Terra-Lluna',
    'Cargando Simulador 3D...': 'Carregant Simulador 3D...',
    'Guía de Fenómenos': 'Guia de Fenòmens',
    'Sol': 'Sol',
    'Tierra-Luna': 'Terra-Lluna',
    'Eje Sol-Tierra': 'Eix Sol-Terra',
    'Eje Tierra-Sol': 'Eix Terra-Sol',
    'Parámetros': 'Paràmetres',
    'Visualización': 'Visualització',
    'Abrir Parámetros Orbitales': 'Obrir Paràmetres Orbitals',
    'Abrir Ajustes de Visualización': 'Obrir Ajustos de Visualització',
    'Ocultar Panel': 'Ocultar Panell',
    'Simulador 3D': 'Simulador 3D',
    'Parámetros orbitales': 'Paràmetres orbitals',
    'Parámetros de inclinación orbital, oblicuidad axial, excentricidad y movimientos de precesión': "Paràmetres d'inclinació orbital, obliqüitat axial, excentricitat i moviments de precessió",
    'Oblicuidad (Tierra)': 'Obliqüitat (Terra)',
    'Inclinación (Luna)': 'Inclinació (Lluna)',
    'Excentricidad (Luna)': 'Excentricitat (Lluna)',
    'Rotación síncrona de la Luna': 'Rotació síncrona de la Lluna',
    'La Luna tarda el mismo tiempo en girar sobre sí misma que en orbitar la Tierra, mostrando siempre la misma cara. Es el resultado del frenado de marea.': 'La Lluna triga el mateix temps a girar sobre si mateixa que a orbitar la Terra, mostrant sempre la mateixa cara. És el resultat de la frenada de marea.',
    'Precesión del eje (Tierra)': "Precessió de l'eix (Terra)",
    'Intensidad': 'Intensitat',
    'Factor masa/distancia. La tasa de precesión axial escala con: ψ̇ ∝ (M☉/r☉³ + M☽/r☽³) — Un valor mayor equivale a imaginar un Sol más masivo o una Luna más próxima.': 'Factor massa/distància. La taxa de precessió axial escala amb: ψ̇ ∝ (M☉/r☉³ + M☽/r☽³) — Un valor major equival a imaginar un Sol més massiu o una Lluna més propera.',
    'Precesión de nodos (Luna) + nutación': 'Precessió de nodes (Lluna) + nutació',
    'Factor masa/distancia. La tasa de precesión de los nodos lunares escala con: Ω̇ ∝ M☉/(r☉³·n☽) — Un valor mayor equivale a imaginar un Sol más masivo o una Luna en una órbita más amplia.': 'Factor massa/distància. La taxa de precessió dels nodes lunars escala amb: Ω̇ ∝ M☉/(r☉³·n☽) — Un valor major equival a imaginar un Sol més massiu o una Lluna en una òrbita més àmplia.',
    'Amplitud nutación': 'Amplitud nutació',
    'Amplitud angular Δε del cabeceo axial (real = 9.2 segundos de arco).': "Amplitud angular Δε del balanceig axial (real = 9,2 segons d'arc).",
    'Precesión de ábsides': "Precessió d'àpsides",
    'Velocidad de rotación progresiva de la línea de ábsides (perigeo/apogeo) en el plano orbital. Completa una vuelta en 8.85 años (el doble de rápido que la de los nodos).': "Velocitat de rotació progressiva de la línia d'àpsides (perigeu/apogeu) al pla orbital. Completa una volta en 8,85 anys (el doble de ràpid que la dels nodes).",
    'Reproducción': 'Reproducció',
    'Pausar': 'Pausar',
    'Reanudar': 'Reprendre',
    'Reiniciar': 'Reiniciar',
    'Aceleración temporal': 'Acceleració temporal',
    'Capas': 'Capes',
    'Constelaciones': 'Constel·lacions',
    'Órbitas (trazados)': 'Òrbites (traçats)',
    'Plano eclíptico (malla)': 'Pla eclíptic (malla)',
    'Ejes de rotación y guías': 'Eixos de rotació i guies',
    'Bóveda celeste': 'Volta celeste',
    'Brillo bóveda': 'Brillantor volta',
    'Brillo de la bóveda celeste y de las estrellas': 'Brillantor de la volta celeste i de les estrelles',
    'Red geográfica (Lat/Lon)': 'Xarxa geogràfica (Lat/Lon)',
    'Zona de eclipses': "Zona d'eclipsis",
    'Guía de proyección del eje': "Guia de projecció de l'eix",
    'Puntos subsolar, sublunar y terminador': 'Punts subsolar, sublunar i terminador',
    'Registro de eventos': "Registre d'esdeveniments",
    'Registro de Eventos': "Registre d'Esdeveniments",
    'Itinerario educativo (meses lunares)': 'Itinerari educatiu (mesos lunars)',
    'Itinerario de meses lunares': 'Itinerari de mesos lunars',
    'Cerrar itinerario': 'Tancar itinerari',
    'Cerrar registro': 'Tancar registre',
    'Anterior': 'Anterior',
    'Siguiente': 'Següent',
    'Siguiente ▶': 'Següent ▶',
    'Reiniciar 🔄': 'Reiniciar 🔄',
    '1. Mes sinódico (fases lunares)': '1. Mes sinòdic (fases lunars)',
    'Duración media: 29.53059 días (Varía 29.18 - 29.93d)': 'Durada mitjana: 29,53059 dies (Varia 29,18 - 29,93 d)',
    'Duración: 29.53 días • Sol-Tierra-Luna': 'Durada: 29,53 dies • Sol-Terra-Lluna',
    'Mide el ciclo completo de las fases (de Luna Nueva a Luna Nueva). Debido a la excentricidad de la órbita lunar y terrestre, su duración real varía entre 29.18 y 29.93 días (con una media de 29.53 días). Como la Tierra se mueve alrededor del Sol, la Luna debe girar ~389° para alinearse.': "Mesura el cicle complet de les fases (de Lluna Nova a Lluna Nova). A causa de l'excentricitat de l'òrbita lunar i terrestre, la seva durada real varia entre 29,18 i 29,93 dies (mitjana 29,53 dies). Com que la Terra es mou al voltant del Sol, la Lluna ha de girar ~389° per alinear-se.",
    'El mes sinódico mide el ciclo completo de las fases (de Luna Nueva a Luna Nueva). Como la Tierra se mueve alrededor del Sol, la Luna debe girar ~389° en lugar de 360° para volver a alinearse con el Sol.': 'El mes sinòdic mesura el cicle complet de les fases (de Lluna Nova a Lluna Nova). Com que la Terra es mou al voltant del Sol, la Lluna ha de girar ~389° en lloc de 360° per tornar-se a alinear amb el Sol.',
    '2. Mes draconítico o nodal (eclipses)': '2. Mes draconític o nodal (eclipsis)',
    'Duración: 27.21222 días • Inclinación 5.14° y Nodos ☊/☋': 'Durada: 27,21222 dies • Inclinació 5,14° i Nodes ☊/☋',
    'Mide el tiempo entre dos pasos por el mismo Nodo orbital. La órbita lunar está inclinada 5.14° respecto a la Eclíptica. ¡Solo hay eclipses cuando la Luna pasa cerca de un nodo en Luna Nueva o Llena!': "Mesura el temps entre dos passos pel mateix Node orbital. L'òrbita lunar està inclinada 5,14° respecte a l'Eclíptica. Només hi ha eclipsis quan la Lluna passa prop d'un node en Lluna Nova o Plena!",
    '3. Mes anomalístico (perigeo y apogeo)': '3. Mes anomalístic (perigeu i apogeu)',
    'Duración: 27.55455 días • Órbita Elíptica y Distancia': 'Durada: 27,55455 dies • Òrbita El·líptica i Distància',
    'Mide el tiempo entre dos pasos por el Perigeo (máxima cercanía). La excentricidad cambia el tamaño aparente de la Luna: si un eclipse solar ocurre en Perigeo es TOTAL; cerca del Apogeo es ANULAR.': "Mesura el temps entre dos passos pel Perigeu (màxima proximitat). L'excentricitat canvia la mida aparent de la Lluna: si un eclipsi solar ocorre al Perigeu és TOTAL; prop de l'Apogeu és ANULAR.",
    '4. Sinfonía de Saros (resonancia)': '4. Simfonia de Saros (ressonància)',
    '223 Sinódicos ≈ 242 Draconíticos ≈ 239 Anomalísticos': '223 Sinòdics ≈ 242 Draconítics ≈ 239 Anomalístics',
    '¡La gran coincidencia astronómica! Al cabo de 18 años, 11 días y 8 horas (6585.32 días), los 3 períodos coinciden simultáneamente. Esto hace que se repita exactamente la misma disposición relativa entre los tres marcadores orbitales (y, si ocurre en Luna Nueva/Llena cerca de un nodo, la misma serie o familia de eclipses).': "La gran coincidència astronòmica! Al cap de 18 anys, 11 dies i 8 hores (6585,32 dies), els 3 períodes coincideixen simultàniament. Això fa que es repeteixi exactament la mateixa disposició relativa entre els tres marcadors orbitals (i, si ocorre en Lluna Nova/Plena prop d'un node, la mateixa sèrie o família d'eclipsis).",
    '5. El Exeligmos (Trisaros / gran rueda)': '5. L\'Exeligmos (Trisaros / gran roda)',
    '54 años y 33 días • 669 Sinódicos ≈ 726 Draconíticos ≈ 717 Anomalísticos': '54 anys i 33 dies • 669 Sinòdics ≈ 726 Draconítics ≈ 717 Anomalístics',
    'El Exeligmos (o Trisaros) es la gran resonancia de 3 ciclos Saros (54 años y 33 días). Al triplicar las 8 horas sobrantes del Saros (3 × 8h = 24h), la Tierra completa un número entero exacto de giros diurnos. ¡El eclipse se repite no solo con la misma geometría orbital, sino en la misma longitud geográfica y hora local en la Tierra!': "L'Exeligmos (o Trisaros) és la gran ressonància de 3 cicles Saros (54 anys i 33 dies). En triplicar les 8 hores sobrants del Saros (3 × 8h = 24h), la Terra completa un nombre enter exacte de girs diürns. L'eclipsi es repeteix no només amb la mateixa geometria orbital, sinó a la mateixa longitud geogràfica i hora local a la Terra!",
    'Simular Saros (18a 11d 8h)': 'Simular Saros (18a 11d 8h)',
    '¡1 CICLO SAROS COMPLETADO!': '1 CICLE SAROS COMPLETAT!',
    '+223 Sinódicos ≈ +242 Draconíticos ≈ +239 Anomalísticos.': '+223 Sinòdics ≈ +242 Draconítics ≈ +239 Anomalístics.',
    'Simulación pausada para comprobar los marcadores.': 'Simulació pausada per comprovar els marcadors.',
    'Meses Sinódicos:': 'Mesos Sinòdics:',
    'Ciclos Saros completados:': 'Cicles Saros completats:',
    '⚡ Simular Exeligmos (54a 33d)': '⚡ Simular Exeligmos (54a 33d)',
    '¡GRAN RESONANCIA DE EXELIGMOS ALCANZADA!': "GRAN RESSONÀNCIA D'EXELIGMOS ASSOLIDA!",
    'Misma hora local y misma longitud geográfica en la Tierra': 'Mateixa hora local i mateixa longitud geogràfica a la Terra',
    '🌑 Luna Nueva': '🌑 Lluna Nova',
    '🌕 Luna Llena': '🌕 Lluna Plena',
    '🌿 Inicio primavera boreal': '🌿 Inici primavera boreal',
    '☀️ Inicio verano boreal': '☀️ Inici estiu boreal',
    '🍂 Inicio otoño boreal': '🍂 Inici tardor boreal',
    '❄️ Inicio invierno boreal': '❄️ Inici hivern boreal',
    '☀️ Eclipse Solar': '☀️ Eclipsi Solar',
    '🌔 Eclipse Lunar': '🌔 Eclipsi Lunar'
  };

  const EXACT_EN = {
    'Cargando Sistema Sol-Tierra-Luna...': 'Loading Sun-Earth-Moon System...',
    'Sistema Sol-Tierra-Luna': 'Sun-Earth-Moon System',
    'Cargando Simulador 3D...': 'Loading 3D Simulator...',
    'Guía de Fenómenos': 'Phenomena Guide',
    'Sol': 'Sun',
    'Tierra-Luna': 'Earth-Moon',
    'Eje Sol-Tierra': 'Sun-Earth Axis',
    'Eje Tierra-Sol': 'Earth-Sun Axis',
    'Parámetros': 'Parameters',
    'Visualización': 'Visualization',
    'Abrir Parámetros Orbitales': 'Open Orbital Parameters',
    'Abrir Ajustes de Visualización': 'Open Visualization Settings',
    'Ocultar Panel': 'Hide Panel',
    'Simulador 3D': '3D Simulator',
    'Parámetros orbitales': 'Orbital parameters',
    'Parámetros de inclinación orbital, oblicuidad axial, excentricidad y movimientos de precesión': 'Orbital inclination, axial obliquity, eccentricity and precession parameters',
    'Oblicuidad (Tierra)': 'Obliquity (Earth)',
    'Inclinación (Luna)': 'Inclination (Moon)',
    'Excentricidad (Luna)': 'Eccentricity (Moon)',
    'Rotación síncrona de la Luna': 'Synchronous lunar rotation',
    'La Luna tarda el mismo tiempo en girar sobre sí misma que en orbitar la Tierra, mostrando siempre la misma cara. Es el resultado del frenado de marea.': 'The Moon rotates at the same rate it orbits Earth, always showing the same face due to tidal locking.',
    'Precesión del eje (Tierra)': 'Axial precession (Earth)',
    'Intensidad': 'Intensity',
    'Factor masa/distancia. La tasa de precesión axial escala con: ψ̇ ∝ (M☉/r☉³ + M☽/r☽³) — Un valor mayor equivale a imaginar un Sol más masivo o una Luna más próxima.': 'Mass/distance factor. Axial precession scales with ψ̇ ∝ (M☉/r☉³ + M☽/r☽³) — Higher values represent a more massive Sun or closer Moon.',
    'Precesión de nodos (Luna) + nutación': 'Nodal precession (Moon) + nutation',
    'Factor masa/distancia. La tasa de precesión de los nodos lunares escala con: Ω̇ ∝ M☉/(r☉³·n☽) — Un valor mayor equivale a imaginar un Sol más masivo o una Luna en una órbita más amplia.': 'Mass/distance factor. Lunar nodal precession scales with Ω̇ ∝ M☉/(r☉³·n☽) — Higher values represent a more massive Sun or wider lunar orbit.',
    'Amplitud nutación': 'Nutation amplitude',
    'Amplitud angular Δε del cabeceo axial (real = 9.2 segundos de arco).': 'Angular amplitude Δε of the axial wobble (real = 9.2 arcseconds).',
    'Precesión de ábsides': 'Apsidal precession',
    'Velocidad de rotación progresiva de la línea de ábsides (perigeo/apogeo) en el plano orbital. Completa una vuelta en 8.85 años (el doble de rápido que la de los nodos).': 'Progressive rotation rate of the line of apsides (perigee/apogee) in the orbital plane. Completes one turn in 8.85 years (twice as fast as nodal precession).',
    'Reproducción': 'Playback',
    'Pausar': 'Pause',
    'Reanudar': 'Resume',
    'Reiniciar': 'Reset',
    'Aceleración temporal': 'Time acceleration',
    'Capas': 'Layers',
    'Constelaciones': 'Constellations',
    'Órbitas (trazados)': 'Orbits (paths)',
    'Plano eclíptico (malla)': 'Ecliptic plane (grid)',
    'Ejes de rotación y guías': 'Rotation axes & guides',
    'Bóveda celeste': 'Celestial sphere',
    'Brillo bóveda': 'Sphere brightness',
    'Brillo de la bóveda celeste y de las estrellas': 'Brightness of the celestial sphere and stars',
    'Red geográfica (Lat/Lon)': 'Geographic grid (Lat/Lon)',
    'Zona de eclipses': 'Eclipse zone',
    'Guía de proyección del eje': 'Axis projection guide',
    'Puntos subsolar, sublunar y terminador': 'Subsolar, sublunar points & terminator',
    'Registro de eventos': 'Event log',
    'Registro de Eventos': 'Event Log',
    'Itinerario educativo (meses lunares)': 'Guided tour (lunar months)',
    'Itinerario de meses lunares': 'Lunar months tour',
    'Cerrar itinerario': 'Close tour',
    'Cerrar registro': 'Close log',
    'Anterior': 'Previous',
    'Siguiente': 'Next',
    'Siguiente ▶': 'Next ▶',
    'Reiniciar 🔄': 'Restart 🔄',
    '1. Mes sinódico (fases lunares)': '1. Synodic month (lunar phases)',
    'Duración media: 29.53059 días (Varía 29.18 - 29.93d)': 'Mean duration: 29.53059 days (Range 29.18 - 29.93d)',
    'Duración: 29.53 días • Sol-Tierra-Luna': 'Duration: 29.53 days • Sun-Earth-Moon',
    'Mide el ciclo completo de las fases (de Luna Nueva a Luna Nueva). Debido a la excentricidad de la órbita lunar y terrestre, su duración real varía entre 29.18 y 29.93 días (con una media de 29.53 días). Como la Tierra se mueve alrededor del Sol, la Luna debe girar ~389° para alinearse.': 'Measures the complete cycle of phases (New Moon to New Moon). Due to lunar and terrestrial orbital eccentricity, its duration ranges from 29.18 to 29.93 days (mean 29.53d). Because Earth moves around the Sun, the Moon must orbit ~389° to realign.',
    'El mes sinódico mide el ciclo completo de las fases (de Luna Nueva a Luna Nueva). Como la Tierra se mueve alrededor del Sol, la Luna debe girar ~389° en lugar de 360° para volver a alinearse con el Sol.': 'The synodic month measures the full phase cycle (New Moon to New Moon). Because Earth orbits the Sun, the Moon must turn ~389° instead of 360° to realign with the Sun.',
    '2. Mes draconítico o nodal (eclipses)': '2. Draconic or nodal month (eclipses)',
    'Duración: 27.21222 días • Inclinación 5.14° y Nodos ☊/☋': 'Duration: 27.21222 days • 5.14° Tilt & Nodes ☊/☋',
    'Mide el tiempo entre dos pasos por el mismo Nodo orbital. La órbita lunar está inclinada 5.14° respecto a la Eclíptica. ¡Solo hay eclipses cuando la Luna pasa cerca de un nodo en Luna Nueva o Llena!': 'Measures the time between consecutive passages through the same orbital node. The lunar orbit is tilted 5.14° to the ecliptic. Eclipses only occur when the Moon crosses near a node at New or Full Moon!',
    '3. Mes anomalístico (perigeo y apogeo)': '3. Anomalistic month (perigee & apogee)',
    'Duración: 27.55455 días • Órbita Elíptica y Distancia': 'Duration: 27.55455 days • Elliptical Orbit & Distance',
    'Mide el tiempo entre dos pasos por el Perigeo (máxima cercanía). La excentricidad cambia el tamaño aparente de la Luna: si un eclipse solar ocurre en Perigeo es TOTAL; cerca del Apogeo es ANULAR.': 'Measures the time between consecutive passages through Perigee (closest approach). Eccentricity changes the Moon\'s apparent size: a solar eclipse near Perigee is TOTAL; near Apogee it is ANNULAR.',
    '4. Sinfonía de Saros (resonancia)': '4. Saros symphony (resonance)',
    '223 Sinódicos ≈ 242 Draconíticos ≈ 239 Anomalísticos': '223 Synodic ≈ 242 Draconic ≈ 239 Anomalistic',
    '¡La gran coincidencia astronómica! Al cabo de 18 años, 11 días y 8 horas (6585.32 días), los 3 períodos coinciden simultáneamente. Esto hace que se repita exactamente la misma disposición relativa entre los tres marcadores orbitales (y, si ocurre en Luna Nueva/Llena cerca de un nodo, la misma serie o familia de eclipses).': 'The great astronomical resonance! After 18 years, 11 days, and 8 hours (6585.32 days), all 3 periods realign simultaneously, repeating the exact same relative orbital geometry (and eclipse series!).',
    '5. El Exeligmos (Trisaros / gran rueda)': '5. The Exeligmos (Trisaros / great wheel)',
    '54 años y 33 días • 669 Sinódicos ≈ 726 Draconíticos ≈ 717 Anomalísticos': '54 years 33 days • 669 Synodic ≈ 726 Draconic ≈ 717 Anomalistic',
    'El Exeligmos (o Trisaros) es la gran resonancia de 3 ciclos Saros (54 años y 33 días). Al triplicar las 8 horas sobrantes del Saros (3 × 8h = 24h), la Tierra completa un número entero exacto de giros diurnos. ¡El eclipse se repite no solo con la misma geometría orbital, sino en la misma longitud geográfica y hora local en la Tierra!': 'The Exeligmos (Trisaros) is the grand resonance of 3 Saros cycles (54 years, 33 days). Tripling the extra 8 hours (3 × 8h = 24h) makes Earth complete an exact integer number of rotations — repeating the eclipse at the same geographic longitude and local time!',
    'Simular Saros (18a 11d 8h)': 'Simulate Saros (18y 11d 8h)',
    '¡1 CICLO SAROS COMPLETADO!': '1 SAROS CYCLE COMPLETED!',
    '+223 Sinódicos ≈ +242 Draconíticos ≈ +239 Anomalísticos.': '+223 Synodic ≈ +242 Draconic ≈ +239 Anomalistic.',
    'Simulación pausada para comprobar los marcadores.': 'Simulation paused to inspect markers.',
    'Meses Sinódicos:': 'Synodic Months:',
    'Ciclos Saros completados:': 'Completed Saros Cycles:',
    '⚡ Simular Exeligmos (54a 33d)': '⚡ Simulate Exeligmos (54y 33d)',
    '¡GRAN RESONANCIA DE EXELIGMOS ALCANZADA!': 'GREAT EXELIGMOS RESONANCE REACHED!',
    'Misma hora local y misma longitud geográfica en la Tierra': 'Same local time and same geographic longitude on Earth',
    '🌑 Luna Nueva': '🌑 New Moon',
    '🌕 Luna Llena': '🌕 Full Moon',
    '🌿 Inicio primavera boreal': '🌿 Northern spring begins',
    '☀️ Inicio verano boreal': '☀️ Northern summer begins',
    '🍂 Inicio otoño boreal': '🍂 Northern autumn begins',
    '❄️ Inicio invierno boreal': '❄️ Northern winter begins',
    '☀️ Eclipse Solar': '☀️ Solar Eclipse',
    '🌔 Eclipse Lunar': '🌔 Lunar Eclipse'
  };

  if (window.CosmosI18n) {
    window.CosmosI18n.init({
      pageTitle: {
        es: 'Sistema Sol-Tierra-Luna - Cosmos Mataró',
        ca: 'Sistema Sol-Terra-Lluna - Cosmos Mataró',
        en: 'Sun-Earth-Moon System - Cosmos Mataró'
      },
      exact: { ca: EXACT_CA, en: EXACT_EN },
      patterns: {
        ca: [
          [/^Año (\d+), Día (\d+)$/, 'Any $1, Dia $2'],
          [/^Día (\d+):$/, 'Dia $1:'],
          [/^🎉 Comienza el Año (\d+)$/, "🎉 Comença l'Any $1"]
        ],
        en: [
          [/^Año (\d+), Día (\d+)$/, 'Year $1, Day $2'],
          [/^Día (\d+):$/, 'Day $1:'],
          [/^🎉 Comienza el Año (\d+)$/, '🎉 Year $1 begins']
        ]
      },
      htmlBlocks: {
        'help-modal': {
          ca: HELP_MODAL_CA,
          en: HELP_MODAL_EN
        }
      }
    });
  }
})();
