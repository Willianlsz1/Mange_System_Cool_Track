# Prompt: Redesign da Tela de Login (AuthScreen)

**Uso:** cola o bloco abaixo no Claude Design em conversa nova, anexa os 2 prints da AuthScreen atual (desktop split + mobile form).

---

```
Você vai redesenhar a TELA DE LOGIN/SIGNUP do CoolTrack. Os prints anexados
mostram a versão atual — ela tem copy de Google button inconsistente (4
variantes na mesma sessão), labels tipo "terminal admin", brand panel
inacessível (aria-hidden="true"), squish em tablet e hierarquia de CTAs
dupla-primária. O sistema visual é o mesmo aprovado no Account Modal,
Dashboard e Equipamentos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CoolTrack: SaaS brasileiro de manutenção de climatização (HVAC) pra técnico
autônomo e pequena empresa. PWA mobile-first (360px), PT-BR, tom técnico e
direto. 3 tiers: Free (grátis) / Plus (R$ 29) / Pro (R$ 49).

A AuthScreen é um OVERLAY fullscreen que abre por cima de qualquer tela
quando o user aperta "Entrar" na landing ou quando o app detecta uma
transição guest → logado. Função:
  1. Levar pra signin com Google (caminho 1, zero fricção)
  2. Alternativamente, email/senha (signin OU signup via tabs)
  3. Oferecer saída "Ver demo sem cadastro" pra quem não quer commit ainda
Estado especial "guest-save": quando o user já usou o app como guest e
agora quer salvar os dados, a copy muda pra enfatizar preservação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOM VISUAL — FUNCIONAL/SÓBRIO (decisão do dono)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A AuthScreen é uma TRANSAÇÃO, não uma vitrine. Ao contrário da landing
(que herda o DNA completo do AccountModal com dual orbs, palavras gradiente
e CTAs com sombra projetada), aqui o foco é reduzir fricção do formulário.

NÃO usar nesta tela:
  - Dual orb signature (só 2 orbs sutis 5–7% no brand panel como atmosfera)
  - Palavra gradiente no headline (texto sólido #e8f2fa)
  - Box-shadow cyan projetada nos CTAs (sombra sutil só)
  - Chips filled com check inline (não há chips neste layout)

USAR (coerência mínima com o sistema):
  - Paleta V2Refined (cyan/gold/green) e Inter
  - Stroke 1.6 nos ícones
  - Google button com gradient fill (mesmo do hero da landing — carrega
    o "primary" do funil sem precisar de decoração extra)
  - Demo card green (única nota cromática de destaque, com propósito)

A sobriedade é intencional: o formulário deve ler como "um passo rápido",
não como "outra página de marketing".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISTEMA V2REFINED (fonte da verdade, NÃO MUDE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Paleta (dark, mesmo AuthScreen sempre dark):
  bgBase        #07111f
  bgSurface     #0c1929
  surface-2     #112236
  textPrimary   #e8f2fa
  textSecondary #8aaac8
  textMuted     #6a8ba8
  cyan          #00c8e8
  green         #00c870  (success, strength meter forte)
  gold          #e8b94a  (strength meter médio)
  red           #ff5577  (strength meter fraco, erros inline)
  cardBg        rgba(0, 200, 232, 0.05)
  cardBorder    rgba(0, 200, 232, 0.10)
  cardBorderStr rgba(0, 200, 232, 0.18)

Tipografia: Inter.
  brand headline  28px / 700 / tracking -0.5px
  brand sub       15px / 400 / textSecondary
  form h2         22px / 700 (só no mobile-header)
  tab label       14px / 500 (active 600)
  input label     12px / 500 / textSecondary / sentence-case (NÃO uppercase)
  input value     14px / 400
  cta primary     15px / 600
  micro/hint      12px / textMuted
  feature title   14px / 600
  feature desc    12–13px / textSecondary

Radii: 8 inputs / 10 tabs container / 12 CTAs / 14–16 cards
Shadow painel: none no panel, card interno usa 0 24px 48px rgba(0,0,0,0.5)

Ícones: SVG inline stroke 1.6, round, currentColor. Tamanho padrão 16px.
Logo Google oficial 18px colorido (não monocromar).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEMAS DA AUTHSCREEN ATUAL (que o redesign PRECISA resolver)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Copy do Google button em 4 variantes:
   "Entrar com Google" (landing hero) / "Continuar com Google" (signin
   default) / "Salvar meus dados com Google" (guest-save) / "Criar conta
   com Google" (signup).
   → SOLUÇÃO: UNIFICAR em 2 copys só:
     - "Continuar com Google" — default em signin E signup (funciona pros
       dois, compromisso semântico de low-friction auth)
     - "Salvar meus dados com Google" — SÓ quando `intent === 'guest-save'`
       (semântica única de preservação)
     A landing também usa "Continuar com Google" no secundário pra fechar
     o ciclo.

2. Labels em CAPS LOCK 10px tracking 0.8:
   .auth-label { font-size: 10px; font-weight: 700; letter-spacing: .8px;
                 text-transform: uppercase; color: #3a5870; }
   → SOLUÇÃO: labels em sentence-case 12px medium textSecondary:
     .auth-label { font-size: 12px; font-weight: 500; color: var(--text-2); }
     E troca as strings: EMAIL → Email / SENHA → Senha / SEU NOME → Seu nome

3. aria-hidden="true" no brand panel esconde de screen readers:
   <aside class="auth-brand" aria-hidden="true">...headline + features...</aside>
   → SOLUÇÃO: remover o `aria-hidden`. `<aside role="complementary">` já é
     semântica correta. Form fica em `<main>`. Isso resolve a duplicação
     que o aria-hidden tentava esconder.

4. Squish no tablet (769–900px): brand panel com padding 56px 52px +
   flex 0 0 46% fica apertado. Features e stats se espremem.
   → SOLUÇÃO: breakpoint intermediário:
     - ≤768px: brand panel hidden (como hoje)
     - 769–1024px: brand panel com padding 32px 24px, flex 0 0 40%,
       headline 22px (não 28), stats empilham em 1 coluna
     - ≥1024px: desktop real como hoje

5. Hierarquia dupla-primária: Google (bg cyan 10% + border cyan 25%) e
   "Acessar meu painel →" (gradient full cyan) competem pelo papel de
   primary action.
   → SOLUÇÃO:
     - Google é PRIMARY (gradient solid 135deg cyan→cyan-strong, texto
       #06101e, 52px height — identico ao CTA do hero da landing)
     - "Acessar meu painel →" é SECONDARY (outline 1px cyan, texto cyan,
       bg transparent, 48px height)
     - OU (alternativa): usar disclosure — mostrar só Google + "Usar email
       e senha" como link abaixo, que expande inputs. Autor decide qual
       abordagem mas DEVE resolver a duplicação.

6. Signup sem feedback de senha: plain input + hint no placeholder.
   → SOLUÇÃO: strength meter abaixo do input de senha no signup:
     - barra 4px altura, 3 segmentos, gap 4px
     - 0–7 chars: 1º segmento red, label "Muito curta" em red
     - 8+ chars sem número: 2 segmentos gold, label "Fraca" em gold
     - 8+ chars com dígito/símbolo: 3 segmentos green, label "Forte" em green
     - Atualiza em tempo real no `input` event

7. "Cancele quando quiser" em plano gratuito é nonsense:
   .auth-hint "Plano gratuito · Sem cartão · Cancele quando quiser"
   → SOLUÇÃO: trocar por "Plano gratuito · Sem cartão · 5 PDFs/mês"
     (reflete o MONTHLY_LIMITS real do Free tier).

8. Demo interativa mal posicionada: "Ver demo interativa sem cadastro →"
   só aparece no tab Signin, estilizada como link pequeno escondido no
   footer do form.
   → SOLUÇÃO: PROMOVER pra um card outlined verde no TOPO do form
     (acima do Google button, visível nos dois tabs):
     ┌─ card ──────────────────────────────┐
     │ ▶️ Testar sem criar conta           │
     │ Entre no app com dados de exemplo.  │
     │                             [Abrir] │
     └─────────────────────────────────────┘
     Background: rgba(0, 200, 112, 0.05), border rgba(0, 200, 112, 0.2),
     radius 10, padding 14px 16px, gap 12px entre texto e botão.
     Ícone play-circle stroke green à esquerda.

9. Tabs com borders duplos: container tem border 1px + active tab
   também tem border 1px, sobrepostos. Visualmente granulado.
   → SOLUÇÃO: tab ativo SEM border, só bg + shadow:
     .auth-tab.active {
       background: rgba(0,200,232,0.12);
       color: cyan;
       box-shadow: 0 1px 2px rgba(0,0,0,0.3);
       border: none;
     }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COPY FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND PANEL (desktop only, ≥769px):
  Logo: CoolTrack [PRO]
  Headline: Controle total sobre cada equipamento que você atende.
            (h1 sem <br> decorativo — wrap natural)
  Sub: Gestão de manutenção para técnicos de climatização. Do diagnóstico
       ao relatório PDF — tudo em um só lugar.

  3 features com SVG (sem emoji):
    [snowflake] Histórico completo de cada equipamento
                Todas as manutenções, peças trocadas e anomalias —
                organizadas por equipamento.
    [file-text] Relatórios PDF com sua assinatura
                Gere laudos profissionais em segundos, prontos para
                enviar ao cliente via WhatsApp.
    [bell]      Alertas inteligentes de preventivas
                Nunca perca um prazo. O sistema avisa quais equipamentos
                precisam de atenção hoje.

  Stats strip (bottom):
    100%          PDF           ∞
    Offline       Instantâneo   Histórico

FORM PANEL:

Mobile-only header (≤768px):
  [logo] CoolTrack [PRO]
  Gestão de manutenção para técnicos de climatização.

Demo card (TOPO do form, visível nos dois tabs):
  [play-circle] Testar sem criar conta
  Entre no app com dados de exemplo.
                                      [Abrir]

Tabs:
  [Entrar] [Criar conta]

─── Signin tab ───
  [G] Continuar com Google           ← primary, 52px, gradient
  ou com email e senha
  Email     [seu@email.com            ]
  Senha     [••••••••         ] [👁]
  [Acessar meu painel →]              ← secondary, outline cyan
  Esqueci minha senha

─── Signup tab ───
  [G] Continuar com Google           ← primary
  ou com email e senha
  Seu nome  [Carlos Figueiredo        ]
  Email     [seu@email.com            ]
  Senha     [mínimo 8 caracteres] [👁]
  ▓▓▓░ Forte                          ← strength meter (muda em tempo real)
  Confirmar senha [repita a senha] [👁]
  [Começar gratuitamente →]           ← secondary, outline cyan
  Plano gratuito · Sem cartão · 5 PDFs/mês

Estado especial (intent === 'guest-save'):
  [G] Salvar meus dados com Google    ← primary, copy diferenciada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARQUITETURA DO REDESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESKTOP (≥1024px, split layout)

┌────────────────────────────────────────┬───────────────────────────────┐
│                                        │                               │
│  [logo] CoolTrack [PRO]                │                               │
│                                        │                               │
│  Controle total sobre                  │  ┌── Demo card (green) ────┐  │
│  cada equipamento                      │  │ ▶ Testar sem criar conta│  │
│  que você atende.                      │  │ Entre com dados de exem.│  │
│                                        │  │                 [Abrir] │  │
│  Gestão de manutenção pra técnicos     │  └─────────────────────────┘  │
│  de climatização. Do diagnóstico ao    │                               │
│  relatório PDF — tudo em um só lugar.  │  [Entrar] [Criar conta]       │
│                                        │                               │
│  [snowflake] Histórico completo…       │  [G] Continuar com Google     │
│                                        │  ────  ou com email e senha   │
│  [file-text] Relatórios PDF com sua    │  Email  [seu@email.com     ]  │
│              assinatura…               │  Senha  [••••••••        ][👁]│
│                                        │                               │
│  [bell] Alertas inteligentes…          │  [Acessar meu painel →]       │
│                                        │                               │
│  ───────────────────────────────       │  Esqueci minha senha          │
│  100%       PDF          ∞             │                               │
│  Offline    Instantâneo  Histórico     │                               │
│                                        │                               │
└────────────────────────────────────────┴───────────────────────────────┘

TABLET (769–1023px, split reduzido)

┌──────────────────────┬────────────────────────────┐
│ CoolTrack            │                            │
│ [headline 22px]      │  Demo card                 │
│ sub 13px             │  Tabs                      │
│ [3 features]         │  Google                    │
│ stats empilhadas     │  divider                   │
│                      │  form                      │
└──────────────────────┴────────────────────────────┘
 40% width              60% width, max 400 centered

MOBILE (≤768px, brand panel oculto)

┌─────────────────────────────────────┐
│                                     │
│       [logo] CoolTrack [PRO]        │
│   Gestão de manutenção para         │
│   técnicos de climatização.         │
│                                     │
│  ┌── Demo card (green) ───────────┐ │
│  │ ▶ Testar sem criar conta       │ │
│  │ Entre com dados de exemplo.    │ │
│  │                       [Abrir]  │ │
│  └────────────────────────────────┘ │
│                                     │
│    [Entrar]    [Criar conta]        │
│                                     │
│   [G] Continuar com Google          │  ← primary 52px
│                                     │
│   ────  ou com email e senha  ────  │
│                                     │
│   Email                             │
│   [seu@email.com                ]   │
│                                     │
│   Senha                             │
│   [••••••••                ] [👁]   │
│                                     │
│   [Acessar meu painel →]            │  ← secondary outline
│                                     │
│       Esqueci minha senha           │
│                                     │
└─────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETALHES DE COMPONENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OVERLAY:
  - position fixed inset 0 z-9000
  - bg #070c14
  - display flex align-items stretch

BRAND PANEL (desktop):
  - flex 0 0 46% (≥1024) / 0 0 40% (769–1023) / display none (≤768)
  - padding 56px 52px (≥1024) / 32px 24px (769–1023)
  - background linear-gradient(145deg, #080f1c 0%, #0b1525 60%, #091828 100%)
  - border-right 1px rgba(0,200,232,0.08)
  - 2 orbs decorativos (top-right + bottom-left, cyan 5–7% radial)

FEATURES (brand panel):
  - gap 20px entre features
  - ícone: 36px box, radius 8, bg rgba(0,200,232,0.08), border cyan 15%
  - SVG 16px stroke 1.6 currentColor cyan
  - title 14/600 textPrimary, desc 12/400 textSecondary 1.45 lh

STATS STRIP:
  - padding-top 32px, border-top 1px rgba(255,255,255,0.05)
  - gap 28px (desktop) / stack (tablet)
  - num 22/700 cyan tracking -0.5, label 11/textMuted tracking 0.5 uppercase

FORM PANEL:
  - flex 1
  - display flex align-items center justify-content center
  - padding 40px 24px (desktop) / 24px 16px (mobile)
  - overflow-y auto
  - bg #070c14

FORM CARD:
  - width 100% max-width 400px

DEMO CARD (verde, no topo):
  - bg rgba(0, 200, 112, 0.05)
  - border 1px rgba(0, 200, 112, 0.2)
  - radius 10
  - padding 14px 16px
  - display flex align-items center gap 12
  - ícone play-circle 20px stroke green 1.6
  - title 14/600 textPrimary, desc 12/400 textSecondary
  - CTA "Abrir" à direita: green outline btn 32px height

TABS:
  - container: bg rgba(255,255,255,0.04), border 1px var(--border),
    radius 10, padding 4
  - cada tab: flex 1, padding 9px 0, radius 7
  - inactive: transparent, textMuted, 14/500
  - ACTIVE: bg rgba(0,200,232,0.12), color cyan, 14/600, sem border,
    box-shadow 0 1px 2px rgba(0,0,0,0.3)

GOOGLE BUTTON (primary):
  - full-width, height 52px, radius 12
  - bg linear-gradient(135deg, #00c8e8 0%, #0090c8 100%)
  - color #06101e, 15/700
  - logo Google oficial 18px colorido à esquerda
  - hover: opacity .92, translateY(-1px)

DIVIDER:
  - display flex align-items center gap 10
  - 12/400 textMuted
  - ::before e ::after são lines 1px rgba(255,255,255,0.06)

INPUT LABEL:
  - block, 12/500 textSecondary, sentence-case
  - margin-bottom 6, margin-top 14 (ou 0 se primeiro)

INPUT:
  - full-width, padding 12px 14px, radius 8
  - bg rgba(255,255,255,0.03), border 1px var(--border)
  - 14/400 textPrimary
  - placeholder textMuted
  - focus: border cyan 35%, bg cyan 4%
  - min-height 44px mobile (acessibilidade)

INPUT WRAP (com eye toggle):
  - position relative
  - toggle: absolute right 10, background none, color textMuted,
    hover cyan, padding 4
  - ícone eye / eye-off stroke 1.6

STRENGTH METER (só no signup, abaixo do input senha):
  - width 100%, margin-top 6
  - 3 segments side by side, gap 4, height 4, radius 2
  - segment inactive: bg rgba(255,255,255,0.06)
  - segment active: bg red / gold / green conforme força
  - label à direita: 11/500 cor matching

CTA SECONDARY (email/senha submit):
  - full-width, height 48, radius 10
  - bg transparent, border 1px cyan, color cyan
  - 15/600
  - hover: bg rgba(0,200,232,0.06), border cyan mais forte
  - margin-top 20

FORGOT LINK:
  - bg none, border none, 12/400 textMuted, padding 4 8
  - hover textSecondary

HINT (below signup CTA):
  - 12/400 textMuted, centered, margin-top 14, lh 1.5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTADOS ADICIONAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOADING (Google ou submit em progresso):
  - botão mantém dimensões, conteúdo substitui por spinner 16px + "Entrando..."
    / "Criando conta..." / "Redirecionando..."
  - outros botões e inputs ficam opacity 0.5 pointer-events none

ERROR INLINE (quando email inválido ou senhas não conferem):
  - 12/500 red abaixo do input, margin-top 4
  - ícone alert-circle 12px à esquerda
  - input errado ganha border red 40%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACESSIBILIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- <aside> ganha role="complementary" (SEM aria-hidden)
- Form envelopado em <main> com aria-labelledby="auth-title"
- Tabs com role="tablist", cada tab role="tab" aria-selected dinâmico
- Painéis com role="tabpanel"
- Password toggle com aria-label "Mostrar senha" / "Ocultar senha"
- Strength meter com aria-live="polite" e aria-valuenow
- Focus visible em todos os botões: outline 2px cyan offset 2px

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTREGÁVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Me devolve em JSX dentro de:
  <DesignCanvas>
    <DCSection title="Login — redesign V2Refined">
      <DCArtboard label="Desktop 1280 · Signin" width={1280} height={800}>
        <AuthScreen tab="signin" />
      </DCArtboard>
      <DCArtboard label="Desktop 1280 · Signup" width={1280} height={900}>
        <AuthScreen tab="signup" />
      </DCArtboard>
      <DCArtboard label="Mobile 360 · Signin" width={360} height={700}>
        <PhoneShell><AuthScreen tab="signin" /></PhoneShell>
      </DCArtboard>
      <DCArtboard label="Tablet 900 · Signin" width={900} height={800}>
        <AuthScreen tab="signin" />
      </DCArtboard>
      <DCArtboard label="Desktop · guest-save intent" width={1280} height={800}>
        <AuthScreen tab="signin" intent="guest-save" />
      </DCArtboard>
    </DCSection>
  </DesignCanvas>

Reusa tokens window.CT. Ícones window.Icon.{google, playCircle, snowflake,
fileText, bell, eye, eyeOff, arrowRight, alertCircle} — SVG inline stroke 1.6.

Comentários inline explicando:
  - onde o strength meter é calculado (função separada com score 0-3)
  - como o estado guest-save muda só a copy do Google button
  - por que o form primary é Google (não email/senha)

Se você mudar qualquer copy ou decisão de estrutura, JUSTIFICA em comentário
acima.
```

---

## Anotações pra você (não fazem parte do prompt)

**Inegociável:**

- Copy do Google button: **só 2 variantes** ("Continuar com Google" default, "Salvar meus dados com Google" para guest-save)
- Labels sentence-case (não CAPS LOCK)
- Remover `aria-hidden` do brand panel
- Google é primary, email/senha CTA é secondary outline
- Strength meter no signup
- Demo card promovido pra topo do form, visível em ambos os tabs
- Breakpoint intermediário pro tablet (769–1023px)
- **Tom sóbrio**: NÃO herdar dual orb / palavra gradiente / sombra cyan projetada da landing. O login é transação, não vitrine.

**Liberdade:**

- Disclosure progressivo (email/senha escondido até click em "usar email") — alternativa que levantei mas deixei o autor escolher
- Ícone exato do demo card (sugeri play-circle, mas pode ser rocket, zap, eye)
- Como mostra o strength meter (3 segments vs bar contínua)

**Pós-redesign (não vai no prompt):**

- Integração real com `Auth.signIn`, `Auth.signUp`, `Auth.signInWithGoogle`
- `trackEvent('auth_google_clicked', ...)` já existe em `authscreen.js:515`
- `PasswordRecoveryModal.openPasswordResetEmailModal(email)` já existe
- `clearGuestDemoData()` + `persistPostAuthRedirect(postAuthRedirect)` já existem

Se o retorno vier bom, salva o arquivo JSX em `/sessions/determined-funny-wright/mnt/uploads/` e me avisa "aplica o redesign do login" — eu porto pro vanilla JS mantendo `intent`, `initialTab`, `postAuthRedirect` e o ciclo de event listeners atual.
