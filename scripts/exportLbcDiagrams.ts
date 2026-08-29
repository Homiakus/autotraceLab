/**
 * Экспорт диаграмм сравнения LBC-оборудования (жидкостная цитология)
 * в папку `diagramms/` в корне проекта.
 *
 * Логика построения сцен зеркалит `src/LbcWorkflowGraphApp.tsx`
 * (createStageSubcircuit / createOverviewScene), чтобы файлы соответствовали
 * тому, что приложение отдаёт через кнопку «Экспорт JSON».
 *
 * Формат файлов совместим с загрузчиком «Загрузить диаграмму»:
 *   { name, nodes, edges, subcircuits }
 *
 * Запуск:  npm run export:diagrams   (или: npx tsx scripts/exportLbcDiagrams.ts)
 */

import fs from 'fs';
import path from 'path';
import {
  LBC_AUTOMATION_COLORS,
  LBC_PHASES,
  LBC_PLATFORMS,
  LbcPlatform,
} from '../src/data/lbcWorkflowData';
import { BlockNode, EdgeConnection, SubcircuitDefinition } from '../src/types';

const PLATFORM_COLORS = ['#d9468d', '#2fb995', '#4aa7d8', '#d29a43'];

function createStageSubcircuit(platform: LbcPlatform, accent: string): SubcircuitDefinition {
  const nodes: BlockNode[] = platform.stages.map((stage, index) => {
    const stageId = `${platform.id}-stage-${index}`;
    const row = Math.floor(index / 4);
    const column = index % 4;
    return {
      id: stageId,
      title: stage.title,
      subtitle: stage.time,
      description: [
        stage.description,
        stage.operator ? `Человек: ${stage.operator}` : '',
        stage.machine ? `Автомат: ${stage.machine}` : '',
        stage.note ? `Примечание: ${stage.note}` : '',
      ].filter(Boolean).join('\n\n'),
      semanticType: LBC_PHASES.find((phase) => phase.id === stage.phase)?.title,
      category: stage.automation === 'manual' ? 'source' : stage.automation === 'qc' ? 'sink' : 'processor',
      x: 130 + column * 250,
      y: 110 + row * 205,
      width: 196,
      height: 112,
      shape: 'rounded',
      autoSize: false,
      color: LBC_AUTOMATION_COLORS[stage.automation] || accent,
      routingClearance: 16,
      preferredFlow: 'left-to-right',
      inputs: [{
        id: `${stageId}-in`,
        name: index === 0 ? 'VIAL_IN' : 'MATERIAL_IN',
        type: 'input',
        side: 'left',
        placementMode: 'fixed',
        relativePosition: 0.52,
        dataType: 'mechanical',
        description: 'Вход материала или стекла с предыдущего этапа',
      }],
      outputs: [{
        id: `${stageId}-out`,
        name: index === platform.stages.length - 1 ? 'SLIDE_OUT' : 'MATERIAL_OUT',
        type: 'output',
        side: 'right',
        placementMode: 'fixed',
        relativePosition: 0.52,
        dataType: 'mechanical',
        description: 'Выход материала или стекла на следующий этап',
      }],
    };
  });

  const edges: EdgeConnection[] = nodes.slice(0, -1).map((node, index) => ({
    id: `${platform.id}-flow-${index}`,
    sourceBlockId: node.id,
    sourcePortId: node.outputs[0].id,
    targetBlockId: nodes[index + 1].id,
    targetPortId: nodes[index + 1].inputs[0].id,
    label: LBC_PHASES[index + 1]?.title || 'следующий этап',
    dataType: 'mechanical',
    color: accent,
  }));

  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  return {
    id: `sub-${platform.id}`,
    name: `${platform.vendor} ${platform.name}`,
    description: platform.principle,
    category: 'processor',
    nodes,
    edges,
    externalInputs: [{
      id: `${platform.id}-vial-in`,
      name: 'VIAL_IN',
      type: 'input',
      side: 'left',
      dataType: 'mechanical',
      internalNodeId: firstNode.id,
      internalPortId: firstNode.inputs[0].id,
    }],
    externalOutputs: [{
      id: `${platform.id}-slide-out`,
      name: 'SLIDE_OUT',
      type: 'output',
      side: 'right',
      dataType: 'mechanical',
      internalNodeId: lastNode.id,
      internalPortId: lastNode.outputs[0].id,
    }],
  };
}

interface OverviewScene {
  nodes: BlockNode[];
  edges: EdgeConnection[];
  subcircuits: Record<string, SubcircuitDefinition>;
}

function createOverviewScene(platforms: LbcPlatform[]): OverviewScene {
  const laneGap = 185;
  const centerY = 90 + ((Math.max(platforms.length, 1) - 1) * laneGap) / 2;
  const source: BlockNode = {
    id: 'lbc-sample-input',
    title: 'Приём и идентификация',
    subtitle: 'VIAL + LIS ID',
    description: 'Общий вход образца перед разветвлением по сравниваемым платформам.',
    semanticType: 'Sample intake',
    category: 'source',
    x: 70,
    y: centerY,
    width: 205,
    height: 176,
    shape: 'rounded',
    color: '#4aa7d8',
    inputs: [{ id: 'lab-vial-in', name: 'LAB_IN', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.5, dataType: 'mechanical' }],
    outputs: [
      ...platforms.map((platform, index) => ({
        id: `sample-bus-${platform.id}`,
        name: `SAMPLE_${index + 1}`,
        type: 'output' as const,
        side: 'right' as const,
        placementMode: 'fixed' as const,
        relativePosition: (index + 1) / (platforms.length + 2),
        dataType: 'mechanical',
      })),
      {
        id: 'lis-id-bus',
        name: 'LIS_ID_BUS',
        type: 'output' as const,
        side: 'right' as const,
        placementMode: 'fixed' as const,
        relativePosition: (platforms.length + 1) / (platforms.length + 2),
        dataType: 'data',
      },
    ],
  };

  const qc: BlockNode = {
    id: 'lbc-final-qc',
    title: 'Финальный QC и выдача',
    subtitle: 'STAINED SLIDE OUT',
    description: 'Проверка идентичности, качества окраски, клеточного пятна и готовности стекла к выдаче.',
    semanticType: 'Quality control',
    category: 'sink',
    x: 1135,
    y: centerY - 30,
    width: 220,
    height: 150,
    shape: 'rounded',
    color: '#d9468d',
    inputs: platforms.map((platform, index) => ({
      id: `qc-in-${platform.id}`,
      name: `${platform.vendor.toUpperCase()}_${index + 1}`,
      type: 'input' as const,
      side: 'left' as const,
      placementMode: 'fixed' as const,
      relativePosition: (index + 1) / (platforms.length + 1),
      dataType: 'mechanical',
    })),
    outputs: [{ id: 'qc-release', name: 'RELEASED', type: 'output', side: 'right', placementMode: 'fixed', relativePosition: 0.5, dataType: 'control' }],
  };

  const nodes: BlockNode[] = [source];
  const edges: EdgeConnection[] = [];
  const subcircuits: Record<string, SubcircuitDefinition> = {};

  platforms.forEach((platform, index) => {
    const accent = PLATFORM_COLORS[index % PLATFORM_COLORS.length];
    const y = 60 + index * laneGap;
    const equipmentId = `equipment-${platform.id}`;
    const equipment: BlockNode = {
      id: equipmentId,
      title: platform.name,
      subtitle: `${platform.vendor} | ${platform.throughput}`,
      description: `${platform.principle}\n\nЦикл: ${platform.totalTime}\nПроизводительность: ${platform.throughput}`,
      semanticType: platform.family,
      category: 'processor',
      x: 390,
      y,
      width: 270,
      height: 142,
      shape: 'chip_ic',
      color: accent,
      isSubcircuit: true,
      subcircuitId: `sub-${platform.id}`,
      subcircuitSummary: `${platform.stages.length} технологических этапов`,
      routingClearance: 20,
      preferredFlow: 'left-to-right',
      inputs: [
        { id: `${platform.id}-vial-in`, name: 'VIAL_IN', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.38, dataType: 'mechanical' },
        { id: `${platform.id}-lis-in`, name: 'LIS_ID', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.72, dataType: 'data' },
      ],
      outputs: [
        { id: `${platform.id}-slide-out`, name: platform.staining === 'integrated' ? 'STAINED_SLIDE' : 'PREP_SLIDE', type: 'output', side: 'right', placementMode: 'fixed', relativePosition: 0.4, dataType: 'mechanical' },
        { id: `${platform.id}-status-out`, name: 'STATUS', type: 'output', side: 'bottom', placementMode: 'fixed', relativePosition: 0.72, dataType: 'data' },
      ],
    };
    nodes.push(equipment);
    subcircuits[equipment.subcircuitId!] = createStageSubcircuit(platform, accent);

    edges.push({
      id: `sample-to-${platform.id}`,
      sourceBlockId: source.id,
      sourcePortId: `sample-bus-${platform.id}`,
      targetBlockId: equipment.id,
      targetPortId: `${platform.id}-vial-in`,
      label: 'образец + LIS ID',
      dataType: 'mechanical',
      color: accent,
    });

    if (platform.staining === 'integrated') {
      edges.push({
        id: `result-${platform.id}`,
        sourceBlockId: equipment.id,
        sourcePortId: `${platform.id}-slide-out`,
        targetBlockId: qc.id,
        targetPortId: `qc-in-${platform.id}`,
        label: 'окрашенное стекло',
        dataType: 'mechanical',
        color: accent,
      });
    } else {
      const stainerId = `stainer-${platform.id}`;
      const stainer: BlockNode = {
        id: stainerId,
        title: 'Внешняя Pap-окраска',
        subtitle: platform.name,
        description: 'Отдельный валидированный стейнер и передача rack между контурами.',
        semanticType: 'External Pap stainer',
        category: 'processor',
        x: 770,
        y: y + 4,
        width: 220,
        height: 132,
        shape: 'rounded',
        color: accent,
        inputs: [{ id: `${stainerId}-in`, name: 'PREP_SLIDE', type: 'input', side: 'left', placementMode: 'fixed', relativePosition: 0.5, dataType: 'mechanical' }],
        outputs: [{ id: `${stainerId}-out`, name: 'STAINED_SLIDE', type: 'output', side: 'right', placementMode: 'fixed', relativePosition: 0.5, dataType: 'mechanical' }],
      };
      nodes.push(stainer);
      edges.push(
        {
          id: `to-stainer-${platform.id}`,
          sourceBlockId: equipment.id,
          sourcePortId: `${platform.id}-slide-out`,
          targetBlockId: stainer.id,
          targetPortId: `${stainerId}-in`,
          label: 'готовое к окраске',
          dataType: 'mechanical',
          color: accent,
        },
        {
          id: `result-${platform.id}`,
          sourceBlockId: stainer.id,
          sourcePortId: `${stainerId}-out`,
          targetBlockId: qc.id,
          targetPortId: `qc-in-${platform.id}`,
          label: 'окрашенное стекло',
          dataType: 'mechanical',
          color: accent,
        },
      );
    }
  });

  nodes.push(qc);
  return { nodes, edges, subcircuits };
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`✅ ${path.relative(process.cwd(), filePath)}`);
}

function main(): void {
  const outputDir = path.resolve(process.cwd(), 'diagramms');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1) Общая схема сравнения всех платформ (overview + вложенные подсхемы).
  const overview = createOverviewScene(LBC_PLATFORMS);
  writeJson(path.join(outputDir, 'lbc-equipment-comparison.json'), {
    version: 1,
    kind: 'lbc-equipment-comparison',
    name: 'Сравнение LBC оборудования',
    nodes: overview.nodes,
    edges: overview.edges,
    subcircuits: overview.subcircuits,
  });

  // 2) Отдельный файл для каждой платформы (плоский поток этапов).
  LBC_PLATFORMS.forEach((platform, index) => {
    const accent = PLATFORM_COLORS[index % PLATFORM_COLORS.length];
    const subcircuit = createStageSubcircuit(platform, accent);
    writeJson(path.join(outputDir, `${platform.id}.json`), {
      version: 1,
      kind: 'lbc-platform-workflow',
      name: `${platform.vendor} · ${platform.name}`,
      platformId: platform.id,
      vendor: platform.vendor,
      family: platform.family,
      staining: platform.staining,
      nodes: subcircuit.nodes,
      edges: subcircuit.edges,
      subcircuits: {},
    });
  });

  const fileCount = 1 + LBC_PLATFORMS.length;
  console.log(`\n📦 Экспортировано файлов: ${fileCount} → ${path.relative(process.cwd(), outputDir)}`);
}

main();
