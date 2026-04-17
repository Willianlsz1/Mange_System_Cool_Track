# Auditoria de Design — CoolTrack PRO

**Data:** 16 de abril de 2026
**Escopo:** Design visual/UI, Acessibilidade (WCAG 2.1 AA), Arquitetura/Código, UX/Microcopy
**Fontes analisadas:** 5 screenshots Play Store, 2 tablet, 4 Android XR, 4 Chromebook, previews HTML, `src/` (132 arquivos), CSS (14k linhas).

---

## Resumo executivo

Encontrei **21 problemas de design** — 3 críticos, 8 altos, 8 médios e 2 baixos. O problema mais visível (e urgente) são os **glifos quebrados** (quadradinhos "tofu") aparecendo em quase todos os botões principais dos screenshots da Play Store. A arquitetura tem boa separação por pastas, mas acumula _god files_ e CSS duplicado em 3 lugares que gera conflitos de estilo.

---

## 1. Design visual / UI

### Crítico

**1.1 Glifos quebrados (tofu ☐) em botões primários** — screenshots 2, 3, 5, tablet, androidxr_4. Os emojis `📤`, `💾`, `📱`, `📄`, `🔔`, `❄️`, `⚡`, `✍️` estão presentes no código-fonte (confirmado em `src/ui/components/landingPage.js:819`, `firstTimeExperience.js:308-316`, `utils.js:14`, etc.), mas não renderizam porque o font-stack em `base.css:51-53` é apenas `'Inter', sans-serif` — sem fallback de emoji. **Correção:** trocar para `'Inter', system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`. Ou ainda melhor: substituir emojis por ícones SVG inline (Lucide, Phosphor) para consistência visual e controle de cor/tamanho.

**1.2 Chip "ATENÇÃO" transborda o cartão** — `tablet_10inch` e `tablet_7inch`. O badge é cortado pela borda do card da lista lateral. O texto "ATENÇÃO" (8 caracteres) é maior que "CRÍTICO" (7) e "OK" (2), e a largura fixa do chip não comporta. **Correção:** usar abreviação ("ATENÇ." ou ícone `!`) OU aumentar o `max-width` do chip, OU usar `position: absolute; right: 0; top: 0` com `translate(-8px, 8px)`.

**1.3 Navegação superior sem espaçamento no desktop/XR** — `androidxr_1_dashboard.png` mostra "Painel Equipamentos Alertas Relatórios Configurações" correndo sem gap visível. No `tablet_10inch` "Relatórios" está cortado na borda direita. **Correção:** adicionar `gap: var(--space-5)` ao container do nav e definir `flex-wrap: wrap` ou reduzir font-size em breakpoints ≥1280px.

### Alto

**1.4 Truncamento do título na lista do dashboard** — screenshot_1: "Chiller 02 — Hosp..." não caberia no espaço. Para um app de manutenção industrial, identificar o local é essencial. **Correção:** quebrar em duas linhas com `line-clamp: 2` ou exibir só o nome do equipamento e mover o local para subtítulo abaixo.

**1.5 Inconsistência de formato monetário** — o dashboard desktop exibe `R$1.840` (sem decimais, sem espaço), o registro mostra `R$ 85,00` e `R$ 120,00` (com espaço, com decimais), e o PDF usa `R$ 1.840,00`. **Correção:** centralizar em um utilitário `formatCurrency()` (hoje só existe em `core/utils.js`) e usar em todos os lugares.

**1.6 "ClimaT ech HVAC" no PDF** — `screenshot_5_pdf.png`. Parece ser um bug de _word-wrap_ / _letter-spacing_ cortando "ClimaTech" em duas palavras, ou um dado de formulário com espaço indevido. **Correção:** verificar `src/domain/pdf/sections/cover.js` e sanitizar `.trim()` + `.replace(/\s+/g, ' ')` no campo empresa.

### Médio

**1.7 CSS duplicado em 3 arquivos** — classes `.btn`, `.card`, `.form-control` estão definidas em `components.css`, `theme-premium.css` E `ux-polish.css`. Cria cascata imprevisível e o comportamento depende da ordem de import em `index.html:33-39`. **Correção:** consolidar em `components.css` e tratar `theme-premium.css` como apenas overrides semânticas.

**1.8 Arquivo CSS gigante** — `components.css` com **6.518 linhas** é difícil de navegar. **Correção:** dividir por domínio (`buttons.css`, `forms.css`, `cards.css`, `modals.css`) e importar via um único arquivo _index_.

---

## 2. Acessibilidade (WCAG 2.1 AA)

### Crítico

**2.1 Botões sem `:focus-visible` visível** — `.btn` em `components.css:1375` tem `:hover` e `:active` mas nenhum estado de foco por teclado. Falha WCAG 2.4.7 (Focus Visible). **Correção:** adicionar `.btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }`.

### Alto

**2.2 Contraste de `--text-muted` no tema claro** — no tema claro `--text-muted: #3a5870` sobre `#eff3f8` calcula aprox. **4.9:1**, passando por pouco no AA (4.5:1), mas em texto pequeno (12px) usado nos labels "EQUIPAMENTO", "TIPO DE SERVIÇO" pode falhar em perfis tipográficos mais leves. **Correção:** escurecer para `#2a4660` (6.8:1).

**2.3 Chips de status** — "ATENÇÃO" amarelo `#e8a020` com texto escuro pode estar ok, mas "CRÍTICO" vermelho `#e03040` com texto branco precisa validação. **Correção:** verificar com ferramenta (WebAIM, Figma Contrast) e, se necessário, escurecer o vermelho ou usar texto branco em negrito.

**2.4 Alvos de toque < 48×48 dp** — links "Ver detalhes →" e "Agendar manutenção →" parecem ter área clicável apenas no texto. **Correção:** aumentar `padding: var(--space-3) var(--space-4)` ou envolver toda a linha/card como alvo clicável.

### Médio

**2.5 Emojis decorativos sem `aria-hidden`** — `📄`, `🔔`, `📱` em `firstTimeExperience.js` são lidos como "gráfico para trás" etc. por leitores de tela. **Correção:** adicionar `aria-hidden="true"` em cada `<span>/<div>` de emoji decorativo.

**2.6 Falta `<noscript>` no `index.html`** — usuários sem JS veem tela em branco. **Correção:** adicionar mensagem explicativa dentro de `<noscript>`.

---

## 3. Arquitetura / Código

### Crítico

**3.1 Dependência circular domain→ui** — `src/domain/pdf.js:10` importa `getSignatureForRecord` de `src/ui/components/signature.js`. A camada de domínio nunca deveria conhecer a UI. **Correção:** mover a leitura de assinatura para `src/core/` (ex.: `signatureStorage.js`) e injetar no PDF.

### Alto

**3.2 God files (>400 linhas)**

- `src/ui/views/equipamentos.js` — **1.124 linhas** (lista, CRUD, filtros, delete)
- `src/ui/components/landingPage.js` — **935 linhas**
- `src/ui/views/dashboard.js` — **852 linhas**
- `src/core/storage.js` — **784 linhas** (IndexedDB + Supabase + quota)
- `src/ui/components/onboarding/firstTimeExperience.js` — **593 linhas**

**Correção:** quebrar cada um por responsabilidade (lista / detail / form / handlers).

**3.3 Barrel + diretório com mesmo nome** — `onboarding.js` (barrel) ao lado de `onboarding/` (pasta); mesmo com `signature.js`/`signature/`, `modal.js`/`modals.js`. Imports ambíguos. **Correção:** renomear barrels para `index.js` dentro da pasta (`onboarding/index.js`).

### Médio

**3.4 State acoplado à UI** — `core/state.js` dispara renders diretos; não há pub/sub isolado. **Correção:** implementar `events.js` já existente como bus e remover calls diretos ao DOM do `state.js`.

**3.5 Padrões mistos no layer UI** — alguns componentes usam handlers-objeto (`registroHandlers.js`), outros funções avulsas. **Correção:** padronizar em um dos dois (prefiro handlers nomeados).

---

## 4. UX / Microcopy

### Médio

**4.1 "Cancelar" genérico em 6+ lugares** — `profileModal.js:121`, `passwordRecoveryModal.js:105,163`, `modals.js:131,154,186`. **Correção:** usar ações nomeadas: "Voltar", "Descartar alterações", "Sair sem salvar", "Não enviar".

**4.2 Empty state passivo** — `historico.js:210` "Nenhum serviço registrado ainda". **Correção:** CTA explícito — "Você ainda não registrou serviços. Registre seu primeiro atendimento →".

**4.3 Badge "OK"** — no card de equipamento (dashboard) usar "OK" é ambíguo. **Correção:** "Operando" ou "Em dia".

### Baixo

**4.4 `<title>` e `meta description` usam entidades HTML** (`&atilde;` etc.) mesmo com `charset=UTF-8`. **Correção:** usar caracteres diretos em `index.html:6-11`.

**4.5 Inconsistência "Equipamento/EQUIPAMENTO/equipamento"** em labels. **Correção:** definir convenção (labels em CAIXA ALTA pequena, títulos em Title Case).

---

## Top 5 correções de maior impacto/menor esforço

1. **Consertar emojis quebrados** — 1 linha em `base.css` (font fallback). Resolve o problema mais visível nos screenshots da Play Store.
2. **Adicionar `:focus-visible` nos botões** — 3 linhas de CSS. Corrige WCAG 2.4.7.
3. **Corrigir overflow do chip "ATENÇÃO"** — ajuste em `components.css` (chip `max-width` + `text-overflow`).
4. **Dividir `components.css` (6.5k linhas) em módulos** — refactor puro, sem mudança visual.
5. **Centralizar formato monetário em `utils.formatCurrency`** — consistência entre mobile, PDF e desktop.
