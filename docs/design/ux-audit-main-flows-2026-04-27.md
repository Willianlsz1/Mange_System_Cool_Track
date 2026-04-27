# Navegação por Modos (Beta)

Data: 2026-04-27  
Escopo: separar claramente **Modo Rápido** e **Modo Empresa** sem refatoração pesada

## Modo Ask (diagnóstico inicial)

### Diagnóstico

Hoje os dois modos estão misturados em três níveis:

1. **Menu/navegação primária mistura operação rápida e gestão avançada**
   - Bottom nav e sidebar expõem juntos itens de execução rápida (`Registrar`, `Equipamentos`, `Serviços`) e gestão (`Clientes`, filtros por contexto, alertas, relatórios).
   - Isso força o usuário “rápido” a conviver com opções de gestão o tempo todo.

2. **Rota de Clientes está no menu principal, mas é Pro-gated**
   - Usuário Free/Plus toca em `Clientes`, recebe paywall e retorno por `history.back()`.
   - Essa ida e volta quebra previsibilidade da navegação.

3. **Contextos de gestão (cliente/setor) invadem fluxo operacional**
   - Fluxo de Equipamentos aceita contexto de cliente/setor e drill-down.
   - Registro e Relatório recebem filtros/intenções vindos desses contextos.
   - Resultado: para tarefa simples “registrar e enviar”, há estados e filtros extras.

### Plano em etapas

1. Definir contrato de telas por modo (rápido vs empresa).
2. Aplicar separação **somente de navegação** (sem mexer em regra de negócio).
3. Introduzir alternância explícita de modo no shell.
4. Reorganizar menus e CTAs conforme modo ativo.
5. Manter rotas existentes para compatibilidade; só ajustar pontos de entrada.

### Riscos

- Risco de confundir usuários atuais se a alternância de modo ficar escondida.
- Risco de duplicação de entrada para mesma tela se não houver regras claras de priorização.
- Risco de regressão de navegação se alterar rota default sem telemetria de validação.

### Arquivos afetados (análise/documentação)

- `src/ui/shell/templates/nav.js`
- `src/ui/shell/templates/sidebar.js`
- `src/ui/shell.js`
- `src/ui/controller/routes.js`
- `src/ui/views/equipamentos/contextState.js`
- `src/ui/views/clientes.js`
- `src/ui/views/registro.js`
- `src/ui/views/relatorio.js`
- `src/ui/controller/handlers/reportExportHandlers.js`

---

## 1) Onde os modos estão misturados hoje

## 1.1 Navegação principal

- `Clientes` está lado a lado com `Registrar` no menu principal (mobile/desktop), embora pertença a um uso mais empresarial.
- `Relatórios` e `Serviços` convivem com ações de gestão e operação sem hierarquia por perfil.

## 1.2 Gate de plano no centro da navegação

- A rota de `Clientes` intercepta Free/Plus com paywall + retorno automático.
- Em vez de orientar “este fluxo é Modo Empresa”, o app parece “instável” para quem só quer operar rápido.

## 1.3 Encadeamento entre contextos

- `Clientes` envia para `Equipamentos` com `equipCtx` (cliente/setor).
- `Clientes` envia para `Histórico` com filtro de cliente.
- `Relatório` e exportações reaproveitam esses filtros e intents.

**Impacto:** o fluxo simples (equipamento → registro → envio) compartilha os mesmos pontos de entrada de gestão, aumentando carga cognitiva.

---

## 2) Nova arquitetura de navegação (simples)

## 2.1 Princípio

- **Um app, duas cascas de navegação**:
  - **Modo Rápido**: operação de campo.
  - **Modo Empresa**: organização e gestão.
- Mesmas rotas internas; muda apenas **ordem, destaque e visibilidade de entradas**.

## 2.2 Estrutura proposta

### Modo Rápido (default para novos usuários)

Navegação principal:

1. Equipamentos
2. Registrar
3. Serviços
4. Relatório

Navegação secundária (menu “Mais”):

- Clientes (atalho opcional)
- Alertas
- Conta
- Planos

### Modo Empresa

Navegação principal:

1. Clientes
2. Equipamentos
3. Serviços
4. Relatório

Dentro de Clientes (subfluxo):

- Cliente → Setores → Equipamentos → Serviços/Relatórios

Navegação secundária:

- Registrar (atalho rápido)
- Alertas
- Conta
- Planos

---

## 3) Pertencimento de telas por modo

## 3.1 Modo Rápido — telas principais

- `equipamentos`
- `registro`
- `historico` (serviços)
- `relatorio`

Telas secundárias de suporte:

- `alertas`
- `conta`
- `pricing`

## 3.2 Modo Empresa — telas principais

- `clientes`
- `equipamentos` (com contexto cliente/setor)
- `historico` (com filtros de cliente)
- `relatorio` (com filtros avançados e exportações)

Telas secundárias:

- `registro` (atalho operacional)
- `alertas`
- `conta`
- `pricing`

---

## 4) Fluxo ideal de cada modo

## 4.1 Modo Rápido (operação)

**Equipamentos → Registrar serviço → Salvar → Enviar relatório**

Regras:

- Sempre priorizar CTA “Registrar serviço”.
- Campos opcionais recolhidos por padrão no registro.
- Pós-save com decisão única: “Enviar pro cliente” (primário) e “Baixar PDF” (secundário).
- Evitar desvio automático para telas de gestão.

## 4.2 Modo Empresa (gestão)

**Clientes → Cliente → Setores → Equipamentos → Serviços/Relatórios**

Regras:

- Cliente é ponto de entrada principal.
- Contexto atual visível (chip/breadcrumb): Cliente X / Setor Y.
- Drill-down previsível com botão claro de voltar nível.
- Ação “Registrar serviço” sempre disponível como atalho, sem quebrar contexto.

---

## 5) Alternância entre modos sem confundir

## 5.1 Mecanismo

- Toggle explícito no shell: `Modo: Rápido | Empresa`.
- Persistência local da escolha do usuário.
- Primeira execução: pergunta curta “Como você usa o app?” com duas opções.

## 5.2 Comportamento

- Trocar modo **não muda dados nem permissões**; só reorganiza navegação.
- Ao alternar:
  - manter rota atual se ela existir no modo;
  - se não existir como principal, mover para equivalente mais próximo (ex.: `clientes` → `equipamentos` no Modo Rápido) com toast curto explicativo.

## 5.3 Copy mínima

- “Modo Rápido ativo.”
- “Modo Empresa ativo.”
- “Você pode trocar a qualquer momento.”

---

## 6) Mudanças mínimas para beta (incrementais)

1. **Introduzir flag de modo no shell** (sem alterar lógica de domínio).
2. **Reordenar itens do nav/sidebar por modo** (mesmas rotas).
3. **Mover Clientes para secundário no Modo Rápido**.
4. **No Modo Empresa, promover Clientes para item principal #1**.
5. **Remover comportamento de `history.back()` no bloqueio de Clientes** e substituir por feedback estável no contexto atual.
6. **Adicionar chip de contexto** (cliente/setor) em Equipamentos/Serviços/Relatório quando vindo de fluxo empresa.

Tudo acima pode ser feito sem refatoração estrutural pesada, apenas com ajustes de shell/router/ordenação de entradas.

---

## 7) Riscos e mitigação

1. **Risco:** usuários não perceberem o modo ativo.  
   **Mitigação:** indicador persistente no topo + toast na troca.

2. **Risco:** regressão em deep-links e bookmarks internos.  
   **Mitigação:** preservar rotas e usar fallback de equivalência por modo.

3. **Risco:** aumento de complexidade de navegação no código.  
   **Mitigação:** centralizar mapa de menu por modo em configuração única.

4. **Risco:** confusão com gate de plano em Clientes.  
   **Mitigação:** tratar gate como status da feature, não como redirecionamento implícito.

---

## 8) Próximos passos recomendados

1. Validar com 5–8 usuários (metade perfil rápido, metade perfil empresa).
2. Medir:
   - tempo até registro salvo;
   - toques até envio do relatório;
   - taxa de uso de Clientes em cada modo;
   - taxa de troca de modo.
3. Só depois implementar alterações visuais/UX mais profundas.
