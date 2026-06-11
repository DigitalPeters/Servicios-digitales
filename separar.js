const fs = require('fs');

try {
  // 1. LEER EL ARCHIVO ACTUAL
  let html = fs.readFileSync('public/index.html', 'utf8');

  // 2. MODIFICAR EL CONTENEDOR DE GRÁFICAS (PASO B CORREGIDO PARA DOS GRÁFICAS)
  const bloqueGraficasViejo = /<div id="dashboardChartsPanel" class="row hidden">[\s\S]*?<\/div>\s*<\/div>/;
  
  const bloqueGraficasNuevo = `        <div id="dashboardChartsPanel" class="row hidden" style="gap: 16px;">
          <div class="panel dashboard-chart-card" style="flex: 1; min-width: 280px;">
            <div class="panel-head">
              <div><h2>Resumen de Ventas</h2><p class="chart-note">Ventas semanales.</p></div>
            </div>
            <canvas id="graficaVentas"></canvas>
          </div>
          <div class="panel dashboard-chart-card" style="flex: 1; min-width: 280px;">
            <div class="panel-head">
              <div><h2>Usuarios TOP</h2><p class="chart-note">Ranking de mejores vendedores.</p></div>
            </div>
            <canvas id="graficaUsuarios"></canvas>
          </div>
        </div>`;

  html = html.replace(bloqueGraficasViejo, bloqueGraficasNuevo);

  // 3. INYECTAR EL BOTÓN DE MODO OSCURO EN LA BARRA SUPERIOR
  html = html.replace('<b id="topUserName">Usuario</b>', '<b id="topUserName">Usuario</b><button id="theme-toggle" style="background:none;font-size:20px;padding:0 8px;margin-left:10px;" onclick="toggleDarkMode()">🌙</button>');

  // 4. INYECTAR EL MENÚ DE NAVEGACIÓN INFERIOR PARA CELULARES
  if (!html.includes('class="mobile-nav"')) {
    const menuInferiorHTML = `
    <div class="mobile-nav">
      <div class="mobile-nav-item" onclick="showSection('shop')"><span>🛒</span><small>Tienda</small></div>
      <div class="mobile-nav-item" onclick="showSection('orders')"><span>📦</span><small>Pedidos</small></div>
      <div class="mobile-nav-item" onclick="showSection('reports')"><span>⚠</span><small>Fallas</small></div>
      <div class="mobile-nav-item admin-only" onclick="showSection('dashboard')"><span>📊</span><small>Panel</small></div>
    </div>
    </body>`;
    html = html.replace('</body>', menuInferiorHTML);
  }

  fs.writeFileSync('public/index.html', html);
  console.log("✅ index.html actualizado con las nuevas estructuras visuales.");

  // 5. AGREGAR ESTILOS PARA EL MENÚ MÓVIL Y MODO OSCURO EN STYLES.CSS
  let css = fs.readFileSync('public/styles.css', 'utf8');
  
  if (!css.includes('.mobile-nav')) {
    const nuevosEstilos = `
/* MODO OSCURO */
body.dark-mode {
  --bg: #0f172a;
  --card: #1e293b;
  --text: #f8fafc;
  --border: #334155;
  --soft: #1e1b4b;
}
body.dark-mode .panel, body.dark-mode .dash-card, body.dark-mode .sidebar {
  background: var(--card);
  color: var(--text);
  border-color: var(--border);
}
body.dark-mode input, body.dark-mode select, body.dark-mode textarea {
  background: #1e293b;
  color: #f8fafc;
  border-color: #334155;
}

/* MENÚ INFERIOR MÓVIL */
.mobile-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card);
  border-top: 1px solid var(--border);
  height: 60px;
  justify-content: space-around;
  align-items: center;
  z-index: 999;
  box-shadow: 0 -4px 10px rgba(0,0,0,0.05);
}
.mobile-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.mobile-nav-item span {
  font-size: 20px;
}
@media (max-width: 768px) {
  .sidebar { display: none !important; }
  .app-layout { display: block !important; padding-bottom: 70px !important; }
  .mobile-nav { display: flex; }
}
`;
    fs.writeFileSync('public/styles.css', css + nuevosEstilos);
    console.log("🎨 styles.css actualizado con estilos de modo oscuro y menú móvil.");
  }

} catch (error) {
  console.error("❌ Error:", error.message);
}