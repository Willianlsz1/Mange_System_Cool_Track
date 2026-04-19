#!/usr/bin/env bash
# ============================================================
# validate-prerelease.sh
# ============================================================
# Roda a bateria completa de validação local antes de deploy.
#
# Uso (Git Bash no Windows, ou qualquer bash):
#   bash scripts/validate-prerelease.sh
#
# O que faz automaticamente:
#   1. Verifica node_modules, instala se faltar
#   2. Roda npm run check (lint + format + tests + build)
#   3. Verifica o bundle de prod contra vetores de segurança
#   4. Imprime checklist do que ainda precisa ser feito manualmente
#
# O que NÃO faz (porque precisa humano):
#   - Smoke test em browser
#   - Deploy das SQL migrations no Supabase
#   - Git push / abertura de PR
# ============================================================

set -euo pipefail

# Cores pra saída — fallback pra vazio se terminal não suportar
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  RED=$(tput setaf 1 || true)
  GREEN=$(tput setaf 2 || true)
  YELLOW=$(tput setaf 3 || true)
  BLUE=$(tput setaf 4 || true)
  BOLD=$(tput bold || true)
  RESET=$(tput sgr0 || true)
else
  RED="" GREEN="" YELLOW="" BLUE="" BOLD="" RESET=""
fi

ok()    { echo "${GREEN}✓${RESET} $*"; }
fail()  { echo "${RED}✗${RESET} $*"; exit 1; }
info()  { echo "${BLUE}→${RESET} $*"; }
warn()  { echo "${YELLOW}!${RESET} $*"; }
title() { echo ""; echo "${BOLD}${BLUE}==>${RESET} ${BOLD}$*${RESET}"; }

# Navega pra raiz do projeto (o script vive em scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

title "CoolTrack — validação pré-release"
echo "Projeto: $ROOT_DIR"
echo "Node:    $(node --version)"
echo "NPM:     $(npm --version)"

# ── 1. Dependências ─────────────────────────────────────────
title "1/4 · Dependências"
if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
  warn "node_modules ausente ou incompleto — rodando npm install..."
  npm install
else
  ok "node_modules OK"
fi

# ── 2. Gates de código ──────────────────────────────────────
title "2/4 · Gates de código (lint + format + tests + build)"
if npm run check; then
  ok "npm run check passou"
else
  fail "npm run check falhou — corrige antes de prosseguir"
fi

# ── 3. Pentest estático do bundle ──────────────────────────
title "3/4 · Pentest estático do bundle de prod"

if [ ! -d dist/assets ]; then
  fail "dist/assets não existe — build não rodou"
fi

# Desliga set -e no bloco de pentest porque grep sem match retorna 1 e isso
# não é erro — são as contagens que importam.
set +e

# V1: vazamento do flag cooltrack-dev-mode — busca LEITURAS (getItem), não
# limpezas (removeItem/setItem). O removeItem no signOut() É esperado.
DEV_FLAG_READS=$(grep -o 'getItem([^)]*cooltrack-dev-mode[^)]*)' dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ')
DEV_FLAG_READS=${DEV_FLAG_READS:-0}
if [ "$DEV_FLAG_READS" -eq 0 ]; then
  ok "V1 · Nenhuma LEITURA de 'cooltrack-dev-mode' no bundle (tree-shake OK)"
  DEV_FLAG_CLEANUPS=$(grep -o 'removeItem([^)]*cooltrack-dev-mode[^)]*)' dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ')
  DEV_FLAG_CLEANUPS=${DEV_FLAG_CLEANUPS:-0}
  if [ "$DEV_FLAG_CLEANUPS" -gt 0 ]; then
    ok "V1 · Cleanup do signOut() presente no bundle ($DEV_FLAG_CLEANUPS ocorrência(s))"
  fi
else
  set -e
  fail "V1 · $DEV_FLAG_READS LEITURA(s) de 'cooltrack-dev-mode' no bundle — tree-shake falhou"
fi

# V4: chunk do devPlanToggle não deve estar no bundle
DEV_TOGGLE_CHUNKS=$(ls dist/assets/ 2>/dev/null | grep -ci devPlan)
DEV_TOGGLE_CHUNKS=${DEV_TOGGLE_CHUNKS:-0}
if [ "$DEV_TOGGLE_CHUNKS" -eq 0 ]; then
  ok "V4 · Chunk devPlanToggle NÃO emitido em prod (code split OK)"
else
  set -e
  fail "V4 · $DEV_TOGGLE_CHUNKS chunk(s) devPlanToggle encontrado(s) em dist/"
fi

# CSP: verifica que _headers tem a policy sem unsafe-inline no script-src
if [ -f public/_headers ]; then
  if grep -E "script-src [^;]*'unsafe-inline'" public/_headers >/dev/null 2>&1; then
    set -e
    fail "CSP · script-src ainda contém 'unsafe-inline' em public/_headers"
  else
    ok "CSP · script-src sem 'unsafe-inline' em public/_headers"
  fi
else
  warn "public/_headers não encontrado — CSP não validado"
fi

# Inline scripts em index.html: qualquer <script> sem src= e não JSON-LD.
# total = todos os <script abertos ; external = com src= ; jsonld = data blobs
TOTAL_SCRIPTS=$(grep -c '<script' index.html 2>/dev/null)
TOTAL_SCRIPTS=${TOTAL_SCRIPTS:-0}
EXTERNAL_SCRIPTS=$(grep -cE '<script[^>]*\bsrc=' index.html 2>/dev/null)
EXTERNAL_SCRIPTS=${EXTERNAL_SCRIPTS:-0}
JSONLD_SCRIPTS=$(grep -c 'application/ld+json' index.html 2>/dev/null)
JSONLD_SCRIPTS=${JSONLD_SCRIPTS:-0}
EXECUTABLE_INLINE=$((TOTAL_SCRIPTS - EXTERNAL_SCRIPTS - JSONLD_SCRIPTS))
if [ "$EXECUTABLE_INLINE" -le 0 ]; then
  ok "HTML · Nenhum <script> inline executável em index.html"
else
  warn "HTML · $EXECUTABLE_INLINE <script> inline(s) em index.html — verifica se são necessários"
fi

# Reativa fail-fast pro resto do script
set -e

# ── 4. Status do git (contexto) ────────────────────────────
title "4/4 · Status do git"
set +e
if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  BRANCH=${BRANCH:-?}
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  DIRTY=${DIRTY:-0}
  echo "Branch atual: $BRANCH"
  if [ "$DIRTY" -eq 0 ]; then
    ok "Working tree limpo"
  else
    warn "$DIRTY arquivo(s) com alteração não commitada:"
    git status --short | head -20
  fi
else
  warn "git não disponível ou .git ausente — pulando checagem"
fi
set -e

# ── Checklist manual ───────────────────────────────────────
title "Checklist do que falta (manual)"
cat <<EOF

${BOLD}[ ] 1. Smoke test local no browser${RESET}
    npm run dev  →  abre localhost:5173
    Testa: login, signup, dashboard, logout.

${BOLD}[ ] 2. Deploy das SQL migrations no Supabase${RESET}
    Cola no SQL Editor, em ordem:
      - supabase/migrations/20260419130000_protect_profile_fields.sql
      - supabase/migrations/20260419140000_harden_feedback_analytics.sql
    (Ou: npx supabase db push)

${BOLD}[ ] 3. Smoke dinâmico dos triggers (F12 no app logado)${RESET}
    No console do browser:
      const { data: u } = await supabase.auth.getUser();
      await supabase.from('profiles')
        .update({ plan_code: 'pro' })
        .eq('id', u.user.id);
    ${YELLOW}Esperado: error 42501 (permission denied)${RESET}

${BOLD}[ ] 4. Deploy pro staging${RESET}
    git add -A && git commit -m "security: hardening pre-demo"
    git push origin staging
    Aguarda Cloudflare Pages buildar o preview, testa na URL.

${BOLD}[ ] 5. Merge staging → main${RESET}
    Só depois que 1-4 passarem.
    gh pr create --base main --head staging --title "..."

EOF

title "${GREEN}Validação local concluída ✓${RESET}"
echo "Se todos os checks acima ficaram verdes, você pode prosseguir com o checklist manual."
