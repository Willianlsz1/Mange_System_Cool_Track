/**
 * CoolTrack Pro - Signature Module
 * Barrel para manter a API pública compatível.
 */

export { SignatureModal } from './signature/signature-modal.js';
export { SignatureViewerModal } from './signature/signature-viewer-modal.js';
export {
  cleanupOrphanSignatures,
  getSignatureForRecord,
  resolveSignatureForRecord,
  saveSignatureForRecord,
} from './signature/signature-storage.js';
