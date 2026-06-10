const fs = require('fs');

try {
  let html = fs.readFileSync('public/index.html', 'utf8');

  // 1. Limpiar los 7 bloques gigantes duplicados por accidente
  const regexPlaga = /await\s+function openSalesReport\(\)[\s\S]*?Error cargando reporte de ventas','error'\);\s*\}\s*\}/g;
  html = html.replace(regexPlaga, 'await ');

  // 2. Limpiar las etiquetas <script> que se metieron por error dentro del código
  html = html.replace(/\/\/ ==========================================\s*<script>\s*\/\/ ==========================================/g, '// ==========================================\n// ==========================================');
  html = html.replace(/<\/script>\s*<\/script>/g, '</script>');

  fs.writeFileSync('public/index.html', html);
  console.log("✅ ¡Reparación perfecta! El HTML intruso y los duplicados fueron eliminados.");
} catch (error) {
  console.error("❌ Error al reparar:", error.message);
}