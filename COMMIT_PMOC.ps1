# Script PowerShell para commit do épico PMOC.
# Uso: cd no repo e rodar `.\COMMIT_PMOC.ps1`
# Ou copiar+colar os comandos abaixo um por um.

$ErrorActionPreference = "Stop"

Write-Host "[1/5] Limpando lock do git..." -ForegroundColor Cyan
if (Test-Path ".git/index.lock") {
    Remove-Item ".git/index.lock" -Force
    Write-Host "    .git/index.lock removido."
}

Write-Host "[2/5] Verificando status..." -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "[3/5] Stage de todos os arquivos do PMOC..." -ForegroundColor Cyan
# Modificados (Fases 1-6)
git add `
    src/assets/styles/components.css `
    src/core/state.js `
    src/core/storage.js `
    src/domain/pdf/sections/cover.js `
    src/ui/components/onboarding/profileModal.js `
    src/ui/controller.js `
    src/ui/controller/handlers/navigationHandlers.js `
    src/ui/controller/handlers/registroHandlers.js `
    src/ui/controller/handlers/reportExportHandlers.js `
    src/ui/controller/routes.js `
    src/ui/shell/templates/header.js `
    src/ui/shell/templates/modals.js `
    src/ui/shell/templates/views.js `
    src/ui/views/equipamentos.js `
    src/ui/views/registro.js

# Arquivos novos (Fases 1-6)
git add `
    docs/PMOC_ROADMAP.md `
    src/__tests__/checklistTemplates.test.js `
    src/__tests__/pmocReport.test.js `
    src/assets/styles/components/_checklist.css `
    src/assets/styles/components/_clientes.css `
    src/assets/styles/components/_pmoc.css `
    src/core/clientes.js `
    src/domain/pdf/pmoc/ `
    src/domain/pdf/sections/checklist.js `
    src/domain/pmoc/ `
    src/ui/components/clienteModal.js `
    src/ui/components/pmocInfoModal.js `
    src/ui/components/pmocModal.js `
    src/ui/controller/handlers/clienteHandlers.js `
    src/ui/views/clientes.js `
    supabase/migrations/20260425120000_pmoc_clientes_empresa.sql `
    supabase/migrations/20260425130000_pmoc_checklist_registros.sql

Write-Host ""
Write-Host "[4/5] Verificando arquivos staged..." -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "[5/5] Commitando com mensagem em COMMIT_PMOC.txt..." -ForegroundColor Cyan
git commit -F COMMIT_PMOC.txt

Write-Host ""
Write-Host "✓ Commit feito. Verifique:" -ForegroundColor Green
git log --oneline -3

Write-Host ""
Write-Host "Próximos passos sugeridos:" -ForegroundColor Yellow
Write-Host "  1. supabase db push                    (aplica as 2 migrations)"
Write-Host "  2. git push origin <sua-branch>        (sobe pro remote)"
Write-Host "  3. Remover COMMIT_PMOC.txt e .ps1 depois do commit (são scratch files)"
