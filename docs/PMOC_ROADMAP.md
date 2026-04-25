# Roadmap PMOC — CoolTrack PRO

**Status:** Fase 1 entregue. Fases 2-6 documentadas pra retomar.
**Decisão de produto:** Feature **Pro-only** (gate aplicado na geração do PDF PMOC).
**Justificativa:** clientes pediram explicitamente; vira motivo concreto de
upgrade pra técnicos com contratos comerciais (shopping/hospital/condomínio).

---

## ✅ Fase 1 — Base de dados + empresa responsável (CONCLUÍDA)

**Entregue em 25 abr 2026:**

- `supabase/migrations/20260425120000_pmoc_clientes_empresa.sql`
  - `profiles` ganha `razao_social`, `cnpj`, `inscricao_estadual`, `inscricao_municipal`
  - Tabela `clientes` (id, user_id, nome, razao_social, cnpj, ie, im, endereco,
    contato, url_chamados, observacoes, created_at, updated_at)
  - RLS com `auth.uid() = user_id` (4 policies)
  - `equipamentos.cliente_id` FK opcional (ON DELETE SET NULL)
  - `equipamentos.patrimonio` (código de inventário do cliente)
- `src/ui/components/onboarding/profileModal.js`
  - Nova seção "Dados legais (opcional)" com 4 inputs
  - `Profile.save` persiste todos os campos no localStorage
- `src/domain/pdf/sections/cover.js`
  - Caixa "TÉCNICO RESPONSÁVEL" expande pra 42mm quando há dados PMOC
  - Renderiza CNPJ, IE, IM (omitidos quando vazios)

**Como testar:** abre Perfil → preenche CNPJ → gera PDF de qualquer relatório.
A caixa do prestador agora mostra dados legais.

---

## 📋 Fase 2 — Tela "Clientes" + vínculo equipamento↔cliente

**Esforço estimado:** 2 dias

**O que entregar:**

1. **Nova rota `view-clientes`**
   - Lista de clientes (cards similares aos de setor)
   - Busca + ordenação
   - Empty state com CTA "Cadastrar primeiro cliente"
2. **Modal `modal-cliente`** (cadastro/edição)
   - Inputs: nome\*, razão social, CNPJ, IE, IM, endereço, contato, URL chamados, observações
   - Validação CNPJ (14 dígitos numéricos, dígito verificador)
   - Validação CPF (11 dígitos, com fallback se for PF)
3. **Integração com `modal-add-eq`**
   - Adicionar select "Cliente" na seção Contexto (opcional)
   - Mostrar cliente atual em `viewEquip` (na seção Identificação)
4. **Storage layer**
   - `src/core/storage.js`: CRUD de clientes (igual setores)
   - `src/core/state.js`: estado clientes
   - `normalizers`: campo `cliente_id` no equipamento

**Arquivos a criar:**

- `src/ui/views/clientes.js`
- `src/ui/components/clienteModal.js`
- `src/ui/shell/templates/views.js` (adicionar `<div id="view-clientes">`)
- `src/ui/shell/templates/modals.js` (adicionar `modal-cliente`)
- `src/__tests__/clienteModal.test.js`

**Sem gate Pro nessa fase** — cadastro de cliente é feature gratuita.
Pro só destrava o PDF PMOC depois.

---

## 📋 Fase 3 — Templates de checklist NBR 13971

**Esforço estimado:** 3 dias

**Objetivo:** definir os checklists padronizados que viram base do PMOC.

**O que entregar:**

1. **`src/domain/checklistTemplates.js`**
   - Templates por tipo de equipamento + periodicidade
   - Baseado em NBR 13971 (Anexo A — Inspeção e manutenção)
   - Estrutura:
     ```js
     export const CHECKLIST_TEMPLATES = {
       'Split Hi-Wall': {
         mensal: [
           { id: 'filtros_ar', label: 'FILTROS DE AR', items: [
             { id: 'limpar_elementos', label: 'Limpar elementos filtrantes...' },
             // ...
           ]},
           // ...
         ],
         trimestral: [...],
         semestral: [...],
       },
       'Chiller': { ... },
       // ...
     };
     ```
2. **Função `getChecklistFor(equip, periodicidade)`**
   - Retorna o template apropriado pro tipo do equip
   - Fallback pra template "genérico" se tipo não tiver template específico
3. **Helper `calculateChecklistScore(checklist, fillData)`**
   - Calcula % de itens "conforme"

**Templates mínimos (cobre 80% dos casos):**

- Split Hi-Wall (mensal, trimestral)
- Split Cassette (mensal, trimestral)
- Chiller (mensal, trimestral, semestral)
- Câmara fria (mensal, trimestral)
- Genérico (mensal) — fallback

**Sem alterações no schema** — checklist data vai em `registros.checklist` (jsonb)
que já foi previsto na Fase 1 mas a migration desse campo entra na Fase 4.

---

## 📋 Fase 4 — UI marcação de checklist no registro + medições

**Esforço estimado:** 3 dias

**O que entregar:**

1. **Migration `20260427_registros_checklist_medicoes.sql`**
   - `registros.checklist jsonb default '{}'::jsonb`
   - `registros.medicoes jsonb default '{}'::jsonb`
   - `registros.tempo_planejado_inicio timestamptz`
   - `registros.tempo_planejado_fim timestamptz`
   - `registros.tipo_servico` valida em ('pontual', 'pmoc')
2. **`view-registro`: novo flow**
   - Toggle no topo: "Serviço pontual" vs "PMOC programado"
   - Pontual = flow atual (descrição livre, fotos, custo)
   - PMOC = carrega checklist do template, técnico marca cada item
3. **Componente `<ChecklistFiller>`**
   - Renderiza sub-seções (FILTROS, BANDEJAS, etc) com items
   - Cada item: 3 botões (Conforme / Não conforme / N/A)
   - Mostra % atual de conformidade no topo de cada seção
4. **Componente `<MedicoesForm>`**
   - Formulário pra correntes trifásicas (R/S/T) + tensões + temperaturas
   - Compara automaticamente com nominal do equipamento (`dadosPlaca`)
   - Highlight vermelho se valor fora de ±10% nominal
5. **Validação**
   - PMOC exige todos itens marcados (Conforme/N/A) pra finalizar
   - Pontual continua sem validação extra

---

## 📋 Fase 5 — Novo template PDF PMOC

**Esforço estimado:** 4 dias (mais complexo)

**O que entregar:**

1. **Reorganizar PDFs em pasta `templates/`:**
   ```
   src/domain/pdf/
   ├── templates/
   │   ├── service/      ← atual (move o existente pra cá)
   │   │   ├── cover.js
   │   │   ├── services.js
   │   │   ├── signatures.js
   │   │   └── footer.js
   │   └── pmoc/         ← novo
   │       ├── cover.js          ← Empresa + Cliente + Lista ativos
   │       ├── checklist.js      ← Sub-seções com pontuação %
   │       ├── medicoes.js       ← Tabelas trifásicas
   │       ├── signatures.js     ← compartilhado ou novo
   │       └── footer.js         ← compartilhado
   ├── primitives.js
   ├── shareReport.js    ← roteia pra template (atual / pmoc)
   └── index.js
   ```
2. **`templates/pmoc/cover.js`:**
   - Cabeçalho "PMOC - Plano de Manutenção, Operação e Controle - <Cliente> (<data>)"
   - "Por: <nome>" + "Em: <timestamp>"
   - Empresa responsável (5 campos)
   - Cliente (com endereço + URL chamados)
   - Lista de ativos: tabela com Nome hierárquico, Local, Marca, Patrimônio/Série, Info adicional
3. **`templates/pmoc/checklist.js`:**
   - Por equipamento atendido: header com "Pontuação X%"
   - Sub-seções (FILTROS, BANDEJAS, etc) com items + status
   - Fotos integradas
4. **`templates/pmoc/medicoes.js`:**
   - Tabelas trifásicas formatadas (CORRENTE COMPRESSOR R/S/T, TENSÃO R-S/R-T/S-T)
   - Temperaturas (retorno do ar, insuflamento)
5. **`shareReport.js`:**
   - Recebe `{ tipo: 'service' | 'pmoc' }` e roteia
   - Para PMOC: agrega registros do período em estrutura por equipamento
6. **Gate Pro APLICADO AQUI:**
   - `if (tipo === 'pmoc' && !hasProAccess(profile)) → upsell modal`

---

## 📋 Fase 6 — UX final: dropdown "Gerar PDF" + share

**Esforço estimado:** 1 dia

**O que entregar:**

1. **Tela Histórico** (em cada registro):
   - Botão "Gerar PDF" com dropdown:
     - 📄 Relatório de serviço (rápido, atual)
     - 📋 Relatório PMOC (formal — gated Pro)
2. **Tela Relatório** (relatório por período):
   - Mesmo dropdown
3. **Compartilhar PMOC**:
   - WhatsApp: nome do arquivo "PMOC <Cliente> <Mês/Ano>.pdf"
   - E-mail: subject "Relatório PMOC - <Cliente> - <Mês/Ano>"
4. **Share-as-link** (opcional, futura):
   - Upload pro bucket `relatorios/`, gera signed URL 7 dias
   - Já existe infra (`shareReport.js` faz isso)

---

## 🎯 Decisões importantes pra retomar

1. **Pro-only:** PMOC PDF gated. Cadastro de cliente continua livre.
2. **Sem migration retroativa:** equips antigos sem cliente continuam OK.
3. **Templates fixos no MVP:** customização vem só se usuário pedir (Fase 7+).
4. **Endereço campo único:** sem CEP estruturado por agora.
5. **1 equip = 1 cliente atual:** sem histórico de troca de cliente.

---

## ⏱ Estimativa total

| Fase                       | Esforço      |
| -------------------------- | ------------ |
| 1 — Schema + empresa       | ✅ Entregue  |
| 2 — Clientes UI            | 2 dias       |
| 3 — Templates checklist    | 3 dias       |
| 4 — UI registro + medições | 3 dias       |
| 5 — PDF PMOC               | 4 dias       |
| 6 — UX final               | 1 dia        |
| **TOTAL pendente**         | **~13 dias** |

**Recomendação:** abrir closed beta agora com **só a Fase 1**. Coletar
feedback. Quem perguntar por PMOC vai pra waitlist. Quando ≥30% dos testers
pedirem, executar Fases 2-6 com prioridade alta.

---

## 📚 Referências normativas (pra Fase 3)

- **Lei 13.589/2018** — Plano de Manutenção, Operação e Controle (PMOC) obrigatório
- **Portaria GM/MS 3.523/1998** — Padrões de qualidade do ar interior
- **ABNT NBR 13971:2014** — Sistemas de refrigeração, condicionamento de ar e
  ventilação — Manutenção programada (Anexo A: checklist mínimo)
- **ABNT NBR 16401-3:2008** — Instalações de ar-condicionado — Sistemas centrais
  e unitários (qualidade do ar)

Os templates da Fase 3 devem citar a norma (`fonte: NBR 13971 Anexo A.2`)
em comentários pra trilha de auditoria.
