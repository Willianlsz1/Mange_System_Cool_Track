/**
 * CoolTrack Pro - Máscara de telefone brasileira
 *
 * Formato: (XX) XXXXX-XXXX (celular, 11 dígitos)
 *          (XX) XXXX-XXXX  (fixo, 10 dígitos)
 *
 * Aplica formatação progressivamente conforme o usuário digita —
 * limita a 11 dígitos no input (12 com o 9), e adiciona parênteses,
 * espaço e hífen automaticamente. Cola (paste) com formato sujo
 * é normalizado e remascarado.
 */

/**
 * Aplica máscara visual a partir de um valor cru. Aceita string com
 * qualquer formato — extrai só os dígitos e re-mascara.
 *
 * @param {string} raw - valor de entrada (qualquer formato)
 * @returns {string} valor formatado, ou o que for possível
 */
export function applyPhoneMask(raw) {
  const digits = String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    // Fixo formato: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // Celular formato: (XX) XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Retorna só os dígitos do telefone — útil para salvar no banco
 * normalizado ou montar links wa.me/55XXXXX.
 *
 * @param {string} value - valor formatado ou cru
 * @returns {string} apenas dígitos
 */
export function unmaskPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Liga máscara de telefone a um <input>. Configura inputmode/maxlength,
 * aplica máscara em 'input' e em 'paste'. Idempotente — chamar duas vezes
 * no mesmo elemento não duplica listeners (marca via dataset).
 *
 * @param {HTMLInputElement|null} input
 */
export function bindPhoneMaskInput(input) {
  if (!input || input.dataset.phoneMaskBound === '1') return;
  input.dataset.phoneMaskBound = '1';

  // Atributos do nativo: melhora a experiência mobile e bloqueia caracteres óbvios.
  input.setAttribute('inputmode', 'tel');
  input.setAttribute('autocomplete', 'tel');
  input.setAttribute('maxlength', '15'); // (XX) XXXXX-XXXX = 15 chars
  if (!input.placeholder) {
    input.placeholder = '(31) 99999-9999';
  }

  // Já formatar valor inicial (quando vem preenchido do banco).
  if (input.value) {
    input.value = applyPhoneMask(input.value);
  }

  input.addEventListener('input', () => {
    const masked = applyPhoneMask(input.value);
    if (masked !== input.value) {
      input.value = masked;
    }
  });

  input.addEventListener('blur', () => {
    if (input.value) {
      input.value = applyPhoneMask(input.value);
    }
  });
}

/**
 * Versão "smart" pra campos duais (telefone OU email/texto). Aplica
 * máscara só se o valor parecer dígito. Se o usuário digitar letras,
 * '@', '.', ' ', etc — deixa em paz.
 *
 * Heurística: se o valor (sem espaços) contém qualquer caractere que
 * não seja dígito ou um dos separadores de máscara `()-`, considera
 * que NÃO é telefone e não aplica máscara.
 *
 * @param {HTMLInputElement|null} input
 */
export function bindSmartContactMaskInput(input) {
  if (!input || input.dataset.smartMaskBound === '1') return;
  input.dataset.smartMaskBound = '1';

  input.setAttribute('autocomplete', 'off');

  const maybeMask = () => {
    const v = input.value || '';
    // Se contém qualquer caractere não-numérico/separador, é email/texto.
    if (/[^\d\s()\-+]/.test(v)) return;
    const masked = applyPhoneMask(v);
    if (masked && masked !== v) {
      input.value = masked;
    }
  };

  if (input.value) maybeMask();
  input.addEventListener('input', maybeMask);
  input.addEventListener('blur', maybeMask);
}
