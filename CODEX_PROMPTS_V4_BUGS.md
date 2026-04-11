# CoolTrack Pro — Codex Prompts V4: Bug Fixes Críticos

## BUG-A — Botão de ajuda dispara o tour imediatamente (bloqueia dropdown)

### Diagnóstico

Em `src/ui/components/tour.js`, o método `initIfFirstVisit()` chama `this.bindHelpButton()`, que anexa um listener de `click` diretamente no elemento `#header-help-btn`:

```js
// tour.js — linhas 53–59 (PROBLEMA)
bindHelpButton() {
  const helpBtn = document.getElementById('header-help-btn');
  if (!helpBtn || helpBtn.dataset.tourBound === '1') return;
  helpBtn.dataset.tourBound = '1';
  helpBtn.addEventListener('click', () => this.restart()); // ← isso está errado
},
```

Esse botão tem `data-action="toggle-help-menu"` e é o **toggle do dropdown de ajuda**, não o item "Ver tutorial". Quando o usuário clica no ícone de ajuda, dois eventos disparam simultaneamente:

1. `toggle-help-menu` → abre o dropdown ✓
2. O listener do `tour.js` → `Tour.restart()` → sobrepõe a tela com o tour ✗

O handler correto para iniciar o tour a partir do item "Ver tutorial" já existe em `src/ui/controller/handlers/navigationHandlers.js` (linhas 39–42):

```js
on('help-open-tutorial', () => {
  setHelpMenuState(false);
  Tour.restart();
});
```

### Correção

**Arquivo:** `src/ui/components/tour.js`

1. Remover o corpo inteiro do método `bindHelpButton()` — ele não deve mais fazer nenhum binding, pois o `navigationHandlers.js` já cuida disso corretamente.
2. Manter o método como no-op para não quebrar a chamada existente em `initIfFirstVisit()`.
3. Remover também o `dataset.tourBound` guard que não é mais necessário.

**Resultado esperado do método após a correção:**

```js
bindHelpButton() {
  // O tour é iniciado pelo handler 'help-open-tutorial' em navigationHandlers.js.
  // Este método é mantido apenas por compatibilidade de chamada.
},
```

**NÃO alterar:**

- `initIfFirstVisit()` — ainda deve chamar `this.bindHelpButton()` (agora no-op)
- `navigationHandlers.js` — já está correto, não mexer
- Nenhum outro método de `Tour`

**Teste de validação:**

1. Abrir o app logado com equipamentos cadastrados
2. Clicar no ícone `?` no header — o dropdown deve abrir mostrando 3 opções: "Ver tutorial", "Como funciona o score", "Suporte"
3. Clicar em "Como funciona o score" → deve mostrar o toast informativo, sem tour
4. Clicar em "Suporte" → deve mostrar o toast de suporte, sem tour
5. Clicar em "Ver tutorial" → aí sim o tour deve iniciar com o spotlight

---

## BUG-B — Limite de 5 equipamentos não é aplicado para usuários logados no plano free

### Diagnóstico

Em `src/core/guestLimits.js`, a função `checkGuestLimit()` retorna `blocked: false` imediatamente para qualquer usuário não-guest:

```js
// guestLimits.js — linhas 16–18 (PROBLEMA)
export function checkGuestLimit(resource) {
  const guest = isGuestMode();
  if (!guest) return { blocked: false, resource, limit: null, current: null }; // ← nunca bloqueia usuários logados
```

Em `src/ui/views/equipamentos.js`, `saveEquip()` usa apenas essa função para o check:

```js
// equipamentos.js — linhas 219–229
const guestLimit = checkGuestLimit('equipamentos');
if (guestLimit.blocked) {
  // ← nunca bloqueia usuários logados
  GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
  return false;
}
```

Resultado: usuários logados no plano free conseguem cadastrar 6, 10, 20+ equipamentos sem nenhum bloqueio. O `usageMeter` mostra corretamente "20/5 LIMITE ULTRAPASSADO", mas o `saveEquip()` nunca verifica esse estado para não-guests.

### Correção

**Arquivos a modificar:**

1. `src/core/guestLimits.js`
2. `src/ui/views/equipamentos.js`

---

#### Passo 1 — `src/core/guestLimits.js`

Adicionar nova função exportada `checkPlanLimit(resource)` que verifica o limite para **todos** os usuários (guests E logados no plano free):

```js
import { getState } from './state.js';
import { getPlanForUser, PLAN_CATALOG, PLAN_CODE_FREE } from './subscriptionPlans.js';

// ... manter isGuestMode(), getUsageSnapshot(), checkGuestLimit() existentes sem alteração ...

/**
 * Verifica se o usuário (guest ou logado free) atingiu o limite do recurso.
 * Retorna { blocked: boolean, resource, limit, current }
 */
export function checkPlanLimit(resource) {
  const usage = getUsageSnapshot();
  const current = usage[resource];

  // Guests usam o plano free
  const isGuest = isGuestMode();
  const limit = PLAN_CATALOG[PLAN_CODE_FREE].limits[resource];

  // TODO: quando houver integração de pagamento, trocar por leitura do plano real do usuário.
  // Por ora, todos (guests e logados) são tratados como plano free.
  const blocked = Number.isFinite(limit) ? current >= limit : false;

  return { blocked, resource, limit, current, isGuest };
}
```

> **Importante:** Manter a função original `checkGuestLimit()` sem alterações — ela ainda é usada em outros lugares. Apenas adicionar `checkPlanLimit` como nova exportação.

---

#### Passo 2 — `src/ui/views/equipamentos.js`

Substituir o uso de `checkGuestLimit` pelo novo `checkPlanLimit` dentro de `saveEquip()`:

**Imports — adicionar `checkPlanLimit` ao import existente:**

```js
// antes:
import { checkGuestLimit, isGuestMode } from '../../core/guestLimits.js';

// depois:
import { checkGuestLimit, checkPlanLimit, isGuestMode } from '../../core/guestLimits.js';
```

**Dentro de `saveEquip()` — substituir o bloco de verificação de limite (linhas ~219–229):**

```js
// REMOVER este bloco:
const guestLimit = checkGuestLimit('equipamentos');
if (guestLimit.blocked) {
  trackEvent('limit_reached', {
    resource: 'equipamentos',
    current: guestLimit.current,
    limit: 5,
  });
  GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
  return false;
}

// ADICIONAR este bloco no lugar:
const planLimit = checkPlanLimit('equipamentos');
if (planLimit.blocked) {
  trackEvent('limit_reached', {
    resource: 'equipamentos',
    current: planLimit.current,
    limit: planLimit.limit,
  });
  if (planLimit.isGuest) {
    // Guest: convida a criar conta
    GuestConversionModal.open({ reason: 'limit_equipamentos', source: 'save-equip' });
  } else {
    // Usuário logado no free: convida a fazer upgrade
    Toast.warning(
      `Limite de ${planLimit.limit} equipamentos do plano gratuito atingido. Faça upgrade para continuar.`,
    );
    const { goTo } = await import('../../core/router.js');
    goTo('pricing');
  }
  return false;
}
```

**NÃO alterar:**

- O bloco `if (isGuest) { GuestConversionModal.open({ reason: 'save_attempt' }) }` no final de `saveEquip()` — ele continua correto para mostrar o modal após cada save de guest
- `checkGuestLimit` em outros arquivos — não tocar
- Qualquer outra lógica de `saveEquip()`

---

### Teste de validação (BUG-B)

**Cenário 1 — Guest com 5 equipamentos:**

1. Ativar modo guest (`localStorage.setItem('cooltrack-guest-mode', '1')`)
2. Adicionar 5 equipamentos (até o limite)
3. Tentar adicionar o 6º → deve abrir `GuestConversionModal` e retornar sem salvar
4. Estado deve ter exatamente 5 equipamentos

**Cenário 2 — Usuário logado no plano free com 5 equipamentos:**

1. Logar com conta Google/email
2. Ter 5 equipamentos já cadastrados
3. Tentar adicionar o 6º → deve mostrar Toast.warning com mensagem de upgrade e redirecionar para `/pricing`
4. Estado deve ter exatamente 5 equipamentos — o 6º não deve ser persistido

**Cenário 3 — Regressão: usuário com 3 equipamentos:**

1. Com menos de 5 equipamentos, o save deve funcionar normalmente sem nenhuma mensagem de bloqueio
