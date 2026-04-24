import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Profile } from '../features/profile.js';
import { setCurrentUser, userStorage } from '../core/userStorage.js';

describe('Profile — user-scoped storage (audit §1.2)', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentUser('u-1');
  });

  afterEach(() => {
    setCurrentUser('anon');
    localStorage.clear();
  });

  it('save() grava somente na chave escopada, não na global', () => {
    Profile.save({ nome: 'Ana', crea: 'MG-123' });
    expect(localStorage.getItem('ct:u-1:cooltrack-profile')).toContain('Ana');
    expect(localStorage.getItem('cooltrack-profile')).toBeNull();
  });

  it('get() prefere chave escopada sobre a global legada', () => {
    localStorage.setItem('cooltrack-profile', JSON.stringify({ nome: 'Legacy' }));
    userStorage.set('cooltrack-profile', JSON.stringify({ nome: 'Novo' }));
    expect(Profile.get()?.nome).toBe('Novo');
  });

  it('get() cai no fallback global quando não há escopada (backward compat)', () => {
    localStorage.setItem('cooltrack-profile', JSON.stringify({ nome: 'Legacy' }));
    expect(Profile.get()?.nome).toBe('Legacy');
  });

  it('get() retorna null e limpa a chave global quando o JSON está corrompido', () => {
    localStorage.setItem('cooltrack-profile', '{not json');
    expect(Profile.get()).toBeNull();
    expect(localStorage.getItem('cooltrack-profile')).toBeNull();
  });

  it('getDefaultTecnico() prioriza o nome do profile escopado', () => {
    Profile.save({ nome: 'Ana' });
    expect(Profile.getDefaultTecnico()).toBe('Ana');
  });

  it('getDefaultTecnico() cai em last-tecnico escopado quando profile está vazio', () => {
    userStorage.set('cooltrack-last-tecnico', 'Carlos');
    expect(Profile.getDefaultTecnico()).toBe('Carlos');
  });

  it('dados não vazam entre usuários com userIds diferentes', () => {
    Profile.save({ nome: 'Ana (u-1)' });
    setCurrentUser('u-2');
    expect(Profile.get()).toBeNull();
    Profile.save({ nome: 'Bob (u-2)' });
    expect(Profile.get()?.nome).toBe('Bob (u-2)');
    setCurrentUser('u-1');
    expect(Profile.get()?.nome).toBe('Ana (u-1)');
  });
});
