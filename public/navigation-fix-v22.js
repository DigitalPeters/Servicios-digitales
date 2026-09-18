/*
 * PETERS V2.2 - Navegacion robusta de modulos administrativos
 * Corrige accesos que abren /admin pero dejan la vista en el primer panel (Usuarios).
 * No cambia permisos ni endpoints.
 */
(function(){
  'use strict';

  function adminSectionReady(){
    return typeof isAnyAdminUserPanel === 'function' && isAnyAdminUserPanel();
  }

  function scrollToPanelReliable(id){
    const el=document.getElementById(id);
    if(!el) return false;

    // El panel puede haber sido ocultado/creado por applyRentedAdminLayout.
    if(el.classList.contains('hidden') || getComputedStyle(el).display==='none'){
      if(typeof applyRentedAdminLayout==='function') applyRentedAdminLayout();
    }

    const target=document.getElementById(id);
    if(!target) return false;

    const main=document.querySelector('.main');
    const scroller=document.getElementById('main-content') || document.getElementById('appSection');
    const topbar=document.querySelector('.topbar-clean');
    const offset=(topbar?.getBoundingClientRect?.().height || 0) + 14;

    // Primero scroll del contenedor si realmente es scrollable.
    if(scroller && scroller.scrollHeight > scroller.clientHeight){
      const sr=scroller.getBoundingClientRect();
      const tr=target.getBoundingClientRect();
      scroller.scrollTop += (tr.top - sr.top) - offset;
    }

    // Luego el documento/viewport. scrollIntoView sirve como respaldo cuando
    // el navegador está desplazando el body y no un contenedor interno.
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const current= document.getElementById(id);
        if(!current) return;
        try{
          current.scrollIntoView({behavior:'auto', block:'start', inline:'nearest'});
        }catch(_){ current.scrollIntoView(); }
        try{
          window.scrollBy(0, -offset);
        }catch(_){ }
      });
    });
    return true;
  }

  // Reemplazo final: todos los accesos internos del panel pasan primero por
  // showSection('admin') y después ubican el panel solicitado.
  window.scrollToAdmin=function(id){
    if(!adminSectionReady()){
      if(typeof showSection==='function') showSection('dashboard');
      return false;
    }

    if(typeof showSection==='function') showSection('admin');
    if(typeof applyRentedAdminLayout==='function') applyRentedAdminLayout();

    // Carga datos cuando corresponde, sin bloquear la navegación.
    if(id==='adminOrdersPanel' && typeof loadAdminOrders==='function') loadAdminOrders(1);
    if(id==='adminPlatformAccountsPanel' && typeof loadPlatformInventory==='function') loadPlatformInventory(1);
    if(id==='adminAccountReportsPanel' && typeof loadAccountReports==='function') loadAccountReports(1);
    if(id==='adminBalanceRequestsPanel' && typeof loadBalanceRequests==='function') loadBalanceRequests(1);

    let tries=0;
    const locate=()=>{
      tries++;
      if(scrollToPanelReliable(id)) return;
      if(tries<8) setTimeout(locate,100);
    };
    setTimeout(locate,30);
    return true;
  };

  // Acceso directo a reportes de falla: siempre abre el módulo correcto.
  window.openAccountReportsFromDashboard=function(){
    if(adminSectionReady()) return window.scrollToAdmin('adminAccountReportsPanel');
    if(typeof showSection==='function') return showSection('reports');
    return false;
  };

  // Ventas: mismo patrón de navegación.
  window.openSalesReport=function(){
    if(!adminSectionReady()) return false;
    window.scrollToAdmin('adminSalesReportPanel');
    return true;
  };

  // Evita que botones con data-section sean afectados por manejadores antiguos.
  document.addEventListener('click',function(ev){
    const btn=ev.target?.closest?.('.menu-btn[data-section]');
    if(!btn) return;
    const section=btn.getAttribute('data-section');
    if(!section || typeof window.showSection!=='function') return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    window.showSection(section);
  },true);

  window.__PETERS_NAV_V22=true;
})();
