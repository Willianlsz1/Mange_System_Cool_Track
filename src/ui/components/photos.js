/**
 * CoolTrack Pro - Photos Module v3.4
 * Extraído de ui.js. Limite de 5 fotos por registro + aviso de storage.
 */

import { Utils, MAX_PHOTOS_PER_RECORD, MAX_PHOTO_WIDTH, PHOTO_QUALITY } from '../../core/utils.js';
import { Toast } from '../../core/toast.js';
import { Storage } from '../../core/storage.js';

function compressImage(file) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn(payload);
    };
    const timeoutId = setTimeout(() => {
      Toast.error('Tempo esgotado ao processar foto. Tente novamente.');
      finish(reject, new Error('Tempo esgotado ao processar foto.'));
    }, 15000);

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > MAX_PHOTO_WIDTH) { h = Math.round((h * MAX_PHOTO_WIDTH) / w); w = MAX_PHOTO_WIDTH; }
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

export const Photos = {
  pending: [],

  async add(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const available = MAX_PHOTOS_PER_RECORD - this.pending.length;
    if (available <= 0) {
      Toast.warning(`Limite de ${MAX_PHOTOS_PER_RECORD} fotos por registro atingido.`);
      input.value = '';
      return;
    }

    const toProcess = files.slice(0, available);
    if (files.length > available) {
      Toast.warning(`Apenas ${available} foto(s) adicionada(s). Limite é ${MAX_PHOTOS_PER_RECORD} por registro.`);
    }

    const dropText = Utils.getEl('photo-drop-text');
    const dropZone = Utils.getEl('photo-drop-zone');
    if (dropZone) dropZone.style.pointerEvents = 'none';
    if (dropText) dropText.textContent = `Processando ${toProcess.length} foto(s)...`;

    try {
      for (const file of toProcess) {
        try {
          this.pending.push(await compressImage(file));
          this.render();
        } catch (err) {
          console.error('[Photos] Erro ao processar foto', err);
        }
      }
    } finally {
      if (dropText) dropText.textContent = 'Toque para adicionar fotos';
      if (dropZone) dropZone.style.pointerEvents = 'auto';
      input.value = '';
    }

    // Aviso de storage após adicionar fotos
    const { percent } = Storage.usage();
    if (percent >= 70) {
      Toast.warning(`Armazenamento em ${percent}% do limite. Considere remover registros antigos com fotos.`);
    }
  },

  remove(i) {
    this.pending.splice(i, 1);
    this.render();
  },

  clear() {
    this.pending = [];
    this.render();
  },

  openLightbox(src) {
    Utils.getEl('lightbox-img').src = src;
    Utils.getEl('lightbox').classList.add('is-open');
  },

  closeLightbox() {
    Utils.getEl('lightbox').classList.remove('is-open');
  },

  render() {
    const c = Utils.getEl('photo-preview');
    if (!c) return;
    c.innerHTML = '';

    const f = document.createDocumentFragment();
    this.pending.forEach((src, i) => {
      const card = document.createElement('div');
      card.className = 'photo-thumb';
      card.setAttribute('role', 'listitem');

      const img = document.createElement('img');
      img.src = src;
      img.alt = `Foto ${i + 1}`;
      img.addEventListener('click', () => this.openLightbox(src));

      const btn = document.createElement('button');
      btn.className = 'photo-thumb__remove';
      btn.textContent = '✕';
      btn.setAttribute('aria-label', `Remover foto ${i + 1}`);
      btn.addEventListener('click', () => this.remove(i));

      card.append(img, btn);
      f.appendChild(card);
    });
    c.appendChild(f);

    // Contador de fotos
    const counter = c.parentElement?.querySelector('.photo-counter');
    if (counter) {
      counter.textContent = `${this.pending.length}/${MAX_PHOTOS_PER_RECORD} fotos`;
    }
  }
};
