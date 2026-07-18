function showAuth(type) {
  const isLogin = type === 'login';
  document.getElementById('loginForm')?.classList.toggle('hidden', !isLogin);
  document.getElementById('registerForm')?.classList.toggle('hidden', isLogin);

  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  loginTab?.classList.toggle('active', isLogin);
  registerTab?.classList.toggle('active', !isLogin);
  loginTab?.setAttribute('aria-selected', String(isLogin));
  registerTab?.setAttribute('aria-selected', String(!isLogin));

  setTimeout(() => {
    document.getElementById(isLogin ? 'loginEmail' : 'registerName')?.focus();
  }, 40);
}

function toggleAuthPassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  if (button) {
    button.textContent = show ? 'Ocultar' : 'Ver';
    button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('show');
}

function cambiarSeccion(name) {
  const key = String(name || '').toLowerCase().trim();
  const map = {
    dashboard: 'dashboard',
    inicio: 'dashboard',
    'mi-cuenta': 'account',
    micuenta: 'account',
    cuenta: 'account',
    tienda: 'shop',
    pedidos: 'orders',
    saldo: 'balance',
    reportes: 'reports'
  };
  showSection(map[key] || name);
}

function goHomeHardReload() {
  // Conservamos el nombre para no cambiar el HTML existente, pero Inicio ya no
  // recarga la página ni vuelve a mostrar el login. Solo navega al dashboard.
  document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());
  document.body.style.overflow = '';
  document.getElementById('sidebar')?.classList.remove('show');

  if (typeof showSection === 'function') {
    showSection('dashboard');
  }

  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch (e) {
    window.scrollTo(0, 0);
  }

  return false;
}

async function reloadDashboard() {
  if (!currentUser || currentUser.role !== 'admin') return;

  showMessage('Actualizando panel...');

  await Promise.allSettled([
    loadUsers(),
    loadAdminProducts(),
    loadAdminOrders(),
    loadBalanceRequests(),
    loadAccountReports(),
    loadSalesReport(true),
    loadPlatformInventory()
  ]);

  showMessage('Panel actualizado');
}

async function loadExpiringCount() {
  try {
    if (!currentUser || String(currentUser.role || '').toLowerCase() !== 'admin') {
      const renewalsNoAdmin = document.getElementById('count-pedidos_pendientes');
      if (renewalsNoAdmin) renewalsNoAdmin.textContent = '0';
      return;
    }

    const data = await api('/api/alerts/count');
    const renewals = Number(data?.count || 0);
    const renewalsEl = document.getElementById('count-pedidos_pendientes');
    if (renewalsEl) renewalsEl.textContent = String(renewals);

    const expiringCard = document.getElementById('dashExpiringCard');
    if (expiringCard) expiringCard.classList.remove('hidden');
  } catch (e) {
    console.warn('Error cargando contador de renovaciones', e);
  }
}
