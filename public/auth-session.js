async function api(path, opt = {}) {
  const headers = opt.headers || {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (!(opt.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, { ...opt, headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detailed =
      (Array.isArray(d.errors) && d.errors.length ? d.errors.join(' | ') : '') ||
      (typeof d.error === 'string' && d.error) ||
      `Error HTTP ${r.status}`;
    throw new Error(detailed);
  }
  return d;
}

async function register() {
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({
        name: registerName.value,
        email: registerEmail.value,
        password: registerPassword.value
      })
    });
    token = data.token;
    localStorage.setItem('token', token);
    showMessage(data.message || 'Cuenta creada');
    await loadApp();
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

async function login() {
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value
      })
    });
    token = data.token;
    localStorage.setItem('token', token);
    showMessage('Sesión iniciada');
    await loadApp();
  } catch (e) {
    showMessage(e.message, 'error');
  }
}

function logout() {
  localStorage.removeItem('token');
  token = null;
  currentUser = null;
  document.documentElement.classList.remove('session-token-present');
  document.getElementById('authSection').classList.remove('hidden');
  document.getElementById('appSection').classList.add('hidden');
  showMessage('Sesión cerrada');
}

async function loadApp() {
  if (!token) return;

  // Solo una sesión nueva debe abrir el dashboard. Las recargas de datos internas
  // no deben sacar al usuario de la sección que está consultando.
  const shouldOpenDashboard = !currentUser;
  try {
    currentUser = await api('/api/me');
  } catch (e) {
    console.error('Sesion invalida al consultar /api/me:', e);
    logout();
    return;
  }

  try {
    if (typeof applyDashboardRoleVisibilityMatrix === 'function') {
      applyDashboardRoleVisibilityMatrix();
    }

    document.documentElement.classList.remove('session-token-present');
    document.getElementById('authSection')?.classList.add('hidden');
    document.getElementById('appSection')?.classList.remove('hidden');

    userName.textContent = currentUser.name;
    userEmail.textContent = currentUser.email;
    userRole.textContent = currentUser.role;
    userBalance.textContent = formatMoney(currentUser.balance);
    sideEmail.textContent = currentUser.email;
    topUserName.textContent = currentUser.name;
    topUserBalance.textContent = formatMoney(currentUser.balance);
    statUsers.textContent = '0';

    const btnHistorial = document.getElementById('btnHistorialId');
    if (btnHistorial) {
      btnHistorial.onclick = function () {
        if (typeof window.abrirModalHistorial === 'function') {
          window.abrirModalHistorial();
        }
      };
    }

    // La navegación inicial ocurre antes de las consultas pesadas. Así, si el
    // usuario abre otra sección mientras cargan los datos, loadApp no lo devuelve
    // al dashboard cuando esas consultas terminan.
    if (shouldOpenDashboard && typeof showSection === 'function') {
      showSection('dashboard');
    }

    await Promise.allSettled([
      typeof loadProducts === 'function' ? loadProducts() : Promise.resolve(),
      typeof loadMyOrders === 'function' ? loadMyOrders() : Promise.resolve(),
      typeof loadBalanceRequests === 'function' ? loadBalanceRequests() : Promise.resolve()
    ]);

    if (currentUser.role === 'admin') {
      if (typeof setTodaySalesDate === 'function') setTodaySalesDate();
      await Promise.allSettled([
        typeof loadUsers === 'function' ? loadUsers() : Promise.resolve(),
        typeof loadAdminProducts === 'function' ? loadAdminProducts() : Promise.resolve(),
        typeof loadAdminOrders === 'function' ? loadAdminOrders() : Promise.resolve(),
        typeof loadSalesReport === 'function' ? loadSalesReport() : Promise.resolve(),
        typeof loadPlatformInventory === 'function' ? loadPlatformInventory() : Promise.resolve(),
        typeof loadExpiringCount === 'function' ? loadExpiringCount() : Promise.resolve(),
        typeof loadAccountReports === 'function' ? loadAccountReports() : Promise.resolve()
      ]);
    }

  } catch (e) {
    console.error('Error inicializando panel (sesion preservada):', e);
    showMessage('Se inicio sesion, pero hubo un error cargando algunos paneles.', 'error');
  }
}

// Iniciar la sesión una sola vez, después de que app.js y los demás módulos
// hayan terminado de registrar sus funciones y hooks.
let __initialSessionBootStarted = false;
function startInitialSessionBoot() {
  if (__initialSessionBootStarted || !token) return;
  __initialSessionBootStarted = true;
  const loader = typeof window.loadApp === 'function' ? window.loadApp : loadApp;
  Promise.resolve(loader()).catch(error => {
    console.error('Error en el arranque inicial de sesión:', error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startInitialSessionBoot, { once: true });
} else {
  setTimeout(startInitialSessionBoot, 0);
}
