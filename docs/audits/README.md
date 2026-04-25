# Audits — CoolTrack Pro

Sistema enxuto de auditoria para dev solo. Dois playbooks, sem inventar moda.

## Estrutura

```
docs/audits/
  README.md              # você está aqui
  pre-deploy.md          # roda antes de CADA release
  product-review.md      # roda 1x/mês ou quando algo dói
  reports/               # outputs datados, comitados (histórico de evolução)
```

## Quando rodar cada um

| Audit               | Quando                                                                      | Tempo     |
| ------------------- | --------------------------------------------------------------------------- | --------- |
| `pre-deploy.md`     | Antes de cada deploy para produção                                          | 15–20 min |
| `product-review.md` | Mensalmente OU quando bater dor real (lentidão, bug recorrente, UX travada) | 1–2h      |

## Workflow

1. Abrir o `.md` correspondente
2. Rodar os comandos shell na ordem (ver nota abaixo sobre cross-platform)
3. Marcar checkboxes — se algo falha, **parar** e corrigir antes de seguir
4. Copiar o "Prompt para Claude" do final do arquivo
5. Colar no chat junto com a saída do comando de tree + arquivos relevantes
6. Aplicar mudanças via Codex (VSCode)
7. Salvar relatório final em `docs/audits/reports/YYYY-MM-DD-<tipo>.md`

## Ambiente shell recomendado

Os playbooks usam comandos bash (`grep`, `find`, `wc`, `du`). No Windows, **a forma mais simples é
rodar via Git Bash** (instalado junto com Git for Windows) ou WSL — todos os comandos funcionam direto.

Se preferir PowerShell nativo, cada `pre-deploy.md` e `product-review.md` traz **um bloco PowerShell
equivalente abaixo de cada bloco bash** (procure por "Equivalente PowerShell:").

### Comando `tree` cross-platform

| OS / Shell                                   | Comando                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| Windows (cmd / PowerShell)                   | `tree /F /A src`                                      |
| Linux/macOS / Git Bash                       | `tree -L 3 -I 'node_modules\|dist\|test-results' src` |
| Fallback universal (qualquer shell com node) | `find src -type f -name "*.js" \| head -50`           |

## Reports — comitar, não gitignorar

A pasta `reports/` **deve ser comitada**. O valor está no histórico:

- Cada relatório mostra o estado em uma data específica
- Trends de LOC, bundle size e bug list ao longo do tempo
- Auditoria de segurança vira evidência rastreável

Nome do arquivo: `YYYY-MM-DD-<tipo>.md` (ex: `2026-04-25-pre-deploy.md`).

## Regra de ouro

Auditoria **não substitui usuário real**. Se a escolha for "rodar audit completo" vs. "lançar para 5 beta testers", lance. Beta tester acha bug que audit não acha.

Estes dois playbooks existem para você não esquecer dos básicos de segurança antes de cada deploy, e para forçar uma revisão técnica periódica que não dependa do humor do dia.
