const fs = require('fs');

try {
  // Leemos tu archivo del servidor
  let serverCode = fs.readFileSync('server.js', 'utf8');

  // Buscamos la línea que hace el conteo de stock automático
  const lineaVieja = "const isPlatformProduct = Number(platformCountResult.rows[0]?.total || 0) > 0;";
  
  // La cambiamos por nuestra nueva regla blindada para IPTV
  const lineaNueva = `const isIptv = productName.toLowerCase().includes('iptv') || productCategory.toLowerCase().includes('iptv');
    const isPlatformProduct = !isIptv && Number(platformCountResult.rows[0]?.total || 0) > 0;`;

  if (serverCode.includes(lineaVieja)) {
    serverCode = serverCode.replace(lineaVieja, lineaNueva);
    fs.writeFileSync('server.js', serverCode);
    console.log("✅ ¡Éxito! El servidor ahora sabe que IPTV es 100% de entrega manual y no pedirá stock.");
  } else if (serverCode.includes("const isIptv")) {
    console.log("✅ El parche ya estaba aplicado anteriormente.");
  } else {
    console.log("❌ No se encontró la línea en server.js. Verifica que el archivo esté correcto.");
  }

} catch (e) {
  console.error("❌ Error al modificar:", e.message);
}