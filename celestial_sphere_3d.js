/* =========================================================================
   COSMOS MATARÓ - ESFERA CELESTE Y ESTRELLAS DE REFERENCIA (celestial_sphere_3d.js)
   Bóveda celeste inercial geocéntrica / ecuatorial J2000 con coordenadas reales,
   retícula astronómica, eclíptica, estrellas de referencia y rótulos.
   ========================================================================= */

(function(window) {
    "use strict";

    // Oblicuidad canónica de la eclíptica J2000 en radianes
    const OBLIQUITY_RAD = 23.4392911 * (Math.PI / 180);

    // Catálogo astronómico de estrellas de referencia principales (Época J2000)
    // ra: Ascensión recta en grados (0° - 360°)
    // dec: Declinación en grados (-90° a +90°)
    // mag: Magnitud visual aparente
    // color: Color espectral característico
    // name: Nombre de referencia común / tradicional
    // constellation: Constelación a la que pertenece
    const REFERENCE_STARS = [
        // Hemisferio Norte y Ecuador
        { name: "Polaris",        constellation: "UMi", ra:  37.95, dec:  89.26, mag: 1.98, color: "#fff9ea", prominent: true },
        { name: "Sirio",          constellation: "CMa", ra: 101.29, dec: -16.72, mag:-1.46, color: "#99d1ff", prominent: true },
        { name: "Vega",           constellation: "Lyr", ra: 279.23, dec:  38.78, mag: 0.03, color: "#cce8ff", prominent: true },
        { name: "Arturo",         constellation: "Boo", ra: 213.91, dec:  19.18, mag:-0.05, color: "#ffb469", prominent: true },
        { name: "Capella",        constellation: "Aur", ra:  79.17, dec:  45.99, mag: 0.08, color: "#ffe082", prominent: true },
        { name: "Rígel",          constellation: "Ori", ra:  78.63, dec:  -8.20, mag: 0.13, color: "#bcdcff", prominent: true },
        { name: "Proción",        constellation: "CMi", ra: 114.82, dec:   5.22, mag: 0.34, color: "#fff0d4", prominent: true },
        { name: "Betelgeuse",     constellation: "Ori", ra:  88.79, dec:   7.41, mag: 0.50, color: "#ff7043", prominent: true },
        { name: "Altair",         constellation: "Aql", ra: 297.69, dec:   8.87, mag: 0.77, color: "#eef6ff", prominent: true },
        { name: "Aldebarán",      constellation: "Tau", ra:  68.98, dec:  16.51, mag: 0.85, color: "#ffa257", prominent: true },
        { name: "Antares",        constellation: "Sco", ra: 247.35, dec: -26.43, mag: 1.06, color: "#ff5232", prominent: true },
        { name: "Espiga",         constellation: "Vir", ra: 201.30, dec: -11.16, mag: 0.98, color: "#a8d4ff", prominent: true },
        { name: "Pólux",          constellation: "Gem", ra: 116.33, dec:  28.03, mag: 1.14, color: "#ffc272", prominent: true },
        { name: "Cástor",         constellation: "Gem", ra: 113.65, dec:  31.89, mag: 1.58, color: "#e3f0ff", prominent: false },
        { name: "Deneb",          constellation: "Cyg", ra: 310.36, dec:  45.28, mag: 1.25, color: "#d9e8ff", prominent: true },
        { name: "Regulus",        constellation: "Leo", ra: 152.09, dec:  11.97, mag: 1.36, color: "#bfe0ff", prominent: true },
        { name: "Bellatrix",      constellation: "Ori", ra:  81.28, dec:   6.35, mag: 1.64, color: "#b8dbff", prominent: false },
        { name: "Alnilam",        constellation: "Ori", ra:  84.05, dec:  -1.20, mag: 1.69, color: "#b8dbff", prominent: false },
        { name: "Dubhe",          constellation: "UMa", ra: 165.93, dec:  61.75, mag: 1.79, color: "#ffcc66", prominent: true },
        { name: "Merak",          constellation: "UMa", ra: 165.46, dec:  56.38, mag: 2.37, color: "#dceaff", prominent: false },
        { name: "Alioth",         constellation: "UMa", ra: 193.51, dec:  55.96, mag: 1.77, color: "#e8f2ff", prominent: false },
        { name: "Alkaid",         constellation: "UMa", ra: 206.88, dec:  49.31, mag: 1.86, color: "#c8e2ff", prominent: true },
        { name: "Schedar",        constellation: "Cas", ra:  10.13, dec:  56.54, mag: 2.24, color: "#ffba66", prominent: true },

        // Hemisferio Sur
        { name: "Canopo",         constellation: "Car", ra:  95.99, dec: -52.70, mag:-0.74, color: "#eef4ff", prominent: true },
        { name: "Alfa Centauri",  constellation: "Cen", ra: 219.90, dec: -60.83, mag:-0.27, color: "#ffe699", prominent: true },
        { name: "Hadar",          constellation: "Cen", ra: 210.95, dec: -60.37, mag: 0.61, color: "#bcdcff", prominent: true },
        { name: "Acrux",          constellation: "Cru", ra: 186.65, dec: -63.10, mag: 0.77, color: "#bcdcff", prominent: true },
        { name: "Fomalhaut",      constellation: "PsA", ra: 344.41, dec: -29.62, mag: 1.17, color: "#d9e8ff", prominent: true },
        { name: "Achernar",       constellation: "Eri", ra:  24.43, dec: -57.24, mag: 0.45, color: "#aed5ff", prominent: true }
    ];

    // Convierte coordenadas ecuatoriales celestes (RA, Dec en grados) a vector 3D cartesiano
    function radecToVector3(raDeg, decDeg, radius) {
        const raRad = raDeg * (Math.PI / 180);
        const decRad = decDeg * (Math.PI / 180);

        const x =  radius * Math.cos(decRad) * Math.cos(raRad);
        const y =  radius * Math.sin(decRad);
        const z = -radius * Math.cos(decRad) * Math.sin(raRad);

        return new THREE.Vector3(x, y, z);
    }

    // Catálogo de líneas de constelaciones principales (segmentos en coordenadas RA, Dec J2000)
    const CONSTELLATION_LINES = [
        // Orión (El Cazador y el Cinturón)
        [ [88.79, 7.41], [83.78, 9.93] ],   // Betelgeuse - Meissa
        [ [81.28, 6.35], [83.78, 9.93] ],   // Bellatrix - Meissa
        [ [88.79, 7.41], [85.19, -1.94] ],  // Betelgeuse - Alnitak
        [ [81.28, 6.35], [83.00, -0.30] ],  // Bellatrix - Mintaka
        [ [83.00, -0.30], [84.05, -1.20] ], // Mintaka - Alnilam
        [ [84.05, -1.20], [85.19, -1.94] ], // Alnilam - Alnitak
        [ [85.19, -1.94], [86.94, -9.67] ], // Alnitak - Saiph
        [ [83.00, -0.30], [78.63, -8.20] ], // Mintaka - Rígel
        [ [86.94, -9.67], [78.63, -8.20] ], // Saiph - Rígel

        // Osa Mayor (El Gran Carro)
        [ [165.93, 61.75], [165.46, 56.38] ], // Dubhe - Merak
        [ [165.46, 56.38], [178.46, 53.69] ], // Merak - Phecda
        [ [178.46, 53.69], [183.86, 57.03] ], // Phecda - Megrez
        [ [183.86, 57.03], [165.93, 61.75] ], // Megrez - Dubhe
        [ [183.86, 57.03], [193.51, 55.96] ], // Megrez - Alioth
        [ [193.51, 55.96], [200.98, 54.92] ], // Alioth - Mizar
        [ [200.98, 54.92], [206.88, 49.31] ], // Mizar - Alkaid

        // Osa Menor
        [ [37.95, 89.26], [261.27, 86.59] ],  // Polaris - Yildun
        [ [261.27, 86.59], [244.60, 77.79] ], // Yildun - Anwar al Farkadain
        [ [244.60, 77.79], [222.68, 74.16] ], // Anwar - Kochab
        [ [222.68, 74.16], [230.18, 71.83] ], // Kochab - Pherkad
        [ [230.18, 71.83], [244.60, 77.79] ], // Pherkad - Anwar

        // Casiopea (La "W")
        [ [2.30, 59.15], [10.13, 56.54] ],   // Caph - Schedar
        [ [10.13, 56.54], [14.18, 60.72] ],  // Schedar - Navi
        [ [14.18, 60.72], [20.20, 60.23] ],  // Navi - Ruchbah
        [ [20.20, 60.23], [26.70, 63.67] ],  // Ruchbah - Segin

        // Cisne (La Cruz del Norte)
        [ [310.36, 45.28], [305.56, 40.26] ], // Deneb - Sadr
        [ [305.56, 40.26], [292.68, 27.96] ], // Sadr - Albireo
        [ [296.24, 45.13], [305.56, 40.26] ], // Fawaris - Sadr
        [ [305.56, 40.26], [311.55, 33.97] ], // Sadr - Gienah

        // Lira
        [ [279.23, 38.78], [281.20, 37.60] ], // Vega - Zeta Lyr
        [ [281.20, 37.60], [283.61, 36.87] ], // Zeta - Delta Lyr
        [ [283.61, 36.87], [284.74, 32.69] ], // Delta - Sulafat
        [ [284.74, 32.69], [282.52, 33.36] ], // Sulafat - Sheliak
        [ [282.52, 33.36], [281.20, 37.60] ], // Sheliak - Zeta Lyr

        // Águila
        [ [296.54, 10.61], [297.69, 8.87] ],  // Tarazed - Altair
        [ [297.69, 8.87], [298.83, 6.41] ],   // Altair - Alshain
        [ [297.69, 8.87], [286.35, 15.07] ],  // Altair - Okab
        [ [298.83, 6.41], [301.32, 3.11] ],   // Alshain - Tseen Foo

        // Tauro (Las Híades y Cuernos)
        [ [68.98, 16.51], [64.95, 15.63] ],  // Aldebarán - Gamma Tau
        [ [64.95, 15.63], [67.15, 19.18] ],  // Gamma Tau - Epsilon Tau
        [ [67.15, 19.18], [68.98, 16.51] ],  // Epsilon Tau - Aldebarán
        [ [67.15, 19.18], [81.57, 28.61] ],  // Epsilon Tau - Elnath
        [ [68.98, 16.51], [84.41, 21.14] ],  // Aldebarán - Tianguan

        // Géminis
        [ [113.65, 31.89], [116.33, 28.03] ], // Cástor - Pólux
        [ [113.65, 31.89], [100.98, 25.13] ], // Cástor - Mebsuta
        [ [100.98, 25.13], [95.74, 22.51] ],  // Mebsuta - Tejat
        [ [116.33, 28.03], [110.80, 21.98] ], // Pólux - Wasat
        [ [110.80, 21.98], [106.03, 20.57] ], // Wasat - Mekbuda
        [ [106.03, 20.57], [99.43, 16.40] ],  // Mekbuda - Alhena
        [ [100.98, 25.13], [110.80, 21.98] ], // Mebsuta - Wasat

        // Leo
        [ [152.09, 11.97], [154.99, 19.84] ], // Regulus - Algieba
        [ [154.99, 19.84], [154.17, 23.42] ], // Algieba - Adhafera
        [ [154.17, 23.42], [148.19, 26.17] ], // Adhafera - Rasalas
        [ [154.99, 19.84], [168.53, 20.52] ], // Algieba - Zosma
        [ [168.53, 20.52], [177.26, 14.57] ], // Zosma - Denebola
        [ [177.26, 14.57], [169.60, 15.43] ], // Denebola - Chertan
        [ [169.60, 15.43], [152.09, 11.97] ], // Chertan - Regulus
        [ [168.53, 20.52], [169.60, 15.43] ], // Zosma - Chertan

        // Escorpio
        [ [241.36, -19.81], [240.08, -22.62] ], // Beta Sco - Delta Sco
        [ [240.08, -22.62], [239.71, -26.11] ], // Delta Sco - Pi Sco
        [ [240.08, -22.62], [247.35, -26.43] ], // Delta Sco - Antares
        [ [247.35, -26.43], [252.54, -34.29] ], // Antares - Epsilon Sco
        [ [252.54, -34.29], [264.33, -43.00] ], // Epsilon Sco - Theta Sco
        [ [264.33, -43.00], [263.40, -37.10] ], // Theta Sco - Shaula

        // Cruz del Sur y Punteros del Centauro
        [ [186.65, -63.10], [187.80, -57.11] ], // Acrux - Gacrux
        [ [191.93, -59.69], [183.75, -58.75] ], // Mimosa - Delta Cru
        [ [219.90, -60.83], [210.95, -60.37] ], // Alfa Cen - Hadar
        [ [210.95, -60.37], [211.60, -36.37] ], // Hadar - Menkent

        // Boyero (Boötes)
        [ [213.91, 19.18], [208.67, 18.39] ], // Arturo - Muphrid
        [ [213.91, 19.18], [221.25, 27.07] ], // Arturo - Izar
        [ [221.25, 27.07], [218.02, 38.31] ], // Izar - Seginus
        [ [218.02, 38.31], [225.25, 40.39] ], // Seginus - Nekkar
        [ [225.25, 40.39], [221.25, 27.07] ], // Nekkar - Izar

        // Can Mayor
        [ [95.68, -17.96], [101.29, -16.72] ], // Murzim - Sirio
        [ [101.29, -16.72], [105.75, -15.63] ], // Sirio - Muliphein
        [ [101.29, -16.72], [107.10, -26.39] ], // Sirio - Wezen
        [ [107.10, -26.39], [104.66, -28.97] ], // Wezen - Adhara
        [ [107.10, -26.39], [111.02, -29.30] ]  // Wezen - Aludra
    ];

    // Construye las líneas geométricas de las constelaciones principales
    function buildConstellations(sphereRadius) {
        const geom = new THREE.BufferGeometry();
        const pts = [];

        CONSTELLATION_LINES.forEach(pair => {
            const v1 = radecToVector3(pair[0][0], pair[0][1], sphereRadius);
            const v2 = radecToVector3(pair[1][0], pair[1][1], sphereRadius);
            pts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
        });

        geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));

        const mat = new THREE.LineBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.35,
            depthWrite: false
        });

        const linesMesh = new THREE.LineSegments(geom, mat);
        linesMesh.name = "ConstellationLines";
        return linesMesh;
    }

    // Crea la retícula ecuatorial astronómica (Ecuador, paralelos y meridianos)
    function buildCelestialGraticule(sphereRadius) {
        const graticuleGroup = new THREE.Group();
        graticuleGroup.name = "CelestialGraticule";

        // 1. Ecuador Celeste (Dec = 0°): Círculo en azul cian luminoso
        const equatorGeom = new THREE.BufferGeometry();
        const equatorPoints = [];
        const segs = 180;
        for (let i = 0; i <= segs; i++) {
            const theta = (i / segs) * Math.PI * 2;
            equatorPoints.push(new THREE.Vector3(
                sphereRadius * Math.cos(theta),
                0,
                -sphereRadius * Math.sin(theta)
            ));
        }
        equatorGeom.setFromPoints(equatorPoints);
        const equatorMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.38,
            depthWrite: false
        });
        const equatorLine = new THREE.Line(equatorGeom, equatorMat);
        graticuleGroup.add(equatorLine);

        // 2. Paralelos de Declinación: ±30° y ±60° en azul noche sutil
        const decAngles = [-60, -30, 30, 60];
        const parallelMat = new THREE.LineBasicMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.16,
            depthWrite: false
        });

        decAngles.forEach(dec => {
            const decRad = dec * (Math.PI / 180);
            const rDec = sphereRadius * Math.cos(decRad);
            const yDec = sphereRadius * Math.sin(decRad);
            const pGeom = new THREE.BufferGeometry();
            const pPts = [];
            for (let i = 0; i <= segs; i++) {
                const theta = (i / segs) * Math.PI * 2;
                pPts.push(new THREE.Vector3(
                    rDec * Math.cos(theta),
                    yDec,
                    -rDec * Math.sin(theta)
                ));
            }
            pGeom.setFromPoints(pPts);
            graticuleGroup.add(new THREE.Line(pGeom, parallelMat));
        });

        // 3. Meridianos de Ascensión Recta (cada 30° / 2 horas de RA)
        const meridianMat = new THREE.LineBasicMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.14,
            depthWrite: false
        });
        const merSegs = 90;
        for (let ra = 0; ra < 360; ra += 30) {
            const raRad = ra * (Math.PI / 180);
            const mGeom = new THREE.BufferGeometry();
            const mPts = [];
            for (let j = 0; j <= merSegs; j++) {
                const dec = -90 + (j / merSegs) * 180;
                const decRad = dec * (Math.PI / 180);
                mPts.push(new THREE.Vector3(
                    sphereRadius * Math.cos(decRad) * Math.cos(raRad),
                    sphereRadius * Math.sin(decRad),
                    -sphereRadius * Math.cos(decRad) * Math.sin(raRad)
                ));
            }
            mGeom.setFromPoints(mPts);
            graticuleGroup.add(new THREE.Line(mGeom, meridianMat));
        }

        return graticuleGroup;
    }

    // Crea el conjunto de estrellas de referencia catalogadas con magnitudes visuales reales
    function buildReferenceStars(sphereRadius) {
        const starsGroup = new THREE.Group();
        starsGroup.name = "ReferenceStarsGroup";

        const positions = [];
        const colors = [];

        REFERENCE_STARS.forEach(star => {
            const v = radecToVector3(star.ra, star.dec, sphereRadius * 0.995);
            positions.push(v.x, v.y, v.z);

            const c = new THREE.Color(star.color);
            const lumMultiplier = star.mag < 0 ? 1.6 : (star.mag < 1.0 ? 1.3 : 1.0);
            colors.push(c.r * lumMultiplier, c.g * lumMultiplier, c.b * lumMultiplier);
        });

        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Textura procedural de halo circular suave para las estrellas brillantes
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.20, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.48, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        const starTexture = new THREE.CanvasTexture(canvas);

        // sizeAttenuation: false garantiza estrellas circulares nítidas y puntuales sin subpíxeles borrosos
        const mat = new THREE.PointsMaterial({
            size: 7.5,
            sizeAttenuation: false,
            vertexColors: true,
            map: starTexture,
            transparent: true,
            opacity: 0.98,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geom, mat);
        starsGroup.add(points);

        return starsGroup;
    }

    // Genera un campo estelar cósmico de fondo con ~1.500 estrellas nítidas
    function buildBackgroundStarfield(sphereRadius, count = 1600) {
        const geom = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        // Generador determinista pseudoaleatorio para reproducibilidad
        let seed = 42;
        function rnd() {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        }

        const colorPalette = [
            new THREE.Color("#dbeafe"), // Azulada
            new THREE.Color("#ffffff"), // Blanca pura
            new THREE.Color("#fef3c7"), // Amarillenta
            new THREE.Color("#ffedd5"), // Naranja suave
            new THREE.Color("#fee2e2")  // Rojiza tenue
        ];

        for (let i = 0; i < count; i++) {
            // Distribución uniforme sobre la esfera
            const u = rnd() * 2.0 - 1.0;
            const theta = rnd() * Math.PI * 2;
            const r = Math.sqrt(Math.max(0, 1.0 - u * u));

            const x = sphereRadius * r * Math.cos(theta);
            const y = sphereRadius * u;
            const z = sphereRadius * r * Math.sin(theta);

            positions.push(x, y, z);

            const c = colorPalette[Math.floor(rnd() * colorPalette.length)];
            const brightness = 0.35 + rnd() * 0.55;
            colors.push(c.r * brightness, c.g * brightness, c.b * brightness);
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Textura circular anti-aliased para evitar artefactos cuadrados en estrellas de fondo
        const dotCanvas = document.createElement('canvas');
        dotCanvas.width = 16;
        dotCanvas.height = 16;
        const dotCtx = dotCanvas.getContext('2d');
        const dotGrad = dotCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
        dotGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        dotGrad.addColorStop(0.40, 'rgba(255, 255, 255, 0.7)');
        dotGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        dotCtx.fillStyle = dotGrad;
        dotCtx.fillRect(0, 0, 16, 16);
        const dotTexture = new THREE.CanvasTexture(dotCanvas);

        const mat = new THREE.PointsMaterial({
            size: 2.2,
            sizeAttenuation: false,
            vertexColors: true,
            map: dotTexture,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        return new THREE.Points(geom, mat);
    }

    // Función constructora principal de la Esfera Celeste 3D
    function createCelestialSphere3D(radius = 10000) {
        const sphereGroup = new THREE.Group();
        sphereGroup.name = "CelestialSphere3D";
        sphereGroup.renderOrder = 1;

        // 1. Campo de estrellas de fondo (~1.600 estrellas)
        const starfield = buildBackgroundStarfield(radius * 0.99, 1600);
        sphereGroup.add(starfield);

        // 2. Retícula de coordenadas astronómicas (Ecuador y meridianos/paralelos)
        const graticule = buildCelestialGraticule(radius * 0.98);
        sphereGroup.add(graticule);

        // 3. Líneas de constelaciones clásicas (Orión, Osa Mayor, Casiopea, Cisne, etc.)
        const constellations = buildConstellations(radius * 0.985);
        sphereGroup.add(constellations);

        // 4. Estrellas de referencia catalogadas
        const refStars = buildReferenceStars(radius * 0.98);
        sphereGroup.add(refStars);

        // Exponer referencias directamente en el grupo raíz
        sphereGroup.starfieldGroup = starfield;
        sphereGroup.graticuleGroup = graticule;
        sphereGroup.constellationsGroup = constellations;
        sphereGroup.refStarsGroup = refStars;
        sphereGroup.sphereGroup = sphereGroup;

        return sphereGroup;
    }

    // Exposición en el entorno global
    window.createCelestialSphere3D = createCelestialSphere3D;
    window.REFERENCE_STARS = REFERENCE_STARS;

})(typeof window !== 'undefined' ? window : this);
