/**
 * CoolTrack Pro - PDF Generator v5.2 (SaaS)
 * 
 * MELHORIAS v5.2:
 * ✅ Corrigido STATUS quebrado (OP/ER/AN/DO → OPERANDO)
 * ✅ Otimizado larguras das colunas
 * ✅ Aumentado legibilidade (fontes, padding, lineHeight)
 * ✅ Adicionado minCellHeight para evitar sobreposição
 * ✅ Layout mais profissional e balanceado
 */

import { jsPDF }     from 'jspdf';
import autoTable     from 'jspdf-autotable';
import { getState }  from './state.js';
import { Utils }     from './utils.js';
import { Profile }   from './onboarding.js';
import { getSignatureForRecord } from './signature.js';

// ==========================================
// PALETA DE CORES - TEMA DARK PROFISSIONAL
// ==========================================
const C = {
  navy:   [11,  17,  32],   // #0B1120
  navy2:  [15,  23,  42],
  navy3:  [23,  34,  53],
  cyan:   [0,   212, 255],
  amber:  [232, 160, 32],
  red:    [224, 48,  64],
  green:  [0,   200, 112],
  text:   [232, 242, 250],
  text2:  [138, 170, 200],
  text3:  [106, 139, 168],
  white:  [255, 255, 255],
  border: [23,  45,  69],
};

const STATUS_PDF = {
  ok:     { label: 'OPERANDO', color: C.green },
  warn:   { label: 'ATENCAO',  color: C.amber },
  danger: { label: 'FALHA',    color: C.red   },
};

export const PDFGenerator = {

  // ==========================================
  // FUNÇÃO PRINCIPAL - GERAR RELATÓRIO
  // ==========================================
  generateMaintenanceReport(options = {}) {
    try {
      const { registros, equipamentos } = getState();
      const { filtEq = '', de = '', ate = '' } = options;
      const profile = Profile.get();

      let filtered = [...registros].sort((a, b) => b.data.localeCompare(a.data));
      if (filtEq) filtered = filtered.filter(r => r.equipId === filtEq);
      if (de)     filtered = filtered.filter(r => r.data >= de);
      if (ate)    filtered = filtered.filter(r => r.data <= `${ate}T23:59`);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW  = doc.internal.pageSize.getWidth();
      const PH  = doc.internal.pageSize.getHeight();
      const M   = 14;

      // Desenhar header principal
      this._drawHeader(doc, PW, M, profile, filtEq, de, ate, filtered, equipamentos);
      
      let yPos = 56;  // Espaçamento generoso após header
      
      // Desenhar resumo executivo (com de e ate como parâmetros)
      yPos = this._drawSummary(doc, PW, M, yPos, filtered, de, ate);

      if (filtered.length > 0) {
        // Desenhar tabela otimizada
        this._drawTable(doc, PW, PH, M, yPos, filtered, equipamentos);
        
        // Páginas de assinatura (se existirem)
        this._drawSignaturePages(doc, PW, PH, M, filtered, equipamentos);
      } else {
        doc.setFontSize(13);
        doc.setTextColor(...C.text3);
        doc.text('Nenhum registro encontrado.', PW / 2, yPos + 20, { align: 'center' });
        this._drawFooter(doc, PW, PH, profile, 1, 1);
      }

      // Salvar PDF
      const fileName = `CoolTrack_${(profile?.empresa || 'Relatorio').replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      return fileName;
      
    } catch (err) {
      console.error('[PDFGenerator]', err);
      return null;
    }
  },

  // ==========================================
  // HEADER PRINCIPAL - Design Dark Profissional
  // ==========================================
  _drawHeader(doc, PW, M, profile, filtEq, de, ate, filtered, equipamentos) {
    
    // Fundo escuro principal (#0B1120)
    doc.setFillColor(...C.navy);
    doc.rect(0, 0, PW, 52, 'F');
    
    // Linha decorativa cyan no topo (3mm de espessura)
    doc.setFillColor(...C.cyan);
    doc.rect(0, 0, PW, 3, 'F');
    
    // TÍTULO PRINCIPAL - 22px Bold Cyan
    doc.setTextColor(...C.cyan);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('COOLTRACK PRO', M, 17);

    // SUBTÍTULO - 14px Cinza Claro
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text2);
    doc.text('Sistema de Gestao de Climatizacao e Refrigeracao', M, 26);

    // Perfil do técnico (se disponível)
    if (profile?.nome) {
      doc.setTextColor(...C.text);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(profile.nome + (profile.empresa ? ` — ${profile.empresa}` : ''), M, 35);
      
      if (profile.telefone) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...C.text3);
        doc.text(profile.telefone, M, 42);
      }
    }

    // Linha separadora cyan (mais forte)
    doc.setDrawColor(...C.cyan);
    doc.setLineWidth(0.6);
    doc.line(M, 47, PW - M, 47);

    // Informações de geração (data, equipamento, período, contagem)
    const hoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    doc.setFontSize(9);
    doc.setTextColor(...C.text3);
    doc.text(`Gerado: ${hoje}`, M, 50);

    const eqLabel = filtEq ? (equipamentos.find(e => e.id === filtEq)?.nome || '—') : 'Todos';
    doc.text(`Equipamento: ${eqLabel}`, M + 85, 50);
    doc.text(`Periodo: ${de || 'inicio'} ate ${ate || 'atual'}`, M + 190, 50);
    
    // Contagem de registros em destaque cyan
    doc.setTextColor(...C.cyan);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${filtered.length} registro(s)`, PW - M, 50, { align: 'right' });
  },

  // ==========================================
  // RESUMO EXECUTIVO - Com Bordas Decorativas
  // ==========================================
  _drawSummary(doc, PW, M, yPos, filtered, de, ate) {
    
    // Calcular estatísticas
    const counts = { ok: 0, warn: 0, danger: 0 };
    let totalCusto = 0;

    filtered.forEach(r => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      totalCusto += (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));
    });

    const resumoY = yPos;

    // Borda lateral esquerda cyan (decorativa)
    doc.setFillColor(...C.cyan);
    doc.rect(M, resumoY, 3, 26, 'F');

    // Fundo dark do resumo
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(M + 5, resumoY, PW - (M * 2) - 5, 26, 4, 4, 'F');

    // Título "RESUMO EXECUTIVO" - 13px Bold Cyan
    doc.setTextColor(...C.cyan);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO EXECUTIVO', M + 16, resumoY + 10);

    // Dados do resumo - 10px
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text2);

    // Texto com estatísticas completas
    const numEquipamentos = filtered.length > 0 ? new Set(filtered.map(r => r.equipId)).size : 0;
    const summaryText = `Registros: ${filtered.length}  |  Equipamentos: ${numEquipamentos}  |  Periodo: ${de || 'Inicio'} ate ${ate || 'Atual'}  |  Custo Total: R$${totalCusto.toFixed(2).replace('.', ',')}`.trim().replace(/\s+/g, ' ');
    
    doc.text(summaryText, M + 16, resumoY + 19);

    // Retornar posição Y atualizada (com margem extra)
    return resumoY + 32;  // 26 (altura) + 6 (margem)
  },

  // ==========================================
  // TABELA DE REGISTROS - OTIMIZADA v5.2 ⭐
  // ==========================================
  _drawTable(doc, PW, PH, M, yPos, filtered, equipamentos) {
    
    // Preparar dados das linhas
    const rows = filtered.map(r => {
      const eq = equipamentos.find(e => e.id === r.equipId);
      const stData = STATUS_PDF[r.status] || STATUS_PDF.ok;
      const custoTotal = (parseFloat(r.custoPecas || 0) + parseFloat(r.custoMaoObra || 0));

      return [
        Utils.formatDatetime(r.data),                    // DATA/HORA
        eq?.nome?.substring(0, 22) || '—',              // EQUIPAMENTO
        eq?.tag || '—',                                  // TAG
        eq?.fluido || '—',                              // FLUIDO
        r.tipo?.substring(0, 25) || '—',             // TIPO DE SERVICO
        r.tecnico?.substring(0, 16) || '—',           // TECNICO
        stData.label,                                     // STATUS
        custoTotal > 0 ? `R$${custoTotal.toFixed(2).replace('.', ',')}` : '—',  // CUSTO
        r.obs?.substring(0, 80) || '—'               // DESCRICAO
      ];
    });

    // ✅✅✅ CONFIGURAÇÃO OTIMIZADA DA TABELA v5.2 ✅✅✅
    autoTable(doc, {
      startY: yPos,
      
      // Cabeçalhos das colunas
      head: [[
        'DATA / HORA',
        'EQUIPAMENTO',
        'TAG',
        'FLUIDO',
        'TIPO DE SERVICO',
        'TECNICO',
        'STATUS',
        'CUSTO',
        'DESCRICAO'
      ]],
      
      body: rows,
      theme: 'plain',

      // =========================================
      // ESTILOS GLOBAIS DA TABELA
      // =========================================
      styles: {
        fontSize: 9,           // ← AUMENTADO: era 7px
        cellPadding: {       // ← AUMENTADO: era {3,4,3,4}
          top: 7,
          right: 8,
          bottom: 7,
          left: 8
        },
        textColor: C.text2,
        font: 'helvetica',
        overflow: 'linebreak',
        lineColor: C.border,
        lineWidth: 0.3,
        lineHeight: 1.5,      // ← NOVO: melhora legibilidade
        minCellHeight: 14     // ← NOVO: evita sobreposição ⭐
      },

      // =========================================
      // ESTILOS DO CABEÇALHO
      // =========================================
      headStyles: {
        fillColor: C.navy2,
        textColor: C.text3,
        fontStyle: 'bold',
        fontSize: 9,         // ← AUMENTADO: era 6.5px
        halign: 'left',
        lineColor: C.cyan,
        lineWidth: { bottom: 0.8 },  // ← AUMENTADO: era 0.4
        cellPadding: {
          top: 8,
          right: 8,
          bottom: 8,
          left: 8
        },
        fontStyle: 'bold'
      },

      // =========================================
      // ESTILOS DO CORPO DA TABELA
      // =========================================
      bodyStyles: {
        fillColor: C.navy2,
        fontSize: 9
      },

      // Linhas alternadas (zebradas)
      alternateRowStyles: {
        fillColor: C.navy
      },

      // =========================================
      // LARGURAS DAS COLUNAS - OTIMIZADAS v5.2 ⭐
      // =========================================
      columnStyles: {
        0: {  // DATA / HORA
          cellWidth: 32,        // ← AUMENTADO: era 28
          halign: 'center',
          fontSize: 9,
          textColor: C.text3
        },
        
        1: {  // EQUIPAMENTO
          cellWidth: 38,        // ← AUMENTADO: era 34
          fontSize: 10,        // ← AUMENTADO: era 9
          fontWeight: '600'
        },
        
        2: {  // TAG
          cellWidth: 22,        // ← AUMENTADO: era 18
          halign: 'center',
          fontStyle: 'bold',
          textColor: C.cyan,
          fontSize: 9
        },
        
        3: {  // FLUIDO
          cellWidth: 18,
          halign: 'center',
          fontSize: 9
        },
        
        4: {  // TIPO DE SERVICO
          cellWidth: 36,        // ← AUMENTADO: era 34
          fontSize: 9
        },
        
        5: {  // TECNICO
          cellWidth: 26,        // ← AUMENTADO: era 22
          halign: 'center',
          fontSize: 9
        },
        
        6: {  // STATUS ⭐⭐⭐ CORREÇÃO PRINCIPAL
          cellWidth: 24,        // ← AUMENTADO: era 18 (EVITA QUEBRA!)
          halign: 'center',
          fontStyle: 'bold',
          fontSize: 9         // ← AUMENTADO: era 6.5
        },
        
        7: {  // CUSTO
          cellWidth: 24,        // ← AUMENTADO: era 20
          halign: 'right',
          fontSize: 9,
          textColor: C.cyan,
          fontWeight: '600'
        },
        
        8: {  // DESCRICAO
          cellWidth: 'auto',    // Preenche o restante
          fontSize: 9
        }
      },

      // =========================================
      // PROCESSAMENTO DE CÉLULAS (CORES DINÂMICAS)
      // =========================================
      didParseCell: (data) => {
        // Aplicar apenas ao corpo da tabela
        if (data.section !== 'body') return;

        // Coluna STATUS (índice 6) - cores por status
        if (data.column.index === 6) {
          const v = data.cell.raw;
          
          switch (v) {
            case 'FALHA':
              data.cell.styles.textColor = C.red;
              break;
            case 'ATENCAO':
              data.cell.styles.textColor = C.amber;
              break;
            default:  // OPERANDO
              data.cell.styles.textColor = C.green;
              break;
          }
          
          // Garantir negrito
          data.cell.styles.fontStyle = 'bold';
        }

        // Coluna TAG (índice 2) - sempre cyan
        if (data.column.index === 2) {
          data.cell.styles.textColor = C.cyan;
          data.cell.styles.fontStyle = 'bold';
        }

        // Coluna CUSTO (índice 7) - sempre cyan
        if (data.column.index === 7) {
          data.cell.styles.textColor = C.cyan;
        }
      },

      // Callback após desenhar página (para footer)
      didDrawPage: (data) => {
        this._drawFooter(
          doc,
          PW,
          PH,
          Profile.get(),
          data.pageNumber,
          doc.getNumberOfPages()
        );
      },

      // Margens da tabela
      margin: {
        top: 14,      // ← AUMENTADO: era 12
        right: M,
        bottom: 22,   // ← AUMENTADO: era 20
        left: M
      },

      // Largura automática baseada na página
      tableWidth: 'auto'
    });
  },

  // ==========================================
  // PÁGINAS DE ASSINATURA DIGITAL
  // ==========================================
  _drawSignaturePages(doc, PW, PH, M, filtered, equipamentos) {
    
    // Filtrar registros que possuem assinatura
    const withSig = filtered.filter(r => r.assinatura);
    if (!withSig.length) return;

    // Gerar página individual para cada assinatura
    withSig.forEach(r => {
      const sigData = getSignatureForRecord(r.id);
      if (!sigData) return;

      // Nova página para este comprovante
      doc.addPage();
      
      const eq = equipamentos.find(e => e.id === r.equipId);

      // Header do comprovante
      doc.setFillColor(...C.navy);
      doc.rect(0, 0, PW, 34, 'F');
      
      doc.setFillColor(...C.cyan);
      doc.rect(0, 0, PW, 3, 'F');
      
      doc.setTextColor(...C.cyan);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text('COOLTRACK PRO — COMPROVANTE DE SERVIÇO', M, 16);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.text2);
      doc.text(`${eq?.nome || '—'} · ${Utils.formatDatetime(r.data)}`, M, 26);

      // Dados do serviço
      let y = 44;
      doc.setFontSize(10);
      doc.setTextColor(...C.text3);

      const lines = [
        ['Equipamento:', eq?.nome || '—'],
        ['TAG:', eq?.tag || '—'],
        ['Local:', eq?.local || '—'],
        ['Tipo de Serviço:', r.tipo],
        ['Técnico:', r.tecnico || '—'],
        ['Data/Hora:', Utils.formatDatetime(r.data)],
        [
          'Status pós-serviço:',
          r.status === 'ok' ? 'Operando Normal' :
          r.status === 'warn' ? 'Requer Atenção' :
          'Fora de Operação'
        ]
      ];

      lines.forEach(([label, val]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.text2);
        doc.text(label, M, y);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.text);
        doc.text(val, M + 58, y);
        
        y += 9;  // Espaçamento entre linhas
      });

      // Descrição do serviço
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.text2);
      doc.text('Descrição do Serviço:', M, y);
      
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.text);
      
      const obsLines = doc.splitTextToSize(r.obs, PW - M * 2);
      doc.text(obsLines, M, y);
      
      y += obsLines.length * 6 + 14;

      // Área da assinatura
      doc.setFillColor(...C.navy2);
      doc.roundedRect(M, y, PW / 2.2, 54, 2, 2, 'F');

      // Imagem da assinatura (se existir)
      try {
        doc.addImage(sigData, 'PNG', M + 5, y + 5, (PW / 2.2) - 10, 44);
      } catch (_) {
        // Se falhar, continua sem imagem
      }

      // Linha abaixo da assinatura
      doc.setDrawColor(...C.cyan);
      doc.setLineWidth(0.5);
      doc.line(M + 5, y + 52, M + (PW / 2.2) - 10, y + 52);

      // Textos abaixo da assinatura
      doc.setFontSize(9);
      doc.setTextColor(...C.text3);
      doc.text('Assinatura do Cliente', M + 5, y + 58);
      
      doc.setTextColor(...C.green);
      doc.setFontSize(8);
      doc.text(
        `Assinado digitalmente em ${Utils.formatDatetime(new Date().toISOString())}`,
        M + 5,
        y + 64
      );

      // Footer desta página
      this._drawFooter(
        doc,
        PW,
        PH,
        Profile.get(),
        doc.getCurrentPageInfo().pageNumber,
        doc.getNumberOfPages()
      );
    });
  },

  // ==========================================
  // FOOTER (RODAPÉ) DE TODAS AS PÁGINAS
  // ==========================================
  _drawFooter(doc, PW, PH, profile, pageNum, totalPages) {
    
    const footY = PH - 13;

    // Fundo do footer
    doc.setFillColor(...C.navy);
    doc.rect(0, footY - 2, PW, 15, 'F');

    // Linha cyan superior do footer
    doc.setFillColor(...C.cyan);
    doc.rect(0, footY - 2, PW, 0.7, 'F');

    // Texto à esquerda (versão + perfil)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text3);

    const leftText = profile?.nome
      ? `CoolTrack Pro v5.2 — ${profile.nome}${profile.empresa ? ` / ${profile.empresa}` : ''}`
      : 'CoolTrack Pro v5.2 — Sistema de Gestao de Climatizacao e Refrigeracao';

    doc.text(leftText, 14, footY + 5);

    // Texto à direita (paginação)
    doc.text(
      `Página ${pageNum} de ${totalPages}`,
      PW - 14,
      footY + 5,
      { align: 'right' }
    );
  }
};

export default PDFGenerator;