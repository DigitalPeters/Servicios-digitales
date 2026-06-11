const fs = require('fs');

try {
  let css = fs.readFileSync('public/styles.css', 'utf8');

  // 1. Buscar si existen nuestros bloques anteriores y borrarlos para que no estorben
  const posiblesTextos = [
    "REDISEÑO DINÁMICO",
    "SEPARADOR DE CATEGORÍAS",
    "RESCATE VISUAL",
    "BLINDAJE MAESTRO"
  ];

  let indiceCorte = css.length;
  for (let texto of posiblesTextos) {
    let idx = css.indexOf(texto);
    if (idx !== -1 && idx < indiceCorte) {
      let inicioComentario = css.lastIndexOf("/*", idx);
      if (inicioComentario !== -1) indiceCorte = inicioComentario;
      else indiceCorte = idx;
    }
  }

  // Cortar el archivo justo antes de nuestros intentos fallidos
  if (indiceCorte < css.length) {
    css = css.substring(0, indiceCorte);
  }

  // 2. Inyectar el código definitivo con la llave sanadora al principio
  const codigoPerfecto = `
} /* <- ESTA LLAVE MÁGICA REPARA CUALQUIER ERROR OCULTO ANTERIOR */

/* ==========================================
   1. BLINDAJE ABSOLUTO DE LA BARRA LATERAL
   ========================================== */
body { 
  margin: 0 !important; 
  padding: 0 !important; 
  overflow-x: hidden !important; 
}

.sidebar { 
  width: 280px !important; 
  position: fixed !important; 
  left: 0 !important; 
  top: 0 !important; 
  bottom: 0 !important; 
  z-index: 1000 !important; 
}

/* Forzamos a TODAS las pantallas a respetar la barra izquierda */
.main { 
  margin-left: 280px !important; 
  width: calc(100% - 280px) !important; 
  max-width: calc(100% - 280px) !important; 
  min-height: 100vh !important;
  box-sizing: border-box !important; 
  padding: 24px !important; 
  position: relative !important;
}

@media (max-width: 768px) {
  .main { 
    margin-left: 0 !important; 
    width: 100% !important; 
    max-width: 100% !important; 
    padding: 14px !important; 
  }
}

/* ==========================================
   2. TIENDA ORGANIZADA (TARJETAS PERFECTAS)
   ========================================== */
.products-list {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)) !important;
  gap: 20px !important;
  width: 100% !important;
  padding: 10px 0 !important;
  margin: 0 !important;
}

.product-row {
  display: flex !important;
  flex-direction: column !important;
  background: var(--card) !important;
  border-radius: 16px !important;
  border: 1px solid var(--border) !important;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05) !important;
  margin: 0 !important;
  width: 100% !important;
  overflow: hidden !important;
}

.product-header {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  padding: 20px !important;
  position: relative !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

/* ZONA 1: Nombre del producto arriba */
.product-header > div:nth-child(1) {
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  padding-right: 35px !important; /* Espacio para que la flecha no tape */
  margin-bottom: 15px !important;
}

.product-name {
  display: block !important;
  font-size: 19px !important;
  font-weight: 900 !important;
  margin-bottom: 8px !important;
  line-height: 1.3 !important;
  white-space: normal !important;
}

/* ZONA 2: Precio (Forzado a ir abajo) */
.product-header > div:nth-child(2) {
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  border-top: 1px solid var(--border) !important;
  padding-top: 15px !important;
}

.price {
  display: block !important;
  font-size: 24px !important;
  font-weight: bold !important;
  color: #008c2e !important;
  margin-bottom: 4px !important;
}

body.dark-mode .price { 
  color: #4ade80 !important; 
}

/* ZONA 3: La Flechita */
.product-header > div:nth-child(3) {
  position: absolute !important;
  top: 20px !important;
  right: 20px !important;
}

/* ==========================================
   3. SEPARADOR DE CATEGORÍAS LARGO
   ========================================== */
.category-title {
  grid-column: 1 / -1 !important;
  background: var(--primary) !important;
  color: #ffffff !important;
  padding: 14px 20px !important;
  border-radius: 12px !important;
  font-size: 20px !important;
  font-weight: 900 !important;
  margin-top: 20px !important;
  margin-bottom: 5px !important;
}
`;

  fs.writeFileSync('public/styles.css', css + codigoPerfecto);
  console.log("✅ ¡Archivo reparado y limpiado! Todo debería verse perfecto ahora.");
} catch (e) {
  console.error("❌ Error:", e.message);
}