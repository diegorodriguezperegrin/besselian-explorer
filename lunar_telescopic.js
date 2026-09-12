/* =========================================================================
   COSMOS MATARÓ - VISOR TELESCÓPICO 2D (lunar_telescopic.js)
   Renderizado fotográfico en Canvas 2D de la Luna, proyección interactiva
   de umbra y penumbra de la Tierra, coordenadas altacimutales/ecuatoriales,
   orientación por ángulo paraláctico (q) y etiquetas de accidentes lunares.
   ========================================================================= */

var RAD = window.RAD || (Math.PI / 180);
var DEG = window.DEG || (180 / Math.PI);
var EARTH_RADIUS = window.EARTH_RADIUS || 6.371;
var MOON_RADIUS = window.MOON_RADIUS || 1.7374;
var MOON_DIST = window.MOON_DIST || 384.4;
var SUN_RADIUS = window.SUN_RADIUS || 696.34;
var SUN_DIST = window.SUN_DIST || 149598.0;

// Textura Fotográfica de la Luna (Vista Telescópica 2D)
        const moonImg = new Image();
        let moonImageLoaded = false;
        let cachedMoonDiskCanvas = null;

        function getPreRenderedMoonDisk() {
            if (cachedMoonDiskCanvas) return cachedMoonDiskCanvas;
            if (!moonImageLoaded || !moonImg.complete || moonImg.naturalWidth === 0) return null;
            
            const size = 1024;
            const off = document.createElement('canvas');
            off.width = size;
            off.height = size;
            const octx = off.getContext('2d');
            
            octx.beginPath();
            octx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
            octx.clip();
            octx.drawImage(moonImg, 64, 32, 924, 960, 0, 0, size, size);
            
            cachedMoonDiskCanvas = off;
            return cachedMoonDiskCanvas;
        }

        moonImg.onload = () => {
            moonImageLoaded = true;
            getPreRenderedMoonDisk();
            if (typeof currentActiveView !== 'undefined' && currentActiveView === 'telescopic') renderTelescopicView();
        };
        moonImg.src = 'realistic_moon.png';

        // Variables de Vista Telescópica 2D (Fijada en Posición Local Altacimutal)
        const telescopicOrientation = 'altaz'; // Siempre local desde Mataró (Cenit arriba)
        let teleZoom = 1.0, telePanX = 0, telePanY = 0, isDraggingTele = false, dragStartX = 0, dragStartY = 0;

function toggleTelescopeHUD(show) {
            const hud = document.getElementById('telescope-hud');
            if (hud) hud.style.display = show ? 'flex' : 'none';
        }

        function updateTelescopeHUD(horizCoords) {
            const hud = document.getElementById('telescope-hud');
            const chkHud = document.getElementById('chk-show-tele-hud');
            const isVisible = !chkHud || chkHud.checked;
            if (hud) hud.style.display = isVisible ? 'flex' : 'none';
            if (!isVisible) return;

            const pillCoords = document.getElementById('hud-pill-coords');
            const pillOrient = document.getElementById('hud-pill-orient');
            if (!pillCoords || !pillOrient) return;

            if (horizCoords && currentEclipse) {
                const chiRad = getEclipseFrameTilt(currentEclipse, simCurrentTimeMs);
                const isEquatorial = document.getElementById('chk-show-equatorial') && document.getElementById('chk-show-equatorial').checked;

                // Limpiar nombre del observador para evitar anidamientos de paréntesis como "Mataró (Cosmos Mataró)"
                const cleanObsName = currentObserver.name.replace(/\s*\([^)]*\)/g, '').trim() || currentObserver.name;

                if (isEquatorial) {
                    pillOrient.textContent = 'Vista Ecuatorial (Norte arriba)';
                } else {
                    pillOrient.textContent = `Vista Local (${cleanObsName} · Cenit arriba)`;
                }

                const totalVisualRotDeg = (isEquatorial ? chiRad : (horizCoords.qRad + chiRad)) * DEG;
                pillCoords.style.display = 'flex';
                const isAbove = horizCoords.alt > -0.5;
                if (isAbove) {
                    pillCoords.className = 'hud-pill altaz';
                    pillCoords.textContent = `Alt: ${horizCoords.alt.toFixed(1)}° · Az: ${horizCoords.az.toFixed(1)}° · Paraláctico (q): ${horizCoords.qDeg >= 0 ? '+' : ''}${horizCoords.qDeg.toFixed(1)}° (Rot. visual: ${totalVisualRotDeg.toFixed(1)}°)`;
                } else {
                    pillCoords.className = 'hud-pill warning';
                    pillCoords.textContent = `Bajo el horizonte (${horizCoords.alt.toFixed(1)}°) · Paraláctico (q): ${horizCoords.qDeg >= 0 ? '+' : ''}${horizCoords.qDeg.toFixed(1)}°`;
                }
            }
        }

        // 2. Inclinación del Marco Fundamental del Eclipse (Eclíptica / Órbita) respecto al Ecuador Celeste
        function getEclipseFrameTilt(ec, tMs) {
            const d = (tMs - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
            const T = d / 36525;
            const L0 = (280.46646 + 36000.76983 * T) % 360;
            const M = (357.52911 + 35999.05029 * T) * RAD;
            const C = (1.914602 - 0.004817 * T) * Math.sin(M) + 0.02 * Math.sin(2 * M);
            const sunLon = (L0 + C) * RAD;
            const eps = 23.439291 * RAD;

            // Inclinación de la Eclíptica respecto al Ecuador Celeste en la posición de la sombra
            const sinPsi = Math.sin(eps) * Math.cos(sunLon + Math.PI) / Math.cos(ec.zenLat * RAD);
            const psiRad = Math.asin(Math.max(-1, Math.min(1, sinPsi)));
            
            // Inclinación del vector de velocidad orbital relativa respecto a la Eclíptica (~2.6°)
            const orbitalTilt = (ec.saros % 2 === 0 ? 0.045 : -0.045);
            const chiRad = psiRad + orbitalTilt;
            return chiRad;
        }
        // [getUtcOffsetString, updateObserverPosition, observer dropdown] Extraído a lunar_observer_manager.js

        function getMoonHorizontalCoords(zenLat, zenLonMax, tMs, maxMs, obsLat = currentObserver.lat, obsLon = currentObserver.lon) {
            const dtHours = (tMs - maxMs) / 3600000;
            const zenLon = zenLonMax - dtHours * 15.041;
            const phi1 = obsLat * RAD, phi2 = zenLat * RAD;
            const dLon = (obsLon - zenLon) * RAD;
            
            // Altitud astronómica
            const sinAlt = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLon);
            const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
            const alt = altRad * DEG;

            // Azimut desde el Norte (0° = N, 90° = E, 180° = S, 270° = O)
            const cosAz = (Math.sin(phi2) - Math.sin(phi1) * Math.sin(altRad)) / (Math.cos(phi1) * Math.cos(altRad));
            let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * DEG;
            if (Math.sin(dLon) > 0) { // H > 0 => Hemisferio Oeste
                az = 360 - az;
            }

            // Ángulo Paraláctico q: ángulo entre el Cenit y el Polo Norte Celeste
            const numQ = Math.sin(dLon) * Math.cos(phi1);
            const denQ = Math.sin(phi1) * Math.cos(phi2) - Math.cos(phi1) * Math.sin(phi2) * Math.cos(dLon);
            const qRad = Math.atan2(numQ, denQ);
            const qDeg = qRad * DEG;

            return { alt, az, qRad, qDeg };
        }

// 3. Motor de la Vista Telescópica 2D (Sombra y Luna Fotográfica Realista)
        function initTelescopicCanvas() {
            const canvas = document.getElementById('canvas-telescopic');
            window.addEventListener('resize', resizeTelescopicCanvas);
            resizeTelescopicCanvas();

            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
                teleZoom = Math.max(0.4, Math.min(6.0, teleZoom * zoomFactor));
                renderTelescopicView();
            }, { passive: false });

            canvas.addEventListener('mousedown', (e) => {
                isDraggingTele = true;
                dragStartX = e.clientX - telePanX;
                dragStartY = e.clientY - telePanY;
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDraggingTele) return;
                telePanX = e.clientX - dragStartX;
                telePanY = e.clientY - dragStartY;
                renderTelescopicView();
            });

            window.addEventListener('mouseup', () => { isDraggingTele = false; });
        }

        function resizeTelescopicCanvas() {
            const canvas = document.getElementById('canvas-telescopic');
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            renderTelescopicView();
        }

        function getMoonShadowCoordsAtTime(tMs) {
            const ec = currentEclipse;
            const dtHours = (tMs - ec.maxMs) / 3600000;
            
            // Radios físicos exactos de la Umbra y Penumbra a la distancia orbital media de la Luna (384.400 km)
            const umbraLength = SUN_DIST * (EARTH_RADIUS / (SUN_RADIUS - EARTH_RADIUS));
            const rUmbraKm = EARTH_RADIUS * (1.0 - MOON_DIST / umbraLength);             // 4.598 km
            const rPenumbraKm = EARTH_RADIUS + ((SUN_RADIUS + EARTH_RADIUS) / SUN_DIST) * MOON_DIST; // 8.177 km

            // Proporciones adimensionales exactas respecto al radio lunar (1.737,4 km)
            const rMoon = 1.0;
            const rUmbra = rUmbraKm / MOON_RADIUS;         // 2.64653
            const rPenumbra = rPenumbraKm / MOON_RADIUS;   // 4.70626

            // Distancia mínima exacta al centro de la sombra en el instante de Máximo (definición canónica de la NASA)
            let dMin;
            if (ec.umMag > 0) {
                // Eclipse Umbral (Total o Parcial): Mag_u = (rUmbra + rMoon - dMin) / (2 * rMoon)
                dMin = rUmbra + rMoon - 2.0 * rMoon * ec.umMag;
            } else {
                // Eclipse Penumbral: Mag_p = (rPenumbra + rMoon - dMin) / (2 * rMoon)
                dMin = rPenumbra + rMoon - 2.0 * rMoon * ec.penMag;
            }
            dMin = Math.max(0, dMin);

            // Desplazamiento en el eje Y según el hemisferio de cruce (signo del parámetro Gamma)
            // En Canvas 2D, -Y es Norte (arriba) y +Y es Sur (abajo)
            const yMax = (ec.gamma >= 0 ? -1 : 1) * dMin;

            // Velocidad orbital a lo largo del eje X calculada a partir de los contactos canónicos
            let vx = 1.85;
            if (ec.p4Ms && ec.p1Ms && (ec.p4Ms > ec.p1Ms)) {
                const tPenHours = (ec.p4Ms - ec.p1Ms) / 3600000;
                const rPenContact = rPenumbra + rMoon;
                const xPenContactSq = rPenContact * rPenContact - yMax * yMax;
                if (xPenContactSq > 0 && tPenHours > 0) {
                    vx = (2.0 * Math.sqrt(xPenContactSq)) / tPenHours;
                }
            }

            // En coordenadas celestes estándar (Norte arriba):
            // El Oeste (+X) está a la derecha y el Este (-X) a la izquierda.
            // La Luna se mueve de Oeste a Este: a t < maxMs (dtHours < 0), la Luna está en el Oeste (+X)
            // Gamma > 0 significa que la Luna pasa al NORTE (+Y celeste => -Y pantalla)
            const x = -dtHours * vx;
            const y = yMax;
            const dist = Math.sqrt(x * x + y * y);

            return { x, y, dist, rMoon, rUmbra, rPenumbra, rUmbraKm, rPenumbraKm };
        }

        function renderTelescopicView() {
            const canvas = document.getElementById('canvas-telescopic');
            if (!canvas || currentActiveView !== 'telescopic' || !currentEclipse) return;

            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const w = canvas.width / dpr, h = canvas.height / dpr;

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, w, h);

            // Fondo de Espacio Profundo Estelar
            ctx.fillStyle = "#050811";
            ctx.fillRect(0, 0, w, h);

            const cx = w / 2 + telePanX;
            const cy = h / 2 + telePanY;
            const baseScale = Math.min(w, h) * 0.11 * teleZoom;

            ctx.translate(cx, cy);

            const geo = getMoonShadowCoordsAtTime(simCurrentTimeMs);
            const ruPx = geo.rUmbra * baseScale;
            const rpPx = geo.rPenumbra * baseScale;
            const rmPx = geo.rMoon * baseScale;

            // Salvaguarda de zoom para los rótulos de accidentes lunares
            const MIN_ZOOM_FOR_FEATURES = 1.30;
            const chkFeatures = document.getElementById('chk-show-features');
            const lblFeatures = document.getElementById('lbl-show-features');
            const isZoomAllowed = teleZoom >= MIN_ZOOM_FOR_FEATURES;
            if (chkFeatures && lblFeatures) {
                chkFeatures.disabled = !isZoomAllowed;
                if (!isZoomAllowed) {
                    lblFeatures.style.opacity = '0.45';
                    lblFeatures.style.cursor = 'not-allowed';
                    lblFeatures.title = 'Rótulos bloqueados: amplía el zoom (≥ 1.3×) para activarlos';
                } else {
                    lblFeatures.style.opacity = '1.0';
                    lblFeatures.style.cursor = 'pointer';
                    lblFeatures.title = 'Mostrar u ocultar los rótulos de accidentes lunares';
                }
            }

            const showAxes = document.getElementById('chk-show-axes') ? document.getElementById('chk-show-axes').checked : true;
            const showFeatures = (chkFeatures ? chkFeatures.checked : true) && isZoomAllowed;
            const isEquatorial = document.getElementById('chk-show-equatorial') && document.getElementById('chk-show-equatorial').checked;

            const horizCoords = getMoonHorizontalCoords(currentEclipse.zenLat, currentEclipse.zenLon, simCurrentTimeMs, currentEclipse.maxMs);
            const chiRad = getEclipseFrameTilt(currentEclipse, simCurrentTimeMs);
            
            // Si es Ecuatorial: Norte Celeste arriba (rotAngle = chiRad)
            // Si es Altacimutal (Local): Cenit arriba (rotAngle = horizCoords.qRad + chiRad)
            const rotAngle = isEquatorial ? chiRad : (horizCoords.qRad + chiRad);

            // 1. Ejes de Referencia locales o ecuatoriales (fijos al visor)
            if (showAxes) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
                ctx.lineWidth = 1;
                ctx.moveTo(-rpPx * 1.35, 0); ctx.lineTo(rpPx * 1.35, 0);
                ctx.moveTo(0, -rpPx * 1.35); ctx.lineTo(0, rpPx * 1.35);
                ctx.stroke();

                ctx.font = "bold 11px 'Outfit', sans-serif";
                ctx.textAlign = "center";

                if (isEquatorial) {
                    ctx.fillStyle = "#f59e0b";
                    ctx.fillText("▲ NORTE CELESTE (Arriba)", 0, -rpPx * 1.4);
                    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
                    ctx.fillText("▼ SUR CELESTE (Abajo)", 0, rpPx * 1.45);

                    // Flecha guía hacia el Cenit Local (a ángulo -q del Norte Celeste)
                    ctx.save();
                    ctx.rotate(-horizCoords.qRad);
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
                    ctx.setLineDash([3, 3]);
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -rpPx * 1.35);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = "#38bdf8";
                    ctx.font = "bold 10px 'JetBrains Mono', monospace";
                    ctx.fillText("Cenit Local", 0, -rpPx * 1.38);
                    ctx.restore();
                } else {
                    ctx.fillStyle = "#38bdf8";
                    ctx.fillText("▲ CENIT (Arriba)", 0, -rpPx * 1.4);
                    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
                    ctx.fillText("▼ HORIZONTE (Abajo)", 0, rpPx * 1.45);

                    // Flecha guía hacia el Norte Celeste (a ángulo q exacto del Cenit)
                    ctx.save();
                    ctx.rotate(horizCoords.qRad);
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(245, 158, 11, 0.65)";
                    ctx.setLineDash([3, 3]);
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -rpPx * 1.35);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = "#f59e0b";
                    ctx.font = "bold 10px 'JetBrains Mono', monospace";
                    ctx.fillText("N Celeste", 0, -rpPx * 1.38);
                    ctx.restore();
                }

                ctx.restore();
            }

            // Aplicar la rotación del observador a la escena astronómica
            ctx.save();
            ctx.rotate(rotAngle);

            // 2. Disco de la Penumbra Terrestre (Gradiente pronunciado y contrastado)
            const penGrad = ctx.createRadialGradient(0, 0, ruPx, 0, 0, rpPx);
            penGrad.addColorStop(0, "rgba(10, 15, 28, 0.90)");
            penGrad.addColorStop(0.35, "rgba(14, 20, 36, 0.70)");
            penGrad.addColorStop(0.70, "rgba(18, 28, 48, 0.40)");
            penGrad.addColorStop(0.92, "rgba(22, 34, 58, 0.15)");
            penGrad.addColorStop(1, "rgba(10, 15, 30, 0)");
            ctx.beginPath();
            ctx.fillStyle = penGrad;
            ctx.arc(0, 0, rpPx, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.strokeStyle = "rgba(147, 197, 253, 0.35)";
            ctx.setLineDash([4, 4]);
            ctx.arc(0, 0, rpPx, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // 3. Disco de la Umbra Terrestre (Gradiente: más oscuro en el centro, más claro y cobrizo hacia el borde)
            const umbGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ruPx);
            umbGrad.addColorStop(0, "rgba(18, 6, 5, 0.98)");
            umbGrad.addColorStop(0.45, "rgba(42, 14, 9, 0.92)");
            umbGrad.addColorStop(0.75, "rgba(78, 26, 14, 0.84)");
            umbGrad.addColorStop(0.92, "rgba(115, 40, 20, 0.74)");
            umbGrad.addColorStop(1, "rgba(150, 55, 26, 0.60)");

            ctx.beginPath();
            ctx.fillStyle = umbGrad;
            ctx.arc(0, 0, ruPx, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.strokeStyle = "rgba(160, 60, 40, 0.35)";
            ctx.lineWidth = 1.2;
            ctx.arc(0, 0, ruPx, 0, Math.PI * 2);
            ctx.stroke();

            // Etiquetas
            ctx.fillStyle = "rgba(180, 80, 60, 0.75)";
            ctx.font = "12px 'Outfit', sans-serif";
            ctx.fillText("UMBRA", 0, -ruPx + 18);

            ctx.fillStyle = "rgba(147, 197, 253, 0.75)";
            ctx.fillText("PENUMBRA", 0, -rpPx + 18);

            // 4. Trayectoria de la Luna
            if (showAxes) {
                ctx.beginPath();
                ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                const yTraj = geo.y * baseScale;
                ctx.moveTo(-rpPx * 1.35, yTraj);
                ctx.lineTo(rpPx * 1.35, yTraj);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 5. Renderizado Realista de la Luna Fotográfica
            const mx = geo.x * baseScale;
            const my = geo.y * baseScale;

            ctx.save();
            ctx.translate(mx, my);

            // Clip circular exacto de la esfera lunar
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, rmPx, 0, Math.PI * 2);
            ctx.clip();

            const preMoon = getPreRenderedMoonDisk();
            if (preMoon) {
                ctx.drawImage(preMoon, -rmPx, -rmPx, rmPx * 2, rmPx * 2);
            } else if (moonImageLoaded && moonImg.complete && moonImg.naturalWidth > 0) {
                ctx.drawImage(moonImg, 64, 32, 924, 960, -rmPx, -rmPx, rmPx * 2, rmPx * 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, rmPx, 0, Math.PI * 2);
                ctx.fillStyle = "#cbd5e1";
                ctx.fill();
            }

            // Penumbra Realista sobre la superficie lunar (Gradiente espacial de atenuación lumínica)
            const distFromShadowCenter = Math.sqrt(mx * mx + my * my);
            if (distFromShadowCenter < (rpPx + rmPx)) {
                const penMoonGrad = ctx.createRadialGradient(-mx, -my, ruPx, -mx, -my, rpPx);
                penMoonGrad.addColorStop(0, "rgba(8, 12, 22, 0.65)");     // Límite de umbra: atenuación penumbral suave
                penMoonGrad.addColorStop(0.35, "rgba(12, 18, 32, 0.42)");
                penMoonGrad.addColorStop(0.70, "rgba(15, 24, 44, 0.20)");
                penMoonGrad.addColorStop(0.95, "rgba(20, 32, 54, 0.05)");
                penMoonGrad.addColorStop(1, "rgba(20, 32, 54, 0)");        // Límite exterior penumbra

                ctx.fillStyle = penMoonGrad;
                ctx.fillRect(-rmPx, -rmPx, rmPx * 2, rmPx * 2);
            }

            // Umbra Geométrica Curva (Gradiente Rayleigh: rojo oscuro denso en el centro y más claro/translúcido en los bordes)
            ctx.save();
            ctx.beginPath();
            ctx.arc(-mx, -my, ruPx, 0, Math.PI * 2);
            
            const rayleighGrad = ctx.createRadialGradient(-mx, -my, 0, -mx, -my, ruPx);
            rayleighGrad.addColorStop(0, "rgba(38, 10, 6, 0.78)");      // Centro umbral: rojo oscuro/sangre denso
            rayleighGrad.addColorStop(0.35, "rgba(80, 24, 14, 0.65)");  // Cobrizo oscuro profundo
            rayleighGrad.addColorStop(0.65, "rgba(135, 42, 18, 0.50)"); // Terracota cálido translúcido
            rayleighGrad.addColorStop(0.88, "rgba(180, 68, 28, 0.32)"); // Tono cobrizo más claro y luminoso
            rayleighGrad.addColorStop(0.97, "rgba(215, 100, 42, 0.16)"); // Borde claro atenuado
            rayleighGrad.addColorStop(1, "rgba(220, 110, 50, 0.0)");     // Límite exacto de la umbra

            ctx.fillStyle = rayleighGrad;
            ctx.fill();

            ctx.strokeStyle = "rgba(180, 70, 30, 0.30)";
            ctx.lineWidth = 1.0;
            ctx.stroke();
            ctx.restore();

            ctx.restore(); // Fin clip luna

            // Borde iluminado de la Luna
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
            ctx.lineWidth = 1;
            ctx.arc(0, 0, rmPx, 0, Math.PI * 2);
            ctx.stroke();

            // Nombres y Puntos de Accidentes Lunares (Calibrados por el usuario en calibrate_moon.html)
            if (showFeatures) {
                ctx.save();
                const features = [
                    { name: "Tycho", x: -rmPx * 0.076, y: rmPx * 0.712, type: 'crater' },
                    { name: "Copernicus", x: -rmPx * 0.385, y: -rmPx * 0.107, type: 'crater' },
                    { name: "Kepler", x: -rmPx * 0.656, y: -rmPx * 0.065, type: 'crater' },
                    { name: "Aristarchus", x: -rmPx * 0.762, y: -rmPx * 0.313, type: 'crater' },
                    { name: "Plato", x: -rmPx * 0.211, y: -rmPx * 0.760, type: 'crater' },
                    { name: "M. Imbrium", x: -rmPx * 0.316, y: -rmPx * 0.442, type: 'mare' },
                    { name: "M. Serenitatis", x: rmPx * 0.258, y: -rmPx * 0.369, type: 'mare' },
                    { name: "M. Tranquillitatis", x: rmPx * 0.420, y: -rmPx * 0.108, type: 'mare' },
                    { name: "M. Crisium", x: rmPx * 0.773, y: -rmPx * 0.342, type: 'mare' },
                    { name: "Oceanus Procellarum", x: -rmPx * 0.841, y: -rmPx * 0.136, type: 'mare' },
                    { name: "M. Nubium", x: -rmPx * 0.226, y: rmPx * 0.322, type: 'mare' },
                    { name: "M. Nectaris", x: rmPx * 0.572, y: rmPx * 0.219, type: 'mare' }
                ];

                ctx.font = "400 10.5px 'Outfit', sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                features.forEach(f => {
                    ctx.save();
                    ctx.translate(f.x, f.y);
                    if (rotAngle !== 0) {
                        ctx.rotate(-rotAngle);
                    }

                    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 1;

                    if (f.type === 'crater') {
                        ctx.beginPath();
                        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
                        ctx.fillStyle = "#38bdf8";
                        ctx.fill();
                        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        ctx.fillStyle = "#ffffff";
                        ctx.fillText(f.name, 0, -8);
                    } else {
                        ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
                        ctx.fillText(f.name, 0, 0);
                    }
                    ctx.restore();
                });
                ctx.restore();
            }

            ctx.restore();
            ctx.restore(); // Fin rotación astronómica
            ctx.restore(); // Fin translate(cx, cy)

        }

// Exposición en ámbito global window para compatibilidad file:/// y desacoplamiento
if (typeof window !== 'undefined') {
    window.getPreRenderedMoonDisk = getPreRenderedMoonDisk;
    window.toggleTelescopeHUD = toggleTelescopeHUD;
    window.updateTelescopeHUD = updateTelescopeHUD;
    window.getEclipseFrameTilt = getEclipseFrameTilt;
    window.getMoonHorizontalCoords = getMoonHorizontalCoords;
    window.initTelescopicCanvas = initTelescopicCanvas;
    window.resizeTelescopicCanvas = resizeTelescopicCanvas;
    window.getMoonShadowCoordsAtTime = getMoonShadowCoordsAtTime;
    window.renderTelescopicView = renderTelescopicView;
}
