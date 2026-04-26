# Prompt: Redesign Minimalista — Cool Track Pro

> Cole este prompt em uma nova conversa com o Claude para gerar o redesign da interface. Anexe junto as imagens de referência: (1) screenshot do app atual, (2) referência de sidebar limpa em três variações, (3) referências de apps bancários em azul que definem a paleta desejada.

---

## Contexto do Produto

Estou desenvolvendo o **Cool Track Pro**, um SaaS de gestão para técnicos e empresas de instalação/manutenção de ar-condicionado. O app permite registrar serviços, gerenciar clientes, criar orçamentos, gerar PDFs com assinatura, enviar via WhatsApp e acompanhar o pipeline financeiro.

**Público-alvo:** técnicos autônomos e pequenas empresas de climatização no Brasil. Usuário típico tem entre 25 e 50 anos, usa o sistema diariamente (várias vezes ao dia) em desktop e mobile, e valoriza rapidez, clareza e profissionalismo — porque exporta documentos que vão direto para o cliente final.

**Stack:** front-end em [preencher: React/Next.js/Vue/etc.], tema **dark mode** como padrão, suporte a desktop e mobile.

---

## Estado Atual (problema)

A interface atual tem boa estrutura informacional, mas sofre de **poluição visual**. Especificamente:

1. **Sidebar com muitos elementos competindo por atenção** ao mesmo tempo: item ativo com fundo cyan preenchido, badge amarelo "Atalho: R", badge amarelo "PRO", badge vermelho "0" nos alertas, e card laranja/amarelo "Plano Pro" no rodapé.
2. **Excesso de cores saturadas no fundo escuro** — cyan, verde-neon, amarelo, laranja e vermelho convivendo sem hierarquia clara.
3. **KPIs no topo da página com bordas/textos em cyan brilhante**, competindo com os botões de ação que também são cyan.
4. **Status (Enviado/Aprovado)** em cores chapadas e saturadas que cansam o olho.
5. **Sensação geral de "muita informação ao mesmo tempo"** em vez de uma hierarquia visual calma.

---

## Direção de Design Desejada

Quero um redesign **minimalista, sóbrio e profissional**, com **identidade em azul** — inspirado nas referências de apps bancários anexadas. O azul deve ser **suave, profundo e elegante** (tipo o azul dos banking apps de referência), **NÃO um cyan vibrante nem um neon**.

**Importante sobre as referências bancárias:** as imagens mostram telas com áreas brancas e azuis. No meu app, **o branco será substituído por tons de cinza-escuro** (porque o tema é dark). O branco fica reservado para o **futuro tema light**. Ou seja: pegue a paleta azul + neutros, mas inverta os neutros para o modo escuro.

### Princípios obrigatórios

- **Uma cor de destaque por vez.** Azul é a cor da marca, mas usada com parcimônia — só no item ativo da sidebar, em CTAs primários, em valores monetários importantes e em pequenos acentos. Não no fundo de cards inteiros.
- **Hierarquia por contraste, não por cor.** Texto inativo em cinza médio, texto ativo em branco/azul. Ícones inativos com 50–60% de opacidade.
- **Regra do "tira a cor".** Se eu remover todas as cores da interface e deixar tudo em escala de cinza, ela ainda deve fazer sentido. A cor é tempero, não a refeição.
- **Status com cores dessaturadas.** Verde-musgo em vez de verde-neon, âmbar em vez de amarelo brilhante, vermelho-tijolo em vez de vermelho-vivo.
- **Espaços em branco generosos.** Não tente preencher cada pixel.
- **Sistema de design dual-theme desde o início.** Os tokens devem suportar dark (padrão) e light (futuro), com a mesma cor de marca em ambos.

---

## Paleta Sugerida (proponha ajustes se julgar melhor)

A cor da marca é um **azul suave e profundo**, inspirado nos apps bancários de referência — pense em algo entre `#3B82F6` (royal blue moderno) e `#2563EB` (azul mais sóbrio), **NÃO no cyan elétrico** atual. Refinem o tom exato se julgarem melhor (sugestões: `#4F7CFF`, `#3D6FE3`, ou um azul-petróleo levemente dessaturado).

**Tema Dark (padrão — começar por aqui)**

- Fundo da app: `#0B0D12` (dark azulado, não preto puro — ajuda a "amarrar" com a marca azul)
- Fundo de cards/sidebar: `#14171F`
- Fundo elevado (hover, modal): `#1B1F2A`
- Borda/divisor sutil: `#222632`
- Texto primário: `#E8EAF0`
- Texto secundário: `#9BA1B0`
- Texto terciário/desabilitado: `#5A6173`
- **Cor de marca (azul):** `#4F7CFF` ou similar — refinem se necessário
- Cor de marca em fundo (badge, hover): `rgba(79, 124, 255, 0.12)` — versão translúcida
- Status sucesso: `#10B981` dessaturado para `#3FB68B`
- Status atenção: `#F59E0B` dessaturado para `#D49447`
- Status erro: `#EF4444` dessaturado para `#D9544D`

**Tema Light (futuro — definir tokens equivalentes)**

- Fundo da app: `#F7F8FB`
- Fundo de cards/sidebar: `#FFFFFF`
- Borda/divisor sutil: `#E4E7EE`
- Texto primário: `#1A1D26`
- Texto secundário: `#5A6173`
- Cor de marca: mesmo azul, mas pode ser ligeiramente mais escuro (`#3D6FE3`) para ter contraste suficiente em fundo claro

**Tipografia:** sugerir uma família moderna e legível (Inter, Geist, ou similar), com escala clara entre títulos, labels e corpo.

**Identidade visual / Logo:** o logo do Cool Track Pro é o **próprio ícone da marca** (não há um wordmark separado). Use o ícone na cor azul da marca, em tamanho compacto (~28–32px na sidebar). O texto "Cool Track Pro" pode acompanhar o ícone na sidebar em uma fonte limpa, peso medium, em branco.

---

## Componentes a Redesenhar (com requisitos específicos)

### 1. Sidebar

- Topo da sidebar: **logo do Cool Track Pro** (ícone da marca) + nome do app ao lado, em peso medium.
- Itens de menu inativos em cinza médio, sem fundo.
- Item ativo: **sem fundo chapado azul forte** — opções aceitáveis: (a) barra fina lateral esquerda azul + texto/ícone azul, ou (b) fundo translúcido azul `rgba(79,124,255,0.10)` + texto/ícone azul. Escolha o que ficar mais elegante.
- Categorias (OPERAÇÃO / GESTÃO / SISTEMA) em cinza muito apagado, fonte menor, espaçamento de letras aumentado.
- Badge "Atalho: R" → mostrar **só em hover** ou remover (atalhos podem viver em um modal de ajuda).
- Badge "PRO" → ícone de coroa minimalista em cinza, ou remover se o usuário já tem plano Pro ativo.
- Contador de alertas → não exibir quando for zero. Quando houver alertas, usar bolinha pequena azul (não vermelha gritante) ou número discreto.
- Card "Plano Pro" no rodapé → versão muito mais discreta: mesmo fundo da sidebar, borda fina, ícone pequeno, texto sutil. **Sem laranja/amarelo chapado.** Pode usar um leve toque azul para indicar plano ativo.

### 2. Header da página (Orçamentos)

- Título grande, peso forte, sem cor de destaque.
- Botão "+ Novo orçamento" como CTA primário (única cor saturada da tela).

### 3. Cards de KPI (1 EM ABERTO / 1 APROVADOS / R$ 5.228,00)

- Sem bordas coloridas.
- Fundo dos cards em tom de cinza muito sutil ou apenas borda fina.
- Número grande em branco; label pequena em cinza secundário.
- Pequeno indicador visual (bolinha colorida 6px, ou ícone pequeno) para diferenciar a categoria.

### 4. Filtros (Todos / Rascunho / Enviado / Aprovado / Recusado / Expirado)

- Estilo "pill" mais discreto.
- Filtro ativo: fundo sutil + texto branco. Filtros inativos: sem fundo, texto cinza.

### 5. Lista de Orçamentos (cards)

- Status badges com cores dessaturadas e fundo apenas levemente tingido.
- Hierarquia clara: número do orçamento (cinza pequeno) → título do serviço (branco grande) → cliente e datas (cinza secundário) → valor (à direita, destaque sutil).
- Botões de ação secundários (Ver/editar, Baixar PDF, WhatsApp) com estilo "ghost" — sem preenchimento, só borda ou texto.
- Botão primário ("Reenviar assinatura" ou "Marcar aprovado") em **azul da marca**, mas só **um** primário por linha.

### 6. Microinterações

- Transições suaves (150–200ms) em hover.
- Hover states sutis (mudança de 5–10% no fundo, não saltos de cor).

---

## Constraints (não negociáveis)

- Manter **todas as funcionalidades atuais visíveis** — não remover botões ou informações, apenas reorganizar e dessaturar.
- Tema **dark continua sendo o padrão**, mas o sistema de design deve permitir tema light no futuro.
- A interface precisa funcionar em **desktop (1440px+)** e **mobile (375px)**. Mostrar versão mobile da sidebar (drawer/bottom-nav).
- Não usar bibliotecas de UI pesadas — preferir Tailwind CSS puro com tokens customizados.

---

## Deliverables Esperados

1. **Mockup HTML+CSS+Tailwind** funcional e responsivo da tela de "Orçamentos" redesenhada (a tela atual da screenshot), em arquivo único.
2. **Sidebar isolada** mostrando estados: item normal, hover, ativo, com submenu/badge sutil.
3. **Tabela de tokens de design** (cores, tipografia, espaçamentos, raios de borda, sombras) para eu replicar no resto do app.
4. **Comparação lado a lado** (antes vs. depois) ou anotações sobre as decisões tomadas em cada componente.
5. **Versão mobile** da mesma tela, mostrando como a sidebar vira drawer e como os cards se reorganizam.

---

## Tom e Sensação Final

Pense em apps como **Revolut (modo dark), N26, Linear, Stripe Dashboard, Things 3, Vercel Dashboard** — interfaces escuras com toques de azul elegante, muito respiro, tipografia caprichada, cor usada como acento e não como decoração. O Cool Track Pro precisa transmitir **confiabilidade técnica, profissionalismo e leveza**, sem parecer software corporativo dos anos 2000 nem app de fintech "neon" exagerado.

**Inspiração específica do azul:** as referências bancárias anexadas usam azul como cor dominante de forma elegante — quero a mesma sensação de "trust + tech", mas adaptada ao tema dark (onde o azul acentua, não preenche tudo).

---

## Restrições de Conteúdo

Mantenha todos os textos em **português do Brasil**. Mantenha os termos do domínio (Orçamentos, Serviços, Clientes, Equipamentos, Alertas, Relatórios, Painel) exatamente como estão.

---

## Pergunta Final

Antes de começar o mockup, **liste 3–5 perguntas** que ajudariam a refinar ainda mais a direção (ex.: existe logo da marca? qual o ícone usado hoje? há alguma cor secundária da identidade visual que precisa ser preservada?). Depois prossiga para os entregáveis.
