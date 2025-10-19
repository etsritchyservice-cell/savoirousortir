// ========== MODALE AUTH ==========
const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const userInfo = document.getElementById("user-info");
const userLogged = document.getElementById("user-logged");
const userNameDisplay = document.getElementById("userNameDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const authForms = document.getElementById("authForms");
let currentUser = null;

// Ouvre le formulaire de connexion
loginBtn.onclick = () => showAuthForm("login");
// Ouvre le formulaire d'inscription
registerBtn.onclick = () => showAuthForm("register");

// Ferme la modale
closeModal.onclick = () => {
  authModal.style.display = "none";
  authForms.innerHTML = "";
};

// Affiche le formulaire approprié
function showAuthForm(type, message = "") {
  authModal.style.display = "flex";
  let msgHtml = message ? `<div class="auth-message">${message}</div>` : "";
  if (type === "login") {
    authForms.innerHTML = `
      <h3>Connexion</h3>
      ${msgHtml}
      <form id="loginForm">
        <input type="email" name="email" placeholder="Email" required>
        <input type="password" name="password" placeholder="Mot de passe" required>
        <button type="submit">Se connecter</button>
      </form>
      <p>Pas encore inscrit ? <a href="#" id="goRegister">Créez un compte</a></p>
    `;
    document.getElementById("goRegister").onclick = (e) => {
      e.preventDefault();
      showAuthForm("register");
    };
    document.getElementById("loginForm").onsubmit = handleLogin;
  } else if (type === "register") {
    authForms.innerHTML = `
      <h3>Inscription</h3>
      ${msgHtml}
      <form id="registerForm">
        <input type="text" name="firstname" placeholder="Prénom" required>
        <input type="text" name="lastname" placeholder="Nom" required>
        <input type="email" name="email" placeholder="Email" required>
        <input type="password" name="password" placeholder="Mot de passe" required>
        <button type="submit">S'inscrire</button>
      </form>
      <p>Déjà inscrit ? <a href="#" id="goLogin">Connectez-vous</a></p>
    `;
    document.getElementById("goLogin").onclick = (e) => {
      e.preventDefault();
      showAuthForm("login");
    };
    document.getElementById("registerForm").onsubmit = handleRegister;
  }
}

// ========== GESTION AUTHENTIFICATION ==========
function handleRegister(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        showAuthForm("login", "Inscription réussie ! Connectez-vous.");
      } else {
        showAuthForm("register", res.error || "Erreur lors de l'inscription.");
      }
    });
}

function handleLogin(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        currentUser = res.user;
        userLogged.style.display = "";
        userInfo.style.display = "none";
        userNameDisplay.textContent = `${currentUser.firstname} ${currentUser.lastname}`;
        document.getElementById("dashUserName").textContent = currentUser.firstname;
        document.getElementById("user-dashboard").style.display = "";
        authModal.style.display = "none";
        showMyEvents();
      } else {
        showAuthForm("login", res.error || "Erreur de connexion.");
      }
    });
}

// Déconnexion
logoutBtn.onclick = () => {
  currentUser = null;
  userLogged.style.display = "none";
  userInfo.style.display = "";
  document.getElementById("user-dashboard").style.display = "none";
};

// ========== TABLEAU DE BORD UTILISATEUR ==========
const btnNewEvent = document.getElementById("btnNewEvent");
const eventForm = document.getElementById("eventForm");
const myEventsDiv = document.getElementById("myEvents");

if (btnNewEvent) {
  btnNewEvent.onclick = () => {
    eventForm.style.display = eventForm.style.display === "none" ? "" : "none";
  };
}

if (eventForm) {
  eventForm.onsubmit = function(e) {
    e.preventDefault();
    if (!currentUser) return showAuthForm("login", "Connectez-vous pour publier !");
    const data = Object.fromEntries(new FormData(eventForm));
    data.user_id = currentUser.id;
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          eventForm.reset();
          eventForm.style.display = "none";
          showMyEvents();
          showEvents();
        } else {
          alert(res.error || "Erreur lors de la publication.");
        }
      });
  };
}

// Affiche les événements de l'utilisateur
function showMyEvents() {
  fetch("/api/events")
    .then(r => r.json())
    .then(events => {
      const myEvts = events.filter(e => currentUser && e.user_id === currentUser.id);
      myEventsDiv.innerHTML = myEvts.length
        ? myEvts.map(e => `
          <div class="event-card">
            <h4>${e.title}</h4>
            <p>${e.description || ""}</p>
            <p><small>${e.date} • ${e.place} • ${e.category || ""}</small></p>
            <button onclick="deleteEvent(${e.id})">Supprimer</button>
          </div>
        `).join("")
        : "<p>Vous n'avez pas encore publié d'événement.</p>";
    });
}

// Supprimer événement
window.deleteEvent = function(id) {
  if (!confirm("Supprimer cet événement ?")) return;
  fetch("/api/events/" + id, { method: "DELETE" })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        showMyEvents();
        showEvents();
      }
    });
};

// ========== AFFICHAGE DES ÉVÉNEMENTS PUBLICS ==========
const eventsContainer = document.getElementById("eventsContainer");
function showEvents() {
  fetch("/api/events")
    .then(r => r.json())
    .then(events => {
      if (!eventsContainer) return;
      // On sépare les événements à venir et passés (par date)
      const now = new Date().toISOString().split("T")[0];
      const upcoming = events.filter(e => e.date >= now);
      eventsContainer.innerHTML = upcoming.length
        ? upcoming.map(e => `
          <div class="event-card">
            <h4>${e.title}</h4>
            <p>${e.description || ""}</p>
            <p><small>${e.date} • ${e.place} • ${e.category || ""}</small></p>
            <span>Publié par ${e.author || "Anonyme"}</span>
          </div>
        `).join("")
        : "<p>Aucun événement à venir pour le moment.</p>";
    });
}
showEvents();

// ========== RECHERCHE D'ÉVÉNEMENTS ==========
const searchForm = document.getElementById("searchEventsForm");
if (searchForm) {
  searchForm.onsubmit = function(e) {
    e.preventDefault();
    const q = searchForm.q.value.toLowerCase();
    fetch("/api/events")
      .then(r => r.json())
      .then(events => {
        const filtered = events.filter(e =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.place && e.place.toLowerCase().includes(q)) ||
          (e.category && e.category.toLowerCase().includes(q))
        );
        eventsContainer.innerHTML = filtered.length
          ? filtered.map(e => `
            <div class="event-card">
              <h4>${e.title}</h4>
              <p>${e.description || ""}</p>
              <p><small>${e.date} • ${e.place} • ${e.category || ""}</small></p>
              <span>Publié par ${e.author || "Anonyme"}</span>
            </div>
          `).join("")
          : "<p>Aucun événement trouvé.</p>";
      });
  };
}

// ========== MENU RESPONSIVE ==========
const hamburgerBtn = document.getElementById("hamburger-btn");
const navLinks = document.getElementById("nav-links");
if (hamburgerBtn && navLinks) {
  hamburgerBtn.onclick = () => {
    if (navLinks.style.display === "flex" || navLinks.style.display === "") {
      navLinks.style.display = "none";
    } else {
      navLinks.style.display = "flex";
    }
  };
}

// ========== FERMETURE MODALE AU CLIC EXTERIEUR ==========
window.onclick = function(event) {
  if (event.target === authModal) {
    authModal.style.display = "none";
    authForms.innerHTML = "";
  }
};