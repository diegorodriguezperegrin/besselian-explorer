/* =========================================================================
   COSMOS MATARÓ - MOTOR DE ESCENA 3D (lunar_scene_3d.js)
   Renderizador WebGL Three.js, cámara orbital, conos de sombra de la Tierra
   (umbra y penumbra), mallas celestes, órbita lunar y proyección espacial.
   ========================================================================= */

function _getDOM(id) {
    return (typeof getDOM === 'function') ? getDOM(id) : document.getElementById(id);
}

var scene3D = null;
var camera3D = null;
var renderer3D = null;
var controls3D = null;
var earthMesh3D = null;
var moonMesh3D = null;
var sunMesh3D = null;
var observerMarkerGroup3D = null;
var subsolarMarkerGroup3D = null;
var sublunarMarkerGroup3D = null;
var eclipticPlaneGroup3D = null;
var nodesGroup3D = null;
var umbraConeMesh3D = null;
var penumbraConeMesh3D = null;
var moonOrbitLine3D = null;
var graticuleGroup = null;
var moonPolarAxisGroup = null;
var orbitalLimitMarkers = null;
var cameraTransition3D = null;
// Constantes Físicas Globales 3D (1 unidad = 1.000 km)
var EARTH_RADIUS = 6.371;      // Radio Terrestre: 6.371 km
var MOON_RADIUS = 1.7374;     // Radio Lunar: 1.737,4 km (0,2727 R_Tierra)
var MOON_DIST = 384.4;        // Distancia Media Tierra-Luna: 384.400 km (60,33 R_Tierra)
var SUN_RADIUS = 696.34;      // Radio Solar: 696.340 km (109,3 R_Tierra)
var SUN_DIST = 149598.0;      // Distancia Tierra-Sol (1 UA): 149.597.870 km

        // 4. Motor de la Vista Espacial 3D (Three.js con Modelo de Tierra idéntico a Besselian Explorer)
        function latLngToVector3(lat, lng, radius = 6.37) {
            const latRad = lat * (Math.PI / 180);
            const lngRad = lng * (Math.PI / 180);

            const x =  radius * Math.cos(latRad) * Math.cos(lngRad);
            const y =  radius * Math.sin(latRad);
            const z = -radius * Math.cos(latRad) * Math.sin(lngRad);

            return new THREE.Vector3(x, y, z);
        }

        function vector3ToLatLng(v) {
            const r = v.length();
            if (r === 0) return { lat: 0, lon: 0 };
            const lat = Math.asin(Math.max(-1, Math.min(1, v.y / r))) * (180 / Math.PI);
            let lon = Math.atan2(-v.z, v.x) * (180 / Math.PI);
            return { lat, lon };
        }

        // [formatCoordDms, formatLatLonString] Extraído a lunar_observer_manager.js

        // Marcador 3D del Punto Subsolar (☀️ Sol en Cenit)
        function createSubsolarMarker3D() {
            const group = new THREE.Group();

            // 1. Núcleo solar esférico dorado brillante
            const coreGeo = new THREE.SphereGeometry(0.14, 16, 16);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
            const coreMesh = new THREE.Mesh(coreGeo, coreMat);
            group.add(coreMesh);

            // 2. Halo solar
            const haloGeo = new THREE.SphereGeometry(0.24, 16, 16);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.35 });
            const haloMesh = new THREE.Mesh(haloGeo, haloMat);
            group.add(haloMesh);

            // 3. Rayo cenital vertical hacia el Sol (apuntando al cenit)
            const rayGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8);
            const rayMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.9 });
            const rayMesh = new THREE.Mesh(rayGeo, rayMat);
            rayMesh.position.y = 0.45;
            group.add(rayMesh);

            group.visible = true;
            return group;
        }

        // Marcador 3D del Punto Sublunar (🌕 Luna en Cenit)
        function createSublunarMarker3D() {
            const group = new THREE.Group();

            // 1. Núcleo lunar esférico plateado
            const coreGeo = new THREE.SphereGeometry(0.14, 16, 16);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
            const coreMesh = new THREE.Mesh(coreGeo, coreMat);
            group.add(coreMesh);

            // 2. Halo lunar cian
            const haloGeo = new THREE.SphereGeometry(0.24, 16, 16);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
            const haloMesh = new THREE.Mesh(haloGeo, haloMat);
            group.add(haloMesh);

            // 3. Rayo cenital hacia la Luna
            const rayGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8);
            const rayMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
            const rayMesh = new THREE.Mesh(rayGeo, rayMat);
            rayMesh.position.y = 0.45;
            group.add(rayMesh);

            group.visible = true;
            return group;
        }

        // Marcador 3D de la Posición del Observador (📍 Mataró)
        function createObserverMarker3D() {
            const group = new THREE.Group();

            // 1. Cabeza de Pin cian brillante
            const pinGeo = new THREE.SphereGeometry(0.10, 16, 16);
            const pinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const pinMesh = new THREE.Mesh(pinGeo, pinMat);
            pinMesh.position.y = 0.45;
            group.add(pinMesh);

            // 2. Mástil del Pin
            const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.45, 8);
            const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
            const stemMesh = new THREE.Mesh(stemGeo, stemMat);
            stemMesh.position.y = 0.225;
            group.add(stemMesh);

            // 3. Anillo de baliza en la base
            const ringGeo = new THREE.RingGeometry(0.04, 0.14, 24);
            ringGeo.rotateX(Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.y = 0.01;
            group.add(ringMesh);

            group.visible = true;
            return group;
        }

        moonPolarAxisGroup = null;

        // Red geográfica 3D de la Tierra (Paralelos y Meridianos cada 15°) y Eje Polar
        function createGraticule() {
            const group = new THREE.Group();
            const material = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15
            });
            const axisMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.45
            });
            const EARTH_RADIUS = 6.37;
            const radius = EARTH_RADIUS * 1.002;

            // Paralelos (Latitud) cada 15°
            for (let lat = -75; lat <= 75; lat += 15) {
                const points = [];
                for (let lng = -180; lng <= 180; lng += 3) {
                    points.push(latLngToVector3(lat, lng, radius));
                }
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.LineLoop(geometry, material);
                group.add(line);
            }

            // Meridianos (Longitud) cada 15°
            for (let lng = -180; lng < 180; lng += 15) {
                const points = [];
                for (let lat = -87; lat <= 87; lat += 3) {
                    points.push(latLngToVector3(lat, lng, radius));
                }
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, material);
                group.add(line);
            }

            // Eje polar terrestre: marcas en polo norte y polo sur (segmento axial y cruceta de polo)
            const earthAxisPoints = [
                // Polo norte: segmento axial que sobresale del globo terrestre
                new THREE.Vector3(0, EARTH_RADIUS * 0.98, 0),
                new THREE.Vector3(0, EARTH_RADIUS * 1.14, 0),
                // Polo norte: cruceta superficial
                new THREE.Vector3(-0.23, EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(0.23, EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(0, EARTH_RADIUS * 1.002, -0.23),
                new THREE.Vector3(0, EARTH_RADIUS * 1.002, 0.23),

                // Polo sur: segmento axial que sobresale del globo terrestre
                new THREE.Vector3(0, -EARTH_RADIUS * 0.98, 0),
                new THREE.Vector3(0, -EARTH_RADIUS * 1.14, 0),
                // Polo sur: cruceta superficial
                new THREE.Vector3(-0.23, -EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(0.23, -EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(0, -EARTH_RADIUS * 1.002, -0.23),
                new THREE.Vector3(0, -EARTH_RADIUS * 1.002, 0.23)
            ];
            const earthAxisGeo = new THREE.BufferGeometry().setFromPoints(earthAxisPoints);
            const earthAxisLines = new THREE.LineSegments(earthAxisGeo, axisMaterial);
            group.add(earthAxisLines);

            return group;
        }

        // Marcas del eje polar lunar en polo norte y sur selenográficos
        function createMoonPolarAxis() {
            const group = new THREE.Group();
            const axisMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.45
            });

            const moonAxisPoints = [
                // Polo norte lunar: segmento axial que sobresale del limbo lunar
                new THREE.Vector3(0, MOON_RADIUS * 0.98, 0),
                new THREE.Vector3(0, MOON_RADIUS * 1.18, 0),
                // Polo norte lunar: cruceta superficial
                new THREE.Vector3(-0.08, MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0.08, MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0, MOON_RADIUS * 1.002, -0.08),
                new THREE.Vector3(0, MOON_RADIUS * 1.002, 0.08),

                // Polo sur lunar: segmento axial que sobresale del limbo lunar
                new THREE.Vector3(0, -MOON_RADIUS * 0.98, 0),
                new THREE.Vector3(0, -MOON_RADIUS * 1.18, 0),
                // Polo sur lunar: cruceta superficial
                new THREE.Vector3(-0.08, -MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0.08, -MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0, -MOON_RADIUS * 1.002, -0.08),
                new THREE.Vector3(0, -MOON_RADIUS * 1.002, 0.08)
            ];
            const moonAxisGeo = new THREE.BufferGeometry().setFromPoints(moonAxisPoints);
            const moonAxisLines = new THREE.LineSegments(moonAxisGeo, axisMaterial);
            group.add(moonAxisLines);

            return group;
        }

        // 5. Construcción del Plano Eclíptico 3D de Referencia (Idéntico a Simulador 3D)
        function createEclipticPlane3D() {
            const gridGroup = new THREE.Group();
            
            // GridHelper 3D vectorial en el plano horizontal Y = 0 (Eclíptica)
            // Escala Unificada: 100 Diámetros Terrestres (1.274.200 km = 1.274,2 unidades)
            // 100 divisiones -> Cada celda mide exactamente 1 Diámetro Terrestre (12,742 km)
            // Ejes orientadores en Amarillo dorado (0xfacc15) y líneas secundarias en ámbar cálido (0xa16207)
            const gridHelper = new THREE.GridHelper(1274.2, 100, 0xfacc15, 0xa16207);
            gridHelper.material.transparent = true;
            gridHelper.material.opacity = 0.50;
            gridHelper.material.depthWrite = false;

            // Inyección GLSL: Difumina suavemente la opacidad más allá de la órbita lunar (446.000 - 637.000 km = 446 - 637 unidades)
            gridHelper.material.onBeforeCompile = (shader) => {
                shader.vertexShader = `
                    varying vec3 vWorldPos;
                    ${shader.vertexShader}
                `.replace(
                    '#include <begin_vertex>',
                    `
                    #include <begin_vertex>
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    `
                );
                
                shader.fragmentShader = `
                    varying vec3 vWorldPos;
                    ${shader.fragmentShader}
                `.replace(
                    '#include <dithering_fragment>',
                    `
                    #include <dithering_fragment>
                    float dist = length(vWorldPos.xz);
                    float fade = 1.0 - smoothstep(446.0, 637.0, dist);
                    gl_FragColor.a *= fade;
                    `
                );
            };

            gridGroup.add(gridHelper);
            return gridGroup;
        }

        // Rótulos vectoriales sutiles para los Límites de Eclipse
        function createLimitSprite(text, colorHex) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Sombra suave para contraste sin caja invasiva
            ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
            ctx.shadowBlur = 8;
            ctx.fillStyle = colorHex;
            ctx.fillText(text, 128, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(22, 5.5, 1);
            sprite.renderOrder = 10;
            sprite.frustumCulled = false;
            return sprite;
        }

        // --- Sistema de Enfoque y Transición Suave de Cámara 3D (Doble Clic / Doble Tap) ---
        cameraTransition3D = null;
        focusedBody3D = null; // 'moon', 'earth', o null (global)

        function transitionCamera3D(targetControlsTarget, targetCameraPos, minDistance = 7.0, durationMs = 700) {
            cameraTransition3D = {
                startTarget: controls3D.target.clone(),
                endTarget: targetControlsTarget.clone(),
                startCamPos: camera3D.position.clone(),
                endCamPos: targetCameraPos.clone(),
                minDist: minDistance,
                startTime: performance.now(),
                duration: durationMs
            };
        }

        function handle3DDoubleClick(clientX, clientY) {
            if (!camera3D || !controls3D || currentActiveView !== '3d') return;

            const rect = renderer3D.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -((clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera3D);

            const rayOrigin = raycaster.ray.origin;
            const rayDir = raycaster.ray.direction.clone().normalize();

            // 1. Calcular distancia del rayo al centro de la Luna
            let distToMoonRay = Infinity;
            if (moonMesh3D) {
                const vMoon = moonMesh3D.position.clone().sub(rayOrigin);
                const projMoon = vMoon.dot(rayDir);
                if (projMoon > 0) {
                    const closestMoon = rayOrigin.clone().addScaledVector(rayDir, projMoon);
                    distToMoonRay = closestMoon.distanceTo(moonMesh3D.position);
                }
            }

            // 2. Calcular distancia del rayo al centro de la Tierra (0,0,0)
            let distToEarthRay = Infinity;
            const vEarth = new THREE.Vector3(0, 0, 0).sub(rayOrigin);
            const projEarth = vEarth.dot(rayDir);
            if (projEarth > 0) {
                const closestEarth = rayOrigin.clone().addScaledVector(rayDir, projEarth);
                distToEarthRay = closestEarth.distanceTo(new THREE.Vector3(0, 0, 0));
            }

            // Tolerancias de detección (amplias para que sea sumamente fácil acertar con doble clic)
            const moonTolerance = Math.max(MOON_RADIUS * 5.0, 14.0);
            const earthTolerance = Math.max(EARTH_RADIUS * 2.5, 20.0);

            if (distToMoonRay < moonTolerance && distToMoonRay <= distToEarthRay && moonMesh3D) {
                // Doble clic sobre la Luna -> Enfoque cercano detallado de la Luna
                focusedBody3D = 'moon';
                const moonPos = moonMesh3D.position.clone();
                let viewDir = camera3D.position.clone().sub(moonPos);
                if (viewDir.lengthSq() < 0.001) viewDir = new THREE.Vector3(0, 2, 8);
                viewDir.normalize();

                const targetCamPos = moonPos.clone().addScaledVector(viewDir, 8.5);
                transitionCamera3D(moonPos, targetCamPos, 2.2, 700);
            } else if (distToEarthRay < earthTolerance) {
                // Doble clic sobre la Tierra -> Enfoque en el globo terráqueo
                focusedBody3D = 'earth';
                const earthPos = new THREE.Vector3(0, 0, 0);
                let viewDir = camera3D.position.clone().sub(earthPos);
                if (viewDir.lengthSq() < 0.001) viewDir = new THREE.Vector3(0, 30, 60);
                viewDir.normalize();

                const targetCamPos = earthPos.clone().addScaledVector(viewDir, 28.0);
                transitionCamera3D(earthPos, targetCamPos, 7.0, 700);
            } else {
                // Doble clic en el espacio vacío -> Regreso a la Vista Global del Sistema de Eclipse
                focusedBody3D = null;
                transitionCamera3D(
                    new THREE.Vector3(0, -10, -190),
                    new THREE.Vector3(0, 130, 300),
                    7.0,
                    750
                );
            }
        }

        // [Globe picking mode] Extraído a lunar_observer_manager.js

        function initThreeJS() {
            const container = document.getElementById('webgl-container');
            if (!container) return;
            container.innerHTML = '';
            const w = window.innerWidth, h = window.innerHeight;

            scene3D = new THREE.Scene();
            camera3D = new THREE.PerspectiveCamera(45, w / h, 1.0, 500000);
            camera3D.position.set(0, 130, 300);

            renderer3D = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer3D.setSize(w, h);
            renderer3D.setPixelRatio(window.devicePixelRatio || 1);
            renderer3D.shadowMap.enabled = true;
            container.appendChild(renderer3D.domElement);

            controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
            controls3D.enableDamping = true;
            controls3D.dampingFactor = 0.05;
            controls3D.target.set(0, -10, -190);
            controls3D.minDistance = 2.0;
            controls3D.maxDistance = 450000;
            controls3D.enablePan = true;
            controls3D.screenSpacePanning = true;
            controls3D.panSpeed = 1.2;
            controls3D.rotateSpeed = 0.9;
            controls3D.zoomSpeed = 1.2;

            // Botones del ratón: Clic derecho o botón central desplazan (Pan); Clic izquierdo orbita
            // (Shift + Clic izquierdo o Ctrl + Clic izquierdo también desplazan nativamente)
            controls3D.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.PAN
            };

            // Soporte para que Alt + Clic también active el desplazamiento libre
            renderer3D.domElement.addEventListener('pointerdown', (e) => {
                if (e.altKey && e.button === 0) {
                    try {
                        Object.defineProperty(e, 'shiftKey', { get: () => true });
                    } catch (_) {}
                }
            }, { capture: true });

            renderer3D.domElement.style.touchAction = 'none';
            renderer3D.domElement.style.userSelect = 'none';

            controls3D.addEventListener('start', () => {
                cameraTransition3D = null;
                focusedBody3D = null;
            });
            controls3D.addEventListener('change', () => {
                scene3DNeedsRender = true;
            });

            // Soporte de flechas del teclado y teclas WASD para desplazamiento fino
            window.addEventListener('keydown', (e) => {
                if (currentActiveView !== '3d' || !controls3D || !camera3D) return;
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;

                const panDist = Math.max(1.0, (camera3D.position.distanceTo(controls3D.target) || 200) * 0.04);
                let moved = false;
                const vRight = new THREE.Vector3().setFromMatrixColumn(camera3D.matrix, 0);
                const vUp = new THREE.Vector3().setFromMatrixColumn(camera3D.matrix, 1);

                if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                    controls3D.target.addScaledVector(vRight, -panDist);
                    camera3D.position.addScaledVector(vRight, -panDist);
                    moved = true;
                } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                    controls3D.target.addScaledVector(vRight, panDist);
                    camera3D.position.addScaledVector(vRight, panDist);
                    moved = true;
                } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                    controls3D.target.addScaledVector(vUp, panDist);
                    camera3D.position.addScaledVector(vUp, panDist);
                    moved = true;
                } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                    controls3D.target.addScaledVector(vUp, -panDist);
                    camera3D.position.addScaledVector(vUp, -panDist);
                    moved = true;
                }

                if (moved) {
                    e.preventDefault();
                    cameraTransition3D = null;
                    focusedBody3D = null;
                    controls3D.update();
                }
            });

            renderer3D.domElement.addEventListener('dblclick', (e) => {
                handle3DDoubleClick(e.clientX, e.clientY);
            });

            let globePointerStartX = 0, globePointerStartY = 0;
            let globePointerStartTime = 0;

            renderer3D.domElement.addEventListener('pointerdown', (e) => {
                globePointerStartX = e.clientX;
                globePointerStartY = e.clientY;
                globePointerStartTime = Date.now();
            });

            renderer3D.domElement.addEventListener('pointerup', (e) => {
                const dist = Math.hypot(e.clientX - globePointerStartX, e.clientY - globePointerStartY);
                const time = Date.now() - globePointerStartTime;
                if (isGlobePickingMode && dist < 6 && time < 450 && e.button === 0) {
                    handleGlobePickingClick(e.clientX, e.clientY);
                }
            });

            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && isGlobePickingMode) {
                    cancelGlobePicking();
                }
            });

            let lastTapTime3D = 0;
            renderer3D.domElement.addEventListener('touchend', (e) => {
                const now = Date.now();
                if (now - lastTapTime3D < 350 && e.changedTouches.length === 1) {
                    const touch = e.changedTouches[0];
                    handle3DDoubleClick(touch.clientX, touch.clientY);
                    lastTapTime3D = 0;
                } else {
                    lastTapTime3D = now;
                }
            });

            // Iluminación Cósmica
            const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
            sunLight.position.set(0, 0, 1000);
            scene3D.add(sunLight);

            // Luz ambiental difusa para visión clara de la geografía terrestre en todas las caras
            const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.90);
            scene3D.add(ambientLight);

            // Luz suave indirecta desde el hemisferio nocturno (-Z)
            const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.40);
            fillLight.position.set(0, 50, -500);
            scene3D.add(fillLight);

            // ☀️ Sol 3D con Corona Radiante Óptica (Additive Blending)
            function createSunCoronaTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                const grad = ctx.createRadialGradient(256, 256, 110, 256, 256, 256);
                grad.addColorStop(0.0, 'rgba(255, 255, 245, 1.0)');
                grad.addColorStop(0.2, 'rgba(254, 240, 138, 0.80)');
                grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.40)');
                grad.addColorStop(0.75, 'rgba(217, 119, 6, 0.12)');
                grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 512, 512);
                const tex = new THREE.CanvasTexture(canvas);
                tex.needsUpdate = true;
                return tex;
            }

            const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
            const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
            sunMesh3D = new THREE.Mesh(sunGeo, sunMat);
            sunMesh3D.position.set(0, 0, SUN_DIST);

            const coronaMat = new THREE.SpriteMaterial({
                map: createSunCoronaTexture(),
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sunCoronaSprite = new THREE.Sprite(coronaMat);
            sunCoronaSprite.scale.set(SUN_RADIUS * 4.2, SUN_RADIUS * 4.2, 1);
            sunMesh3D.add(sunCoronaSprite);
            scene3D.add(sunMesh3D);

            // Esfera de la Tierra (Modelo de alta resolución NASA 2048x1024 + Atmósfera)
            const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
            const earthMat = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                specular: new THREE.Color(0x222222),
                shininess: 15
            });

            const earthSrc = (typeof ORIGINAL_EARTH_BASE64 !== 'undefined') ? ORIGINAL_EARTH_BASE64 : 'earth_topo_2048.jpg';
            const earthTexture = new THREE.TextureLoader().load(earthSrc, function(tex) {
                tex.needsUpdate = true;
                earthMat.needsUpdate = true;
                requestRender3D();
            });
            earthMat.map = earthTexture;

            earthGroup = new THREE.Group();
            earthMesh3D = new THREE.Mesh(earthGeo, earthMat);
            earthGroup.add(earthMesh3D);

            // Atmósfera brillante estilo Besselian
            const atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 128, 128);
            const atmosphereMaterial = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.14,
                depthWrite: false,
                side: THREE.BackSide
            });
            atmosphereMesh3D = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
            earthGroup.add(atmosphereMesh3D);

            // Marcador del Observador (📍 Posición Local) - anclado a la superficie terrestre
            observerMarkerGroup3D = createObserverMarker3D();
            observerMarkerGroup3D.position.copy(latLngToVector3(currentObserver.lat, currentObserver.lon, EARTH_RADIUS * 1.004));
            observerMarkerGroup3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), latLngToVector3(currentObserver.lat, currentObserver.lon, 1.0).normalize());
            earthMesh3D.add(observerMarkerGroup3D);

            // Red geográfica 3D (Paralelos y Meridianos cada 15°)
            graticuleGroup = createGraticule();
            const showGraticule = document.getElementById('chk-show-graticule')?.checked ?? false;
            graticuleGroup.visible = showGraticule;
            earthMesh3D.add(graticuleGroup);

            scene3D.add(earthGroup);

            // Marcador Subsolar (☀️ Sol en Cenit) - anclado a la geografía terrestre
            subsolarMarkerGroup3D = createSubsolarMarker3D();
            earthMesh3D.add(subsolarMarkerGroup3D);

            // Marcador Sublunar (🌕 Luna en Cenit) - anclado a la geografía terrestre
            sublunarMarkerGroup3D = createSublunarMarker3D();
            earthMesh3D.add(sublunarMarkerGroup3D);

            // Shader de Difuminado Volumétrico Suave con la Distancia en el Espacio
            const coneVertexShader = `
                precision highp float;
                varying vec3 vWorldPos;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPos.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `;

            const coneFragmentShader = `
                precision highp float;
                uniform vec3 uColor;
                uniform float uMaxOpacity;
                uniform float uNearFadeStart;
                uniform float uNearFadeEnd;
                uniform float uFarFadeStart;
                uniform float uFarFadeEnd;
                varying vec3 vWorldPos;

                void main() {
                    float nearAlpha = smoothstep(uNearFadeStart, uNearFadeEnd, vWorldPos.z);
                    float farAlpha = smoothstep(uFarFadeEnd, uFarFadeStart, vWorldPos.z);
                    float alpha = uMaxOpacity * nearAlpha * farAlpha;
                    gl_FragColor = vec4(uColor, alpha);
                }
            `;

            // Grupo general de Conos y Secciones de Sombra Terrestre 3D
            shadowConesGroup3D = new THREE.Group();
            scene3D.add(shadowConesGroup3D);

            // Cono de Umbra Terrestre 3D a Escala Física Real: convergiendo en z = -1.381,4 unidades (1.381.400 km)
            const umbraLength = SUN_DIST * (EARTH_RADIUS / (SUN_RADIUS - EARTH_RADIUS)); // ~1381.4
            const umbraGeo = new THREE.CylinderGeometry(EARTH_RADIUS, 0, umbraLength, 128, 1, true);
            umbraGeo.rotateX(Math.PI / 2);
            const umbraMat = new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                uniforms: {
                    uColor: { value: new THREE.Color(0x0a101d) }, // Tono oscuro y profundo de sombra espacial
                    uMaxOpacity: { value: 0.60 },
                    uNearFadeStart: { value: 0.0 },
                    uNearFadeEnd: { value: -15.0 },
                    uFarFadeStart: { value: -500.0 },
                    uFarFadeEnd: { value: -umbraLength }
                },
                vertexShader: coneVertexShader,
                fragmentShader: coneFragmentShader
            });
            umbraConeMesh3D = new THREE.Mesh(umbraGeo, umbraMat);
            umbraConeMesh3D.position.set(0, 0, -umbraLength / 2);
            umbraConeMesh3D.renderOrder = 2;
            shadowConesGroup3D.add(umbraConeMesh3D);

            // Cono de Penumbra Terrestre 3D a Escala Física Real (cono divergente)
            const penLength = 800.0;
            const penEndRadius = EARTH_RADIUS + ((SUN_RADIUS + EARTH_RADIUS) / SUN_DIST) * penLength; // ~10.12
            const penGeo = new THREE.CylinderGeometry(EARTH_RADIUS, penEndRadius, penLength, 128, 1, true);
            penGeo.rotateX(Math.PI / 2);
            const penMat = new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                uniforms: {
                    uColor: { value: new THREE.Color(0x1e293b) }, // Tono de semisombra tenue
                    uMaxOpacity: { value: 0.25 },
                    uNearFadeStart: { value: 0.0 },
                    uNearFadeEnd: { value: -15.0 },
                    uFarFadeStart: { value: -500.0 },
                    uFarFadeEnd: { value: -penLength }
                },
                vertexShader: coneVertexShader,
                fragmentShader: coneFragmentShader
            });
            penumbraConeMesh3D = new THREE.Mesh(penGeo, penMat);
            penumbraConeMesh3D.position.set(0, 0, -penLength / 2);
            penumbraConeMesh3D.renderOrder = 1;
            shadowConesGroup3D.add(penumbraConeMesh3D);

            // Luna 3D con Textura Equirrectangular Oficial NASA LRO (2048x1024) y Shader Volumétrico de Sombra
            const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 64, 64);
            moonMat = new THREE.MeshPhongMaterial({
                shininess: 6
            });
            moonMat.userData = {
                uUmbraRadius: { value: 4.60 },
                uPenumbraRadius: { value: 8.18 }
            };
            moonMat.onBeforeCompile = function(shader) {
                shader.uniforms.uUmbraRadius = moonMat.userData.uUmbraRadius;
                shader.uniforms.uPenumbraRadius = moonMat.userData.uPenumbraRadius;

                shader.vertexShader = 'varying vec3 vWorldPos;\n' + shader.vertexShader.replace(
                    '#include <worldpos_vertex>',
                    `#include <worldpos_vertex>
                    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
                );

                shader.fragmentShader = 'varying vec3 vWorldPos;\nuniform float uUmbraRadius;\nuniform float uPenumbraRadius;\n' + shader.fragmentShader.replace(
                    '#include <dithering_fragment>',
                    `#include <dithering_fragment>
                    float distShadow = length(vWorldPos.xy);
                    if (distShadow < uUmbraRadius) {
                        float uFrac = clamp((uUmbraRadius - distShadow) / (uUmbraRadius * 0.4), 0.0, 1.0);
                        vec3 bloodRed = vec3(0.66, 0.20, 0.12);
                        vec3 darkCopper = vec3(0.22, 0.06, 0.03);
                        vec3 umbraTone = mix(bloodRed, darkCopper, uFrac);
                        // Mezcla la textura lunar en umbra con la refracción atmosférica rojiza
                        gl_FragColor.rgb = gl_FragColor.rgb * 0.12 + umbraTone * (0.38 + 0.15 * (1.0 - uFrac));
                    } else if (distShadow < uPenumbraRadius) {
                        float pFrac = (distShadow - uUmbraRadius) / (uPenumbraRadius - uUmbraRadius);
                        float dimming = mix(0.30, 1.0, smoothstep(0.0, 1.0, pFrac));
                        gl_FragColor.rgb *= dimming;
                    }
                    `
                );
            };

            const texLoader = new THREE.TextureLoader();
            const moonSrc = (typeof MOON_TOPO_BASE64 !== 'undefined') ? MOON_TOPO_BASE64 : 'moon_topo_2048.jpg';
            const moonTexture3D = texLoader.load(moonSrc, function(tex) {
                tex.needsUpdate = true;
                if (moonMat) {
                    moonMat.map = tex;
                    moonMat.needsUpdate = true;
                }
                requestRender3D();
            });
            moonMat.map = moonTexture3D;
            moonMesh3D = new THREE.Mesh(moonGeo, moonMat);
            scene3D.add(moonMesh3D);

            moonPolarAxisGroup = createMoonPolarAxis();
            moonPolarAxisGroup.visible = document.getElementById('chk-show-graticule')?.checked ?? false;
            moonMesh3D.add(moonPolarAxisGroup);

            // Línea de Órbita Lunar 3D (Azul celeste luminoso idéntico a Solar Eclipse Explorer)
            const orbitMat = new THREE.LineBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.60,
                depthWrite: false
            });
            const orbitGeo = new THREE.BufferGeometry();
            moonOrbitLine3D = new THREE.Line(orbitGeo, orbitMat);
            moonOrbitLine3D.frustumCulled = false;
            moonOrbitLine3D.renderOrder = 7;
            scene3D.add(moonOrbitLine3D);

            // Línea de los Nodos 3D (Eje de intersección entre el plano orbital lunar y el plano eclíptico) en Azul celeste luminoso
            const nodeLineMat = new THREE.LineBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.95,
                depthWrite: false
            });
            nodeLine3D = new THREE.Line(new THREE.BufferGeometry(), nodeLineMat);
            nodeLine3D.frustumCulled = false;
            nodeLine3D.renderOrder = 8;
            scene3D.add(nodeLine3D);

            // Plano Eclíptico 3D de Referencia
            eclipticPlaneGroup3D = createEclipticPlane3D();
            const showEcliptic = document.getElementById('chk-show-ecliptic') ? document.getElementById('chk-show-ecliptic').checked : true;
            const showNodes = document.getElementById('chk-show-nodes') ? document.getElementById('chk-show-nodes').checked : true;
            eclipticPlaneGroup3D.visible = showEcliptic;
            nodeLine3D.visible = showNodes;
            scene3D.add(eclipticPlaneGroup3D);

            const showCones = document.getElementById('chk-show-cones') ? document.getElementById('chk-show-cones').checked : true;
            toggle3DCones(showCones);

            document.getElementById('chk-show-subsolar')?.addEventListener('change', (e) => {
                if (subsolarMarkerGroup3D) subsolarMarkerGroup3D.visible = e.target.checked;
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });
            document.getElementById('chk-show-sublunar')?.addEventListener('change', (e) => {
                if (sublunarMarkerGroup3D) sublunarMarkerGroup3D.visible = e.target.checked;
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });
            document.getElementById('chk-show-observer')?.addEventListener('change', (e) => {
                if (observerMarkerGroup3D) observerMarkerGroup3D.visible = e.target.checked;
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });
            document.getElementById('chk-show-graticule')?.addEventListener('change', (e) => {
                if (graticuleGroup) graticuleGroup.visible = e.target.checked;
                if (moonPolarAxisGroup) moonPolarAxisGroup.visible = e.target.checked;
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });
            document.getElementById('chk-show-ecliptic')?.addEventListener('change', (e) => {
                if (eclipticPlaneGroup3D) eclipticPlaneGroup3D.visible = e.target.checked;
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });
            document.getElementById('chk-show-nodes')?.addEventListener('change', (e) => {
                if (nodeLine3D) nodeLine3D.visible = e.target.checked;
                update3DEclipseGeometry();
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });

            // Grupo 3D de Marcas de Límites de Eclipse sobre la Órbita Lunar
            eclipseLimitsGroup3D = new THREE.Group();
            eclipseLimitsGroup3D.renderOrder = 10;
            const showLimits = document.getElementById('chk-show-limits') ? document.getElementById('chk-show-limits').checked : true;
            eclipseLimitsGroup3D.visible = showLimits;
            scene3D.add(eclipseLimitsGroup3D);

            document.getElementById('chk-show-limits')?.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                const chkSub = document.getElementById('chk-show-limits-labels');
                const lblSub = document.getElementById('lbl-show-limits-labels');
                if (chkSub) chkSub.disabled = !enabled;
                if (lblSub) lblSub.classList.toggle('disabled', !enabled);
                if (eclipseLimitsGroup3D) eclipseLimitsGroup3D.visible = enabled;
                update3DEclipseGeometry();
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });

            document.getElementById('chk-show-limits-labels')?.addEventListener('change', () => {
                update3DEclipseGeometry();
                scene3DNeedsRender = true;
                if (renderer3D && scene3D && camera3D) renderer3D.render(scene3D, camera3D);
            });

            window.addEventListener('resize', onWindowResize3D);
        }

        function onWindowResize3D() {
            if (!camera3D || !renderer3D) return;
            const w = window.innerWidth, h = window.innerHeight;
            camera3D.aspect = w / h;
            camera3D.updateProjectionMatrix();
            renderer3D.setSize(w, h);
        }

        function update3DEclipseGeometry() {
            if (!moonMesh3D || !currentEclipse) return;
            const geo = getMoonShadowCoordsAtTime(simCurrentTimeMs);
            const rUmbra3D = geo.rUmbraKm;
            const rPenumbra3D = geo.rPenumbraKm;

            // Coordenadas 3D canónicas del eclipse en el sistema de referencia físico Tierra-Sol-Sombra:
            // - El eje Z (-Z) es el eje central de la sombra terrestre (línea Sol-Tierra-Sombra).
            // - El eje X es el movimiento orbital lunar transversal antihorario (de +X a -X en la sombra).
            // - El eje Y es el parámetro de impacto Gamma (Norte +Y / Sur -Y celeste).
            const x3D = geo.x * MOON_RADIUS; // En P1 (inicio) a la derecha (+X) y en P4 (fin) a la izquierda (-X)
            const y3D = (currentEclipse.gamma >= 0 ? 1 : -1) * Math.abs(geo.y) * MOON_RADIUS; // Gamma > 0 es Norte (+Y, arriba de la eclíptica)
            const z3D = -Math.sqrt(Math.max(0, MOON_DIST * MOON_DIST - x3D * x3D - y3D * y3D));
            const moonPos = new THREE.Vector3(x3D, y3D, z3D);

            // Inclinación física astronómica pura del plano orbital lunar (i = 5.145°) respecto a la Eclíptica
            const realSlope = Math.tan(5.145 * RAD);
            const isAscending = (currentEclipse.saros % 2 === 0);
            // En sentido orbital antihorario (de derecha a izquierda a través de la sombra en -Z):
            // al avanzar de +X a -X la Luna asciende del Nodo en Y=0 hacia el Norte (+Y > 0)
            const slope = (isAscending ? -1 : 1) * realSlope;
            const zMax = -Math.sqrt(Math.max(0, MOON_DIST * MOON_DIST - y3D * y3D));
            // Vector normal del plano orbital con pendiente dy/dx = slope
            let normOrbit = new THREE.Vector3(zMax * slope, -zMax, y3D).normalize();
            const normEcliptic = new THREE.Vector3(0, 1, 0);
            if (normOrbit.dot(normEcliptic) < 0) normOrbit.negate();

            // Tercera ley de Cassini: el eje de rotación lunar (moonSpinAxis), la normal a la Eclíptica (normEcliptic)
            // y la normal a la órbita (normOrbit) son coplanarios, con normEcliptic situado entre ambos.
            // Inclinación del eje de rotación lunar respecto a la Eclíptica: I = 1.543° (en sentido opuesto a la órbita)
            const vTilt = normOrbit.clone().sub(normEcliptic.clone().multiplyScalar(normOrbit.dot(normEcliptic))).normalize();
            const incMoonSpinRad = 1.543 * RAD;
            const moonSpinAxis = new THREE.Vector3()
                .addScaledVector(normEcliptic, Math.cos(incMoonSpinRad))
                .addScaledVector(vTilt, -Math.sin(incMoonSpinRad))
                .normalize();

            // Orientación de la Luna según el estado de Cassini y anclaje de marea:
            // Eje +Y local: Eje polar físico de rotación lunar (inclinado exactamente 1.543° respecto a la Eclíptica)
            // Eje +X local: Meridiano central selenográfico de la cara visible (apuntando hacia la Tierra)
            // Eje +Z local: Completa el triedro ortonormal hacia el limbo orbital lunar
            moonMesh3D.position.copy(moonPos);
            const vToEarth = moonPos.clone().negate().normalize();
            const axisY = moonSpinAxis.clone().normalize();
            const axisX = vToEarth.clone().sub(axisY.clone().multiplyScalar(vToEarth.dot(axisY))).normalize();
            const axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();
            const rotMatrix = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
            moonMesh3D.quaternion.setFromRotationMatrix(rotMatrix);

            // Base ortonormal en el plano orbital:
            const e1 = new THREE.Vector3(0, y3D, zMax).normalize();
            const e2 = new THREE.Vector3().crossVectors(normOrbit, e1).normalize();
            if (e2.x > 0) e2.negate(); // Sentido orbital de traslación hacia -X (antihorario)

            // Actualizar trayectoria orbital 3D alrededor de la Tierra pasando EXACTAMENTE por la Luna
            if (moonOrbitLine3D) {
                const pts = [];
                for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.04) {
                    const pos = new THREE.Vector3()
                        .addScaledVector(e1, MOON_DIST * Math.cos(a))
                        .addScaledVector(e2, MOON_DIST * Math.sin(a));
                    pts.push(pos);
                }
                moonOrbitLine3D.geometry.setFromPoints(pts);
                moonOrbitLine3D.geometry.computeBoundingSphere();
            }

            // Vector unitario de la Línea de los Nodos (intersección entre el plano orbital y el plano eclíptico Y = 0)
            const uNode = new THREE.Vector3(normOrbit.z, 0, -normOrbit.x).normalize();
            if (uNode.z > 0) uNode.negate(); // Apuntar hacia el nodo del eclipse (hacia la sombra -Z)

            // Actualizar Línea de los Nodos (Eje longitudinal que atraviesa la Tierra y une ambos nodos)
            const NODE_R = 700.0;
            if (nodeLine3D) {
                const showNodes = document.getElementById('chk-show-nodes') ? document.getElementById('chk-show-nodes').checked : true;
                nodeLine3D.visible = showNodes;
                const nodePts = [
                    uNode.clone().multiplyScalar(-NODE_R),
                    uNode.clone().multiplyScalar(NODE_R)
                ];
                nodeLine3D.geometry.setFromPoints(nodePts);
                nodeLine3D.geometry.computeBoundingSphere();
            }

            // Actualizar Marcas de Límites de Eclipse en la Órbita Lunar (Totalidad, Parcial y Penumbral)
            if (eclipseLimitsGroup3D) {
                const showLimits = document.getElementById('chk-show-limits') ? document.getElementById('chk-show-limits').checked : true;
                const showLabels = showLimits && (document.getElementById('chk-show-limits-labels')?.checked ?? false);
                eclipseLimitsGroup3D.visible = showLimits;

                while (eclipseLimitsGroup3D.children.length > 0) {
                    const child = eclipseLimitsGroup3D.children[0];
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                    eclipseLimitsGroup3D.remove(child);
                }

                if (showLimits) {
                    // --- Secciones transversales ortogonales de Sombra a la distancia lunar (z = -MOON_DIST) ---
                    const createCirclePoints = (radius, segments = 96) => {
                        const pts = [];
                        for (let i = 0; i <= segments; i++) {
                            const theta = (i / segments) * Math.PI * 2;
                            pts.push(new THREE.Vector3(radius * Math.cos(theta), radius * Math.sin(theta), -MOON_DIST));
                        }
                        return pts;
                    };

                    // 1. Perímetro de Umbra (Línea sutil sin relleno chillón)
                    const umbraLineGeo = new THREE.BufferGeometry().setFromPoints(createCirclePoints(rUmbra3D));
                    const umbraLineMat = new THREE.LineBasicMaterial({
                        color: 0xc2410c,
                        transparent: true,
                        opacity: 0.85,
                        depthWrite: false
                    });
                    const umbraLine = new THREE.Line(umbraLineGeo, umbraLineMat);
                    umbraLine.renderOrder = 5;
                    umbraLine.frustumCulled = false;
                    eclipseLimitsGroup3D.add(umbraLine);

                    // 2. Perímetro de Penumbra (Línea celeste tenue)
                    const penLineGeo = new THREE.BufferGeometry().setFromPoints(createCirclePoints(rPenumbra3D));
                    const penLineMat = new THREE.LineBasicMaterial({
                        color: 0x38bdf8,
                        transparent: true,
                        opacity: 0.70,
                        depthWrite: false
                    });
                    const penLine = new THREE.Line(penLineGeo, penLineMat);
                    penLine.renderOrder = 4;
                    penLine.frustumCulled = false;
                    eclipseLimitsGroup3D.add(penLine);

                    // Cruz de ejes ortogonales de la sombra
                    const crossPts = [
                        new THREE.Vector3(-rPenumbra3D * 1.12, 0, -MOON_DIST),
                        new THREE.Vector3(rPenumbra3D * 1.12, 0, -MOON_DIST),
                        new THREE.Vector3(0, -rPenumbra3D * 1.12, -MOON_DIST),
                        new THREE.Vector3(0, rPenumbra3D * 1.12, -MOON_DIST)
                    ];
                    const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPts);
                    const crossMat = new THREE.LineBasicMaterial({
                        color: 0x64748b,
                        transparent: true,
                        opacity: 0.35,
                        depthWrite: false
                    });
                    const crossLines = new THREE.LineSegments(crossGeo, crossMat);
                    crossLines.renderOrder = 3;
                    crossLines.frustumCulled = false;
                    eclipseLimitsGroup3D.add(crossLines);

                    // Rótulos de las secciones de sombra a la distancia lunar (si los rótulos están activados)
                    if (showLabels) {
                        const umbraSectionSprite = createLimitSprite('Umbra', '#c2410c');
                        umbraSectionSprite.scale.set(10, 2.5, 1);
                        umbraSectionSprite.position.set(0, rUmbra3D + 1.0, -MOON_DIST);
                        eclipseLimitsGroup3D.add(umbraSectionSprite);

                        const penSectionSprite = createLimitSprite('Penumbra', '#38bdf8');
                        penSectionSprite.scale.set(12, 3.0, 1);
                        penSectionSprite.position.set(0, rPenumbra3D + 1.2, -MOON_DIST);
                        eclipseLimitsGroup3D.add(penSectionSprite);
                    }

                    // Vector unitario tangente a la órbita (sentido de traslación lunar hacia -X)
                    const uTangent = new THREE.Vector3().crossVectors(normOrbit, uNode).normalize();
                    if (uTangent.x > 0) uTangent.negate();

                    const denom = MOON_DIST * Math.sin(5.145 * RAD);
                    const limTotalDeg = Math.asin(Math.max(0, rUmbra3D - MOON_RADIUS) / denom) * DEG;     // ~4.8°
                    const limParcialDeg = Math.asin((rUmbra3D + MOON_RADIUS) / denom) * DEG;              // ~10.6°
                    const limPenumbralDeg = Math.asin((rPenumbra3D + MOON_RADIUS) / denom) * DEG;        // ~16.7°

                    const LIMITS = [
                        { name: 'Nodo (0°)', deg: 0.0, color: 0x38bdf8, colorHex: '#38bdf8', tickLen: 6.0, single: true },
                        { name: 'Total (4.8°)', deg: limTotalDeg, color: 0xef4444, colorHex: '#ef4444', tickLen: 4.5 },
                        { name: 'Parcial (10.6°)', deg: limParcialDeg, color: 0xf59e0b, colorHex: '#f59e0b', tickLen: 4.5 },
                        { name: 'Penumbral (16.7°)', deg: limPenumbralDeg, color: 0x06b6d4, colorHex: '#06b6d4', tickLen: 4.5 }
                    ];

                    LIMITS.forEach(lim => {
                        const signs = lim.single ? [0] : [1, -1];
                        signs.forEach(sign => {
                            const angleRad = sign * lim.deg * RAD;
                            const pos = new THREE.Vector3()
                                .addScaledVector(uNode, MOON_DIST * Math.cos(angleRad))
                                .addScaledVector(uTangent, MOON_DIST * Math.sin(angleRad));

                            // Línea corta vertical perpendicular al plano orbital
                            const tickPts = [
                                pos.clone().addScaledVector(normOrbit, -lim.tickLen),
                                pos.clone().addScaledVector(normOrbit, lim.tickLen)
                            ];
                            const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPts);
                            const tickMat = new THREE.LineBasicMaterial({ color: lim.color, transparent: true, opacity: 0.95, depthWrite: false });
                            const tickLine = new THREE.Line(tickGeo, tickMat);
                            tickLine.frustumCulled = false;
                            eclipseLimitsGroup3D.add(tickLine);

                            // Rótulo optativo sutil (si está activado en el panel de opciones)
                            if (showLabels) {
                                const labelText = (lim.single ? lim.name : (sign > 0 ? `+${lim.name}` : `-${lim.name}`));
                                const sprite = createLimitSprite(labelText, lim.colorHex);
                                sprite.position.copy(pos).addScaledVector(normOrbit, lim.tickLen + 3.5);
                                eclipseLimitsGroup3D.add(sprite);
                            }
                        });
                    });
                }
            }

            // Actualizar Marcadores 3D sobre la Tierra (Subsolar, Sublunar y Observador)
            const coords = getSubsolarAndSublunarCoords(simCurrentTimeMs);

            // Orientación física astronómica del globo terrestre:
            // 1. Inclinación del eje polar respecto a la Eclíptica según la declinación subsolar (inclinación en X)
            if (earthGroup) {
                earthGroup.rotation.x = coords.subsolar.lat * RAD;
                earthGroup.rotation.z = 0;
            }
            // 2. Rotación diurna en tiempo real: orienta el meridiano subsolar hacia el Sol (+Z) y el sublunar hacia la Luna (-Z)
            if (earthMesh3D) {
                earthMesh3D.rotation.y = (-90 - coords.subsolar.lon) * RAD;
            }

            // 1. Punto Subsolar (☀️ Sol en Cenit): anclado a la coordenada geográfica real (latitud, longitud)
            if (subsolarMarkerGroup3D) {
                const showSubsolar = document.getElementById('chk-show-subsolar')?.checked ?? true;
                subsolarMarkerGroup3D.visible = showSubsolar;
                if (showSubsolar) {
                    const solPos = latLngToVector3(coords.subsolar.lat, coords.subsolar.lon, EARTH_RADIUS * 1.004);
                    subsolarMarkerGroup3D.position.copy(solPos);
                    subsolarMarkerGroup3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), solPos.clone().normalize());
                }
            }

            // 2. Punto Sublunar (🌕 Luna en Cenit): anclado a la coordenada geográfica real (latitud, longitud)
            if (sublunarMarkerGroup3D) {
                const showSublunar = document.getElementById('chk-show-sublunar')?.checked ?? true;
                sublunarMarkerGroup3D.visible = showSublunar;
                if (showSublunar) {
                    const subPos = latLngToVector3(coords.sublunar.lat, coords.sublunar.lon, EARTH_RADIUS * 1.004);
                    sublunarMarkerGroup3D.position.copy(subPos);
                    sublunarMarkerGroup3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), subPos.clone().normalize());
                }
            }

            // 3. Observador en Mataró (📍 41.54°N, 2.44°E): rotando sólidamente con la malla terrestre
            if (observerMarkerGroup3D) {
                const showObserver = document.getElementById('chk-show-observer')?.checked ?? true;
                observerMarkerGroup3D.visible = showObserver;
            }

            // Actualizar radios del shader de sombra volumétrico de la Luna 3D
            if (moonMat && moonMat.userData && moonMat.userData.uUmbraRadius) {
                moonMat.userData.uUmbraRadius.value = rUmbra3D;
                moonMat.userData.uPenumbraRadius.value = rPenumbra3D;
            }
        }

        function toggle3DCones(show) {
            if (shadowConesGroup3D) shadowConesGroup3D.visible = show;
            if (renderer3D && scene3D && camera3D) {
                renderer3D.render(scene3D, camera3D);
            }
        }

        // 5. Coordenadas Subsolar y Sublunar para Rotación y Marcadores 3D
        function getSubsolarAndSublunarCoords(timeMs) {
            if (!currentEclipse) return { subsolar: { lat: 0, lon: 0 }, sublunar: { lat: 0, lon: 0 } };
            
            // Desplazamiento temporal respecto al instante del máximo (en horas)
            const dtHours = (timeMs - currentEclipse.maxMs) / 3600000;
            // Rotación terrestre sideral/solar (15°/hora)
            const lonShift = dtHours * 15.04107;
            
            // Punto Sublunar (Luna en el cenit):
            const sublunarLat = currentEclipse.zenLat;
            let sublunarLon = ((currentEclipse.zenLon - lonShift + 180) % 360 + 360) % 360 - 180;
            
            // Punto Subsolar (Sol en el cenit, exactamente en la antípoda durante el eclipse):
            const subsolarLat = -sublunarLat;
            let subsolarLon = ((sublunarLon + 180 + 180) % 360 + 360) % 360 - 180;
            
            return {
                subsolar: { lat: subsolarLat, lon: subsolarLon },
                sublunar: { lat: sublunarLat, lon: sublunarLon }
            };
        }


// Exposición global
if (typeof window !== 'undefined') {
    window.scene3D = scene3D;
    window.camera3D = camera3D;
    window.renderer3D = renderer3D;
    window.controls3D = controls3D;
    window.earthMesh3D = earthMesh3D;
    window.moonMesh3D = moonMesh3D;
    window.sunMesh3D = sunMesh3D;
    window.observerMarkerGroup3D = observerMarkerGroup3D;
    window.subsolarMarkerGroup3D = subsolarMarkerGroup3D;
    window.sublunarMarkerGroup3D = sublunarMarkerGroup3D;
    window.umbraConeMesh3D = umbraConeMesh3D;
    window.penumbraConeMesh3D = penumbraConeMesh3D;
    window.moonOrbitLine3D = moonOrbitLine3D;
    window.cameraTransition3D = cameraTransition3D;
    window.focusedBody3D = focusedBody3D;
    window.EARTH_RADIUS = EARTH_RADIUS;
    
    window.latLngToVector3 = latLngToVector3;
    window.vector3ToLatLng = vector3ToLatLng;
    window.createObserverMarker3D = createObserverMarker3D;
    window.createSubsolarMarker3D = createSubsolarMarker3D;
    window.createSublunarMarker3D = createSublunarMarker3D;
    window.createGraticule = createGraticule;
    window.createMoonPolarAxis = createMoonPolarAxis;
    window.createEclipticPlane3D = createEclipticPlane3D;
    window.createLimitSprite = createLimitSprite;
    window.transitionCamera3D = transitionCamera3D;
    window.handle3DDoubleClick = handle3DDoubleClick;
    window.initThreeJS = initThreeJS;
    window.onWindowResize3D = onWindowResize3D;
    window.update3DEclipseGeometry = update3DEclipseGeometry;
    window.toggle3DCones = toggle3DCones;
    window.getSubsolarAndSublunarCoords = getSubsolarAndSublunarCoords;
}
