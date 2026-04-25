# Product Review — CoolTrack Pro

Rode mensalmente OU quando algo dói (lentidão, bug recorrente, fluxo confuso).
**Tempo estimado:** 1–2h dependendo do escopo.
**Output:** Top 10 achados → 3 viram tarefa do próximo sprint, resto vira issue com label `tech-debt`.

> **Ambiente shell:** os comandos abaixo usam `grep`, `find`, `wc`. No Windows, use **Git Bash** ou **WSL**.
> Para PowerShell, há um bloco equivalente abaixo de cada bloco bash.

> Importante: durante refactor planejado, alguns checks abaixo são **tendência** (vs. relatório anterior), não binários.
> Veja `docs/refactor-plan.md` (se existir) para tracking de meta.

---

## 1. Arquitetura — file sizes & layering

```bash
# Top 20 arquivos por LOC (candidatos a refatoração)
find src -name "*.js" -not -path "*/__tests__/*" -exec wc -l {} \; | sort -rn | head -20

# Violação de camada: core/domain importando de ui é proibido
grep -rE "from.*['\"].*src/ui|from.*['\"]\.\./ui" src/core src/domain

# Views não podem importar de outras views (vazamento horizontal)
grep -rE "from ['\"]\\./[a-z]+\\.js['\"]|from ['\"]\\.\\./views/" src/ui/views

# Components não podem importar de views (camada reversa)
grep -rE "from ['\"]\\.\\./views/" src/ui/components
```

**Equivalente PowerShell:**

```powershell
# Top 20 arquivos por LOC (excluindo __tests__)
Get-ChildItem src -Recurse -Filter *.js |
  Where-Object { $_.FullName -notmatch '__tests__' } |
  ForEach-Object { [PSCustomObject]@{ Lines=(Get-Content $_.FullName).Count; File=$_.FullName } } |
  Sort-Object Lines -Descending | Select-Object -First 20

# Violação de camada: core/domain importando de ui — saída vazia = OK
Get-ChildItem -Path src\core,src\domain -Recurse -File |
  Select-String -Pattern "from.*['""].*src/ui|from.*['""]\.\./ui"

# Views não podem importar de outras views — saída vazia = OK
Get-ChildItem -Path src\ui\views -Recurse -File -Filter *.js |
  Select-String -Pattern "from ['""]\./[a-z]+\.js['""]|from ['""]\.\./views/"

# Components não podem importar de views — saída vazia = OK
Get-ChildItem -Path src\ui\components -Recurse -File |
  Select-String -Pattern "from ['""]\.\./views/"
```

**Checks (durante refactor: tendência > binário):**

- [ ] **Tendência** decrescente de LOC nos top 5 arquivos vs. último relatório
- [ ] Nenhum arquivo NOVO em `src/ui/views/` foi criado acima de 600 LOC
- [ ] Top arquivos antigos têm plano de redução documentado em `docs/refactor-plan.md`
- [ ] `src/core/` não importa de `src/ui/` nem de `src/features/`
- [ ] `src/domain/` não importa de `src/ui/`
- [ ] `src/features/` pode importar core e domain, nunca o contrário
- [ ] **Zero novos** imports view-to-view nesta janela (allowlist o que já existe se necessário)
- [ ] **Zero** imports de `ui/components/**` para `ui/views/**`

## 2. Bug List Conhecido (status check)

Da auditoria anterior — marque o que já fechou:

- [ ] Fotos migradas de base64 (Postgres) para Supabase Storage
- [ ] Assinaturas persistidas no banco com URL (não só localStorage)
- [ ] `clearRegistro` restaura corretamente o edit state
- [ ] Edição de registro preserva fotos originais
- [ ] `window.prompt` substituído por modal customizado no forgot password
- [ ] Tela em branco no bootstrap não acontece mais
- [ ] `components.css` presente e linkado corretamente
- [ ] Double-click no botão Salvar protegido (debounce ou disabled)
- [ ] README.md atualizado com setup, deploy e estrutura

## 3. Performance

```bash
# Bundle size + análise visual (rollup-plugin-visualizer já está em devDependencies)
npm run build
du -sh dist/
du -sh dist/assets/*.js

# Dependências duplicadas
npm ls --depth=0 2>&1 | grep -E "deduped|UNMET"
```

**Equivalente PowerShell:**

```powershell
npm run build

# tamanho total da pasta dist em MB
"{0:N2} MB" -f ((Get-ChildItem dist -Recurse -File |
  Measure-Object -Property Length -Sum).Sum / 1MB)

# tamanho de cada bundle JS
Get-ChildItem dist\assets\*.js |
  Select-Object Name, @{Name='KB';Expression={[math]::Round($_.Length/1KB,1)}}

# Dependências duplicadas
npm ls --depth=0 2>&1 | Select-String -Pattern "deduped|UNMET"
```

> Para abrir o `stats.html` gerado pelo `rollup-plugin-visualizer`, ele já está em `devDependencies` —
> configure no `vite.config.js` se ainda não estiver ativo.

- [ ] Bundle JS final < 500KB gzipped
- [ ] Sem dependências duplicadas no `npm ls`
- [ ] Listas grandes (registros, equipamentos) usam paginação ou virtual scroll quando > 100 itens
- [ ] Filtros não recalculam em todo render (cache simples ou debounce)
- [ ] `supabase.from(...).select('*')` substituído por select específico onde só preciso de 2-3 colunas
- [ ] Nenhum `await` sequencial onde `Promise.all` resolveria
- [ ] Imagens são redimensionadas no client antes do upload (não envia 8MP)

## 4. Duplicação

```bash
# Detecta blocos similares de 5+ linhas
npx jscpd src/ --min-lines 5 --min-tokens 50 --reporters console

# Datas cruas fora de core/utils.js (deve ser zero ou tendência decrescente)
grep -rE "new Date\(|toLocaleDateString|toISOString" src/ --include="*.js" \
  | grep -v "src/core/utils.js" \
  | grep -v "__tests__" \
  | wc -l
```

**Equivalente PowerShell:**

```powershell
# Detecta blocos similares de 5+ linhas
npx jscpd src/ --min-lines 5 --min-tokens 50 --reporters console

# Datas cruas fora de core/utils.js (count — meta: tendência decrescente)
(Get-ChildItem src -Recurse -Filter *.js |
  Where-Object { $_.FullName -notmatch 'core\\utils\.js$|__tests__' } |
  Select-String -Pattern 'new Date\(|toLocaleDateString|toISOString').Count
```

- [ ] Formatação (datas, status, moeda) centralizada em `src/core/utils.js`
- [ ] Constantes de status/labels em arquivo único (ex: `src/domain/constants/statuses.js`)
- [ ] Mesma constante (`STATUS_OPERACIONAL`, `PRIORIDADE_LABEL`, etc.) **não definida em mais de um lugar**
- [ ] Lógica de filtro de registros não duplicada entre views
- [ ] Helpers de Supabase (error handling, retry) centralizados

## 5. UX — teste em mobile real

> Importante: teste no celular **que técnicos usam em campo**, não só no DevTools.

- [ ] Onboarding pode ser concluído em até 3 toques por etapa
- [ ] Botão "Salvar" não fica embaixo do teclado virtual no Android
- [ ] Inputs numéricos abrem teclado numérico (`type="number"` ou `inputmode="decimal"`)
- [ ] Captura de foto e assinatura funcionam offline e sincronizam quando volta a internet
- [ ] Mensagens de erro em PT-BR humano (não "Error 401 Unauthorized")
- [ ] Loading state em toda chamada async (sem tela parecendo travada)
- [ ] Botões de ação destrutiva (deletar, descartar edição) têm confirmação
- [ ] Modal de cadastro de equipamento scrolla corretamente com botões fixos no rodapé

## 6. AI Label Flow (se já implementado)

- [ ] Existe fallback quando a API falha (timeout, rate limit, erro 5xx)
- [ ] Resposta é validada antes de salvar (parse JSON, schema check)
- [ ] Latência > 3s mostra skeleton/loading (não congela UI)
- [ ] Falhas são logadas (Sentry, ou tabela `errors_log` no Supabase)
- [ ] Custo por chamada estimado e documentado (USD/mês previsto)
- [ ] Existe rate limit no front (não dispara 50 chamadas se usuário clicar rápido)

---

## Prompt para Claude

Cole isto + saída de tree (ver README) + os 3 maiores arquivos de `src/`:

> Aja como tech lead revisando o CoolTrack Pro (Vite + Vanilla JS + Supabase, dev solo).
>
> Contexto:
>
> - App de manutenção HVAC para técnicos autônomos
> - Prestes a abrir beta com ~10 usuários reais
> - Multi-tenant planejado para fase futura
> - Stack atual: Vanilla JS sem framework, Supabase como backend
> - Arquitetura em camadas: core → domain → ui → features (ui pode usar tudo abaixo)
>
> Analise nesta ordem de prioridade:
>
> 1. Riscos que aparecem com 10+ usuários simultâneos: queries N+1, payload grande, locks, race condition no sync engine (`core/storage.js`)
> 2. Refatorações de alto ROI: arquivos > 600 LOC, responsabilidades misturadas, extração que **realmente reduz** o pai (não só move código)
> 3. Duplicação que vai virar dívida séria quando o multi-tenant entrar (constantes de status, filtros, formatação de data)
> 4. Pontos de fricção UX no fluxo principal: "criar registro com foto + assinatura"
> 5. **Plan gate bypass** — caminhos onde `setCachedPlan`/`isCachedPlanPro` pode permitir uso de feature paga sem assinatura
>
> Para cada item, retorne:
> | Arquivo:linha | Impacto real (não teórico) | Esforço (S/M/L) | Fix sugerido |
>
> Não me dê 50 itens. Me dê os 5–10 que realmente importam agora.
> Se algo é "boa prática mas não vai dar problema nos próximos 6 meses", ignore.

---

## Output Final

Salvar em `docs/audits/reports/YYYY-MM-DD-product-review.md`:

1. **Top 10 achados** ordenados por impacto
2. **3 selecionados** para o próximo sprint (com critério de "concluído")
3. **Resto** vira issue no GitHub com label `tech-debt` e milestone vazia
4. **Métricas snapshot**:
   - Bundle size (KB gzipped)
   - LOC dos top 5 maiores arquivos
   - Total LOC do `src/` (excluindo `__tests__/`)
   - Dependências (count em `package.json`)
   - % de bug list fechado (item 2)
   - Datas cruas fora de `core/utils.js` (count)
   - Imports view-to-view (count)
5. **Diff vs. relatório anterior** (cada métrica deve ter ↑/↓/=)
