# AUDITORIA — CoolTrack Pro

> Escopo: análise estática completa do repositório (sem alterações funcionais), cobrindo bugs ocultos, fluxos incompletos, erros silenciosos, segurança básica, UX, performance e código morto.

## 🔴 Crítico

### 1) HTML quebrado no histórico (estrutura duplicada de botão/SVG)
- **Arquivo/Linha:** `src/ui/views/historico.js:74-85`
- **Problema:** o template HTML da timeline contém fechamento/abertura extra de `<button>`/`</div>` e um `<svg>` órfão.
- **Impacto para o usuário:** pode causar renderização inconsistente da lista, clique em ações erradas e comportamento imprevisível entre navegadores.
- **Sugestão de correção:** reconstruir o bloco de ações da timeline com marcação válida e testar interações de editar/excluir após render.

### 2) Possível XSS no modal de conta (dados injetados em `innerHTML` sem escape)
- **Arquivo/Linha:** `src/ui/controller.js:227-251`
- **Problema:** `nome` e `user.email` são interpolados em `overlay.innerHTML` sem sanitização (`Utils.escapeHtml`).
- **Impacto para o usuário:** risco de injeção de script/markup caso dados de perfil/identidade venham comprometidos.
- **Sugestão de correção:** aplicar escape em todos os campos interpolados em HTML dinâmico e, quando possível, montar DOM via `textContent`.

### 3) Listeners duplicados ao navegar para “Registro” várias vezes
- **Arquivo/Linha:** `src/ui/views/registro.js:84-88`, `src/ui/views/registro.js:57-73`
- **Problema:** `initRegistro()` adiciona listeners (`input`, `change`) a cada entrada na rota, sem teardown.
- **Impacto para o usuário:** eventos disparando múltiplas vezes, UI degradada, avisos duplicados e aumento de consumo de memória.
- **Sugestão de correção:** usar guard de inicialização (ex.: `dataset.bound`) ou remover listeners antigos antes de registrar novos.

### 4) Compressão de foto pode “travar” silenciosamente em erro de leitura
- **Arquivo/Linha:** `src/ui/components/photos.js:10-27`
- **Problema:** `compressImage()` não trata `reader.onerror`/`img.onerror`; a Promise pode nunca resolver/rejeitar.
- **Impacto para o usuário:** upload aparenta ficar preso em “Processando foto(s)...” em arquivos inválidos/corrompidos.
- **Sugestão de correção:** adicionar handlers de erro para `FileReader` e `Image`, rejeitando Promise com feedback claro.

---

## 🟡 Moderado

### 5) Erros silenciosos em sincronização/migração com Supabase
- **Arquivo/Linha:** `src/core/storage.js:165-167`, `src/core/storage.js:184-187`, `src/core/storage.js:238-240`
- **Problema:** `catch` sem log/telemetria/feedback em pontos críticos de migração e sync.
- **Impacto para o usuário:** dados podem não sincronizar e usuário não entende por quê.
- **Sugestão de correção:** logar motivo técnico (console + diagnóstico), e notificar usuário quando falha persistir.

### 6) Risco de data “Hoje” errada por UTC vs fuso local
- **Arquivo/Linha:** `src/ui/views/historico.js:57`
- **Problema:** comparação com `new Date().toISOString().slice(0, 10)` usa UTC, enquanto registros são locais (`datetime-local`).
- **Impacto para o usuário:** badge “Hoje” pode aparecer/desaparecer incorretamente em certas horas/fusos.
- **Sugestão de correção:** comparar datas no mesmo timezone local (ex.: helper local `YYYY-MM-DD`).

### 7) Dados sensíveis em log de console
- **Arquivo/Linha:** `src/ui/controller.js:142`, `src/ui/controller.js:147`
- **Problema:** loga objeto `user` e erros de perfil em produção.
- **Impacto para o usuário:** exposição desnecessária de metadados de autenticação em ambientes compartilhados.
- **Sugestão de correção:** remover logs ou protegê-los por flag de desenvolvimento.

### 8) Ações assíncronas com `import(...).then(...)` sem `.catch()`
- **Arquivo/Linha:** `src/ui/views/equipamentos.js:149-151`, `186`, `190-191`, `237`, `246`
- **Problema:** falha de import dinâmico pode gerar rejeição não tratada.
- **Impacto para o usuário:** ação não acontece e pode não haver feedback.
- **Sugestão de correção:** encadear `.catch()` com `Toast.error(...)` e fallback seguro.

### 9) Inconsistência de módulo de perfil (duas fontes de verdade)
- **Arquivo/Linha:** `src/features/profile.js:1-27`, `src/ui/components/onboarding.js:23-36`, `src/domain/pdf.js:15`, `src/domain/whatsapp.js:9`
- **Problema:** existe `Profile` duplicado (features e onboarding), e partes do app importam módulos diferentes.
- **Impacto para o usuário:** risco de divergência futura de comportamento de perfil.
- **Sugestão de correção:** consolidar em um único módulo de domínio (`features/profile.js`) e reexportar onde necessário.

### 10) Fluxo de autenticação sem caminho explícito de fechamento
- **Arquivo/Linha:** `src/ui/components/authscreen.js:4-246`
- **Problema:** overlay de auth não possui botão “fechar/cancelar”; saída depende de login/cadastro/guest.
- **Impacto para o usuário:** sensação de bloqueio do app em cenários de erro ou indecisão.
- **Sugestão de correção:** adicionar CTA de fechar/voltar e instrução clara de próximo passo.

### 11) Persistência de assinatura em `localStorage` sem estratégia de expiração
- **Arquivo/Linha:** `src/ui/components/signature.js:169-177`, `src/ui/views/historico.js:109`
- **Problema:** assinaturas ficam persistidas por chave individual e só são removidas ao excluir registro.
- **Impacto para o usuário:** crescimento de armazenamento local e possível perda de espaço ao longo do tempo.
- **Sugestão de correção:** política de retenção/compactação e limpeza durante manutenção de dados.

---

## 🔵 Melhoria

### 12) Tipografia de inputs abaixo de 16px em desktop/mobile (zoom iOS possível)
- **Arquivo/Linha:** `src/assets/styles/components.css:531-540`, `src/ui/components/authscreen.js:65-71`
- **Problema:** `font-size: 13px/15px` em campos de entrada.
- **Impacto para o usuário:** iOS pode aplicar zoom automático ao focar, prejudicando UX.
- **Sugestão de correção:** usar `font-size >= 16px` para inputs em mobile (ou via media query específica).

### 13) Áreas de toque pequenas para ações da timeline
- **Arquivo/Linha:** `src/assets/styles/components.css:460-472`
- **Problema:** botões de ação têm apenas `padding` pequeno e não garantem alvo mínimo de 44x44.
- **Impacto para o usuário:** dificuldade de toque em telas pequenas.
- **Sugestão de correção:** definir `min-width/min-height: 44px` para controles clicáveis no mobile.

### 14) Cálculo de uso de storage pode ser caro em renderizações frequentes
- **Arquivo/Linha:** `src/core/utils.js:99-105`, `src/ui/views/dashboard.js:111-120`, `src/ui/views/dashboard.js:379-380`
- **Problema:** varredura de `localStorage` completo para cada atualização de cabeçalho/dashboard.
- **Impacto para o usuário:** impacto incremental de performance em dispositivos mais lentos.
- **Sugestão de correção:** memoizar valor e recalcular apenas após operações de escrita.

### 15) Sincronização de técnicos sequencial (N requests)
- **Arquivo/Linha:** `src/core/storage.js:95-101`
- **Problema:** `await` dentro de loop para cada técnico.
- **Impacto para o usuário:** sync mais lento com listas maiores.
- **Sugestão de correção:** enviar lote único com `upsert` array.

### 16) Geração de PDF consulta assinatura no storage múltiplas vezes
- **Arquivo/Linha:** `src/domain/pdf.js:368-373`
- **Problema:** filtro e render fazem leituras repetidas de `localStorage` por registro.
- **Impacto para o usuário:** custo desnecessário ao gerar relatórios grandes.
- **Sugestão de correção:** pré-carregar mapa `registroId -> assinatura` uma vez por geração.

---

## ⚫ Código morto / sobras

### 17) Import não utilizado (`jspdf-autotable`)
- **Arquivo/Linha:** `src/domain/pdf.js:12`
- **Problema:** `autoTable` é importado, mas não é usado.
- **Impacto para o usuário:** bundle maior/manutenção confusa.
- **Sugestão de correção:** remover import ou aplicar tabela real via plugin.

### 18) Export não utilizado (`highlightText`)
- **Arquivo/Linha:** `src/ui/views/relatorio.js:74-78`
- **Problema:** função exportada sem chamada em qualquer módulo.
- **Impacto para o usuário:** nenhum direto; aumenta dívida técnica.
- **Sugestão de correção:** remover ou integrar na busca do relatório.

### 19) Função duplicada de edição de registro no módulo errado
- **Arquivo/Linha:** `src/ui/views/historico.js:114-143` e `src/ui/views/registro.js:248-270`
- **Problema:** `loadRegistroForEdit` existe em dois arquivos; versão de `historico.js` não é usada pelo controller.
- **Impacto para o usuário:** risco de manutenção divergente.
- **Sugestão de correção:** manter apenas implementação em `registro.js` e remover duplicata.

---

## Cobertura por fases solicitadas

- **Fase 1 (bugs ocultos):** itens 1, 3, 4, 5, 6, 8, 10, 11.
- **Fase 2 (código morto):** itens 17, 18, 19.
- **Fase 3 (funcionalidades incompletas):** itens 4, 8, 10.
- **Fase 4 (segurança):** itens 2, 7, 11.
- **Fase 5 (UX):** itens 10, 12, 13.

## Observação final

A base está funcional e com boa separação em módulos, mas os pontos críticos acima merecem prioridade imediata (principalmente **XSS potencial**, **HTML quebrado no histórico** e **listeners duplicados no formulário de registro**), pois afetam segurança, previsibilidade e confiança do usuário final.
