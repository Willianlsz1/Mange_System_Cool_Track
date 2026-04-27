import webpush from 'https://esm.sh/web-push@3?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=denonext';
import { getCorsHeaders } from '../_shared/cors.ts';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL') ?? 'mailto:suporte@cooltrackpro.com.br';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Secret compartilhado com o trigger que invoca esta função (Supabase
// Scheduled Functions / pg_cron). Sem ele, qualquer um na internet pode
// disparar push spam pra todos os usuários — esta função usa service_role
// e itera push_subscriptions inteira. Fail-closed: se a env não estiver
// setada, todas as chamadas levam 403.
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
// Hardening opcional: assinatura HMAC do scheduler.
// Se setado, exige:
//   x-cron-ts: unix epoch seconds
//   x-cron-signature: hex(HMAC_SHA256(CRON_SIGNING_SECRET, `${ts}.${CRON_SECRET}`))
// Mantém retrocompat: sem env setada, segue no modo legado (apenas x-cron-secret).
const CRON_SIGNING_SECRET = Deno.env.get('CRON_SIGNING_SECRET') ?? '';
const MAX_CLOCK_SKEW_SECONDS = 300;

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

function timingSafeEqual(a: string, b: string): boolean {
  const ta = new TextEncoder().encode(a);
  const tb = new TextEncoder().encode(b);
  if (ta.length !== tb.length) return false;
  let out = 0;
  for (let i = 0; i < ta.length; i += 1) out |= ta[i] ^ tb[i];
  return out === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function isAuthorizedCronRequest(req: Request): Promise<boolean> {
  const providedSecret = req.headers.get('x-cron-secret') ?? '';
  if (!CRON_SECRET || !timingSafeEqual(providedSecret, CRON_SECRET)) {
    return false;
  }

  if (!CRON_SIGNING_SECRET) return true;

  const tsRaw = req.headers.get('x-cron-ts') ?? '';
  const providedSig = (req.headers.get('x-cron-signature') ?? '').toLowerCase();
  const ts = Number.parseInt(tsRaw, 10);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_CLOCK_SKEW_SECONDS) return false;
  if (!providedSig) return false;

  const expected = await hmacHex(CRON_SIGNING_SECRET, `${ts}.${CRON_SECRET}`);
  return timingSafeEqual(providedSig, expected);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth: header secreto do scheduler. Não tem JWT de usuário (cron-only).
  if (!(await isAuthorizedCronRequest(req))) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today = new Date();
    // Busca todas as subscriptions ativas
    const { data: subs } = await db.from('push_subscriptions').select('user_id, subscription');
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    const userIds = [...new Set(subs.map((s) => s.user_id).filter(Boolean))];
    if (!userIds.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    // Reduz N+1: carrega dados em lote e faz fan-out em memória por user.
    const { data: equipamentos = [] } = await db
      .from('equipamentos')
      .select('user_id, id, nome, status')
      .in('user_id', userIds);

    const { data: registros = [] } = await db
      .from('registros')
      .select('user_id, equip_id, data, proxima')
      .in('user_id', userIds)
      .not('proxima', 'is', null)
      .order('data', { ascending: false });

    const equipamentosByUser = new Map<string, Array<Record<string, unknown>>>();
    const latestRegByUserEquip = new Map<string, Map<string, Record<string, unknown>>>();

    for (const eq of equipamentos) {
      const uid = String(eq.user_id || '');
      if (!uid) continue;
      const list = equipamentosByUser.get(uid) || [];
      list.push(eq);
      equipamentosByUser.set(uid, list);
    }

    for (const reg of registros) {
      const uid = String(reg.user_id || '');
      const equipId = String(reg.equip_id || '');
      if (!uid || !equipId) continue;
      const userRegs = latestRegByUserEquip.get(uid) || new Map();
      // registros já vêm em ordem desc; primeiro encontrado por equip é o mais recente.
      if (!userRegs.has(equipId)) userRegs.set(equipId, reg);
      latestRegByUserEquip.set(uid, userRegs);
    }

    let sent = 0;
    for (const sub of subs) {
      const userId = String(sub.user_id || '');
      const equips = (equipamentosByUser.get(userId) || []) as Array<{
        id: string;
        nome: string;
        status: string;
      }>;
      const regs = latestRegByUserEquip.get(userId) || new Map();
      const equipsById = new Map(equips.map((e) => [e.id, e]));

      const alerts: string[] = [];

      for (const eq of equips) {
        if (eq.status === 'danger') alerts.push(`⚠️ ${eq.nome}: requer intervenção`);
        else if (eq.status === 'warn') alerts.push(`🔔 ${eq.nome}: atenção necessária`);
      }

      // Verifica preventivas vencidas
      for (const reg of regs.values()) {
        const prox = new Date(String(reg.proxima || ''));
        const diff = Math.floor((prox.getTime() - today.getTime()) / 86400000);
        if (Number.isFinite(diff) && diff <= 0) {
          const eq = equipsById.get(String(reg.equip_id || ''));
          const name = eq?.nome ?? 'Equipamento';
          alerts.push(`📅 ${name}: preventiva vencida`);
        }
      }

      if (!alerts.length) continue;

      const payload = JSON.stringify({
        title: 'CoolTrack PRO — Atenção necessária',
        body:
          alerts.slice(0, 3).join('\n') + (alerts.length > 3 ? `\n+${alerts.length - 3} mais` : ''),
        tag: 'cooltrack-daily-alert',
        url: '/',
        urgent: alerts.some((a) => a.includes('intervenção')),
      });

      try {
        await webpush.sendNotification(JSON.parse(sub.subscription), payload);
        sent++;
      } catch (pushErr) {
        console.error('[Push] Falha ao enviar notificação:', pushErr);
        // Remove subscription inválida (expirada)
        if ((pushErr as { statusCode?: number }).statusCode === 410) {
          let endpoint = '';
          try {
            const parsed =
              typeof sub.subscription === 'string'
                ? JSON.parse(sub.subscription)
                : sub.subscription;
            endpoint = String(parsed?.endpoint || '');
          } catch {
            endpoint = '';
          }
          if (!endpoint) continue;
          await db
            .from('push_subscriptions')
            .delete()
            .eq('user_id', sub.user_id)
            .eq('subscription->>endpoint', endpoint);
        }
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
