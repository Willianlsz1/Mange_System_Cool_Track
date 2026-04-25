/**
 * CoolTrack Pro - State v5.0
 * Movido para core/state.js — sem dependências de UI
 */

import { Storage } from './storage.js';

const INITIAL_STATE = {
  equipamentos: [],
  registros: [],
  tecnicos: [],
  setores: [],
  // V2 PMOC (abr/2026): clientes (carteira do técnico). Hidratado on-demand
  // via core/clientes.js#loadClientes — não persiste em localStorage porque
  // clientes vivem só no Supabase (sem queue offline na fase 2).
  clientes: [],
};

const listeners = new Set();
let state = Storage.load(INITIAL_STATE);
let _regsCache = null;

function getRegsIndex() {
  if (_regsCache) return _regsCache;
  _regsCache = state.registros.reduce((acc, r) => {
    if (!acc[r.equipId]) acc[r.equipId] = [];
    acc[r.equipId].push(r);
    return acc;
  }, {});
  return _regsCache;
}

function emit() {
  listeners.forEach((fn) => fn(getState()));
}

export function getState() {
  return {
    equipamentos: [...state.equipamentos],
    registros: [...state.registros],
    tecnicos: [...(state.tecnicos || [])],
    setores: [...(state.setores || [])],
    clientes: [...(state.clientes || [])],
  };
}

export function findSetor(id) {
  return (state.setores || []).find((s) => s.id === id) ?? null;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function persist() {
  Storage.save(state);
}

export function setState(updater, options = { persist: true, emit: true }) {
  _regsCache = null;
  const nextState = updater(state);
  if (nextState) state = nextState;
  if (options.persist) persist();
  if (options.emit) emit();
}

export function findEquip(id) {
  return state.equipamentos.find((e) => e.id === id);
}
export function regsForEquip(id) {
  return getRegsIndex()[id] ?? [];
}
export function lastRegForEquip(id) {
  return [...regsForEquip(id)].sort((a, b) => b.data.localeCompare(a.data))[0];
}
