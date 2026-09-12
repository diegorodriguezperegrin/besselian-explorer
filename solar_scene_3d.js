/* =========================================================================
   COSMOS MATARÓ - MOTOR ESCENA 3D THREE.JS (solar_scene_3d.js)
   Renderizador WebGL, cámara, iluminación física, órbitas y mallas
   celestes (Sol, Tierra, Luna, atmósfera, conos de sombra y marcadores).
   ========================================================================= */

if (typeof window !== 'undefined' && typeof window.getDOM !== 'function') {
    window.getDOM = function(id) {
        return document.getElementById(id);
    };
}

function _getDOM(id) {
    return (typeof getDOM === 'function') ? getDOM(id) : document.getElementById(id);
}

var needsRender = true;
function requestRender() {
    needsRender = true;
    if (typeof window !== 'undefined') window.needsRender = true;
}

var observerMarkerGroup3D = null;

        // -------------------------------------------------------------
        // 1. CONFIGURACIÓN THREE.JS
        // -------------------------------------------------------------
        var container = getDOM('webgl-container');
        var scene = new THREE.Scene();

        var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1.0, 5000000);
        // Orientar inicialmente la cámara hacia la cara diurna iluminada del eclipse por defecto (2 Ago 2027: 25.5°N, 33.2°E)
        camera.position.copy(latLngToVector3(25.52, 33.24, 210));

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.domElement.style.opacity = '0';
        renderer.domElement.style.transition = 'opacity 0.18s ease-out';
        container.appendChild(renderer.domElement);

        var focusedBody = null; // 'moon' | 'node' | 'earth' | 'sun' | null
        var lastNodePos3D = null;
        var cameraTransition = null;
        var isPlaybackCentered = false;
        var playbackCenteredPref = true;
        var lastShadowEclipseCat = null;

        function transitionCamera(targetLookAt, targetCamPos, durationMs = 700) {
            const startTarget = controls ? controls.target.clone() : new THREE.Vector3(0, 0, 0);
            const startCamPos = camera.position.clone();
            const startOffset = startCamPos.clone().sub(startTarget);
            const endOffset = targetCamPos.clone().sub(targetLookAt);
            const startDist = startOffset.length() || 210;
            const endDist = endOffset.length() || startDist;
            const startDir = startOffset.clone().normalize();
            const endDir = endOffset.clone().normalize();
            const startTime = performance.now();

            cameraTransition = {
                startTarget: startTarget,
                endTarget: targetLookAt.clone(),
                startCamPos: startCamPos,
                endCamPos: targetCamPos.clone(),
                startDir: startDir,
                endDir: endDir,
                startDist: startDist,
                endDist: endDist,
                startTime: startTime,
                duration: durationMs
            };
        }

        const OrbitControlsClass = THREE.OrbitControls || window.OrbitControls;
        var controls;
        if (OrbitControlsClass) {
            controls = new OrbitControlsClass(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.rotateSpeed = 0.8;
            controls.minDistance = 2.0;
            controls.maxDistance = 2500000;
            controls.enablePan = true;
            controls.screenSpacePanning = true;
            controls.panSpeed = 1.2;
            controls.zoomSpeed = 1.2;

            controls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.PAN
            };

            renderer.domElement.addEventListener('pointerdown', (e) => {
                if (e.altKey && e.button === 0) {
                    try {
                        Object.defineProperty(e, 'shiftKey', { get: () => true });
                    } catch (_) {}
                }
            }, { capture: true });

            renderer.domElement.style.touchAction = 'none';
            renderer.domElement.style.userSelect = 'none';

            controls.addEventListener('start', () => {
                cameraTransition = null;
            });
            controls.addEventListener('change', () => {
                needsRender = true;
            });
        } else {
            controls = { update: () => false, target: new THREE.Vector3(0, 0, 0) };
        }

        // Navegación con flechas del teclado y teclas WASD
        window.addEventListener('keydown', (e) => {
            if (!controls || !camera) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;

            const panDist = Math.max(1.0, (camera.position.distanceTo(controls.target) || 200) * 0.04);
            let moved = false;
            const vRight = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            const vUp = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);

            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                controls.target.addScaledVector(vRight, -panDist);
                camera.position.addScaledVector(vRight, -panDist);
                moved = true;
            } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                controls.target.addScaledVector(vRight, panDist);
                camera.position.addScaledVector(vRight, panDist);
                moved = true;
            } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                controls.target.addScaledVector(vUp, panDist);
                camera.position.addScaledVector(vUp, panDist);
                moved = true;
            } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                controls.target.addScaledVector(vUp, -panDist);
                camera.position.addScaledVector(vUp, -panDist);
                moved = true;
            }

            if (moved) {
                e.preventDefault();
                cameraTransition = null;
                focusedBody = null;
                controls.update();
            }
        });

        function handle3DSpaceClick(clientX, clientY, isDoubleClick) {
            if (!camera || !controls || currentActiveView !== '3d') return;

            const rect = renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((clientX - rect.left) / rect.width) * 2 - 1,
                -((clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            const rayOrigin = raycaster.ray.origin;
            const rayDir = raycaster.ray.direction.clone().normalize();

            // 1. Distancia del rayo a la Luna
            let distToMoonRay = Infinity;
            let projMoon = 0;
            if (moonMesh3D && moonMesh3D.visible) {
                const vMoon = moonMesh3D.position.clone().sub(rayOrigin);
                projMoon = vMoon.dot(rayDir);
                if (projMoon > 0) {
                    const closestMoon = rayOrigin.clone().addScaledVector(rayDir, projMoon);
                    distToMoonRay = closestMoon.distanceTo(moonMesh3D.position);
                }
            }

            // 1b. Distancia del rayo al Nodo orbital
            let distToNodeRay = Infinity;
            let projNode = 0;
            if (lastNodePos3D) {
                const vNode = lastNodePos3D.clone().sub(rayOrigin);
                projNode = vNode.dot(rayDir);
                if (projNode > 0) {
                    const closestNode = rayOrigin.clone().addScaledVector(rayDir, projNode);
                    distToNodeRay = closestNode.distanceTo(lastNodePos3D);
                }
            }

            // 2. Distancia del rayo a la Tierra (0,0,0)
            let distToEarthRay = Infinity;
            let projEarth = 0;
            const vEarth = new THREE.Vector3(0, 0, 0).sub(rayOrigin);
            projEarth = vEarth.dot(rayDir);
            if (projEarth > 0) {
                const closestEarth = rayOrigin.clone().addScaledVector(rayDir, projEarth);
                distToEarthRay = closestEarth.distanceTo(new THREE.Vector3(0, 0, 0));
            }

            // 3. Distancia del rayo al Sol
            let distToSunRay = Infinity;
            if (sunGroup3D && sunGroup3D.visible) {
                const vSun = sunGroup3D.position.clone().sub(rayOrigin);
                const projSun = vSun.dot(rayDir);
                if (projSun > 0) {
                    const closestSun = rayOrigin.clone().addScaledVector(rayDir, projSun);
                    distToSunRay = closestSun.distanceTo(sunGroup3D.position);
                }
            }

            const moonTolerance = Math.max(MOON_RADIUS * 6.0, 120.0);
            const nodeTolerance = Math.max(MOON_RADIUS * 6.0, 120.0);
            const earthTolerance = Math.max(EARTH_RADIUS * 2.0, 60.0);
            const sunTolerance = Math.max(SUN_RADIUS * 3.0, 20000.0);

            // Test de oclusión por profundidad: si la Luna o el Nodo están detrás de la Tierra respecto a la cámara
            const isMoonOccludedByEarth = (distToEarthRay < EARTH_RADIUS * 1.05 && distToMoonRay < moonTolerance && projMoon > projEarth);
            const isNodeOccludedByEarth = (distToEarthRay < EARTH_RADIUS * 1.05 && distToNodeRay < nodeTolerance && projNode > projEarth);

            const hitMoon = (distToMoonRay < moonTolerance && !isMoonOccludedByEarth && distToMoonRay <= distToEarthRay && distToMoonRay <= distToSunRay && moonMesh3D);
            const hitNode = (distToNodeRay < nodeTolerance && !isNodeOccludedByEarth && distToNodeRay <= distToEarthRay && distToNodeRay <= distToSunRay && lastNodePos3D);

            if (hitMoon) {
                // Clic sobre la Luna -> Aproximación a la Luna y centro de rotación en torno a la Luna
                focusedBody = 'moon';
                const moonPos = moonMesh3D.position.clone();
                let viewDir = camera.position.clone().sub(moonPos);
                if (viewDir.lengthSq() < 0.001) viewDir = new THREE.Vector3(0, 20, 60);
                viewDir.normalize();
                const targetCamPos = moonPos.clone().addScaledVector(viewDir, MOON_RADIUS * 3.8);
                transitionCamera(moonPos, targetCamPos, 700);
            } else if (hitNode) {
                // Clic sobre el Nodo orbital -> Enfoque sobre el Nodo
                focusedBody = 'node';
                const nodePos = lastNodePos3D.clone();
                let viewDir = camera.position.clone().sub(nodePos);
                if (viewDir.lengthSq() < 0.001) viewDir = new THREE.Vector3(0, 20, 60);
                viewDir.normalize();
                const targetCamPos = nodePos.clone().addScaledVector(viewDir, MOON_RADIUS * 4.5);
                transitionCamera(nodePos, targetCamPos, 700);
            } else if (isDoubleClick) {
                if (distToSunRay < sunTolerance && distToSunRay < distToEarthRay && distToSunRay < distToMoonRay) {
                    // Doble clic sobre el Sol -> Enfoque sobre el Sol
                    focusedBody = 'sun';
                    const sunPos = sunGroup3D.position.clone();
                    let viewDir = camera.position.clone().sub(sunPos);
                    if (viewDir.lengthSq() < 0.001) viewDir = new THREE.Vector3(0, 5000, 25000);
                    viewDir.normalize();
                    const targetCamPos = sunPos.clone().addScaledVector(viewDir, SUN_RADIUS * 4.0);
                    transitionCamera(sunPos, targetCamPos, 800);
                } else if (distToEarthRay < earthTolerance) {
                    // Doble clic sobre la Tierra -> Enfoque sobre la Tierra
                    focusedBody = 'earth';
                    const earthPos = new THREE.Vector3(0, 0, 0);
                    let viewDir = camera.position.clone().sub(earthPos);
                    if (viewDir.lengthSq() < 0.001) viewDir = new THREE.Vector3(0, 50, 180);
                    viewDir.normalize();
                    const targetCamPos = earthPos.clone().addScaledVector(viewDir, EARTH_RADIUS * 4.0);
                    transitionCamera(earthPos, targetCamPos, 700);
                } else {
                    // Doble clic en espacio vacío -> Vista global del sistema
                    focusedBody = null;
                    const globalTarget = new THREE.Vector3(0, 0, MOON_DIST * 0.4);
                    const globalCamPos = new THREE.Vector3(0, MOON_DIST * 0.7, MOON_DIST * 1.5);
                    transitionCamera(globalTarget, globalCamPos, 750);
                }
            }
        }

        // Navegación por doble clic / doble tap
        renderer.domElement.addEventListener('dblclick', (e) => {
            handle3DSpaceClick(e.clientX, e.clientY, true);
        });

        // Iluminación Física Realista del Terminador (Día vs Noche)
        var ambientLight = new THREE.AmbientLight(0x101a26, 0.35);
        scene.add(ambientLight);

        var sunLight = new THREE.DirectionalLight(0xfff5ea, 1.80);
        sunLight.position.set(150, 100, 250);
        scene.add(sunLight);

        // Constantes Físicas de Escala 3D Real (1 R_Tierra = 50 unidades)
        var EARTH_RADIUS = 50.0;     // Radio Terrestre: 6.371 km
        var MOON_RADIUS = 13.635;    // Radio Lunar: 1.737,4 km (0,2727 R_Tierra)
        var MOON_DIST = 3016.5;      // Distancia Media Tierra-Luna: 384.400 km (60,33 R_Tierra)
        var SUN_RADIUS = 5465.0;     // Radio Solar Real: 696.340 km (109,3 R_Tierra)
        var SUN_DIST = 1174050.0;    // Distancia Media Tierra-Sol (1 UA): 149.598.000 km (23.481 R_Tierra)

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

        var sunGroup3D, sunMesh3D, sunCoronaMesh3D;
        const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 48, 48);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
        sunMesh3D = new THREE.Mesh(sunGeo, sunMat);

        const coronaMat = new THREE.SpriteMaterial({
            map: createSunCoronaTexture(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        sunCoronaMesh3D = new THREE.Sprite(coronaMat);
        sunCoronaMesh3D.scale.set(SUN_RADIUS * 4.2, SUN_RADIUS * 4.2, 1);

        sunGroup3D = new THREE.Group();
        sunGroup3D.add(sunMesh3D);
        sunGroup3D.add(sunCoronaMesh3D);
        scene.add(sunGroup3D);

        // 🌑 Luna 3D con Textura Equirrectangular NASA LRO
        var moonMesh3D;
        const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 64, 64);
        const moonMat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            emissive: new THREE.Color(0x707884), // Luz cenicienta física reflejada por la Tierra para revelar cráteres y mares
            emissiveIntensity: 0.90
        });

        const moonTexLoader = new THREE.TextureLoader();
        const MOON_TEX_LOCAL = 'moon_topo_2048.jpg';
        const MOON_TEX_CDN = 'https://cdn.jsdelivr.net/gh/diegorodriguezperegrin/besselian-explorer@main/moon_topo_2048.jpg';

        function applyMoonTexture(texture) {
            texture.needsUpdate = true;
            moonMat.map = texture;
            moonMat.emissiveMap = texture;
            moonMat.needsUpdate = true;
        }

        moonTexLoader.load(MOON_TEX_LOCAL, applyMoonTexture, undefined, function() {
            moonTexLoader.load(MOON_TEX_CDN, applyMoonTexture);
        });

        moonMesh3D = new THREE.Mesh(moonGeo, moonMat);
        scene.add(moonMesh3D);

        // 🔦 Conos Volumétricos de Sombra 3D (Umbra y Penumbra)
        var umbraConeMesh3D, penumbraConeMesh3D;

        // Shaders de Difuminado Volumétrico Suave estilo Lunar Eclipse Explorer
        const coneVertexShader = `
            precision highp float;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const umbraConeFragmentShader = `
            precision highp float;
            uniform vec3 uColor;
            uniform float uMaxOpacity;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;

            void main() {
                // Difuminado suave en extremos
                float topFade = smoothstep(0.0, 0.05, vUv.y);
                float bottomFade = smoothstep(1.0, 0.90, vUv.y);
                
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float rim = abs(dot(vNormal, viewDir));
                float rimFade = smoothstep(0.04, 0.50, rim);

                float alpha = uMaxOpacity * topFade * bottomFade * (0.45 + 0.55 * rimFade);
                if (alpha <= 0.005) discard;
                gl_FragColor = vec4(uColor, alpha);
            }
        `;

        const penumbraConeFragmentShader = `
            precision highp float;
            uniform vec3 uColor;
            uniform float uMaxOpacity;
            varying vec3 vWorldPos;
            varying vec3 vNormal;
            varying vec2 vUv;

            void main() {
                // Difuminado amplio y suave para la penumbra exterior
                float topFade = smoothstep(0.06, 0.35, vUv.y);
                float bottomFade = smoothstep(1.0, 0.85, vUv.y);
                
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                float rim = abs(dot(vNormal, viewDir));
                float rimFade = smoothstep(0.04, 0.50, rim);

                float alpha = uMaxOpacity * topFade * bottomFade * (0.30 + 0.70 * rimFade);
                if (alpha <= 0.005) discard;
                gl_FragColor = vec4(uColor, alpha);
            }
        `;

        const umbraConeGeo = new THREE.CylinderGeometry(MOON_RADIUS, 0.75, MOON_DIST, 64, 1, true);
        const umbraConeMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
                uColor: { value: new THREE.Color(0x0a101d) },
                uMaxOpacity: { value: 0.65 }
            },
            vertexShader: coneVertexShader,
            fragmentShader: umbraConeFragmentShader
        });
        umbraConeMesh3D = new THREE.Mesh(umbraConeGeo, umbraConeMat);
        umbraConeMesh3D.renderOrder = 2;
        scene.add(umbraConeMesh3D);

        const penumbraConeGeo = new THREE.CylinderGeometry(MOON_RADIUS, 26.0, MOON_DIST, 64, 1, true);
        const penumbraConeMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            uniforms: {
                uColor: { value: new THREE.Color(0x1e293b) },
                uMaxOpacity: { value: 0.18 }
            },
            vertexShader: coneVertexShader,
            fragmentShader: penumbraConeFragmentShader
        });
        penumbraConeMesh3D = new THREE.Mesh(penumbraConeGeo, penumbraConeMat);
        penumbraConeMesh3D.renderOrder = 1;
        scene.add(penumbraConeMesh3D);

        // 궤 Órbita Lunar 3D en el Espacio
        var moonOrbitLine3D;
        const orbitGeo = new THREE.BufferGeometry();
        const orbitMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.60,
            depthWrite: false
        });
        moonOrbitLine3D = new THREE.Line(orbitGeo, orbitMat);
        moonOrbitLine3D.frustumCulled = false;
        moonOrbitLine3D.renderOrder = 5;
        scene.add(moonOrbitLine3D);

        // 🌐 Malla y Plano Eclíptico 3D de Referencia
        var eclipticPlaneGroup3D;

        function createEclipticPlane3D() {
            const group = new THREE.Group();

            // GridHelper 3D vectorial en el plano de la Eclíptica
            // Escala Unificada: 100 Diámetros Terrestres (1.274.200 km = 10.000 unidades)
            // 100 divisiones -> Cada celda mide exactamente 1 Diámetro Terrestre (2 R_E = 100u = 12.742 km)
            // Ejes orientadores en Amarillo dorado (0xfacc15) y líneas secundarias en ámbar cálido (0xa16207)
            const gridHelper = new THREE.GridHelper(10000, 100, 0xfacc15, 0xa16207);
            gridHelper.material.transparent = true;
            gridHelper.material.opacity = 0.50;
            gridHelper.material.depthWrite = false;

            // Shader de difuminado radial suave más allá de la órbita lunar (446.000 - 637.000 km = 3500 - 5000 unidades)
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
                    float dist = length(vWorldPos);
                    float fade = 1.0 - smoothstep(3500.0, 5000.0, dist);
                    gl_FragColor.a *= fade;
                    `
                );
            };

            group.add(gridHelper);
            return group;
        }

        eclipticPlaneGroup3D = createEclipticPlane3D();
        scene.add(eclipticPlaneGroup3D);

        // Línea de los Nodos 3D (Eje de intersección entre el plano orbital lunar y el plano eclíptico) en Azul celeste luminoso
        const nodeLineMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.95,
            depthWrite: false
        });
        var nodeLine3D = new THREE.Line(new THREE.BufferGeometry(), nodeLineMat);
        nodeLine3D.frustumCulled = false;
        nodeLine3D.renderOrder = 8;
        nodeLine3D.visible = getDOM('chk-show-nodes')?.checked ?? true;
        scene.add(nodeLine3D);

        // Grupo 3D de Rótulos y Marcadores de Nodos y Límites de Eclipse
        var nodesGroup3D = new THREE.Group();
        nodesGroup3D.renderOrder = 10;
        nodesGroup3D.visible = getDOM('chk-show-limits')?.checked ?? true;
        scene.add(nodesGroup3D);

        function createNodeSprite(text, colorHex = '#38bdf8', fontSize = 28) {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            ctx.font = `bold ${fontSize}px 'Plus Jakarta Sans', system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = colorHex;
            ctx.fillText(text, 256, 50);

            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(340, 68, 1);
            sprite.renderOrder = 10;
            sprite.frustumCulled = false;
            return sprite;
        }

        var orbitalLimitMarkers = null;
        function initOrbitalLimitMarkers() {
            if (orbitalLimitMarkers) return orbitalLimitMarkers;
            orbitalLimitMarkers = {
                ticks: [],
                sprites: [],
                lastNodeLabel: ''
            };

            const MARKER_DEFS = [
                { id: 'node', deg: 0.0, color: 0x38bdf8, colorHex: '#38bdf8', tickLen: 60.0, defaultText: 'Nodo (0°)' },
                { id: 'cen_minus', deg: -10.6, color: 0xef4444, colorHex: '#ef4444', tickLen: 45.0, defaultText: '-Total / Anular (10.6°)' },
                { id: 'cen_plus', deg: 10.6, color: 0xef4444, colorHex: '#ef4444', tickLen: 45.0, defaultText: '+Total / Anular (10.6°)' },
                { id: 'par_minus', deg: -16.5, color: 0xf59e0b, colorHex: '#f59e0b', tickLen: 45.0, defaultText: '-Parcial (16.5°)' },
                { id: 'par_plus', deg: 16.5, color: 0xf59e0b, colorHex: '#f59e0b', tickLen: 45.0, defaultText: '+Parcial (16.5°)' }
            ];

            MARKER_DEFS.forEach(def => {
                const geo = new THREE.BufferGeometry();
                const mat = new THREE.LineBasicMaterial({
                    color: def.color,
                    transparent: true,
                    opacity: 0.95,
                    depthWrite: false
                });
                const line = new THREE.Line(geo, mat);
                line.frustumCulled = false;
                line.renderOrder = 9;
                nodesGroup3D.add(line);

                const sprite = createNodeSprite(def.defaultText, def.colorHex);
                const showLimitLabels = (getDOM('chk-show-limits')?.checked ?? true) && (getDOM('chk-show-limits-labels')?.checked ?? false);
                sprite.visible = showLimitLabels;
                nodesGroup3D.add(sprite);

                orbitalLimitMarkers.ticks.push({ line, def });
                orbitalLimitMarkers.sprites.push({ sprite, def });
            });

            return orbitalLimitMarkers;
        }

        // Crear Esfera de la Tierra
        var earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96);

        var earthMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            specular: new THREE.Color(0x222222),
            shininess: 12
        });

        var earthGroup = new THREE.Group();
        var earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
        earthMesh.visible = false;
        earthGroup.add(earthMesh);
        scene.add(earthGroup);

        const EARTH_TEX_LOCAL = 'earth_topo_2048.jpg';
        const EARTH_TEX_CDN = 'https://cdn.jsdelivr.net/gh/diegorodriguezperegrin/besselian-explorer@main/earth_topo_2048.jpg';

        const earthTexLoader = new THREE.TextureLoader();
        var isEarthTexLoaded = false;

        function revealScene() {
            if (renderer && renderer.domElement) {
                renderer.domElement.style.opacity = '1';
            }
            requestRender();
        }

        function applyEarthTexture(texture) {
            if (!texture || isEarthTexLoaded) return;
            isEarthTexLoaded = true;
            texture.needsUpdate = true;
            if (earthMaterial.map && earthMaterial.map !== texture && earthMaterial.map.dispose) {
                earthMaterial.map.dispose();
            }
            earthMaterial.map = texture;
            earthMaterial.needsUpdate = true;
            earthMesh.visible = true;
            revealScene();
        }

        // Carga y decodificación sincronizada de la textura 2K
        const preloadEarthImg = document.getElementById('preload-earth-topo');
        if (preloadEarthImg && preloadEarthImg.complete && preloadEarthImg.naturalWidth > 0) {
            const initialTexture = new THREE.Texture(preloadEarthImg);
            applyEarthTexture(initialTexture);
        } else if (preloadEarthImg) {
            if (preloadEarthImg.decode) {
                preloadEarthImg.decode().then(() => {
                    applyEarthTexture(new THREE.Texture(preloadEarthImg));
                }).catch(() => {
                    earthTexLoader.load(EARTH_TEX_LOCAL, applyEarthTexture, undefined, () => {
                        earthTexLoader.load(EARTH_TEX_CDN, applyEarthTexture);
                    });
                });
            } else {
                preloadEarthImg.onload = function() {
                    applyEarthTexture(new THREE.Texture(preloadEarthImg));
                };
            }
        } else {
            earthTexLoader.load(EARTH_TEX_LOCAL, applyEarthTexture, undefined, () => {
                earthTexLoader.load(EARTH_TEX_CDN, applyEarthTexture);
            });
        }

        // Failsafe: asegurar visibilidad de la escena tras 350ms en cualquier circunstancia de red
        setTimeout(revealScene, 350);

        // Marcador 3D del Observador sobre la superficie terrestre
        function createObserverMarker3D() {
            const group = new THREE.Group();

            const pinGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const pinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const pinMesh = new THREE.Mesh(pinGeo, pinMat);
            pinMesh.position.y = 0.45;
            group.add(pinMesh);

            const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 8);
            const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
            const stemMesh = new THREE.Mesh(stemGeo, stemMat);
            stemMesh.position.y = 0.225;
            group.add(stemMesh);

            const ringGeo = new THREE.RingGeometry(0.05, 0.16, 24);
            ringGeo.rotateX(Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.y = 0.01;
            group.add(ringMesh);

            group.visible = true;
            return group;
        }

        observerMarkerGroup3D = createObserverMarker3D();
        earthMesh.add(observerMarkerGroup3D);

        // Atmósfera brillante
        var atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 64, 64);
        var atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.14,
            side: THREE.BackSide
        });
        var atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        earthGroup.add(atmosphereMesh);

        // Generador de Rótulos de Texto Flotantes 3D estilo NASA / Espenak (Fondo blanco, texto negro, sin borde)
        function createTextSprite(text, color = '#000000', bgColor = '#ffffff', scaleFactor = 1.0) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.font = '600 24px "Outfit", "Plus Jakarta Sans", -apple-system, sans-serif';
            const textWidth = ctx.measureText(text).width;
            const padX = 14;
            const boxW = Math.min(250, textWidth + padX * 2);
            const boxH = 46;
            const boxX = (256 - boxW) / 2;
            const boxY = (64 - boxH) / 2;
            const r = 8;

            if (bgColor) {
                ctx.fillStyle = bgColor;
                ctx.beginPath();
                ctx.moveTo(boxX + r, boxY);
                ctx.lineTo(boxX + boxW - r, boxY);
                ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
                ctx.lineTo(boxX + boxW, boxY + boxH - r);
                ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
                ctx.lineTo(boxX + r, boxY + boxH);
                ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
                ctx.lineTo(boxX, boxY + r);
                ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 128, 32);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            const material = new THREE.SpriteMaterial({ 
                map: texture, 
                transparent: true, 
                depthTest: true 
            });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(6.0 * scaleFactor, 1.5 * scaleFactor, 1);
            return sprite;
        }

        // Marcador 3D del Punto Subsolar (☀️ Cenit Solar)
        function createSubsolarMarker() {
            const group = new THREE.Group();

            // 1. Núcleo solar esférico dorado brillante
            const coreGeo = new THREE.SphereGeometry(1.3, 24, 24);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
            const coreMesh = new THREE.Mesh(coreGeo, coreMat);
            group.add(coreMesh);

            // 2. Rayo cenital vertical hacia el Sol (apuntando al cenit)
            const rayGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.0, 8);
            const rayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
            const rayMesh = new THREE.Mesh(rayGeo, rayMat);
            rayMesh.position.y = 2.5;
            group.add(rayMesh);

            group.visible = true;
            return group;
        }

        var subsolarMarkerGroup = createSubsolarMarker();
        scene.add(subsolarMarkerGroup);

        // Marcador 3D del Punto Sublunar (🌕 Cenit Lunar / Centro de Sombra)
        function createSublunarMarker() {
            const group = new THREE.Group();

            // 1. Núcleo lunar esférico plateado
            const coreGeo = new THREE.SphereGeometry(1.3, 24, 24);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
            const coreMesh = new THREE.Mesh(coreGeo, coreMat);
            group.add(coreMesh);

            // 2. Halo lunar cian
            const haloGeo = new THREE.SphereGeometry(2.0, 24, 24);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
            const haloMesh = new THREE.Mesh(haloGeo, haloMat);
            group.add(haloMesh);

            // 3. Rayo cenital hacia la Luna
            const rayGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.0, 8);
            const rayMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
            const rayMesh = new THREE.Mesh(rayGeo, rayMat);
            rayMesh.position.y = 2.5;
            group.add(rayMesh);

            group.visible = false;
            return group;
        }

        var sublunarMarkerGroup = createSublunarMarker();
        scene.add(sublunarMarkerGroup);

        // -------------------------------------------------------------
        // SHADER GPU DE SOMBRA SOBRE LA CARA DIURNA
        // -------------------------------------------------------------
        var shadowShaderMaterial = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uSunDir: { value: new THREE.Vector3(0, 0, 1) },
                uVx: { value: new THREE.Vector3(1, 0, 0) },
                uVy: { value: new THREE.Vector3(0, 1, 0) },
                uShadowCenter: { value: new THREE.Vector2(0, 0) },
                uL1: { value: 0.53 },
                uL2: { value: 0.008 },
                uShowPenumbra: { value: 0.0 }
            },
            vertexShader: `
                precision highp float;
                varying vec3 vLocalPosition;
                void main() {
                    vLocalPosition = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                uniform vec3 uSunDir;
                uniform vec3 uVx;
                uniform vec3 uVy;
                uniform vec2 uShadowCenter;
                uniform float uL1;
                uniform float uL2;
                uniform float uShowPenumbra;

                varying vec3 vLocalPosition;

                void main() {
                    // 1. Solo en la cara diurna iluminada por el Sol
                    float z_p = dot(vLocalPosition, uSunDir);
                    if (z_p <= 0.0) {
                        discard;
                    }

                    // 2. Coordenadas exactas en el plano fundamental Besseliano
                    float x_p = dot(vLocalPosition, uVx);
                    float y_p = dot(vLocalPosition, uVy);

                    float dx = x_p - uShadowCenter.x;
                    float dy = y_p - uShadowCenter.y;
                    float dist = sqrt(dx * dx + dy * dy);

                    if (dist > uL1) {
                        discard; // Fuera de la penumbra
                    }

                    float absL2 = abs(uL2);

                    // 3. Gradiente penumbral físico difuso continuo
                    float normDist = clamp((dist - absL2) / max(0.0001, uL1 - absL2), 0.0, 1.0);
                    float factor = 1.0 - normDist;
                    // Atenuación suave difusa
                    float penAlpha = pow(factor, 1.35) * 0.88;
                    vec3 penCol = vec3(0.02, 0.04, 0.09);

                    // 4. Núcleo negro de totalidad / anularidad (Umbra)
                    float alpha = 0.0;
                    vec3 col = penCol;

                    if (dist <= absL2) {
                        float umbFactor = clamp(1.0 - (dist / max(0.0001, absL2)), 0.0, 1.0);
                        alpha = mix(0.88, 0.98, smoothstep(0.0, 0.25, umbFactor));
                        col = vec3(0.0, 0.0, 0.0);
                    } else if (uShowPenumbra > 0.5) {
                        alpha = penAlpha;
                        col = penCol;
                    } else {
                        discard;
                    }

                    gl_FragColor = vec4(col, alpha);
                }
            `,
            side: THREE.FrontSide
        });

        // Esfera superpuesta del shader de sombra (renderizada entre la superficie y las líneas cartográficas)
        var shadowOverlayGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.0012, 96, 96);
        var shadowOverlayMesh = new THREE.Mesh(shadowOverlayGeometry, shadowShaderMaterial);
        shadowOverlayMesh.renderOrder = 20;
        scene.add(shadowOverlayMesh);

        // Resiliencia ante pérdida transitoria de contexto WebGL en móviles / cambio de pestaña
        renderer.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('[WebGL] Contexto GPU suspendido/perdido temporalmente.');
        }, false);

        renderer.domElement.addEventListener('webglcontextrestored', () => {
            console.log('[WebGL] Contexto GPU restaurado.');
            if (currentEclipse) {
                drawShadowPath(currentEclipse);
                updateShadowAtTime(parseFloat(getDOM('time-slider')?.value) || 0);
            }
        }, false);

        // -------------------------------------------------------------
        // 2. TRANSFORMACIÓN MATEMÁTICA Y POSICIONAMIENTO DEL SOL
        // -------------------------------------------------------------
        function latLngToVector3(lat, lng, radius = EARTH_RADIUS) {
            const latRad = lat * (Math.PI / 180);
            const lngRad = lng * (Math.PI / 180);

            const x =  radius * Math.cos(latRad) * Math.cos(lngRad);
            const y =  radius * Math.sin(latRad);
            const z = -radius * Math.cos(latRad) * Math.sin(lngRad);

            return new THREE.Vector3(x, y, z);
        }

        // [getEarthRotationAngleDeg, getJulianDay, getEclipseMeeusAngles] Extraído a besselian_engine.js

        function vector3ToLatLng(v) {
            const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            if (r === 0) return { lat: 0, lon: 0, lng: 0 };
            const lat = Math.asin(Math.max(-1, Math.min(1, v.y / r))) * (180 / Math.PI);
            let lon = Math.atan2(-v.z, v.x) * (180 / Math.PI);
            return { lat, lon, lng: lon };
        }


        // -------------------------------------------------------------
        // GESTIÓN DE MEMORIA Y LIBERACIÓN VRAM (DISPOSE)
        // -------------------------------------------------------------
        function disposeMaterial(mat) {
            if (!mat) return;
            const textureKeys = ['map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap', 'alphaMap', 'aoMap', 'displacementMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
            textureKeys.forEach(key => {
                if (mat[key] && typeof mat[key].dispose === 'function') {
                    mat[key].dispose();
                }
            });
            if (typeof mat.dispose === 'function') {
                mat.dispose();
            }
        }

        function dispose3DObject(obj) {
            if (!obj) return;
            
            // Recorrer recursivamente todos los hijos en orden inverso
            if (obj.children && obj.children.length > 0) {
                for (let i = obj.children.length - 1; i >= 0; i--) {
                    dispose3DObject(obj.children[i]);
                }
            }
            
            // Liberar geometría GPU
            if (obj.geometry && typeof obj.geometry.dispose === 'function') {
                obj.geometry.dispose();
            }
            
            // Liberar materiales y texturas
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => disposeMaterial(mat));
                } else {
                    disposeMaterial(obj.material);
                }
            }
            
            // Desvincular de su contenedor padre
            if (obj.parent) {
                obj.parent.remove(obj);
            }
        }

        var pathLine = null;
        var totalityNorthLine = null;
        var totalitySouthLine = null;
        var isomagnitudesGroup = null;
        var graticuleGroup = null;
        var moonPolarAxisGroup = null;
        var utLinesGroup = null;

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
                // Polo norte: segmento axial que sobresale del globo
                new THREE.Vector3(0, EARTH_RADIUS * 0.98, 0),
                new THREE.Vector3(0, EARTH_RADIUS * 1.14, 0),
                // Polo norte: cruceta superficial
                new THREE.Vector3(-1.8, EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(1.8, EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(0, EARTH_RADIUS * 1.002, -1.8),
                new THREE.Vector3(0, EARTH_RADIUS * 1.002, 1.8),

                // Polo sur: segmento axial que sobresale del globo
                new THREE.Vector3(0, -EARTH_RADIUS * 0.98, 0),
                new THREE.Vector3(0, -EARTH_RADIUS * 1.14, 0),
                // Polo sur: cruceta superficial
                new THREE.Vector3(-1.8, -EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(1.8, -EARTH_RADIUS * 1.002, 0),
                new THREE.Vector3(0, -EARTH_RADIUS * 1.002, -1.8),
                new THREE.Vector3(0, -EARTH_RADIUS * 1.002, 1.8)
            ];
            const earthAxisGeo = new THREE.BufferGeometry().setFromPoints(earthAxisPoints);
            const earthAxisLines = new THREE.LineSegments(earthAxisGeo, axisMaterial);
            group.add(earthAxisLines);

            return group;
        }

        function createMoonPolarAxis() {
            const group = new THREE.Group();
            const axisMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.45
            });

            // Eje polar lunar: marcas en polo norte y polo sur (segmento axial y cruceta de polo)
            const moonAxisPoints = [
                // Polo norte lunar: segmento axial que sobresale del limbo lunar
                new THREE.Vector3(0, MOON_RADIUS * 0.98, 0),
                new THREE.Vector3(0, MOON_RADIUS * 1.18, 0),
                // Polo norte lunar: cruceta superficial
                new THREE.Vector3(-0.6, MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0.6, MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0, MOON_RADIUS * 1.002, -0.6),
                new THREE.Vector3(0, MOON_RADIUS * 1.002, 0.6),

                // Polo sur lunar: segmento axial que sobresale del limbo lunar
                new THREE.Vector3(0, -MOON_RADIUS * 0.98, 0),
                new THREE.Vector3(0, -MOON_RADIUS * 1.18, 0),
                // Polo sur lunar: cruceta superficial
                new THREE.Vector3(-0.6, -MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0.6, -MOON_RADIUS * 1.002, 0),
                new THREE.Vector3(0, -MOON_RADIUS * 1.002, -0.6),
                new THREE.Vector3(0, -MOON_RADIUS * 1.002, 0.6)
            ];
            const moonAxisGeo = new THREE.BufferGeometry().setFromPoints(moonAxisPoints);
            const moonAxisLines = new THREE.LineSegments(moonAxisGeo, axisMaterial);
            group.add(moonAxisLines);

            return group;
        }

        function updateGraticule() {
            if (graticuleGroup) {
                dispose3DObject(graticuleGroup);
                graticuleGroup = null;
            }
            if (moonPolarAxisGroup) {
                dispose3DObject(moonPolarAxisGroup);
                moonPolarAxisGroup = null;
            }
            const showGraticule = getDOM('chk-show-graticule')?.checked;
            if (showGraticule) {
                graticuleGroup = createGraticule();
                if (graticuleGroup) earthGroup.add(graticuleGroup);

                if (typeof moonMesh3D !== 'undefined' && moonMesh3D) {
                    moonPolarAxisGroup = createMoonPolarAxis();
                    if (moonPolarAxisGroup) moonMesh3D.add(moonPolarAxisGroup);
                }
            }
        }

        function createSegmentedLine(coordList, colorHex, radius = EARTH_RADIUS * 1.0028, linewidth = 1, opacity = 1.0) {
            const segmentPoints = [];
            const maxSegmentDist3D = 6.0; // Distancia máxima en unidades 3D (~750 km) para descartar saltos artificiales

            for (let i = 1; i < coordList.length; i++) {
                const prev = coordList[i - 1];
                const curr = coordList[i];
                if (!prev || !curr) continue;

                const p1 = latLngToVector3(prev.lat, prev.lng, radius);
                const p2 = latLngToVector3(curr.lat, curr.lng, radius);

                // Comprobación geométrica 3D continua (funciona en polos, antimeridiano ±180° y latitudes árticas)
                if (p1.distanceTo(p2) < maxSegmentDist3D) {
                    segmentPoints.push(p1);
                    segmentPoints.push(p2);
                }
            }

            if (segmentPoints.length > 0) {
                const geometry = new THREE.BufferGeometry().setFromPoints(segmentPoints);
                const material = new THREE.LineBasicMaterial({ 
                    color: colorHex, 
                    linewidth: linewidth,
                    transparent: opacity < 1.0,
                    opacity: opacity,
                    depthWrite: false
                });
                const lineSegs = new THREE.LineSegments(geometry, material);
                lineSegs.renderOrder = 25;
                return lineSegs;
            }
            return null;
        }

        // [getEdgeIntersection, cachedEclipseGeometry, precomputeEclipseGeometry] Extraído a besselian_engine.js

        function updateMoonOrbit(eclipse) {
            if (!moonOrbitLine3D || !eclipse) return;

            // Coordenadas besselianas y orientación en el centro del eclipse (t = 0)
            const x0 = (eclipse.x0 || 0);
            const y0 = (eclipse.y0 || 0);
            const x1 = (eclipse.x1 || 0.54);
            const y1 = (eclipse.y1 || -0.20);
            const dDeg = (eclipse.d0 || 0);
            let muDeg = (eclipse.mu0 || 0);
            if (eclipse.dt) {
                muDeg -= getEarthRotationAngleDeg(eclipse.dt);
            }

            const wLocal = latLngToVector3(dDeg, -muDeg, 1.0).normalize();
            const muRad = -muDeg * Math.PI / 180;
            const uLocal = new THREE.Vector3(-Math.sin(muRad), 0, -Math.cos(muRad)).normalize();
            const vLocal = new THREE.Vector3().crossVectors(wLocal, uLocal).normalize();

            // Posición geocéntrica de la Luna en el máximo eclipse
            const rMoonCenter = new THREE.Vector3()
                .addScaledVector(uLocal, x0 * EARTH_RADIUS)
                .addScaledVector(vLocal, y0 * EARTH_RADIUS)
                .addScaledVector(wLocal, MOON_DIST);

            // Vector de velocidad orbital transversal (hacia el este)
            const vOrb = new THREE.Vector3()
                .addScaledVector(uLocal, x1 * EARTH_RADIUS)
                .addScaledVector(vLocal, y1 * EARTH_RADIUS);

            // Base ortonormal estricta del plano orbital lunar 3D
            const e1 = rMoonCenter.clone().normalize();
            let normOrbit = new THREE.Vector3().crossVectors(e1, vOrb).normalize();
            if (normOrbit.lengthSq() < 0.001) {
                normOrbit = new THREE.Vector3(0, 1, 0);
            }
            const e2 = new THREE.Vector3().crossVectors(normOrbit, e1).normalize();

            // Generar la órbita completa cerrada de 360° alrededor de la Tierra
            const pts = [];
            const segments = 180;
            const orbitRadius = rMoonCenter.length();
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                const pos = new THREE.Vector3()
                    .addScaledVector(e1, orbitRadius * Math.cos(theta))
                    .addScaledVector(e2, orbitRadius * Math.sin(theta));
                pts.push(pos);
            }

            moonOrbitLine3D.geometry.dispose();
            moonOrbitLine3D.geometry = new THREE.BufferGeometry().setFromPoints(pts);
            moonOrbitLine3D.geometry.computeBoundingSphere();
        }

        function drawShadowPath(eclipse) {
            if (pathLine) { dispose3DObject(pathLine); pathLine = null; }
            if (totalityNorthLine) { dispose3DObject(totalityNorthLine); totalityNorthLine = null; }
            if (totalitySouthLine) { dispose3DObject(totalitySouthLine); totalitySouthLine = null; }
            if (isomagnitudesGroup) { dispose3DObject(isomagnitudesGroup); isomagnitudesGroup = null; }
            if (utLinesGroup) { dispose3DObject(utLinesGroup); utLinesGroup = null; }

            updateMoonOrbit(eclipse);

            const data = precomputeEclipseGeometry(eclipse);

            // 1. Trayectoria / Línea Central (Naranja #f97316)
            const showCenterLine = getDOM('chk-show-center-line')?.checked !== false;
            if (data.centerCoords && data.centerCoords.length > 1 && showCenterLine) {
                pathLine = createSegmentedLine(data.centerCoords, 0xf97316, EARTH_RADIUS * 1.0028, 3);
                if (pathLine) earthGroup.add(pathLine);
            }

            // 2. Límites Extremos Norte y Sur de Totalidad / Anularidad (Rojo #ef4444)
            const typeCode = (eclipse.eclipse_type || '').toUpperCase();
            const isCentral = !typeCode.startsWith('P');
            const showTotalityBand = getDOM('chk-show-totality')?.checked;

            if (isCentral && showTotalityBand !== false) {
                if (data.totNorthCoords && data.totNorthCoords.length > 1) {
                    totalityNorthLine = createSegmentedLine(data.totNorthCoords, 0xef4444, EARTH_RADIUS * 1.0028, 2);
                    if (totalityNorthLine) earthGroup.add(totalityNorthLine);
                }

                if (data.totSouthCoords && data.totSouthCoords.length > 1) {
                    totalitySouthLine = createSegmentedLine(data.totSouthCoords, 0xef4444, EARTH_RADIUS * 1.0028, 2);
                    if (totalitySouthLine) earthGroup.add(totalitySouthLine);
                }
            }

            // 3. ISOMAGNITUDES Opcionales y Figura del 8 (Terminadores Amanecer/Atardecer)
            const showIsomagnitudes = getDOM('chk-show-isomagnitudes')?.checked;
            const showLabels = showIsomagnitudes && (getDOM('chk-show-labels')?.checked ?? true);

            if (showIsomagnitudes) {
                isomagnitudesGroup = new THREE.Group();

                data.isoLines.forEach(iso => {
                    if (iso.isoNorthCoords && iso.isoNorthCoords.length > 1) {
                        const lineN = createSegmentedLine(iso.isoNorthCoords, 0xeab308, EARTH_RADIUS * 1.0028, 1, 0.70);
                        if (lineN) isomagnitudesGroup.add(lineN);
                    }
                    if (iso.isoSouthCoords && iso.isoSouthCoords.length > 1) {
                        const lineS = createSegmentedLine(iso.isoSouthCoords, 0xeab308, EARTH_RADIUS * 1.0028, 1, 0.70);
                        if (lineS) isomagnitudesGroup.add(lineS);
                    }

                    if (showLabels && iso.magText) {
                        if (iso.midPtN) {
                            const spriteN = createTextSprite(iso.magText, '#000000', '#ffffff', 0.65);
                            if (spriteN) {
                                const posN = latLngToVector3(iso.midPtN.lat, iso.midPtN.lng, EARTH_RADIUS * 1.010);
                                spriteN.position.copy(posN);
                                isomagnitudesGroup.add(spriteN);
                            }
                        }
                        if (iso.midPtS) {
                            const spriteS = createTextSprite(iso.magText, '#000000', '#ffffff', 0.65);
                            if (spriteS) {
                                const posS = latLngToVector3(iso.midPtS.lat, iso.midPtS.lng, EARTH_RADIUS * 1.010);
                                spriteS.position.copy(posS);
                                isomagnitudesGroup.add(spriteS);
                            }
                        }
                    }
                });

                // Renderizar Lóbulo de Amanecer (Naranja #f97316)
                if (data.sunriseLoop && data.sunriseLoop.length > 1) {
                    const lineSunriseTerm = createSegmentedLine(data.sunriseLoop, 0xf97316, EARTH_RADIUS * 1.0028, 2);
                    if (lineSunriseTerm) isomagnitudesGroup.add(lineSunriseTerm);
                }

                // Renderizar Lóbulo de Atardecer (Naranja #f97316)
                if (data.sunsetLoop && data.sunsetLoop.length > 1) {
                    const lineSunsetTerm = createSegmentedLine(data.sunsetLoop, 0xf97316, EARTH_RADIUS * 1.0028, 2);
                    if (lineSunsetTerm) isomagnitudesGroup.add(lineSunsetTerm);
                }

                // Curva de Máximo Eclipse en Horizonte (Espenak analítica Cian #38bdf8)
                if (data.fullEspenakLoop && data.fullEspenakLoop.length > 1) {
                    const lineEspenakMax = createSegmentedLine(data.fullEspenakLoop, 0x38bdf8, EARTH_RADIUS * 1.0028, 3);
                    if (lineEspenakMax) isomagnitudesGroup.add(lineEspenakMax);
                }

                earthGroup.add(isomagnitudesGroup);
            }

            // 4. LÍNEAS DE TIEMPO UNIVERSAL (HORAS UT)
            const showUtLines = showIsomagnitudes;
            if (showUtLines) {
                utLinesGroup = new THREE.Group();

                data.utLines.forEach(utLine => {
                    if (utLine.pts && utLine.pts.length > 1) {
                        const utLineMesh = createSegmentedLine(utLine.pts, 0x10b981, EARTH_RADIUS * 1.0028, 1, 0.70);
                        if (utLineMesh) utLinesGroup.add(utLineMesh);

                        if (showLabels && utLine.labelPt) {
                            const textSprite = createTextSprite(utLine.labelText, '#000000', '#ffffff', 0.75);
                            if (textSprite) {
                                const spritePos = latLngToVector3(utLine.labelPt.lat, utLine.labelPt.lng, EARTH_RADIUS * 1.018);
                                textSprite.position.copy(spritePos);
                                utLinesGroup.add(textSprite);
                            }
                        }
                    }
                });

                earthGroup.add(utLinesGroup);
            }
        }

        let currentTValEl = null;
        let _elPlayerTimeLocalLabel = null;
        let _elPlayerTimeUtcLabel = null;
        let _elTimeUtcText = null;
        let _elTimeLocalText = null;
        let _elPhaseLabel = null;
        let _elCurrentSlider = null;
        let _lastUmbRadBottom = -1;
        let _lastPenRadBottom = -1;
        let _lastConeHeight = -1;

        function updateShadowAtTime(t) {
            if (!currentEclipse) return;

            const e = currentEclipse;
            const x = (e.x0 || 0) + (e.x1 || 0)*t + (e.x2 || 0)*t*t + (e.x3 || 0)*t*t*t;
            const y = (e.y0 || 0) + (e.y1 || 0)*t + (e.y2 || 0)*t*t + (e.y3 || 0)*t*t*t;
            
            let muDeg = (e.mu0 || 0) + (e.mu1 || 0)*t;
            if (e.dt) {
                // Orientación astronómica exacta del Sol y el punto subsolar en UT mediante Delta T
                muDeg -= getEarthRotationAngleDeg(e.dt);
            }

            const l1 = (e.l10 || 0.54) + (e.l11 || 0)*t; 
            const l2 = Math.abs((e.l20 || 0.01) + (e.l21 || 0)*t);

            // Marco Inercial Canónico del Eclipse (fijado en el instante de referencia t0 = 0)
            const d0Deg = e.d0 || 0;
            let mu0Deg = e.mu0 || 0;
            if (e.dt) {
                mu0Deg -= getEarthRotationAngleDeg(e.dt);
            }

            // Vectores ortonormales canónicos fijos del Plano Fundamental Besseliano (wCanon, uCanon, vCanon)
            const wCanon = latLngToVector3(d0Deg, -mu0Deg, 1.0).normalize();
            const mu0Rad = -mu0Deg * Math.PI / 180;
            const uCanon = new THREE.Vector3(-Math.sin(mu0Rad), 0, -Math.cos(mu0Rad)).normalize();
            const vCanon = new THREE.Vector3().crossVectors(wCanon, uCanon).normalize();

            // Rotación física de la Tierra en torno a su eje polar Y (15°/hora en tiempo real)
            const deltaMuRad = (muDeg - mu0Deg) * (Math.PI / 180);
            const prevRotY = earthGroup.rotation.y;
            earthGroup.rotation.y = deltaMuRad;

            // En PLAY con Centrado activo: la cámara corota con la Tierra de forma que la superficie permanece quieta
            if (isPlaying && isPlaybackCentered && focusedBody !== 'moon' && !cameraTransition && lastShadowEclipseCat === e.cat_no) {
                const diffRotY = deltaMuRad - prevRotY;
                if (Math.abs(diffRotY) < Math.PI) {
                    camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), diffRotY);
                    if (controls && controls.target && controls.target.lengthSq() > 0.001) {
                        controls.target.applyAxisAngle(new THREE.Vector3(0, 1, 0), diffRotY);
                    }
                    if (controls) controls.update();
                }
            }
            lastShadowEclipseCat = e.cat_no;

            // Posicionar Luz Solar fija en el espacio en dirección wCanon
            const sunVecWorld = wCanon.clone().multiplyScalar(400);
            sunLight.position.copy(sunVecWorld);

            // 1. Actualizar Marcador 3D del Punto Subsolar (☀️ Sol en el Cenit: vector wCanon fijo en espacio)
            if (subsolarMarkerGroup) {
                const showSubsolar = getDOM('chk-show-subsolar')?.checked ?? true;
                subsolarMarkerGroup.visible = showSubsolar;
                if (showSubsolar) {
                    const pos = wCanon.clone().multiplyScalar(EARTH_RADIUS * 1.0026);
                    subsolarMarkerGroup.position.copy(pos);
                    subsolarMarkerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wCanon);
                }
            }

            // 2. Actualizar Marcador 3D del Punto Sublunar Real (🌕 Luna en el Cenit en el espacio canónico)
            if (sublunarMarkerGroup) {
                const showSublunar = getDOM('chk-show-sublunar')?.checked ?? false;
                sublunarMarkerGroup.visible = showSublunar;
                if (showSublunar) {
                    // Distancia media Tierra-Luna en radios terrestres
                    const MOON_DIST_RADII = 60.27;
                    const moonVecGeocentric = new THREE.Vector3()
                        .addScaledVector(uCanon, x)
                        .addScaledVector(vCanon, y)
                        .addScaledVector(wCanon, MOON_DIST_RADII)
                        .normalize();

                    const pos = moonVecGeocentric.clone().multiplyScalar(EARTH_RADIUS * 1.0026);
                    sublunarMarkerGroup.position.copy(pos);
                    sublunarMarkerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), moonVecGeocentric);
                }
            }

            // 3. Posicionar Sol 3D fijo con Corona Radiante en la dirección canónica wCanon
            if (sunGroup3D) {
                const sunPos = wCanon.clone().multiplyScalar(SUN_DIST);
                sunGroup3D.position.copy(sunPos);
                sunGroup3D.lookAt(0, 0, 0);
            }

            // 3b. Orientar Plano Eclíptico Físico 3D y Nodos Reales en el Marco Canónico Fijo
            const showEcliptic = getDOM('chk-show-ecliptic')?.checked ?? true;
            const showNodes = getDOM('chk-show-nodes')?.checked ?? true;
            const showLimits = getDOM('chk-show-limits')?.checked ?? true;
            if (eclipticPlaneGroup3D) eclipticPlaneGroup3D.visible = showEcliptic;
            if (nodeLine3D) nodeLine3D.visible = showNodes;
            if (nodesGroup3D) nodesGroup3D.visible = showLimits;

            // Algoritmos astronómicos de Meeus: calcular ángulos en t=0 canónico para orientación inercial fija
            const meeus = getEclipseMeeusAngles(currentEclipse, 0);
            const epsRad = meeus.epsRad;
            const epsDeg = meeus.epsDeg;
            const deltaNodeDeg = meeus.deltaNodeDeg;
            const isDescending = meeus.isDescending;

            // Orientación física exacta del Polo Norte Eclíptico en el marco inercial canónico:
            const alphaSunRad = Math.atan2(Math.cos(epsRad) * Math.sin(meeus.sunLonDeg * Math.PI / 180), Math.cos(meeus.sunLonDeg * Math.PI / 180));
            const alphaSunDeg = ((alphaSunRad * 180 / Math.PI) % 360 + 360) % 360;

            const muAries = mu0Deg + alphaSunDeg;
            const muEclPole = (muAries - 270) % 360;
            const latEclPole = 90 - epsDeg;

            // Vector unitario normal a la Eclíptica (N_ecl):
            const normEcliptic = latLngToVector3(latEclPole, -muEclPole, 1.0).normalize();

            if (eclipticPlaneGroup3D && showEcliptic) {
                eclipticPlaneGroup3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normEcliptic);
            }

            // 4b. Geometría inercial eclíptica y orbital según las leyes de Cassini
            // Vector unitario tangente a la Eclíptica hacia el Este (crecimiento de longitud eclíptica)
            const uLambda = new THREE.Vector3().crossVectors(normEcliptic, wCanon).normalize();

            // Vector unitario de la Línea de Nodos (uNode) en el plano de la Eclíptica:
            const angleSunToNodeRad = -deltaNodeDeg * Math.PI / 180;
            let uNode = new THREE.Vector3()
                .addScaledVector(wCanon, Math.cos(angleSunToNodeRad))
                .addScaledVector(uLambda, Math.sin(angleSunToNodeRad))
                .normalize();

            // Asegurar ortogonalidad matemática estricta con la normal de la Eclíptica
            uNode.sub(normEcliptic.clone().multiplyScalar(uNode.dot(normEcliptic))).normalize();
            lastNodePos3D = uNode.clone().multiplyScalar(MOON_DIST);

            // Plano orbital lunar inclinado i = 5.145° respecto a la Eclíptica alrededor de la Línea de Nodos (uNode):
            const incRad = 5.145 * Math.PI / 180;
            const vEcl = new THREE.Vector3().crossVectors(normEcliptic, uNode).normalize();
            const slope = isDescending ? 1.0 : -1.0;
            const normOrbit = new THREE.Vector3()
                .addScaledVector(normEcliptic, Math.cos(incRad))
                .addScaledVector(vEcl, slope * Math.sin(incRad))
                .normalize();

            // Tercera ley de Cassini: el eje de rotación lunar (moonSpinAxis), la normal a la Eclíptica (normEcliptic)
            // y la normal a la órbita (normOrbit) son coplanarios, con normEcliptic situado entre ambos.
            // Inclinación del eje de rotación lunar respecto a la normal eclíptica: I = 1.543° (en sentido opuesto a la órbita)
            const incMoonSpinRad = 1.543 * Math.PI / 180;
            const moonSpinAxis = new THREE.Vector3()
                .addScaledVector(normEcliptic, Math.cos(incMoonSpinRad))
                .addScaledVector(vEcl, -slope * Math.sin(incMoonSpinRad))
                .normalize();

            // 4. Posicionar y orientar la Luna 3D con rigor astronómico (leyes de Cassini y anclaje sincrónico)
            const xVal = x * EARTH_RADIUS;
            const yVal = y * EARTH_RADIUS;
            const zVal = Math.sqrt(Math.max(0, MOON_DIST * MOON_DIST - xVal * xVal - yVal * yVal));

            const moonPos = new THREE.Vector3()
                .addScaledVector(uCanon, xVal)
                .addScaledVector(vCanon, yVal)
                .addScaledVector(wCanon, zVal);

            if (moonMesh3D) {
                moonMesh3D.position.copy(moonPos);

                // Orientación de la Luna según el estado de Cassini:
                // Eje +Y local: Eje polar físico de rotación lunar (inclinado exactamente 1.543° respecto a la Eclíptica)
                // Eje +X local: Meridiano central selenográfico de la cara visible (apuntando hacia la Tierra)
                // Eje +Z local: Completa el triedro ortonormal hacia el limbo orbital lunar
                const vToEarth = moonPos.clone().negate().normalize();
                const axisY = moonSpinAxis.clone().normalize();
                const axisX = vToEarth.clone().sub(axisY.clone().multiplyScalar(vToEarth.dot(axisY))).normalize();
                const axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();

                const rotMatrix = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
                moonMesh3D.quaternion.setFromRotationMatrix(rotMatrix);
            }

            // Vector unitario tangente orbital en el sentido de traslación lunar (Oeste a Este)
            const uTangent = new THREE.Vector3().crossVectors(normOrbit, uNode).normalize();

            // Actualizar Órbita Lunar 3D inercial fija atravesando físicamente el plano eclíptico en el nodo uNode
            if (moonOrbitLine3D) {
                const showOrbit = getDOM('chk-show-moon-orbit')?.checked ?? true;
                moonOrbitLine3D.visible = showOrbit;
                if (showOrbit) {
                    const pts = [];
                    const segments = 360;
                    for (let i = 0; i <= segments; i++) {
                        const a = (i / segments) * Math.PI * 2;
                        const p = new THREE.Vector3()
                            .addScaledVector(uNode, MOON_DIST * Math.cos(a))
                            .addScaledVector(uTangent, MOON_DIST * Math.sin(a));
                        pts.push(p);
                    }
                    moonOrbitLine3D.geometry.setFromPoints(pts);
                    moonOrbitLine3D.geometry.computeBoundingSphere();
                }
            }

            // 4c. Línea de los Nodos 3D inercial fija
            if (nodeLine3D) {
                nodeLine3D.visible = showNodes;
                if (showNodes) {
                    const NODE_R = 4500.0;
                    const nodePts = [
                        uNode.clone().multiplyScalar(-NODE_R),
                        uNode.clone().multiplyScalar(NODE_R)
                    ];
                    nodeLine3D.geometry.setFromPoints(nodePts);
                    nodeLine3D.geometry.computeBoundingSphere();
                }
            }

            // 4d. Marcas de Límites de Eclipse y Rótulos Nodales en la Órbita Lunar
            if (nodesGroup3D) {
                nodesGroup3D.visible = showLimits;
                if (showLimits) {
                    const markers = initOrbitalLimitMarkers();
                    const currentNodeText = isDescending ? 'Nodo Descendente (☋) (0°)' : 'Nodo Ascendente (☊) (0°)';

                    // Actualizar textura del sprite del nodo si cambia entre ascendente y descendente
                    if (markers.lastNodeLabel !== currentNodeText) {
                        markers.lastNodeLabel = currentNodeText;
                        const nodeSpriteObj = markers.sprites.find(s => s.def.id === 'node');
                        if (nodeSpriteObj) {
                            const newSprite = createNodeSprite(currentNodeText, '#38bdf8');
                            if (nodeSpriteObj.sprite && nodeSpriteObj.sprite.material) {
                                if (nodeSpriteObj.sprite.material.map) nodeSpriteObj.sprite.material.map.dispose();
                                nodeSpriteObj.sprite.material.map = newSprite.material.map;
                                nodeSpriteObj.sprite.material.needsUpdate = true;
                            }
                        }
                    }

                    const showLimitLabels = showLimits && (getDOM('chk-show-limits-labels')?.checked ?? false);

                    markers.ticks.forEach((item, idx) => {
                        const angleRad = item.def.deg * Math.PI / 180;
                        const pos = new THREE.Vector3()
                            .addScaledVector(uNode, MOON_DIST * Math.cos(angleRad))
                            .addScaledVector(uTangent, MOON_DIST * Math.sin(angleRad));

                        // Línea corta perpendicular al plano orbital
                        const tickPts = [
                            pos.clone().addScaledVector(normOrbit, -item.def.tickLen),
                            pos.clone().addScaledVector(normOrbit, item.def.tickLen)
                        ];
                        item.line.geometry.setFromPoints(tickPts);
                        item.line.geometry.computeBoundingSphere();

                        // Posicionar rótulo flotante legible y sincronizar visibilidad
                        const spriteObj = markers.sprites[idx];
                        spriteObj.sprite.position.copy(pos).addScaledVector(normOrbit, item.def.tickLen + 35.0);
                        spriteObj.sprite.visible = showLimitLabels;
                    });
                }
            }

            // Sincronización exacta con la línea central cartográfica (corrección elipsoidal geodésica WGS84 sobre esfera 3D)
            let shadowCenterX = x;
            let shadowCenterY = y;
            let centerSurfacePos = null;

            const centerLL = besselianToLatLng(e, t);
            if (centerLL) {
                const pCenterWorld = latLngToVector3(centerLL.lat, centerLL.lng, 1.0)
                    .applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaMuRad);
                shadowCenterX = pCenterWorld.dot(uCanon);
                shadowCenterY = pCenterWorld.dot(vCanon);
                centerSurfacePos = pCenterWorld.clone().multiplyScalar(EARTH_RADIUS);
            }

            // 5. Conos Volumétricos de Umbra y Penumbra 3D
            const showSpaceCones = getDOM('chk-show-space-cones')?.checked ?? true;
            if (umbraConeMesh3D && penumbraConeMesh3D) {
                umbraConeMesh3D.visible = showSpaceCones;
                penumbraConeMesh3D.visible = showSpaceCones;

                if (showSpaceCones) {
                    // Posición exacta del centro de la sombra sobre la superficie esférica de la Tierra (z = zeta * R_E)
                    const r2 = x * x + y * y;
                    const zeta = r2 < 1.0 ? Math.sqrt(1.0 - r2) : 0.0;
                    const surfacePos = centerSurfacePos || new THREE.Vector3()
                        .addScaledVector(uCanon, x * EARTH_RADIUS)
                        .addScaledVector(vCanon, y * EARTH_RADIUS)
                        .addScaledVector(wCanon, zeta * EARTH_RADIUS);
                    
                    const coneHeight = Math.max(10.0, centerSurfacePos ? moonPos.distanceTo(centerSurfacePos) : (MOON_DIST - (zeta * EARTH_RADIUS)));
                    const midPos = moonPos.clone().add(surfacePos).multiplyScalar(0.5);
                    const coneDir = centerSurfacePos ? moonPos.clone().sub(centerSurfacePos).normalize() : wCanon.clone();
                    const coneQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), coneDir);

                    // 1. Cono de Umbra (Totalidad): converge desde la Luna hasta la mancha negra exacta en la superficie (l2)
                    const umbRadBottom = Math.max(0.25, Math.abs(l2) * EARTH_RADIUS);
                    // 2. Cono de Penumbra: haz exterior de semisombra hacia l1
                    const penRadBottom = Math.max(1.0, l1 * EARTH_RADIUS);

                    const needsGeometryUpdate = (
                        Math.abs(umbRadBottom - _lastUmbRadBottom) > 0.1 ||
                        Math.abs(penRadBottom - _lastPenRadBottom) > 0.1 ||
                        Math.abs(coneHeight - _lastConeHeight) > 0.1
                    );

                    if (needsGeometryUpdate) {
                        umbraConeMesh3D.geometry.dispose();
                        umbraConeMesh3D.geometry = new THREE.CylinderGeometry(MOON_RADIUS, umbRadBottom, coneHeight, 32, 1, true);
                        penumbraConeMesh3D.geometry.dispose();
                        penumbraConeMesh3D.geometry = new THREE.CylinderGeometry(MOON_RADIUS, penRadBottom, coneHeight, 32, 1, true);

                        _lastUmbRadBottom = umbRadBottom;
                        _lastPenRadBottom = penRadBottom;
                        _lastConeHeight = coneHeight;
                    }

                    umbraConeMesh3D.position.copy(midPos);
                    umbraConeMesh3D.quaternion.copy(coneQuat);

                    penumbraConeMesh3D.position.copy(midPos);
                    penumbraConeMesh3D.quaternion.copy(coneQuat);
                }
            }

            // 6. Órbita Lunar sincronizada arriba

            // Enviar uniforms exactos al Shader GPU en el marco canónico
            shadowShaderMaterial.uniforms.uSunDir.value.copy(wCanon);
            shadowShaderMaterial.uniforms.uVx.value.copy(uCanon);
            shadowShaderMaterial.uniforms.uVy.value.copy(vCanon);
            shadowShaderMaterial.uniforms.uShadowCenter.value.set(shadowCenterX, shadowCenterY);
            shadowShaderMaterial.uniforms.uL1.value = l1;
            shadowShaderMaterial.uniforms.uL2.value = l2;
            shadowShaderMaterial.uniformsNeedUpdate = true;

            // Etiquetas de tiempo en el dock del reproductor
            const dtHours = (e.dt || 0) / 3600;
            const utDecHour = (e.t0 || 12) + t - dtHours;
            const year = e.year || 2026;
            const month = (e.month || 8) - 1;
            const day = e.day || 12;
            const baseMidnightUtc = Date.UTC(year, month, day, 0, 0, 0);
            const utDateObj = new Date(baseMidnightUtc + Math.round(utDecHour * 3600 * 1000));
            
            const utH = utDateObj.getUTCHours();
            const utM = utDateObj.getUTCMinutes();
            const utS = utDateObj.getUTCSeconds();
            const utTimeStr = `${String(utH).padStart(2,'0')}:${String(utM).padStart(2,'0')}:${String(utS).padStart(2,'0')}`;

            if (!_elPlayerTimeLocalLabel) _elPlayerTimeLocalLabel = getDOM('player-time-local-label');
            if (!_elPlayerTimeUtcLabel) _elPlayerTimeUtcLabel = getDOM('player-time-utc-label');
            if (!_elTimeUtcText) _elTimeUtcText = getDOM('time-utc-text');
            if (!_elTimeLocalText) _elTimeLocalText = getDOM('time-local-text');

            if (activeExtremeMode) {
                if (_elPlayerTimeLocalLabel) _elPlayerTimeLocalLabel.textContent = 'UT1';
                if (_elPlayerTimeUtcLabel) _elPlayerTimeUtcLabel.textContent = 'TT';
                if (_elTimeLocalText) _elTimeLocalText.textContent = utTimeStr;

                const ttDecHour = (e.t0 || 12) + t;
                const ttDateObj = new Date(baseMidnightUtc + Math.round(ttDecHour * 3600 * 1000));
                const ttH = ttDateObj.getUTCHours();
                const ttM = ttDateObj.getUTCMinutes();
                const ttS = ttDateObj.getUTCSeconds();
                if (_elTimeUtcText) {
                    _elTimeUtcText.textContent = `${String(ttH).padStart(2,'0')}:${String(ttM).padStart(2,'0')}:${String(ttS).padStart(2,'0')}`;
                }
            } else {
                if (_elPlayerTimeLocalLabel) _elPlayerTimeLocalLabel.textContent = 'Obs.';
                if (_elPlayerTimeUtcLabel) _elPlayerTimeUtcLabel.textContent = 'UTC';
                if (_elTimeUtcText) {
                    _elTimeUtcText.textContent = utTimeStr;
                }

                if (_elTimeLocalText && currentObserver) {
                    const tz = currentObserver.tz || getTimeZoneFromLon(currentObserver.lon || 0);
                    try {
                        const localTimeStr = getCachedTimeFormatter(tz).format(utDateObj);
                        const tzOffsetStr = getUtcOffsetString(tz, utDateObj);
                        _elTimeLocalText.textContent = `${localTimeStr} ${tzOffsetStr}`;
                    } catch(err) {
                        _elTimeLocalText.textContent = `${utTimeStr} UTC`;
                    }
                }
            }

            // Actualizar etiqueta de fase dinámica en la cabecera del reproductor (si no estamos en Modo Ruta)
            if (typeof currentActiveView === 'undefined' || currentActiveView !== 'route') {
                if (!_elPhaseLabel) _elPhaseLabel = getDOM('player-phase-label');
                if (_elPhaseLabel) {
                    const circ = localCircumstancesCache || (currentObserver && calculateLocalSolarCircumstances(e, currentObserver.lat, currentObserver.lon));

                    if (circ && circ.c1 && circ.c4) {
                        const t1 = circ.c1.t;
                        const t4 = circ.c4.t;
                        const t2 = circ.c2 ? circ.c2.t : null;
                        const t3 = circ.c3 ? circ.c3.t : null;

                        const pNow = circ.getParamsAtT ? circ.getParamsAtT(t) : null;
                        const isSunAbove = pNow ? (pNow.alt > -0.5) : true;

                        if (t >= t1 && t <= t4) {
                            if (!isSunAbove) {
                                _elPhaseLabel.innerHTML = `<span style="color: #94a3b8;"><span class="phase-dot" style="background:#64748b;"></span>Bajo horizonte</span>`;
                            } else if (t2 != null && t3 != null && t >= t2 && t <= t3) {
                                if (circ.isTotal) {
                                    _elPhaseLabel.innerHTML = `<span style="color: #fca5a5;"><span class="phase-dot total"></span>Totalidad</span>`;
                                } else if (circ.isAnnular) {
                                    _elPhaseLabel.innerHTML = `<span style="color: #fde047;"><span class="phase-dot" style="background:#eab308; box-shadow:0 0 6px rgba(234,179,8,0.6);"></span>Anularidad</span>`;
                                } else {
                                    _elPhaseLabel.innerHTML = `<span style="color: #93c5fd;"><span class="phase-dot" style="background:#38bdf8; box-shadow:0 0 5px rgba(56,189,248,0.5);"></span>Parcialidad</span>`;
                                }
                            } else if ((t2 != null && t3 != null && ((t >= t1 && t < t2) || (t > t3 && t <= t4))) || (t2 == null && t >= t1 && t <= t4)) {
                                _elPhaseLabel.innerHTML = `<span style="color: #93c5fd;"><span class="phase-dot" style="background:#38bdf8; box-shadow:0 0 5px rgba(56,189,248,0.5);"></span>Parcialidad</span>`;
                            } else {
                                _elPhaseLabel.innerHTML = '';
                            }
                        } else {
                            _elPhaseLabel.innerHTML = '';
                        }
                    } else {
                        _elPhaseLabel.innerHTML = '';
                    }
                }
            }

            // Iluminar fila activa en la tabla horaria de contactos locales (solo si cambia de estado)
            if (localCircumstancesCache) {
                const circ = localCircumstancesCache;
                const matchThresholdHours = 100 / 3600; // Margen dinámico de ±100 segundos
                const contactTimes = [
                    { key: 'C1', t: circ.c1?.t },
                    { key: 'C2', t: circ.c2?.t },
                    { key: 'MÁX', t: circ.tMax },
                    { key: 'C3', t: circ.c3?.t },
                    { key: 'C4', t: circ.c4?.t }
                ];
                let closestKey = null;
                let minDiff = Infinity;
                for (const c of contactTimes) {
                    if (c.t != null) {
                        const diff = Math.abs(t - c.t);
                        if (diff <= matchThresholdHours && diff < minDiff) {
                            minDiff = diff;
                            closestKey = c.key;
                        }
                    }
                }
                const targetRowId = closestKey ? `row-contact-${closestKey}` : null;
                if (targetRowId !== activeContactRowId) {
                    if (activeContactRowId) {
                        const prevRow = getDOM(activeContactRowId);
                        if (prevRow) prevRow.classList.remove('active');
                    }
                    if (targetRowId) {
                        const newRow = getDOM(targetRowId);
                        if (newRow) newRow.classList.add('active');
                    }
                    activeContactRowId = targetRowId;
                }
            } else if (activeContactRowId) {
                const prevRow = getDOM(activeContactRowId);
                if (prevRow) prevRow.classList.remove('active');
                activeContactRowId = null;
            }

            if (!_elCurrentSlider) _elCurrentSlider = getDOM('time-slider');
            if (_elCurrentSlider && !isSliderInteracting && document.activeElement !== _elCurrentSlider) {
                _elCurrentSlider.value = t;
            }

            if (currentActiveView === 'telescopic') {
                renderTelescopicView();
            }

            needsRender = true;
        }

        function recenterEarth(lat, lng) {
            focusedBody = 'earth';
            const center = controls ? controls.target : new THREE.Vector3(0, 0, 0);
            const currentDist = camera.position.distanceTo(center) || 210;
            const targetPosLocal = latLngToVector3(lat, lng, currentDist);
            const rotY = (earthGroup && earthGroup.rotation) ? earthGroup.rotation.y : 0;
            const targetPos = targetPosLocal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
            transitionCamera(new THREE.Vector3(0, 0, 0), targetPos, 700);
        }

        function recenterEclipseGE() {
            if (currentEclipse) {
                const maxLat = currentEclipse.lat_dd_ge || 0;
                const maxLng = currentEclipse.lng_dd_ge || 0;
                recenterEarth(maxLat, maxLng);
            }
        }


// Exposición en el objeto global
if (typeof window !== 'undefined') {
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;
    window.controls = controls;
    window.EARTH_RADIUS = EARTH_RADIUS;
    window.MOON_RADIUS = MOON_RADIUS;
    window.MOON_DIST = MOON_DIST;
    window.SUN_RADIUS = SUN_RADIUS;
    window.SUN_DIST = SUN_DIST;
    window.latLngToVector3 = latLngToVector3;
    window.vector3ToLatLng = vector3ToLatLng;
    window.transitionCamera = transitionCamera;
    window.handle3DSpaceClick = handle3DSpaceClick;
    window.drawShadowPath = drawShadowPath;
    window.updateShadowAtTime = updateShadowAtTime;
    window.updateMoonOrbit = updateMoonOrbit;
    window.updateGraticule = updateGraticule;
    window.recenterEarth = recenterEarth;
    window.recenterEclipseGE = recenterEclipseGE;
    window.disposeMaterial = disposeMaterial;
    window.dispose3DObject = dispose3DObject;
    window.earthGroup = earthGroup;
    window.earthMesh = earthMesh;
    window.shadowShaderMaterial = shadowShaderMaterial;
    window.cameraTransition = cameraTransition;
    window.focusedBody = focusedBody;
    window.isPlaybackCentered = isPlaybackCentered;
    window.playbackCenteredPref = playbackCenteredPref;
    window.lastShadowEclipseCat = lastShadowEclipseCat;
    window.sunGroup3D = sunGroup3D;
    window.sunMesh3D = sunMesh3D;
    window.moonMesh3D = moonMesh3D;
    window.umbraConeMesh3D = umbraConeMesh3D;
    window.penumbraConeMesh3D = penumbraConeMesh3D;
    window.moonOrbitLine3D = moonOrbitLine3D;
    window.eclipticPlaneGroup3D = eclipticPlaneGroup3D;
    window.observerMarkerGroup3D = observerMarkerGroup3D;
    window.subsolarMarkerGroup = subsolarMarkerGroup;
    window.sublunarMarkerGroup = sublunarMarkerGroup;
    window.pathLine = pathLine;
    window.totalityNorthLine = totalityNorthLine;
    window.totalitySouthLine = totalitySouthLine;
    window.isomagnitudesGroup = isomagnitudesGroup;
    window.graticuleGroup = graticuleGroup;
    window.moonPolarAxisGroup = moonPolarAxisGroup;
    window.utLinesGroup = utLinesGroup;
    window.requestRender = requestRender;
    window.needsRender = needsRender;
    window.Scene3D = {
        scene,
        camera,
        renderer,
        controls,
        transitionCamera,
        handle3DSpaceClick,
        latLngToVector3,
        vector3ToLatLng,
        drawShadowPath,
        updateShadowAtTime,
        updateMoonOrbit,
        updateGraticule,
        recenterEarth,
        recenterEclipseGE,
        disposeMaterial,
        dispose3DObject,
        EARTH_RADIUS,
        MOON_RADIUS,
        MOON_DIST,
        SUN_RADIUS,
        SUN_DIST
    };
}
