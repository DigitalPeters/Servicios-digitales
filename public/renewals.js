let __myRenewalsCache=[];
async function loadMyRenewals(){
  const list=document.getElementById('myRenewalsList');
  const notice=document.getElementById('renewalsNotice');
  const history=document.getElementById('myRenewalsHistory');
  if(!list) return;
  try{
    const rows=await api('/api/my-renewals');
    __myRenewalsCache=Array.isArray(rows)?rows:[];
    const eligible=__myRenewalsCache.filter(r=>r.can_renew);
    const nearest=__myRenewalsCache[0];
    if(notice){
      if(!nearest) notice.innerHTML='<b>ℹ️ No tienes cuentas habilitadas para renovación.</b><br><span class="small-text">Cuando un producto sea marcado como renovable por el administrador, aparecerá aquí.</span>';
      else if(Number(nearest.days_remaining)<=3) notice.innerHTML=`<b>⏰ Atención:</b> tu cuenta más próxima a vencer tiene <b>${Number(nearest.days_remaining)} día(s)</b> restantes. Renueva como mínimo 1 día antes para evitar cortes.`;
      else notice.innerHTML=`<b>🔄 Renovaciones disponibles:</b> ${eligible.length}. La cuenta más próxima vence en <b>${Number(nearest.days_remaining)} día(s)</b>.`;
    }
    if(!__myRenewalsCache.length){list.innerHTML='<div class="item">No tienes cuentas habilitadas para renovación.</div>';}else{
      list.innerHTML=__myRenewalsCache.map(r=>{
        const days=Math.max(0,Number(r.days_remaining||0));
        const can=r.can_renew===true||r.can_renew==='true';
        const warning=days<=3;
        return `<div class="item renewal-card" style="margin-bottom:10px;border-left:4px solid ${warning?'#dc2626':'#16a34a'}">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><b>${safeText(r.product_name_catalog||r.product_name||'Servicio')}</b><br><span class="small-text">Pedido #${Number(r.order_id)} · Cuenta #${Number(r.account_id)}</span></div><span class="chip">${days} día(s) restantes</span></div>
          <p style="margin:8px 0"><b>Correo:</b> ${safeText(r.account_email||'-')} ${r.profile_name?` · <b>Perfil:</b> ${safeText(r.profile_name)}`:''}</p>
          <p style="margin:4px 0"><b>Vence:</b> ${safeText(new Date(r.expires_at).toLocaleDateString('es-MX'))} · <b>Renovación:</b> ${Number(r.renewal_days||30)} días · <b>Costo:</b> $${formatMoney(r.renewal_price||0)}</p>
          ${can?`<button class="primary-btn" style="width:auto" onclick="renewMyAccount(${Number(r.account_id)})">🔄 Renovar cuenta</button>`:`<div class="small-text" style="color:#b91c1c;font-weight:600">⚠️ Ya no cumple la condición mínima de 1 día antes del vencimiento.</div>`}
        </div>`;
      }).join('');
    }
    if(history){
      const hs=await api('/api/my-renewals/history');
      history.innerHTML=(Array.isArray(hs)&&hs.length)?hs.map(r=>`<div class="item"><b>${safeText(r.product_name||'Servicio')}</b> · Cuenta #${Number(r.account_id)} · Pedido #${Number(r.order_id)}<br><span class="small-text">${safeText(r.platform||'')} ${safeText(r.account_email||'')} · ${Number(r.renewal_days||30)} días · $${formatMoney(r.amount||0)} · ${new Date(r.created_at).toLocaleString('es-MX')}</span><br><span class="small-text">${new Date(r.previous_expires_at).toLocaleDateString('es-MX')} → ${new Date(r.new_expires_at).toLocaleDateString('es-MX')}</span></div>`).join(''):'Sin renovaciones registradas.';
    }
    const summary=document.getElementById('renewalsDashboardSummary');
    if(summary){ const e=eligible.length; summary.textContent=e?`${e} cuenta(s) · próxima vence en ${Math.max(0,Number(nearest?.days_remaining||0))} día(s)`:'Sin cuentas renovables'; }
  }catch(e){list.innerHTML='<div class="item">No se pudieron cargar las renovaciones.</div>';if(notice)notice.textContent=e.message||'Error cargando renovaciones';}
}
async function renewMyAccount(accountId){
  const row=__myRenewalsCache.find(r=>Number(r.account_id)===Number(accountId));
  if(!row)return;
  const price=Number(row.renewal_price||0), days=Number(row.renewal_days||30), remain=Number(row.days_remaining||0);
  if(remain<1){showMessage('Debes renovar como mínimo 1 día antes del vencimiento.','error');return;}
  if(!confirm(`Vas a renovar ${row.product_name_catalog||row.product_name||'esta cuenta'} por ${days} días.\nCosto: $${price.toFixed(2)}\nDías restantes actuales: ${remain}\n\n¿Confirmas la renovación?`))return;
  try{const d=await api('/api/my-renewals/'+Number(accountId),{method:'POST',body:JSON.stringify({})});showMessage(d.message||'Cuenta renovada');await Promise.allSettled([loadMyRenewals(),loadMyOrders(),typeof loadApp==='function'?Promise.resolve():Promise.resolve()]);}catch(e){showMessage(e.message||'No se pudo renovar','error');}
}
window.loadMyRenewals=loadMyRenewals;window.renewMyAccount=renewMyAccount;

(function(){if(typeof document==='undefined'||document.getElementById('peters-renewals-style'))return;const st=document.createElement('style');st.id='peters-renewals-style';st.textContent='.renewal-config-box{margin:12px 0;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc}.renewal-card .chip{background:#eef2ff;padding:6px 9px;border-radius:999px}.renewal-card{background:#fff}';document.head.appendChild(st);})();
