/**
 * E2E auth fixture — injeta sessão Supabase fake + intercepta chamadas
 * de rede pra que o app bootstrap como usuário autenticado SEM tocar o
 * Supabase real.
 *
 * Uso:
 *   import { setupAuthedPage } from '../fixtures/authedSession.js';
 *   test.beforeEach(async ({ page }) => {
 *     await setupAuthedPage(page);
 *     await page.goto('/');
 *   });
 *
 * Projeto de teste padrão usa VITE_SUPABASE_URL=http://127.0.0.1:54321,
 * então a storage key do Supabase é `sb-127-auth-token`.
 */

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_USER_EMAIL = 'tecnico@teste.cooltrack';

// JWT placeholder com payload válido (sub/role/exp). Não precisa ser
// assinado corretamente — como todas as respostas da API são interceptadas,
// o backend nunca valida a assinatura.
const FAKE_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6OTk5OTk5OTk5OX0.' +
  'ZmFrZS1zaWduYXR1cmU';

const FAKE_SESSION = {
  access_token: FAKE_ACCESS_TOKEN,
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: 'bearer',
  user: {
    id: FAKE_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: FAKE_USER_EMAIL,
    app_metadata: { provider: 'email' },
    user_metadata: { nome: 'Tecnico Teste' },
  },
};

const FAKE_PROFILE = {
  id: FAKE_USER_ID,
  nome: 'Tecnico Teste',
  plan: 'free',
  subscription_status: null,
  is_dev: false,
};

/**
 * Storage key do Supabase: depende do hostname. Em testes rodamos contra
 * 127.0.0.1, então `sb-127-auth-token`. Se rodar contra outro host, ajusta.
 */
function storageKeyFor(baseUrl) {
  try {
    const host = new URL(baseUrl).hostname;
    return `sb-${host.split('.')[0]}-auth-token`;
  } catch {
    return 'sb-127-auth-token';
  }
}

export async function setupAuthedPage(page) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

  // 1. Pre-popula a sessão no localStorage antes do app rodar.
  await page.addInitScript(
    ({ key, session }) => {
      try {
        localStorage.setItem(key, JSON.stringify(session));
        // Silencia FTX + tour pra não interferirem com os asserts.
        localStorage.setItem('cooltrack-ftx-done', '1');
        localStorage.setItem('cooltrack-tour-done', '1');
      } catch {
        /* storage indisponível — deixa o app quebrar natural */
      }
    },
    { key: storageKeyFor(supabaseUrl), session: FAKE_SESSION },
  );

  // 2. Intercepta chamadas ao backend Supabase.
  // - /auth/v1/user → devolve o usuário fake (Auth.getUser)
  // - /auth/v1/token → refresh/exchange, devolve o mesmo session
  // - /rest/v1/profiles → perfil Free
  // - /rest/v1/equipamentos|registros|setores|tecnicos → array vazio
  // - /rest/v1/usage_monthly → sem uso
  // - /rest/v1/* (fallback) → array vazio pra evitar 404 barulhento
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_SESSION.user),
    }),
  );

  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_SESSION),
    }),
  );

  await page.route('**/rest/v1/profiles**', (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([FAKE_PROFILE]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_PROFILE),
    });
  });

  // Fallback pra `/rest/v1/**` (tabelas que não têm handler específico).
  // Distingue método pra simular persistência realisticamente (audit §1.4) —
  // antes, POST/PATCH caíam num 200 com `[]` e o app achava que salvou,
  // mascarando bugs de request malformado.
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const method = req.method();

    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    }

    if (method === 'DELETE') {
      return route.fulfill({
        status: 204,
        contentType: 'application/json',
        body: '',
      });
    }

    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      // Ecoa o payload com um `id` gerado — suficiente pro optimistic
      // update do app considerar o upsert bem-sucedido. Supabase responde
      // com array quando o header Prefer=return=representation está ativo
      // (padrão do supabase-js), então devolvemos array.
      let payload;
      try {
        payload = req.postDataJSON();
      } catch {
        payload = null;
      }
      const rows = Array.isArray(payload) ? payload : [payload || {}];
      const hydrated = rows.map((row) => ({
        id: (row && row.id) || `e2e-${Math.random().toString(36).slice(2, 10)}`,
        ...(row || {}),
      }));
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(hydrated),
      });
    }

    // Métodos não previstos: deixa passar pra não esconder bug novo.
    return route.continue();
  });
}

export const fakeUser = {
  id: FAKE_USER_ID,
  email: FAKE_USER_EMAIL,
};
