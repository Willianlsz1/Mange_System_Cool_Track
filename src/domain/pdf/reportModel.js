import { sanitizePublicText } from './sanitizers.js';

export function filterRegistrosForReport(
  registros,
  { registroId = '', filtEq = '', de = '', ate = '' } = {},
) {
  let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (registroId) return filtered.filter((registro) => registro.id === registroId);
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

// Número da OS no padrão YYYY-MMDD-NNN.
// O contador é local ao dia e persistido em localStorage — suficiente para o
// uso atual (1 técnico / 1 dispositivo). Na prática o cliente enxerga o número
// como identificador único do documento mesmo sem sequência global.
const OS_COUNTER_PREFIX = 'cooltrack-os-counter-';

export function buildOsNumber(now = new Date(), storage = _safeLocalStorage()) {
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dayKey = `${y}-${mm}${dd}`;
  const storageKey = OS_COUNTER_PREFIX + dayKey;

  let nextSeq = 1;
  if (storage) {
    const current = parseInt(storage.getItem(storageKey) || '0', 10);
    nextSeq = Number.isFinite(current) && current > 0 ? current + 1 : 1;
    try {
      storage.setItem(storageKey, String(nextSeq));
    } catch (_err) {
      // storage cheio / indisponível — ignora, o número só não avança
    }
  }

  return `${dayKey}-${String(nextSeq).padStart(3, '0')}`;
}

// Extrai dados do cliente do registro mais recente do filtro. Como o schema
// de `registros` não garante campo `clienteNome`, a função trata todos como
// opcionais e retorna null se nada estiver preenchido — o bloco cliente na
// capa só aparece quando houver dado real.
export function extractClientBlock(filtered = []) {
  if (!filtered.length) return null;
  const recent = filtered[0] || {};

  const nome = sanitizePublicText(
    recent.clienteNome?.trim() || recent.cliente?.trim() || recent.clienteRazao?.trim() || '',
    '',
  );
  const documento = sanitizePublicText(
    recent.clienteDocumento?.trim() ||
      recent.clienteCnpj?.trim() ||
      recent.clienteCpf?.trim() ||
      '',
    '',
  );
  const local = sanitizePublicText(
    recent.localAtendimento?.trim() || recent.enderecoCliente?.trim() || '',
    '',
  );
  const contato = sanitizePublicText(
    recent.clienteContato?.trim() || recent.clienteTelefone?.trim() || '',
    '',
  );

  if (!nome && !documento && !local && !contato) return null;
  return { nome, documento, local, contato };
}

function _safeLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_err) {
    return null;
  }
}
