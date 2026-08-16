// State Management
let currentPage = 1;
const totalPages = 28;
const pageTitles = [
    "Benvinguda",
    "El Sol des de la Terra",
    "Tipus d'Estrelles",
    "Diagrama d'Estrelles",
    "Què és el Sol?",
    "Itineraris de la Fusió",
    "Massa i Mida",
    "Distància i Òrbita",
    "Temp. i Espectre",
    "Rotació del Sol",
    "Taques Solars",
    "Superfície Solar",
    "Anatomia del Sol",
    "Atmosfera del Sol",
    "Vídeo: Sun blasts",
    "Vídeo: Sun blasts 2",
    "Cicle Solar",
    "Estat Actual del Sol",
    "Balanç d'Energia",
    "Perill Ocular",
    "Observació Segura",
    "El Telescopi",
    "Com es fa un Eclipsi",
    "Tipus d'Eclipsis",
    "Eclipsi 2026",
    "Joc de Seguretat",
    "Mites i Història",
    "Comiat"
];

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
    generateSidebar();
    showPage(currentPage);
    setupNavigation();
    setupSpectroscope();
    setupDetailedSunRotation();
    setupEyeDangerSimulator();
    setupSafeObservation();
    setupOpticsDiagram("refractor");
    setupQuiz();
    setupEccentricOrbit();
    setupEclipseMechanism();
    setupSolarSurfaceFeatures();
});

// 1. Sidebar Generation & Page Navigation
function generateSidebar() {
    const navContainer = document.getElementById("sidebar-nav");
    navContainer.innerHTML = "";
    
    pageTitles.forEach((title, index) => {
        const pageNum = index + 1;
        const navItem = document.createElement("a");
        navItem.className = `nav-item ${pageNum === currentPage ? 'active' : ''}`;
        navItem.id = `nav-item-${pageNum}`;
        navItem.innerHTML = `
            <span class="nav-num">${pageNum}</span>
            <span class="nav-title">${title}</span>
        `;
        navItem.addEventListener("click", () => {
            markPageAsCompleted(currentPage);
            currentPage = pageNum;
            showPage(currentPage);
        });
        navContainer.appendChild(navItem);
    });
}

function showPage(pageIndex) {
    // Hide all screens
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });
    
    // Show target screen
    const targetScreen = document.getElementById(`screen-${pageIndex}`);
    if (targetScreen) {
        targetScreen.classList.add("active");
    }
    
    // Update active sidebar item
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });
    const currentNav = document.getElementById(`nav-item-${pageIndex}`);
    if (currentNav) {
        currentNav.classList.add("active");
        currentNav.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Update footer indicators
    document.getElementById("current-page-num").innerText = pageIndex;
    
    // Enable/disable buttons
    document.getElementById("btn-prev").disabled = (pageIndex === 1);
    
    const nextBtn = document.getElementById("btn-next");
    if (pageIndex === totalPages) {
        nextBtn.innerText = "Finalitzar";
        nextBtn.style.background = "linear-gradient(135deg, var(--accent-green), #20b87c)";
    } else {
        nextBtn.innerText = "Següent";
        nextBtn.style.background = "linear-gradient(135deg, var(--solar-orange), var(--solar-red))";
    }
}

function markPageAsCompleted(pageIndex) {
    const navItem = document.getElementById(`nav-item-${pageIndex}`);
    if (navItem) {
        navItem.classList.add("completed");
    }
}

function setupNavigation() {
    document.getElementById("btn-prev").addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            showPage(currentPage);
        }
    });
    
    document.getElementById("btn-next").addEventListener("click", () => {
        if (currentPage < totalPages) {
            markPageAsCompleted(currentPage);
            currentPage++;
            showPage(currentPage);
        } else {
            // Final slide completion feedback
            alert("Enhorabona! Has completat totes les activitats interactives del Sol. Ja ets tot un expert!");
        }
    });
}

// 2. Spectroscope Interactive Panel
function setupSpectroscope() {
    const spectrumDisplay = document.getElementById("spectrum-display");
    const buttons = document.querySelectorAll(".spectroscope-btn");
    
    // Define relative positions for elements' absorption lines (%)
    const absorptionLines = {
        h: [14, 40, 52, 68], // Hydrogen Balmer lines (roughly mapped to spectrum hues)
        he: [28, 48, 76],     // Helium lines
        metals: [8, 32, 45, 59, 82, 91] // Metal lines (Sodium, Iron, etc.)
    };

    function drawLines(element) {
        // Clear previous lines
        spectrumDisplay.innerHTML = "";
        
        let linesToDraw = [];
        if (element === "all") {
            linesToDraw = [...absorptionLines.h, ...absorptionLines.he, ...absorptionLines.metals];
        } else if (absorptionLines[element]) {
            linesToDraw = absorptionLines[element];
        }
        
        linesToDraw.forEach(pos => {
            const line = document.createElement("div");
            line.className = "absorption-line";
            line.style.left = `${pos}%`;
            spectrumDisplay.appendChild(line);
        });
    }
    
    // Draw complete spectrum lines on initial load
    drawLines("all");
    
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const element = btn.getAttribute("data-element");
            drawLines(element);
        });
    });
}

// 3. Canvas Painting Engine
function setupCanvas(canvasId, brushSliderId, clearBtnId, allowColors = true) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");
    let isDrawing = false;
    let currentColor = allowColors ? "#ffdf00" : "#000000";
    let brushSize = 6;
    
    // Set line endings to round
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Brush Color selection (Only if allowColors is active)
    if (allowColors) {
        const colorBtns = document.querySelectorAll(".color-btn");
        colorBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                colorBtns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentColor = btn.getAttribute("data-color");
            });
        });
    }
    
    // Brush Size selection
    if (brushSliderId) {
        const slider = document.getElementById(brushSliderId);
        slider.addEventListener("input", (e) => {
            brushSize = e.target.value;
        });
    } else {
        // Default size for sunspots
        brushSize = 12;
    }
    
    // Get mouse/touch coordinates relative to canvas
    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    function startDrawing(e) {
        isDrawing = true;
        ctx.beginPath();
        const coords = getCoords(e);
        ctx.moveTo(coords.x, coords.y);
        // Draw a dot right at start
        ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    }
    
    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault(); // Prevent scrolling on mobile
        const coords = getCoords(e);
        ctx.lineWidth = brushSize;
        ctx.strokeStyle = currentColor;
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    }
    
    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }
    
    // Event listeners
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);
    
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);
    
    // Clear canvas
    document.getElementById(clearBtnId).addEventListener("click", () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

// 4. Eye Danger Simulator
function setupEyeDangerSimulator() {
    const simButton = document.getElementById("simulate-direct-view");
    const pupil = document.getElementById("eye-pupil");
    const iris = document.getElementById("eye-iris");
    const spot = document.getElementById("retina-spot");
    let isSimulated = false;
    
    simButton.addEventListener("click", () => {
        if (isSimulated) {
            // Reset
            pupil.style.width = "35px";
            pupil.style.height = "35px";
            spot.style.width = "0px";
            spot.style.height = "0px";
            iris.style.background = "radial-gradient(circle, #000 30%, #52307c 40%, #2f1160 80%)";
            simButton.innerHTML = "<strong>⚠️ Simular Mirar el Sol Sense Protecció</strong><br><small>Prem per veure què passa amb la pupil·la i la retina</small>";
            isSimulated = false;
        } else {
            // Apply damage animation
            // 1. Pupil contracts immediately due to light overload
            pupil.style.width = "10px";
            pupil.style.height = "10px";
            
            // 2. Iris shifts red/irritated
            iris.style.background = "radial-gradient(circle, #000 30%, #990000 50%, #5a0000 80%)";
            
            // 3. Solar burn spot appears on the retina center
            setTimeout(() => {
                spot.style.width = "40px";
                spot.style.height = "40px";
                spot.style.background = "radial-gradient(circle, #ffffff 10%, #ff8c00 60%, transparent 100%)";
            }, 600);
            
            simButton.innerHTML = "<strong>🛑 RETINA CREMADA. Prem per reiniciar la simulació.</strong><br><small>Com veus, l'energia solar destrueix els teixits fotosensibles de l'ull.</small>";
            isSimulated = true;
        }
    });
}

// 5. Safe Observation details panel updater
function setupSafeObservation() {
    const cards = {
        "obs-white-light": {
            title: "Filtres de Llum Blanca (Mylar, AstroSolar, Vidre)",
            desc: "Aquests filtres bloquegen el 99,999% de la intensitat de la llum solar i també el 100% de la radiació ultraviolada i infraroja invisible, fent que sigui 100% segur mirar per l'ocular. El Sol es veu de color blanc neutre o groguenc molt suau, i ens permet identificar clarament les taques solars."
        },
        "obs-halpha": {
            title: "Telescopis d'H-Alfa (Hidrogen Alfa)",
            desc: "Són aparells altament sofisticats i més cars. Incorporen un filtre ultra-estret que deixa passar només la llum vermella que emeten els àtoms d'hidrogen a 656,28 nanòmetres. Permet veure la cromosfera solar: protuberàncies gegants, filaments de plasma i bucles de camps magnètics que s'eleven milers de km."
        },
        "obs-projection": {
            title: "Mètode de Projecció (Càmera Fosca o Pantalla)",
            desc: "És la tècnica més econòmica i 100% segura per a grups d'alumnes. Apuntem el telescopi cap al Sol sense mirar directament per l'òptica. Col·loquem una cartolina o full blanc a uns centímetres de l'ocular. La imatge s'hi projecta a sobre com en un cinema, permetent que moltes persones vegin les taques a la vegada."
        }
    };
    
    const detailPanel = document.getElementById("obs-detail-panel");
    
    Object.keys(cards).forEach(cardId => {
        const cardElement = document.getElementById(cardId);
        cardElement.addEventListener("click", () => {
            // Remove selection on others
            document.querySelectorAll(".obs-card").forEach(c => c.style.borderColor = "var(--border-color)");
            cardElement.style.borderColor = "var(--solar-orange)";
            
            // Update panel text
            const info = cards[cardId];
            detailPanel.innerHTML = `
                <h3 style="color: var(--solar-orange); font-size:1.2rem; margin-bottom: 0.5rem;">${info.title}</h3>
                <p style="margin: 0; font-size: 0.95rem; line-height: 1.6;">${info.desc}</p>
            `;
            detailPanel.style.borderColor = "var(--border-color-active)";
            detailPanel.style.background = "rgba(255, 106, 0, 0.05)";
        });
    });
}

// 6. Telescope Optics Diagram SVG Renderer
function setupOpticsDiagram(type) {
    const svg = document.getElementById("optics-svg");
    const description = document.getElementById("optics-description");
    
    // Buttons togglers
    const tabRefractor = document.getElementById("tab-refractor");
    const tabReflector = document.getElementById("tab-reflector");
    
    tabRefractor.addEventListener("click", () => {
        tabReflector.classList.remove("active");
        tabRefractor.classList.add("active");
        renderRefractor();
    });
    
    tabReflector.addEventListener("click", () => {
        tabRefractor.classList.remove("active");
        tabReflector.classList.add("active");
        renderReflector();
    });

    function renderRefractor() {
        description.innerHTML = `
            <h3>El telescopi Refractor (Sistema Galileo/Kepler)</h3>
            <p style="margin: 0;">La llum solar o estel·lar és captada per una lent de vidre convexa frontal (l'objectiu). Aquesta doblega els raigs cap endins (refracció) fins a creuar-se en el punt focal. Finalment, l'ocular (una altra lent més petita) rectifica i amplia els raigs per al nostre ull.</p>
        `;
        svg.innerHTML = `
            <!-- Objectius (Lents) -->
            <path d="M150,50 Q160,100 150,150 Q140,100 150,50 Z" fill="rgba(0, 210, 255, 0.2)" stroke="#00d2ff" stroke-width="2"/>
            <text x="150" y="40" fill="#00d2ff" font-family="Outfit" font-size="10" text-anchor="middle">LENT OBJECTIU</text>
            
            <!-- Ocular -->
            <path d="M600,85 Q605,100 600,115 Q595,100 600,85 Z" fill="rgba(0, 210, 255, 0.2)" stroke="#00d2ff" stroke-width="2"/>
            <text x="600" y="75" fill="#00d2ff" font-family="Outfit" font-size="10" text-anchor="middle">OCULAR</text>

            <!-- Light rays -->
            <!-- Ray 1 (Upper incoming, crosses to lower after focal point) -->
            <path d="M40,65 L150,65 L400,100 L600,115 L680,115" stroke="#ffea4a" stroke-width="1.5" fill="none"/>
            <!-- Ray 2 (Center line) -->
            <path d="M40,100 L150,100 L400,100 L600,100 L680,100" stroke="#ffea4a" stroke-width="1.5" stroke-dasharray="2 2" fill="none"/>
            <!-- Ray 3 (Lower incoming, crosses to upper after focal point) -->
            <path d="M40,135 L150,135 L400,100 L600,85 L680,85" stroke="#ffea4a" stroke-width="1.5" fill="none"/>
            
            <!-- Focal Point marker -->
            <circle cx="400" cy="100" r="3" fill="#ff3300"/>
            <text x="400" y="120" fill="#ff3300" font-family="Outfit" font-size="10" text-anchor="middle">PUNT FOCAL</text>
            
            <!-- Telescope barrel outline -->
            <path d="M140,40 L590,75 L590,125 L140,160 Z" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" fill="none"/>
        `;
    }

    function renderReflector() {
        description.innerHTML = `
            <h3>El telescopi Reflector (Sistema Newtonià)</h3>
            <p style="margin: 0;">La llum entra pel tub obert fins al fons, on colpeja un mirall gran còncau (el mirall primari). Aquest reflecteix la llum cap enrere enfocant-la cap a un mirall diagonal petit pla (mirall secundari) que envia la llum cap amunt (lateralment) cap a l'ocular.</p>
        `;
        svg.innerHTML = `
            <!-- Primary Mirror (Concave) at the back (right) -->
            <path d="M600,50 Q585,100 600,150 L610,150 L610,50 Z" fill="rgba(157, 78, 221, 0.2)" stroke="#9d4edd" stroke-width="2"/>
            <text x="600" y="40" fill="#9d4edd" font-family="Outfit" font-size="10" text-anchor="middle">MIRALL PRIMARI</text>
            
            <!-- Secondary Mirror (Diagonal flat) -->
            <line x1="280" y1="85" x2="310" y2="115" stroke="#00d2ff" stroke-width="4" stroke-linecap="round"/>
            <text x="295" y="75" fill="#00d2ff" font-family="Outfit" font-size="10" text-anchor="middle">MIRALL SECUNDARI</text>
            
            <!-- Eyepiece ocular at the top -->
            <path d="M285,15 Q300,10 315,15 L315,22 L285,22 Z" fill="rgba(0, 210, 255, 0.2)" stroke="#00d2ff" stroke-width="2"/>
            <text x="300" y="32" fill="#00d2ff" font-family="Outfit" font-size="9" text-anchor="middle">OCULAR</text>

            <!-- Light rays paths -->
            <!-- Light coming in -->
            <path d="M120,60 L590,60 L295,100 L295,18" stroke="#ffea4a" stroke-width="1.5" fill="none"/>
            <path d="M120,140 L590,140 L295,100 L295,18" stroke="#ffea4a" stroke-width="1.5" fill="none"/>
            
            <!-- Telescope tube -->
            <path d="M120,40 L120,80 M120,120 L120,160 L585,160 L585,40 L120,40" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" fill="none"/>
            <path d="M280,40 L280,25 L320,25 L320,40" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" fill="none"/>
        `;
    }
    
    // Draw initial view
    if (type === "refractor") renderRefractor();
    else renderReflector();
}

// 7. Security Quiz Game
function setupQuiz() {
    const quizQuestions = [
        {
            question: "Podem utilitzar un cd, radiografies antigues o vidres fumats com a filtre solar?",
            options: [
                "Sí, si en superposem dos o tres.",
                "No, bloquegen part de la llum visible però deixen passar la radiació infraroja i cremen la retina igualment."
            ],
            correctIndex: 1,
            feedback: "Molt bé! Aquests mètodes casolans són altament perillosos. Tot i que ens sembli que no molesta la llum, la radiació infraroja invisible (calor) traspassa i destrueix la retina."
        },
        {
            question: "Està permès mirar pel visor d'una càmera reflex que enfoca directament el Sol?",
            options: [
                "Sí, el visor no fa efecte lupa.",
                "No, és extremadament perillós ja que el sistema òptic concentra els rajos directament sobre la teva pupil·la."
            ],
            correctIndex: 1,
            feedback: "Exacte! Mai es pot mirar directament a través de cap dispositiu òptic (càmera, telescopi, binoculars) que estigui apuntant al Sol sense un filtre frontal professional."
        },
        {
            question: "Com s'han d'utilitzar les ulleres especials de cartró homologades per a eclipsis?",
            options: [
                "Mirar de forma continuada durant tot l'eclipsi sense límit de temps.",
                "Mirar en períodes de màxim 30 segons seguits, descansar la vista, i mai fer-les servir si tenen alguna ratllada o plec."
            ],
            correctIndex: 1,
            feedback: "Correcte! Tot i estar certificades, és prudent no fixar la vista més de 30-40 segons. I davant de qualsevol desgast o petit forat a la làmina protectora, cal rebutjar-les!"
        }
    ];

    let currentQuestionIndex = 0;
    const questionText = document.getElementById("quiz-question-text");
    const optionsContainer = document.getElementById("quiz-options-container");
    const feedbackText = document.getElementById("quiz-feedback-text");

    function renderQuestion() {
        feedbackText.innerHTML = "";
        const q = quizQuestions[currentQuestionIndex];
        questionText.innerText = `${currentQuestionIndex + 1}. ${q.question}`;
        optionsContainer.innerHTML = "";
        
        q.options.forEach((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "quiz-option";
            btn.innerText = opt;
            btn.addEventListener("click", () => handleAnswer(idx, btn));
            optionsContainer.appendChild(btn);
        });
    }

    function handleAnswer(selectedIdx, btnElement) {
        const q = quizQuestions[currentQuestionIndex];
        const allButtons = optionsContainer.querySelectorAll(".quiz-option");
        
        // Disable further clicks
        allButtons.forEach(btn => btn.disabled = true);
        
        if (selectedIdx === q.correctIndex) {
            btnElement.classList.add("correct");
            feedbackText.innerHTML = `<span style="color: var(--accent-green); font-weight:600;">Correcte!</span> ${q.feedback}`;
        } else {
            btnElement.classList.add("incorrect");
            feedbackText.innerHTML = `<span style="color: var(--solar-red); font-weight:600;">Incorrecte.</span> ${q.feedback}`;
        }
        
        // Wait a few seconds and advance, or loop
        setTimeout(() => {
            currentQuestionIndex = (currentQuestionIndex + 1) % quizQuestions.length;
            renderQuestion();
        }, 5000);
    }
    
    // Initial Render
    renderQuestion();
}

// 8. Eccentric Orbit Simulation (Page 4)
function setupEccentricOrbit() {
    const earthGroup = document.getElementById("orbit-earth-group");
    if (!earthGroup) return;
    
    const cx = 400;
    const cy = 225;
    const rx = 300; // Semi-major axis (horizontal)
    const ry = 160; // Semi-minor axis (vertical)
    let angle = 0;
    const speed = 0.005; // Orbit speed (slightly slower for larger radius readability)
    
    // Sunspots elements and their initial parameters
    const sunspots = [
        { id: "spot-eq-1", dy: 0, phi: 0.5, speed: 0.015, r: 40 },       // Equator spot 1 (faster: ~25 days)
        { id: "spot-eq-2", dy: -3, phi: 3.5, speed: 0.015, r: 40 },      // Equator spot 2 (faster: ~25 days)
        { id: "spot-north-1", dy: -20, phi: 1.2, speed: 0.010, r: 40 },  // Northern latitude spot (slower: ~33 days)
        { id: "spot-south-1", dy: 17, phi: 4.8, speed: 0.010, r: 40 }    // Southern latitude spot (slower: ~33 days)
    ];
    
    function animate() {
        // 1. Earth Orbit Position (Counter-clockwise)
        const x = cx + rx * Math.cos(angle);
        const y = cy - ry * Math.sin(angle);
        earthGroup.setAttribute("transform", `translate(${x}, ${y})`);
        
        angle += speed;
        if (angle >= Math.PI * 2) {
            angle = 0;
        }
        
        // 2. Differential Sunspots Rotation (Right-to-Left on front face)
        sunspots.forEach(spot => {
            const el = document.getElementById(spot.id);
            if (el) {
                // Local radius of the parallel circle at this latitude
                const rLat = Math.sqrt(spot.r * spot.r - spot.dy * spot.dy);
                
                // Horizontal position relative to Sun center (280)
                const spotX = 280 + rLat * Math.cos(spot.phi);
                el.setAttribute("cx", spotX);
                
                // Visible on the front face of the Sun (where sin > 0)
                if (Math.sin(spot.phi) > 0) {
                    el.setAttribute("display", "block");
                } else {
                    el.setAttribute("display", "none");
                }
                
                // Increment phase
                spot.phi += spot.speed;
                if (spot.phi >= Math.PI * 2) {
                    spot.phi -= Math.PI * 2;
                }
            }
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// 9. Detailed Sun Rotation Simulator (Page 6)
function setupDetailedSunRotation() {
    const canvas = document.getElementById("detailed-sun-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const speedSlider = document.getElementById("sun-speed-slider");
    
    const cx = 220;
    const cy = 220;
    const rSun = 150;
    
    // We'll define a set of detailed sunspots
    // The speeds correspond to physical rotations: 
    // Equator: 25 days -> base speed 0.015 rad/frame
    // 30 degrees latitude: 28 days -> base speed 0.0134 rad/frame
    // 60 degrees latitude: 35 days -> base speed 0.0107 rad/frame
    // Define detailed active regions (clusters of large and small sunspots)
    // Equator: 25 days -> base speed 0.015 rad/frame
    // 30° latitude: 28 days -> base speed 0.0134 rad/frame
    // 60° latitude: 35 days -> base speed 0.0107 rad/frame
    const activeRegions = [
        // Equatorial Zone (0°) - Fast
        {
            baseSpeed: 0.015,
            phi: 0.2,
            subSpots: [
                { dy: 0, phiOffset: 0, size: 4.8 },       // Main leader spot
                { dy: 6, phiOffset: 0.07, size: 2.2 },     // Follower spot
                { dy: -4, phiOffset: -0.06, size: 1.8 },   // Small pore
                { dy: -8, phiOffset: 0.04, size: 0.9 },    // Satellite
                { dy: 3, phiOffset: 0.12, size: 0.7 }      // Satellite
            ]
        },
        {
            baseSpeed: 0.015,
            phi: 3.2,
            subSpots: [
                { dy: -6, phiOffset: 0, size: 4.0 },       // Main spot
                { dy: -10, phiOffset: 0.06, size: 1.5 },   // Secondary
                { dy: -2, phiOffset: -0.05, size: 1.9 },   // Secondary
                { dy: -5, phiOffset: 0.11, size: 0.8 }     // Pore
            ]
        },
        
        // Mid Latitudes (30° / -30°) - Medium
        {
            baseSpeed: 0.0134,
            phi: 1.5,
            subSpots: [
                { dy: -60, phiOffset: 0, size: 5.2 },      // Huge principal spot
                { dy: -54, phiOffset: 0.05, size: 2.5 },   // Companion
                { dy: -66, phiOffset: -0.05, size: 1.7 },  // Companion
                { dy: -58, phiOffset: 0.10, size: 1.1 },   // Tiny companion
                { dy: -62, phiOffset: -0.11, size: 0.8 }   // Tiny companion
            ]
        },
        {
            baseSpeed: 0.0134,
            phi: 4.5,
            subSpots: [
                { dy: 65, phiOffset: 0, size: 3.8 },
                { dy: 60, phiOffset: 0.07, size: 1.8 },
                { dy: 69, phiOffset: -0.06, size: 1.3 },
                { dy: 63, phiOffset: 0.12, size: 0.7 }
            ]
        },
        
        // Polar Zones (60° / -60°) - Slow
        {
            baseSpeed: 0.0107,
            phi: 2.5,
            subSpots: [
                { dy: -115, phiOffset: 0, size: 3.2 },
                { dy: -111, phiOffset: 0.07, size: 1.4 },
                { dy: -118, phiOffset: -0.06, size: 1.0 }
            ]
        },
        {
            baseSpeed: 0.0107,
            phi: 5.8,
            subSpots: [
                { dy: 110, phiOffset: 0, size: 3.5 },
                { dy: 114, phiOffset: 0.05, size: 1.6 },
                { dy: 106, phiOffset: -0.08, size: 1.1 }
            ]
        }
    ];
    
    let simSpeed = parseFloat(speedSlider ? speedSlider.value : 4) / 4;
    if (speedSlider) {
        speedSlider.addEventListener("input", (e) => {
            simSpeed = parseFloat(e.target.value) / 4;
        });
    }
    
    // Prominences / Flares surrounding the Sun's rim
    const prominences = [];
    for (let i = 0; i < 8; i++) {
        prominences.push({
            angle: (i * Math.PI / 4) + Math.random() * 0.3,
            size: 5 + Math.random() * 10,
            pulseOffset: Math.random() * 10
        });
    }

    let time = 0;
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        time += 0.03 * simSpeed;
        
        // 1. Draw Solar Prominences / Flares (plasma flares stretching off the rim)
        ctx.save();
        prominences.forEach(prom => {
            const currentSize = prom.size + Math.sin(time + prom.pulseOffset) * 4;
            const x1 = cx + rSun * Math.cos(prom.angle);
            const y1 = cy + rSun * Math.sin(prom.angle);
            
            const ctrlAngle1 = prom.angle - 0.15;
            const ctrlAngle2 = prom.angle + 0.15;
            const xCtrl1 = cx + (rSun + currentSize) * Math.cos(ctrlAngle1);
            const yCtrl1 = cy + (rSun + currentSize) * Math.sin(ctrlAngle1);
            const xCtrl2 = cx + (rSun + currentSize) * Math.cos(ctrlAngle2);
            const yCtrl2 = cy + (rSun + currentSize) * Math.sin(ctrlAngle2);
            
            const x2 = cx + rSun * Math.cos(prom.angle + 0.1);
            const y2 = cy + rSun * Math.sin(prom.angle + 0.1);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(xCtrl1, yCtrl1, xCtrl2, yCtrl2, x2, y2);
            ctx.fillStyle = "rgba(255, 51, 0, 0.7)";
            ctx.fill();
        });
        ctx.restore();
        
        // 2. Draw Sun Sphere (Photosphere with limb darkening)
        const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rSun);
        sunGrad.addColorStop(0, "#fffa9e");      // Bright central photosphere
        sunGrad.addColorStop(0.3, "#ffdf00");    // Solar yellow
        sunGrad.addColorStop(0.7, "#ff6a00");    // Orange
        sunGrad.addColorStop(0.9, "#ff3300");    // Red limb
        sunGrad.addColorStop(1, "#8a0000");      // Deep red boundary (Limb Darkening)
        
        ctx.beginPath();
        ctx.arc(cx, cy, rSun, 0, Math.PI * 2);
        ctx.fillStyle = sunGrad;
        ctx.shadowColor = "#ff6a00";
        ctx.shadowBlur = 30;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow
        
        // 3. Draw Latitude Grid Lines (dashed helper indicators)
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        // Draw equator line
        ctx.beginPath();
        ctx.moveTo(cx - rSun, cy);
        ctx.lineTo(cx + rSun, cy);
        ctx.stroke();
        
        // Mid Latitudes
        [-60, 60, -115, 110].forEach(dy => {
            const w = Math.sqrt(rSun*rSun - dy*dy);
            ctx.beginPath();
            ctx.moveTo(cx - w, cy + dy);
            ctx.lineTo(cx + w, cy + dy);
            ctx.stroke();
        });
        ctx.setLineDash([]); // Reset line dash
        
        // 4. Draw detailed 3D rotating Sunspots (Clustered Active Regions)
        activeRegions.forEach(region => {
            region.subSpots.forEach(subSpot => {
                const spotPhi = region.phi + subSpot.phiOffset;
                
                // Calculate parallel radius at this latitude
                const rLat = Math.sqrt(rSun * rSun - subSpot.dy * subSpot.dy);
                
                // X-coord relative to center, rotating right-to-left
                const spotX = cx + rLat * Math.cos(spotPhi);
                const spotY = cy + subSpot.dy;
                
                // Visible only on the front hemisphere (where sin > 0)
                if (Math.sin(spotPhi) > 0) {
                    const zFactor = Math.sin(spotPhi); // Foreshortening perspective at limbs
                    
                    // Draw Penumbra (lighter brown border, squashed near edge)
                    ctx.beginPath();
                    ctx.ellipse(spotX, spotY, subSpot.size * 2.5 * zFactor, subSpot.size * 2.5, 0, 0, Math.PI * 2);
                    ctx.fillStyle = "rgba(95, 30, 0, 0.45)"; // Rich sunspot penumbra brown
                    ctx.fill();
                    
                    // Draw Umbra (irregular pitch black core)
                    ctx.beginPath();
                    ctx.ellipse(spotX, spotY, subSpot.size * zFactor, subSpot.size, 0, 0, Math.PI * 2);
                    ctx.fillStyle = "#000000";
                    ctx.fill();
                    
                    // Draw magnetic loops (thin glowing lines near spots)
                    ctx.strokeStyle = `rgba(255, 106, 0, ${0.25 * zFactor})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(spotX, spotY - subSpot.size, subSpot.size * 1.5, Math.PI, 0);
                    ctx.stroke();
                }
            });
            
            // Update region phase with differential speeds
            region.phi += region.baseSpeed * simSpeed;
            if (region.phi >= Math.PI * 2) {
                region.phi -= Math.PI * 2;
            }
        });
        
        // 5. Draw overlay text directly on canvas showing speeds next to latitudes
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "bold 10px Outfit";
        ctx.fillText("Pol N (60°): 35 dies", cx + 70, cy - 122);
        ctx.fillText("30°N: 28 dies", cx + 110, cy - 65);
        ctx.fillText("Equador: 25 dies", cx + 115, cy + 4);
        ctx.fillText("30°S: 28 dies", cx + 110, cy + 55);
        ctx.fillText("Pol S (60°): 35 dies", cx + 70, cy + 125);
        
        requestAnimationFrame(draw);
    }
    
    draw();
}

// 10. Eclipse Mechanism Simulation (Page 12)
function setupEclipseMechanism() {
    const svg = document.getElementById("eclipse-mechanism-svg");
    if (!svg) return;
    
    // Left view elements
    const generalEarthGroup = document.getElementById("mech-general-earth-group");
    const generalMoonGroup = document.getElementById("mech-general-moon-group");
    const generalMoonOrbitGroup = document.getElementById("mech-general-moon-orbit-group");
    
    // Right view elements
    const detailOrbitLine = document.getElementById("mech-detail-orbit-line");
    const detailMoonGroup = document.getElementById("mech-detail-moon-group");
    const detailEarth = document.getElementById("mech-detail-earth");
    const detailEarthEclipseShadow = document.getElementById("mech-detail-earth-eclipse-shadow");
    const infoPanel = document.getElementById("eclipse-mech-info");
    
    const tiltSlider = document.getElementById("moon-tilt-slider");
    const tiltLabel = document.getElementById("lbl-moon-tilt");
    const btnPreset0 = document.getElementById("btn-tilt-preset-0");
    const btnPreset5 = document.getElementById("btn-tilt-preset-5");
    const btnPreset15 = document.getElementById("btn-tilt-preset-15");
    
    let currentTilt = 5.0; // default to 5 degrees
    let angleGeneral = 0; // Earth around Sun angle
    let angleMoon = 0; // Moon around Earth angle
    
    function updateTilt(val) {
        currentTilt = parseFloat(val);
        if (tiltSlider) tiltSlider.value = currentTilt;
        if (tiltLabel) tiltLabel.innerText = currentTilt.toFixed(1);
        
        // Update SVG orbit line visual representation
        if (detailOrbitLine) {
            // Exaggerate rotation slightly on screen for better UX (x3)
            detailOrbitLine.setAttribute("transform", `rotate(${-currentTilt * 3}, 720, 200)`);
            const ryVal = 3 + (currentTilt * 1.8);
            detailOrbitLine.setAttribute("ry", ryVal);
        }
        
        // Highlight active preset button
        [btnPreset0, btnPreset5, btnPreset15].forEach(btn => {
            if (btn) btn.classList.remove("active");
        });
        if (currentTilt === 0 && btnPreset0) btnPreset0.classList.add("active");
        else if (Math.abs(currentTilt - 5.0) < 0.1 && btnPreset5) btnPreset5.classList.add("active");
        else if (Math.abs(currentTilt - 15.0) < 0.1 && btnPreset15) btnPreset15.classList.add("active");
    }
    
    // Wire up slider
    if (tiltSlider) {
        tiltSlider.addEventListener("input", (e) => {
            updateTilt(e.target.value);
        });
    }
    
    // Wire up presets
    if (btnPreset0) btnPreset0.addEventListener("click", () => updateTilt(0));
    if (btnPreset5) btnPreset5.addEventListener("click", () => updateTilt(5.0));
    if (btnPreset15) btnPreset15.addEventListener("click", () => updateTilt(15.0));
    
    // Initialize
    updateTilt(5.0);
    
    function animate() {
        // Only run animation when screen-21 is active
        const screen21 = document.getElementById("screen-21");
        if (screen21 && !screen21.classList.contains("active")) {
            requestAnimationFrame(animate);
            return;
        }
        
        // ================== ANIMATION SPEEDS ==================
        angleGeneral += 0.004;
        if (angleGeneral >= Math.PI * 2) angleGeneral = 0;
        
        angleMoon += 0.03;
        if (angleMoon >= Math.PI * 2) angleMoon = 0;
        
        // ================== LEFT PANEL (Heliocentric) ==================
        if (generalEarthGroup && generalMoonGroup && generalMoonOrbitGroup) {
            const ex = 240 + 160 * Math.cos(angleGeneral);
            const ey = 200 - 90 * Math.sin(angleGeneral); // Negative Y for counter-clockwise
            
            const rotAngleRad = Math.atan2(-90 * Math.sin(angleGeneral), 160 * Math.cos(angleGeneral)); // Inverted Y vector angle
            const rotAngleDeg = rotAngleRad * 180 / Math.PI;
            
            generalEarthGroup.setAttribute("transform", `translate(${ex}, ${ey}) rotate(${rotAngleDeg})`);
            
            // The tilt angle of the Moon's orbit (exaggerated by 3x for visibility)
            const tiltAngle = -currentTilt * 3;
            // To keep the orbital plane orientation fixed in space, subtract the Earth's orbit rotation angle
            const orbitGroupRot = tiltAngle - rotAngleDeg;
            generalMoonOrbitGroup.setAttribute("transform", `rotate(${orbitGroupRot})`);
            
            const mrx = 22;
            const mry = 8;
            const mx_local = mrx * Math.cos(angleMoon);
            const my_local = -mry * Math.sin(angleMoon); // Negative Y for counter-clockwise
            
            // Rotate the Moon group inside the orbit group to keep its shadow pointing directly away from the Sun (cancel orbitGroupRot)
            generalMoonGroup.setAttribute("transform", `translate(${mx_local}, ${my_local}) rotate(${-orbitGroupRot})`);
        }
        
        // ================== RIGHT PANEL (Side-on View) ==================
        if (detailMoonGroup && detailEarth && detailEarthEclipseShadow) {
            const rx = 140;
            // The orbital plane tilt is represented by theta
            // We rotate the orbit plane by -currentTilt * 3 degrees (exaggerated for screen visualization)
            const theta = (-currentTilt * 3) * Math.PI / 180;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            
            // dx starts at negative (New Moon / in front of Earth) and moves from left to right as angle increases
            const dx = -rx * Math.cos(angleMoon);
            const dy = 12 * Math.sin(angleMoon); // 12 keeps the ellipse shape
            
            const rotatedX = dx * cosT - dy * sinT;
            const rotatedY = dx * sinT + dy * cosT;
            
            const mx = 720 + rotatedX;
            const my = 200 + rotatedY;
            
            detailMoonGroup.setAttribute("transform", `translate(${mx}, ${my})`);
            
            // Z-ordering: Move Moon group to front/back of Earth
            // Since it is counter-clockwise, as angle goes from 0 to PI, it passes in the foreground
            const isForeground = Math.sin(angleMoon) > 0;
            const parent = detailMoonGroup.parentNode;
            if (isForeground) {
                parent.appendChild(detailMoonGroup);
            } else {
                parent.insertBefore(detailMoonGroup, detailEarth);
            }
            
            // Shadow cones visibility
            const umbra = document.getElementById("mech-detail-moon-umbra");
            const penumbra = document.getElementById("mech-detail-moon-penumbra");
            
            const dx_rel = rotatedX;
            if (dx_rel < 0) {
                umbra.setAttribute("display", "block");
                penumbra.setAttribute("display", "block");
                
                // Does the shadow hit the Earth?
                // Earth is at Y = 200, radius 26. So bounds are [174, 226].
                if (my >= 174 && my <= 226) {
                    // It hits! Determine if it's total (very close to center) or partial
                    const isTotal = Math.abs(my - 200) < 6;
                    
                    if (isTotal) {
                        detailEarthEclipseShadow.setAttribute("opacity", "0.95");
                        detailEarthEclipseShadow.setAttribute("cy", my);
                        if (infoPanel) infoPanel.innerHTML = `<p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--solar-yellow);">🌞🕶️ <strong>ECLIPSI TOTAL DE SOL!</strong> L'òrbita de la Lluna està alineada (inclinació ${currentTilt.toFixed(1)}°). L'ombra de la Lluna es projecta directament sobre la Terra.</p>`;
                    } else {
                        detailEarthEclipseShadow.setAttribute("opacity", "0.5");
                        detailEarthEclipseShadow.setAttribute("cy", my);
                        if (infoPanel) infoPanel.innerHTML = `<p style="margin: 0; font-size: 0.95rem; font-weight: 500; color: var(--solar-orange);">⚠️ <strong>Eclipsi Parcial!</strong> Amb una inclinació orbital baixa (${currentTilt.toFixed(1)}°), només part de l'ombra frega la Terra.</p>`;
                    }
                } else {
                    detailEarthEclipseShadow.setAttribute("opacity", "0");
                    if (infoPanel) infoPanel.innerHTML = `<p style="margin: 0; font-size: 0.95rem; font-weight: 500;">La Lluna passa <strong>per damunt o per davall</strong> de la Terra (inclinació: ${currentTilt.toFixed(1)}°). L'ombra es projecta a l'espai buit. <strong style="color:var(--text-secondary);">No hi ha eclipsi</strong>.</p>`;
                }
            } else {
                umbra.setAttribute("display", "none");
                penumbra.setAttribute("display", "none");
                detailEarthEclipseShadow.setAttribute("opacity", "0");
                if (infoPanel) infoPanel.innerHTML = `<p style="margin: 0; font-size: 0.95rem; font-weight: 500;">Lluna Plena (darrere la Terra). L'ombra es projecta en sentit oposat a la Terra.</p>`;
            }
        }
        
        requestAnimationFrame(animate);
    }
    
    animate();
}

// 11. Solar Surface Features Interactive Panel
function setupSolarSurfaceFeatures() {
    const details = {
        "feat-protuberancies": {
            desc: "Les **protuberàncies solars** són enormes estructures de gas relativament fred i dens aixecades des de la fotosfera fins a la calenta corona solar. Segueixen les línies invisibles del camp magnètic formant bucles gegantins. Es poden observar clarament a la vora del Sol amb telescopis d'H-Alfa.",
            highlight: "prominence"
        },
        "feat-facules": {
            desc: "Les **fàcules** o **màcules** són regions brillants i molt calentes que s'observen a la fotosfera, generalment a prop de les taques solars. Són causades per concentracions de línies de camp magnètic que fan que el gas sigui més brillant, compensant la pèrdua d'energia de les taques.",
            highlight: "faculae"
        },
        "feat-fulgures": {
            desc: "Les **fúlgures** o **flamarades** són alliberaments sobtats i violents d'energia a la corona solar. Són les tempestes magnètiques més violentes del Sistema Solar i poden enviar ràfegues de radiació (raigs X, UV) i partícules carregades cap a la Terra en pocs minuts, afectant les nostres telecomunicacions.",
            highlight: "flare"
        },
        "feat-granuls": {
            desc: "Els **grànuls** són la part superior de columnes de convecció tèrmica que pugen des de l'interior solar (com bombolles en aigua bullent). Cada grànul fa uns 1.000 km d'amplada i dura uns 10 minuts. Les **espícules** són raigs verticals ràpids de gas calent que s'eleven a la cromosfera.",
            highlight: "granules"
        }
    };

    const detailText = document.getElementById("solar-surface-detail-text");
    const prominenceLoop = document.getElementById("svg-prominence-loop");
    const flareBlast = document.getElementById("svg-flare-blast");

    if (!detailText) return;

    Object.keys(details).forEach(id => {
        const card = document.getElementById(id);
        if (!card) return;

        card.addEventListener("click", () => {
            // Remove border highlighting from all cards
            document.querySelectorAll("#screen-8 .obs-card").forEach(c => {
                c.style.borderColor = "rgba(255,255,255,0.05)";
                c.style.background = "rgba(255,255,255,0.02)";
            });

            // Add correct border highlighting according to its color category
            let color = "var(--solar-orange)";
            if (id === "feat-protuberancies") color = "var(--solar-red)";
            if (id === "feat-facules") color = "var(--solar-yellow)";
            if (id === "feat-fulgures") color = "var(--solar-orange)";
            if (id === "feat-granuls") color = "var(--accent-green)";
            
            card.style.borderColor = color;
            card.style.background = "rgba(255, 255, 255, 0.05)";

            // Update text with description
            detailText.innerHTML = details[id].desc.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // Reset SVG animations/highlights
            if (prominenceLoop) {
                prominenceLoop.setAttribute("stroke-width", "8");
                prominenceLoop.style.opacity = "0.4";
            }
            if (flareBlast) {
                flareBlast.style.opacity = "0.2";
            }

            // Apply specific highlights to SVG
            const highlight = details[id].highlight;
            if (highlight === "prominence" && prominenceLoop) {
                prominenceLoop.setAttribute("stroke-width", "16");
                prominenceLoop.style.opacity = "1";
            } else if (highlight === "flare" && flareBlast) {
                flareBlast.style.opacity = "0.9";
            }
        });
    });
}

