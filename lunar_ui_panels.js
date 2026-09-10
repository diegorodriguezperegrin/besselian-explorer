/* =========================================================================
   COSMOS MATARÓ - GESTIÓN DE PANELES Y DOCK UI (lunar_ui_panels.js)
   Paneles flotantes arrastrables, z-index dinámico, botones de cabecera,
   dock de controles y exportación de eventos a iCalendar (.ics).
   ========================================================================= */

function _getDOM(id) {
    return (typeof getDOM === 'function') ? getDOM(id) : document.getElementById(id);
}

        function updateTopNavButtonsState() {
            const sidePanel = document.getElementById('sidebar-panel');
            const setPanel = document.getElementById('settings-panel');
            const dockPanel = document.getElementById('playback-dock');
            const navBar = document.getElementById('top-nav-bar');

            const sideOpen = sidePanel && !sidePanel.classList.contains('collapsed');
            const setOpen = setPanel && !setPanel.classList.contains('collapsed');
            const dockOpen = dockPanel && !dockPanel.classList.contains('collapsed');

            const btnSide = document.getElementById('btn-reopen-left');
            const btnSet = document.getElementById('btn-reopen-right');
            const btnDock = document.getElementById('btn-reopen-dock');

            if (btnSide) { btnSide.style.display = sideOpen ? 'none' : 'inline-flex'; btnSide.classList.remove('active-nav'); }
            if (btnSet) { btnSet.style.display = setOpen ? 'none' : 'inline-flex'; btnSet.classList.remove('active-nav'); }
            if (btnDock) { btnDock.style.display = dockOpen ? 'none' : 'inline-flex'; btnDock.classList.remove('active-nav'); }

            const isSmall = window.innerWidth <= 900;

            if (navBar) {
                navBar.style.left = '15px';
                if (sideOpen && sidePanel) {
                    const sideBottom = sidePanel.offsetTop + sidePanel.offsetHeight;
                    navBar.style.top = `${sideBottom + 8}px`;
                    if (btnSide) {
                        btnSide.style.position = '';
                        btnSide.style.top = '';
                        btnSide.style.left = '';
                        btnSide.style.zIndex = '';
                    }
                } else if (isSmall && setOpen && setPanel) {
                    if (btnSide) {
                        btnSide.style.position = 'fixed';
                        btnSide.style.top = '15px';
                        btnSide.style.left = '15px';
                        btnSide.style.zIndex = '45';
                    }
                    const setBottom = setPanel.offsetTop + setPanel.offsetHeight;
                    navBar.style.top = `${setBottom + 8}px`;
                } else {
                    if (btnSide) {
                        btnSide.style.position = '';
                        btnSide.style.top = '';
                        btnSide.style.left = '';
                        btnSide.style.zIndex = '';
                    }
                    navBar.style.top = '15px';
                }
            }
        }

        function toggleSidebar(show = null) {
            const panel = document.getElementById('sidebar-panel');
            if (!panel) return;
            const isCurrentlyOpen = !panel.classList.contains('collapsed');
            const targetState = (show !== null) ? show : !isCurrentlyOpen;
            const isMobile = window.innerWidth <= 900;

            if (targetState) {
                resetPanelDefaultPosition('sidebar-panel');
                panel.classList.remove('collapsed');
                if (isMobile) {
                    toggleSettingsPanel(false);
                    togglePlaybackDock(false);
                }
            } else {
                panel.classList.add('collapsed');
                resetPanelDefaultPosition('sidebar-panel');
            }
            updateTopNavButtonsState();
        }

        function toggleSettingsPanel(show = null) {
            const panel = document.getElementById('settings-panel');
            const badge = document.getElementById('live-indicator-badge');
            if (!panel) return;
            const isCurrentlyOpen = !panel.classList.contains('collapsed');
            const targetState = (show !== null) ? show : !isCurrentlyOpen;
            const isMobile = window.innerWidth <= 900;

            if (targetState) {
                resetPanelDefaultPosition('settings-panel');
                panel.classList.remove('collapsed');
                if (badge) badge.classList.remove('panel-collapsed');
                if (isMobile) {
                    toggleSidebar(false);
                }
            } else {
                panel.classList.add('collapsed');
                if (badge) badge.classList.add('panel-collapsed');
                resetPanelDefaultPosition('settings-panel');
            }
            updateTopNavButtonsState();
        }

        function togglePlaybackDock(show = null) {
            const panel = document.getElementById('playback-dock');
            if (!panel) return;
            const isCurrentlyOpen = !panel.classList.contains('collapsed');
            const targetState = (show !== null) ? show : !isCurrentlyOpen;

            if (targetState) {
                panel.classList.remove('collapsed');
            } else {
                panel.classList.add('collapsed');
            }
            updateTopNavButtonsState();
        }

        // =========================================================================
        // GESTOR DE VENTANAS FLOTANTES ARRASTRABLES (ESTILO HÍBRIDO ESCRITORIO / MÓVIL)
        // =========================================================================
        let maxPanelZIndex = 30;

        function bringPanelToFront(panel) {
            if (!panel) return;
            maxPanelZIndex++;
            panel.style.zIndex = maxPanelZIndex;
        }

        function resetPanelDefaultPosition(panelId) {
            const panel = document.getElementById(panelId);
            if (!panel) return;
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = '';
            panel.style.bottom = '';
            panel.style.margin = '';
        }

        function resetAllPanelsPositions() {
            ['sidebar-panel', 'settings-panel'].forEach(id => {
                resetPanelDefaultPosition(id);
            });
        }

        function initDraggablePanels() {
            const panels = [
                document.getElementById('sidebar-panel'),
                document.getElementById('settings-panel')
            ].filter(Boolean);

            panels.forEach(panel => {
                const header = panel.querySelector('.panel-header');
                if (!header) return;

                // Elevar al frente al hacer clic en cualquier parte del panel
                panel.addEventListener('pointerdown', () => {
                    bringPanelToFront(panel);
                });

                // Doble clic en la cabecera restablece su posición original anclada
                header.addEventListener('dblclick', (e) => {
                    if (window.innerWidth <= 900) return;
                    if (e.target.closest('.panel-toggle') || e.target.closest('button') || e.target.closest('a')) return;
                    resetPanelDefaultPosition(panel.id);
                });

                let isDragging = false;
                let startX = 0, startY = 0;
                let startLeft = 0, startTop = 0;

                header.addEventListener('pointerdown', (e) => {
                    // Desactivar arrastre libre en móviles o pantallas táctiles pequeñas
                    if (window.innerWidth <= 900) return;
                    // Evitar arrastre si se pulsa el botón de cerrar u otros controles interactivos
                    if (e.target.closest('.panel-toggle') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('a')) return;
                    // Solo responder al botón principal del ratón (0) o contacto táctil
                    if (e.button !== 0) return;

                    isDragging = true;
                    header.setPointerCapture(e.pointerId);
                    header.classList.add('is-dragging');
                    document.body.classList.add('is-dragging-panel');
                    bringPanelToFront(panel);

                    const rect = panel.getBoundingClientRect();
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = rect.left;
                    startTop = rect.top;

                    // Fijar estilos en píxeles explícitos para movimiento fluido
                    panel.style.left = `${startLeft}px`;
                    panel.style.top = `${startTop}px`;
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    panel.style.margin = '0';

                    e.preventDefault();
                });

                header.addEventListener('pointermove', (e) => {
                    if (!isDragging) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;

                    const panelW = panel.offsetWidth;
                    const panelH = panel.offsetHeight;
                    const minLeft = 10;
                    const maxLeft = Math.max(10, window.innerWidth - panelW - 10);
                    const minTop = 10;
                    const maxTop = Math.max(10, window.innerHeight - 60); // Cabecera siempre accesible

                    let newLeft = startLeft + dx;
                    let newTop = startTop + dy;

                    newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
                    newTop = Math.max(minTop, Math.min(maxTop, newTop));

                    panel.style.left = `${newLeft}px`;
                    panel.style.top = `${newTop}px`;
                });

                const endDrag = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    try {
                        header.releasePointerCapture(e.pointerId);
                    } catch(err) {}
                    header.classList.remove('is-dragging');
                    document.body.classList.remove('is-dragging-panel');
                };

                header.addEventListener('pointerup', endDrag);
                header.addEventListener('pointercancel', endDrag);
            });
        }

        let lastObservedWindowWidth = window.innerWidth;

        window.addEventListener('resize', () => {
            const isSmall = window.innerWidth <= 900;
            const wasLarge = lastObservedWindowWidth > 900;
            lastObservedWindowWidth = window.innerWidth;

            if (isSmall && wasLarge) {
                // Al reducir la pantalla a pequeña (<= 900px):
                const sidePanel = document.getElementById('sidebar-panel');
                const setPanel = document.getElementById('settings-panel');
                const dockPanel = document.getElementById('playback-dock');

                const sideOpen = sidePanel && !sidePanel.classList.contains('collapsed');
                const setOpen = setPanel && !setPanel.classList.contains('collapsed');

                if (sideOpen) {
                    // Si Eclipses estaba abierto (o todos estaban abiertos):
                    // El panel Eclipses prevalece, y se minimizan Visualización y Reproductor
                    if (setPanel) setPanel.classList.add('collapsed');
                    if (dockPanel) dockPanel.classList.add('collapsed');
                } else if (setOpen) {
                    // Si Eclipses estaba cerrado y solo Visualización y Reproductor estaban abiertos:
                    // Se mantienen abiertos
                }
                resetAllPanelsPositions();
            } else if (isSmall) {
                resetAllPanelsPositions();
            } else {
                // Mantener las ventanas dentro del viewport tras redimensionar la pantalla
                ['sidebar-panel', 'settings-panel'].forEach(id => {
                    const p = document.getElementById(id);
                    if (!p || p.classList.contains('collapsed')) return;
                    if (p.style.left && p.style.left !== '' && p.style.left !== 'auto') {
                        const rect = p.getBoundingClientRect();
                        const maxL = Math.max(10, window.innerWidth - p.offsetWidth - 10);
                        const maxT = Math.max(10, window.innerHeight - 60);
                        let curL = parseFloat(p.style.left) || rect.left;
                        let curT = parseFloat(p.style.top) || rect.top;
                        curL = Math.max(10, Math.min(maxL, curL));
                        curT = Math.max(10, Math.min(maxT, curT));
                        p.style.left = `${curL}px`;
                        p.style.top = `${curT}px`;
                    }
                });
            }

            updateTopNavButtonsState();
        });

        // Exportar a iCalendar (.ics)
        function exportSelectedEclipseToICal() {
            if (!currentEclipse) return;
            const ec = currentEclipse;
            const start = new Date(ec.p1Ms);
            const end = new Date(ec.p4Ms);
            const pad = (n) => String(n).padStart(2, '0');
            const format = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

            const summary = `🌕 Eclipse Lunar ${ec.typeLabel} - ${currentObserver.name}`;
            const desc = `Eclipse Lunar ${ec.typeLabel} (Saros ${ec.saros}, Gamma ${ec.gamma.toFixed(2)}). Máximo: ${ec.timeTD} TD. Visibilidad en ${currentObserver.name}: ${document.getElementById('mataro-vis-badge')?.textContent || ''}.`;

            const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Cosmos Mataro//Lunar Eclipse Explorer//ES
BEGIN:VEVENT
UID:lunar-eclipse-${ec.id}@cosmosmataro.org
DTSTAMP:${format(new Date())}
DTSTART:${format(start)}
DTEND:${format(end)}
SUMMARY:${summary}
DESCRIPTION:${desc}
LOCATION:${currentObserver.name} (${formatLatLonString(currentObserver.lat, currentObserver.lon, 2)})
END:VEVENT
END:VCALENDAR`;

            const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Eclipse_Lunar_${ec.dateStr}_${currentObserver.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }


// Exposición global
if (typeof window !== 'undefined') {
    window.updateTopNavButtonsState = updateTopNavButtonsState;
    window.toggleSidebar = toggleSidebar;
    window.toggleSettingsPanel = toggleSettingsPanel;
    window.togglePlaybackDock = togglePlaybackDock;
    window.bringPanelToFront = bringPanelToFront;
    window.resetPanelDefaultPosition = resetPanelDefaultPosition;
    window.resetAllPanelsPositions = resetAllPanelsPositions;
    window.initDraggablePanels = initDraggablePanels;
    window.exportSelectedEclipseToICal = exportSelectedEclipseToICal;
}
