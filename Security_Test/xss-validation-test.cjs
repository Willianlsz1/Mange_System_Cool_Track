/**
 * CoolTrack Pro - XSS Validation Test v1.0
 * Verifica se escapeHtml() protege contra ataques XSS reais
 */

const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🔒 COOLTRACK PRO - XSS VALIDATION TEST                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const uiPath = path.join(__dirname, 'src', 'ui.js');

if (!fs.existsSync(uiPath)) {
  console.log('❌ ERRO: ui.js não encontrado!');
  process.exit(1);
}

const content = fs.readFileSync(uiPath, 'utf8');
const lines = content.split('\n');

let results = {
  totalInnerHtml: 0,
  protectedByEscapeHtml: 0,
  unprotected: 0,
  suspiciousPatterns: [],
  safePatterns: []
};

console.log('🔍 Analisando uso de innerHTML em ui.js...\n');

lines.forEach((line, index) => {
  // Procura .innerHTML =
  if (/\.innerHTML\s*=/.test(line)) {
    results.totalInnerHtml++;
    const lineNum = index + 1;
    
    // Verifica se na mesma linha ou próximas tem escapeHtml
    const hasEscapeHtml = /escapeHtml/.test(line);
    const hasVariableInterpolation = /\$\{|\.value|params|input|data/.test(line);
    
    // Verifica se é template literal com variáveis
    const isTemplateLiteral = line.includes('`') && (line.includes('${') || line.includes('+'));
    
    if (hasEscapeHtml) {
      results.protectedByEscapeHtml++;
      results.safePatterns.push({
        line: lineNum,
        code: line.trim().substring(0, 100),
        reason: 'Usa escapeHtml() ✓'
      });
      console.log(`   ✅ Linha ${lineNum}: PROTEGIDO por escapeHtml()`);
    } else if (isTemplateLiteral && hasVariableInterpolation) {
      results.unprotected++;
      results.suspiciousPatterns.push({
        line: lineNum,
        code: line.trim().substring(0, 120),
        risk: 'ALTO - Template literal com variáveis sem escapeHtml'
      });
      console.log(`   ⚠️  Linha ${lineNum}: POSSÍVEL RISCO - Template literal com variáveis`);
      console.log(`      Código: ${line.trim().substring(0, 100)}...`);
    } else if (!line.includes('// XSS safe') && !line.includes('// safe')) {
      // Verifica se é HTML estático (sem variáveis)
      const isStaticHtml = !hasVariableInterpolation && !isTemplateLiteral;
      
      if (isStaticHtml) {
        results.safePatterns.push({
          line: lineNum,
          code: line.trim().substring(0, 80),
          reason: 'HTML estático (sem variáveis) ✓'
        });
        console.log(`   ✅ Linha ${lineNum}: HTML ESTÁTICO (seguro)`);
      } else {
        results.unprotected++;
        console.log(`   ❓ Linha ${lineNum}: Revisar manualmente`);
      }
    }
  }
});

console.log('\n════════════════════════════════════════════════════════════\n');
console.log('📊 RESULTADO:\n');
console.log(`   Total de innerHTML:     ${results.totalInnerHtml}`);
console.log(`   ✓ Protegidos:           ${results.protectedByEscapeHtml}`);
console.log(`   ⚠️  Possíveis riscos:     ${results.unprotected}`);
console.log(`   ✓ HTML estático seguro: ${results.safePatterns.filter(s => s.reason.includes('estático')).length}`);

if (results.suspiciousPatterns.length > 0) {
  console.log('\n🚨 PADRÕES SUSPEITOS ENCONTRADOS:\n');
  results.suspiciousPatterns.forEach(p => {
    console.log(`   Linha ${p.line}:`);
    console.log(`   ${p.code}`);
    console.log(`   Risco: ${p.risk}\n`);
  });
} else {
  console.log('\n✅ NENHUM padrão suspeito crítico encontrado!');
  console.log('   Seu uso de innerHTML parece estar protegido!\n');
}

// Pontuação final
let score = 100;
if (results.unprotected > 0) score -= (results.unprotected * 15);
if (results.totalInnerHtml === 0) score = 100; // Não usa innerHTML = seguro

score = Math.max(0, Math.min(100, score));

console.log('╔════════════════════════════════════════════════════════════╗');
console.log(`║  PONTUAÇÃO DE PROTEÇÃO XSS: ${String(score).padStart(3)}/100              ║`);
console.log('╚════════════════════════════════════════════════════════════╝\n');

if (score >= 80) {
  console.log('✅ STATUS: BOM NÍVEL DE PROTEÇÃO CONTRA XSS');
  console.log('   Continue usando escapeHtml() em todos os inputs de usuário!\n');
} else if (score >= 50) {
  console.log('⚠️  STATUS: NÍVEL MODERADO - REVISA OS PADRÕES ACIMA');
  console.log('   Adicione escapeHtml() nas linhas marcadas como suspeitas.\n');
} else {
  console.log('🚨 STATUS: CRÍTICO - AÇÃO IMEDIATA NECESSÁRIA');
  console.log('   Implemente escapeHtml() em TODAS as entradas de usuário.\n');
}