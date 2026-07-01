function renderAdminReportCompactFinal(r){
  console.log("Qué trae el reporte:", r); // Esto te dirá exactamente cómo se llama la fecha
const info=calculateReportRefundInfo(r);
  const canAct=String(r.status||'').toLowerCase()==='pendiente';
  const itemId=`admin-report-compact-${r.id}`;
  return `<div class="item compact-item" id="${itemId}">
    <div class="compact-header" onclick="toggleCompactItemFinal('${itemId}')">
      <div class="compact-title">Reporte #${r.id}</div>
      <div class="compact-meta">${safeText(r.customer_name||'Cliente')} · ${safeText(r.email||'correo reportado')} · ${safeText(r.status||'pendiente')}</div>
    </div>
    <div class="compact-details">
      <p><b>Reporte:</b> #${r.id} <span class="status">${safeText(r.status||'pendiente')}</span></p>
      <p><b>Cliente:</b> ${safeText(r.customer_name||'Cliente')} <span class="small-text">${safeText(r.customer_email||'')}</span></p>
      <p><b>Correo reportado:</b> ${safeText(r.email||'')}</p>
      <p><b>Producto:</b> ${safeText(r.product_name||r.account_product_name||'')} ${r.platform?`<span class="chip">${safeText(r.platform)}</span>`:''}</p>
      <p><b>Falla:</b> ${safeText(r.issue_type||'otro')}</p>
      <p><b>Explicación:</b> ${safeText(r.description||'')}</p>
      ${r.evidence_image ? `
<div style="margin:12px 0;">
  <details>
    <summary style="cursor:pointer;font-weight:bold;color:#10b981;">
      📷 Ver evidencia adjunta
    </summary>
    <div style="margin-top:10px;">
      <img
        src="${r.evidence_image}"
        alt="Evidencia"
        style="max-width:100%;max-height:400px;border-radius:8px;border:1px solid #444;"
      />
    </div>
  </details>
</div>
` : ''}
<p><b>Monto:</b> $${formatMoney(r.order_amount)} &nbsp; <b>Días usados:</b> ${info.daysUsed} &nbsp; <b>Días restantes:</b> ${info.daysRemaining} &nbsp; <b>Reembolso sugerido:</b> $${formatMoney(info.refund)}</p>
      ${r.admin_response?`<div class="order-data response-text"><b>Respuesta admin:</b><br>${safeText(r.admin_response)}</div>`:''}
      <div class="two-row">
        <button class="green-btn" onclick="replaceReportedAccount(${r.id})" ${canAct?'':'disabled'}>🔁 Reemplazar cuenta</button>
        <button class="danger-btn" onclick="refundReportedAccount(${r.id}, '${r.order_created_at}')" ${canAct?'':'disabled'}>💰 Reembolso proporcional</button>
      </div>
      <div class="two-row" style="margin-top:10px">
        <select id="reportStatus-${r.id}"><option value="pendiente" ${r.status==='pendiente'?'selected':''}>Pendiente</option><option value="resuelto" ${r.status==='resuelto'?'selected':''}>Resuelto</option><option value="reemplazo" ${r.status==='reemplazo'?'selected':''}>Reemplazo</option><option value="reembolso" ${r.status==='reembolso'?'selected':''}>Reembolso</option></select>
        <input id="reportResponse-${r.id}" placeholder="Respuesta para el cliente" value="${safeText(r.admin_response||'')}" />
      </div>
      <button class="outline-btn" style="width:auto" onclick="updateAccountReportStatus(${r.id})">Guardar veredicto</button>
    </div>
  </div>`;
}

function calculateReportRefundInfo(report){
  const amount=Number(report.order_amount||0);
  if(!report.order_created_at||!amount)return {daysUsed:0,daysRemaining:0,refund:0};
  const purchase=new Date(report.order_created_at);
  const now=new Date();
  const msPerDay=24*60*60*1000;
  const daysUsed=Math.max(0,Math.min(28,Math.ceil((now-purchase)/msPerDay)));
  const daysRemaining=Math.max(0,28-daysUsed);
  const refund=Math.round(((amount/28)*daysRemaining)*100)/100;
  return {daysUsed,daysRemaining,refund};
}

async function replaceReportedAccount(reportId){
  try{
    const useManual = confirm(
      '¿Quieres capturar manualmente la cuenta de reemplazo?\n\n' +
      'Aceptar = Capturar correo, contraseña, perfil y PIN manualmente.\n' +
      'Cancelar = Usar una cuenta disponible del inventario automático.'
    );

    let body = {};

    if(useManual){
      const account_email = prompt('Correo de la cuenta nueva:');
      if(!account_email || !account_email.trim()) throw new Error('El correo de la cuenta es obligatorio');

      const account_password = prompt('Contraseña de la cuenta nueva:');
      if(!account_password || !account_password.trim()) throw new Error('La contraseña es obligatoria');

      const profile_name = prompt('Perfil (opcional):', '') || '';
      const profile_pin = prompt('PIN del perfil (opcional):', '') || '';
      const access_url = prompt('URL para código/soporte (opcional):', '') || '';
      const extra_data = prompt('Notas extra / datos adicionales (opcional):', '') || '';

      body = {
        manual: true,
        account_email: account_email.trim(),
        account_password: account_password.trim(),
        profile_name: profile_name.trim(),
        profile_pin: profile_pin.trim(),
        access_url: access_url.trim(),
        extra_data: extra_data.trim()
      };
    }else{
      if(!confirm('¿Reemplazar esta cuenta usando una cuenta disponible del inventario automático?'))return;
    }

    const data=await api('/api/admin/account-reports/'+reportId+'/replace',{
      method:'POST',
      body:JSON.stringify(body)
    });

    showMessage(data.message||'Cuenta reemplazada');
    await loadAccountReports();
    if(typeof loadMyAccountReports === 'function') await loadMyAccountReports();
    if(typeof loadAdminOrders === 'function') await loadAdminOrders();
    if(typeof loadPlatformInventory === 'function') await loadPlatformInventory();
  }catch(e){
    showMessage(e.message || 'Error reemplazando cuenta','error');
  }
}

async function refundReportedAccount(reportId, fechaCompra) {
  try {
    let amountToSend = null;

    // 1. PRIMER PASO: Preguntar qué cuenta falló
    const cuentaFallida = prompt("Si es un COMBO: ¿Qué cuenta específica falló? (Ej. Netflix, Vix)\n\nSi es cuenta normal: Deja esto en blanco y presiona Aceptar.");
    
    if (cuentaFallida === null) return; // Si el admin cancela, cerramos.

    // 2. SEGUNDO PASO: Si escribió el nombre de la cuenta, pedimos el precio
    if (cuentaFallida.trim() !== '') {
        const basePriceStr = prompt(`¿Cuál es el costo base de la cuenta de ${cuentaFallida.toUpperCase()}? (Solo escribe el número, ej. 45.50)`);
        
        if (basePriceStr === null) return;

        const precioBase = parseFloat(basePriceStr);
        if (isNaN(precioBase) || precioBase <= 0) {
            alert("Monto inválido. Operación cancelada.");
            return;
        }

        // 3. TERCER PASO: Hacemos el cálculo matemático AQUÍ MISMO para que no falle nada
        const hoy = new Date();
        const compra = new Date(fechaCompra);
        const diasTotalesServicio = 28; // Tu sistema original usa 28 días, lo igualamos aquí.
        
        let diasUsados = 0;
        // Validamos que la fecha sea correcta
        if (!isNaN(compra.getTime())) {
            const diferenciaMilisegundos = hoy.getTime() - compra.getTime();
            diasUsados = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
        }
        
        // Evitamos números negativos
        diasUsados = Math.max(0, diasUsados); 

        let diasRestantes = 0;
        if (diasUsados >= diasTotalesServicio) {
            amountToSend = 0;
        } else {
            diasRestantes = diasTotalesServicio - diasUsados;
            const costoPorDia = precioBase / diasTotalesServicio;
            amountToSend = parseFloat((costoPorDia * diasRestantes).toFixed(2));
        }

        // 4. Confirmación final con todos los datos
        if (!confirm(`COMBO DETECTADO (Falla en ${cuentaFallida.toUpperCase()}):\n\nEsta cuenta se ha usado por ${diasUsados} días.\nEl reembolso por los ${diasRestantes} días restantes es de: $${amountToSend}.\n\n¿Aplicar este monto al vendedor?`)) {
            return;
        }
        
    } else {
        // SI ES CUENTA NORMAL (Lo dejó en blanco)
        if (!confirm('¿Aplicar reembolso proporcional NORMAL al saldo del usuario?')) {
            return;
        }
    }

    // 5. Enviamos la instrucción al servidor
    const data = await api('/api/admin/account-reports/' + reportId + '/refund-proportional', {
        method: 'POST',
        body: JSON.stringify({ overrideAmount: amountToSend }) 
    });

    showMessage(data.message || 'Reembolso aplicado');
    await loadAccountReports();
    await loadUsers();

  } catch (e) {
    // Si algo falla, forzamos que salga un aviso visual en pantalla
    console.error("Error al procesar reembolso:", e);
    alert("Ocurrió un error al intentar reembolsar: " + e.message);
  }
}

async function updateAccountReportStatus(reportId){
  try{
    const status=document.getElementById(`reportStatus-${reportId}`)?.value||'pendiente';
    const admiloadAccountReportsn_response=document.getElementById(`reportResponse-${reportId}`)?.value||'';
    const data=await api('/api/admin/account-reports/'+reportId+'/status',{method:'PATCH',body:JSON.stringify({status,admin_response})});
    showMessage(data.message||'Reporte actualizado');
    await loadAccountReports();
  }catch(e){showMessage(e.message,'error')}
}

function toggleCompactItemFinal(id){
  document.getElementById(id)?.classList.toggle('open');
}

async function loadAccountReports() {
  if (!__isAdminUserFinal()) return;

  try {
    const reports = await api('/api/admin/account-reports');
    const pending = reports.filter(r => String(r.status || '').toLowerCase() === 'pendiente');
    
    const stat = document.getElementById('statReports');
    if (stat) stat.textContent = pending.length;
    
    const box = document.getElementById('adminAccountReportsList');
    if (box) {
      box.innerHTML = reports.length ? reports.map(renderAdminReportCompactFinal).join('') : 'Sin reportes de falla.';
    }
  } catch (e) {
    console.warn('Error cargando reportes:', e);
  }
}
