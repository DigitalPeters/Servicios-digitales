// ==========================================
// MÓDULO DE AUTENTICACIÓN (auth.js)
// ==========================================

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
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('appSection').classList.add('hidden');
    showMessage('Sesión cerrada');
}

// Mantenemos esta para verificar sesión al recargar
async function checkAuth() {
    const t = localStorage.getItem('token');
    if (!t) return null;
    try {
        return await api('/api/me');
    } catch (e) {
        localStorage.removeItem('token');
        return null;
    }
}