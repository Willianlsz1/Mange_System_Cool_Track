import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('equipamentos ownership cleanup', () => {
  it('não referencia módulos legados paralelos de equipamentos', () => {
    const files = [
      'src/ui/controller/routes.js',
      'src/ui/controller/handlers/equipmentHandlers.js',
      'src/ui/views/equipamentos.js',
      'src/__tests__/equipPhotosEditor.test.js',
    ];

    const legacyImportPattern =
      /ui\/views\/equipamentos\/(equipDetail|equipCrud|setorCrud|setorCard)\.js/;

    files.forEach((filePath) => {
      const source = readFileSync(filePath, 'utf-8');
      expect(source).not.toMatch(legacyImportPattern);
    });
  });
});
