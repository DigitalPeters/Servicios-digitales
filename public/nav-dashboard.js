function showAuth(type) {
  document.getElementById('loginForm').classList.toggle('hidden', type !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', type !== 'register');
  document.getElementById('loginTab').classList.toggle('active', type === 'login');
  document.getElementById('registerTab').classList.toggle('active', type === 'register');
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
