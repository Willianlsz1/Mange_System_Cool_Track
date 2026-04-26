/**
 * clienteAlerts — storage helper pra alertas de retorno por cliente.
 *
 * Persistido em localStorage por enquanto (sem migration de DB) — escopo do
 * device. Quando a coluna `next_alert_at` aparecer no Supabase, esse modulo
 * vira a fachada e a fonte da verdade migra pra remoto.
 *
 * Schema localStorage:
 *   key   = `cooltrack-cliente-alert:${clienteId}`
 *   value = JSON: { dueAt: ISO 8601 string, note: string, createdAt: ISO }
 *
 * Convencoes:
 *   - dueAt é sempre data ISO (interpretada local time pelo Date constructor)
 *   - alerta one-shot: não se repete sozinho. User decide setar de novo.
 *   - clear(id) remove a entrada por completo.
 */

const KEY_PREFIX = 'cooltrack-cliente-alert:';

function _safeStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (_e) {
    /* SSR/test sem storage */
  }
  return null;
}

/**
 * @param {string} clienteId
 * @returns {{dueAt:string, note:string, createdAt:string}|null}
 */
export function getClienteAlert(clienteId) {
  if (!clienteId) return null;
  const ls = _safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY_PREFIX + clienteId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.dueAt) return null;
    return {
      dueAt: String(parsed.dueAt),
      note: String(parsed.note || ''),
      createdAt: String(parsed.createdAt || ''),
    };
  } catch (_e) {
    return null;
  }
}

/**
 * @param {string} clienteId
 * @param {Date|string|number} due — data alvo do alerta
 * @param {string} [note] — nota opcional (max 200 chars)
 * @returns {boolean} true se persistiu
 */
export function setClienteAlert(clienteId, due, note = '') {
  if (!clienteId) return false;
  const ls = _safeStorage();
  if (!ls) return false;
  const dueDate = due instanceof Date ? due : new Date(due);
  if (Number.isNaN(dueDate.getTime())) return false;
  try {
    const payload = {
      dueAt: dueDate.toISOString(),
      note: String(note || '').slice(0, 200),
      createdAt: new Date().toISOString(),
    };
    ls.setItem(KEY_PREFIX + clienteId, JSON.stringify(payload));
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * @param {string} clienteId
 * @returns {boolean} true se removeu
 */
export function clearClienteAlert(clienteId) {
  if (!clienteId) return false;
  const ls = _safeStorage();
  if (!ls) return false;
  try {
    ls.removeItem(KEY_PREFIX + clienteId);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Lista TODOS os alertas de cliente cadastrados, com info do cliente
 * resolvida via state. Util pra view /alertas.
 *
 * @param {Array<{id:string, nome:string}>} clientes — state.clientes
 * @returns {Array<{clienteId:string, clienteNome:string, dueAt:string, note:string, daysRemaining:number}>}
 */
export function getAllClienteAlerts(clientes = []) {
  const ls = _safeStorage();
  if (!ls) return [];
  const out = [];
  const now = Date.now();
  // Itera localStorage procurando pelas chaves do prefixo
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (!key || !key.startsWith(KEY_PREFIX)) continue;
    const clienteId = key.slice(KEY_PREFIX.length);
    const cliente = clientes.find((c) => c.id === clienteId);
    // Skip alertas órfãos (cliente foi deletado mas o alerta ficou)
    if (!cliente) continue;
    const data = getClienteAlert(clienteId);
    if (!data) continue;
    const dueTs = new Date(data.dueAt).getTime();
    if (Number.isNaN(dueTs)) continue;
    const daysRemaining = Math.ceil((dueTs - now) / (24 * 60 * 60 * 1000));
    out.push({
      clienteId,
      clienteNome: cliente.nome,
      dueAt: data.dueAt,
      note: data.note,
      daysRemaining,
    });
  }
  // Ordena: vencidos primeiro (negative days), depois proximidade
  out.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return out;
}

/**
 * Conveniencia: dias restantes até o alerta. Negativo se já venceu.
 */
export function daysUntilAlert(clienteId) {
  const data = getClienteAlert(clienteId);
  if (!data) return null;
  const due = new Date(data.dueAt).getTime();
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000));
}
