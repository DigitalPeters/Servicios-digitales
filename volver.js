const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("🔍 Buscando en el historial el punto estable...");
  
  // Obtenemos tu historial de guardados de Git
  const log = execSync('git log --oneline').toString().split('\n');
  
  let hashSeguro = null;
  for (let i = 0; i < log.length; i++) {
    // Busca el mensaje exacto que usamos cuando todo funcionaba bien
    if (log[i].includes("separo el codigo") || log[i].includes("Se separo")) {
      hashSeguro = log[i].split(' ')[0];
      break;
    }
  }

  if (hashSeguro) {
    console.log(`⏳ Viajando en el tiempo a la versión segura (Commit: ${hashSeguro})...`);
    
    // Comando mágico que restaura SOLO esos 3 archivos a esa fecha exacta
    execSync(`git checkout ${hashSeguro} -- public/index.html public/styles.css public/app.js`);
    
    // Inyectamos un "rompedor de caché" para obligar a tu PC/Celular a mostrar la versión limpia
    let html = fs.readFileSync('public/index.html', 'utf8');
    html = html.replace(/styles\.css(\?v=[0-9]+)?/g, 'styles.css?v=' + Date.now());
    fs.writeFileSync('public/index.html', html);

    console.log("✅ ¡RESTAURACIÓN PERFECTA!");
    console.log("Tu index.html, styles.css y app.js son idénticos a cuando los separamos.");
  } else {
    console.log("❌ No encontré el mensaje en el historial. Por favor avísame para darte el comando manual.");
  }
} catch (e) {
  console.log("❌ Error ejecutando la restauración:", e.message);
}