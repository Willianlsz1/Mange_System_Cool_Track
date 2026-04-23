/**
 * CoolTrack Pro - State v5.0
 * Movido para core/state.js — sem dependências de UI
 */

import { Utils } from './utils.js';
import { Storage } from './storage.js';

const INITIAL_STATE = { equipamentos: [], registros: [], tecnicos: [], setores: [] };

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
  return Storage.save(state);
}

export function setState(updater, options = { persist: true, emit: true }) {
  const nextState = updater(state);
  if (!nextState) return true;

  if (options.persist) {
    const persisted = Storage.save(nextState);
    if (!persisted) return false;
  }

  _regsCache = null;
  state = nextState;
  if (options.emit) emit();
  return true;
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

export function seedIfEmpty() {
  if (state.equipamentos.length) return;

  const eq = [
    {
      id: Utils.uid(),
      nome: 'Split UTI Adulto',
      tag: 'AC-UTI-01',
      local: 'UTI Adulto — 2º Andar',
      tipo: 'Split Hi-Wall',
      modelo: 'Carrier XPower 18.000 BTU',
      fluido: 'R-410A',
      status: 'ok',
    },
    {
      id: Utils.uid(),
      nome: 'Split Centro Cirúrgico',
      tag: 'AC-CC-01',
      local: 'Centro Cirúrgico — 3º Andar',
      tipo: 'Split Piso Teto',
      modelo: 'Trane IntelliPak 24.000 BTU',
      fluido: 'R-410A',
      status: 'warn',
    },
    {
      id: Utils.uid(),
      nome: 'Fan Coil Recepção',
      tag: 'FC-REC-01',
      local: 'Recepção — Térreo',
      tipo: 'Fan Coil',
      modelo: 'Hitachi RCI-AP 36.000 BTU',
      fluido: 'R-22',
      status: 'ok',
    },
    {
      id: Utils.uid(),
      nome: 'Câmara Fria Farmácia',
      tag: 'CF-FAR-01',
      local: 'Farmácia — Subsolo',
      tipo: 'Câmara Fria',
      modelo: 'Tecumseh AJ5517Z',
      fluido: 'R-134A',
      status: 'danger',
    },
    {
      id: Utils.uid(),
      nome: 'Câmara Fria Laboratório',
      tag: 'CF-LAB-01',
      local: 'Laboratório de Análises — 1º Andar',
      tipo: 'Câmara Fria',
      modelo: 'Bitzer 4FES-3Y',
      fluido: 'R-404A',
      status: 'ok',
    },
    {
      id: Utils.uid(),
      nome: 'VRF Torre Corporativa',
      tag: 'VRF-COR-01',
      local: 'Torre Corporativa — Andares 4 a 8',
      tipo: 'VRF / VRV',
      modelo: 'Daikin VRV IV 20 HP',
      fluido: 'R-410A',
      status: 'ok',
    },
    {
      id: Utils.uid(),
      nome: 'Chiller Linha Produção',
      tag: 'CH-PROD-01',
      local: 'Galpão Industrial — Linha A',
      tipo: 'Chiller',
      modelo: 'York YK 200 TR',
      fluido: 'R-134A',
      status: 'warn',
    },
  ];

  const equipamentos = eq.map((equipamento, index) => {
    const profiles = [
      { criticidade: 'critica', prioridadeOperacional: 'alta', periodicidadePreventivaDias: 30 },
      { criticidade: 'critica', prioridadeOperacional: 'alta', periodicidadePreventivaDias: 30 },
      { criticidade: 'media', prioridadeOperacional: 'normal', periodicidadePreventivaDias: 60 },
      { criticidade: 'critica', prioridadeOperacional: 'alta', periodicidadePreventivaDias: 30 },
      { criticidade: 'alta', prioridadeOperacional: 'alta', periodicidadePreventivaDias: 30 },
      { criticidade: 'media', prioridadeOperacional: 'normal', periodicidadePreventivaDias: 45 },
      { criticidade: 'critica', prioridadeOperacional: 'alta', periodicidadePreventivaDias: 30 },
    ];

    return {
      ...equipamento,
      ...profiles[index],
    };
  });

  const tecnicos = [
    'Carlos Figueiredo',
    'Camila Souza',
    'João Silva',
    'Rafael Mendes',
    'Ana Ribeiro',
  ];

  const registros = [
    {
      id: Utils.uid(),
      equipId: eq[0].id,
      data: Utils.datetimeOffset(-3),
      tipo: 'Manutenção Preventiva',
      pecas: 'Filtro G4, filtro HEPA, lubrificante Klüber',
      obs: 'Limpeza completa de serpentina. Corrente de compressor: 8,2A (nominal 8,5A). Sistema operando normalmente.',
      proxima: Utils.dateOffset(27),
      status: 'ok',
      fotos: [],
      tecnico: 'Carlos Figueiredo',
    },
    {
      id: Utils.uid(),
      equipId: eq[1].id,
      data: Utils.datetimeOffset(-6),
      tipo: 'Carga de Gás Refrigerante',
      pecas: 'R-410A 1,5 kg, válvula Schrader',
      obs: 'Vazamento na conexão do evaporador. Reparo realizado. Recarga de 1,5 kg de R-410A. Pressão normalizada. Monitorar nas próximas 2 semanas.',
      proxima: Utils.dateOffset(8),
      status: 'warn',
      fotos: [],
      tecnico: 'Camila Souza',
    },
    {
      id: Utils.uid(),
      equipId: eq[3].id,
      data: Utils.datetimeOffset(-1),
      tipo: 'Manutenção Corretiva',
      pecas: 'Capacitor 45µF/440V, contator 25A',
      obs: 'Compressor não acionava. Capacitor de partida com falha. Substituição realizada. Motor partiu normalmente. Aguardando estabilização da temperatura.',
      proxima: Utils.dateOffset(3),
      status: 'danger',
      fotos: [],
      tecnico: 'João Silva',
    },
    {
      id: Utils.uid(),
      equipId: eq[2].id,
      data: Utils.datetimeOffset(-10),
      tipo: 'Limpeza de Filtros',
      pecas: 'Filtro G3 x2',
      obs: 'Limpeza e substituição dos filtros G3. Lavagem da bandeja com solução bactericida. Dreno sem obstrução. Sistema dentro dos parâmetros.',
      proxima: Utils.dateOffset(50),
      status: 'ok',
      fotos: [],
      tecnico: 'Ana Ribeiro',
    },
    {
      id: Utils.uid(),
      equipId: eq[4].id,
      data: Utils.datetimeOffset(-15),
      tipo: 'Manutenção Preventiva',
      pecas: 'Filtro secador, óleo Bitzer BSE 55',
      obs: 'Temperatura estável em -4°C. Troca do filtro secador. Reposição de óleo lubrificante. Verificação da gaxeta da porta — troca agendada para próxima visita.',
      proxima: Utils.dateOffset(60),
      status: 'ok',
      fotos: [],
      tecnico: 'Rafael Mendes',
    },
    {
      id: Utils.uid(),
      equipId: eq[5].id,
      data: Utils.datetimeOffset(-20),
      tipo: 'Inspeção Geral',
      pecas: '',
      obs: 'Verificação de 32 unidades internas — todas respondendo. Log de erros sem códigos ativos. Limpeza dos filtros dos andares 6 e 7. Sistema operando normalmente.',
      proxima: Utils.dateOffset(70),
      status: 'ok',
      fotos: [],
      tecnico: 'Carlos Figueiredo',
    },
    {
      id: Utils.uid(),
      equipId: eq[6].id,
      data: Utils.datetimeOffset(-8),
      tipo: 'Verificação Elétrica',
      pecas: 'Fusível 32A x3',
      obs: 'Desligamento por sobrecorrente. 3 fusíveis queimados substituídos. Corrente após substituição: 42A (nominal 40A). Recomendado verificar alinhamento de polias.',
      proxima: Utils.dateOffset(12),
      status: 'warn',
      fotos: [],
      tecnico: 'Rafael Mendes',
    },
    {
      id: Utils.uid(),
      equipId: eq[0].id,
      data: Utils.datetimeOffset(-33),
      tipo: 'Manutenção Preventiva',
      pecas: 'Filtro G4, lubrificante',
      obs: 'Manutenção preventiva mensal. Limpeza de filtros e serpentinas. Verificação elétrica sem anomalias. Sistema operando normalmente.',
      proxima: Utils.dateOffset(-3),
      status: 'ok',
      fotos: [],
      tecnico: 'Carlos Figueiredo',
    },
    {
      id: Utils.uid(),
      equipId: eq[1].id,
      data: Utils.datetimeOffset(-36),
      tipo: 'Inspeção Geral',
      pecas: '',
      obs: 'Pressão de sucção levemente baixa. Sem decisão de recarga — agendado retorno em 30 dias para reavaliação.',
      proxima: Utils.dateOffset(-6),
      status: 'warn',
      fotos: [],
      tecnico: 'Camila Souza',
    },
  ];

  setState(() => ({ equipamentos, registros, tecnicos }));
}
