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

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Auth: header secreto do scheduler. Não tem JWT de usuário (cron-only).
  const provided = req.headers.get('x-cron-secret') ?? '';
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today = new Date();

    // Busca todas as subscriptions ativas
    const { data: subs } = await db.from('push_subscriptions').select('user_id, subscription');
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    let sent = 0;
    for (const sub of subs) {
      // Busca equipamentos do usuário com problemas
      const { data: equips } = await db
        .from('equipamentos')
        .select('id, nome, status, periodicidade_preventiva_dias')
        .eq('user_id', sub.user_id)
        .in('status', ['warn', 'danger']);

      // Busca também equipamentos com preventiva vencida
      const { data: registros } = await db
        .from('registros')
        .select('equip_id, data, proxima')
        .eq('user_id', sub.user_id)
        .order('data', { ascending: false });

      const alerts: string[] = [];

      for (const eq of equips ?? []) {
        if (eq.status === 'danger') alerts.push(`⚠️ ${eq.nome}: requer intervenção`);
        else if (eq.status === 'warn') alerts.push(`🔔 ${eq.nome}: atenção necessária`);
      }

      // Verifica preventivas vencidas
      const seenEquips = new Set();
      for (const reg of registros ?? []) {
        if (seenEquips.has(reg.equip_id)) continue;
        seenEquips.add(reg.equip_id);
        if (reg.proxima) {
          const prox = new Date(reg.proxima);
          const diff = Math.floor((prox.getTime() - today.getTime()) / 86400000);
          if (diff <= 0) {
            const eq = (equips ?? []).find((e) => e.id === reg.equip_id);
            const name = eq?.nome ?? 'Equipamento';
            alerts.push(`📅 ${name}: preventiva vencida`);
          }
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
        console.error(`[Push] Falha para user ${sub.user_id}:`, pushErr);
        // Remove subscription inválida (expirada)
        if ((pushErr as { statusCode?: number }).statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('user_id', sub.user_id);
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
