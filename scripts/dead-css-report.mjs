#!/usr/bin/env node
/**
 * Dead CSS report — usa purgecss pra listar classes em `components.css`
 * que não aparecem em nenhum JS/HTML do src/, depois dupla-check com grep
 * direto pra filtrar os falsos positivos óbvios (template strings dinâmicos
 * tipo `class="btn--${variant}"` ficam invisíveis pro purgecss).
 *
 * Uso:
 *   node scripts/dead-css-report.mjs            # imprime lista
 *   node scripts/dead-css-report.mjs --full     # inclui dynamic candidates
 *
 * Fluxo recomendado antes de deletar:
 *   1. Rodar esse script.
 *   2. Pra cada bloco candidato, pesquisar o root da classe no src/ (grep -r).
 *   3. Abrir a feature no app (DEV build) em 3 estados: Free, Plus, Pro, pra
 *      validar visualmente que nada quebrou.
 *   4. Remover o bloco em PR separado com screenshot antes/depois.
 *
 * Nota: purgecss precisa ser instalado — `npm install --no-save purgecss`
 *       (já no devDependencies se você quiser permanente).
 */
import { PurgeCSS } from 'purgecss';
import { execSync } from 'node:child_process';

const CSS_FILE = 'src/assets/styles/components.css';
const FULL_MODE = process.argv.includes('--full');

const config = {
  content: ['src/**/*.js', 'src/**/*.html', 'index.html'],
  css: [CSS_FILE],
  safelist: {
    standard: [
      /^toast/,
      /^modal/,
      /^skeleton/,
      /^sr-only/,
      /^visually-hidden/,
      /^is-/,
      /^has-/,
      /^active$/,
      /^loading$/,
      /^hidden$/,
      /^open$/,
      /^closed$/,
    ],
    deep: [/^animate-/, /^fade-/, /^slide-/],
    greedy: [
      /badge/,
      /chip/,
      /setor-modal/,
      /pricing-card/,
      /registro-sig/,
      /usage-meter/,
      /photo/,
      /swatch/,
    ],
  },
  rejected: true,
};

const [result] = await new PurgeCSS().purge(config);
const rejected = (result?.rejected || []).map((c) => c.replace(/^\./, '').split(/[:>[ ]/)[0]);
const unique = [...new Set(rejected)].sort();

// Segundo passe: confirmar via grep que o "root" da classe (antes de --modifier)
// não aparece em nenhum JS/HTML. Isso pega template strings `--${variant}`.
const confirmedDead = [];
const probablyDynamic = [];
for (const cls of unique) {
  // Root = tudo antes do primeiro "--"
  const root = cls.split('--')[0];
  try {
    const cmd = `grep -rIlE '"[^"]*\\b${root}\\b' src/ --include='*.js' --include='*.html' 2>/dev/null | head -1`;
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    if (!out) {
      confirmedDead.push(cls);
    } else if (cls !== root) {
      probablyDynamic.push(cls);
    }
  } catch {
    confirmedDead.push(cls);
  }
}

console.log(`\n— Dead CSS report —`);
console.log(`File: ${CSS_FILE}`);
console.log(`Total rejected by purgecss: ${unique.length}`);
console.log(`Root classes never referenced in src/: ${confirmedDead.length}`);
console.log(`Modifier variants (likely dynamic template strings): ${probablyDynamic.length}`);
console.log(`\n--- Confirmed dead (safe to remove after visual QA) ---`);
console.log(confirmedDead.map((c) => `.${c}`).join('\n'));

if (FULL_MODE) {
  console.log(`\n--- Probable dynamic variants (review before touching) ---`);
  console.log(probablyDynamic.map((c) => `.${c}`).join('\n'));
}

console.log(`\nNext step: grep each entry in src/ to double-check, then delete the block.`);
