// Dispatch Center Application JavaScript

// Global variables
let jobs = [];
let currentJob = null;
let map;
let directionsService;
let directionsRenderer;
const JOBS_STORAGE_KEY = 'dispatch_jobs';
const ACTIVITY_STORAGE_KEY = 'activity_log';

function appendActivity(entry) {
    try {
        const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        arr.unshift({ ...entry, ts: Date.now() });
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(arr.slice(0, 200)));
    } catch {}
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, waiting for Google Maps...');
    // Wait for Google Maps to load before initializing
    if (typeof google !== 'undefined' && google.maps) {
        console.log('Google Maps already loaded');
        initializeApp();
    } else {
        console.log('Google Maps not loaded yet, setting up callback');
        // If Google Maps isn't loaded yet, wait for it
        window.initMap = function() {
            console.log('Google Maps callback triggered');
            initializeApp();
        };
    }
});

// This function will be called by Google Maps when it loads
function initMap() {
    console.log('initMap called by Google Maps');
    // Don't initialize here, let initializeApp handle it
}

function initializeApp() {
    console.log('Initializing app...');
    
    // Initialize Google Maps services
    directionsService = new google.maps.DirectionsService();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize map
    initializeMap();
    
    // Load any existing jobs (for future server integration)
    loadJobs();

    // Schedule automatic deactivation at midnight (and run an initial check)
    autoDeactivatePastJobs();
    scheduleMidnightDeactivation();
    
    console.log('App initialized successfully');
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Add job button
    const addBtn = document.getElementById('add-btn');
    if (addBtn) {
        addBtn.addEventListener('click', showAddJobPopup);
        console.log('Add button event listener added');
    } else {
        console.error('Add button not found!');
    }
    
    // Home button
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', showJobList);
    }
    
    // Search functionality
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', filterJobs);
    }
    
    // Job form buttons
    const createBtn = document.getElementById('create-job-btn');
    if (createBtn) {
        createBtn.addEventListener('click', createJob);
    }
    
    const cancelBtn = document.getElementById('cancel-job-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideAddJobPopup);
    }
    
    const exitBtn = document.getElementById('exit-form-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', hideAddJobPopup);
    }
    
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', openEmployeePicker);
    }
    
    // Job details buttons
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', showJobList);
    }
    
    const saveBtn = document.getElementById('save-job-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveJobChanges);
    }
    
    const deleteBtn = document.getElementById('delete-job-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', confirmDeleteJob);
    }
    
    // Status button listeners
    const setActiveBtn = document.getElementById('set-active-btn');
    if (setActiveBtn) {
        setActiveBtn.addEventListener('click', () => setJobStatus('active'));
    }
    
    const setInactiveBtn = document.getElementById('set-inactive-btn');
    if (setInactiveBtn) {
        setInactiveBtn.addEventListener('click', () => setJobStatus('inactive'));
    }
    
    // Add employee button in job details
    const addEmployeeEditBtn = document.getElementById('add-employee-edit-btn');
    if (addEmployeeEditBtn) {
        addEmployeeEditBtn.addEventListener('click', openEmployeePickerFromEdit);
    }
    
    // Resizer functionality
    setupResizer();
    
    console.log('Event listeners setup complete');
}

// Employee Picker Modal
function openEmployeePicker() {
    const startEl = document.getElementById('job-start-time');
    const targetDateKey = getDateKeyFromStart(startEl && startEl.value ? startEl.value : '');
    showEmployeePicker((emp) => {
        // Add to creation form list display
        const employeesList = document.getElementById('employees-list');
        if (employeesList) {
            const noMsg = employeesList.querySelector('p');
            if (noMsg) noMsg.remove();
            const el = document.createElement('div');
            el.className = 'employee-item';
            const cls = (emp.classification || '').toUpperCase();
            const isAPP = cls.startsWith('APP');
            const badgeColor = isAPP ? '#DCFCE7' : (cls === 'JM' ? '#DBEAFE' : '#FEF3C7');
            const badgeBorder = isAPP ? '#86EFAC' : (cls === 'JM' ? '#93C5FD' : '#FDE68A');
            const badgeText = isAPP ? '#065F46' : (cls === 'JM' ? '#1E3A8A' : '#92400E');
            const badgeHtml = cls ? `<span style=\"border:1px solid ${badgeBorder}; background:${badgeColor}; color:${badgeText}; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:700;\">${cls}</span>` : '';
            const phoneHtml = emp.phone ? `<span style=\"color:#0b5ed7; font-weight:500;\">${emp.phone}</span>` : '';
            el.innerHTML = `<div style=\"display:flex; align-items:center; gap:0.5rem; width:100%;\">
                                <span class=\"employee-name\" style=\"flex:1;\">${emp.name}</span>
                                <div style=\"display:flex; align-items:center; gap:0.5rem;\">${badgeHtml}${phoneHtml ? ' • ' + phoneHtml : ''}</div>
                            </div>`;
        employeesList.appendChild(el);
        }
    }, { targetDateKey, targetJobId: null });
}

function openEmployeePickerFromEdit() {
    if (!currentJob) return;
    const targetDateKey = getDateKeyFromStart(currentJob.startTime || '');
    showEmployeePicker((emp) => {
        if (!currentJob.employees) currentJob.employees = [];
        currentJob.employees.push(emp.name);
        updateJobEmployeesDisplay();
        displayJobs();
        showNotification('Employee added successfully!', 'success');
    }, { targetDateKey, targetJobId: currentJob.id });
}

function showEmployeePicker(onSelect, options = {}) {
    const overlay = document.getElementById('employee-picker-overlay');
    const closeBtn = document.getElementById('employee-picker-close');
    const list = document.getElementById('employee-picker-list');
    const searchInput = document.getElementById('employee-picker-search');
    const { targetDateKey = getTodayKey(), targetJobId = null } = options;

    function getEmployees() {
        try {
            const raw = localStorage.getItem('employees');
            const all = raw ? JSON.parse(raw) : [];
            const DAY_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            // Determine the day-of-week for the target job date (fallback to today)
            let dowIdx;
            if (targetDateKey && targetDateKey !== 'no-date') {
                const dt = new Date(targetDateKey + 'T00:00');
                dowIdx = isNaN(dt) ? new Date().getDay() : dt.getDay();
            } else {
                dowIdx = new Date().getDay();
            }
            const targetDay = DAY_ABBR[dowIdx];
            return all.filter(e => {
                const status = (e.status || 'active');
                const unavail = Array.isArray(e.unavailableDays) ? e.unavailableDays : [];
                const unavailableThatDay = unavail.includes(targetDay);
                return status === 'active' && !unavailableThatDay;
            });
        } catch {
            return [];
        }
    }

    function findAssignmentsForDate(dateKey) {
        const assn = new Map(); // name -> { jobName, jobId, dateKey }
        const key = dateKey || 'no-date';
        jobs.filter(j => j.status === 'active' && j.startTime)
            .forEach(j => {
                const jk = getDateKeyFromStart(j.startTime);
                if (jk === key && Array.isArray(j.employees)) {
                    j.employees.forEach(name => {
                        assn.set(name, { jobName: j.name, jobId: j.id, dateKey: jk });
                    });
                }
            });
        return assn;
    }

    function render(items) {
        list.innerHTML = '';
        if (!items || items.length === 0) {
            list.innerHTML = '<p style="color:#64748b;">No active employees found.</p>';
            return;
        }
        const assignments = findAssignmentsForDate(targetDateKey);
        const sorted = items.slice().sort((a, b) => {
            const aAssigned = assignments.has(a.name) && assignments.get(a.name).jobId !== targetJobId;
            const bAssigned = assignments.has(b.name) && assignments.get(b.name).jobId !== targetJobId;
            if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
            return (a.name||'').localeCompare(b.name||'');
        });
        const frag = document.createDocumentFragment();
        sorted.forEach(emp => {
            const row = document.createElement('div');
            row.className = 'picker-row';
            row.style.cssText = 'display:flex; align-items:center; gap:0.75rem; padding:0.5rem; border-bottom:1px solid #f1f5f9; cursor:pointer; transition:transform .15s ease, box-shadow .15s ease; border-radius:8px;';
            row.addEventListener('mouseenter', () => {
                row.style.transform = 'translateY(-2px)';
                row.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            });
            row.addEventListener('mouseleave', () => {
                row.style.transform = '';
                row.style.boxShadow = '';
            });
            const assn = assignments.get(emp.name);
            const isConflicting = assn && assn.jobId !== targetJobId;
            if (isConflicting) {
                row.style.opacity = '0.55';
            }
            row.addEventListener('click', () => {
                if (isConflicting) {
                    const dt = assn.dateKey === 'no-date' ? '' : new Date(assn.dateKey + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    const msg = `${emp.name} is already assigned to "${assn.jobName}" on ${dt}.\nSelecting will remove them from that job and assign them here. Continue?`;
                    if (!confirm(msg)) return;
                    jobs.forEach(j => {
                        if (j.status === 'active' && j.id !== targetJobId && j.startTime) {
                            const jk = getDateKeyFromStart(j.startTime);
                            if (jk === assn.dateKey && Array.isArray(j.employees)) {
                                const idx = j.employees.indexOf(emp.name);
                                if (idx !== -1) j.employees.splice(idx, 1);
                            }
                        }
                    });
                    saveJobs();
                    displayJobs();
                    showNotification(`${emp.name} reassigned from ${assn.jobName}.`, 'info');
                }
                overlay.style.display = 'none';
                onSelect(emp);
            });
            const avatar = document.createElement('div');
            avatar.style.cssText = 'height:36px; width:36px; border-radius:50%; background:#0EA5A4; color:white; display:flex; align-items:center; justify-content:center; font-weight:700;';
            if (emp.avatar) {
                avatar.style.backgroundImage = emp.avatar;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
                avatar.textContent = '';
            } else {
                avatar.textContent = (emp.name||'').split(' ').map(n=>n[0]).join('').toUpperCase();
            }
            const info = document.createElement('div');
            info.style.flex = '1';
            const cls = (emp.classification || '').toUpperCase();
            const isAPP = cls.startsWith('APP');
            const badgeColor = isAPP ? '#DCFCE7' : (cls === 'JM' ? '#DBEAFE' : '#FEF3C7'); // light fill
            const badgeBorder = isAPP ? '#86EFAC' : (cls === 'JM' ? '#93C5FD' : '#FDE68A'); // border
            const badgeText = isAPP ? '#065F46' : (cls === 'JM' ? '#1E3A8A' : '#92400E');   // text
            const badgeHtml = cls ? `<span style="border:1px solid ${badgeBorder}; background:${badgeColor}; color:${badgeText}; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:700;">${cls}</span>` : '';
            const phoneHtml = emp.phone ? `<span style="color:#0b5ed7;">${emp.phone}</span>` : '';
            info.innerHTML = `<div style="font-weight:600; color:#0F172A;">${emp.name}</div>
                              <div style="display:flex; align-items:center; gap:0.5rem; font-size:12px; color:#64748b;">${badgeHtml}${phoneHtml ? ' • ' + phoneHtml : ''}</div>`;
            const status = document.createElement('span');
            status.className = 'status-pill';
            status.textContent = 'Active';
            status.style.cssText = 'background:#10B981; color:white; padding:2px 8px; border-radius:999px; font-size:12px;';
            // Insert job/date chip before status if conflicting
            let assignedChip = null;
            if (isConflicting) {
                assignedChip = document.createElement('span');
                const dtStr = assn.dateKey === 'no-date' ? '' : new Date(assn.dateKey + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                assignedChip.textContent = `${assn.jobName} — ${dtStr}`;
                assignedChip.style.cssText = 'background:#e5e7eb; color:#374151; padding:2px 8px; border-radius:999px; font-size:12px; margin-right:6px; border:1px solid #d1d5db;';
            }
            row.appendChild(avatar);
            row.appendChild(info);
            if (assignedChip) row.appendChild(assignedChip);
            row.appendChild(status);
            frag.appendChild(row);
        });
        list.appendChild(frag);
    }

    function applyFilter() {
        const term = (searchInput.value || '').toLowerCase();
        const base = getEmployees();
        const filtered = base.filter(e =>
            (e.name||'').toLowerCase().includes(term) ||
            (e.classification||'').toLowerCase().includes(term) ||
            (e.phone||'').toLowerCase().includes(term)
        );
        render(filtered);
    }

    // Open and wire
    overlay.style.display = 'block';
    render(getEmployees());
    searchInput.value = '';
    searchInput.oninput = applyFilter;
    closeBtn.onclick = () => overlay.style.display = 'none';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
}

function initializeMap() {
    console.log('Initializing map...');
    
    // Initialize map with default center
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 34.05, lng: -118.25 },
        zoom: 10
    });
    
    console.log('Map created:', map);
    
    // Set up directions renderer with proper options
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: false,
        suppressMarkers: false,
        polylineOptions: {
            strokeColor: '#4285F4',
            strokeWeight: 4,
            strokeOpacity: 0.8
        }
    });
    
    // Set the map for the directions renderer
    directionsRenderer.setMap(map);
    
    console.log('Map and directions renderer initialized successfully');
}

// Job Management Functions
function showAddJobPopup() {
    console.log('showAddJobPopup called');
    const form = document.getElementById('new-job-form');
    if (form) {
        form.style.display = 'block';
        const input = document.getElementById('new-job-input');
        if (input) {
            input.focus();
        }
        console.log('Job form displayed');
    } else {
        console.error('Job form not found!');
    }
}

function hideAddJobPopup() {
    // Check if there are unsaved changes
    const jobName = document.getElementById('new-job-input').value.trim();
    const jobDesc = document.getElementById('job-description').value.trim();
    const jobAddress = document.getElementById('job-address').value.trim();
    const jobLat = document.getElementById('job-lat').value.trim();
    const jobLng = document.getElementById('job-lng').value.trim();
    const jobStartTime = document.getElementById('job-start-time').value.trim();
    const clientName = document.getElementById('client-name').value.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const clientEmail = document.getElementById('client-email').value.trim();
    const jobScope = document.getElementById('job-scope').value.trim();
    
    if (jobName || jobDesc || jobAddress || jobLat || jobLng || jobStartTime || clientName || clientPhone || clientEmail || jobScope) {
        if (confirm('You have unsaved changes. Are you sure you want to exit? Changes will be lost.')) {
            clearJobForm();
            document.getElementById('new-job-form').style.display = 'none';
        }
    } else {
        clearJobForm();
        document.getElementById('new-job-form').style.display = 'none';
    }
}

function clearJobForm() {
    document.getElementById('new-job-input').value = '';
    document.getElementById('job-description').value = '';
    document.getElementById('job-address').value = '';
    document.getElementById('job-lat').value = '';
    document.getElementById('job-lng').value = '';
    document.getElementById('job-start-time').value = '';
    document.getElementById('client-name').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-email').value = '';
    document.getElementById('job-scope').value = '';
    document.getElementById('employees-list').innerHTML = '<p style="margin:0; color:#666; font-style:italic;">No employees added yet</p>';
}

function createJob() {
    const jobName = document.getElementById('new-job-input').value.trim();
    const jobDesc = document.getElementById('job-description').value.trim();
    const jobAddress = document.getElementById('job-address').value.trim();
    const jobStartTime = document.getElementById('job-start-time').value;
    const clientName = document.getElementById('client-name').value.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const clientEmail = document.getElementById('client-email').value.trim();
    const jobScope = document.getElementById('job-scope').value.trim();
    
    if (!jobName) {
        alert('Please enter a job name');
        return;
    }
    
    // Get employees from the form
    const employeeItems = document.querySelectorAll('.employee-item .employee-name');
    const employees = Array.from(employeeItems).map(item => item.textContent.trim());
    
    // Create new job object
    const newJob = {
        id: Date.now(), // Simple ID generation
        name: jobName,
        description: jobDesc,
        address: jobAddress,
        startTime: jobStartTime,
        client: {
            name: clientName,
            phone: clientPhone,
            email: clientEmail
        },
        scope: jobScope,
        employees: employees,
        status: 'active', // Default to active
        location: null, // Will be set when address is geocoded
        created: new Date()
    };
    
    // Geocode address if provided, otherwise use manual coordinates if available
    if (jobAddress) {
        geocodeAddress(jobAddress, newJob);
    } else {
        // If no address, try to get coordinates from the form (for manual entry)
        const latInput = document.getElementById('job-lat');
        const lngInput = document.getElementById('job-lng');
        if (latInput && lngInput && latInput.value && lngInput.value) {
            const lat = parseFloat(latInput.value);
            const lng = parseFloat(lngInput.value);
            if (!isNaN(lat) && !isNaN(lng)) {
                newJob.location = { lat, lng };
                addJobMarker(newJob);
            }
        }
    }
    
    // Add job to list
    jobs.push(newJob);
    saveJobs();

    // Activity: job created
    appendActivity({ type: 'job_create', id: newJob.id, name: newJob.name });
    
    // Clear form and hide popup
    clearJobForm();
    document.getElementById('new-job-form').style.display = 'none';
    
    // Refresh job list
    displayJobs();
    
    // Show success notification
    showNotification('Job created successfully!', 'success');
}

function geocodeAddress(address, job) {
    if (!address || address.trim() === '') {
        console.log('No address provided for geocoding');
        return;
    }
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, function(results, status) {
        console.log('Geocoding status:', status, 'Results:', results);
        
        if (status === 'OK' && results[0]) {
            job.location = {
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
            };
            
            // Add marker to map
            addJobMarker(job);
            saveJobs();
            showNotification('Location found and marker added!', 'success');
        } else {
            console.error('Geocoding failed:', status);
            
            // Provide more specific error messages
            let errorMessage = 'Could not find location for address: ' + address;
            if (status === 'ZERO_RESULTS') {
                errorMessage = 'No results found for address: ' + address;
            } else if (status === 'OVER_QUERY_LIMIT') {
                errorMessage = 'Geocoding quota exceeded. Please try again later.';
            } else if (status === 'REQUEST_DENIED') {
                errorMessage = 'Geocoding request denied. Check API key configuration.';
            } else if (status === 'INVALID_REQUEST') {
                errorMessage = 'Invalid address format: ' + address;
            }
            
            showNotification(errorMessage, 'error');
            
            // Set a default location for testing (Los Angeles area)
            job.location = { lat: 34.0522, lng: -118.2437 };
            addJobMarker(job);
            saveJobs();
            showNotification('Using default location for testing. Please check your Google Maps API key.', 'info');
        }
    });
}

function addJobMarker(job) {
    if (job.location && map) {
        // Use the new AdvancedMarkerElement if available, fallback to regular Marker
        let marker;
        
        // Get marker color based on job status
        const markerColor = job.status === 'active' ? '#28a745' : '#dc3545';
        
        if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
            // Create a simple element for the marker
            const markerElement = document.createElement('div');
            markerElement.style.width = '20px';
            markerElement.style.height = '20px';
            markerElement.style.backgroundColor = markerColor;
            markerElement.style.border = '2px solid white';
            markerElement.style.borderRadius = '50%';
            markerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            
            marker = new google.maps.marker.AdvancedMarkerElement({
                position: job.location,
                map: map,
                title: job.name,
                content: markerElement
            });
        } else {
            // Fallback to regular Marker
            marker = new google.maps.Marker({
                position: job.location,
                map: map,
                title: job.name,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: markerColor,
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                    scale: 10
                },
                animation: google.maps.Animation.DROP
            });
        }
        
        // Add click listener to marker
        marker.addListener('click', function() {
            selectJob(job.id);
        });
        
        // Store marker reference in job object
        job.marker = marker;
        
        console.log('Marker added for job:', job.name, 'with color:', markerColor);
    }
}

function displayJobs() {
    const activeJobsList = document.getElementById('active-jobs-list');
    const inactiveJobsList = document.getElementById('inactive-jobs-list');
    const activeCount = document.getElementById('active-count');
    const inactiveCount = document.getElementById('inactive-count');
    
    // Clear existing lists
    activeJobsList.innerHTML = '';
    inactiveJobsList.innerHTML = '';
    
    // Separate jobs by status
    const activeJobs = jobs.filter(job => job.status === 'active');
    const inactiveJobs = jobs.filter(job => job.status === 'inactive');
    
    // Update counts
    activeCount.textContent = activeJobs.length;
    inactiveCount.textContent = inactiveJobs.length;
    
    // Group and add active jobs by day with headers
    const groups = groupActiveJobsByDay(activeJobs);
    groups.forEach(group => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = group.label;
        activeJobsList.appendChild(header);
        group.jobs.forEach(job => {
            const jobElement = createJobElement(job);
            activeJobsList.appendChild(jobElement);
        });
    });
    
    // Add inactive jobs
    inactiveJobs.forEach(job => {
        const jobElement = createJobElement(job);
        inactiveJobsList.appendChild(jobElement);
    });
    
    // Update section classes for styling
    const activeSection = document.querySelector('.job-section:first-child');
    const inactiveSection = document.querySelector('.job-section:last-child');
    
    if (activeJobs.length > 0) {
        activeSection.classList.add('active');
    } else {
        activeSection.classList.remove('active');
    }
    
    if (inactiveJobs.length > 0) {
        inactiveSection.classList.add('inactive');
    } else {
        inactiveSection.classList.remove('inactive');
    }
}

// Helpers for grouping active jobs by date
function getDateKeyFromStart(startTime) {
    if (!startTime) return 'no-date';
    // Expecting format from datetime-local: YYYY-MM-DDTHH:mm
    const t = String(startTime);
    const idx = t.indexOf('T');
    return idx > 0 ? t.slice(0, idx) : 'no-date';
}

function formatDayLabel(dateKey) {
    if (dateKey === 'no-date') return 'No Date';
    const dt = new Date(dateKey + 'T00:00');
    const day = dt.toLocaleDateString(undefined, { weekday: 'long' });
    const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const todayKey = getTodayKey();
    const prefix = dateKey === todayKey ? 'Today • ' : '';
    return `${prefix}${day} — ${dateStr}`;
}

function getTodayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function groupActiveJobsByDay(activeJobs) {
    // Build groups by dateKey
    const mapGroups = new Map();
    activeJobs.forEach(job => {
        const key = getDateKeyFromStart(job.startTime);
        if (!mapGroups.has(key)) mapGroups.set(key, []);
        mapGroups.get(key).push(job);
    });
    // Sort jobs within each day by time ascending
    const groups = [];
    for (const [dateKey, arr] of mapGroups.entries()) {
        const sorted = arr.slice().sort((a, b) => {
            const at = a.startTime || '';
            const bt = b.startTime || '';
            return at.localeCompare(bt);
        });
        groups.push({
            dateKey,
            label: formatDayLabel(dateKey),
            jobs: sorted
        });
    }
    // Sort groups: today first, then future dates ascending, then 'no-date' last
    const todayKey = getTodayKey();
    groups.sort((g1, g2) => {
        const a = g1.dateKey;
        const b = g2.dateKey;
        if (a === todayKey && b !== todayKey) return -1;
        if (b === todayKey && a !== todayKey) return 1;
        if (a === 'no-date' && b !== 'no-date') return 1;
        if (b === 'no-date' && a !== 'no-date') return -1;
        return a.localeCompare(b);
    });
    return groups;
}

function createJobElement(job) {
    const jobElement = document.createElement('div');
    jobElement.className = 'job-item';
    jobElement.style.cursor = 'pointer';
    jobElement.addEventListener('click', () => selectJob(job.id));
    jobElement.addEventListener('mouseenter', () => {
        jobElement.style.transform = 'translateY(-3px)';
        jobElement.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
        jobElement.style.transition = 'transform .15s ease, box-shadow .15s ease';
    });
    jobElement.addEventListener('mouseleave', () => {
        jobElement.style.transform = '';
        jobElement.style.boxShadow = '';
    });
    
    // Start time display
    const startTimeDisplay = job.startTime ? 
        new Date(job.startTime).toLocaleString() : 'No start time';
    
    // Employee count
    const employeeCount = job.employees ? job.employees.length : 0;
    const employeeText = employeeCount > 0 ? `${employeeCount} employee${employeeCount > 1 ? 's' : ''}` : 'No employees';
    
    // Client information
    const clientName = job.client && job.client.name ? job.client.name : 'No client assigned';
    const clientPhone = job.client && job.client.phone ? job.client.phone : '';
    
    jobElement.innerHTML = `
        <div class="job-name" style="margin-bottom:0.5rem;">
            ${job.name}
        </div>
        <div class="job-client" style="font-size:14px; color:#007bff; margin-bottom:0.25rem; font-weight:500;">
            Client: ${clientName}
        </div>
        <div class="job-meta" style="font-size:14px; color:#666; margin-bottom:0.25rem;">
            ${job.address || 'No address'}
        </div>
        <div class="job-time" style="font-size:12px; color:#666; margin-bottom:0.25rem;">
            Start: ${startTimeDisplay}
        </div>
        <div class="job-employees" style="font-size:12px; color:#666;">
            ${employeeText}
        </div>
    `;
    
    return jobElement;
}

function selectJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    
    currentJob = job;
    
    // Hide job list and show job details
    document.getElementById('job-lists-container').style.display = 'none';
    document.getElementById('job-details').style.display = 'block';
    
    // Populate job details
    document.getElementById('job-title').textContent = job.name;
    document.getElementById('edit-job-name').value = job.name;
    document.getElementById('edit-description').value = job.description || '';
    document.getElementById('edit-address').value = job.address || '';
    document.getElementById('edit-start-time').value = job.startTime || '';
    document.getElementById('edit-client-name').value = job.client ? job.client.name || '' : '';
    document.getElementById('edit-client-phone').value = job.client ? job.client.phone || '' : '';
    document.getElementById('edit-client-email').value = job.client ? job.client.email || '' : '';
    document.getElementById('edit-lat').value = job.location ? job.location.lat : '';
    document.getElementById('edit-lng').value = job.location ? job.location.lng : '';
    document.getElementById('edit-scope').value = job.scope || '';
    
    // Update status buttons
    updateStatusButtons(job.status);
    
    // Populate employees list
    updateJobEmployeesDisplay();
    
    // Show directions if location is available (with a small delay to ensure map is ready)
    if (job.location) {
        setTimeout(() => {
            showDirectionsToJob(job);
        }, 100);
    }
}

function showDirectionsToJob(job) {
    if (!job.location) {
        showNotification('No location available for this job', 'error');
        return;
    }
    
    // Ensure map and directions renderer exist
    if (!map) {
        console.error('Map is not initialized yet');
        showNotification('Map is not ready yet. Please try again.', 'error');
        return;
    }
    
    if (!directionsRenderer) {
        console.log('Creating directions renderer...');
        directionsRenderer = new google.maps.DirectionsRenderer({
            draggable: false,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#4285F4',
                strokeWeight: 4,
                strokeOpacity: 0.8
            }
        });
        directionsRenderer.setMap(map);
    }
    
    console.log('Getting directions to job:', job.name, 'at location:', job.location);
    
    // Get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            console.log('User location:', userLocation);
            console.log('Job location:', job.location);
            
            const request = {
                origin: userLocation,
                destination: job.location,
                travelMode: google.maps.TravelMode.DRIVING
            };
            
            directionsService.route(request, function(result, status) {
                console.log('Directions service status:', status);
                console.log('Directions result:', result);
                
                if (status === 'OK') {
                    console.log('Directions received successfully');
                    
                    // Clear any existing directions first
                    if (directionsRenderer) {
                        directionsRenderer.setDirections({routes: []});
                    }
                    
                    // Set the new directions
                    directionsRenderer.setDirections(result);
                    
                    // Center map on route
                    if (map) {
                        const bounds = new google.maps.LatLngBounds();
                        result.routes[0].legs.forEach(leg => {
                            bounds.extend(leg.start_location);
                            bounds.extend(leg.end_location);
                        });
                        map.fitBounds(bounds);
                        console.log('Map centered on route');
                    } else {
                        console.error('Map is not available for centering');
                    }
                    
                    // Add a small delay to ensure the map updates
                    setTimeout(() => {
                        showNotification('Directions loaded successfully!', 'success');
                    }, 500);
                } else {
                    console.error('Directions request failed:', status);
                    let errorMessage = 'Could not get directions to job location';
                    if (status === 'ZERO_RESULTS') {
                        errorMessage = 'No route found to this location';
                    } else if (status === 'OVER_QUERY_LIMIT') {
                        errorMessage = 'Directions quota exceeded. Please try again later.';
                    } else if (status === 'REQUEST_DENIED') {
                        errorMessage = 'Directions request denied. Check API key configuration.';
                    } else if (status === 'INVALID_REQUEST') {
                        errorMessage = 'Invalid directions request';
                    }
                    showNotification(errorMessage, 'error');
                }
            });
        }, function(error) {
            console.error('Geolocation error:', error);
            let errorMessage = 'Could not get your current location for directions';
            if (error.code === error.PERMISSION_DENIED) {
                errorMessage = 'Location access denied. Please enable location services.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMessage = 'Location information unavailable.';
            } else if (error.code === error.TIMEOUT) {
                errorMessage = 'Location request timed out.';
            }
            showNotification(errorMessage, 'error');
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        });
    } else {
        showNotification('Geolocation is not supported by this browser', 'error');
    }
}

function showJobList() {
    document.getElementById('job-details').style.display = 'none';
    document.getElementById('job-lists-container').style.display = 'block';
    
    // Clear directions if renderer exists
    if (directionsRenderer) {
        directionsRenderer.setDirections({routes: []});
    }
    
    currentJob = null;
}

function saveJobChanges() {
    if (!currentJob) return;
    
    // Update job with new values
    currentJob.name = document.getElementById('edit-job-name').value.trim();
    currentJob.description = document.getElementById('edit-description').value.trim();
    currentJob.address = document.getElementById('edit-address').value.trim();
    currentJob.startTime = document.getElementById('edit-start-time').value;
    currentJob.client = {
        name: document.getElementById('edit-client-name').value.trim(),
        phone: document.getElementById('edit-client-phone').value.trim(),
        email: document.getElementById('edit-client-email').value.trim()
    };
    currentJob.scope = document.getElementById('edit-scope').value.trim();
    
    const lat = parseFloat(document.getElementById('edit-lat').value);
    const lng = parseFloat(document.getElementById('edit-lng').value);
    
    if (!isNaN(lat) && !isNaN(lng)) {
        currentJob.location = { lat, lng };
        
        // Update marker position
        if (currentJob.marker) {
            currentJob.marker.setPosition(currentJob.location);
        } else {
            addJobMarker(currentJob);
        }
    }
    
    // If address changed, try to geocode it
    if (currentJob.address && !currentJob.location) {
        geocodeAddress(currentJob.address, currentJob);
    }
    
    // Refresh job list
    displayJobs();
    saveJobs();

    // Activity: job edited
    appendActivity({ type: 'job_edit', id: currentJob.id, name: currentJob.name });
    
    // Show success notification
    showNotification('Job updated successfully!', 'success');
    
    // Return to main job list screen
    showJobList();
}

function confirmDeleteJob() {
    if (!currentJob) return;
    
    if (confirm(`Are you sure you want to delete "${currentJob.name}"? This action cannot be undone.`)) {
        deleteJob(currentJob.id);
    }
}

function deleteJob(jobId) {
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex === -1) return;
    
    const job = jobs[jobIndex];
    
    // Remove marker from map
    if (job.marker) {
        job.marker.setMap(null);
    }
    
    // Remove job from array
    jobs.splice(jobIndex, 1);
    saveJobs();
    
    // Clear directions
    directionsRenderer.setDirections({routes: []});
    
    // Show job list
    showJobList();
    
    // Refresh job list
    displayJobs();
    
    showNotification('Job deleted successfully!', 'success');
}

function filterJobs() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const jobItems = document.querySelectorAll('.job-item');
    
    jobItems.forEach(item => {
        const jobName = item.querySelector('.job-name').textContent.toLowerCase();
        if (jobName.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

function addEmployee() {
    const employeeName = prompt('Enter employee name:');
    if (employeeName && employeeName.trim()) {
        const employeesList = document.getElementById('employees-list');
        
        // Remove the "No employees added yet" message if it exists
        const noEmployeesMsg = employeesList.querySelector('p');
        if (noEmployeesMsg) {
            noEmployeesMsg.remove();
        }
        
        // Create employee item
        const employeeItem = document.createElement('div');
        employeeItem.className = 'employee-item';
        employeeItem.innerHTML = `
            <span class="employee-name">${employeeName.trim()}</span>
            <button class="remove-employee" onclick="removeEmployee(this)">Remove</button>
        `;
        
        employeesList.appendChild(employeeItem);
    }
}

function addEmployeeToJob() {
    if (!currentJob) return;
    
    const employeeName = prompt('Enter employee name:');
    if (employeeName && employeeName.trim()) {
        // Add employee to the current job
        if (!currentJob.employees) {
            currentJob.employees = [];
        }
        currentJob.employees.push(employeeName.trim());
        
        // Update the display
        updateJobEmployeesDisplay();
        
        // Refresh the job list to show updated employee count
        displayJobs();
        
        showNotification('Employee added successfully!', 'success');
    }
}

function updateJobEmployeesDisplay() {
    if (!currentJob) return;
    
    const employeesList = document.getElementById('edit-employees-list');
    if (currentJob.employees && currentJob.employees.length > 0) {
        employeesList.innerHTML = '';
        currentJob.employees.forEach((employee, index) => {
            const employeeDiv = document.createElement('div');
            employeeDiv.className = 'employee-display-item';
            employeeDiv.innerHTML = `
                <span class="employee-name">${employee}</span>
                <button class="remove-employee" onclick="removeEmployeeFromJob(${index})" style="background:#dc3545; color:white; border:none; padding:0.25rem 0.5rem; border-radius:3px; cursor:pointer; font-size:12px; margin-left:0.5rem;">Remove</button>
            `;
            employeesList.appendChild(employeeDiv);
        });
    } else {
        employeesList.innerHTML = '<p style="margin:0; color:#666; font-style:italic;">No employees assigned</p>';
    }
}

function removeEmployeeFromJob(employeeIndex) {
    if (!currentJob || !currentJob.employees) return;
    
    if (confirm('Are you sure you want to remove this employee?')) {
        currentJob.employees.splice(employeeIndex, 1);
        updateJobEmployeesDisplay();
        displayJobs(); // Refresh job list
    saveJobs();
        showNotification('Employee removed successfully!', 'success');
    }
}

function removeEmployee(button) {
    if (confirm('Are you sure you want to remove this employee?')) {
        button.parentElement.remove();
        
        // Show "No employees added yet" if list is empty
        const employeesList = document.getElementById('employees-list');
        if (employeesList.children.length === 0) {
            employeesList.innerHTML = '<p style="margin:0; color:#666; font-style:italic;">No employees added yet</p>';
        }
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function updateStatusButtons(status) {
    const activeBtn = document.getElementById('set-active-btn');
    const inactiveBtn = document.getElementById('set-inactive-btn');
    
    if (activeBtn && inactiveBtn) {
        if (status === 'active') {
            activeBtn.style.opacity = '1';
            activeBtn.style.transform = 'scale(1.05)';
            inactiveBtn.style.opacity = '0.6';
            inactiveBtn.style.transform = 'scale(1)';
        } else {
            activeBtn.style.opacity = '0.6';
            activeBtn.style.transform = 'scale(1)';
            inactiveBtn.style.opacity = '1';
            inactiveBtn.style.transform = 'scale(1.05)';
        }
    }
}

function setJobStatus(status) {
    if (!currentJob) return;
    
    currentJob.status = status;
    // If setting to inactive, clear date/time and employees per requirements
    if (status === 'inactive') {
        currentJob.startTime = '';
        currentJob.employees = [];
        // Reflect in UI if on the details screen
        const startTimeInput = document.getElementById('edit-start-time');
        if (startTimeInput) startTimeInput.value = '';
        updateJobEmployeesDisplay();
    }
    
    // Update the marker color
    updateJobMarker(currentJob);
    
    // Update status buttons
    updateStatusButtons(status);
    
    // Refresh job list to show updated status
    displayJobs();
    saveJobs();
    
    showNotification(`Job status changed to ${status}`, 'success');
}

function updateJobMarker(job) {
    if (!job.marker || !job.location) return;
    
    // Remove old marker
    if (job.marker.map) {
        job.marker.map = null;
    }
    
    // Create new marker with appropriate color
    const markerColor = job.status === 'active' ? '#28a745' : '#dc3545';
    
    if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
        // Create a simple element for the marker
        const markerElement = document.createElement('div');
        markerElement.style.width = '20px';
        markerElement.style.height = '20px';
        markerElement.style.backgroundColor = markerColor;
        markerElement.style.border = '2px solid white';
        markerElement.style.borderRadius = '50%';
        markerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        
        job.marker = new google.maps.marker.AdvancedMarkerElement({
            position: job.location,
            map: map,
            title: job.name,
            content: markerElement
        });
    } else {
        // Fallback to regular Marker
        job.marker = new google.maps.Marker({
            position: job.location,
            map: map,
            title: job.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: markerColor,
                fillOpacity: 1,
                strokeColor: 'white',
                strokeWeight: 2,
                scale: 10
            }
        });
    }
    
    // Add click listener to marker
    job.marker.addListener('click', function() {
        selectJob(job.id);
    });
}

function setupResizer() {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    const mapEl = document.getElementById('map');
    
    if (!resizer || !sidebar || !mapEl) return;
    // Set default split 65/35
    sidebar.style.width = '65%';
    mapEl.style.width = '35%';
    
    let isResizing = false;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        const startX = e.clientX;
        const startWidth = sidebar.offsetWidth;
    const containerWidth = document.getElementById('container').offsetWidth;
        
        function handleMouseMove(e) {
            if (!isResizing) return;
            
            const currentX = e.clientX;
            const diffX = currentX - startX;
            const newWidth = startWidth + diffX;
            
            // Calculate percentages
            const newSidebarPercent = (newWidth / containerWidth) * 100;
            let newMapPercent = 100 - newSidebarPercent;
            // Clamp sidebar between 40% and 65%
            const clampedSidebar = Math.max(40, Math.min(65, newSidebarPercent));
            newMapPercent = 100 - clampedSidebar;
            // Ensure map is at least 35%
            if (newMapPercent < 35) {
                newMapPercent = 35;
            }
            sidebar.style.width = clampedSidebar + '%';
            mapEl.style.width = newMapPercent + '%';
            
            // Trigger map resize if Google Maps is loaded
            if (mapEl && window.google && google.maps) {
                setTimeout(() => {
                    google.maps.event.trigger(mapEl, 'resize');
                }, 100);
            }
        }
        
        function handleMouseUp() {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
    
    // Prevent text selection while resizing
    resizer.addEventListener('selectstart', (e) => {
        e.preventDefault();
    });
}

function toggleJobSection(status) {
    let section;
    if (status === 'active') {
        section = document.querySelector('.job-section:first-child');
    } else if (status === 'inactive') {
        section = document.querySelector('.job-section:last-child');
    }
    
    if (section) {
        section.classList.toggle('collapsed');
    }
}

function loadJobs() {
    try {
        const raw = localStorage.getItem(JOBS_STORAGE_KEY);
        jobs = raw ? JSON.parse(raw) : [];
    } catch {
        jobs = [];
    }
    // Recreate markers for persisted jobs with locations
    if (Array.isArray(jobs)) {
        jobs.forEach(j => {
            if (j && j.location) addJobMarker(j);
        });
    }
    // Ensure past-day active jobs are auto-deactivated on load
    autoDeactivatePastJobs();
    displayJobs();
}

function saveJobs() {
    try {
    // Strip non-serializable Google Maps marker objects before saving
    const replacer = (key, value) => (key === 'marker' ? undefined : value);
    localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs, replacer));
    } catch (e) {
        console.error('Failed to save jobs to storage', e);
    }
}

// Automatically deactivate yesterday's jobs at midnight, clearing date/time and employees
function autoDeactivatePastJobs() {
    const todayKey = getTodayKey();
    let changed = false;
    jobs.forEach(job => {
        if (job.status === 'active' && job.startTime) {
            const key = getDateKeyFromStart(job.startTime);
            if (key !== 'no-date' && key < todayKey) {
                job.status = 'inactive';
                job.startTime = '';
                job.employees = [];
                updateJobMarker(job);
                changed = true;
            }
        }
    });
    if (changed) {
        saveJobs();
    }
}

function scheduleMidnightDeactivation() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0); // next midnight
    const ms = next.getTime() - now.getTime();
    setTimeout(() => {
        autoDeactivatePastJobs();
        displayJobs();
        // schedule next 24h checks
        setInterval(() => {
            autoDeactivatePastJobs();
            displayJobs();
        }, 24 * 60 * 60 * 1000);
    }, ms);
}
