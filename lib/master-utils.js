function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function supplierScore(row = {}) {
  const invested = Number(row.invested || 0);
  const soldCost = Number(row.sold_cost || 0);
  const replacementCost = Number(row.replacement_cost || 0);
  const revenue = Number(row.revenue || 0);
  const profit = Number(row.profit || 0);
  const sold = Math.max(0, Number(row.sales || 0));
  const failures = Math.max(0, Number(row.failures || 0));
  const replacements = Math.max(0, Number(row.replacements || 0));
  const avgRating = Number(row.avg_attention_rating || 0);
  const cases = Math.max(0, Number(row.service_cases || 0));
  const resolved = Math.max(0, Number(row.resolved_cases || 0));
  const avgHours = Number(row.avg_resolution_hours || 0);

  const consumedCapital = soldCost + replacementCost;
  const roiPct = consumedCapital > 0 ? (profit / consumedCapital) * 100 : (invested > 0 && revenue > 0 ? (profit / invested) * 100 : 0);
  const failureRate = sold > 0 ? (failures / sold) * 100 : 0;
  const replacementRate = sold > 0 ? (replacements / sold) * 100 : 0;
  const resolutionRate = cases > 0 ? (resolved / cases) * 100 : 60;

  // ROI operativo: utilidad del periodo sobre el costo consumido (venta + reemplazos).
  // Si no existe costo consumido pero sí inversión/venta, usa la inversión como respaldo.
  // 100% ROI equivale a la puntuación máxima de rentabilidad. Se limita para evitar
  // que un solo dato monetario esconda problemas graves de calidad/atención.
  const profitabilityScore = clamp(roiPct, 0, 100);
  const qualityScore = clamp(100 - (failureRate * 2.2) - (replacementRate * 1.8), 0, 100);
  const attentionScore = cases > 0
    ? clamp((avgRating > 0 ? (avgRating / 5) * 80 : 48) + (avgHours > 0 ? clamp(20 - avgHours, 0, 20) : 8), 0, 100)
    : 60;
  const resolutionScore = clamp(resolutionRate, 0, 100);
  const score = Math.round(
    profitabilityScore * 0.35 +
    qualityScore * 0.30 +
    attentionScore * 0.20 +
    resolutionScore * 0.15
  );

  let classification = 'Vigilar';
  let recommendation = 'Mantener compras controladas y seguir midiendo.';
  if (score >= 85) { classification = 'Excelente'; recommendation = 'Proveedor prioritario: buen candidato para aumentar compras.'; }
  else if (score >= 70) { classification = 'Bueno'; recommendation = 'Proveedor recomendable; mantener y comparar precios/stock.'; }
  else if (score >= 55) { classification = 'Regular'; recommendation = 'Revisar fallas, atención y margen antes de aumentar compras.'; }
  else { classification = 'Riesgo alto'; recommendation = 'Reducir exposición y buscar alternativa antes de nuevas compras grandes.'; }

  return {
    score,
    classification,
    recommendation,
    roi_pct: roiPct,
    failure_rate: failureRate,
    replacement_rate: replacementRate,
    resolution_rate: resolutionRate,
    profitability_score: profitabilityScore,
    quality_score: qualityScore,
    attention_score: attentionScore,
    resolution_score: resolutionScore
  };
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[\",\n\r]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text;
}

function rowsToCsv(rows, columns) {
  const cols = Array.isArray(columns) && columns.length
    ? columns
    : Object.keys((Array.isArray(rows) && rows[0]) || {});
  const header = cols.map(c => csvCell(typeof c === 'string' ? c : c.label || c.key)).join(',');
  const lines = (rows || []).map(row => cols.map(c => {
    const key = typeof c === 'string' ? c : c.key;
    return csvCell(row?.[key]);
  }).join(','));
  return '\ufeff' + [header, ...lines].join('\r\n');
}

module.exports = { supplierScore, rowsToCsv, clamp };
