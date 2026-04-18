// Paleta redesenhada para o relatório técnico: navy + cinzas + acento teal.
// Foi desenhada pra imprimir bem (baixo consumo de tinta) e transmitir
// seriedade de relatório de engenharia em vez de ter cara de dashboard UI.
export const PDF_COLORS = {
  bg: [255, 255, 255],
  bg2: [249, 250, 251], // surface muito sutil para masthead / faixas
  bg3: [243, 244, 246],
  surface: [255, 255, 255],
  border: [229, 231, 235],
  borderStrong: [209, 213, 219],
  primary: [15, 39, 70], // navy — títulos, barras laterais, cabeçalhos
  accent: [0, 169, 200], // teal herdado do ciano original — destaques pontuais
  green: [21, 128, 61],
  amber: [180, 83, 9],
  red: [185, 28, 28],
  text: [17, 24, 39],
  text2: [55, 65, 81],
  text3: [107, 114, 128],
  white: [255, 255, 255],
};

// Escala tipográfica explícita. O código antigo espalhava tamanhos mágicos
// (7, 7.5, 8, 8.5, 9, 10, 11, 14, 18, 28) — aqui a escada é 18 → 12 → 9 → 8 → 7
// para dar hierarquia clara sem parecer folheto.
export const PDF_TYPO = {
  title: { size: 18, style: 'bold' },
  h1: { size: 12, style: 'bold' },
  h2: { size: 9, style: 'bold' }, // labels de seção UPPERCASE
  body: { size: 9, style: 'normal' },
  bodyBold: { size: 9, style: 'bold' },
  meta: { size: 8, style: 'normal' },
  metaBold: { size: 8, style: 'bold' },
  micro: { size: 7, style: 'normal' },
  microBold: { size: 7, style: 'bold' },
};

export const STATUS_CLIENTE = {
  ok: { label: 'Funcionando normalmente', color: PDF_COLORS.green, icon: '✓' },
  warn: { label: 'Requer atenção em breve', color: PDF_COLORS.amber, icon: '!' },
  danger: { label: 'Fora de operação', color: PDF_COLORS.red, icon: '✗' },
};
