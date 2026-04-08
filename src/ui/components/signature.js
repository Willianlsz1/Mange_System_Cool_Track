/**
 * CoolTrack Pro - Signature Module
 * Barrel para manter a API pública compatível.
 */

export { SignatureModal } from './signature/signature-modal.js';
export {
  cleanupOrphanSignatures,
  getSignatureForRecord,
  saveSignatureForRecord,
} from './signature/signature-storage.js';
