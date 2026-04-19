# Prompt: Redesign da Landing Page

**Uso:** cola o bloco abaixo no Claude Design em conversa nova, anexa os 3 prints da landing atual (hero desktop, features desktop, hero mobile com o bug de colisão do título).

---

```
Você vai redesenhar a LANDING PAGE do CoolTrack. Os prints anexados mostram
a versão atual — ela tem drift de design system (palette e ícones próprios
quando o app inteiro roda em V2Refined), redundância narrativa (mesma
mensagem em 4 seções), bug de tipografia mobile e copy de CTA fragmentada.
O sistema visual é o mesmo aprovado no Account Modal e no Dashboard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CoolTrack: SaaS brasileiro de manutenção de climatização (HVAC) pra técnico
autônomo e pequena empresa. PWA mobile-first (360px), PT-BR, tom técnico e
direto. 3 tiers: Free (grátis) / Plus (R$ 29) / Pro (R$ 49).

A landing é a PRIMEIRA tela do funil público. Função:
  1. Convencer em 5 segundos ("o que é isso e por que eu me importo")
  2. Levar pro signup grátis ou pra demo interativa sem cadastro
  3. Mostrar o app em ação (screenshots reais do PWA)
Não precisa educar mercado — o técnico de HVAC já sabe que planilha e
WhatsApp não escalam. Foca em "olha como é simples".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISTEMA V2REFINED (fonte da verdade, NÃO MUDE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Paleta (dark mode, landing sempre dark):
  bgBase        #07111f
  bgSurface     #0c1929
  surface-2     #112236
  textPrimary   #e8f2fa
  textSecondary #8aaac8
  textMuted     #6a8ba8
  cyan          #00c8e8  (brand, primary)
  green         #00c870  (success)
  gold          #e8b94a  (Pro accent — só pra hint de "plano Pro existe")
  red           #ff5577  (danger, só em alertas do mockup)
  cardBg        rgba(0, 200, 232, 0.05)
  cardBgStrong  rgba(0, 200, 232, 0.08)
  cardBorder    rgba(0, 200, 232, 0.10)
  cardBorderStr rgba(0, 200, 232, 0.18)

Tipografia: Inter. Hierarquia:
  hero title    clamp(34px, 5.5vw, 56px) / 800 / tracking -0.02em
  section lbl   11px / 700 / tracking 0.8 / cyan uppercase
  section h2    26–32px / 700 / tracking -0.01em
  card title    17px / 600
  body          15–17px / 400–500 / line-height 1.6
  micro         12–13px / textSecondary
  chip          11px / 600 / uppercase

Radii: 10 / 12 / 14 / 16. Hero card = 16. Pills/chips = 999.
Sombras: hero card 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,200,232,0.05)

Ícones: SVG inline stroke 1.75 (landing usa stroke levemente mais grosso que
app pra ganhar peso hero), stroke round, fill none, currentColor.
PROIBIDO: emoji em qualquer lugar (📋 🧊 🚨 📷 📤 etc). Usar lucide-style.

Orbs decorativos — ASSINATURA DO ACCOUNT MODAL, USAR em 3 lugares:
  (a) Hero page-level: orb top -120px centro, cyan 7%, raio 600px
      (permanece como atmosfera)
  (b) Hero MOCKUP CARD (assinatura principal) — DUAL orb dentro do card:
      orb1 gold:  top: -40px,  left: -40px,  220×220px, blur 120px,
                  background: radial-gradient(circle, rgba(232,185,74,0.35), transparent 70%)
      orb2 cyan:  bottom: -60px, right: -60px, 260×260px, blur 140px,
                  background: radial-gradient(circle, rgba(0,200,232,0.45), transparent 70%)
      Esse cross-lighting é a assinatura — NÃO é um glow só, são duas luzes
      em cantos opostos criando profundidade tipo "objeto flutuando".
  (c) Final CTA card: repete dual orb com cyan em ambos os cantos
      (cyan top-left 0.3 + cyan bottom-right 0.4, menor intensidade)

Gradient text — USAR em exatamente 2 momentos na landing:
  (1) H1 hero: a palavra "achismo" ganha
      background: linear-gradient(135deg, #00c8e8 0%, #e8b94a 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      Restante do h1 fica sólido #f0f8ff. Uma palavra, um momento.
  (2) Final CTA card título: a palavra "organizar" recebe o mesmo gradiente.
  Em qualquer outro texto da landing, NÃO usar gradient fill.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROBLEMAS DA LANDING ATUAL (que o redesign PRECISA resolver)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. BUG no mobile ≤540px: o `<br>` do hero h1 é escondido via CSS mas sem
   substituir por espaço. Resultado: "Chega de manutençãono papel" colado.
   → SOLUÇÃO: não usar `<br>` decorativo. Deixar o título fluir em 1 linha
     conceitual, e se for pra quebrar em desktop, usar `max-width` + natural
     wrap, NÃO `<br>`.

2. Drift de palette: landing usa cores hardcoded (#060c16, #d8eaf6, #5a7a96
   etc) que não conversam com o app. Quando mexemos nos tokens do app, a
   landing fica fora de sync.
   → SOLUÇÃO: usar APENAS os tokens V2Refined da seção anterior. Zero hex
     literal fora dos tokens definidos.

3. Ícones em emoji (📋 🧊 🚨 no features, 🔴 🟡 no mockup de alerts).
   → SOLUÇÃO: SVG inline stroke 1.75 currentColor. Pra features: file-text,
     snowflake, bell. Pra mockup de alert: zap (raio) e circle dot.

4. Redundância narrativa: 4 seções falando a mesma coisa (hero mockup +
   3 features cards + 5 screenshot gallery + 3 how-it-works steps).
   → SOLUÇÃO: consolidar em 3 seções densas:
     (a) Hero — 1 mensagem forte + CTAs + mockup curto ao lado
     (b) Gallery — única fonte de verdade sobre "como o app é"
     (c) Final CTA — fechamento com 1 benefit list e reasons to believe
     Matar "features" e "how it works" — a gallery já conta essa história.

5. Copy de CTA fragmentada: "Testar agora — grátis" / "Testar grátis agora"
   / "Testar agora — grátis, sem cadastro" em 3 variações na mesma página.
   → SOLUÇÃO: **1 verbo só**. Escolho "Experimentar grátis" (ou "Começar
     grátis" — autor decide mas MANTÉM consistente). Secundário é sempre
     "Continuar com Google" (mesma copy do login).

6. Navbar "Entrar" com logo Google confuso: o botão leva pra AuthScreen
   (que tem tabs), não faz SSO direto. Logo Google sugere promessa falsa.
   → SOLUÇÃO: navbar só texto "Entrar" + ícone log-in stroke. Sem Google.

7. "Como funciona" com gap: 2px entre passos parece uma lista conectada,
   não 3 cards.
   → SOLUÇÃO: remover essa seção (consolidação #4). Se precisar de algum
     "como funciona", que seja 1 frase abaixo da gallery.

8. Hero mockup redundante com a gallery: mostra um card de alerta antes da
   gallery ter 5 screens com o mesmo alerta.
   → SOLUÇÃO: hero mockup fica MAS em versão reduzida (só 1 detalhe,
     tipo um "score disk" com numero 87 + label CRÍTICO) — não repete
     toda a info. Ou some, e o hero fica só texto + CTAs centralizados
     como uma "startup clean landing".

9. Sem social proof / números: zero credibilidade visual.
   → SOLUÇÃO: uma strip discreta antes do final CTA:
     "X técnicos · Y relatórios gerados · Z horas economizadas"
     (o autor pode deixar placeholders {{techCount}} {{reportCount}} —
     a gente substitui depois com dados reais da telemetria).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGNATURE MOMENTS (DNA DO ACCOUNT MODAL — INEGOCIÁVEL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
O feedback do dono foi "ficou genérico, sem identidade". A referência é o
AccountModal do app: ele tem 5 moves de assinatura que carregam personalidade
sem sobrecarregar. A landing PRECISA herdar 4 deles — se faltar, o output
volta a ler como template SaaS qualquer.

MOMENT 1 — DUAL ORB NO HERO CARD
  Não é um glow. São duas luzes radiais em cantos opostos:
  gold top-left + cyan bottom-right (specs acima). Aplicar no:
    - hero mockup card
    - final CTA card (cyan+cyan, menor intensidade)
    - cada phone da gallery (micro-versão, só cyan bottom-right, 160×160)
  Resultado: card parece flutuar, não plana.

MOMENT 2 — UMA PALAVRA GRADIENTE POR BLOCO
  No H1 hero, só "achismo" ganha fill gradiente cyan→gold.
  No final CTA, só "organizar" ganha o mesmo gradiente.
  Em nenhum outro lugar. Exclusividade = impacto.
  NÃO pinta kicker, NÃO pinta sub, NÃO pinta CTA label. Só essas 2 palavras.

MOMENT 3 — CHIPS FILLED COM CHECK INLINE
  Chips atuais são outline com check ANTES do texto. Trocar por:
    - bg rgba(0, 200, 232, 0.12) (FILLED, não outline vazia)
    - border 1px rgba(0, 200, 232, 0.25)
    - padding 6px 10px 6px 8px
    - border-radius 999
    - ícone check-circle FILLED 14px stroke cyan dentro do chip (inline
      com o texto, não flutuando antes)
    - texto 11/600 uppercase tracking 0.5 cyan
  Aplicar em:
    - 3 chips do hero mockup card (Prioridade Máxima, 18 dias, 3 ocorrências)
    - eventuais chips na gallery mockups
  Lê como checklist visual, não como tag decorativa.

MOMENT 4 — CTA PRIMÁRIO COM BOLT + SOMBRA PROJETADA
  O upgrade button do AccountModal tem bolt + sombra cyan que "projeta"
  pra fora do botão. Replicar:
    - ícone bolt (zap) 16px à esquerda do texto, mesmo cyan do gradient
      do botão mas renderizado em #06101e (negativo, vira "buraco" de luz)
    - box-shadow: 0 8px 28px rgba(0, 200, 232, 0.35),
                  0 0 0 1px rgba(0, 200, 232, 0.2) inset;
    - hover: box-shadow: 0 12px 36px rgba(0, 200, 232, 0.45);
             translateY(-2px);
  Aplicar em TODOS os CTAs primários: hero, sticky mobile, final card.
  NÃO aplicar no secundário (Google) — ele fica sem sombra colorida, só
  sutil bg tinted.

MOMENT 5 (opcional, se houver espaço) — PHONE FRAMES COM ORBE-ASSINATURA
  Cada phone da gallery ganha sua micro-orbe cyan bottom-right dentro do
  card, com 160×160 blur 100 opacity 0.25. Evita o look "5 phones iguais
  flutuando" genérico e dá coesão com o hero card.

Checklist visual de aprovação (se faltar qualquer um, refazer):
  [ ] Dual orb visível no hero mockup card (gold+cyan, cantos opostos)
  [ ] Palavra "achismo" no h1 com fill gradiente cyan→gold
  [ ] Chips do mockup são filled (bg cyan 12%) não outline
  [ ] Chips têm check-circle inline (não flutuando)
  [ ] CTA primário tem bolt + box-shadow cyan projetada
  [ ] Final CTA card tem dual orb e palavra gradiente em "organizar"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COPY FINAL (usa EXATAMENTE isto, não reescreva)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Navbar:
  Brand: CoolTrack [PRO badge cyan pill]
  Right: [Entrar] (link nav, sem Google)

Kicker (pill acima do h1):
  ● PARA TÉCNICOS DE CLIMATIZAÇÃO

H1 (SEM <br>, deixa fluir):
  Chega de manutenção no papel e no <grad>achismo</grad>.
  → "achismo" envolvido em <span class="grad-word"> com fill
    linear-gradient(135deg, #00c8e8 0%, #e8b94a 100%).
    Resto do h1 fica #f0f8ff sólido. É o ÚNICO momento gradient
    do hero — assinatura.

Sub:
  Registre serviços em campo, gere relatórios PDF com assinatura e
  nunca perca uma preventiva. Tudo no celular, funciona sem internet.

CTA primário (com ícone bolt):
  Experimentar grátis

CTA secundário (com logo Google oficial):
  Continuar com Google

Microcopy abaixo dos CTAs:
  Sem cadastro • Sem cartão • Comece em segundos

Hero mockup (reduzido):
  Card compacto (220–280px wide) com:
    - Top: "Hospital Central — Chiller 02"
    - Score disk gigante no meio: 87 em red, label "ALERTA CRÍTICO"
    - Chips: Prioridade Máxima · 18 dias sem serviço
  Ou alternativamente: NENHUM mockup no hero, só texto + CTAs
  (gallery abaixo já mostra o app). Autor escolhe o que fica mais
  equilibrado visualmente.

Section label + h2 da gallery:
  VEJA O APP EM AÇÃO
  Feito para o campo, do celular ao laudo.

Gallery (5 phones mockups — mantém os 5 screens atuais mas em tokens V2):
  1. Painel Geral
  2. Chiller 02 (detalhes)
  3. Registrar atendimento
  4. Alertas
  5. Relatório PDF

Hint abaixo (mobile only): Deslize ›

Strip de social proof (acima do final CTA):
  [{{techCount}}+] técnicos · [{{reportCount}}+] relatórios gerados ·
  100% offline-ready

Final CTA card:
  Título: Pronto para <grad>organizar</grad> seus atendimentos?
    → "organizar" com mesmo fill gradiente cyan→gold do h1
  Sub: Comece agora. Leva menos de 30 segundos, sem cartão.
  CTA primário: Experimentar grátis (com bolt + sombra projetada)
  CTA secundário: Já tenho conta

Sticky mobile (só ≤1023px):
  Experimentar grátis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARQUITETURA DO REDESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOBILE (360px, prioridade)

┌─────────────────────────────────────┐
│ [logo] CoolTrack [PRO]      [Entrar]│  ← sticky navbar, blur bg
├─────────────────────────────────────┤
│                                     │
│        ● PARA TÉCNICOS DE HVAC      │  ← kicker pill
│                                     │
│      Chega de manutenção no         │
│       papel e no achismo.           │  ← h1, wrap natural
│                                     │
│      Registre serviços em campo,    │
│      gere relatórios PDF com        │
│      assinatura e nunca perca       │
│      uma preventiva. Offline.       │
│                                     │
│   [⚡ Experimentar grátis (full)]   │  ← primary
│   [G  Continuar com Google    ]    │  ← secondary
│                                     │
│      Sem cadastro • Sem cartão      │  ← microcopy
│                                     │
│   ┌── Hero mini mockup ──────────┐  │
│   │ Hospital Central · Chiller 02│  │
│   │                              │  │
│   │         ╭───╮                │  │
│   │         │87 │ ALERTA CRÍTICO │  │  ← score disk + label
│   │         ╰───╯                │  │
│   │  Prioridade Máxima           │  │
│   │  18 dias sem serviço         │  │
│   └──────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│     VEJA O APP EM AÇÃO              │
│  Feito para o campo, do celular     │
│          ao laudo.                  │
│                                     │
│  [phone] [phone] [phone] ...  ›     │  ← scroll snap horizontal
│                                     │
│  • • • ○ ○                          │  ← pagination dots
├─────────────────────────────────────┤
│                                     │
│   142+ técnicos · 2.400+ relatórios │
│       100% offline-ready            │
│                                     │
│   ┌── Final CTA card ──────────┐    │
│   │ Pronto para organizar seus  │   │
│   │     atendimentos?           │   │
│   │                             │   │
│   │ Comece agora. Menos de 30s. │   │
│   │                             │   │
│   │ [Experimentar grátis (full)]│   │
│   │ [      Já tenho conta      ]│   │
│   └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│ [⚡ Experimentar grátis ─────────]  │  ← sticky mobile CTA
└─────────────────────────────────────┘

DESKTOP (≥1024px)

┌───────────────────────────────────────────────────────────────────┐
│ [logo] CoolTrack [PRO]                                    [Entrar]│
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│                  ● PARA TÉCNICOS DE CLIMATIZAÇÃO                  │
│                                                                   │
│  ┌─ texto à esquerda ──────┐   ┌─ hero mockup à direita ──────┐   │
│  │                         │   │ Chiller 02 · Hospital Central│   │
│  │ Chega de manutenção     │   │                              │   │
│  │ no papel e no achismo.  │   │       ╭─────╮                │   │
│  │                         │   │       │ 87  │ ALERTA CRÍTICO │   │
│  │ Registre serviços em    │   │       ╰─────╯                │   │
│  │ campo, gere relatórios  │   │                              │   │
│  │ PDF com assinatura e    │   │  ✓ Prioridade Máxima         │   │
│  │ nunca perca uma         │   │  ✓ 18 dias sem serviço       │   │
│  │ preventiva.             │   │  ✓ 3 ocorrências este mês    │   │
│  │                         │   │                              │   │
│  │ [⚡ Experimentar grátis]│   └──────────────────────────────┘   │
│  │ [G Continuar com Google]│                                      │
│  │                         │                                      │
│  │ Sem cadastro • Sem cartão                                      │
│  └─────────────────────────┘                                      │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│                     VEJA O APP EM AÇÃO                            │
│          Feito para o campo, do celular ao laudo.                 │
│                                                                   │
│     [phone]  [phone]  [phone]  [phone]  [phone]                   │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│     142+ técnicos · 2.400+ relatórios · 100% offline-ready        │
│                                                                   │
│          ┌── Final CTA card (centered, max 720px) ──┐             │
│          │ Pronto para organizar seus atendimentos? │             │
│          │ Comece agora. Menos de 30s, sem cartão.  │             │
│          │ [Experimentar grátis] [Já tenho conta]   │             │
│          └──────────────────────────────────────────┘             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETALHES DE COMPONENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPBAR:
  - sticky top 0 z-50, bg rgba(7, 17, 31, 0.9) + backdrop-filter blur(10px)
  - border-bottom 1px rgba(255,255,255,0.05)
  - height 64px, padding 18px 24px (desktop) / 14px 16px (mobile)
  - Brand: icon 30px (bg cyan 10%, border cyan 22%) + nome 16/700 + pill PRO
  - "Entrar" btn: bg rgba(255,255,255,0.04), border 1px var(--border),
    padding 8px 16px, border-radius 8, 13px/500 textSecondary

KICKER PILL:
  - inline-flex, padding 6px 12px, border-radius 999
  - bg rgba(0,200,232,0.08), border 1px rgba(0,200,232,0.2)
  - cor cyan, 11px/700/tracking 0.8 uppercase
  - dot ● 7px piscando 1.8s loop (animation opacity)

CTA PRIMÁRIO (signature moment 4 — bolt + sombra projetada):
  - height 52px, padding 15px 28px, border-radius 12
  - bg linear-gradient(135deg, #00c8e8 0%, #0090c8 100%)
  - color #06101e, font 15/700 tracking -0.01em
  - box-shadow: 0 8px 28px rgba(0,200,232,0.35),
                0 0 0 1px rgba(0,200,232,0.2) inset;
  - hover: box-shadow: 0 12px 36px rgba(0,200,232,0.45);
           translateY(-2px);
  - ícone bolt (zap) 16px à esquerda, stroke 2.25, currentColor (#06101e)
    → renderiza como "raio escuro" sobre fundo cyan, igual ao upgrade
      button do AccountModal
  - Aplica em: hero primary, sticky mobile, final CTA card primary

CTA SECUNDÁRIO:
  - height 48px, padding 14px 24px, border-radius 12
  - bg rgba(255,255,255,0.04), border 1px rgba(255,255,255,0.12)
  - color textPrimary, font 15/500
  - hover: border cyan 30%, bg cyan 6%
  - logo Google oficial 16px à esquerda (cores originais Google — não
    monocromar)

HERO MOCKUP CARD (signature moment 1 — DUAL ORB):
  - width 280px (mobile) / 360px (desktop dentro do grid)
  - position relative, overflow hidden (pra clipar as orbs)
  - bg #0b1929, border 1px rgba(0,200,232,0.18), border-radius 14
  - padding 20px
  - outer shadow 0 20px 60px rgba(0,0,0,0.5)
  - top accent line 2px cyan→transparent (mantém)

  ★ DUAL ORB (inside card, absolutely positioned, z-index 0):
    orb1 (gold, top-left):
      position: absolute; top: -40px; left: -40px;
      width: 220px; height: 220px; border-radius: 50%;
      background: radial-gradient(circle, rgba(232,185,74,0.35), transparent 70%);
      filter: blur(60px); pointer-events: none;
    orb2 (cyan, bottom-right):
      position: absolute; bottom: -60px; right: -60px;
      width: 260px; height: 260px; border-radius: 50%;
      background: radial-gradient(circle, rgba(0,200,232,0.45), transparent 70%);
      filter: blur(70px); pointer-events: none;
    Conteúdo do card (header, score disk, chips) em z-index: 1 relative.

  - score disk: 80px diameter, border 6px solid red, bg bgSurface,
    centro com número 87/800 em red, abaixo label "ALERTA CRÍTICO"
    em 11/700/tracking 0.5 red

  - chips (signature moment 3 — FILLED com check inline):
    bg rgba(0, 200, 232, 0.12)
    border 1px rgba(0, 200, 232, 0.25)
    padding 6px 10px 6px 8px
    border-radius 999
    display flex align-items center gap 6
    ícone check-circle 14px stroke 2 cyan INLINE (antes do texto,
    mas dentro do mesmo container filled — não flutuando fora)
    texto 11/600 uppercase tracking 0.5 cyan
    stack vertical mobile / grid 1x3 desktop, gap 8

GALLERY:
  - 5 phones side by side, scroll snap horizontal
  - cada phone: 195px wide mobile / 240px wide desktop
  - border-radius 22, border 1.5px rgba(0,200,232,0.16)
  - status bar fake (9:41, bateria) 8px/600 textMuted
  - app header com label cyan + título textPrimary
  - body mostra o app V2Refined de verdade (NÃO inventar layout —
    reproduz os 5 screens atuais mas com tokens V2Refined:
    hero card + chips + KPI strip + bottom nav stroke 2.25)
  - dots abaixo: 5 dots, ativo é cyan + 18px wide + radius 3,
    inativos são rgba(255,255,255,0.1) + 6px wide + radius 50%

  ★ SIGNATURE MOMENT 5 (opcional mas recomendado) — orbe-assinatura:
    Cada phone card ganha uma micro-orbe cyan bottom-right dentro do
    wrapper do phone (fora do "glass" do phone em si):
      width: 160px; height: 160px; bottom: -40px; right: -40px;
      background: radial-gradient(circle, rgba(0,200,232,0.25), transparent 70%);
      filter: blur(50px);
    Evita o look "5 phones iguais flutuando" e cria coesão com o hero.

SOCIAL PROOF STRIP:
  - centered, 13/500 textSecondary
  - padding 32px 24px
  - números em textPrimary 15/700
  - separator: dot ● cyan 8px

FINAL CTA CARD (signature moment 1 repetido — DUAL ORB cyan+cyan):
  - max-width 720px (desktop) / full-width (mobile)
  - position relative, overflow hidden
  - bg linear-gradient(135deg, rgba(0,200,232,0.07), rgba(0,200,232,0.02))
  - border 1px rgba(0,200,232,0.18), border-radius 16
  - padding 40px 32px (desktop) / 28px 20px (mobile)
  - texto centered

  ★ DUAL ORB (menor intensidade que o hero):
    orb1 (cyan, top-left):
      top: -80px; left: -80px;
      width: 280px; height: 280px;
      background: radial-gradient(circle, rgba(0,200,232,0.30), transparent 70%);
      filter: blur(80px);
    orb2 (cyan, bottom-right):
      bottom: -80px; right: -80px;
      width: 320px; height: 320px;
      background: radial-gradient(circle, rgba(0,200,232,0.40), transparent 70%);
      filter: blur(90px);

  - título h2 com palavra "organizar" em fill gradiente cyan→gold
  - 2 CTAs side by side (mobile: empilhados, gap 12px)
  - CTA primário herda o moment 4 (bolt + sombra projetada)

STICKY MOBILE CTA:
  - só ≤1023px, fixed bottom 0, z-80
  - padding 12px 16px + env(safe-area-inset-bottom)
  - bg rgba(7,17,31,0.96) + blur 10px
  - border-top 1px rgba(255,255,255,0.06)
  - CTA primário full-width justify-center

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENTREGÁVEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Me devolve em JSX dentro de:
  <DesignCanvas>
    <DCSection title="Landing — redesign V2Refined">
      <DCArtboard label="Mobile 360" width={360} height={1400}>
        <LandingMobile />
      </DCArtboard>
      <DCArtboard label="Desktop 1280" width={1280} height={1400}>
        <LandingDesktop />
      </DCArtboard>
      <DCArtboard label="Mobile 360 · gallery aberta (screen 3)"
                   width={360} height={900}>
        <LandingMobile galleryScroll={3} />
      </DCArtboard>
    </DCSection>
  </DesignCanvas>

Reusa tokens window.CT (se não existirem, declara no topo como const CT = {
bg: '#07111f', ...}). Ícones em window.Icon.{bolt, google, logIn, fileText,
snowflake, bell, zap, checkCircle, chevronRight} — SVG inline stroke 1.75.

Comentários inline explicando qualquer decisão que foge destas instruções.
Se você mudar a copy, JUSTIFICA o motivo em comentário acima da string.
```

---

## Anotações pra você (não fazem parte do prompt)

**Inegociável** e reforçado no prompt:

- Fim do `<br>` no h1 (bug do print)
- Zero emoji — tudo SVG inline com stroke 1.75
- Tokens V2Refined, sem hex hardcoded
- Copy de CTA padronizada ("Experimentar grátis" + "Continuar com Google")
- Navbar sem logo Google
- Fusão de features + how-it-works na gallery
- Social proof strip com placeholders

**Signature moments inegociáveis (DNA do AccountModal):**

- Dual orb no hero mockup card (gold top-left + cyan bottom-right)
- Palavra "achismo" no h1 com fill gradiente cyan→gold (ÚNICA no hero)
- Palavra "organizar" no título do final CTA com mesmo gradiente
- Chips filled (bg cyan 12%) com check-circle inline — NÃO outline
- CTA primário com bolt 16px + box-shadow cyan projetada (35% blur 28)
- Final CTA card com dual orb cyan+cyan

**Liberdade pro Claude Design:**

- Se mantém ou remove o hero mockup card (deixei alternativa no prompt)
- Ícones específicos (sugestões dadas, mas autor escolhe)
- Exatas proporções do grid desktop
- Ordem das chips no hero mockup

**Placeholder a substituir depois:**

- `{{techCount}}` e `{{reportCount}}` — puxar da telemetria real em `src/core/telemetry.js`

Se o retorno vier bom, salva o arquivo JSX em `/sessions/determined-funny-wright/mnt/uploads/` e me avisa "aplica o redesign da landing" — eu porto pro vanilla JS mantendo o fluxo de `start-trial` / `login` / `click-track`.
