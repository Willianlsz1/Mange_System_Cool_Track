export function filterRegistrosForReport(registros, { filtEq = '', de = '', ate = '' } = {}) {
  let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq) filtered = filtered.filter((registro) => registro.equipId === filtEq);
  if (de) filtered = filtered.filter((registro) => registro.data >= de);
  if (ate) filtered = filtered.filter((registro) => registro.data <= `${ate}T23:59`);
  return filtered;
}

export function buildReportFileName(profile, now = new Date()) {
  const empresa = (profile?.empresa || 'Relatorio').replace(/\s+/g, '_');
  const data = now.toISOString().slice(0, 10);
  return `CoolTrack_${empresa}_${data}.pdf`;
}
