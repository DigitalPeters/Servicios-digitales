const fs = require('fs');

try {
  let html = fs.readFileSync('public/index.html', 'utf8');

  // 1. Extraer el CSS y crear styles.css
  const styleStart = html.indexOf('<style>');
  const styleEnd = html.indexOf('</style>') + 8;
  
  if (styleStart !== -1) {
    const cssContent = html.substring(styleStart + 7, styleEnd - 8).trim();
    fs.writeFileSync('public/styles.css', cssContent);
    html = html.substring(0, styleStart) + '<link rel="stylesheet" href="styles.css">' + html.substring(styleEnd);
    console.log("🎨 Archivo 'styles.css' creado correctamente.");
  }

  // 2. Extraer el JavaScript y crear app.js
  const scriptStart = html.indexOf('<script>');
  const scriptEnd = html.indexOf('</script>') + 9;

  if (scriptStart !== -1) {
    const jsContent = html.substring(scriptStart + 8, scriptEnd - 9).trim();
    fs.writeFileSync('public/app.js', jsContent);
    html = html.substring(0, scriptStart) + '<script src="app.js"></script>' + html.substring(scriptEnd);
    console.log("⚙️ Archivo 'app.js' creado correctamente.");
  }

  // 3. Guardar el nuevo index.html súper limpio
  fs.writeFileSync('public/index.html', html);
  console.log("✅ ¡Tu index.html ahora está limpio y la casa está ordenada!");

} catch (error) {
  console.error("❌ Error al separar:", error.message);
}