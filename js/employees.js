(function(){
  const STORAGE_KEY = 'employees';
  const CLASSIFICATIONS = [
    'APP-1','APP-2','APP-3','APP-4','APP-5','APP-6','JM','FM'
  ];

  function uid(){ return 'emp_' + Math.random().toString(36).slice(2,9); }
  function loadEmployees(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); }catch{ return []; } }
  function saveEmployees(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  function $(sel,root=document){ return root.querySelector(sel); }
  function $all(sel,root=document){ return Array.from(root.querySelectorAll(sel)); }

  // Elements
  const addBtn = document.getElementById('add-employee');
  const modal = document.getElementById('add-employee-modal');
  const backdrop = document.getElementById('modal-backdrop');
  const closeModalBtns = $all('.close-modal, .cancel-modal', modal);
  const createBtn = document.getElementById('create-employee');
  const listEl = document.getElementById('employees-list');
  const classificationNewSelect = document.getElementById('new-employee-classification');
  const classificationEditSelect = document.getElementById('edit-classification');

  const detailPanel = document.getElementById('employee-detail');
  const detailName = document.getElementById('detail-employee-name');
  const closeDetail = document.getElementById('close-detail');
  const saveEmployeeBtn = document.getElementById('save-employee');
  const deleteEmployeeBtn = document.getElementById('delete-employee');
  const contentWrapper = document.querySelector('.content-wrapper');

  // Tab elements
  const tabButtons = $all('.tab-btn');
  const tabContents = $all('.tab-content');

  // Edit fields (Overview + About)
  const editFields = {
    id: null,
    name: document.getElementById('edit-name'),
    classification: classificationEditSelect,
    status: document.getElementById('edit-status'),
    email: document.getElementById('edit-email'),
    phone: document.getElementById('edit-phone'),
    address: document.getElementById('edit-address'),
    emergencyName: document.getElementById('emergency-name'),
    emergencyPhone: document.getElementById('emergency-phone'),
    emergencyRelation: document.getElementById('emergency-relation'),
    cantWorkDays: []
  };

  // Populate classifications
  function populateClassifications(select){
    select.innerHTML = CLASSIFICATIONS.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  populateClassifications(classificationNewSelect);
  populateClassifications(classificationEditSelect);

  // Modal helpers
  function openModal(){
    modal.classList.add('open');
    backdrop.classList.add('open');
  }
  function closeModal(){
    modal.classList.remove('open');
    backdrop.classList.remove('open');
  }

  // Add button opens modal
  addBtn?.addEventListener('click', () => {
    // reset fields
    $('#new-employee-name').value = '';
    $('#new-employee-email').value = '';
    $('#new-employee-phone').value = '';
    $('#new-employee-address').value = '';
    $('#new-employee-status').value = 'active';
    classificationNewSelect.value = CLASSIFICATIONS[0];
    openModal();
  });
  closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));
  backdrop?.addEventListener('click', closeModal);

  function employeeAvatar(name){
    const initials = (name||'').split(/\s+/).map(s=>s[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || '?';
    return `<div class="employee-avatar">${initials}</div>`;
  }

  function renderCard(emp){
    const statusCls = emp.status === 'active' ? 'status-active' : 'status-inactive';
    const classBadgeCls = `classification-${(emp.classification||'').replace(/\s+/g,'-')}`;
    const el = document.createElement('div');
    el.className = 'employee-card';
    el.dataset.id = emp.id;
    el.innerHTML = `
      <div class="employee-header">
        ${employeeAvatar(emp.name)}
        <div class="employee-info">
          <div class="employee-name">${emp.name || 'Unnamed'}</div>
          <span class="employee-status ${statusCls}">${emp.status || 'active'}</span>
        </div>
      </div>
      <div class="classification-badge ${classBadgeCls}">${emp.classification || ''}</div>
      <div class="employee-meta">
        <div><strong>Phone:</strong> ${emp.phone || '-'}</div>
        <div><strong>Email:</strong> ${emp.email || '-'}</div>
        <div><strong>Address:</strong> ${emp.address || '-'}</div>
      </div>
    `;
    el.addEventListener('click', ()=> openDetail(emp.id));
    return el;
  }

  function renderList(){
    const employees = loadEmployees();
    listEl.innerHTML = '';
    employees.forEach(emp => listEl.appendChild(renderCard(emp)));
  }

  function openDetail(id){
    const employees = loadEmployees();
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    editFields.id = emp.id;
    detailName.textContent = emp.name || 'Employee Details';
    editFields.name.value = emp.name || '';
    editFields.classification.value = emp.classification || CLASSIFICATIONS[0];
    editFields.status.value = emp.status || 'active';
    editFields.email.value = emp.email || '';
    editFields.phone.value = emp.phone || '';
    editFields.address.value = emp.address || '';
    editFields.emergencyName.value = emp.emergency?.name || '';
    editFields.emergencyPhone.value = emp.emergency?.phone || '';
    editFields.emergencyRelation.value = emp.emergency?.relation || '';

    // Weekday chips
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    editFields.cantWorkDays = Array.isArray(emp.cantWorkDays) ? emp.cantWorkDays.slice() : [];
    $all('.weekday-btn').forEach(btn => {
      const day = btn.getAttribute('data-day');
      btn.classList.toggle('selected', editFields.cantWorkDays.includes(day));
      btn.onclick = () => {
        const idx = editFields.cantWorkDays.indexOf(day);
        if (idx >= 0) editFields.cantWorkDays.splice(idx,1); else editFields.cantWorkDays.push(day);
        btn.classList.toggle('selected');
      };
    });

    detailPanel.classList.add('open');
    contentWrapper?.classList.add('detail-open');
  }

  function closeDetailPanel(){
    detailPanel.classList.remove('open');
    contentWrapper?.classList.remove('detail-open');
    editFields.id = null;
  }
  closeDetail?.addEventListener('click', closeDetailPanel);

  // Tabs
  tabButtons.forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    tabButtons.forEach(b=>b.classList.toggle('active', b===btn));
    tabContents.forEach(c=>c.classList.toggle('active', c.id === `${tab}-tab`));
  }));

  // Create Employee
  createBtn?.addEventListener('click', () => {
    const name = $('#new-employee-name').value.trim();
    const classification = classificationNewSelect.value;
    const email = $('#new-employee-email').value.trim();
    const phone = $('#new-employee-phone').value.trim();
    const address = $('#new-employee-address').value.trim();
    const status = $('#new-employee-status').value || 'active';

    if (!name) { alert('Name is required'); return; }

    const emp = {
      id: uid(),
      name, classification, email, phone, address, status,
      cantWorkDays: [],
      skills: [],
      certs: [],
      emergency: { name: '', phone: '', relation: '' }
    };

    const employees = loadEmployees();
    employees.unshift(emp);
    saveEmployees(employees);

    closeModal();
    renderList();

    // highlight the new card
    const card = listEl.querySelector(`.employee-card[data-id="${emp.id}"]`);
    if (card) {
      card.classList.add('flash');
      setTimeout(()=> card.classList.remove('flash'), 800);
    }
  });

  // Save changes from detail panel
  saveEmployeeBtn?.addEventListener('click', () => {
    if (!editFields.id) return;
    const employees = loadEmployees();
    const idx = employees.findIndex(e => e.id === editFields.id);
    if (idx < 0) return;
    const e = employees[idx];
    e.name = editFields.name.value.trim() || e.name;
    e.classification = editFields.classification.value;
    e.status = editFields.status.value;
    e.email = editFields.email.value.trim();
    e.phone = editFields.phone.value.trim();
    e.address = editFields.address.value.trim();
    e.emergency = { name: editFields.emergencyName.value.trim(), phone: editFields.emergencyPhone.value.trim(), relation: editFields.emergencyRelation.value.trim() };
    e.cantWorkDays = editFields.cantWorkDays.slice();
    saveEmployees(employees);
    renderList();
    // Keep panel open and update header
    detailName.textContent = e.name || 'Employee Details';
  });

  // Delete employee
  deleteEmployeeBtn?.addEventListener('click', () => {
    if (!editFields.id) return;
    const employees = loadEmployees();
    const idx = employees.findIndex(e => e.id === editFields.id);
    if (idx < 0) return;
    if (!confirm('Delete this employee?')) return;
    employees.splice(idx,1);
    saveEmployees(employees);
    renderList();
    closeDetailPanel();
  });

  // Init filters (classification chips)
  function initFilters(){
    const container = document.getElementById('classification-filters');
    if (!container) return;
    container.innerHTML = '';
    CLASSIFICATIONS.forEach(c => {
      const id = `flt_${c}`;
      const label = document.createElement('label');
      label.className = 'filter-option';
      label.innerHTML = `<input type="checkbox" value="${c}" checked> <span>${c}</span>`;
      container.appendChild(label);
    });

    // Wire filtering
    const statusContainer = document.getElementById('status-filters');
    function applyFilters(){
      const onClasses = $all('#classification-filters input:checked').map(i=>i.value);
      const onStatuses = $all('#status-filters input:checked').map(i=>i.value);
      $all('.employee-card', listEl).forEach(card => {
        const id = card.dataset.id;
        const e = loadEmployees().find(x=>x.id===id);
        const show = (!onClasses.length || onClasses.includes(e.classification)) && (!onStatuses.length || onStatuses.includes(e.status));
        card.style.display = show ? '' : 'none';
      });
    }
    $all('#classification-filters input').forEach(i=> i.addEventListener('change', applyFilters));
    $all('#status-filters input').forEach(i=> i.addEventListener('change', applyFilters));
  }

  // Initial render
  document.addEventListener('DOMContentLoaded', () => {
    renderList();
    initFilters();
  });
})();
