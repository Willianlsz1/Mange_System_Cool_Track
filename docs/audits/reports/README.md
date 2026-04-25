# Audit Reports

Histórico de relatórios de auditoria. Cada arquivo é um snapshot datado.

## Convenção de nome

```
YYYY-MM-DD-<tipo>.md
```

Onde `<tipo>` é um de:

- `pre-deploy` — gerado pelo `../pre-deploy.md`
- `product-review` — gerado pelo `../product-review.md`

## Exemplo

```
2026-04-25-pre-deploy.md
2026-04-25-product-review.md
2026-05-25-product-review.md
2026-05-30-pre-deploy.md
```

## Por que comitar?

- **Trends** de LOC, bundle size, bug-list fechado ao longo do tempo
- **Evidência** de auditoria de segurança rastreável
- **Histórico** mostra evolução real do produto, não só código atual
- Próxima rodada compara com a anterior automaticamente (ver "Diff vs. relatório anterior" no `product-review.md`)
