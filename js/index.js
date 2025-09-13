/**
 * Home Dashboard JavaScript - completed and fixed
 *
 * - Ensures escapeHtml defined
 * - Provides fallback createDispatchMap if shared file not loaded
 * - Centers map on user geolocation (fallbacks to dispatch bounds / default)
 * - Adds colored jobsite markers (status-based SVG icons) and user-location marker
 * - Robust config/config.json loading for Google API key (existing behavior retained)
 */

(function () {
    // Utility: escape simple HTML to avoid injection in InfoWindow
    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Provide fallback createDispatchMap if your shared dispatch-map.js is not loaded
    if (typeof window.createDispatchMap !== 'function') {
        window.createDispatchMap = function createDispatchMap(containerId, options = {}) {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error('createDispatchMap: container not found', containerId);
                return null;
            }

            const defaultCenter = options.center || { lat: 40.7128, lng: -74.0060 };
            const map = new google.maps.Map(container, {
                center: defaultCenter,
                zoom: options.zoom || 12,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                styles: options.styles || []
            });

            // helper: build an SVG marker for a given color
            function svgMarkerDataUrl(color = '#EF4444') {
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">
                    <circle cx="12" cy="10" r="6" fill="${color}" stroke="#fff" stroke-width="2"/>
                    <path d="M12 20s-4-4.5-4-8a4 4 0 1 1 8 0c0 3.5-4 8-4 8z" fill="${color}" opacity="0.0"/>
                </svg>`;
                return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
            }

            // determine color by status
            function colorForStatus(status) {
                if (!status) return '#6B7280';
                status = status.toLowerCase();
                if (status === 'active' || status === 'in-progress') return '#DC2626'; // red
                if (status === 'completed') return '#10B981'; // green
                if (status === 'scheduled') return '#F59E0B'; // amber
                return '#6B7280'; // gray
            }

            // add markers for all dispatches and return markers + bounds
            function addMarkers() {
                // clear existing overlays by recreating the map overlays array (quick approach)
                // For a more advanced implementation, keep marker references and remove them.
                const raw = localStorage.getItem('dispatches') || '[]';
                let dispatches;
                try { dispatches = JSON.parse(raw); } catch (e) { dispatches = []; }

                const bounds = new google.maps.LatLngBounds();
                const markers = [];

                dispatches.forEach(d => {
                    let loc = null;
                    if (d.location && typeof d.location.lat === 'number' && typeof d.location.lng === 'number') {
                        loc = { lat: d.location.lat, lng: d.location.lng };
                    } else if (d.lat && d.lng) {
                        loc = { lat: Number(d.lat), lng: Number(d.lng) };
                    }
                    if (!loc) return;

                    const color = colorForStatus(d.status);
                    const marker = new google.maps.Marker({
                        position: loc,
                        map,
                        title: d.jobName || 'Dispatch',
                        icon: {
                            url: svgMarkerDataUrl(color),
                            scaledSize: new google.maps.Size(28, 28)
                        }
                    });

                    const infoHtml = `
                        <div style="min-width:220px;">
                          <strong>${escapeHtml(d.jobName || 'Unnamed Job')}</strong>
                          <div style="color:#666;font-size:13px;margin-top:6px;">
                            ${d.assignedEmployees && d.assignedEmployees.length ? 'Assigned: ' + escapeHtml(d.assignedEmployees.join(', ')) : 'No employees assigned'}
                          </div>
                          <div style="margin-top:6px;font-size:12px;color:#888;">Status: ${escapeHtml(d.status || 'scheduled')}</div>
                        </div>
                    `;
                    const iw = new google.maps.InfoWindow({ content: infoHtml });
                    marker.addListener('click', () => iw.open(map, marker));

                    markers.push(marker);
                    bounds.extend(marker.getPosition());
                });

                // fit to bounds if we have markers
                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { top: options.fitPadding || 60, bottom: options.fitPadding || 60 });
                }
                return { map, markers, bounds };
            }

            // show user location marker (blue dot) and center map there if available
            function showUserLocation() {
                if (!navigator.geolocation) return Promise.resolve(null);
                return new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition((pos) => {
                        const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        // add a simple blue circle marker for user
                        const userMarker = new google.maps.Marker({
                            position: userLoc,
                            map,
                            title: 'Your location',
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="6" fill="#3B82F6" stroke="#fff" stroke-width="2"/>
                                    </svg>`),
                                scaledSize: new google.maps.Size(18, 18)
                            }
                        });
                        // center on user
                        map.setCenter(userLoc);
                        map.setZoom(options.userZoom || 13);
                        resolve(userLoc);
                    }, (err) => {
                        // permission denied or error — resolve with null
                        console.warn('Geolocation not available or denied', err);
                        resolve(null);
                    }, { maximumAge: 60_000, timeout: 5000 });
                });
            }

            // initial markers + try to show user location (async)
            const state = addMarkers();
            showUserLocation().then((userLoc) => {
                // if user location not available but there are markers, bounds already fit
                // otherwise leave default center
            });

            // refresh markers on storage change
            window.addEventListener('storage', (e) => {
                if (e.key === 'dispatches') {
                    addMarkers();
                }
            });

            return map;
        };
    }

    // Global initMap so Google Maps can call it (uses shared createDispatchMap)
    window.initMap = function initMap() {
        try {
            console.log('initMap -> createDispatchMap call');
            const map = window.createDispatchMap('dispatch-map', {
                zoom: 12,
                fitPadding: 60,
                userZoom: 13,
                styles: [
                    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E5E7EB' }] },
                    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] }
                ]
            });
            window.dispatchMap = map;
        } catch (err) {
            console.error('initMap -> createDispatchMap error', err);
            const mapContainer = document.getElementById('dispatch-map');
            if (mapContainer) mapContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8f9fa;color:#666;border-radius:8px;">
                <p>Error initializing dispatch map</p></div>`;
        }
    };

    // --- loadGoogleMaps ect (keep your existing loadGoogleMaps implementation) ---
    async function loadGoogleMaps() {
        // Try likely locations for config/config.json (original robust implementation)
        const tryPaths = [
            '../config/config.json',
            '/config/config.json',
            './config/config.json',
            'config/config.json',
            '../config.json',
            './config.json',
            'config.json'
        ];

        let config = null;
        for (const p of tryPaths) {
            try {
                const res = await fetch(p, { cache: 'no-cache' });
                if (!res.ok) continue;
                const ct = (res.headers.get('content-type') || '').toLowerCase();
                if (ct.includes('application/json')) {
                    config = await res.json();
                } else {
                    const text = await res.text();
                    if (text.trim().startsWith('{')) {
                        try { config = JSON.parse(text); } catch (e) { config = null; }
                    } else continue;
                }
                if (config) break;
            } catch (e) { continue; }
        }

        if (!config || !config.googleMapsApiKey) {
            const mapContainer = document.getElementById('dispatch-map');
            const msg = 'Google Maps API key not found in config. Checked: ' + tryPaths.join(', ');
            console.error(msg);
            if (mapContainer) mapContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8f9fa;color:#666;border-radius:8px;">
                <p>${escapeHtml(msg)}</p></div>`;
            return;
        }

        // If google already loaded, call initMap
        if (window.google && window.google.maps && typeof window.initMap === 'function') {
            window.initMap();
            return;
        }

        // append script
        const script = document.createElement('script');
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&callback=initMap&v=weekly`;
        script.onerror = () => {
            console.error('Failed to load Google Maps script');
            const mapContainer = document.getElementById('dispatch-map');
            if (mapContainer) mapContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8f9fa;color:#666;border-radius:8px;">
                <p>Failed to load Google Maps script. Check API key and network.</p></div>`;
        };
        document.head.appendChild(script);
        console.log('Google Maps script appended from config');
    }

    // Dashboard rendering + helpers (existing behavior)
    function updateStatElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = (value !== undefined && value !== null) ? value : '0';
    }

    function updateUpcomingDispatchesList(upcomingDispatches) {
        const container = document.getElementById('upcoming-dispatches-list');
        if (!container) return;
        if (!upcomingDispatches || upcomingDispatches.length === 0) {
            container.innerHTML = '<p class="activity">No upcoming dispatches in the next 96 hours</p>';
            return;
        }
        const html = upcomingDispatches.map(d => {
            const date = new Date(d.date);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const assigned = (d.assignedEmployees && d.assignedEmployees.length) ? escapeHtml(d.assignedEmployees.join(', ')) : 'No employees assigned';
            const status = escapeHtml(d.status || 'scheduled');
            const job = escapeHtml(d.jobName || 'Unnamed Job');
            return `<div class="dispatch-item">
                        <div class="dispatch-date">${dateStr} at ${timeStr}</div>
                        <div class="dispatch-job">${job}</div>
                        <div class="dispatch-employees">${assigned}</div>
                        <span class="dispatch-status ${status}">${status}</span>
                    </div>`;
        }).join('');
        container.innerHTML = html;
    }

    function updateRecentActivity(activities) {
        const container = document.getElementById('recent-activity');
        if (!container) return;
        const recent = (activities || []).slice(-3).reverse();
        if (recent.length === 0) {
            container.innerHTML = '<p class="activity">No recent activity</p>';
            return;
        }
        container.innerHTML = recent.map(a => {
            const t = a.timestamp ? new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `<p class="activity"><span class="activity-time">${t}</span> - ${escapeHtml(a.message || a.type || '')}</p>`;
        }).join('');
    }

    function loadDashboardData() {
        try {
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) errorMessage.style.display = 'none';

            const employees = JSON.parse(localStorage.getItem('employees') || '[]');
            const dispatches = JSON.parse(localStorage.getItem('dispatches') || '[]');
            const activities = JSON.parse(localStorage.getItem('activity_log') || '[]');

            const now = new Date();
            const next96 = new Date(now.getTime() + 96 * 60 * 60 * 1000);
            const upcoming = dispatches.filter(d => {
                if (!d.date) return false;
                const dt = new Date(d.date);
                return dt >= now && dt <= next96;
            });

            updateStatElement('total-employees', employees.length);
            updateStatElement('active-dispatches', dispatches.filter(d => d.status === 'active' || d.status === 'in-progress').length);
            updateStatElement('upcoming-dispatches', upcoming.length);

            updateUpcomingDispatchesList(upcoming);
            updateRecentActivity(activities);

            console.log('Dashboard data loaded successfully');
        } catch (err) {
            console.error('loadDashboardData error', err);
            const em = document.getElementById('error-message');
            if (em) { em.textContent = 'Unable to load dashboard data.'; em.style.display = 'block'; }
        }
    }

    // DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        const yearEl = document.getElementById('year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        const signoutBtn = document.getElementById('signout-btn');
        if (signoutBtn) signoutBtn.addEventListener('click', () => {
            if (typeof window.logout === 'function') window.logout('User signed out');
            else { sessionStorage.clear(); location.href = './index.html'; }
        });

        const viewFullMapBtn = document.getElementById('view-full-map');
        if (viewFullMapBtn) viewFullMapBtn.addEventListener('click', () => location.href = 'dispatch.html');

        // Start: load maps then dashboard
        loadGoogleMaps().finally(() => {
            // even if maps fail, show dashboard content
            loadDashboardData();
        });

        // refresh dashboard periodically
        setInterval(loadDashboardData, 30000);
    });
})();
