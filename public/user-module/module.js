/* module.js
  Version locale (localStorage)
  Fournit: inscription, connexion, dashboard (création/modif/suppression d'événements)
*/

const STORAGE_KEYS = {
  USERS: 'ms_users_v1',
  EVENTS: 'ms_events_v1',
  CURRENT: 'ms_current_v1'
};

/* ----------------- Utils ----------------- */
function readJSON(key, fallback){
  try{
    const v = localStorage.getItem(key);
    if(!v) return fallback ?? null;
    return JSON.parse(v);
  } catch(e){ return fallback ?? null; }
}
function writeJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function uid(prefix='id'){
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
}
function notify(msg){
  alert(msg);
}

/* --------- password hashing (SHA-256) --------- */
async function sha256Hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  // convert to hex
  const h = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return h;
}

/* ----------------- User management ----------------- */
function getUsers(){ return readJSON(STORAGE_KEYS.USERS, []); }
function saveUsers(users){ writeJSON(STORAGE_KEYS.USERS, users); }

function getEvents(){ return readJSON(STORAGE_KEYS.EVENTS, []); }
function saveEvents(events){ writeJSON(STORAGE_KEYS.EVENTS, events); }

function setCurrent(email){
  localStorage.setItem(STORAGE_KEYS.CURRENT, email);
}
function getCurrent(){ return localStorage.getItem(STORAGE_KEYS.CURRENT); }
function clearCurrent(){ localStorage.removeItem(STORAGE_KEYS.CURRENT); }

async function createUser({firstname, lastname, email, phone, password, role='user', establishment=null}){
  const users = getUsers();
  if(users.find(u=>u.email.toLowerCase()===email.toLowerCase())){
    throw new Error('Un compte avec cet email existe déjà.');
  }
  const passHash = await sha256Hex(password);
  const user = {
    id: uid('user'),
    firstname, lastname, email: email.toLowerCase(), phone: phone||'', passHash,
    role,
    establishment: establishment || null,
    createdAt: (new Date()).toISOString()
  };
  users.push(user);
  saveUsers(users);
  return user;
}

async function authenticate(email, password){
  const users = getUsers();
  const u = users.find(x=>x.email.toLowerCase()===email.toLowerCase());
  if(!u) return null;
  const h = await sha256Hex(password);
  if(h === u.passHash) return u;
  return null;
}

/* ----------------- Seeding admin convenience (dev) ----------------- */
async function seedAdmin(){
  try{
    const users = getUsers();
    if(users.find(u=>u.role==='admin')) return; // already present
    await createUser({
      firstname:'Admin',
      lastname:'Local',
      email:'admin@monsite.local',
      phone:'',
      password:'admin1234',
      role:'admin',
      establishment:null
    });
    console.log('Admin créé : admin@monsite.local / admin1234');
    notify('Compte admin créé : admin@monsite.local / admin1234');
  }catch(e){ console.error(e); }
}

/* ----------------- Page initializers ----------------- */

/* Register page */
function initRegister(){
  const form = document.getElementById('registerForm');
  const seedBtn = document.getElementById('seedAdminBtn');
  seedBtn?.addEventListener('click', async ()=>{
    await seedAdmin();
  });

  form?.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(form);
    const firstname = fd.get('firstname').trim();
    const lastname = fd.get('lastname').trim();
    const email = fd.get('email').trim();
    const phone = fd.get('phone').trim();
    const password = fd.get('password');
    const password2 = fd.get('password2');

    if(!firstname || !lastname || !email || !password) {
      notify('Remplis les champs obligatoires.');
      return;
    }
    if(password !== password2){
      notify('Les mots de passe ne correspondent pas.');
      return;
    }
    if(password.length < 8){
      notify('Mot de passe trop court (>=8 caractères).');
      return;
    }

    const est = (fd.get('est_name') || '').trim() ? {
      name: fd.get('est_name').trim(),
      type: fd.get('est_type') || '',
      address: fd.get('est_address') || '',
      siret: fd.get('est_siret') || ''
    } : null;

    try{
      const user = await createUser({
        firstname, lastname, email, phone,
        password, role: 'user', establishment: est
      });
      setCurrent(user.email);
      notify('Inscription réussie — redirection vers le tableau de bord.');
      window.location.href = 'dashboard.html';
    }catch(err){
      notify(err.message || 'Erreur lors de la création du compte.');
    }
  });
}

/* Login page */
function initLogin(){
  const form = document.getElementById('loginForm');
  const guestBtn = document.getElementById('guestBtn');

  guestBtn?.addEventListener('click', async ()=>{
    // create a temporary guest user (or reuse)
    const email = 'guest@local';
    let users = getUsers();
    let guest = users.find(u=>u.email===email);
    if(!guest){
      guest = {
        id: uid('user'),
        firstname: 'Invité',
        lastname: '',
        email,
        phone:'',
        passHash: '', // no password
        role: 'user',
        establishment: null,
        createdAt: (new Date()).toISOString()
      };
      users.push(guest);
      saveUsers(users);
    }
    setCurrent(guest.email);
    window.location.href = 'dashboard.html';
  });

  form?.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(form);
    const email = (fd.get('email')||'').trim();
    const password = fd.get('password')||'';
    if(!email || !password){
      notify('Email et mot de passe requis.');
      return;
    }
    const u = await authenticate(email, password);
    if(!u){
      notify('Email ou mot de passe incorrect.');
      return;
    }
    setCurrent(u.email);
    window.location.href = 'dashboard.html';
  });
}

/* Dashboard page (main complexity) */
function initDashboard(){
  const main = document.getElementById('mainArea');
  const logoutBtn = document.getElementById('logoutBtn');
  const currentEmail = getCurrent();
  if(!currentEmail){
    // redirect to login
    window.location.href = 'login.html';
    return;
  }
  const users = getUsers();
  const user = users.find(u=>u.email===currentEmail);
  if(!user){
    clearCurrent();
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('userBadge').innerText = `${user.firstname} ${user.lastname} • ${user.role === 'admin' ? 'Administrateur' : (user.establishment?.name || 'Utilisateur')}`;

  logoutBtn?.addEventListener('click', ()=>{
    clearCurrent();
    window.location.href = 'login.html';
  });

  // render dashboard UI
  main.innerHTML = `
    <div class="card">
      <h3>Ton profil</h3>
      <p><strong>${user.firstname} ${user.lastname}</strong> — ${user.email}</p>
      <p class="small">Établissement: ${user.establishment ? user.establishment.name + ' — ' + (user.establishment.address||'') : 'Aucun'}</p>
      <div style="margin-top:10px;">
        <button class="btn" id="editProfileBtn">Modifier profil</button>
        ${user.role === 'admin' ? '<button class="btn secondary" id="openAdminBtn">Panneau admin</button>' : ''}
      </div>
    </div>

    <div class="card" id="createEventCard">
      <h3>Déposer une annonce d'événement</h3>
      <form id="eventForm">
        <div class="row">
          <div class="col"><label>Titre</label><input name="title" required></div>
          <div class="col"><label>Date</label><input name="date" type="date" required></div>
        </div>
        <div class="row">
          <div class="col"><label>Heure</label><input name="time" type="text" placeholder="18:30"></div>
          <div class="col"><label>Catégorie</label><input name="category" placeholder="Musique, Conférence..."></div>
        </div>
        <div class="row">
          <div class="col"><label>Lieu</label><input name="place" required></div>
          <div class="col"><label>Lien billetterie (optionnel)</label><input name="link" type="text"></div>
        </div>
        <div style="margin-top:8px;margin-bottom:8px;">
          <label>Affiche / image (optionnel)</label>
          <input type="file" name="image" accept="image/*">
        </div>
        <div>
          <label>Description</label>
          <textarea name="description"></textarea>
        </div>
        <div style="margin-top:10px;">
          <button class="btn" type="submit">Publier l'événement</button>
        </div>
      </form>
    </div>

    <div class="card">
      <h3>Mes événements</h3>
      <div id="myEventsWrap"></div>
    </div>

    <div class="card" id="siteAdminCard" style="display:none;">
      <h3>Administration (super-utilisateur)</h3>
      <div id="adminArea"></div>
    </div>
  `;

  // event handlers
  const eventForm = document.getElementById('eventForm');
  eventForm.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(eventForm);
    const title = (fd.get('title')||'').trim();
    const date = fd.get('date') || '';
    const time = (fd.get('time')||'').trim();
    const category = (fd.get('category')||'').trim();
    const place = (fd.get('place')||'').trim();
    const link = (fd.get('link')||'').trim();
    const description = (fd.get('description')||'').trim();
    const file = fd.get('image');

    if(!title || !date || !place){
      notify('Titre, date et lieu requis.');
      return;
    }

    // handle image file -> DataURL
    if(file && file.size){
      const reader = new FileReader();
      reader.onload = function(e){
        const dataUrl = e.target.result;
        saveNewEvent({title,date,time,category,place,link,description,image:dataUrl});
        eventForm.reset();
      };
      reader.readAsDataURL(file);
    } else {
      saveNewEvent({title,date,time,category,place,link,description,image:null});
      eventForm.reset();
    }
  });

  function saveNewEvent(evData){
    const events = getEvents();
    const newEv = {
      id: uid('ev'),
      ownerEmail: user.email,
      title: evData.title,
      date: evData.date,
      time: evData.time,
      category: evData.category,
      place: evData.place,
      link: evData.link,
      description: evData.description,
      image: evData.image,
      createdAt: (new Date()).toISOString()
    };
    events.push(newEv);
    saveEvents(events);
    renderMyEvents();
    notify('Événement publié.');
  }

  // edit profile
  document.getElementById('editProfileBtn')?.addEventListener('click', ()=>{
    // simple prompt-based edit for local use
    const newFirst = prompt('Prénom', user.firstname) || user.firstname;
    const newLast = prompt('Nom', user.lastname) || user.lastname;
    const users = getUsers();
    const idx = users.findIndex(x=>x.email===user.email);
    if(idx>=0){
      users[idx].firstname = newFirst;
      users[idx].lastname = newLast;
      saveUsers(users);
      notify('Profil mis à jour. Recharge la page.');
      window.location.reload();
    }
  });

  // admin
  if(user.role === 'admin'){
    document.getElementById('siteAdminCard').style.display='block';
    document.getElementById('openAdminBtn')?.addEventListener('click', ()=>{
      renderAdminArea();
    });
    // also render by default
    renderAdminArea();
  }

  // render events list
  function renderMyEvents(){
    const wrap = document.getElementById('myEventsWrap');
    const events = getEvents().filter(e=>e.ownerEmail === user.email).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    if(events.length === 0){
      wrap.innerHTML = '<p class="small">Aucun événement publié pour le moment.</p>';
      return;
    }
    const html = events.map(ev=>`
      <div class="event-item" data-id="${ev.id}">
        <img class="event-thumb" src="${ev.image || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2270%22><rect width=%22120%22 height=%2270%22 fill=%22%23eee%22/><text x=%2260%22 y=%2240%22 font-size=%2210%22 text-anchor=%22middle%22 fill=%22%23999%22>Pas d\'image</text></svg>'}" alt="affiche">
        <div class="event-main">
          <strong>${escapeHtml(ev.title)}</strong>
          <div class="small">${ev.date} ${ev.time ? '• ' + ev.time : ''} • ${ev.place} ${ev.category ? ' • ' + ev.category : ''}</div>
          <div style="margin-top:8px;font-size:0.95rem;color:var(--muted)">${escapeHtml(ev.description || '')}</div>
        </div>
        <div class="event-actions">
          <button class="small" data-act="edit" data-id="${ev.id}">Modifier</button>
          <button class="small" data-act="delete" data-id="${ev.id}">Supprimer</button>
          ${ev.link ? `<a class="small help-link" href="${ev.link}" target="_blank">Billets</a>` : ''}
        </div>
      </div>
    `).join('');
    wrap.innerHTML = `<div class="event-list">${html}</div>`;

    // wire edit/delete
    wrap.querySelectorAll('[data-act="delete"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = e.currentTarget.dataset.id;
        if(confirm('Supprimer cet événement ?')) {
          let events = getEvents();
          events = events.filter(x=>x.id!==id);
          saveEvents(events);
          renderMyEvents();
        }
      });
    });
    wrap.querySelectorAll('[data-act="edit"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = e.currentTarget.dataset.id;
        editEventForm(id);
      });
    });
  }

  function editEventForm(id){
    const events = getEvents();
    const ev = events.find(x=>x.id===id);
    if(!ev){ notify('Événement introuvable'); return; }
    // simple prompt-based editing (quick)
    const newTitle = prompt('Titre', ev.title) || ev.title;
    const newDate = prompt('Date (YYYY-MM-DD)', ev.date) || ev.date;
    const newTime = prompt('Heure', ev.time) || ev.time;
    const newPlace = prompt('Lieu', ev.place) || ev.place;
    const newDesc = prompt('Description', ev.description) || ev.description;
    ev.title = newTitle; ev.date = newDate; ev.time = newTime; ev.place = newPlace; ev.description = newDesc;
    saveEvents(events);
    renderMyEvents();
    notify('Événement mis à jour.');
  }

  renderMyEvents();

  /* ---------------- Admin area (basic) ---------------- */
  function renderAdminArea(){
    const adminArea = document.getElementById('adminArea');
    const users = getUsers();
    const events = getEvents();

    adminArea.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:260px;">
          <h4>Utilisateurs (${users.length})</h4>
          <div style="max-height:260px;overflow:auto;border:1px solid #eee;padding:8px;border-radius:8px;background:#fff;">
            ${users.map(u=>`<div style="padding:8px;border-bottom:1px dashed #eee;">
              <strong>${escapeHtml(u.firstname+' '+u.lastname)}</strong><br>
              <span class="small">${u.email} — ${u.role}</span>
              <div style="margin-top:6px;">
                <button class="small" data-admin-act="impersonate" data-email="${u.email}">Se connecter en tant que</button>
                <button class="small" data-admin-act="deleteUser" data-email="${u.email}">Supprimer</button>
              </div>
            </div>`).join('')}
          </div>
        </div>

        <div style="flex:1;min-width:260px;">
          <h4>Événements (${events.length})</h4>
          <div style="max-height:260px;overflow:auto;border:1px solid #eee;padding:8px;border-radius:8px;background:#fff;">
            ${events.map(ev=>`<div style="padding:8px;border-bottom:1px dashed #eee;">
              <strong>${escapeHtml(ev.title)}</strong><br>
              <span class="small">${ev.date} • ${escapeHtml(ev.place)} • ${escapeHtml(ev.ownerEmail)}</span>
              <div style="margin-top:6px;">
                <button class="small" data-admin-act="deleteEvent" data-id="${ev.id}">Supprimer</button>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>
    `;

    adminArea.querySelectorAll('[data-admin-act="impersonate"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const email = e.currentTarget.dataset.email;
        if(confirm(`Se connecter en tant que ${email} ?`)){
          setCurrent(email);
          window.location.reload();
        }
      });
    });
    adminArea.querySelectorAll('[data-admin-act="deleteUser"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const email = e.currentTarget.dataset.email;
        if(confirm(`Supprimer l'utilisateur ${email} ?`)){
          let users = getUsers();
          users = users.filter(u=>u.email!==email);
          saveUsers(users);
          // remove events by user
          let events = getEvents();
          events = events.filter(ev=>ev.ownerEmail !== email);
          saveEvents(events);
          renderAdminArea();
        }
      });
    });
    adminArea.querySelectorAll('[data-admin-act="deleteEvent"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = e.currentTarget.dataset.id;
        if(confirm('Supprimer cet événement ?')){
          let events = getEvents();
          events = events.filter(ev=>ev.id!==id);
          saveEvents(events);
          renderAdminArea();
        }
      });
    });
  }

  /* small helper */
  function escapeHtml(s){
    if(!s) return '';
    return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; });
  }
}

/* ----------------- Expose for pages ----------------- */
window.initRegister = initRegister;
window.initLogin = initLogin;
window.initDashboard = initDashboard;
window.seedAdmin = seedAdmin;
