# Commit pendente — refino UX da aba Equipamentos

## Como commitar

1. **Destrave o git** (algum processo Windows tá segurando o lock):

   ```powershell
   # No PowerShell, dentro da pasta do projeto:
   Remove-Item .git\index.lock -Force
   ```

   Ou feche o painel Source Control do VSCode e qualquer terminal git aberto.

2. **Rode o commit:**

   ```bash
   git add -A
   git commit -F COMMIT_MESSAGE.md
   ```

3. **Apague este arquivo após commitar:**
   ```bash
   rm COMMIT_MESSAGE.md
   ```

---

## Mensagem (vai pro `git commit -F`)

feat(equip): redesign completo da aba de Equipamentos (5 ondas)

Refino UX consolidado da tela Equipamentos, modal de detalhes e modal de
cadastrar equipamento. Baseado em mockups do Claude Skills, portados pro
código com ajustes pragmáticos. 16 arquivos · +2110 −408 linhas.

═══════════════════════════════════════════════════════════════
ONDA 1 — TELA EQUIP (LISTAGEM)
═══════════════════════════════════════════════════════════════

- Chips contadorados unificam KPI tiles + filtros antigos
- Hero "Organizar parque" condicional (só com semSetor>0)
- Toggle Lista <-> Grade com persistência localStorage
- Thumb 64x64 (era 40x40); avatar sem foto vira CTA "+ tirar foto"
- Tone-pill "Estável" neutra (dot verde + texto cinza, não compete com CTA)
- Setor card mostra preview inline de equipamentos (até 3 + "+N")
- TAG vazia omitida da meta line
- Card "PRIMEIRO SERVIÇO" compactado (1 linha em vez de 3)
- "≤30d" -> "Preventivas em 30 dias"
- "Aguardando" -> "Vazio" no setor card
- Empty states com copy contextual por filtro

═══════════════════════════════════════════════════════════════
ONDA 2 — MODAL DE CADASTRAR EQUIPAMENTO
═══════════════════════════════════════════════════════════════

- Subtítulo "Só precisa de nome e onde fica - o resto é opcional"
- Hero nameplate colapsável (compacta ao digitar nome)
- Banner "Usou a foto? Pode pular" + dica criticidade vs prioridade
- Progressive disclosure: 8 campos avançados atrás de toggle
- Smart defaults por tipo (Split->R-410A, Câmara->R-404A, etc)
- Tooltips em TAG / MPa / IP / criticidade
- Tech-toggle: label estático "Detalhes técnicos" + chevron rotativo
  (sem +/- textual redundante)
- Botão único "+ Novo equipamento" (removido "Cadastrar com foto" duplicado)
- Typo Sugestao -> Sugestão; "✓ Confirmar" -> "Cadastrar equipamento"
- Crumbs "Essenciais / Contexto / Detalhes técnicos"

═══════════════════════════════════════════════════════════════
ONDA 3 — MODAL DE DETALHES
═══════════════════════════════════════════════════════════════

- Cover 240px com pill "ampliar" + lightbox ao clicar
- Title-block consolidado (nome + sub muted "Local · TAG")
- Score ring com linearGradient cyan->success quando ok
- Fatores de risco viram CTAs acionáveis (Agendar/Ajustar)
- Accordion "Detalhes técnicos" fechado por default
- Sub-section titles cyan dentro do accordion
- Setor readonly; campos vazios -> CTA "Adicionar X" clicável
- Lixeira -> kebab menu (evita click acidental)
- Typo Historico -> Histórico
- Removida duplicação do detail view (estava renderizando 2x)

═══════════════════════════════════════════════════════════════
ONDA 4 — MODAL DE FOTOS
═══════════════════════════════════════════════════════════════

- Botão "Capa" permanente na 1ª foto + "Definir como capa" nas outras
- Legenda opcional por foto (60 chars, persistida em jsonb via
  normalizePhotoEntry)
- Câmera traseira protagonista no mobile (capture=environment)

═══════════════════════════════════════════════════════════════
ONDA 5 — PORTE DOS MOCKUPS SKILLS + FIXES VISUAIS
═══════════════════════════════════════════════════════════════

- Avatar sem foto: APENAS iniciais (emoji glyph removido em
  equipmentCards.js E dashboard.js — duplo ponto de renderização)
- Type-icon-overlay reformulado: badge cyan no canto inferior direito
  do avatar, NÃO mais overlay full-cover semi-transparente
  (mobile não sobrepõe mais as iniciais)
- Modo grade: zerado border-left tonal (warn/danger viram border-top 3px)
  pra alinhar cards horizontalmente sem zigue-zague
- Toggle Lista/Grade reposicionado: wrapper flex .equip-search-row
  coloca search + toggle inline ([input flex:1] [toggle flex-shrink:0])
- Handlers globais registrados: equip-set-view-mode, removido
  data-action obsoleto eq-photos-add (silencia warnings de console)

═══════════════════════════════════════════════════════════════
QUALIDADE
═══════════════════════════════════════════════════════════════

- 109/109 testes Vitest passando (5 suites relevantes)
- ESLint zero warnings
- Prettier OK
- Vite build transforma 755 módulos sem erro de código
- Mobile-first 360px, validado em DevTools
- A11y: aria-pressed, aria-expanded, aria-controls, focus-visible

═══════════════════════════════════════════════════════════════
ARQUIVOS MODIFICADOS (16)
═══════════════════════════════════════════════════════════════

- src/**tests**/equipamentosView.hero.test.js
- src/assets/styles/components.css
- src/assets/styles/components/\_equip-hero.css
- src/assets/styles/components/\_setor-card.css
- src/core/photoStorage.js (caption preservado em normalizePhotoEntry)
- src/ui/components/equipmentPhotos.js (capa + legenda)
- src/ui/components/nameplateCapture.js (auto-expand etiqueta)
- src/ui/controller/handlers/equipmentHandlers.js (handlers novos)
- src/ui/controller/helpers/themeInitHelpers.js (binds + smart defaults)
- src/ui/shell/templates/modals.js (form modal redesign)
- src/ui/shell/templates/views.js (view-toggle + search-row)
- src/ui/views/dashboard.js (remoção emoji glyph)
- src/ui/views/equipamentos.js (detail view redesign)
- src/ui/views/equipamentos/equipmentCards.js (avatar limpo + meta line)
- src/ui/views/equipamentos/hero.js (chips contadorados + hero condicional)
- src/ui/views/equipamentos/setores.js (preview equipamentos inline)
