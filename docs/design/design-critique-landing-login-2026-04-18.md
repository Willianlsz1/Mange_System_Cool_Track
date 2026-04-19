# Design Critique — Landing Page + Login Screen

**Data:** 2026-04-18
**Autor:** Claude (para Willian)
**Escopo:** telas públicas — `src/ui/components/landingPage/*` e `src/ui/components/authscreen.js`

Este doc resume o que tá bom, o que tá quebrado e o que tá fora de padrão nas duas telas públicas do CoolTrack. Serve de base pros prompts de redesign em `prompts/02-landing.md` e `prompts/03-login.md` e também lista fixes rápidos que não precisam esperar o redesign.

---

## TL;DR

**Landing Page**

1. **Bug de tipografia no mobile:** o título quebra em `<br>` que é escondido em ≤540px, colando "manutenção**no** papel" — visível no print.
2. **Drift visual com o app:** a landing usa palette/tipografia/ícones próprios (emoji, cores hardcoded `#d8eaf6`, `#5a7a96`) enquanto o app inteiro roda em V2Refined com tokens (`--text`, `--text-2`, `--primary`). Duas UIs convivendo no mesmo produto.
3. **Redundância:** hero mockup + galeria de 5 screens + features em 3 cards + "Como funciona" em 3 passos — quatro seções contando a mesma história. Dá pra consolidar.
4. **Copy fragmentada nos CTAs:** "Testar agora — grátis" / "Testar grátis agora" / "Testar agora — grátis, sem cadastro" em 3 variações na mesma página.
5. **Botão "Entrar" no topbar tem logo do Google:** navegação interna não precisa do logo Google — confunde com o fluxo de auth.

**Login (AuthScreen)**

1. **Copy do botão Google instável:** "Entrar com Google" (landing) / "Continuar com Google" (signin default) / "Salvar meus dados com Google" (guest-save) / "Criar conta com Google" (signup). Quatro variantes — duas delas na mesma sessão do usuário.
2. **Labels em CAPS LOCK de 10px tracking 0.8:** estilo "terminal admin", destoa do resto do produto que usa labels em sentence-case 12–13px medium.
3. **Painel de branding da esquerda com `aria-hidden="true"`:** conteúdo semântico (headline, features, stats) tá sendo escondido de screen readers. Acessibilidade quebrada.
4. **Squish no tablet (769–900px):** brand panel não escala — padding de 56×52px fica apertado, features e stats se espremem.
5. **Hierarquia de CTAs mista:** Google é `auth-btn-google--primary` (cyan tint) mas o botão "Acessar meu painel →" é gradient cheio full-cyan. Os dois querem ser primários.
6. **Sem senha strength meter no signup** — plain input + hint no placeholder ("mínimo 8 caracteres"). Falha silenciosa só quando o user já apertou o CTA.

---

## 1. Landing Page — detalhes

### 1.1 Bug da quebra de linha no mobile

**`src/ui/components/landingPage/template.js:41`**

```html
<h1 class="lp-h1">Chega de manutenção<br /><em>no papel e no achismo.</em></h1>
```

**`src/ui/components/landingPage/styles.js:288-289`**

```css
@media (max-width: 540px) {
  .lp-h1 br {
    display: none;
  }
}
```

O `<br>` some no mobile mas não foi substituído por espaço, resultando em "manutenção**no** papel" colado. O print do user mostra isso literalmente.

**Fix:** usar `word-spacing` via `::after` no span antes, ou — mais simples — trocar por `white-space: pre-line` + `\n` no texto, ou simplesmente injetar um espaço nas versões mobile. Eu recomendo só remover o `<br>` e deixar o título fluir naturalmente em todos os viewports.

### 1.2 Drift do design system

A landing reinventa tudo que o app já tem:

| Produto        | Landing                                    | App (V2Refined)                                  |
| -------------- | ------------------------------------------ | ------------------------------------------------ |
| bg             | `#060c16` hardcoded                        | `var(--bg)` = `#07111f` dark / `#eff3f8` light   |
| text primário  | `#d8eaf6`                                  | `var(--text)` = `#e8f2fa` dark / `#0a1e32` light |
| text 2         | `#5a7a96`, `#4a6880`, `#2a4258`, `#3a5870` | `var(--text-2)`, `var(--text-3)`                 |
| primary        | `#00c8e8` direto                           | `var(--primary)`                                 |
| border         | `rgba(255,255,255,0.05)`                   | `var(--border)`, `var(--border-2)`               |
| ícones         | emoji (📋 🧊 🚨 📷 📤 🔴 🟡)               | SVG stroke 1.6, `currentColor`                   |
| botão primário | gradient linear cyan → cyan escuro         | idem mas com tokens e sem gradient por default   |

Consequência prática: quando o user ativa tema claro (existe em `base.css:76+`), a landing continua preta. Quando ajustamos o primary em 2 pontos de saturação, a landing não segue. Manutenção dupla.

**Fix:** migrar `.lp-*` pra usar `var(--*)` do design system e remover emoji (trocar por SVG inline no padrão do app).

### 1.3 Redundância narrativa

A landing repete a mesma mensagem em 4 estruturas:

1. **Hero** com mockup card ("Chiller 02 · ALERTA CRÍTICO")
2. **Features** (3 cards: PDF, Histórico, Alertas)
3. **Gallery** (5 screens mostrando o app inteiro)
4. **How it works** (3 passos repetindo 1/2/3 o que a gallery já mostra)

Pra quem rola até o fim: 3× a mesma ideia de alert crítico, 2× a mesma ideia de PDF pro WhatsApp, 2× a mesma ideia de histórico.

**Proposta:** consolidar em 3 seções densas — (a) hero com 1 hook forte, (b) gallery (a seção que funciona melhor), (c) final CTA. Remover features + how it works ou fundi-los como legenda abaixo da gallery.

### 1.4 CTAs com copy fragmentada

Na mesma página, o user vê 4 variantes do mesmo botão:

- Hero primário: **"Testar agora — grátis"**
- Hero secundário: **"Entrar com Google"**
- Final card: **"Testar grátis agora"**
- Sticky mobile: **"Testar agora — grátis, sem cadastro"**
- Navbar topo: **"Entrar"** (com logo Google — ver 1.5)

Isso rompe consistência e, se for A/B test sem querer, poluí o evento. Padroniza: **"Experimentar grátis"** como verbo único (ou "Começar grátis"), e o secundário é sempre "Entrar com Google".

### 1.5 Botão "Entrar" do topbar com logo Google

**`template.js:25-33`**

```html
<button class="lp-nav-btn" type="button" data-action="login">
  <svg>...logo Google...</svg>
  Entrar
</button>
```

Esse botão leva pra AuthScreen (não faz signin direto). Mostrar logo Google sugere SSO imediato, mas clicar abre o split screen com tabs. Promessa quebrada.

**Fix:** tirar o logo Google do topbar. Deixar só texto "Entrar" + icon `log-in` stroke se quiser reforço visual.

### 1.6 "Como funciona" com visual quebrado

**`styles.js:224-236`**

```css
.lp-how__steps {
  display: grid;
  gap: 2px; /* gap tão pequeno que parece um único bloco */
}
.lp-step:first-child {
  border-radius: 12px 12px 0 0;
}
.lp-step:last-child {
  border-radius: 0 0 12px 12px;
}
```

Os 3 passos parecem uma lista conectada em vez de 3 cards sequenciais. Números 1/2/3 em círculo gradient somem visualmente no fluxo.

**Proposta:** ou vira card único com 3 rows separadas por divider (mais clean), ou vira 3 cards com connector line entre eles (estilo progress). Pessoalmente, mataria a seção inteira — a gallery já conta esse story.

### 1.7 Stats ausentes / social proof zero

Nenhum número, testemunho, logo de cliente. Pra SaaS B2B brasileiro, falta um "X técnicos já usam" ou "Y relatórios gerados" pra dar credibilidade. O app tem telemetria — dá pra puxar.

---

## 2. Login (AuthScreen) — detalhes

### 2.1 Botão Google instável

Na mesma sessão, o user vê:

| Contexto                           | Copy                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| Landing hero secondary             | "Entrar com Google"                                        |
| Landing navbar                     | "Entrar" + logo Google (bug)                               |
| AuthScreen signin default          | `intentOptions.highlightCopy` = **"Continuar com Google"** |
| AuthScreen signin (vindo de guest) | **"Salvar meus dados com Google"**                         |
| AuthScreen signup                  | **"Criar conta com Google"**                               |

Decidir 1 copy padrão e só variar no caso de guest-save (onde a semântica é diferente).

**Proposta:**

- **"Continuar com Google"** — default em signin e signup (compromisso de curta fricção, funciona pros dois casos)
- **"Salvar meus dados com Google"** — só quando veio do guest mode (semântica única de "não perder o que eu já fiz")
- Remover "Entrar com Google" da landing hero (usar o mesmo "Continuar com Google")

### 2.2 Labels tipo "terminal"

**`authscreen.js:275-279`**

```css
.auth-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #3a5870;
}
```

10px uppercase tracking 0.8 é um padrão "admin panel 2012". O resto do CoolTrack (inclusive o Account Modal aprovado V2Refined) usa labels em 11–12px medium sentence-case.

**Proposta:**

```css
.auth-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: var(--text-2);
}
```

E troca `EMAIL` → `Email`, `SENHA` → `Senha`, `SEU NOME` → `Seu nome`.

### 2.3 Brand panel com `aria-hidden="true"`

**`authscreen.js:353`**

```html
<aside class="auth-brand" aria-hidden="true">
  <h1 class="auth-brand__headline">Controle total sobre...</h1>
  ...
</aside>
```

Headlines, features, stats — todo o conteúdo semântico escondido de screen readers e ferramentas de SEO (se um dia virarmos essa tela server-rendered). Foi feito pra evitar duplicação com o form, mas a solução correta é:

- `<aside>` não precisa de `aria-hidden`; NVDA e VoiceOver já ignoram `<aside>` decorativos se o form estiver bem marcado.
- Se a preocupação é leitura dupla, o fix é colocar o form em `<main>` e o aside em `<aside role="complementary">` — não sumir com o conteúdo.

### 2.4 Squish no tablet (769–900px)

**`authscreen.js:345-349`**

```css
@media (max-width: 768px) {
  .auth-brand {
    display: none;
  }
  .auth-form-panel {
    padding: 24px 16px;
  }
  .auth-card-header {
    display: block;
  }
}
```

Entre 769px e 900px o brand panel ainda é visível com `padding: 56px 52px` e `flex: 0 0 46%` — o que dá ~400px de largura, pouquíssimo pra um hero card + 3 features + 3 stats. As stats se empilham, a headline se quebra em lugares estranhos.

**Proposta:** quebrar o breakpoint em 768 e criar um intermediário (769–1024) onde o brand panel ganha `padding: 32px 24px` e `flex: 0 0 40%`; acima de 1024 volta pro desktop real.

### 2.5 Hierarquia de CTAs concorrentes

No signin:

1. **Botão Google** com background `rgba(0,200,232,0.1)` e border `rgba(0,200,232,0.25)` — parece primário
2. **Divider** "ou com email e senha"
3. **"Acessar meu painel →"** com gradient full cyan e 13px/600 — também parece primário

Quando o user bate no form, tem duas coisas gritando "sou o botão principal". Em termos de uso real, Google deve ser _o_ primário (fricção zero, maior conversão).

**Proposta:**

- Google: mantém gradient/solid como primário
- "Acessar meu painel →": demota pra outline (border 1px var(--primary), bg transparent, texto var(--primary))
- OU, alternativa: o email/password aparece só ao clicar em "usar email" (collapse até lá — reduz paralisia)

### 2.6 Signup sem feedback de senha

No signup, o user preenche "senha mínimo 8 caracteres" no placeholder, digita 6 caracteres, aperta "Começar a usar gratuitamente →" — e só aí aparece um toast de erro.

**Proposta:** adicionar um strength meter abaixo do input de senha:

- 0–7 chars → "Senha muito curta" (vermelho)
- 8+ chars sem número → "Senha fraca" (amarelo)
- 8+ chars com número/símbolo → "Senha forte" (verde)

Pra ficar fiel ao V2Refined: barra de 4px altura, 3 segmentos, tier accent gold/red/green.

### 2.7 Hint de data no signup é vago

**`authscreen.js:486`**

```html
<div class="auth-hint">Plano gratuito · Sem cartão · Cancele quando quiser</div>
```

"Cancele quando quiser" num plano **gratuito** é nonsense (não tem assinatura pra cancelar). Provável copy herdada de signup pago — trocar por algo relevante: "Plano gratuito · Sem cartão · Começa com 5 PDFs/mês".

### 2.8 Demo interativa mal posicionada

A opção "Ver demo interativa sem cadastro →" tá grudada no final do signin (guest-panel). Dois problemas:

1. **Visível só no tab Signin** — user que cai no tab Signup perde essa saída
2. **Stylizada como texto-link pequeno** (color `#4a6880`, 13px) — esconde uma das features fortes do produto (zero fricção pra testar)

**Proposta:** mover pra cima (logo abaixo da tab bar, antes do Google button) como card outlined verde: "Testar sem criar conta — 2 min" com ícone `play-circle`. Fica visível nos dois tabs.

---

## 3. Tabela de prioridade (pra gente decidir o que entra em qual PR)

| #   | Problema                       | Impacto                 | Esforço            | PR sugerido  |
| --- | ------------------------------ | ----------------------- | ------------------ | ------------ |
| L1  | Bug colisão "manutençãono"     | Alto (visível no print) | 1 linha            | Quick fix    |
| L2  | Navbar Google logo confuso     | Médio                   | 5 linhas           | Quick fix    |
| A1  | Copy Google inconsistente      | Alto (4 variantes)      | ~20 linhas         | Quick fix    |
| A2  | `aria-hidden` brand panel      | Alto (a11y)             | 1 linha            | Quick fix    |
| A7  | "Cancele quando quiser" grátis | Baixo mas ridículo      | 1 linha            | Quick fix    |
| L3  | Drift de tokens vs V2Refined   | Alto (manutenção)       | ~2h                | Redesign P1  |
| L6  | "Como funciona" quebrado       | Médio                   | ~1h                | Redesign P1  |
| L4  | CTA copy fragmentada           | Médio                   | ~30min             | Redesign P1  |
| A1b | Senha strength meter           | Médio                   | ~1h                | Redesign P1  |
| A4  | Tablet squish                  | Baixo (nicho)           | ~30min             | Redesign P1  |
| A5  | Hierarquia CTA double-primary  | Médio                   | Decisão de design  | Redesign P2  |
| A8  | Demo interativa posição        | Alto (conversão)        | ~30min             | Redesign P2  |
| L7  | Social proof ausente           | Alto (conversão)        | Precisa copy/asset | Pós-redesign |

---

## 4. Próximos passos

1. **Quick fixes** (hoje, 1 commit curto) — L1, L2, A1, A2, A7. Todos são mudanças pequenas, sem redesign.
2. **Prompts pro Claude Design** — `prompts/02-landing.md` e `prompts/03-login.md`. Eu redijo baseado neste critique e no formato do `01-dashboard.md`.
3. **Redesign P1** — port vanilla do retorno do Claude Design, migrando pra tokens V2Refined, resolvendo #L3/#L6/#L4/#A1b/#A4.
4. **Redesign P2** — pós-aprovação, resolver #A5 (double primary) e #A8 (demo position) que são decisões de design com mais alternativas.

O commit `COMMIT_MSG.txt` ainda preparado segue válido pro trabalho D1–D4 + setores + fotos + pricing fix — esse redesign entra em commits separados.
