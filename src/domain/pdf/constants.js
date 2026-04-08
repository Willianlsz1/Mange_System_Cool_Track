export const PDF_COLORS = {
  bg: [255, 255, 255],
  bg2: [255, 255, 255],
  bg3: [245, 245, 245],
  surface: [255, 255, 255],
  border: [204, 204, 204],
  primary: [0, 200, 232],
  green: [46, 125, 50],
  amber: [245, 127, 23],
  red: [198, 40, 40],
  text: [0, 0, 0],
  text2: [26, 26, 26],
  text3: [85, 85, 85],
  white: [255, 255, 255],
};

export const STATUS_CLIENTE = {
  ok: { label: 'Funcionando normalmente', color: PDF_COLORS.green, icon: '✓' },
  warn: { label: 'Requer atenção em breve', color: PDF_COLORS.amber, icon: '!' },
  danger: { label: 'Fora de operação', color: PDF_COLORS.red, icon: '✗' },
};
