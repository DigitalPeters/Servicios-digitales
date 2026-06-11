const fs = require('fs');

try {
  let html = fs.readFileSync('public/index.html', 'utf8');

  // 1. Limpiamos intentos de rescate anteriores (por si acaso)
  html = html.replace(/<style id="rescate-total">[\s\S]*?<\/style>/, '');

  // 2. Este es el código INQUEBRANTABLE que va directo a tu HTML
  const superCSS = `
  <style id="rescate-total">
    /* =======================================
       1. ARREGLO ABSOLUTO DE LA BARRA LATERAL
       ======================================= */
    html, body { overflow-x: hidden !important; width: 100vw !important; margin: 0 !important; }
    .app { display: flex !important; width: 100% !important; overflow-x: hidden !important; }
    
    .sidebar { 
      width: 280px !important; 
      min-width: 280px !important; 
      position: fixed !important; 
      left: 0 !important; 
      top: 0 !important; 
      bottom: 0 !important; 
      z-index: 9999 !important; 
      background: var(--primary) !important;
    }
    
    .main { 
      margin-left: 280px !important; 
      width: calc(100vw - 280px) !important; 
      max-width: calc(100vw - 280px) !important; 
      padding: 24px !important; 
      box-sizing: border-box !important; 
      min-height: 100vh !important;
    }
    
    @media (max-width: 768px) {
      .main { margin-left: 0 !important; width: 100vw !important; max-width: 100vw !important; padding: 15px !important; }
      .sidebar { display: none !important; } /* Ocultar en móvil a menos que se presione el botón */
    }

    /* =======================================
       2. ARREGLO DE LA TIENDA Y PRODUCTOS
       ======================================= */
    .products-list { 
      display: flex !important; 
      flex-wrap: wrap !important; 
      gap: 20px !important; 
      width: 100% !important; 
      margin: 0 !important; 
      padding: 0 !important; 
    }
    
    .category-title { 
      width: 100% !important; 
      flex: 0 0 100% !important; 
      background: var(--primary) !important; 
      color: white !important; 
      padding: 15px !important; 
      border-radius: 8px !important; 
      margin-top: 20px !important; 
      display: block !important; 
      font-size: 20px !important; 
      font-weight: 900 !important; 
    }
    
    .product-row { 
      width: calc(50% - 10px) !important; 
      min-width: 250px !important; 
      flex: 1 1 250px !important; 
      max-width: 450px !important; 
      display: flex !important; 
      flex-direction: column !important; 
      background: var(--card) !important; 
      border: 1px solid var(--border) !important; 
      border-radius: 16px !important; 
      margin: 0 !important; 
      overflow: hidden !important;
    }
    
    .product-header { 
      display: flex !important; 
      flex-direction: column !important; 
      padding: 20px !important; 
      position: relative !important; 
      height: 100% !important;
    }
    
    /* Título forzado arriba */
    .product-name { 
      display: block !important; 
      font-size: 19px !important; 
      font-weight: 900 !important; 
      margin-bottom: 5px !important; 
      white-space: normal !important; 
      width: 85% !important; 
    }
    
    .product-header .chip { 
      display: inline-block !important; 
      margin-bottom: 15px !important; 
      width: max-content !important; 
    }
    
    /* Precio forzado abajo */
    .price { 
      display: block !important; 
      font-size: 24px !important; 
      font-weight: bold !important; 
      color: #008c2e !important; 
      border-top: 1px solid var(--border) !important; 
      padding-top: 15px !important; 
      margin-top: auto !important; 
    }
    body.dark-mode .price { color: #4ade80 !important; }

    /* Flecha arrinconada */
    .product-header > div:nth-child(3) { 
      position: absolute !important; 
      top: 20px !important; 
      right: 20px !important; 
    }
  </style>
  `;

  // Engañamos a la memoria caché cambiando la "versión" de tu página automáticamente
  if (html.includes('styles.css')) {
    html = html.replace(/styles\.css\?v=[a-zA-Z0-9]+/, 'styles.css?v=' + Date.now());
    html = html.replace(/styles\.css"/, 'styles.css?v=' + Date.now() + '"');
  }

  // Inyectamos el bloque blindado justo antes de cerrar el <head>
  html = html.replace('</head>', superCSS + '\\n</head>');
  
  fs.writeFileSync('public/index.html', html);
  console.log("✅ RESCATE COMPLETADO: El HTML ha sido blindado desde adentro.");
} catch (e) {
  console.log("❌ Error:", e.message);
}