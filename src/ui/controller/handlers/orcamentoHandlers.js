/**
 * CoolTrack Pro - Handlers de Orçamentos (Fase de instalação, abr/2026)
 */

import { on } from '../../../core/events.js';
import { Toast } from '../../../core/toast.js';
import { Profile } from '../../../features/profile.js';
import { findOrcamento, generateShareToken } from '../../../core/orcamentos.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import {
  setOrcStatusFilter,
  deleteOrcamentoFlow,
  markOrcamentoApproved,
  renderOrcamentos,
} from '../../views/orcamentos.js';
import { OrcamentoModal } from '../../components/orcamentoModal.js';
import { CustomConfirm } from '../../../core/modal.js';

/**
 * Fase 2 — Envia o orçamento pra assinatura digital.
 *
 * Fluxo:
 *   1. Gera (ou reusa) share_token via RPC
 *   2. Constrói link: ${origin}/?orc-sign=TOKEN
 *   3. Abre confirm bonito mostrando o link + botões: Copiar / WhatsApp
 *   4. WhatsApp: abre wa.me com mensagem pré-formatada
 *
 * Idempotente: se já tem token válido, reusa (não invalida o anterior).
 */
export async function sendOrcamentoForSignature(orcamento) {
  try {
    const { url } = await generateShareToken(orcamento);

    const phone = String(orcamento.clienteTelefone || '').replace(/\D/g, '');
    const message =
      `Olá ${orcamento.clienteNome}! 👋\n\n` +
      `Segue o orçamento *${orcamento.numero}* — ${orcamento.titulo}.\n\n` +
      `📝 Para aprovar, basta abrir o link abaixo no celular e assinar com o dedo:\n` +
      `${url}\n\n` +
      `Qualquer dúvida estou à disposição!`;

    const wa = phone
      ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    // Modal com link copiável + ação direta de WhatsApp
    // Signature: CustomConfirm.show(title, msg, options) — 3 args posicionais.
    const confirmed = await CustomConfirm.show(
      '✍️ Link de assinatura digital',
      `Pronto! O link abaixo é único pra esse orçamento e fica válido por 30 dias.\n\n` +
        `${url}\n\n` +
        `Quando o cliente assinar no celular, o orçamento vira aprovado automaticamente — você recebe um update na lista.`,
      {
        confirmLabel: '📲 Enviar pelo WhatsApp',
        cancelLabel: '📋 Copiar link',
        tone: 'primary',
        focus: 'confirm',
      },
    );

    if (confirmed) {
      window.open(wa, '_blank');
      Toast.success('WhatsApp aberto. Anexe o link e envie.');
    } else {
      // Fallback: copiar pra clipboard
      try {
        await navigator.clipboard.writeText(url);
        Toast.success('Link copiado! Cole onde quiser.');
      } catch {
        // Sem permissão de clipboard (raro) — só mostra de novo
        Toast.info('Selecione e copie o link manualmente.');
      }
    }

    // Re-renderiza a lista pra mostrar o novo status (aguardando_assinatura)
    renderOrcamentos();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível gerar o link de assinatura.',
      context: { action: 'sendOrcamentoForSignature', id: orcamento?.id },
    });
  }
}

/**
 * Baixa o PDF do orçamento (sem abrir share). Usado quando o técnico só
 * quer o arquivo localmente — pra imprimir, anexar em email, ou guardar.
 */
export async function downloadOrcamentoPdf(orcamento) {
  try {
    const { generateOrcamentoPdf } = await import('../../../domain/pdf/orcamentoPdf.js');
    const profile = Profile.get() || {};
    // asBlob:false faz doc.save() direto — browser baixa.
    const fileName = generateOrcamentoPdf({ orcamento, profile, asBlob: false });
    Toast.success(`PDF "${fileName}" baixado.`);
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível gerar o PDF.',
      context: { action: 'downloadOrcamentoPdf', id: orcamento?.id },
    });
  }
}

/**
 * Gera PDF do orçamento e abre share via Web Share API (cai pra WhatsApp
 * Web link em desktop). Pode ser chamado tanto pelo botão na lista quanto
 * pelo "Salvar e enviar" do modal.
 */
export async function shareOrcamentoWhatsApp(orcamento) {
  try {
    const { generateOrcamentoPdf } = await import('../../../domain/pdf/orcamentoPdf.js');
    const profile = Profile.get() || {};
    const { fileName, blob } = generateOrcamentoPdf({
      orcamento,
      profile,
      asBlob: true,
    });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const message =
      `Olá ${orcamento.clienteNome}! 👋\n\n` +
      `Segue o orçamento *${orcamento.numero}* para *${orcamento.titulo}*.\n` +
      `Valor total: *${Number(orcamento.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*.\n\n` +
      `Qualquer dúvida estou à disposição!`;

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Orçamento ${orcamento.numero}`,
        text: message,
      });
      Toast.success('Compartilhado!');
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const phone = String(orcamento.clienteTelefone || '').replace(/\D/g, '');
      const wa = phone
        ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(wa, '_blank');
      Toast.success('PDF baixado. Anexe no WhatsApp aberto.');
    }
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'Não foi possível compartilhar o orçamento.',
      context: { action: 'shareOrcamentoWhatsApp', id: orcamento?.id },
    });
  }
}

export function bindOrcamentoHandlers() {
  // Abrir modal — create ou edit
  on('open-orcamento-modal', (el) => {
    const mode = el.dataset.mode || 'create';
    if (mode === 'edit') {
      OrcamentoModal.openEdit(el.dataset.id);
    } else {
      OrcamentoModal.openCreate();
    }
  });

  // Filtros de status
  on('orc-set-status-filter', (el) => {
    setOrcStatusFilter(el.dataset.status || 'todos');
  });

  // Apagar (com confirm)
  on('orc-delete', (el) => {
    deleteOrcamentoFlow(el.dataset.id);
  });

  // Marcar como aprovado (manual — quando cliente respondeu OK no WhatsApp)
  on('orc-mark-approved', (el) => {
    markOrcamentoApproved(el.dataset.id);
  });

  // Compartilhar via WhatsApp (PDF + mensagem)
  on('orc-share', async (el) => {
    const orcamento = findOrcamento(el.dataset.id);
    if (!orcamento) {
      Toast.error('Orçamento não encontrado.');
      return;
    }
    await shareOrcamentoWhatsApp(orcamento);
  });

  // Baixar PDF localmente (sem share — pra imprimir/email/arquivar)
  on('orc-download', async (el) => {
    const orcamento = findOrcamento(el.dataset.id);
    if (!orcamento) {
      Toast.error('Orçamento não encontrado.');
      return;
    }
    await downloadOrcamentoPdf(orcamento);
  });

  // Fase 2: enviar para assinatura digital (gera token + share WhatsApp)
  on('orc-send-signature', async (el) => {
    const orcamento = findOrcamento(el.dataset.id);
    if (!orcamento) {
      Toast.error('Orçamento não encontrado.');
      return;
    }
    await sendOrcamentoForSignature(orcamento);
  });
}
