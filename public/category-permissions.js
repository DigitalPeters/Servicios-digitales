(function(){
  function ensureCategoryPermissionsModal(){
    if(document.getElementById('categoryPermissionsModal')) return;
    const el=document.createElement('div');
    el.id='categoryPermissionsModal';
    el.className='modal-overlay hidden';
    el.innerHTML=`<div class="modal-card" style="max-width:620px;width:calc(100% - 28px);max-height:88vh;overflow:auto">
      <button class="modal-close-btn" type="button" onclick="closeCategoryPermissions()" aria-label="Cerrar">×</button>
      <h2 id="categoryPermissionsTitle">Autorización de categorías</h2>
      <p id="categoryPermissionsUser" class="small-text"></p>
      <div id="categoryPermissionsBody">Cargando categorías...</div>
      <div class="tools" style="margin-top:18px">
        <button class="outline-btn" type="button" onclick="saveCategoryPermissions(false)">Guardar permisos</button>
        <button class="primary-btn" type="button" onclick="saveCategoryPermissions(true)">Guardar y activar</button>
        <button class="danger-btn" type="button" onclick="closeCategoryPermissions()">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(el);
  }

  window.closeCategoryPermissions=function(){
    document.getElementById('categoryPermissionsModal')?.classList.add('hidden');
  };

  window.openCategoryPermissions=async function(userId){
    ensureCategoryPermissionsModal();
    const modal=document.getElementById('categoryPermissionsModal');
    const body=document.getElementById('categoryPermissionsBody');
    const user=(Array.isArray(window.__petersAllUsers) ? window.__petersAllUsers : []).find(u=>Number(u.id)===Number(userId));
    modal.dataset.userId=String(userId);
    document.getElementById('categoryPermissionsTitle').textContent=user?.category_access_configured ? 'Editar categorías autorizadas' : 'Autorizar categorías y activar';
    document.getElementById('categoryPermissionsUser').textContent=user ? `${user.name || ''} · ${user.email || ''}` : `Usuario #${userId}`;
    body.innerHTML='Cargando categorías...';
    modal.classList.remove('hidden');
    try{
      const data=await api('/api/admin/users/'+encodeURIComponent(userId)+'/category-permissions');
      const selected=new Set((data.authorized_categories||[]).map(v=>String(v).toLowerCase()));
      const cats=Array.isArray(data.categories)?data.categories:[];
      body.innerHTML=cats.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">${cats.map((cat,i)=>{
        const key=String(cat).trim().toLowerCase();
        return `<label class="item" style="margin:0;display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" class="category-permission-check" value="${safeText(key)}" ${selected.has(key)?'checked':''}> <span>${safeText(cat)}</span></label>`;
      }).join('')}</div><p class="small-text" style="margin-top:12px">Las categorías que no marques no aparecerán en la tienda de este usuario.</p>` : '<p>No hay categorías activas disponibles en este catálogo.</p>';
    }catch(e){ body.innerHTML=`<p style="color:#b91c1c">${safeText(e.message || 'No se pudieron cargar las categorías.')}</p>`; }
  };

  window.saveCategoryPermissions=async function(activate){
    const modal=document.getElementById('categoryPermissionsModal');
    if(!modal) return;
    const userId=Number(modal.dataset.userId || 0);
    if(!userId){ showMessage('No se pudo identificar al usuario. Cierra y vuelve a abrir la configuración.','error'); return; }
    const categories=[...modal.querySelectorAll('.category-permission-check:checked')].map(el=>el.value);
    if(activate && categories.length===0){ showMessage('Selecciona al menos una categoría antes de activar al usuario.','error'); return; }
    try{
      const data=await api('/api/admin/users/'+encodeURIComponent(userId)+'/category-permissions',{method:'PATCH',body:JSON.stringify({categories,activate})});
      showMessage(data.message || 'Permisos guardados');
      closeCategoryPermissions();
      if(typeof loadUsers==='function') await loadUsers();
    }catch(e){ showMessage(e.message || 'No se pudieron guardar los permisos','error'); }
  };
})();
