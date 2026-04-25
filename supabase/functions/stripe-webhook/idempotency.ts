// Idempotency helpers — funções puras isoladas do runtime Deno pra serem
// testáveis em vitest. O index.ts da Edge Function importa daqui.
//
// Por que separado: index.ts importa libs com URL HTTPS (`https://esm.sh/...`)
// que vitest não consegue resolver. Ao manter a lógica pura aqui, conseguimos
// cobrir isClaimStuck() em testes unitários sem mockar Deno/Supabase/Stripe.

/**
 * Janela de tempo após a qual uma reserva no ledger sem progresso
 * (sem processed_at e sem error_message) é considerada abandonada.
 * 5 minutos cobre largamente o pior caso de processamento normal
 * (Edge Function timeout no Supabase é 60s) sem segurar retries do
 * Stripe muito tempo.
 */
export const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Determina se uma reserva no ledger ficou abandonada — retry pós-crash
 * deveria poder re-reivindicar e processar do zero.
 *
 * @param claimedAtIso - valor da coluna claimed_at (timestamptz serializado).
 * @param now - timestamp do momento da decisão (parametrizado pra teste).
 * @param thresholdMs - janela em ms acima da qual é stuck (default: 5 min).
 *
 * Retorna false em qualquer dado inválido (null, undefined, string não-data,
 * ISO mal-formado) — fail-safe: nunca afirma "stuck" sem evidência clara.
 */
export function isClaimStuck(
  claimedAtIso: string | null | undefined,
  now: Date,
  thresholdMs: number = STUCK_THRESHOLD_MS,
): boolean {
  if (!claimedAtIso) return false;
  const claimedTime = new Date(claimedAtIso).getTime();
  if (!Number.isFinite(claimedTime)) return false;
  return now.getTime() - claimedTime > thresholdMs;
}
