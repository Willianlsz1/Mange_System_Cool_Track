/**
 * CoolTrack Pro — Análise de placa por IA (client-side)
 *
 * Recebe um File (foto tirada pelo técnico), chama a Edge Function
 * `analyze-nameplate`, e devolve um objeto pronto pra pré-preencher o form
 * de cadastro de equipamento (step 2 do modal-add-eq).
 *
 * Fonte de verdade do schema de resposta: supabase/functions/analyze-nameplate
 *
 * Padrão de erro: lança NameplateAnalysisError com `.code` canônico — o
 * handler do UI decide o que mostrar (toast, upsell, retry) baseado no code.
 */
import { supabase } from '../core/supabase.js';

// ── Erros canônicos ────────────────────────────────────────────────────────
// Os mesmos codes vêm da função (PLAN_GATE_FREE/PLUS/PRO, AUTH_REQUIRED, etc),
// mais alguns client-only pra estados que só existem no browser (NO_SESSION,
// NETWORK, FILE_TOO_LARGE). ERR_PLAN_GATE é o "umbrella" pra qualquer gate de
// plano (Free trial esgotado, Plus atingiu 30/mês, Pro atingiu 200/mês). O
// detalhamento fica em `details.currentPlan` pra o UI escolher a mensagem.
export const ERR_NO_SESSION = 'NO_SESSION';
export const ERR_PLAN_GATE = 'PLAN_GATE';
export const ERR_NETWORK = 'NETWORK';
export const ERR_UPSTREAM_BUSY = 'UPSTREAM_BUSY';
export const ERR_NOT_IDENTIFIED = 'NOT_IDENTIFIED';
export const ERR_FILE_TOO_LARGE = 'FILE_TOO_LARGE';
export const ERR_FILE_INVALID = 'FILE_INVALID';
export const ERR_UNKNOWN = 'UNKNOWN';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class NameplateAnalysisError extends Error {
  constructor(code, message, cause, details) {
    super(message);
    this.name = 'NameplateAnalysisError';
    this.code = code;
    this.cause = cause ?? null;
    // `details` carrega metadados específicos do código. Pra ERR_PLAN_GATE:
    // { currentPlan, monthlyLimit, used, quotaExhausted, trialExhausted,
    // trialLimit, trialUsed } — o UI escolhe a mensagem/CTA de upgrade com
    // base em currentPlan ('free' | 'plus' | 'pro').
    this.details = details ?? null;
  }
}

// ── Mapeamentos API → form ────────────────────────────────────────────────
// A função retorna `tipo_equipamento` num enum compacto ('split', 'vrf',
// 'chiller'...) mas o select do modal usa labels longos ('Split Hi-Wall',
// 'VRF / VRV'...). Este mapa é a cola.
const TIPO_TO_OPTION = {
  split: 'Split Hi-Wall',
  vrf: 'VRF / VRV',
  chiller: 'Chiller',
  fan_coil: 'Fan Coil',
  self_contained: 'Self Contained',
  janela: 'Outro', // não existe option "janela" no select atual; cai em Outro
  bomba_calor: 'Outro',
  outro: 'Outro',
};

// Refrigerante: o select do modal tem opções fixas. A função já normaliza
// no formato ASHRAE (R-410A) então casa direto — só precisamos mapear pros
// values exatos do select.
const REFRIGERANTE_OPTIONS = new Set(['R-410A', 'R-22', 'R-32', 'R-407C', 'R-134A', 'R-404A']);

/**
 * Mapeia o tipo_equipamento do enum da API pra label do select do modal.
 * Se não houver match, devolve 'Outro' pra não deixar o select num estado
 * inválido. Null/undefined → null (não preenche o campo).
 */
export function mapTipoToOption(tipoFromApi) {
  if (!tipoFromApi) return null;
  const normalized = String(tipoFromApi).toLowerCase().trim();
  return TIPO_TO_OPTION[normalized] ?? 'Outro';
}

/**
 * Normaliza refrigerante pro formato do select. A função já devolve "R-410A"
 * no formato ASHRAE, mas alguns edge cases podem passar com variações ("R410A",
 * "r 410 a", "R134a"). Normaliza agressivamente antes de checar.
 */
export function mapRefrigeranteToOption(refFromApi) {
  if (!refFromApi) return null;
  // Normaliza: remove espaços, uppercase, garante hífen depois do R
  const upper = String(refFromApi).toUpperCase().replace(/\s+/g, '');
  // R410A → R-410A (se ainda não tem hífen)
  const withDash = upper.startsWith('R-') ? upper : upper.replace(/^R/, 'R-');
  if (REFRIGERANTE_OPTIONS.has(withDash)) return withDash;
  // Tenta casar só o "número-letra" (134A → R-134A, 134a → R-134A)
  const digits = upper.match(/R-?([0-9]+[A-Z]?)/);
  if (digits) {
    const candidate = `R-${digits[1]}`;
    if (REFRIGERANTE_OPTIONS.has(candidate)) return candidate;
  }
  return 'Outro';
}

/**
 * Combina marca e modelo numa única string pro campo eq-modelo.
 * A lógica: "marca modelo" se ambos existem; só um dos dois se só um; null se
 * nenhum. Evita frases quebradas tipo "LG " ou " USNW092WSG3".
 */
export function composeMarcaModelo(marca, modelo) {
  const m = (marca ?? '').trim();
  const md = (modelo ?? '').trim();
  if (m && md) return `${m} ${md}`;
  return m || md || null;
}

/**
 * Transforma a resposta crua da função na struct que o wire-up do modal usa
 * pra setar os inputs. Campos omitidos viram null — o caller é responsável
 * por NÃO sobrescrever campos no form se o valor for null.
 */
export function mapApiFieldsToFormShape(apiFields) {
  if (!apiFields || apiFields.identified === false) {
    return { identified: false, notas: apiFields?.notas ?? null };
  }
  return {
    identified: true,
    confidence: apiFields.confidence ?? 'media',
    tipo: mapTipoToOption(apiFields.tipo_equipamento),
    fluido: mapRefrigeranteToOption(apiFields.refrigerante),
    marcaModelo: composeMarcaModelo(apiFields.marca, apiFields.modelo),
    // Campos da etiqueta — expostos pro form completo (16 campos).
    // Todos opcionais: null = "não detectado" → UI mostra placeholder.
    numeroSerie: apiFields.numero_serie ?? null,
    capacidadeBtu: apiFields.capacidade_btu ?? null,
    capacidadeTr: apiFields.capacidade_tr ?? null,
    tensao: apiFields.tensao ?? null,
    potenciaW: apiFields.potencia_w ?? null,
    correnteA: apiFields.corrente_a ?? null,
    correnteAquecA: apiFields.corrente_aquec_a ?? null,
    fases: apiFields.fases ?? null,
    frequenciaHz: apiFields.frequencia_hz ?? null,
    pressaoSuccaoMpa: apiFields.pressao_succao_mpa ?? null,
    pressaoDescargaMpa: apiFields.pressao_descarga_mpa ?? null,
    grauProtecao: apiFields.grau_protecao ?? null,
    anoFabricacao: apiFields.ano_fabricacao ?? null,
    notas: apiFields.notas ?? null,
  };
}

// ── I/O helpers ───────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const comma = typeof result === 'string' ? result.indexOf(',') : -1;
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function normalizeMediaType(type) {
  if (ALLOWED_MIME.has(type)) return type;
  // iOS pode mandar image/heic; a função não suporta. Cai pro default —
  // o user vai receber erro do upstream e pode tirar de novo em JPEG.
  return 'image/jpeg';
}

/**
 * Obtém token Supabase fresco. Mesma estratégia da monetization.js:
 * tenta refresh via rede, cai pra storage se o refresh falhar mas o token
 * no storage ainda não expirou.
 */
async function getFreshAccessToken(client = supabase) {
  let token = null;
  try {
    const { data } = await client.auth.refreshSession();
    token = data?.session?.access_token ?? null;
  } catch (_) {
    // ignora — tenta fallback
  }
  if (token) return token;

  try {
    const { data } = await client.auth.getSession();
    const stored = data?.session?.access_token ?? null;
    if (stored) {
      const payload = JSON.parse(atob(stored.split('.')[1]));
      if (payload?.exp && payload.exp * 1000 > Date.now()) return stored;
    }
  } catch (_) {
    // ignora
  }
  return null;
}

// ── Entry point ───────────────────────────────────────────────────────────

/**
 * Analisa foto da placa e devolve os campos mapeados pro form.
 *
 * @param {File} file — arquivo da foto (JPEG/PNG/WEBP, até 8 MB).
 * @param {object} [opts]
 * @param {object} [opts.supabaseClient] — override pro Supabase client (testes).
 * @returns {Promise<ReturnType<typeof mapApiFieldsToFormShape>>}
 * @throws {NameplateAnalysisError}
 */
export async function analyzeNameplate(file, { supabaseClient = supabase } = {}) {
  // ── 1. Valida o arquivo localmente ───────────────────────────────────────
  if (!file || typeof file !== 'object') {
    throw new NameplateAnalysisError(ERR_FILE_INVALID, 'Arquivo inválido');
  }
  if (!file.type?.startsWith('image/')) {
    throw new NameplateAnalysisError(
      ERR_FILE_INVALID,
      'O arquivo precisa ser uma imagem (JPG, PNG ou WEBP).',
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new NameplateAnalysisError(
      ERR_FILE_TOO_LARGE,
      'Imagem acima de 8 MB. Comprima ou tire outra.',
    );
  }

  // ── 2. Obtém JWT ────────────────────────────────────────────────────────
  const accessToken = await getFreshAccessToken(supabaseClient);
  if (!accessToken) {
    throw new NameplateAnalysisError(ERR_NO_SESSION, 'Faça login pra usar a análise de etiqueta.');
  }

  // ── 3. Prepara payload ──────────────────────────────────────────────────
  let imageBase64;
  try {
    imageBase64 = await fileToBase64(file);
  } catch (err) {
    throw new NameplateAnalysisError(ERR_FILE_INVALID, 'Falha ao ler o arquivo', err);
  }
  const mediaType = normalizeMediaType(file.type);

  // ── 4. Chama a edge function ────────────────────────────────────────────
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
  const endpoint = `${supabaseUrl}/functions/v1/analyze-nameplate`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ image_base64: imageBase64, media_type: mediaType }),
    });
  } catch (err) {
    throw new NameplateAnalysisError(
      ERR_NETWORK,
      'Erro de rede. Cheque sua conexão e tente de novo.',
      err,
    );
  }

  // ── 5. Trata resposta ───────────────────────────────────────────────────
  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {
    // Se não veio JSON, o status code sozinho vai nos guiar
  }

  if (!response.ok || !payload?.ok) {
    const code = payload?.code || response.status;
    const message = payload?.error || `Falha na análise (${response.status}).`;

    if (typeof code === 'string' && code.startsWith('PLAN_GATE_')) {
      const currentPlan =
        typeof payload?.current_plan === 'string' && payload.current_plan.length > 0
          ? String(payload.current_plan).toLowerCase()
          : code === 'PLAN_GATE_PRO'
            ? 'pro'
            : code === 'PLAN_GATE_PLUS'
              ? 'plus'
              : 'free';
      const monthlyLimit = Number.isFinite(Number(payload?.monthly_limit))
        ? Number(payload.monthly_limit)
        : Number.isFinite(Number(payload?.trial_limit))
          ? Number(payload.trial_limit)
          : null;
      const used = Number.isFinite(Number(payload?.used))
        ? Number(payload.used)
        : Number.isFinite(Number(payload?.trial_used))
          ? Number(payload.trial_used)
          : null;
      throw new NameplateAnalysisError(ERR_PLAN_GATE, message, null, {
        currentPlan,
        monthlyLimit,
        used,
        quotaExhausted: Boolean(payload?.quota_exhausted ?? payload?.trial_exhausted),
        // Aliases Free-only mantidos pra UI existente (nameplateCapture.js)
        trialExhausted: Boolean(payload?.trial_exhausted),
        trialLimit: Number.isFinite(Number(payload?.trial_limit))
          ? Number(payload.trial_limit)
          : null,
        trialUsed: Number.isFinite(Number(payload?.trial_used)) ? Number(payload.trial_used) : null,
      });
    }
    if (code === 'UPSTREAM_BUSY' || response.status === 503) {
      throw new NameplateAnalysisError(
        ERR_UPSTREAM_BUSY,
        'Serviço de IA sobrecarregado. Tente em alguns segundos.',
      );
    }
    if (code === 'AUTH_REQUIRED' || code === 'INVALID_JWT' || response.status === 401) {
      throw new NameplateAnalysisError(ERR_NO_SESSION, 'Sessão expirada. Faça login de novo.');
    }
    throw new NameplateAnalysisError(ERR_UNKNOWN, message);
  }

  // ── 6. Mapeia pra shape do form ─────────────────────────────────────────
  const mapped = mapApiFieldsToFormShape(payload.fields);
  if (!mapped.identified) {
    throw new NameplateAnalysisError(
      ERR_NOT_IDENTIFIED,
      mapped.notas ||
        'Não deu pra ler a etiqueta. Tenta uma foto mais nítida, com a etiqueta preenchendo o quadro.',
    );
  }
  // Propaga metadata do teste grátis vindo da edge function — quando o user é
  // Free e acabou de gastar um uso do mês, o client usa pra atualizar o CTA
  // (ex: mudar pra estado 'locked' porque a próxima tentativa vai falhar).
  if (payload && payload.trial && typeof payload.trial === 'object') {
    mapped._trial = {
      consumed: Boolean(payload.trial.consumed),
      limit: Number.isFinite(Number(payload.trial.limit)) ? Number(payload.trial.limit) : null,
      remaining: Number.isFinite(Number(payload.trial.remaining))
        ? Number(payload.trial.remaining)
        : null,
    };
  } else {
    mapped._trial = null;
  }

  // Gate health check: se o edge function sinalizou que o increment do counter
  // falhou (`quota.tracking_failed`), o gate do próximo request ficou cego.
  // Logamos no client pra ter backup do sinal mesmo se os logs do edge forem
  // silenciados por qualquer razão. A UI pode ler `_quotaTrackingFailed` pra
  // um toast discreto se quiser expor — por padrão não fazemos barulho.
  const quota = payload && typeof payload.quota === 'object' ? payload.quota : null;
  if (quota && quota.tracking_failed) {
    console.error('[ALERT][nameplate] quota tracking falhou no servidor', {
      error: quota.tracking_error ?? null,
      plan: quota.plan ?? null,
      limit: quota.limit ?? null,
    });
    mapped._quotaTrackingFailed = true;
    mapped._quotaTrackingError = quota.tracking_error ?? null;
  } else {
    mapped._quotaTrackingFailed = false;
  }
  return mapped;
}
