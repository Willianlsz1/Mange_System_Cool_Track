// @ts-nocheck
/**
 * CoolTrack Pro — Edge Function: analyze-nameplate
 *
 * Recebe uma imagem da placa de identificação de um equipamento HVAC e
 * devolve um JSON com os campos extraídos (marca, modelo, série, capacidade,
 * refrigerante, tensão, etc). Usa Claude vision + tool_use pra saída
 * estruturada — mais robusto que parse de texto livre.
 *
 * O produto-insight é simples: técnico não preenche formulário. Mas ele
 * aponta a câmera. Essa function é a cola entre "aponta a câmera" e
 * "formulário pré-preenchido pronto pra confirmar".
 *
 * Contrato:
 *   POST /functions/v1/analyze-nameplate
 *   Headers: Authorization: Bearer <supabase-jwt>    (obrigatório)
 *   Body: { image_base64: string, media_type?: 'image/jpeg' | 'image/png' | 'image/webp' }
 *   Resp 200: { ok: true, fields: {...}, raw: {...debug} }
 *   Resp 4xx/5xx: { ok: false, error: string, code: string }
 *
 * Auth: deployada com --no-verify-jwt (gateway) porque o projeto assina JWT
 * com ES256 e o gateway do Supabase só valida HS256. A validação é feita
 * internamente via admin API com service role — mesmo padrão que as funções
 * create-checkout-session, create-portal-session, stripe-webhook.
 *
 * Gate de plano: cada tier tem cota mensal própria pra conter custo variável
 * em USD (~$0.015/análise). Free ganha 1 uso/mês como teste grátis recorrente
 * (demonstra valor sem liberar workflow real). Plus: 30/mês — cobre técnico
 * autônomo com folga. Pro: 200/mês — cobre equipe pequena. Acima da cota o
 * client recebe PLAN_GATE_<TIER> com quota_exhausted=true, usado_/limite_
 * e current_plan pra renderizar o upsell certo.
 */

import { getCorsHeaders } from '../_shared/cors.ts';
import { verifyUserToken } from '../_shared/auth.ts';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_API_VERSION = '2023-06-01';

// Tamanho máximo aceito pra imagem (em bytes, pré-base64). 8 MB cobre
// fotos de celular razoáveis. Acima disso é desperdício — a API ignora
// detalhe além de ~1568px do lado maior e vai custar caro à toa.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Schema do tool_use. Cada campo vira um campo do form de cadastro de
 * equipamento no CoolTrack. `identified` é o switch master: se false,
 * o client deve fallback pro cadastro manual (em vez de exibir campos
 * vazios como se fossem sugestões).
 *
 * `confidence` é deliberadamente categórica (alta/media/baixa) em vez de
 * numérica — LLM não tem calibração bayesiana de verdade, então 0-100%
 * é falsa precisão. Categorias semânticas evitam esse teatro.
 */
const NAMEPLATE_TOOL = {
  name: 'extract_nameplate_fields',
  description:
    'Extrai campos de identificação de uma placa de equipamento HVAC (ar-condicionado, chiller, VRF, fan coil, etc) a partir da foto da placa metálica do fabricante.',
  input_schema: {
    type: 'object',
    properties: {
      identified: {
        type: 'boolean',
        description:
          'true se a placa está legível e você conseguiu extrair pelo menos marca OU modelo. false se a foto não mostra uma placa, está ilegível, ou mostra algo que não é equipamento HVAC.',
      },
      confidence: {
        type: 'string',
        enum: ['alta', 'media', 'baixa'],
        description:
          'Confiança geral na extração: alta = placa nítida e completa; media = alguns campos ilegíveis; baixa = muita inferência ou foto ruim.',
      },
      marca: {
        type: 'string',
        description:
          'Fabricante. Ex: "LG", "Daikin", "Carrier", "Midea", "Trane", "Elgin". Normalize maiúsculas/minúsculas.',
      },
      modelo: {
        type: 'string',
        description: 'Código/nome do modelo. Ex: "GBCSA-24CRFMA-2", "FTXS50K".',
      },
      numero_serie: {
        type: 'string',
        description: 'Número de série (Serial No / S/N / SERIAL).',
      },
      tipo_equipamento: {
        type: 'string',
        enum: [
          'split',
          'vrf',
          'chiller',
          'fan_coil',
          'self_contained',
          'janela',
          'bomba_calor',
          'outro',
        ],
        description:
          'Tipo de equipamento HVAC inferido da placa/contexto. Use "outro" se não for possível classificar.',
      },
      capacidade_btu: {
        type: 'number',
        description:
          'Capacidade de refrigeração em BTU/h. Se a placa der em TR/kW/kcal, converta pra BTU/h (1 TR = 12000 BTU/h; 1 kW = 3412 BTU/h).',
      },
      capacidade_tr: {
        type: 'number',
        description:
          'Capacidade em TR (tonelada de refrigeração). Se a placa der em BTU, converta (12000 BTU/h = 1 TR).',
      },
      refrigerante: {
        type: 'string',
        description: 'Fluido refrigerante. Ex: "R-22", "R-410A", "R-32", "R-134a".',
      },
      tensao: {
        type: 'string',
        description: 'Tensão nominal. Ex: "220V", "220-240V", "380V". Inclua a unidade.',
      },
      potencia_w: {
        type: 'number',
        description: 'Potência elétrica em Watts. Se a placa der em kW, multiplique por 1000.',
      },
      corrente_a: {
        type: 'number',
        description: 'Corrente nominal em Amperes.',
      },
      fases: {
        type: 'string',
        enum: ['monofasico', 'bifasico', 'trifasico'],
        description: 'Sistema elétrico (1~ = monofásico, 2~ = bifásico, 3~ = trifásico).',
      },
      frequencia_hz: {
        type: 'number',
        enum: [50, 60],
        description: 'Frequência de rede em Hz. Brasil usa 60 Hz.',
      },
      ano_fabricacao: {
        type: 'number',
        description: 'Ano de fabricação (4 dígitos).',
      },
      notas: {
        type: 'string',
        description:
          'Observações livres: dados importantes da placa que não couberam nos campos acima (selo INMETRO, classificação energética, país de origem, observações sobre a foto, etc).',
      },
    },
    required: ['identified', 'confidence'],
  },
};

const SYSTEM_PROMPT = `Você é um assistente especializado em identificar equipamentos de ar-condicionado e refrigeração a partir da placa de identificação do fabricante (placa metálica com especificações técnicas).

REGRAS IMPORTANTES:

1. Se a foto NÃO mostra uma placa de equipamento HVAC (ex: mostra um aparelho inteiro de longe, mostra outro tipo de equipamento, está muito borrada, é um meme, etc), retorne identified=false e explique em notas.

2. Só extraia um campo se você tiver certeza razoável do que leu. É MUITO melhor omitir um campo do que chutar. Laudos técnicos (NR-13, NBR-16401) dependem desses dados.

3. Converta unidades quando útil: sempre preencha capacidade_btu E capacidade_tr se um dos dois estiver na placa.

4. Normalize o refrigerante pro formato padrão da ASHRAE: "R-410A" (não "R410A" nem "R 410 A").

5. Se houver múltiplas capacidades na placa (ex: refrigeração vs aquecimento), use a de refrigeração (cooling).

6. Nunca invente um número de série. Se estiver ilegível, omita o campo.

Sempre chame a tool extract_nameplate_fields com os dados extraídos.`;

function jsonResponse(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function errorResponse(req: Request, code: string, message: string, status = 400) {
  return jsonResponse(req, { ok: false, error: message, code }, status);
}

/**
 * Decodifica payload de JWT sem verificar assinatura. A verificação real
 * vem logo depois via admin API — é o padrão estabelecido pelas outras
 * edge functions deste projeto (create-portal-session etc).
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/** Resource key alinhado com usage_monthly.resource_check e usageLimits.js. */
const USAGE_RESOURCE = 'nameplate_analysis';

/**
 * Cotas mensais por plano — alinhadas com src/core/usageLimits.js.
 * Free: 1/mês (teste grátis recorrente, não ferramenta).
 * Plus: 30/mês (técnico autônomo — ~1 cadastro por dia útil com folga).
 * Pro:  200/mês (equipe pequena em rollout).
 * Existem pra proteger margem — o custo por análise é em USD via API da
 * Anthropic. "Ilimitado" nesse recurso vira risco de cauda longa/abuso.
 */
const NAMEPLATE_FREE_MONTHLY_LIMIT = 1;
const NAMEPLATE_PLUS_MONTHLY_LIMIT = 30;
const NAMEPLATE_PRO_MONTHLY_LIMIT = 200;

function monthlyLimitForPlan(planCode: string): number {
  if (planCode === 'pro') return NAMEPLATE_PRO_MONTHLY_LIMIT;
  if (planCode === 'plus') return NAMEPLATE_PLUS_MONTHLY_LIMIT;
  return NAMEPLATE_FREE_MONTHLY_LIMIT;
}

function planGateCode(planCode: string): string {
  if (planCode === 'pro') return 'PLAN_GATE_PRO';
  if (planCode === 'plus') return 'PLAN_GATE_PLUS';
  return 'PLAN_GATE_FREE';
}

/**
 * Pricing table do modelo usado. Valores em USD por 1M tokens (fonte:
 * https://www.anthropic.com/pricing#api — snapshot de 2026-04). Se trocarmos
 * o modelo, atualizar aqui. Cache mais novo é ignorado: nameplate tem
 * mensagem sempre nova (imagem única), cache hit ratio ~0.
 */
const CLAUDE_SONNET_4_6_PRICING = {
  inputUsdPer1M: 3, // $3 por 1M tokens de input
  outputUsdPer1M: 15, // $15 por 1M tokens de output
};

function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  // Só Sonnet 4-6 por enquanto — se adicionarmos mais modelos, generalizar.
  if (model !== 'claude-sonnet-4-6') return 0;
  const p = CLAUDE_SONNET_4_6_PRICING;
  const cost =
    (Math.max(0, inputTokens) * p.inputUsdPer1M) / 1_000_000 +
    (Math.max(0, outputTokens) * p.outputUsdPer1M) / 1_000_000;
  // Arredonda pra 6 casas (limite da coluna numeric(10,6)). Evita erros
  // raros de precision flutuante gerarem valores tipo 0.0000012500000003.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Registra uma chamada à IA na tabela ai_usage_cost. Best-effort — falhas
 * são logadas e engolidas pra não quebrar a resposta principal.
 */
async function logAiUsageCost(
  supabaseUrl: string,
  serviceRoleKey: string,
  row: {
    user_id: string;
    resource: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    success: boolean;
  },
): Promise<void> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/ai_usage_cost`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      // Perda de observabilidade financeira — não mata o gate, mas queremos
      // saber pra não descobrir no fim do mês que o ai_usage_cost estava
      // vazio. Level error pra cair nos mesmos alertas.
      console.error('[ALERT][analyze-nameplate] ai_usage_cost insert failed', {
        user_id: row.user_id,
        status: res.status,
        body: txt.slice(0, 400),
      });
    }
  } catch (err) {
    console.error('[ALERT][analyze-nameplate] ai_usage_cost insert threw', {
      user_id: row.user_id,
      err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
    });
  }
}

function planGateMessage(planCode: string, limit: number): string {
  if (planCode === 'pro') {
    return `Você já usou as ${limit} análises por foto do plano Pro neste mês. A cota reseta no dia 1º. Se precisa de mais, fala com a gente — conseguimos ajustar.`;
  }
  if (planCode === 'plus') {
    return `Você já usou as ${limit} análises por foto do plano Plus neste mês. Faça upgrade pra Pro pra ter até ${NAMEPLATE_PRO_MONTHLY_LIMIT} análises/mês, ou aguarde o próximo ciclo.`;
  }
  return 'Você já usou seu teste grátis de análise por foto este mês. Assine o Plus pra escanear até 30/mês ou o Pro pra 200/mês.';
}

function estimateBase64Bytes(base64: string): number {
  // base64 cresce ~4/3 vs binário. Isto é aproximado — o padding final
  // varia em até 2 bytes, mas pra gate de tamanho é mais que suficiente.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Retorna o primeiro dia do mês UTC no formato "YYYY-MM-01". Alinhado com
 * normalizeMonthStart() do usageLimits.js do client — garante que o contador
 * mensal é o mesmo independente de onde o fetch parte.
 */
function firstDayOfMonthUtc(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Carrega o used_count do resource pra este mês. Usa service_role — bypass
 * de RLS intencional (gate de quota é lógica de servidor, não de client).
 * Retorna 0 em qualquer erro pra não bloquear o feature por infra quebrada.
 */
async function loadMonthlyUsed(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  resource: string,
  monthStart: string,
): Promise<number> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/usage_monthly?user_id=eq.${userId}&month_start=eq.${monthStart}&resource=eq.${resource}&select=used_count`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      // Mesmo risco do increment: lookup retornando 0 em erro = gate libera
      // indevidamente. Sinaliza alto.
      console.error('[ALERT][analyze-nameplate] quota lookup failed — gate pode estar cego', {
        userId,
        resource,
        monthStart,
        status: res.status,
        body: txt.slice(0, 400),
      });
      return 0;
    }
    const rows = (await res.json()) as Array<{ used_count?: number | string }>;
    const parsed = Number.parseInt(String(rows?.[0]?.used_count ?? 0), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch (err) {
    console.error('[ALERT][analyze-nameplate] quota lookup threw — gate pode estar cego', {
      userId,
      resource,
      monthStart,
      err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
    });
    return 0;
  }
}

type IncrementErrorKind =
  | 'rpc_rejected' // 4xx — constraint check, permission, resource inválido
  | 'rpc_server_error' // 5xx
  | 'rpc_network_error' // fetch lançou
  | 'rpc_parse_error'; // 2xx mas payload não é número

/**
 * Incrementa (ou cria) o contador mensal do usuário pra este resource.
 * Chama a RPC via user JWT — a RPC exige auth.uid() == p_user_id, então
 * precisa ser a sessão do user, não service_role.
 *
 * Retorna `{ used, error }`:
 *  - `used` = novo used_count se sucesso, `null` se falhou.
 *  - `error` = código da falha (ver IncrementErrorKind) ou `null` em sucesso.
 *
 * IMPORTANTE: toda falha aqui é CRÍTICA pro gate — se o counter não sobe, o
 * `loadMonthlyUsed` da próxima chamada lê 0 e o gate libera indefinidamente
 * (= bypass de plano). Por isso logamos com prefixo `[ALERT]` e level `error`
 * pra ser trivial alertar via `log_analytics` no Supabase. Não propagamos
 * exceção porque o user já recebeu o valor da IA — melhor sinalizar no payload
 * (`quota.tracking_failed=true`) do que quebrar a resposta.
 */
async function incrementMonthlyUsage(
  supabaseUrl: string,
  serviceRoleKey: string,
  userJwt: string,
  userId: string,
  resource: string,
  monthStart: string,
): Promise<{ used: number | null; error: IncrementErrorKind | null }> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/increment_monthly_usage`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${userJwt}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_resource: resource,
        p_month_start: monthStart,
        p_delta: 1,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const kind: IncrementErrorKind = res.status >= 500 ? 'rpc_server_error' : 'rpc_rejected';
      console.error('[ALERT][analyze-nameplate] quota increment failed — gate está cego', {
        kind,
        userId,
        resource,
        monthStart,
        status: res.status,
        body: txt.slice(0, 400),
      });
      return { used: null, error: kind };
    }
    const payload = await res.json();
    const used = typeof payload === 'number' ? payload : Number(payload);
    if (!Number.isFinite(used)) {
      console.error('[ALERT][analyze-nameplate] quota increment returned non-numeric payload', {
        userId,
        resource,
        monthStart,
        payload,
      });
      return { used: null, error: 'rpc_parse_error' };
    }
    return { used, error: null };
  } catch (err) {
    console.error('[ALERT][analyze-nameplate] quota increment threw — gate está cego', {
      userId,
      resource,
      monthStart,
      err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
    });
    return { used: null, error: 'rpc_network_error' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return errorResponse(req, 'METHOD_NOT_ALLOWED', 'Use POST', 405);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) {
    console.error('[analyze-nameplate] ANTHROPIC_API_KEY not set');
    return errorResponse(req, 'MISSING_API_KEY', 'Server misconfigured', 500);
  }

  // ── Auth: valida token via Supabase Auth server ─────────────────────────
  // Gateway está com --no-verify-jwt (necessário — projeto usa ES256, gateway
  // só valida HS256), então a validação real acontece aqui via
  // verifyUserToken, que cria um client com o token do user e chama
  // .auth.getUser(). O Auth server valida a assinatura ES256 e rejeita
  // tokens forjados. Decodificar JWT manualmente + checar UUID no admin API
  // NÃO autentica — é uma vulnerabilidade.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('[analyze-nameplate] SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY not set');
    return errorResponse(req, 'SERVER_MISCONFIGURED', 'Server misconfigured', 500);
  }

  const auth = await verifyUserToken(req, supabaseUrl, anonKey);
  if (!auth.ok) {
    return errorResponse(req, auth.code, auth.message, auth.status);
  }
  const userId = auth.user.id;

  // ── Plan gate: Plus+ obrigatório ───────────────────────────────────────
  // Carrega plan_code do profile. Fallback pra 'free' se não achar (ou se a
  // coluna vier null) — mais conservador: user não pagante não destrava.
  let planCode = 'free';
  try {
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=plan_code,plan,subscription_status`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json',
        },
      },
    );
    if (profileRes.ok) {
      const rows = (await profileRes.json()) as Array<{
        plan_code?: string;
        plan?: string;
        subscription_status?: string;
      }>;
      const profile = rows[0] ?? {};
      const raw = String(profile.plan_code || profile.plan || 'free').toLowerCase();
      // Só respeita plano pago se status for active/trialing. Canceled/past_due
      // volta pra free — alinha com getEffectivePlan() do cliente.
      const status = String(profile.subscription_status || '').toLowerCase();
      const paidActive = status === 'active' || status === 'trialing' || raw === 'free';
      planCode = paidActive ? raw : 'free';
    } else {
      console.warn('[analyze-nameplate] profile lookup failed', {
        userId,
        status: profileRes.status,
      });
    }
  } catch (err) {
    console.error('[analyze-nameplate] profile fetch threw', err);
  }

  // ── Quota mensal por plano ─────────────────────────────────────────────
  // Cada tier tem seu próprio limite (Free=1, Plus=30, Pro=200). O gate é
  // aplicado ANTES da chamada à IA (pra não gastar token à toa) e o
  // incremento é feito DEPOIS do sucesso (pra não cobrar em caso de falha).
  const monthStart = firstDayOfMonthUtc();
  const monthlyLimit = monthlyLimitForPlan(planCode);
  const usedBefore = await loadMonthlyUsed(
    supabaseUrl,
    serviceRoleKey,
    userId,
    USAGE_RESOURCE,
    monthStart,
  );

  if (usedBefore >= monthlyLimit) {
    return jsonResponse(
      req,
      {
        ok: false,
        code: planGateCode(planCode),
        error: planGateMessage(planCode, monthlyLimit),
        current_plan: planCode,
        quota_exhausted: true,
        monthly_limit: monthlyLimit,
        used: usedBefore,
        // Mantém compat com clients legados que leem trial_*
        trial_exhausted: planCode === 'free',
        trial_limit: planCode === 'free' ? monthlyLimit : undefined,
        trial_used: planCode === 'free' ? usedBefore : undefined,
      },
      403,
    );
  }

  const quotaRemainingBefore = Math.max(0, monthlyLimit - usedBefore - 1);

  let body: { image_base64?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 'INVALID_JSON', 'Body deve ser JSON válido');
  }

  const imageBase64 = typeof body.image_base64 === 'string' ? body.image_base64.trim() : '';
  const mediaType = typeof body.media_type === 'string' ? body.media_type : 'image/jpeg';

  if (!imageBase64) {
    return errorResponse(req, 'MISSING_IMAGE', 'image_base64 é obrigatório');
  }
  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return errorResponse(
      req,
      'INVALID_MEDIA_TYPE',
      'media_type deve ser image/jpeg, image/png ou image/webp',
    );
  }

  const approxBytes = estimateBase64Bytes(imageBase64);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return errorResponse(
      req,
      'IMAGE_TOO_LARGE',
      `Imagem acima de ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Comprima antes de enviar.`,
      413,
    );
  }

  // Chamada à Claude API. O tool_choice "any" força o modelo a chamar
  // a tool — ele não pode "só responder em texto". Isso simplifica o
  // parsing do lado cliente (sempre esperamos tool_use no response).
  const claudeRequest = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [NAMEPLATE_TOOL],
    tool_choice: { type: 'tool', name: 'extract_nameplate_fields' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Analise esta placa de equipamento HVAC e extraia os campos usando a tool disponível.',
          },
        ],
      },
    ],
  };

  let claudeRes: Response;
  try {
    claudeRes = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': CLAUDE_API_VERSION,
      },
      body: JSON.stringify(claudeRequest),
    });
  } catch (err) {
    console.error('[analyze-nameplate] fetch failed', err);
    return errorResponse(
      req,
      'UPSTREAM_UNREACHABLE',
      'Não foi possível contatar o serviço de IA',
      502,
    );
  }

  if (!claudeRes.ok) {
    const errText = await claudeRes.text().catch(() => '');
    console.error('[analyze-nameplate] Claude API error', claudeRes.status, errText);
    // Rate limit / overload → sinalizar pro client tentar de novo
    if (claudeRes.status === 429 || claudeRes.status === 529) {
      return errorResponse(
        req,
        'UPSTREAM_BUSY',
        'Serviço de IA sobrecarregado, tente em alguns segundos',
        503,
      );
    }
    return errorResponse(req, 'UPSTREAM_ERROR', 'Falha ao analisar a imagem', 502);
  }

  let claudeData: {
    content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
    stop_reason?: string;
    usage?: Record<string, number>;
  };
  try {
    claudeData = await claudeRes.json();
  } catch (err) {
    console.error('[analyze-nameplate] invalid JSON from Claude', err);
    return errorResponse(req, 'UPSTREAM_INVALID', 'Resposta inválida do serviço de IA', 502);
  }

  // Pega o primeiro tool_use bloco — é o que importa. text blocks, se
  // houver, são thinking/comentários do modelo que a gente ignora.
  const toolBlock = (claudeData.content || []).find(
    (c) => c.type === 'tool_use' && c.name === 'extract_nameplate_fields',
  );
  if (!toolBlock || !toolBlock.input) {
    console.error('[analyze-nameplate] no tool_use block in response', claudeData);
    return errorResponse(req, 'NO_TOOL_CALL', 'IA não retornou extração estruturada', 502);
  }

  // Log de custo USD (best-effort). Rodamos SEMPRE que a Claude API retornou
  // tokens — mesmo se depois a gente falhar em parsear o tool_use. Assim
  // capturamos os tokens gastos, que é o que nos custa. success=true só se
  // o tool_block veio bem-formado (toolBlock.input presente).
  const usageIn = Number(claudeData?.usage?.input_tokens ?? 0);
  const usageOut = Number(claudeData?.usage?.output_tokens ?? 0);
  const costUsd = computeCostUsd(CLAUDE_MODEL, usageIn, usageOut);
  // Fire-and-forget — não queremos atrasar a resposta em ~100ms de round-trip
  // ao Postgres pra algo que é pura telemetria.
  logAiUsageCost(supabaseUrl, serviceRoleKey, {
    user_id: userId,
    resource: USAGE_RESOURCE,
    model: CLAUDE_MODEL,
    input_tokens: Number.isFinite(usageIn) ? usageIn : 0,
    output_tokens: Number.isFinite(usageOut) ? usageOut : 0,
    cost_usd: costUsd,
    success: true,
  });

  // Incrementa o contador DEPOIS do sucesso — vale pra Free/Plus/Pro. Falha
  // aqui é CRÍTICA pro gate (counter travado em 0 = gate cego = bypass de
  // plano). O incrementMonthlyUsage loga com `[ALERT]` em error level; aqui
  // expomos `tracking_failed=true` no payload pro client surfaçar um toast
  // discreto e pra logs do app terem o sinal também. Não fail-closed porque
  // o token da Anthropic já foi gasto; derrubar a resposta seria pior UX
  // sem impedir o dano (custo).
  const { used: newUsed, error: incrementError } = await incrementMonthlyUsage(
    supabaseUrl,
    serviceRoleKey,
    token,
    userId,
    USAGE_RESOURCE,
    monthStart,
  );
  const trackingFailed = incrementError !== null;
  const remaining = newUsed !== null ? Math.max(0, monthlyLimit - newUsed) : quotaRemainingBefore;

  const quotaPayload = {
    consumed: true,
    plan: planCode,
    limit: monthlyLimit,
    used: newUsed ?? usedBefore + 1,
    remaining,
    ...(trackingFailed ? { tracking_failed: true, tracking_error: incrementError } : {}),
  };

  return jsonResponse(req, {
    ok: true,
    fields: toolBlock.input,
    // `quota` é o shape novo, `trial` fica como alias só pra clients Free
    // antigos não quebrarem. Novos consumidores devem ler `quota`.
    quota: quotaPayload,
    trial:
      planCode === 'free'
        ? {
            consumed: true,
            limit: monthlyLimit,
            remaining,
          }
        : null,
    raw: {
      model: CLAUDE_MODEL,
      stop_reason: claudeData.stop_reason ?? null,
      usage: claudeData.usage ?? null,
    },
  });
});
