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
 * Gate de plano: Plus+ obrigatório. Free é bloqueado com PLAN_GATE_FREE pro
 * client renderizar upsell. Motivação: custo variável real (~$0.015/análise)
 * + feature que destrava o hábito (feedback do Job Ney Palmeira, ver README).
 */

import { getCorsHeaders } from '../_shared/cors.ts';

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

/** Conjunto canônico de plan_codes que liberam nameplate analysis. */
const ALLOWED_PLANS = new Set(['plus', 'pro']);

function estimateBase64Bytes(base64: string): number {
  // base64 cresce ~4/3 vs binário. Isto é aproximado — o padding final
  // varia em até 2 bytes, mas pra gate de tamanho é mais que suficiente.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
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

  // ── Auth: valida JWT via admin API ─────────────────────────────────────
  // Gateway está com --no-verify-jwt (necessário — projeto usa ES256, gateway
  // só valida HS256), então a validação real acontece aqui.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[analyze-nameplate] SUPABASE_URL/SERVICE_ROLE_KEY not set');
    return errorResponse(req, 'SERVER_MISCONFIGURED', 'Server misconfigured', 500);
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return errorResponse(req, 'AUTH_REQUIRED', 'Login obrigatório pra analisar placa', 401);
  }

  const jwtPayload = decodeJwtPayload(token);
  const userId = (jwtPayload?.sub ?? '') as string;
  if (!userId) {
    return errorResponse(req, 'INVALID_JWT', 'Token sem identificador de usuário', 401);
  }

  // Verifica que o userId é real. Isto "custa" um request HTTP mas impede
  // que alguém forje um JWT com um sub arbitrário (o gateway normalmente
  // faria isso, mas como ele tá com --no-verify-jwt, cabe a nós).
  let userRes: Response;
  try {
    userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
  } catch (err) {
    console.error('[analyze-nameplate] admin user lookup failed', err);
    return errorResponse(req, 'AUTH_UNAVAILABLE', 'Não foi possível validar sessão', 503);
  }
  if (!userRes.ok) {
    console.warn('[analyze-nameplate] invalid userId', { userId, status: userRes.status });
    return errorResponse(req, 'INVALID_JWT', 'Sessão inválida', 401);
  }

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

  if (!ALLOWED_PLANS.has(planCode)) {
    return errorResponse(
      req,
      'PLAN_GATE_FREE',
      'Cadastro por foto da placa é recurso Plus+. Faça upgrade pra destravar.',
      403,
    );
  }

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

  return jsonResponse(req, {
    ok: true,
    fields: toolBlock.input,
    raw: {
      model: CLAUDE_MODEL,
      stop_reason: claudeData.stop_reason ?? null,
      usage: claudeData.usage ?? null,
    },
  });
});
