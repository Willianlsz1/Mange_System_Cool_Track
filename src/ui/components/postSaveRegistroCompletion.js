import { attachDialogA11y } from '../../core/modal.js';

let activeOverlay = null;
let activeCleanup = null;

function removeOverlay(overlay) {
  if (!(overlay instanceof HTMLElement)) return;
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  if (activeOverlay === overlay) activeOverlay = null;
}

function createInfoRow(label, value) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'space-between';
  row.style.gap = '12px';
  row.style.padding = '8px 0';
  row.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

  const labelEl = document.createElement('span');
  labelEl.style.color = 'var(--text-3)';
  labelEl.style.fontSize = '12px';
  labelEl.style.textTransform = 'uppercase';
  labelEl.style.letterSpacing = '.04em';
  labelEl.textContent = label;

  const valueEl = document.createElement('strong');
  valueEl.style.color = 'var(--text)';
  valueEl.style.fontSize = '13px';
  valueEl.style.fontWeight = '600';
  valueEl.style.textAlign = 'right';
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  return row;
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export const PostSaveRegistroCompletion = {
  show({
    equipName,
    statusLabel,
    nextMaintenance,
    onWhatsapp,
    onDownloadPdf,
    onViewReport,
    onClose,
  }) {
    if (activeOverlay) removeOverlay(activeOverlay);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay is-open';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'post-save-completion-title');

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '460px';
    modal.style.alignSelf = 'center';

    const title = document.createElement('h3');
    title.id = 'post-save-completion-title';
    title.textContent = 'Serviço salvo com sucesso';

    const subtitle = document.createElement('p');
    subtitle.className = 'text-muted';
    subtitle.style.marginTop = '6px';
    subtitle.style.marginBottom = '14px';
    subtitle.textContent = 'Relatório atualizado e PDF pronto para envio.';

    const summary = document.createElement('div');
    summary.style.display = 'flex';
    summary.style.flexDirection = 'column';
    summary.style.marginBottom = '14px';
    summary.append(
      createInfoRow('Equipamento', equipName || '—'),
      createInfoRow('Status', statusLabel || 'Atualizado'),
      createInfoRow('Próxima manutenção', nextMaintenance || 'Não definida'),
      createInfoRow('PDF', 'Pronto para enviar ou baixar'),
    );

    const actions = document.createElement('div');
    actions.style.display = 'grid';
    actions.style.gap = '8px';

    const closeWithAction = (cb) => {
      removeOverlay(overlay);
      cb?.();
    };

    const whatsappBtn = createButton('Enviar PDF no WhatsApp', 'btn btn--primary', () =>
      closeWithAction(onWhatsapp),
    );
    const pdfBtn = createButton('Baixar PDF', 'btn btn--outline', () =>
      closeWithAction(onDownloadPdf),
    );
    const reportBtn = createButton('Ver relatório', 'btn btn--outline', () =>
      closeWithAction(onViewReport),
    );
    const closeBtn = createButton('Fechar', 'btn btn--ghost', () => closeWithAction(onClose));

    actions.append(whatsappBtn, pdfBtn, reportBtn, closeBtn);

    modal.append(title, subtitle, summary, actions);
    overlay.appendChild(modal);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeWithAction(onClose);
    });

    document.body.appendChild(overlay);
    activeOverlay = overlay;
    activeCleanup = attachDialogA11y(overlay, {
      onDismiss: () => closeWithAction(onClose),
    });

    return overlay;
  },
};

export default PostSaveRegistroCompletion;
