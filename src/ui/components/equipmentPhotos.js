/**
 * CoolTrack Pro — EquipmentPhotos v1.0
 *
 * Componente de fotos para o cadastro/edição de equipamento.
 * Diferencia-se do `Photos` (usado em registros) em três pontos:
 *   1. Limite menor (3 fotos) — equipamento usa foto só pra identificação
 *      visual no card, não como evidência de manutenção.
 *   2. Estado separado: `pending` (dataURLs novas a subir) + `existing`
 *      (fotos já no Storage, já com URL assinada). No submit, só o
 *      `pending` vira upload novo; o `existing` é preservado tal como está.
 *   3. Suporta carregar foto existente no modo edit via `setExisting(list)`.
 *
 * Captura: aceita galeria (input file multiple) e câmera (capture=environment).
 * O input é o mesmo; o componente só consome `input.files`.
 */

import { Utils, MAX_PHOTO_WIDTH, PHOTO_QUALITY } from '../../core/utils.js';
import { Toast } from '../../core/toast.js';
import { Photos } from './photos.js';
import { resolvePhotoDisplayUrl } from '../../core/photoStorage.js';

export const MAX_EQUIP_PHOTOS = 3;
// Targets DOM default — legado do modal-add-eq. Podem ser sobrescritos via
// EquipmentPhotos.configure({ ... }) antes de render(), usado pelo novo
// modal-eq-photos (IDs prefixados com `eq-photos-*`).
const DEFAULT_TARGETS = {
  previewId: 'equip-photo-preview',
  counterSelector: '.equip-photo-counter',
  dropTextId: 'equip-photo-drop-text',
  dropZoneId: 'equip-photo-drop-zone',
  subId: 'equip-photo-sub',
  subTotalLabel: MAX_EQUIP_PHOTOS,
};
let _targets = { ...DEFAULT_TARGETS };

function compressImage(file) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      Toast.error('Tempo esgotado ao processar foto. Tente novamente.');
      reject(new Error('Tempo esgotado ao processar foto.'));
    }, 15000);

    const finish = (fn, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn(payload);
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > MAX_PHOTO_WIDTH) {
          h = Math.round((h * MAX_PHOTO_WIDTH) / w);
          w = MAX_PHOTO_WIDTH;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        finish(resolve, canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
      };
      img.onerror = () => {
        Toast.error('Arquivo de imagem inválido ou corrompido.');
        finish(reject, new Error('Arquivo de imagem inválido ou corrompido.'));
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      Toast.error('Não foi possível ler o arquivo. Tente outro.');
      finish(reject, new Error('Falha ao ler arquivo de imagem.'));
    };
    reader.readAsDataURL(file);
  });
}

function totalCount(state) {
  return state.existing.length + state.pending.length;
}

export const EquipmentPhotos = {
  // Fotos novas capturadas/carregadas, como dataURL — serão uploadadas no save.
  pending: [],
  // Fotos já persistidas (vindas do equipamento em edição).
  // Shape: referência de foto (objeto com path/url) conforme normalizePhotoEntry.
  existing: [],

  /**
   * Inicializa o estado do componente.
   * Em modo "novo equipamento", passa array vazio (ou nada).
   * Em modo edição, passa a lista atual de `equipamento.fotos`.
   */
  setExisting(list) {
    this.existing = Array.isArray(list) ? [...list] : [];
    this.pending = [];
    this.render();
  },

  /**
   * Retorna o payload final a persistir: concat de existing + pending.
   * O caller (saveEquip) roda uploadPendingPhotos pra converter os dataURLs
   * em referências ao Storage.
   */
  getAll() {
    return [...this.existing, ...this.pending];
  },

  clear() {
    this.pending = [];
    this.existing = [];
    this.render();
  },

  async add(input) {
    const files = Array.from(input?.files || []);
    if (!files.length) return;

    const available = MAX_EQUIP_PHOTOS - totalCount(this);
    if (available <= 0) {
      Toast.warning(`Limite de ${MAX_EQUIP_PHOTOS} fotos por equipamento atingido.`);
      if (input) input.value = '';
      return;
    }

    const toProcess = files.slice(0, available);
    if (files.length > available) {
      Toast.warning(
        `Apenas ${available} foto(s) adicionada(s). Limite é ${MAX_EQUIP_PHOTOS} por equipamento.`,
      );
    }

    const dropText = document.getElementById(_targets.dropTextId);
    const dropZone = document.getElementById(_targets.dropZoneId);
    if (dropZone) dropZone.style.pointerEvents = 'none';
    const originalText = dropText?.textContent || '';
    if (dropText) dropText.textContent = `Processando ${toProcess.length} foto(s)...`;

    try {
      for (const file of toProcess) {
        try {
          const dataUrl = await compressImage(file);
          this.pending.push(dataUrl);
          this.render();
        } catch (err) {
          console.error('[EquipmentPhotos] Erro ao processar foto', err);
        }
      }
    } finally {
      if (dropText) dropText.textContent = originalText || 'Tirar foto ou escolher da galeria';
      if (dropZone) dropZone.style.pointerEvents = 'auto';
      if (input) input.value = '';
    }
  },

  removePending(i) {
    this.pending.splice(i, 1);
    this.render();
  },

  removeExisting(i) {
    this.existing.splice(i, 1);
    this.render();
  },

  /**
   * Promove uma foto existente pra posição 0 (capa). A capa real do equip é
   * `getAll()[0]` — então mover pra index 0 em `existing` (que vem antes de
   * `pending`) efetivamente a define como capa.
   *
   * No modal-add-eq novo equipamento (sem `existing`), o botão capa
   * reposiciona dentro de `pending` — o efeito é o mesmo pra a primeira foto
   * final que for salva.
   */
  setCoverExisting(i) {
    if (i <= 0 || i >= this.existing.length) return;
    const [item] = this.existing.splice(i, 1);
    this.existing.unshift(item);
    this.render();
  },

  setCoverPending(i) {
    if (i <= 0 || i >= this.pending.length) return;
    const [item] = this.pending.splice(i, 1);
    this.pending.unshift(item);
    this.render();
  },

  async openLightboxFromExisting(i) {
    const ref = this.existing[i];
    try {
      const url = await resolvePhotoDisplayUrl(ref);
      if (url) Photos.openLightbox(url);
    } catch (_err) {
      Toast.error('Não foi possível abrir a foto.');
    }
  },

  openLightboxFromPending(i) {
    const src = this.pending[i];
    if (src) Photos.openLightbox(src);
  },

  /**
   * Reconfigura os IDs de DOM que o componente consulta. Útil pra reusar em
   * múltiplos modais sem duplicar toda a lógica. Chamar com `null`/`{}` pra
   * voltar aos defaults do modal-add-eq legacy. Tolerante: chaves omitidas
   * preservam o valor atual.
   */
  configure(overrides = {}) {
    _targets = { ..._targets, ...overrides };
  },

  /** Volta os targets pro default global. Usado em teardown entre modais. */
  resetTargets() {
    _targets = { ...DEFAULT_TARGETS };
  },

  render() {
    const container = Utils.getEl(_targets.previewId);
    if (!container) return;
    container.innerHTML = '';

    const fragment = document.createDocumentFragment();

    // A capa real é a primeira do grupo que vier primeiro em getAll(). Se
    // há existing, capa = existing[0]; senão, capa = pending[0]. Passamos
    // `isCover` e `canBeCover` pra thumb só decorar / permitir reordenação
    // (os handlers de setCover fazem o swap no array).
    const hasExisting = this.existing.length > 0;

    // Existing primeiro (mantém ordem histórica)
    this.existing.forEach((ref, i) => {
      const card = this._buildThumb({
        alt: `Foto ${i + 1}`,
        onRemove: () => this.removeExisting(i),
        onOpen: () => this.openLightboxFromExisting(i),
        onSetCover: i === 0 ? null : () => this.setCoverExisting(i),
        isCover: i === 0,
        caption: typeof ref?.caption === 'string' ? ref.caption : '',
        onCaptionChange: (value) => {
          // Mantém caption no objeto existing. Persistido no save.
          if (this.existing[i] && typeof this.existing[i] === 'object') {
            this.existing[i].caption = value;
          }
        },
      });
      // Preview: usa a url cacheada se existir; senão, resolve assincronamente
      const img = card.querySelector('img');
      if (ref?.url) {
        img.src = ref.url;
      } else {
        img.src = '';
        resolvePhotoDisplayUrl(ref)
          .then((url) => {
            if (url) img.src = url;
          })
          .catch(() => {
            /* fallback silencioso — foto pode estar offline */
          });
      }
      fragment.appendChild(card);
    });

    // Pending (novas a subir)
    this.pending.forEach((src, i) => {
      const isPendingCover = !hasExisting && i === 0;
      const card = this._buildThumb({
        alt: `Foto nova ${i + 1}`,
        onRemove: () => this.removePending(i),
        onOpen: () => this.openLightboxFromPending(i),
        onSetCover: isPendingCover ? null : () => this.setCoverPending(i),
        isCover: isPendingCover,
      });
      const img = card.querySelector('img');
      img.src = src;
      // Marca visualmente como "nova" (não uploadada ainda)
      card.classList.add('photo-thumb--pending');
      fragment.appendChild(card);
    });

    container.appendChild(fragment);

    // Contador (hidden legacy element, mantido para compat)
    const counter = container.parentElement?.querySelector(_targets.counterSelector);
    if (counter) counter.textContent = `${totalCount(this)}/${MAX_EQUIP_PHOTOS} fotos`;

    const sub = _targets.subId ? document.getElementById(_targets.subId) : null;
    if (sub) {
      sub.textContent = `${totalCount(this)} de ${MAX_EQUIP_PHOTOS} · ajuda a identificar em campo`;
    }

    // Esconde drop-zone quando cheio
    const dropZone = document.getElementById(_targets.dropZoneId);
    if (dropZone) {
      dropZone.hidden = totalCount(this) >= MAX_EQUIP_PHOTOS;
    }
  },

  _buildThumb({
    alt,
    onRemove,
    onOpen,
    onSetCover,
    isCover = false,
    caption = '',
    onCaptionChange,
  }) {
    const card = document.createElement('div');
    card.className = 'photo-thumb';
    if (isCover) card.classList.add('photo-thumb--cover');
    card.setAttribute('role', 'listitem');

    const img = document.createElement('img');
    img.alt = alt;
    img.addEventListener('click', onOpen);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-thumb__remove';
    btn.textContent = '✕';
    btn.setAttribute('aria-label', `Remover ${alt.toLowerCase()}`);
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      onRemove();
    });

    card.append(img, btn);

    if (isCover) {
      const badge = document.createElement('span');
      badge.className = 'photo-thumb__cover-badge';
      badge.setAttribute('aria-label', 'Esta é a foto de capa do card');
      badge.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 21 12 16.5 5.8 21l2.4-7.1L2 9.4h7.6z"/></svg>Capa';
      card.appendChild(badge);
    } else if (typeof onSetCover === 'function') {
      const cover = document.createElement('button');
      cover.type = 'button';
      cover.className = 'photo-thumb__set-cover';
      cover.setAttribute('aria-label', `Definir ${alt.toLowerCase()} como capa`);
      cover.title = 'Definir como capa do card';
      cover.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 21 12 16.5 5.8 21l2.4-7.1L2 9.4h7.6z"/></svg>Capa';
      cover.addEventListener('click', (event) => {
        event.stopPropagation();
        onSetCover();
      });
      card.appendChild(cover);
    }

    if (typeof onCaptionChange === 'function') {
      const captionInput = document.createElement('input');
      captionInput.type = 'text';
      captionInput.className = 'photo-thumb__caption';
      captionInput.maxLength = 60;
      captionInput.value = caption;
      captionInput.placeholder = 'Legenda (opcional)';
      captionInput.setAttribute('aria-label', `Legenda da ${alt.toLowerCase()}`);
      captionInput.addEventListener('click', (event) => event.stopPropagation());
      captionInput.addEventListener('input', () => {
        onCaptionChange(captionInput.value);
      });
      card.appendChild(captionInput);
    }

    return card;
  },
};
