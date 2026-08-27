/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 1,000+ Element Hierarchical Industrial Espresso Machine Topology
 * Полная многоуровневая инженерная схема коммерческой мультибойлерной кофемашины
 * с надсистемой, 9 подсистемами (водоподготовка, гидравлика, бойлеры, группы E61,
 * помол, пар, промышленный ECU, 3-фазное питание 380V, автомойка CIP)
 * и вложенными под-подсистемами профилирования давления.
 */

import { BlockNode, EdgeConnection, SubcircuitDefinition, Port, PortSide, PortDataType } from '../types';
import { PresetTopology } from './presets';

function createPort(id: string, name: string, type: 'input' | 'output', side: PortSide, dataType: PortDataType = 'signal'): Port {
  return {
    id,
    name,
    type,
    side,
    placementMode: 'adaptive',
    dataType,
  };
}

export function generateCoffeeMachinePreset(): PresetTopology {
  const subcircuits: Record<string, SubcircuitDefinition> = {};

  // =========================================================================
  // 1. ПОДСХЕМА: ВОДОПОДГОТОВКА И ФИЛЬТРАЦИЯ (Water Treatment & RO Pre-Prep)
  // 58 узлов + 70 связей = 128 элементов
  // =========================================================================
  const waterNodes: BlockNode[] = [];
  const waterEdges: EdgeConnection[] = [];

  const waterBlocksDef = [
    { id: 'wt_mains_in', title: 'Вход Водопровода', sub: '3/8" BSP (1-6 bar)', cat: 'source', color: '#0284c7' },
    { id: 'wt_sediment_5u', title: 'Механический Фильтр 5µm', sub: 'Полипропилен', cat: 'processor', color: '#0369a1' },
    { id: 'wt_carbon_block', title: 'Угольный Карбон-Блок', sub: 'Удаление хлора и запахов', cat: 'processor', color: '#0369a1' },
    { id: 'wt_pressure_reg', title: 'Редуктор Давления Входа', sub: 'Стабилизация 2.5 bar', cat: 'processor', color: '#0284c7' },
    { id: 'wt_solenoid_in', title: 'Впускной Клапан Воды', sub: 'Э/М Соленоид 24V DC', cat: 'logic', color: '#8b5cf6' },
    { id: 'wt_water_meter', title: 'Счетчик Общего Расхода', sub: 'Импульсный расходомер', cat: 'processor', color: '#10b981' },
    { id: 'wt_softener_ion', title: 'Ионообменный Умягчитель', sub: 'Катионная смола (dH < 4°)', cat: 'storage', color: '#0284c7' },
    { id: 'wt_tds_sensor_in', title: 'Датчик Минерализации TDS 1', sub: 'Входная электропроводность', cat: 'sink', color: '#10b981' },
    { id: 'wt_ro_booster', title: 'Бустерный Насос RO', sub: 'Повышение до 7.0 bar', cat: 'processor', color: '#0ea5e9' },
    { id: 'wt_ro_membrane', title: 'RO Мембрана 150 GPD', sub: 'Обратный осмос 98%', cat: 'processor', color: '#0284c7' },
    { id: 'wt_remineralizer', title: 'Реминерализатор Mg/Ca', sub: 'Баланс вкуса SCAA (120 ppm)', cat: 'storage', color: '#38bdf8' },
    { id: 'wt_uv_sterilizer', title: 'УФ-Стерилизатор 254nm', sub: 'Бактерицидный контур 11W', cat: 'processor', color: '#a855f7' },
    { id: 'wt_buffer_tank', title: 'Гидроаккумулятор 12L', sub: 'Пищевая мембрана EPDM', cat: 'storage', color: '#0369a1' },
    { id: 'wt_tank_press_sw', title: 'Прессостат Бака Буфера', sub: 'Отключение бустера 4.2 bar', cat: 'logic', color: '#f59e0b' },
    { id: 'wt_tds_sensor_out', title: 'Датчик TDS Чистой Воды', sub: 'Контроль готовой воды', cat: 'sink', color: '#10b981' },
    { id: 'wt_temp_sensor_in', title: 'Термодатчик Входа NTC', sub: 'Температура холодной воды', cat: 'sink', color: '#10b981' },
    { id: 'wt_drain_flush_v', title: 'Клапан Автопромывки RO', sub: 'Дренажный соленоид', cat: 'logic', color: '#ef4444' },
    { id: 'wt_filter_bypass', title: 'Байпасный Вентиль', sub: 'Ручной сервисный обход', cat: 'processor', color: '#64748b' },
  ];

  for (let i = 0; i < 40; i++) {
    const idx = i + 1;
    waterBlocksDef.push({
      id: `wt_aux_filter_stage_${idx}`,
      title: `Ступень Доочистки #${idx}`,
      sub: `Тонкая селекция ионов K/Na/Mg [St-${idx}]`,
      cat: 'processor',
      color: '#0284c7',
    });
  }

  waterBlocksDef.forEach((def, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    waterNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_w`, 'H2O_IN', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_ctrl`, 'CTRL', 'input', 'top', 'signal'),
      ],
      outputs: [
        createPort(`${def.id}_out_w`, 'H2O_OUT', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_stat`, 'STATUS', 'output', 'bottom', 'bus'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < waterNodes.length - 1; i++) {
    waterEdges.push({
      id: `e_wt_serial_${i}`,
      sourceBlockId: waterNodes[i].id,
      sourcePortId: `${waterNodes[i].id}_out_w`,
      targetBlockId: waterNodes[i + 1].id,
      targetPortId: `${waterNodes[i + 1].id}_in_w`,
      color: '#38bdf8',
      label: `Гидромагистраль H2O [${i + 1}]`,
    });
    if (i % 2 === 0 && i + 2 < waterNodes.length) {
      waterEdges.push({
        id: `e_wt_ctrl_${i}`,
        sourceBlockId: waterNodes[i].id,
        sourcePortId: `${waterNodes[i].id}_out_stat`,
        targetBlockId: waterNodes[i + 2].id,
        targetPortId: `${waterNodes[i + 2].id}_in_ctrl`,
        color: '#10b981',
        label: `Сенсорная шина S_${i}`,
      });
    }
  }

  subcircuits['sub_water_prep'] = {
    id: 'sub_water_prep',
    name: '1. Водоподготовка & Фильтрация (RO System)',
    description: 'Система очистки, реминерализации, стабилизации давления и контроля TDS поступающей воды.',
    category: 'storage',
    externalInputs: [
      { id: 'ext_wt_mains', name: 'MAINS_WATER_IN', type: 'input', side: 'left', internalNodeId: 'wt_mains_in', internalPortId: 'wt_mains_in_in_w' },
      { id: 'ext_wt_ctrl', name: 'ECU_VALVE_ENABLE', type: 'input', side: 'top', internalNodeId: 'wt_solenoid_in', internalPortId: 'wt_solenoid_in_in_ctrl' },
    ],
    externalOutputs: [
      { id: 'ext_wt_clean_out', name: 'PURE_WATER_OUT (2.5 bar)', type: 'output', side: 'right', internalNodeId: 'wt_buffer_tank', internalPortId: 'wt_buffer_tank_out_w' },
      { id: 'ext_wt_tds_telemetry', name: 'TDS_TELEMETRY_BUS', type: 'output', side: 'right', internalNodeId: 'wt_tds_sensor_out', internalPortId: 'wt_tds_sensor_out_out_stat' },
      { id: 'ext_wt_drain', name: 'BRINE_DRAIN_OUT', type: 'output', side: 'bottom', internalNodeId: 'wt_drain_flush_v', internalPortId: 'wt_drain_flush_v_out_w' },
    ],
    nodes: waterNodes,
    edges: waterEdges,
  };

  // =========================================================================
  // 2. ПОДСХЕМА: ГИДРАВЛИКА & РОТАЦИОННАЯ ПОМПА (Pumps & Pressure Trajectory)
  // 52 узла + 51 связь = 103 элемента
  // =========================================================================
  const pumpNodes: BlockNode[] = [];
  const pumpEdges: EdgeConnection[] = [];

  const pumpBlocksDef = [
    { id: 'pmp_in_manifold', title: 'Входной Коллектор', sub: 'Распределитель 3/8"', cat: 'source', color: '#0369a1' },
    { id: 'pmp_rotary_main', title: 'Ротационная Помпа Procon', sub: '200 L/h, Fluid-o-Tech', cat: 'processor', color: '#0284c7' },
    { id: 'pmp_motor_ac', title: 'Электродвигатель 350W', sub: 'Бесщеточный инверторный', cat: 'processor', color: '#6366f1' },
    { id: 'pmp_opv_valve', title: 'Клапан Сброса OPV', sub: 'Калибровка 9.2 bar', cat: 'logic', color: '#f59e0b' },
    { id: 'pmp_expansion_v', title: 'Расширительный Клапан', sub: 'Защита от терморасширения 12b', cat: 'logic', color: '#ef4444' },
    { id: 'pmp_press_trans_out', title: 'Датчик Давления 0-16 bar', sub: 'Пьезорезистивный 4-20mA', cat: 'sink', color: '#10b981' },
    { id: 'pmp_check_valve_1', title: 'Обратный Клапан 1', sub: 'Предотвращение противотока', cat: 'processor', color: '#64748b' },
    { id: 'pmp_check_valve_2', title: 'Обратный Клапан 2', sub: 'Двойная гидроизоляция', cat: 'processor', color: '#64748b' },
    { id: 'pmp_pulsation_damp', title: 'Демпфер Пульсаций', sub: 'Сглаживание гидроударов', cat: 'storage', color: '#0369a1' },
    { id: 'pmp_distrib_manifold', title: 'Главный Манифольд', sub: 'Выходы на 4 группы и бойлер', cat: 'processor', color: '#0284c7' },
  ];

  for (let i = 0; i < 42; i++) {
    const idx = i + 1;
    pumpBlocksDef.push({
      id: `pmp_aux_channel_${idx}`,
      title: `Гидролиния & Клапан Канала #${idx}`,
      sub: `Электрогидравлический контур H-${idx} (9.0 bar)`,
      cat: 'processor',
      color: '#0284c7',
    });
  }

  pumpBlocksDef.forEach((def, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    pumpNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_p`, 'HYDR_IN', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_sig`, 'RPM_CTRL', 'input', 'top', 'clock'),
      ],
      outputs: [
        createPort(`${def.id}_out_p`, 'HYDR_9BAR', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_tele`, 'PRESS_SIG', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < pumpNodes.length - 1; i++) {
    pumpEdges.push({
      id: `e_pmp_hyd_${i}`,
      sourceBlockId: pumpNodes[i].id,
      sourcePortId: `${pumpNodes[i].id}_out_p`,
      targetBlockId: pumpNodes[i + 1].id,
      targetPortId: `${pumpNodes[i + 1].id}_in_p`,
      color: '#0284c7',
      label: `Напорная линия 9 bar [${i + 1}]`,
    });
  }

  subcircuits['sub_pumping_hydraulic'] = {
    id: 'sub_pumping_hydraulic',
    name: '2. Ротационная Помпа & Гидравлический Тракт',
    description: 'Нагнетание рабочего давления экстракции 9 bar, демпфирование пульсаций и гидравлическое распределение.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_pmp_water_in', name: 'H2O_INPUT (2.5 bar)', type: 'input', side: 'left', internalNodeId: 'pmp_in_manifold', internalPortId: 'pmp_in_manifold_in_p' },
      { id: 'ext_pmp_inverter_pwm', name: 'MOTOR_SPEED_PWM', type: 'input', side: 'top', internalNodeId: 'pmp_motor_ac', internalPortId: 'pmp_motor_ac_in_sig' },
    ],
    externalOutputs: [
      { id: 'ext_pmp_9bar_brew', name: 'PUMP_9BAR_TO_GROUPS', type: 'output', side: 'right', internalNodeId: 'pmp_distrib_manifold', internalPortId: 'pmp_distrib_manifold_out_p' },
      { id: 'ext_pmp_pressure_sig', name: 'ANALOG_PRESSURE_FEEDBACK', type: 'output', side: 'bottom', internalNodeId: 'pmp_press_trans_out', internalPortId: 'pmp_press_trans_out_out_tele' },
    ],
    nodes: pumpNodes,
    edges: pumpEdges,
  };

  // =========================================================================
  // 3. ПОДСХЕМА: ПАРОВОЙ БОЙЛЕР И ТЕРМОДИНАМИКА (Steam Boiler System)
  // 48 узлов + 47 связей = 95 элементов
  // =========================================================================
  const steamNodes: BlockNode[] = [];
  const steamEdges: EdgeConnection[] = [];

  const steamBlocksDef = [
    { id: 'stm_boiler_vessel', title: 'Паровой Бойлер 14L', sub: 'Нержавеющая сталь AISI 316L', cat: 'storage', color: '#ea580c' },
    { id: 'stm_heater_4500w', title: 'ТЭН Нагревательный 4.5kW', sub: '3-фазный спиральный нагреватель', cat: 'processor', color: '#dc2626' },
    { id: 'stm_pressostat', title: 'Электронный Прессостат', sub: 'Уставка 1.8 - 2.1 bar', cat: 'logic', color: '#f59e0b' },
    { id: 'stm_level_probe_high', title: 'Датчик Уровня High', sub: 'Кондуктометрический зонд', cat: 'sink', color: '#10b981' },
    { id: 'stm_level_probe_low', title: 'Датчик Уровня Low', sub: 'Защита ТЭНа от сухого хода', cat: 'sink', color: '#10b981' },
    { id: 'stm_autofill_solenoid', title: 'Соленоид Автодолива 24V', sub: 'Подача воды в бойлер', cat: 'logic', color: '#8b5cf6' },
    { id: 'stm_safety_valve_25', title: 'Клапан Аварийного Сброса', sub: 'Пружинный сброс 2.5 bar', cat: 'logic', color: '#ef4444' },
    { id: 'stm_vacuum_breaker', title: 'Антивакуумный Клапан', sub: 'Предотвращение сжатия при остывании', cat: 'processor', color: '#64748b' },
    { id: 'stm_pt100_temp', title: 'Термопреобразователь PT100', sub: 'Точность ±0.1°C (125-140°C)', cat: 'sink', color: '#10b981' },
    { id: 'stm_hx_injector', title: 'Теплообменник (HX Loop)', sub: 'Предпрогрев воды для групп', cat: 'processor', color: '#ea580c' },
  ];

  for (let i = 0; i < 38; i++) {
    const idx = i + 1;
    steamBlocksDef.push({
      id: `stm_aux_heat_cell_${idx}`,
      title: `Термодинамический Модуль #${idx}`,
      sub: `Конвекционный контур теплообмена HX-${idx}`,
      cat: 'processor',
      color: '#ea580c',
    });
  }

  steamBlocksDef.forEach((def, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    steamNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_w`, 'H2O_IN', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_pwr`, 'SSR_PWR', 'input', 'top', 'power'),
      ],
      outputs: [
        createPort(`${def.id}_out_stm`, 'STEAM_2BAR', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_t`, 'TEMP_RES', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < steamNodes.length - 1; i++) {
    steamEdges.push({
      id: `e_stm_pipe_${i}`,
      sourceBlockId: steamNodes[i].id,
      sourcePortId: `${steamNodes[i].id}_out_stm`,
      targetBlockId: steamNodes[i + 1].id,
      targetPortId: `${steamNodes[i + 1].id}_in_w`,
      color: '#ea580c',
      label: `Паровой контур 135°C [${i + 1}]`,
    });
  }

  subcircuits['sub_steam_boiler'] = {
    id: 'sub_steam_boiler',
    name: '3. Сервисный & Паровой Бойлер 14L',
    description: 'Генерация сухого насыщенного пара для стимеров, кран кипятка и предварительный подогрев эспрессо-контуров.',
    category: 'storage',
    externalInputs: [
      { id: 'ext_stm_fill_in', name: 'AUTOFILL_WATER_IN', type: 'input', side: 'left', internalNodeId: 'stm_autofill_solenoid', internalPortId: 'stm_autofill_solenoid_in_w' },
      { id: 'ext_stm_ssr_drive', name: 'SSR_HEATER_DUTY', type: 'input', side: 'top', internalNodeId: 'stm_heater_4500w', internalPortId: 'stm_heater_4500w_in_pwr' },
    ],
    externalOutputs: [
      { id: 'ext_stm_steam_out', name: 'DRY_STEAM_2BAR', type: 'output', side: 'right', internalNodeId: 'stm_boiler_vessel', internalPortId: 'stm_boiler_vessel_out_stm' },
      { id: 'ext_stm_preheat_out', name: 'PREHEATED_WATER_HX (85°C)', type: 'output', side: 'right', internalNodeId: 'stm_hx_injector', internalPortId: 'stm_hx_injector_out_stm' },
      { id: 'ext_stm_pt100_data', name: 'BOILER_TEMP_PT100', type: 'output', side: 'bottom', internalNodeId: 'stm_pt100_temp', internalPortId: 'stm_pt100_temp_out_t' },
    ],
    nodes: steamNodes,
    edges: steamEdges,
  };

  // =========================================================================
  // 4. ПОДСХЕМА: ЗАВАРОЧНЫЕ ГРУППЫ & МУЛЬТИБОЙЛЕРЫ (Multi-Group Extraction)
  // 71 узел + 70 связей = 141 элемент
  // =========================================================================
  const brewGroupNodes: BlockNode[] = [];
  const brewGroupEdges: EdgeConnection[] = [];

  const groupBlocksDef = [
    { id: 'grp_ind_boiler_1', title: 'Групповой Бойлер 1 (0.9L)', sub: 'PID 93.5°C, 800W', cat: 'processor', color: '#d97706' },
    { id: 'grp_ind_boiler_2', title: 'Групповой Бойлер 2 (0.9L)', sub: 'PID 93.5°C, 800W', cat: 'processor', color: '#d97706' },
    { id: 'grp_ind_boiler_3', title: 'Групповой Бойлер 3 (0.9L)', sub: 'PID 93.5°C, 800W', cat: 'processor', color: '#d97706' },
    { id: 'grp_ind_boiler_4', title: 'Групповой Бойлер 4 (0.9L)', sub: 'PID 93.5°C, 800W', cat: 'processor', color: '#d97706' },
    { id: 'grp_flowmeter_1', title: 'Флоуметр Digmesa G1', sub: '2300 имп/литр', cat: 'sink', color: '#10b981' },
    { id: 'grp_flowmeter_2', title: 'Флоуметр Digmesa G2', sub: '2300 имп/литр', cat: 'sink', color: '#10b981' },
    { id: 'grp_flowmeter_3', title: 'Флоуметр Digmesa G3', sub: '2300 имп/литр', cat: 'sink', color: '#10b981' },
    { id: 'grp_flowmeter_4', title: 'Флоуметр Digmesa G4', sub: '2300 имп/литр', cat: 'sink', color: '#10b981' },
    { id: 'grp_3way_valve_1', title: '3-Ходовой Клапан E61 #1', sub: 'Сброс давления в дренаж', cat: 'logic', color: '#8b5cf6' },
    { id: 'grp_3way_valve_2', title: '3-Ходовой Клапан E61 #2', sub: 'Сброс давления в дренаж', cat: 'logic', color: '#8b5cf6' },
    { id: 'grp_3way_valve_3', title: '3-Ходовой Клапан E61 #3', sub: 'Сброс давления в дренаж', cat: 'logic', color: '#8b5cf6' },
    { id: 'grp_3way_valve_4', title: '3-Ходовой Клапан E61 #4', sub: 'Сброс давления в дренаж', cat: 'logic', color: '#8b5cf6' },
    { id: 'grp_head_diffuser_1', title: 'Дисперсионная Сетка IMS 1', sub: '200 µm Membrane', cat: 'processor', color: '#64748b' },
    { id: 'grp_head_diffuser_2', title: 'Дисперсионная Сетка IMS 2', sub: '200 µm Membrane', cat: 'processor', color: '#64748b' },
    { id: 'grp_head_diffuser_3', title: 'Дисперсионная Сетка IMS 3', sub: '200 µm Membrane', cat: 'processor', color: '#64748b' },
    { id: 'grp_head_diffuser_4', title: 'Дисперсионная Сетка IMS 4', sub: '200 µm Membrane', cat: 'processor', color: '#64748b' },
    { id: 'grp_portafilter_1', title: 'Портафильтр 58mm G1', sub: 'Корзина VST 18g', cat: 'sink', color: '#f59e0b' },
    { id: 'grp_portafilter_2', title: 'Портафильтр 58mm G2', sub: 'Корзина VST 18g', cat: 'sink', color: '#f59e0b' },
    { id: 'grp_portafilter_3', title: 'Портафильтр 58mm G3', sub: 'Корзина VST 18g', cat: 'sink', color: '#f59e0b' },
    { id: 'grp_portafilter_4', title: 'Портафильтр 58mm G4', sub: 'Корзина VST 18g', cat: 'sink', color: '#f59e0b' },
  ];

  groupBlocksDef.push({
    id: 'grp_profiling_sub',
    title: 'Модуль Flow-Profiling G1',
    sub: 'Шаговый игольчатый клапан & датчик камеры',
    cat: 'processor',
    color: '#a855f7',
  });

  for (let i = 0; i < 50; i++) {
    const idx = i + 1;
    groupBlocksDef.push({
      id: `grp_aux_sensor_node_${idx}`,
      title: `Датчик Давления & Температуры Экстракции #${idx}`,
      sub: `Тонкий мониторинг puck-resistance PR-${idx}`,
      cat: 'processor',
      color: '#d97706',
    });
  }

  groupBlocksDef.forEach((def, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    brewGroupNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      isSubcircuit: def.id === 'grp_profiling_sub',
      subcircuitId: def.id === 'grp_profiling_sub' ? 'sub_group1_profiler' : undefined,
      inputs: [
        createPort(`${def.id}_in_w`, 'WATER_9BAR', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_cmd`, 'BREW_CMD', 'input', 'top', 'signal'),
      ],
      outputs: [
        createPort(`${def.id}_out_cup`, 'ESPRESSO_OUT', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_pulse`, 'FLOW_PULSES', 'output', 'bottom', 'clock'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < brewGroupNodes.length - 1; i++) {
    brewGroupEdges.push({
      id: `e_grp_link_${i}`,
      sourceBlockId: brewGroupNodes[i].id,
      sourcePortId: `${brewGroupNodes[i].id}_out_cup`,
      targetBlockId: brewGroupNodes[i + 1].id,
      targetPortId: `${brewGroupNodes[i + 1].id}_in_w`,
      color: '#d97706',
      label: `Тракт заваривания [${i + 1}]`,
    });
  }

  subcircuits['sub_brew_groups'] = {
    id: 'sub_brew_groups',
    name: '4. Заварочные Группы & Экстракция (4-Group Matrix)',
    description: 'Независимые насыщенные заварочные группы, импульсные флоуметры, 3-ходовые соленоиды и профилирование потока.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_grp_water_feed', name: 'HOT_WATER_FEED_9BAR', type: 'input', side: 'left', internalNodeId: 'grp_ind_boiler_1', internalPortId: 'grp_ind_boiler_1_in_w' },
      { id: 'ext_grp_brew_start', name: 'BREW_BUTTON_TRIGGERS', type: 'input', side: 'top', internalNodeId: 'grp_3way_valve_1', internalPortId: 'grp_3way_valve_1_in_cmd' },
    ],
    externalOutputs: [
      { id: 'ext_grp_espresso_out', name: 'ESPRESSO_STREAM_TO_CUPS', type: 'output', side: 'right', internalNodeId: 'grp_portafilter_4', internalPortId: 'grp_portafilter_4_out_cup' },
      { id: 'ext_grp_flow_telemetry', name: 'FLOW_METER_PULSE_BUS', type: 'output', side: 'bottom', internalNodeId: 'grp_flowmeter_1', internalPortId: 'grp_flowmeter_1_out_pulse' },
    ],
    nodes: brewGroupNodes,
    edges: brewGroupEdges,
  };

  // =========================================================================
  // 5. ВЛОЖЕННАЯ ПОД-ПОДСХЕМА: ПРОФИЛИРОВАНИЕ ДАВЛЕНИЯ ГРУППЫ (Profiler)
  // 25 узлов + 24 связи = 49 элементов
  // =========================================================================
  const profilerNodes: BlockNode[] = [];
  const profilerEdges: EdgeConnection[] = [];

  const profilerBlocksDef = [
    { id: 'prf_stepper_motor', title: 'Шаговый Сервопривод NEMA 17', sub: 'Регулировка сечения 0.01mm', cat: 'processor', color: '#a855f7' },
    { id: 'prf_needle_valve', title: 'Игольчатый Дроссель Рубиновый', sub: 'Диапазон 0-14 ml/s', cat: 'processor', color: '#a855f7' },
    { id: 'prf_chamber_trans', title: 'Датчик Давления в Таблетке', sub: 'Быстрый отклик 1 kHz', cat: 'sink', color: '#10b981' },
    { id: 'prf_pid_profile_loop', title: 'PID Профиля Давления', sub: 'Pre-infusion -> Peak 9b -> Declining 6b', cat: 'logic', color: '#6366f1' },
    { id: 'prf_dsp_smoothing', title: 'Фильтр Сглаживания Потока', sub: 'Предотвращение каналообразования', cat: 'logic', color: '#3b82f6' },
  ];

  for (let i = 0; i < 20; i++) {
    const idx = i + 1;
    profilerBlocksDef.push({
      id: `prf_aux_step_${idx}`,
      title: `Сегмент Кривой Давления #[P-${idx}]`,
      sub: `Целевая уставка t=${idx * 1.5}s, P=${(3 + (idx % 7)).toFixed(1)} bar`,
      cat: 'processor',
      color: '#a855f7',
    });
  }

  profilerBlocksDef.forEach((def, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    profilerNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_sig`, 'CURVE_IN', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_clk`, 'SYNC', 'input', 'top', 'clock'),
      ],
      outputs: [
        createPort(`${def.id}_out_sig`, 'SERVO_POS', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_stat`, 'FLOW_EST', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < profilerNodes.length - 1; i++) {
    profilerEdges.push({
      id: `e_prf_step_${i}`,
      sourceBlockId: profilerNodes[i].id,
      sourcePortId: `${profilerNodes[i].id}_out_sig`,
      targetBlockId: profilerNodes[i + 1].id,
      targetPortId: `${profilerNodes[i + 1].id}_in_sig`,
      color: '#a855f7',
      label: `Профиль шага [${i + 1}]`,
    });
  }

  subcircuits['sub_group1_profiler'] = {
    id: 'sub_group1_profiler',
    name: '4.1 Flow-Profiling Actuator (Вложенная Под-подсистема)',
    description: 'Индивидуальное динамическое профилирование расхода и давления экстракции в реальном времени.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_prf_curve_sel', name: 'PROFILE_CURVE_DATA', type: 'input', side: 'left', internalNodeId: 'prf_stepper_motor', internalPortId: 'prf_stepper_motor_in_sig' },
    ],
    externalOutputs: [
      { id: 'ext_prf_actual_p', name: 'PUCK_CHAMBER_PRESSURE', type: 'output', side: 'right', internalNodeId: 'prf_chamber_trans', internalPortId: 'prf_chamber_trans_out_sig' },
    ],
    nodes: profilerNodes,
    edges: profilerEdges,
  };

  // =========================================================================
  // 6. ПОДСХЕМА: ГЛАВНЫЙ ПРОМЫШЛЕННЫЙ ECU & PID (Central Controller)
  // 67 узлов + 66 связей = 133 элемента
  // =========================================================================
  const ecuNodes: BlockNode[] = [];
  const ecuEdges: EdgeConnection[] = [];

  const ecuBlocksDef = [
    { id: 'ecu_mcu_main', title: 'STM32H7 Dual-Core 480MHz', sub: 'Промышленный контроллер ECU', cat: 'processor', color: '#6366f1' },
    { id: 'ecu_freertos_kernel', title: 'FreeRTOS Real-Time Kernel', sub: 'Диспетчер задач 1ms tick', cat: 'logic', color: '#4f46e5' },
    { id: 'ecu_adc_ads1248', title: '24-Bit ADC ADS1248', sub: 'Прецизионный опрос PT100/NTC', cat: 'sink', color: '#10b981' },
    { id: 'ecu_ssr_driver_bank', title: 'Драйверная Матрица SSR', sub: 'ШИМ управление 8 нагревателями', cat: 'processor', color: '#ef4444' },
    { id: 'ecu_can_transceiver', title: 'CAN-Bus Трансивер SN65', sub: '1 Mbps бортовая сеть узлов', cat: 'logic', color: '#3b82f6' },
    { id: 'ecu_optocoupler_in', title: 'Опторазвязка Входов 2.5kV', sub: 'Защита от помех сети', cat: 'processor', color: '#64748b' },
    { id: 'ecu_safety_watchdog', title: 'Аппаратный Watchdog TPS38', sub: 'Автоматический сброс при сбое', cat: 'logic', color: '#f59e0b' },
  ];

  for (let i = 0; i < 60; i++) {
    const idx = i + 1;
    ecuBlocksDef.push({
      id: `ecu_io_channel_${idx}`,
      title: `I/O Канал Управления &[IO-${idx}]`,
      sub: `Дискретный / ШИМ выход драйвера Ch-${idx}`,
      cat: 'processor',
      color: '#6366f1',
    });
  }

  ecuBlocksDef.forEach((def, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    ecuNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_d`, 'DATA_IN', 'input', 'left', 'bus'),
        createPort(`${def.id}_in_clk`, 'CLK', 'input', 'top', 'clock'),
      ],
      outputs: [
        createPort(`${def.id}_out_d`, 'DATA_OUT', 'output', 'right', 'bus'),
        createPort(`${def.id}_out_irq`, 'IRQ', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < ecuNodes.length - 1; i++) {
    ecuEdges.push({
      id: `e_ecu_bus_${i}`,
      sourceBlockId: ecuNodes[i].id,
      sourcePortId: `${ecuNodes[i].id}_out_d`,
      targetBlockId: ecuNodes[i + 1].id,
      targetPortId: `${ecuNodes[i + 1].id}_in_d`,
      color: '#6366f1',
      label: `CAN/SPI Bus D_[${i + 1}]`,
    });
  }

  subcircuits['sub_ecu_control'] = {
    id: 'sub_ecu_control',
    name: '5. Центральный Блок Управления (Industrial ECU & PID)',
    description: 'Микроконтроллерный блок управления на STM32H7: обработка датчиков, многоканальные ПИД-регуляторы, управление клапанами и шина CAN.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_ecu_sensors_in', name: 'ALL_SENSOR_FEEDBACK_BUS', type: 'input', side: 'left', internalNodeId: 'ecu_adc_ads1248', internalPortId: 'ecu_adc_ads1248_in_d' },
      { id: 'ext_ecu_ui_commands', name: 'TOUCH_GUI_COMMAND_STREAM', type: 'input', side: 'top', internalNodeId: 'ecu_can_transceiver', internalPortId: 'ecu_can_transceiver_in_d' },
    ],
    externalOutputs: [
      { id: 'ext_ecu_ssr_pwm', name: 'HEATER_PWM_MATRIX_OUT', type: 'output', side: 'right', internalNodeId: 'ecu_ssr_driver_bank', internalPortId: 'ecu_ssr_driver_bank_out_d' },
      { id: 'ext_ecu_valves_drv', name: 'SOLENOID_VALVE_DRIVERS', type: 'output', side: 'right', internalNodeId: 'ecu_mcu_main', internalPortId: 'ecu_mcu_main_out_d' },
      { id: 'ext_ecu_telemetry_out', name: 'BARISTA_TELEMETRY_STREAM', type: 'output', side: 'bottom', internalNodeId: 'ecu_freertos_kernel', internalPortId: 'ecu_freertos_kernel_out_d' },
    ],
    nodes: ecuNodes,
    edges: ecuEdges,
  };

  // =========================================================================
  // 7. ПОДСХЕМА: ПОМОЛ, ДОЗИРОВАНИЕ & ГРАВИМЕТРИЯ (Grinder & Dosing)
  // 40 узлов + 39 связей = 79 элементов
  // =========================================================================
  const grindNodes: BlockNode[] = [];
  const grindEdges: EdgeConnection[] = [];

  const grindBlocksDef = [
    { id: 'grd_hopper_left', title: 'Бункер Зерен Левый 1.5kg', sub: 'Сорт 1: Specialty Ethiopia', cat: 'storage', color: '#78350f' },
    { id: 'grd_hopper_right', title: 'Бункер Зерен Правый 1.5kg', sub: 'Сорт 2: Brazil Blend', cat: 'storage', color: '#78350f' },
    { id: 'grd_burr_set_83mm', title: 'Титановые Жернова 83mm', sub: 'Плоские Red Speed DLC', cat: 'processor', color: '#b45309' },
    { id: 'grd_motor_bldc_900w', title: 'BLDC Двигатель Помола', sub: 'Регулировка RPM 400-1400', cat: 'processor', color: '#6366f1' },
    { id: 'grd_ionizer_plasma', title: 'Плазменный Деионизатор', sub: 'Удаление статики и комков', cat: 'processor', color: '#38bdf8' },
    { id: 'grd_acaia_scale', title: 'Весы Гравиметрии Acaia', sub: 'Точность ±0.05g Real-time', cat: 'sink', color: '#10b981' },
    { id: 'grd_auto_tamper', title: 'Авто-Темпер Puqpress 24V', sub: 'Усилие 10-30kg, ровный угол 0°', cat: 'processor', color: '#f59e0b' },
  ];

  for (let i = 0; i < 33; i++) {
    const idx = i + 1;
    grindBlocksDef.push({
      id: `grd_aux_distrib_${idx}`,
      title: `WDT Распределитель Смеси #[W-${idx}]`,
      sub: `Деагломерация порошка зерна Ch-${idx}`,
      cat: 'processor',
      color: '#b45309',
    });
  }

  grindBlocksDef.forEach((def, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    grindNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_b`, 'BEANS_IN', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_trig`, 'GRIND_CMD', 'input', 'top', 'signal'),
      ],
      outputs: [
        createPort(`${def.id}_out_grd`, 'GROUNDS_OUT', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_wgt`, 'WEIGHT_SIG', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < grindNodes.length - 1; i++) {
    grindEdges.push({
      id: `e_grd_link_${i}`,
      sourceBlockId: grindNodes[i].id,
      sourcePortId: `${grindNodes[i].id}_out_grd`,
      targetBlockId: grindNodes[i + 1].id,
      targetPortId: `${grindNodes[i + 1].id}_in_b`,
      color: '#b45309',
      label: `Тракт зерна [${i + 1}]`,
    });
  }

  subcircuits['sub_grinder_dosing'] = {
    id: 'sub_grinder_dosing',
    name: '6. Помол, Дозирование & Гравиметрия (Grind-by-Weight)',
    description: 'Система помола с жерновами 83mm, деионизатором статики, весами Acaia и автоматическим темпером.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_grd_dose_trigger', name: 'RECIPE_DOSE_WEIGHT (18.5g)', type: 'input', side: 'left', internalNodeId: 'grd_burr_set_83mm', internalPortId: 'grd_burr_set_83mm_in_trig' },
    ],
    externalOutputs: [
      { id: 'ext_grd_tamped_portafilter', name: 'TAMPED_PUCK_TO_GROUP', type: 'output', side: 'right', internalNodeId: 'grd_auto_tamper', internalPortId: 'grd_auto_tamper_out_grd' },
      { id: 'ext_grd_scale_data', name: 'ACTUAL_DOSE_WEIGHT_SIG', type: 'output', side: 'bottom', internalNodeId: 'grd_acaia_scale', internalPortId: 'grd_acaia_scale_out_wgt' },
    ],
    nodes: grindNodes,
    edges: grindEdges,
  };

  // =========================================================================
  // 8. ПОДСХЕМА: ВЗБИВАНИЕ МОЛОКА & АВТОСТИМ (Milk Steam System)
  // 35 узлов + 34 связи = 69 элементов
  // =========================================================================
  const milkNodes: BlockNode[] = [];
  const milkEdges: EdgeConnection[] = [];

  const milkBlocksDef = [
    { id: 'mlk_steam_wand_left', title: 'Трубка Пара Cool-Touch 1', sub: 'Ручной стимер 4 отверстия', cat: 'processor', color: '#38bdf8' },
    { id: 'mlk_autosteam_wand', title: 'Автостимер с Термопарой', sub: 'Автоотключение при 65°C', cat: 'processor', color: '#0284c7' },
    { id: 'mlk_air_injection_v', title: 'Клапан Подмеса Воздуха', sub: 'Регулировка микропены (Latte Art)', cat: 'logic', color: '#8b5cf6' },
    { id: 'mlk_temp_ir_sensor', title: 'Инфракрасный Пирометр Питчера', sub: 'Бесконтактный контроль t°', cat: 'sink', color: '#10b981' },
    { id: 'mlk_pitcher_rinser', title: 'Ополаскиватель Питчеров 4 bar', sub: 'Сенсорная активация', cat: 'processor', color: '#0284c7' },
  ];

  for (let i = 0; i < 30; i++) {
    const idx = i + 1;
    milkBlocksDef.push({
      id: `mlk_aux_steamer_node_${idx}`,
      title: `Форсунка & Эмульгатор Молока #[M-${idx}]`,
      sub: `Тонкая регулировка пара Flow-${idx}`,
      cat: 'processor',
      color: '#38bdf8',
    });
  }

  milkBlocksDef.forEach((def, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    milkNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_s`, 'STEAM_IN', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_air`, 'AIR_IN', 'input', 'top', 'signal'),
      ],
      outputs: [
        createPort(`${def.id}_out_foam`, 'MICROFOAM_OUT', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_t`, 'TEMP_STAT', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < milkNodes.length - 1; i++) {
    milkEdges.push({
      id: `e_mlk_link_${i}`,
      sourceBlockId: milkNodes[i].id,
      sourcePortId: `${milkNodes[i].id}_out_foam`,
      targetBlockId: milkNodes[i + 1].id,
      targetPortId: `${milkNodes[i + 1].id}_in_s`,
      color: '#38bdf8',
      label: `Паровой контур взбивания [${i + 1}]`,
    });
  }

  subcircuits['sub_milk_steam'] = {
    id: 'sub_milk_steam',
    name: '7. Молочная Пена & Автостимер (Microfoam System)',
    description: 'Взбивание глянцевой микропены для латте-арт, пропорциональный подмес воздуха и автоотключение по температуре.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_mlk_steam_source', name: 'STEAM_FROM_BOILER (2 bar)', type: 'input', side: 'left', internalNodeId: 'mlk_autosteam_wand', internalPortId: 'mlk_autosteam_wand_in_s' },
    ],
    externalOutputs: [
      { id: 'ext_mlk_microfoam_pitcher', name: 'VELVET_FOAM_65C', type: 'output', side: 'right', internalNodeId: 'mlk_autosteam_wand', internalPortId: 'mlk_autosteam_wand_out_foam' },
    ],
    nodes: milkNodes,
    edges: milkEdges,
  };

  // =========================================================================
  // 9. ПОДСХЕМА: 3-ФАЗНОЕ ЭЛЕКТРОПИТАНИЕ 380V & БЕЗОПАСНОСТЬ (Power & Safety)
  // 60 узлов + 59 связей = 119 элементов
  // =========================================================================
  const powerNodes: BlockNode[] = [];
  const powerEdges: EdgeConnection[] = [];

  const powerBlocksDef = [
    { id: 'pwr_mains_3phase', title: 'Ввод 3-Фазный 380V / 32A', sub: 'Силовой клеммник L1, L2, L3, N, PE', cat: 'source', color: '#f59e0b' },
    { id: 'pwr_rcbo_breaker', title: 'Дифференциальный Автомат 30mA', sub: 'Защита от токов утечки и КЗ', cat: 'logic', color: '#ef4444' },
    { id: 'pwr_psu_24v_15a', title: 'Импульсный БП 24V DC / 350W', sub: 'Питание клапанов и логики', cat: 'processor', color: '#10b981' },
    { id: 'pwr_psu_5v_isolated', title: 'Изолированный БП 5V / 3.3V', sub: 'Питание микроконтроллера и АЦП', cat: 'processor', color: '#10b981' },
    { id: 'pwr_thermal_fuse_165', title: 'Термопредохранитель 165°C', sub: 'Механический аварийный размыкатель', cat: 'logic', color: '#ef4444' },
  ];

  for (let i = 0; i < 55; i++) {
    const idx = i + 1;
    powerBlocksDef.push({
      id: `pwr_aux_channel_${idx}`,
      title: `Силовая Линия Питания #[PWR-${idx}]`,
      sub: `Твердотельное реле SSR & фильтр Ch-${idx}`,
      cat: 'processor',
      color: '#f59e0b',
    });
  }

  powerBlocksDef.forEach((def, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    powerNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_ac`, 'AC_IN', 'input', 'left', 'power'),
        createPort(`${def.id}_in_ctl`, 'GATE_CTRL', 'input', 'top', 'signal'),
      ],
      outputs: [
        createPort(`${def.id}_out_ac`, 'PWR_OUT', 'output', 'right', 'power'),
        createPort(`${def.id}_out_stat`, 'GND_CHECK', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < powerNodes.length - 1; i++) {
    powerEdges.push({
      id: `e_pwr_bus_${i}`,
      sourceBlockId: powerNodes[i].id,
      sourcePortId: `${powerNodes[i].id}_out_ac`,
      targetBlockId: powerNodes[i + 1].id,
      targetPortId: `${powerNodes[i + 1].id}_in_ac`,
      color: '#f59e0b',
      label: `Силовая шина 380V [${i + 1}]`,
    });
  }

  subcircuits['sub_power_safety'] = {
    id: 'sub_power_safety',
    name: '8. 3-Фазное Питание 380V & Матрица Защиты',
    description: 'Силовая коммутация нагревателей, твердотельные реле SSR, термозащита 165°C и низковольтные изолированные источники 24V/5V.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_pwr_380v_in', name: 'MAINS_380V_3P', type: 'input', side: 'left', internalNodeId: 'pwr_mains_3phase', internalPortId: 'pwr_mains_3phase_in_ac' },
    ],
    externalOutputs: [
      { id: 'ext_pwr_24v_dc', name: '24V_DC_VALVE_BUS', type: 'output', side: 'right', internalNodeId: 'pwr_psu_24v_15a', internalPortId: 'pwr_psu_24v_15a_out_ac' },
      { id: 'ext_pwr_ssr_power', name: 'SSR_POWER_BUS_TO_HEATERS', type: 'output', side: 'right', internalNodeId: 'pwr_rcbo_breaker', internalPortId: 'pwr_rcbo_breaker_out_ac' },
    ],
    nodes: powerNodes,
    edges: powerEdges,
  };

  // =========================================================================
  // 10. ПОДСХЕМА: АВТОМАТИЧЕСКАЯ МОЙКА CIP & ДЕКАЛЬЦИНАЦИЯ (Cleaning CIP)
  // 60 узлов + 59 связей = 119 элементов
  // =========================================================================
  const cipNodes: BlockNode[] = [];
  const cipEdges: EdgeConnection[] = [];

  const cipBlocksDef = [
    { id: 'cip_chemical_injector', title: 'Дозатор Моющего Средства', sub: 'Перистальтический насос Cafiza', cat: 'processor', color: '#10b981' },
    { id: 'cip_ultrasonic_loop', title: 'Ультразвуковой Излучатель 40kHz', sub: 'Разрушение накипи в бойлере', cat: 'processor', color: '#06b6d4' },
    { id: 'cip_backflush_valve', title: 'Клапан Реверсивной Промывки', sub: 'Импульсный гидроудар групп', cat: 'logic', color: '#8b5cf6' },
    { id: 'cip_drain_pump', title: 'Дренажный Откачивающий Насос', sub: 'Высокопроизводительный сброс', cat: 'processor', color: '#ef4444' },
  ];

  for (let i = 0; i < 56; i++) {
    const idx = i + 1;
    cipBlocksDef.push({
      id: `cip_aux_valve_node_${idx}`,
      title: `Клапан Промывки Контура #[CIP-${idx}]`,
      sub: `Автоматический цикл промывки C-${idx}`,
      cat: 'processor',
      color: '#10b981',
    });
  }

  cipBlocksDef.forEach((def, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    cipNodes.push({
      id: def.id,
      title: def.title,
      subtitle: def.sub,
      category: def.cat as any,
      x: 60 + col * 220,
      y: 60 + row * 130,
      width: 190,
      height: 85,
      inputs: [
        createPort(`${def.id}_in_w`, 'CIP_IN', 'input', 'left', 'signal'),
        createPort(`${def.id}_in_cmd`, 'CLEAN_TRIG', 'input', 'top', 'signal'),
      ],
      outputs: [
        createPort(`${def.id}_out_w`, 'CIP_OUT', 'output', 'right', 'signal'),
        createPort(`${def.id}_out_drain`, 'DRAIN_WASTE', 'output', 'bottom', 'signal'),
      ],
      color: def.color,
    });
  });

  for (let i = 0; i < cipNodes.length - 1; i++) {
    cipEdges.push({
      id: `e_cip_link_${i}`,
      sourceBlockId: cipNodes[i].id,
      sourcePortId: `${cipNodes[i].id}_out_w`,
      targetBlockId: cipNodes[i + 1].id,
      targetPortId: `${cipNodes[i + 1].id}_in_w`,
      color: '#10b981',
      label: `Линия промывки CIP [${i + 1}]`,
    });
  }

  subcircuits['sub_cleaning_cip'] = {
    id: 'sub_cleaning_cip',
    name: '9. Автомойка CIP & Ультразвуковая Декальцинация',
    description: 'Безразборная промывка контуров заваривания (Backflush), дозирование моющих средств и ультразвуковая очистка от кальция.',
    category: 'processor',
    externalInputs: [
      { id: 'ext_cip_trig_in', name: 'CIP_SCHEDULE_TRIGGER', type: 'input', side: 'left', internalNodeId: 'cip_chemical_injector', internalPortId: 'cip_chemical_injector_in_cmd' },
    ],
    externalOutputs: [
      { id: 'ext_cip_flush_out', name: 'CLEANING_FLUID_TO_GROUPS', type: 'output', side: 'right', internalNodeId: 'cip_backflush_valve', internalPortId: 'cip_backflush_valve_out_w' },
      { id: 'ext_cip_drain_out', name: 'WASTE_DRAIN_OUTPUT', type: 'output', side: 'bottom', internalNodeId: 'cip_drain_pump', internalPortId: 'cip_drain_pump_out_drain' },
    ],
    nodes: cipNodes,
    edges: cipEdges,
  };

  // =========================================================================
  // НАДСХЕМА (ROOT LEVEL): ГЛАВНАЯ СИСТЕМА КОФЕМАШИНЫ
  // 10 главных подсистем
  // =========================================================================
  const rootNodes: BlockNode[] = [
    {
      id: 'root_water_prep',
      title: '1. Водоподготовка & Фильтрация (RO System)',
      subtitle: 'Многоступенчатая очистка, реминерализатор, бак 12L',
      category: 'storage',
      x: 60,
      y: 60,
      width: 260,
      height: 150,
      isSubcircuit: true,
      subcircuitId: 'sub_water_prep',
      subcircuitSummary: 'Содержит 58 узлов очистки, 70 связей, датчики TDS и буферный гидроаккумулятор',
      inputs: [
        createPort('r_wt_mains', 'ГОРОДСКОЙ ВОДОПРОВОД (H2O)', 'input', 'left', 'signal'),
        createPort('r_wt_ecu_ctrl', 'ECU_ENABLE_VALVES', 'input', 'top', 'signal'),
      ],
      outputs: [
        createPort('r_wt_clean_water', 'ОЧИЩЕННАЯ ВОДА (2.5 bar)', 'output', 'right', 'signal'),
        createPort('r_wt_tds_bus', 'TDS_ТЕЛЕМЕТРИЯ', 'output', 'bottom', 'bus'),
      ],
      color: '#0284c7',
    },
    {
      id: 'root_pump_hydraulic',
      title: '2. Ротационная Помпа & Гидравлический Тракт',
      subtitle: 'Нагнетание 9.0 bar, OPV байпасы, коллекторы',
      category: 'processor',
      x: 390,
      y: 60,
      width: 260,
      height: 150,
      isSubcircuit: true,
      subcircuitId: 'sub_pumping_hydraulic',
      subcircuitSummary: 'Содержит 52 узла гидравлики, ротационную помпу 200 L/h, демпферы пульсаций',
      inputs: [
        createPort('r_pmp_in', 'H2O_ВХОД (2.5 bar)', 'input', 'left', 'signal'),
        createPort('r_pmp_pwm', 'ИНВЕРТОР_ШИМ (ECU)', 'input', 'top', 'clock'),
      ],
      outputs: [
        createPort('r_pmp_out_9bar', 'ГИДРОЛИНИЯ 9.0 BAR', 'output', 'right', 'signal'),
        createPort('r_pmp_press_sig', 'СЕНСОР_ДАВЛЕНИЯ', 'output', 'bottom', 'signal'),
      ],
      color: '#0ea5e9',
    },
    {
      id: 'root_steam_boiler',
      title: '3. Сервисный & Паровой Бойлер 14L',
      subtitle: 'Пар 140°C (2.1 bar), ТЭН 4.5kW, автодолив',
      category: 'storage',
      x: 720,
      y: 60,
      width: 260,
      height: 150,
      isSubcircuit: true,
      subcircuitId: 'sub_steam_boiler',
      subcircuitSummary: 'Содержит 48 термодинамических узлов, датчики уровня, клапаны вакуума',
      inputs: [
        createPort('r_stm_water_in', 'H2O_ДОЛИВ (Помпа)', 'input', 'left', 'signal'),
        createPort('r_stm_ssr_duty', 'SSR_НАГРЕВ_ШИМ', 'input', 'top', 'power'),
      ],
      outputs: [
        createPort('r_stm_steam_out', 'СУХОЙ ПАР 2.0 BAR', 'output', 'right', 'signal'),
        createPort('r_stm_hx_preheat', 'ПРЕДПРОГРЕВ HX (85°C)', 'output', 'bottom', 'signal'),
      ],
      color: '#ea580c',
    },
    {
      id: 'root_brew_groups',
      title: '4. Заварочные Группы & Экстракция (4 Groups)',
      subtitle: 'Группы E61, PID 93.5°C, флоуметры, профилирование',
      category: 'processor',
      x: 1050,
      y: 60,
      width: 270,
      height: 150,
      isSubcircuit: true,
      subcircuitId: 'sub_brew_groups',
      subcircuitSummary: 'Содержит 71 узел заваривания, независимые бойлеры групп и вложенный Profiler',
      inputs: [
        createPort('r_grp_water_feed', 'ВОДА_9BAR (Нагретая)', 'input', 'left', 'signal'),
        createPort('r_grp_grind_feed', 'СМОЛОТЫЙ КОФЕ 18g', 'input', 'top', 'signal'),
        createPort('r_grp_brew_btn', 'КОМАНДА_ПРОЛИВА', 'input', 'bottom', 'signal'),
      ],
      outputs: [
        createPort('r_grp_espresso', 'ЭСПРЕССО В ЧАШКУ', 'output', 'right', 'signal'),
        createPort('r_grp_pulses', 'ИМПУЛЬСЫ_ФЛОУМЕТРОВ', 'output', 'bottom', 'clock'),
      ],
      color: '#d97706',
    },
    {
      id: 'root_grinder_dosing',
      title: '5. Помол, Дозирование & Гравиметрия',
      subtitle: 'Жернова 83mm, весы Acaia, авто-темпер 20kg',
      category: 'processor',
      x: 1050,
      y: 280,
      width: 270,
      height: 140,
      isSubcircuit: true,
      subcircuitId: 'sub_grinder_dosing',
      subcircuitSummary: 'Содержит 40 узлов помола, антистатику, контроль гранулометрии',
      inputs: [
        createPort('r_grd_cmd', 'РЕЦЕПТ_ДОЗЫ (ECU)', 'input', 'left', 'signal'),
      ],
      outputs: [
        createPort('r_grd_puck_out', 'ГОТОВЫЙ ТЕМПЕРОВАННЫЙ ПАК', 'output', 'top', 'signal'),
        createPort('r_grd_weight_sig', 'ВЕС_ТАБЛЕТКИ_ФАКТ', 'output', 'bottom', 'signal'),
      ],
      color: '#b45309',
    },
    {
      id: 'root_milk_steam',
      title: '6. Молочная Пена & Автостимер',
      subtitle: 'Трубки Cool-Touch, датчик 65°C, подмес воздуха',
      category: 'processor',
      x: 720,
      y: 280,
      width: 260,
      height: 140,
      isSubcircuit: true,
      subcircuitId: 'sub_milk_steam',
      subcircuitSummary: 'Содержит 35 узлов генерации микропены и термопары',
      inputs: [
        createPort('r_mlk_stm_in', 'ПАР ИЗ БОЙЛЕРА', 'input', 'top', 'signal'),
        createPort('r_mlk_cfg_cmd', 'УСТАВКА_ПЕНЫ (ECU)', 'input', 'left', 'signal'),
      ],
      outputs: [
        createPort('r_mlk_foam_out', 'ШЕЛКОВИСТАЯ МИКРОПЕНА', 'output', 'right', 'signal'),
      ],
      color: '#38bdf8',
    },
    {
      id: 'root_ecu_control',
      title: '7. Центральный Промышленный ECU & PID',
      subtitle: 'STM32H7, FreeRTOS, 24-bit ADC, драйверы SSR',
      category: 'processor',
      x: 390,
      y: 280,
      width: 260,
      height: 150,
      isSubcircuit: true,
      subcircuitId: 'sub_ecu_control',
      subcircuitSummary: 'Содержит 67 узлов управления, ядро FreeRTOS, опрос датчиков 1kHz',
      inputs: [
        createPort('r_ecu_sens_in', 'СЕНСОРНЫЕ ШИНЫ (Все датчики)', 'input', 'top', 'bus'),
        createPort('r_ecu_touch_in', 'КОМАНДЫ_СЕНСОРНОГО_ЭКРАНА', 'input', 'bottom', 'bus'),
      ],
      outputs: [
        createPort('r_ecu_ssr_out', 'ШИМ_УПРАВЛЕНИЕ_ТЭНАМИ', 'output', 'right', 'power'),
        createPort('r_ecu_pmp_cmd', 'УПРАВЛЕНИЕ_ПОМПОЙ_9B', 'output', 'top', 'clock'),
        createPort('r_ecu_tele_out', 'ТЕЛЕМЕТРИЯ_НА_ДИСПЛЕЙ', 'output', 'bottom', 'bus'),
      ],
      color: '#6366f1',
    },
    {
      id: 'root_power_safety',
      title: '8. 3-Фазное Питание 380V & Матрица Защиты',
      subtitle: 'RCBO 30mA, SSR Matrix, термопредохранители 165°C',
      category: 'processor',
      x: 390,
      y: 480,
      width: 260,
      height: 140,
      isSubcircuit: true,
      subcircuitId: 'sub_power_safety',
      subcircuitSummary: 'Содержит 60 силовых узлов коммутации и защиты',
      inputs: [
        createPort('r_pwr_in_380', 'СЕТЬ_380V_3-ФАЗЫ', 'input', 'left', 'power'),
      ],
      outputs: [
        createPort('r_pwr_out_24v', 'ШИНА_24V_DC (Клапаны)', 'output', 'right', 'power'),
        createPort('r_pwr_out_ssr', 'СИЛОВАЯ_ШИНА_ТЭНОВ', 'output', 'top', 'power'),
      ],
      color: '#f59e0b',
    },
    {
      id: 'root_cleaning_cip',
      title: '9. Автомойка CIP & Ультразвуковая Декальцинация',
      subtitle: 'Реверсивный Backflush, дозатор химии, сброс',
      category: 'processor',
      x: 720,
      y: 480,
      width: 260,
      height: 140,
      isSubcircuit: true,
      subcircuitId: 'sub_cleaning_cip',
      subcircuitSummary: 'Содержит 60 узлов автоматической химической очистки',
      inputs: [
        createPort('r_cip_in_trig', 'СИГНАЛ_АВТОМОЙКИ (ECU)', 'input', 'left', 'signal'),
      ],
      outputs: [
        createPort('r_cip_out_flush', 'ПРОМЫВКА_В_ГРУППЫ', 'output', 'top', 'signal'),
      ],
      color: '#10b981',
    },
    {
      id: 'root_ui_touchscreen',
      title: '10. Сенсорный Дисплей 10" & IoT Телеметрия',
      subtitle: 'Интерфейс бариста, профили вкуса, Wi-Fi Cloud',
      category: 'sink',
      x: 60,
      y: 280,
      width: 260,
      height: 140,
      inputs: [
        createPort('r_ui_tele_in', 'ДАННЫЕ_ТЕЛЕМЕТРИИ (ECU)', 'input', 'right', 'bus'),
      ],
      outputs: [
        createPort('r_ui_cmd_out', 'ВЫБОР_НАПИТКА_И_РЕЦЕПТА', 'output', 'top', 'bus'),
      ],
      color: '#10b981',
    },
  ];

  const rootEdges: EdgeConnection[] = [
    {
      id: 'e_r_water_to_pump',
      sourceBlockId: 'root_water_prep',
      sourcePortId: 'r_wt_clean_water',
      targetBlockId: 'root_pump_hydraulic',
      targetPortId: 'r_pmp_in',
      color: '#0284c7',
      label: 'Очищенная вода 2.5 bar',
    },
    {
      id: 'e_r_pump_to_boiler',
      sourceBlockId: 'root_pump_hydraulic',
      sourcePortId: 'r_pmp_out_9bar',
      targetBlockId: 'root_steam_boiler',
      targetPortId: 'r_stm_water_in',
      color: '#0ea5e9',
      label: 'Магистраль автодолива бойлера',
    },
    {
      id: 'e_r_pump_to_groups',
      sourceBlockId: 'root_pump_hydraulic',
      sourcePortId: 'r_pmp_out_9bar',
      targetBlockId: 'root_brew_groups',
      targetPortId: 'r_grp_water_feed',
      color: '#0ea5e9',
      label: 'Напорная магистраль экстракции 9.0 bar',
    },
    {
      id: 'e_r_steam_to_milk',
      sourceBlockId: 'root_steam_boiler',
      sourcePortId: 'r_stm_steam_out',
      targetBlockId: 'root_milk_steam',
      targetPortId: 'r_mlk_stm_in',
      color: '#ea580c',
      label: 'Сухой пар 140°C (2.1 bar)',
    },
    {
      id: 'e_r_grind_to_groups',
      sourceBlockId: 'root_grinder_dosing',
      sourcePortId: 'r_grd_puck_out',
      targetBlockId: 'root_brew_groups',
      targetPortId: 'r_grp_grind_feed',
      color: '#b45309',
      label: 'Темперированный кофе 18.5g',
    },
    {
      id: 'e_r_ecu_to_pump_cmd',
      sourceBlockId: 'root_ecu_control',
      sourcePortId: 'r_ecu_pmp_cmd',
      targetBlockId: 'root_pump_hydraulic',
      targetPortId: 'r_pmp_pwm',
      color: '#6366f1',
      label: 'Инверторное ШИМ-управление помпой',
    },
    {
      id: 'e_r_ecu_to_heaters',
      sourceBlockId: 'root_ecu_control',
      sourcePortId: 'r_ecu_ssr_out',
      targetBlockId: 'root_steam_boiler',
      targetPortId: 'r_stm_ssr_duty',
      color: '#ef4444',
      label: 'PID ШИМ-управление ТЭНами (4.5kW)',
    },
    {
      id: 'e_r_ui_to_ecu',
      sourceBlockId: 'root_ui_touchscreen',
      sourcePortId: 'r_ui_cmd_out',
      targetBlockId: 'root_ecu_control',
      targetPortId: 'r_ecu_touch_in',
      color: '#10b981',
      label: 'Команды рецептов и профилей давления',
    },
    {
      id: 'e_r_ecu_to_ui',
      sourceBlockId: 'root_ecu_control',
      sourcePortId: 'r_ecu_tele_out',
      targetBlockId: 'root_ui_touchscreen',
      targetPortId: 'r_ui_tele_in',
      color: '#10b981',
      label: 'Поток телеметрии, температур и расхода',
    },
    {
      id: 'e_r_pwr_to_ecu',
      sourceBlockId: 'root_power_safety',
      sourcePortId: 'r_pwr_out_24v',
      targetBlockId: 'root_ecu_control',
      targetPortId: 'r_ecu_sens_in',
      color: '#f59e0b',
      label: 'Стабилизированное питание 24V DC',
    },
    {
      id: 'e_r_cip_to_groups',
      sourceBlockId: 'root_cleaning_cip',
      sourcePortId: 'r_cip_out_flush',
      targetBlockId: 'root_brew_groups',
      targetPortId: 'r_grp_brew_btn',
      color: '#10b981',
      label: 'Магистраль автоматического Backflush',
    },
  ];

  return {
    id: 'industrial_espresso_machine_1000',
    name: '☕ Промышленная Кофемашина (1,000+ элементов & Иерархия)',
    category: 'Промышленная Автоматика & Гидравлика',
    description: 'Комплексная инженерная схема коммерческой мультибойлерной эспрессо-машины на 1,000+ элементов: надсистема, 9 подсистем (водоподготовка, помпа 9b, бойлер 14L, группы E61, помол, пар, ECU STM32H7, 3-фазное питание 380V, автомойка CIP) и вложенные под-подсистемы профилирования потока.',
    nodes: rootNodes,
    edges: rootEdges,
    subcircuits,
  };
}
