# Bundle Audit — Lazy Imports

Data do último audit: 2026-04-20.
Como reproduzir: `ANALYZE=true npm run build && open dist/bundle-stats.html`.

## TL;DR

Os três pacotes "pesados" (jspdf, jspdf-autotable, chart.js) já estão
em chunks separados, lazy-loaded sob demanda. Nenhum deles faz parte
do bundle inicial. Nada a fazer aqui.

## Tamanho dos chunks produzidos (dist/assets)

| Chunk              | Tamanho (minificado) | Trigger do load                                    |
| ------------------ | -------------------- | -------------------------------------------------- |
| `index.*.js`       | ~667 KB              | Boot inicial (app.js + core + UI shell + supabase) |
| `pdf.*.js`         | ~430 KB              | Primeiro "Exportar PDF" do usuário                 |
| `charts.*.js`      | ~208 KB              | Primeira navegação ao dashboard (view-inicio)      |
| `html2canvas.*.js` | ~197 KB              | Mesma trigger do `pdf.*.js` (sub-chunk)            |
| `index.es.*.js`    | ~151 KB              | Junto com `pdf.*.js` (jspdf internals)             |
| `landingPage.*.js` | ~47 KB               | Primeira visita anônima (tela de marketing)        |
| `purify.es.*.js`   | ~23 KB               | Sanitize de inputs rich-text                       |

Se algum deles crescer muito (> 800 KB), rodar analyzer e revisar.

## Pontos de lazy-load no código

### 1. jspdf + jspdf-autotable

Ponto único de import dinâmico:

```js
// src/ui/controller/handlers/reportExportHandlers.js:163
const { PDFGenerator } = await import('../../../domain/pdf.js');
```

`domain/pdf.js` importa `jspdf` staticamente, e sua cadeia de sections
puxa `jspdf-autotable` + `html2canvas`. O Rollup agrupa tudo sob o
chunk `pdf.*.js`. Só é baixado quando o usuário clica em "Exportar PDF"
no relatório.

### 2. Chart.js

```js
// src/ui/views/dashboard.js:879
_chartsModulePromise = import('../components/charts.js').then((m) => m.Charts);
```

Cacheado em memória — múltiplas chamadas concorrentes reusam a mesma
promise. `charts.js` importa `chart.js/auto` staticamente, o Rollup
move pra um chunk dedicado (`charts.*.js`).

### 3. Sentry (`@sentry/browser`)

```js
// src/core/observability.js:~112
const mod = await import(/* @vite-ignore */ moduleName);
```

Optional dependency. Só é carregado se `VITE_SENTRY_DSN` estiver
setado no build. Em dev (sem DSN), o chunk nem existe.

## Guardrails pra não regredir

- `vite.config.js` não usa `manualChunks` customizado — confiamos no
  code-splitting automático do Rollup a partir dos `import()` dinâmicos.
- Se alguém adicionar um `import 'jspdf'` ou `import 'chart.js'`
  estático em qualquer arquivo que faz parte do boot inicial, esse
  pacote volta pro bundle principal. ESLint não pega isso — usar
  `ANALYZE=true npm run build` + abrir o treemap pra verificar quando
  suspeitar.
- Se o `index.*.js` passar de 800 KB, rodar o analyzer e ver se algum
  view grande (dashboard, relatorio) deveria ser lazy-loaded também.

## Histórico

- 2026-04-20 — Audit inicial. jspdf + chart.js já estavam lazy; nada
  a mudar. Observability Sentry também lazy, gated por DSN.
