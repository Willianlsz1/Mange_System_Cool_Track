/**
 * pushNotifications.js
 * Web Push: pede permissão, cria subscription e salva no Supabase.
 *
 * A VAPID_PUBLIC_KEY vem de VITE_VAPID_PUBLIC_KEY no .env.
 * A chave privada fica APENAS no segredo da Edge Function (nunca no frontend).
 */
import { supabase } from './supabase.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function setupPushNotifications(userId) {
  if (!VAPID_PUBLIC_KEY) return; // não configurado
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return; // não suportado

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Salva/atualiza a subscription no Supabase
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        subscription: JSON.stringify(subscription),
        user_agent: navigator.userAgent.slice(0, 200),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) console.warn('[Push] Falha ao salvar subscription:', error.message);
  } catch (err) {
    console.warn('[Push] Erro ao configurar push:', err);
  }
}

export async function teardownPushNotifications(userId) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
    if (userId) await supabase.from('push_subscriptions').delete().eq('user_id', userId);
  } catch (err) {
    console.warn('[Push] Erro ao remover subscription:', err);
  }
}
