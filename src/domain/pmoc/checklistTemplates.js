/**
 * CoolTrack Pro - Checklist Templates NBR 13971 (Fase 3 PMOC, abr/2026)
 *
 * Templates de checklist baseados na ABNT NBR 13971 (Manutenção de
 * sistemas de refrigeração, condicionamento de ar e ventilação) e
 * recomendações da Portaria GM/MS 3.523/1998.
 *
 * Cada template tem:
 *   - tipo_template: chave estável (ex: 'split_hi_wall', 'vrf')
 *   - version:       número (incrementa ao mudar items — registros
 *                    antigos preservam a versão original)
 *   - items:         lista de pontos a verificar
 *     - id:        chave estável do item
 *     - label:     texto exibido pro técnico
 *     - group:     agrupamento visual no formulário (Mecânico, Elétrico, etc)
 *     - mandatory: true = obrigatório pra PMOC formal (warn se faltar)
 *
 * Fonte: NBR 13971:2014 (anexos A, B), CONFEA Resolução 1.025/2009 (RRT).
 *
 * IMPORTANTE: nunca edite items existentes — adicione novos com id novo
 * e bumpe a `version`. Os registros antigos referenciam version + id.
 */

// ─── Catálogo de tipos de equipamento → template key ──────────────────
// Map o `tipo` do equipamento (string visível no select) pra chave do
// template. Tipos não mapeados caem no template GENERIC.
const EQUIP_TIPO_TO_TEMPLATE = Object.freeze({
  'Split Hi-Wall': 'split_hi_wall',
  'Split Cassette': 'split_cassette',
  'Split Piso Teto': 'split_piso_teto',
  'VRF / VRV': 'vrf',
  GHP: 'vrf', // GHP usa mesma topologia de VRF pra checklist
  'Fan Coil': 'fan_coil',
  Chiller: 'chiller',
  'Self Contained': 'self_contained',
  'Roof Top': 'self_contained', // Roof top é autocontido
  // Tipos não-climatização (câmara fria, dry cooler, etc) caem no GENERIC.
});

// ─── Templates ────────────────────────────────────────────────────────

const TEMPLATE_SPLIT_HI_WALL = Object.freeze({
  tipo_template: 'split_hi_wall',
  version: 1,
  label: 'Split Hi-Wall (NBR 13971)',
  items: [
    // Mecânico
    {
      id: 'filtros_limpeza',
      label: 'Limpeza dos filtros de ar',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_evap',
      label: 'Limpeza da serpentina evaporadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_cond',
      label: 'Limpeza da serpentina condensadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'helice_ventilador',
      label: 'Inspeção da hélice e turbina (sujeira/folga)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'dreno_funcional',
      label: 'Dreno e bandeja de condensado (vazão e vedação)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'gabinete_estado',
      label: 'Estado do gabinete e fixações',
      group: 'Mecânico',
      mandatory: false,
    },

    // Elétrico
    {
      id: 'tensao_alimentacao',
      label: 'Tensão de alimentação dentro da faixa de placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    {
      id: 'corrente_compressor',
      label: 'Corrente do compressor x placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'A',
    },
    {
      id: 'aterramento',
      label: 'Aterramento e continuidade da carcaça',
      group: 'Elétrico',
      mandatory: true,
    },
    {
      id: 'capacitor',
      label: 'Capacitor (visual + capacitância se em dúvida)',
      group: 'Elétrico',
      mandatory: false,
    },
    {
      id: 'conexoes_eletricas',
      label: 'Reaperto de conexões elétricas',
      group: 'Elétrico',
      mandatory: true,
    },

    // Refrigeração
    {
      id: 'pressao_succao',
      label: 'Pressão de sucção em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'pressao_descarga',
      label: 'Pressão de descarga em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'superaquecimento',
      label: 'Superaquecimento (ΔT) na sucção',
      group: 'Refrigeração',
      mandatory: false,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'vazamento_inspecao',
      label: 'Inspeção visual de vazamento (juntas/conexões)',
      group: 'Refrigeração',
      mandatory: true,
    },

    // Operacional
    {
      id: 'controle_remoto',
      label: 'Funcionamento do controle remoto e display',
      group: 'Operacional',
      mandatory: false,
    },
    {
      id: 'temperatura_insuflamento',
      label: 'Temperatura de insuflamento conforme setpoint',
      group: 'Operacional',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'ruido_anormal',
      label: 'Ausência de ruído anormal (vibração, batida)',
      group: 'Operacional',
      mandatory: false,
    },
  ],
});

const TEMPLATE_SPLIT_CASSETTE = Object.freeze({
  tipo_template: 'split_cassette',
  version: 1,
  label: 'Split Cassette (NBR 13971)',
  items: [
    // Mesmo core do hi-wall + 2 itens específicos do cassette
    {
      id: 'filtros_limpeza',
      label: 'Limpeza dos filtros de ar',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_evap',
      label: 'Limpeza da serpentina evaporadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_cond',
      label: 'Limpeza da serpentina condensadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'turbina_centrifuga',
      label: 'Inspeção e limpeza da turbina centrífuga',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'painel_difusor',
      label: 'Estado do painel difusor (4 vias) e flaps',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'bomba_dreno',
      label: 'Bomba de dreno (acionamento + vazão)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'dreno_funcional',
      label: 'Tubulação de dreno (caimento e vedação)',
      group: 'Mecânico',
      mandatory: true,
    },

    {
      id: 'tensao_alimentacao',
      label: 'Tensão de alimentação dentro da faixa de placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    {
      id: 'corrente_compressor',
      label: 'Corrente do compressor x placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'A',
    },
    {
      id: 'aterramento',
      label: 'Aterramento e continuidade da carcaça',
      group: 'Elétrico',
      mandatory: true,
    },
    {
      id: 'conexoes_eletricas',
      label: 'Reaperto de conexões elétricas',
      group: 'Elétrico',
      mandatory: true,
    },

    {
      id: 'pressao_succao',
      label: 'Pressão de sucção em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'pressao_descarga',
      label: 'Pressão de descarga em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'vazamento_inspecao',
      label: 'Inspeção visual de vazamento (juntas/conexões)',
      group: 'Refrigeração',
      mandatory: true,
    },

    {
      id: 'temperatura_insuflamento',
      label: 'Temperatura de insuflamento conforme setpoint',
      group: 'Operacional',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'ruido_anormal',
      label: 'Ausência de ruído anormal (vibração, batida)',
      group: 'Operacional',
      mandatory: false,
    },
  ],
});

const TEMPLATE_SPLIT_PISO_TETO = Object.freeze({
  tipo_template: 'split_piso_teto',
  version: 1,
  label: 'Split Piso-Teto (NBR 13971)',
  items: [
    {
      id: 'filtros_limpeza',
      label: 'Limpeza dos filtros de ar',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_evap',
      label: 'Limpeza da serpentina evaporadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_cond',
      label: 'Limpeza da serpentina condensadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'helice_ventilador',
      label: 'Inspeção da hélice e turbina (sujeira/folga)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'dreno_funcional',
      label: 'Dreno e bandeja de condensado (vazão e vedação)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'fixacao_evaporadora',
      label: 'Fixação e nivelamento da evaporadora',
      group: 'Mecânico',
      mandatory: false,
    },

    {
      id: 'tensao_alimentacao',
      label: 'Tensão de alimentação dentro da faixa de placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    {
      id: 'corrente_compressor',
      label: 'Corrente do compressor x placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'A',
    },
    {
      id: 'aterramento',
      label: 'Aterramento e continuidade da carcaça',
      group: 'Elétrico',
      mandatory: true,
    },
    {
      id: 'conexoes_eletricas',
      label: 'Reaperto de conexões elétricas',
      group: 'Elétrico',
      mandatory: true,
    },

    {
      id: 'pressao_succao',
      label: 'Pressão de sucção em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'pressao_descarga',
      label: 'Pressão de descarga em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'vazamento_inspecao',
      label: 'Inspeção visual de vazamento (juntas/conexões)',
      group: 'Refrigeração',
      mandatory: true,
    },

    {
      id: 'temperatura_insuflamento',
      label: 'Temperatura de insuflamento conforme setpoint',
      group: 'Operacional',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'ruido_anormal',
      label: 'Ausência de ruído anormal (vibração, batida)',
      group: 'Operacional',
      mandatory: false,
    },
  ],
});

const TEMPLATE_VRF = Object.freeze({
  tipo_template: 'vrf',
  version: 1,
  label: 'VRF / VRV (NBR 13971)',
  items: [
    // Unidades internas (inspeção amostral)
    {
      id: 'filtros_internas',
      label: 'Limpeza dos filtros das unidades internas',
      group: 'Unidades Internas',
      mandatory: true,
    },
    {
      id: 'serpentinas_internas',
      label: 'Limpeza das serpentinas das unidades internas',
      group: 'Unidades Internas',
      mandatory: true,
    },
    {
      id: 'drenos_internas',
      label: 'Drenos e bombas de condensado das unidades internas',
      group: 'Unidades Internas',
      mandatory: true,
    },
    {
      id: 'sensores_internas',
      label: 'Sensores de temperatura e display das internas',
      group: 'Unidades Internas',
      mandatory: false,
    },

    // Unidade externa (condensadora)
    {
      id: 'serpentina_condensadora',
      label: 'Limpeza completa da serpentina condensadora',
      group: 'Unidade Externa',
      mandatory: true,
    },
    {
      id: 'ventiladores_externos',
      label: 'Inspeção dos ventiladores axiais (folga, balanceamento)',
      group: 'Unidade Externa',
      mandatory: true,
    },
    {
      id: 'compressores_inverter',
      label: 'Compressores inverter — corrente x placa, ruído',
      group: 'Unidade Externa',
      mandatory: true,
    },
    {
      id: 'oleo_compressor',
      label: 'Nível e cor do óleo do compressor (visor)',
      group: 'Unidade Externa',
      mandatory: false,
    },
    {
      id: 'placa_inverter',
      label: 'Inspeção da placa inverter (corrosão, dissipador)',
      group: 'Unidade Externa',
      mandatory: true,
    },

    // Refrigeração
    {
      id: 'pressao_alta',
      label: 'Pressão de descarga em regime de carga máxima',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'pressao_baixa',
      label: 'Pressão de sucção em regime de carga máxima',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'subresfriamento',
      label: 'Sub-resfriamento na linha de líquido',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'superaquecimento_succao',
      label: 'Superaquecimento na sucção',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'vazamento_uniao',
      label: 'Inspeção de vazamento em uniões soldadas',
      group: 'Refrigeração',
      mandatory: true,
    },

    // Elétrico/Controle
    {
      id: 'tensao_trifasica',
      label: 'Tensão trifásica equilibrada (desbalanço < 2%)',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    {
      id: 'aterramento',
      label: 'Aterramento da unidade externa',
      group: 'Elétrico',
      mandatory: true,
    },
    {
      id: 'controlador_central',
      label: 'Controlador central — comunicação com todas internas',
      group: 'Controle',
      mandatory: true,
    },
    {
      id: 'historico_alarmes',
      label: 'Leitura e análise do histórico de alarmes (memória)',
      group: 'Controle',
      mandatory: true,
    },
  ],
});

const TEMPLATE_FAN_COIL = Object.freeze({
  tipo_template: 'fan_coil',
  version: 1,
  label: 'Fan Coil (NBR 13971)',
  items: [
    {
      id: 'filtros_limpeza',
      label: 'Limpeza dos filtros de ar',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_agua',
      label: 'Limpeza da serpentina (água gelada/quente)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'turbina_motor',
      label: 'Inspeção do conjunto turbina + motor (folga, lubrificação)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'correia_polia',
      label: 'Tensão e estado da correia (se aplicável)',
      group: 'Mecânico',
      mandatory: false,
    },
    {
      id: 'isolamento_termico',
      label: 'Estado do isolamento térmico das tubulações',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'dreno_bandeja',
      label: 'Bandeja e dreno de condensado (vazão, vedação)',
      group: 'Mecânico',
      mandatory: true,
    },

    {
      id: 'valvula_2vias',
      label: 'Funcionamento da válvula 2 ou 3 vias',
      group: 'Hidráulico',
      mandatory: true,
    },
    {
      id: 'vazamento_hidraulico',
      label: 'Inspeção de vazamento hidráulico (conexões, válvulas)',
      group: 'Hidráulico',
      mandatory: true,
    },
    {
      id: 'temperatura_entrada_agua',
      label: 'Temperatura de entrada da água (registro)',
      group: 'Hidráulico',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },

    {
      id: 'tensao_alimentacao',
      label: 'Tensão de alimentação dentro da faixa de placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    {
      id: 'corrente_motor',
      label: 'Corrente do motor x placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'A',
    },
    { id: 'aterramento', label: 'Aterramento da carcaça', group: 'Elétrico', mandatory: true },
    {
      id: 'conexoes_eletricas',
      label: 'Reaperto de conexões elétricas',
      group: 'Elétrico',
      mandatory: true,
    },

    {
      id: 'temperatura_insuflamento',
      label: 'Temperatura de insuflamento conforme setpoint',
      group: 'Operacional',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
  ],
});

const TEMPLATE_CHILLER = Object.freeze({
  tipo_template: 'chiller',
  version: 1,
  label: 'Chiller (NBR 13971)',
  items: [
    // Compressor
    {
      id: 'compressor_corrente',
      label: 'Corrente nominal x placa em todos compressores',
      group: 'Compressor',
      mandatory: true,
      measurable: true,
      unit: 'A',
    },
    {
      id: 'compressor_oleo_nivel',
      label: 'Nível de óleo nos compressores (visor)',
      group: 'Compressor',
      mandatory: true,
    },
    {
      id: 'compressor_oleo_cor',
      label: 'Cor e aspecto do óleo (sinal de queima)',
      group: 'Compressor',
      mandatory: false,
    },
    {
      id: 'compressor_vibracao',
      label: 'Vibração e ruído anormal nos compressores',
      group: 'Compressor',
      mandatory: true,
    },
    {
      id: 'compressor_capacidade',
      label: 'Funcionamento dos estágios de capacidade',
      group: 'Compressor',
      mandatory: true,
    },

    // Trocadores
    {
      id: 'evaporador_tubos',
      label: 'Inspeção dos tubos do evaporador (incrustação)',
      group: 'Trocadores',
      mandatory: true,
    },
    {
      id: 'condensador_tubos',
      label: 'Inspeção dos tubos do condensador (incrustação)',
      group: 'Trocadores',
      mandatory: true,
    },
    {
      id: 'limpeza_quimica_evidencia',
      label: 'Necessidade de limpeza química — sim/não',
      group: 'Trocadores',
      mandatory: false,
    },

    // Hidráulico
    {
      id: 'bomba_agua_gelada',
      label: 'Funcionamento da bomba de água gelada',
      group: 'Hidráulico',
      mandatory: true,
    },
    {
      id: 'bomba_condensacao',
      label: 'Funcionamento da bomba de condensação',
      group: 'Hidráulico',
      mandatory: true,
    },
    {
      id: 'pressao_diferencial_evap',
      label: 'Pressão diferencial no evaporador',
      group: 'Hidráulico',
      mandatory: true,
      measurable: true,
      unit: 'kPa',
    },
    {
      id: 'pressao_diferencial_cond',
      label: 'Pressão diferencial no condensador',
      group: 'Hidráulico',
      mandatory: true,
      measurable: true,
      unit: 'kPa',
    },
    {
      id: 'tratamento_agua',
      label: 'Tratamento da água (pH, condutividade, biocida)',
      group: 'Hidráulico',
      mandatory: true,
    },

    // Refrigeração
    {
      id: 'pressao_alta',
      label: 'Pressão de descarga em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'pressao_baixa',
      label: 'Pressão de sucção em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'temp_agua_gelada_saida',
      label: 'Temperatura de saída da água gelada',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'temp_agua_condensada_entrada',
      label: 'Temperatura de entrada da água de condensação',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'subresfriamento',
      label: 'Sub-resfriamento na linha de líquido',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'vazamento_inspecao',
      label: 'Inspeção de vazamento de refrigerante',
      group: 'Refrigeração',
      mandatory: true,
    },

    // Elétrico/Controle
    {
      id: 'tensao_trifasica',
      label: 'Tensão trifásica equilibrada',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    {
      id: 'protecoes_eletricas',
      label: 'Atuação dos disjuntores e proteções',
      group: 'Elétrico',
      mandatory: true,
    },
    { id: 'aterramento', label: 'Aterramento da unidade', group: 'Elétrico', mandatory: true },
    {
      id: 'controlador_setpoints',
      label: 'Setpoints e safeties no controlador (registro)',
      group: 'Controle',
      mandatory: true,
    },
    {
      id: 'historico_alarmes',
      label: 'Histórico de alarmes (memória do controlador)',
      group: 'Controle',
      mandatory: true,
    },
  ],
});

const TEMPLATE_SELF_CONTAINED = Object.freeze({
  tipo_template: 'self_contained',
  version: 1,
  label: 'Self Contained / Roof Top (NBR 13971)',
  items: [
    {
      id: 'filtros_limpeza',
      label: 'Limpeza ou troca dos filtros de ar',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_evap',
      label: 'Limpeza da serpentina evaporadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'serpentina_cond',
      label: 'Limpeza da serpentina condensadora',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'ventilador_evap',
      label: 'Inspeção do ventilador evaporador (turbina + motor)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'ventilador_cond',
      label: 'Inspeção do ventilador condensador (hélice + motor)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'correia_tensao',
      label: 'Tensão e estado das correias (se aplicável)',
      group: 'Mecânico',
      mandatory: false,
    },
    {
      id: 'lubrificacao_mancais',
      label: 'Lubrificação dos mancais conforme PMOC',
      group: 'Mecânico',
      mandatory: false,
    },
    {
      id: 'dreno_funcional',
      label: 'Dreno e bandeja de condensado',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'gabinete_isolamento',
      label: 'Gabinete e isolamento térmico interno',
      group: 'Mecânico',
      mandatory: false,
    },

    {
      id: 'compressor_corrente',
      label: 'Corrente do(s) compressor(es) x placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'A',
    },
    {
      id: 'tensao_trifasica',
      label: 'Tensão trifásica equilibrada',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    { id: 'aterramento', label: 'Aterramento da unidade', group: 'Elétrico', mandatory: true },
    {
      id: 'protecoes_eletricas',
      label: 'Disjuntores e proteções térmicas',
      group: 'Elétrico',
      mandatory: true,
    },
    {
      id: 'conexoes_eletricas',
      label: 'Reaperto de conexões elétricas',
      group: 'Elétrico',
      mandatory: true,
    },

    {
      id: 'pressao_alta',
      label: 'Pressão de descarga em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'pressao_baixa',
      label: 'Pressão de sucção em regime',
      group: 'Refrigeração',
      mandatory: true,
      measurable: true,
      unit: 'psi',
    },
    {
      id: 'vazamento_inspecao',
      label: 'Inspeção de vazamento de refrigerante',
      group: 'Refrigeração',
      mandatory: true,
    },

    {
      id: 'damper_freshair',
      label: 'Funcionamento do damper de ar externo (se houver)',
      group: 'Operacional',
      mandatory: false,
    },
    {
      id: 'temperatura_insuflamento',
      label: 'Temperatura de insuflamento conforme setpoint',
      group: 'Operacional',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
  ],
});

// Fallback genérico — pra tipos não-mapeados (Câmara Fria, Dry Cooler,
// "Outro", etc). Cobre o mínimo NBR sem entrar em específico.
const TEMPLATE_GENERIC = Object.freeze({
  tipo_template: 'generic',
  version: 1,
  label: 'Manutenção Preventiva (genérico NBR 13971)',
  items: [
    {
      id: 'limpeza_geral',
      label: 'Limpeza geral do equipamento',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'inspecao_visual',
      label: 'Inspeção visual (corrosão, ruído, vibração)',
      group: 'Mecânico',
      mandatory: true,
    },
    {
      id: 'lubrificacao',
      label: 'Lubrificação de mancais e partes móveis',
      group: 'Mecânico',
      mandatory: false,
    },
    {
      id: 'tensao_alimentacao',
      label: 'Tensão de alimentação dentro da faixa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'V',
    },
    {
      id: 'corrente_consumo',
      label: 'Corrente de consumo x placa',
      group: 'Elétrico',
      mandatory: true,
      measurable: true,
      unit: 'A',
    },
    {
      id: 'aterramento',
      label: 'Aterramento e continuidade da carcaça',
      group: 'Elétrico',
      mandatory: true,
    },
    {
      id: 'conexoes_eletricas',
      label: 'Reaperto de conexões elétricas',
      group: 'Elétrico',
      mandatory: true,
    },
    {
      id: 'temperatura_operacao',
      label: 'Temperatura de operação conforme projeto',
      group: 'Operacional',
      mandatory: true,
      measurable: true,
      unit: '°C',
    },
    {
      id: 'vazamento_inspecao',
      label: 'Inspeção de vazamento (refrigerante/água/óleo)',
      group: 'Operacional',
      mandatory: true,
    },
  ],
});

const ALL_TEMPLATES = Object.freeze({
  split_hi_wall: TEMPLATE_SPLIT_HI_WALL,
  split_cassette: TEMPLATE_SPLIT_CASSETTE,
  split_piso_teto: TEMPLATE_SPLIT_PISO_TETO,
  vrf: TEMPLATE_VRF,
  fan_coil: TEMPLATE_FAN_COIL,
  chiller: TEMPLATE_CHILLER,
  self_contained: TEMPLATE_SELF_CONTAINED,
  generic: TEMPLATE_GENERIC,
});

/** Retorna o template apropriado pra um tipo de equipamento. */
export function getChecklistTemplate(tipoEquip) {
  const key = EQUIP_TIPO_TO_TEMPLATE[String(tipoEquip || '').trim()] || 'generic';
  return ALL_TEMPLATES[key];
}

/** Retorna template por chave (ex: pra renderizar checklist persistido). */
export function getTemplateByKey(key) {
  return ALL_TEMPLATES[key] || ALL_TEMPLATES.generic;
}

/** Lista todos os templates (útil pra seleção manual num futuro). */
export function listTemplates() {
  return Object.values(ALL_TEMPLATES);
}

/**
 * Cria um checklist vazio (todos items com status null) pronto pra
 * preenchimento. Usado no init do form quando o user expande o accordion.
 */
export function buildEmptyChecklist(tipoEquip) {
  const tpl = getChecklistTemplate(tipoEquip);
  return {
    tipo_template: tpl.tipo_template,
    version: tpl.version,
    items: tpl.items.map((item) => {
      const base = {
        id: item.id,
        status: null, // 'ok' | 'fail' | 'na' | null
        obs: '',
      };
      // PMOC Fase 4: items measurable nascem com measure: null (vazio).
      // Preenchido por setChecklistItemMeasure quando user digita valor.
      if (item.measurable) {
        base.measure = null; // { value: number, unit: string } quando preenchido
      }
      return base;
    }),
  };
}

/**
 * PMOC Fase 4: helper de formatação pra display/PDF.
 * Aceita numero, string numérica ou null. Retorna "{valor} {unit}" ou "".
 * Usa vírgula como separador decimal (pt-BR).
 */
export function formatMeasure(measure) {
  if (!measure || measure.value == null || measure.value === '') return '';
  const n = Number(measure.value);
  if (!Number.isFinite(n)) return '';
  // Display compacto: integer fica sem casa decimal, fracionário com até 2.
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  const display = formatted.replace('.', ',');
  return measure.unit ? `${display} ${measure.unit}` : display;
}

/**
 * Verifica se um checklist preenchido tem todos os items obrigatórios
 * marcados (qualquer status, exceto null). Retorna { complete, missing }.
 */
export function validateChecklist(checklist) {
  if (!checklist || !checklist.tipo_template) {
    return { complete: false, missing: [], reason: 'empty' };
  }
  const tpl = getTemplateByKey(checklist.tipo_template);
  const itemMap = new Map((checklist.items || []).map((i) => [i.id, i]));
  const missing = tpl.items
    .filter((i) => i.mandatory)
    .filter((i) => !itemMap.get(i.id) || itemMap.get(i.id).status == null)
    .map((i) => i.label);
  return { complete: missing.length === 0, missing };
}

/**
 * Conta resumo do checklist: quantos OK / FAIL / NA / pendentes.
 * Útil pra mostrar progresso no form e no card do registro.
 */
export function summarizeChecklist(checklist) {
  if (!checklist || !Array.isArray(checklist.items)) {
    return { ok: 0, fail: 0, na: 0, pending: 0, total: 0 };
  }
  const total = checklist.items.length;
  let ok = 0,
    fail = 0,
    na = 0,
    pending = 0;
  checklist.items.forEach((i) => {
    if (i.status === 'ok') ok += 1;
    else if (i.status === 'fail') fail += 1;
    else if (i.status === 'na') na += 1;
    else pending += 1;
  });
  return { ok, fail, na, pending, total };
}
