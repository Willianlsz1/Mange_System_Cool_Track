import { TIPO_ICON } from '../../core/utils.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRenderablePhotoUrl(value) {
  const url = normalizeString(value);
  if (!url) return false;
  if (url === 'null' || url === 'undefined') return false;
  return /^(https?:\/\/|data:image\/|blob:|\/)/i.test(url);
}

export function getEquipmentPhotoUrl(eq) {
  if (!eq) return null;
  const fotos = Array.isArray(eq.fotos) ? eq.fotos : [];
  const firstPhoto = fotos.find((photo) => {
    if (!photo) return false;
    if (typeof photo === 'string') return isRenderablePhotoUrl(photo);
    return isRenderablePhotoUrl(photo.url);
  });
  if (!firstPhoto) return null;
  return typeof firstPhoto === 'string' ? firstPhoto.trim() : firstPhoto.url.trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return '';
}

function initialsFromName(name) {
  const clean = normalizeString(name).replace(/\s+/g, ' ');
  if (!clean) return 'EQ';
  const parts = clean.split(' ');
  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  if (initials.length >= 2) return initials.slice(0, 2);
  return clean.slice(0, 2).toUpperCase();
}

function toneIndex(seed) {
  const base = normalizeString(seed) || 'equipamento';
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) % 997;
  }
  return (Math.abs(hash) % 4) + 1;
}

export function getEquipmentVisualMeta(eq) {
  const icon = TIPO_ICON[eq?.tipo] ?? '⚙️';
  const nameSeed = firstNonEmpty(eq?.nome, eq?.tag, eq?.tipo, 'Equipamento');
  return {
    photoUrl: getEquipmentPhotoUrl(eq),
    icon,
    initials: initialsFromName(nameSeed),
    tone: toneIndex(`${eq?.tipo || ''}|${nameSeed}`),
  };
}
