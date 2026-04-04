/**
 * CoolTrack Pro - State Module v4.0
 * Seed com equipamentos realistas para múltiplos setores HVAC:
 * hospitalar, comercial, industrial, alimentício, farmacêutico
 */

import { Utils } from './utils.js';
import { Storage } from './storage.js';

const INITIAL_STATE = { equipamentos: [], registros: [], tecnicos: [] };

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

function emit() { listeners.forEach(fn => fn(getState())); }

export function getState() {
  return {
    equipamentos: [...state.equipamentos],
    registros:    [...state.registros],
    tecnicos:     [...(state.tecnicos || [])],
  };
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function persist() { Storage.save(state); }

export function setState(updater, options = { persist: true, emit: true }) {
  _regsCache = null;
  const nextState = updater(state);
  if (nextState) state = nextState;
  if (options.persist) persist();
  if (options.emit)    emit();
}

export function findEquip(id) {
  return state.equipamentos.find(e => e.id === id);
}

export function regsForEquip(id) {
  return getRegsIndex()[id] ?? [];
}

export function lastRegForEquip(id) {
  return [...regsForEquip(id)].sort((a, b) => b.data.localeCompare(a.data))[0];
}

export function seedIfEmpty() {
  if (state.equipamentos.length) return;

  // ── Equipamentos representativos de múltiplos setores HVAC ──
  const eq = [
    // Hospitalar
    {
      id: Utils.uid(), nome: 'Split UTI Adulto', tag: 'AC-UTI-01',
      local: 'UTI Adulto — 2º Andar', tipo: 'Split Hi-Wall',
      modelo: 'Carrier XPower 18.000 BTU', fluido: 'R-410A', status: 'ok'
    },
    {
      id: Utils.uid(), nome: 'Split Centro Cirúrgico', tag: 'AC-CC-01',
      local: 'Centro Cirúrgico — 3º Andar', tipo: 'Split Piso Teto',
      modelo: 'Trane IntelliPak 24.000 BTU', fluido: 'R-410A', status: 'warn'
    },
    {
      id: Utils.uid(), nome: 'Fan Coil Recepção', tag: 'FC-REC-01',
      local: 'Recepção — Térreo', tipo: 'Fan Coil',
      modelo: 'Hitachi RCI-AP 36.000 BTU', fluido: 'R-22', status: 'ok'
    },
    // Farmacêutico / conservação
    {
      id: Utils.uid(), nome: 'Câmara Fria Farmácia', tag: 'CF-FAR-01',
      local: 'Farmácia — Subsolo', tipo: 'Câmara Fria',
      modelo: 'Tecumseh AJ5517Z', fluido: 'R-134A', status: 'danger'
    },
    {
      id: Utils.uid(), nome: 'Câmara Fria Laboratório', tag: 'CF-LAB-01',
      local: 'Laboratório de Análises — 1º Andar', tipo: 'Câmara Fria',
      modelo: 'Bitzer 4FES-3Y', fluido: 'R-404A', status: 'ok'
    },
    // Comercial / escritório
    {
      id: Utils.uid(), nome: 'VRF Torre Corporativa', tag: 'VRF-COR-01',
      local: 'Torre Corporativa — Andares 4 a 8', tipo: 'VRF / VRV',
      modelo: 'Daikin VRV IV 20 HP', fluido: 'R-410A', status: 'ok'
    },
    // Industrial
    {
      id: Utils.uid(), nome: 'Chiller Linha de Produção', tag: 'CH-PROD-01',
      local: 'Galpão Industrial — Linha A', tipo: 'Chiller',
      modelo: 'York YK 200 TR', fluido: 'R-134A', status: 'warn'
    },
  ];

  // ── Técnicos ──
  const tecnicos = [
    'Carlos Figueiredo',
    'Camila Souza',
    'João Silva',
    'Rafael Mendes',
    'Ana Ribeiro',
  ];

  // ── Registros históricos realistas ──
  const registros = [
    // UTI Adulto — preventiva recente, tudo ok
    {
      id: Utils.uid(), equipId: eq[0].id,
      data: Utils.datetimeOffset(-3),
      tipo: 'Manutenção Preventiva',
      pecas: 'Filtro G4, filtro HEPA, lubrificante Klüber',
      obs: 'Limpeza completa de serpentina evaporadora e condensadora. Verificação de tensão nos capacitores (capacitor dentro do limite). Corrente de compressor: 8,2A (nominal 8,5A). Pressão de sucção: 68 psi. Pressão de descarga: 245 psi. Sistema operando normalmente.',
      proxima: Utils.dateOffset(27), status: 'ok', fotos: [],
      tecnico: 'Carlos Figueiredo'
    },
    // Split CC — carga de gás, monitoramento
    {
      id: Utils.uid(), equipId: eq[1].id,
      data: Utils.datetimeOffset(-6),
      tipo: 'Carga de Gás Refrigerante',
      pecas: 'R-410A 1,5 kg, válvula Schrader',
      obs: 'Baixa eficiência de resfriamento detectada. Pressão de sucção em 42 psi (abaixo do nominal de 65 psi), indicando deficiência de gás. Verificado vazamento na conexão de solda do evaporador — reparo realizado com maçarico oxiacetilênico. Recarga de 1,5 kg de R-410A. Pressão normalizada para 68 psi após carga. Monitorar nas próximas 2 semanas.',
      proxima: Utils.dateOffset(8), status: 'warn', fotos: [],
      tecnico: 'Camila Souza'
    },
    // Câmara Fria Farmácia — corretiva urgente
    {
      id: Utils.uid(), equipId: eq[3].id,
      data: Utils.datetimeOffset(-1),
      tipo: 'Manutenção Corretiva',
      pecas: 'Capacitor 45µF/440V, contator 25A',
      obs: 'Compressor não acionava ao comando do termostato. Diagnóstico: capacitor de partida com falha de isolamento (medição: 12µF, nominal 45µF). Substituição do capacitor e contator auxiliar queimado. Após troca, motor partiu normalmente. Temperatura da câmara retornando para faixa operacional (set point: -18°C). Aguardando estabilização.',
      proxima: Utils.dateOffset(3), status: 'danger', fotos: [],
      tecnico: 'João Silva'
    },
    // Fan Coil Recepção — limpeza
    {
      id: Utils.uid(), equipId: eq[2].id,
      data: Utils.datetimeOffset(-10),
      tipo: 'Limpeza de Filtros',
      pecas: 'Filtro G3 x2',
      obs: 'Limpeza e substituição dos filtros G3. Lavagem da bandeja de condensado com solução bactericida. Verificação de dreno — sem obstrução. Corrente de motor do fan coil: 3,1A (nominal 3,5A). Sistema operando dentro dos parâmetros.',
      proxima: Utils.dateOffset(50), status: 'ok', fotos: [],
      tecnico: 'Ana Ribeiro'
    },
    // Câmara Fria Laboratório — preventiva
    {
      id: Utils.uid(), equipId: eq[4].id,
      data: Utils.datetimeOffset(-15),
      tipo: 'Manutenção Preventiva',
      pecas: 'Filtro secador, óleo Bitzer BSE 55',
      obs: 'Verificação completa da câmara de análises. Temperatura estável em -4°C (set point -5°C). Troca do filtro secador (programada a cada 12 meses). Reposição de óleo lubrificante no compressor Bitzer. Verificação da gaxeta da porta — sem vácuo, troca agendada para próxima visita. Câmara operacional.',
      proxima: Utils.dateOffset(60), status: 'ok', fotos: [],
      tecnico: 'Rafael Mendes'
    },
    // VRF Torre — inspeção geral
    {
      id: Utils.uid(), equipId: eq[5].id,
      data: Utils.datetimeOffset(-20),
      tipo: 'Inspeção Geral',
      pecas: '',
      obs: 'Inspeção trimestral do sistema VRF. Verificação de 32 unidades internas — todas respondendo ao controlador central. Leitura de pressão na unidade externa: sucção 72 psi, descarga 260 psi (dentro dos limites Daikin). Log de erros: sem códigos ativos. Limpeza dos filtros das UI dos andares 6 e 7 (maior fluxo de pessoas). Sistema operando normalmente.',
      proxima: Utils.dateOffset(70), status: 'ok', fotos: [],
      tecnico: 'Carlos Figueiredo'
    },
    // Chiller produção — atenção
    {
      id: Utils.uid(), equipId: eq[6].id,
      data: Utils.datetimeOffset(-8),
      tipo: 'Verificação Elétrica',
      pecas: 'Fusível 32A x3',
      obs: 'Chamado por desligamento automático por sobrecorrente. Identificados 3 fusíveis queimados no painel de proteção do compressor B. Medição de corrente após substituição: 42A (nominal 40A — ligeiramente elevado). Recomendado verificar alinhamento das polias e tensão da correia. Chiller reativado. Monitorar temperatura de saída da água gelada (set point 7°C).',
      proxima: Utils.dateOffset(12), status: 'warn', fotos: [],
      tecnico: 'Rafael Mendes'
    },
    // UTI — registro mais antigo
    {
      id: Utils.uid(), equipId: eq[0].id,
      data: Utils.datetimeOffset(-33),
      tipo: 'Manutenção Preventiva',
      pecas: 'Filtro G4, lubrificante',
      obs: 'Manutenção preventiva mensal. Limpeza de filtros e serpentinas. Verificação elétrica sem anomalias. Sistema operando normalmente.',
      proxima: Utils.dateOffset(-3), status: 'ok', fotos: [],
      tecnico: 'Carlos Figueiredo'
    },
    // Split CC — inspeção anterior
    {
      id: Utils.uid(), equipId: eq[1].id,
      data: Utils.datetimeOffset(-36),
      tipo: 'Inspeção Geral',
      pecas: '',
      obs: 'Inspeção de rotina. Pressão de sucção levemente baixa (58 psi). Sem decisão de recarga no momento — agendado retorno em 30 dias para reavaliação.',
      proxima: Utils.dateOffset(-6), status: 'warn', fotos: [],
      tecnico: 'Camila Souza'
    },
  ];

  setState(() => ({
    equipamentos: eq,
    registros,
    tecnicos,
  }));
}