import React, { useMemo, useState } from 'react';
import { LBC_PLATFORMS } from './data/lbcWorkflowData';
import { extractInitialDuration, formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock, ProcessAutomationKind } from './processGraphMath';
import {
  ProcessResource,
  ProcessResourceRequirement,
  simulateResourceConstrainedProcess,
} from './processSimulation';

interface SimulationModel {
  name: string;
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock: Record<string, ProcessResourceRequirement[]>;
  batchSize: number;
  releaseIntervalSeconds: number;
}

const STORAGE_KEY = 'autotrace:resource-simulation:v1';
const GENERIC_MATH_STORAGE_KEY = 'autotrace:generic-process-math:v1';

const DEFAULT_RESOURCES: ProcessResource[] = [
  { id: 'operator', name: 'Оператор', capacity: 1 },
  { id: 'automation', name: 'Автомат / процессор', capacity: 1 },
  { id: 'external', name: 'Внешний модуль', capacity: 1 },
  { id: 'qc', name: 'QC-станция', capacity: 1 },
];

function defaultRequirements(blocks: GraphProcessBlock[]): Record<string, ProcessResourceRequirement[]> {
  const requirements: Record<string, ProcessResourceRequirement[]> = {};
  for (const block of blocks) {
    const ids: string[] = [];
    switch (block.automation) {
      case 'manual': ids.push('operator'); break;
      case 'automatic': ids.push('automation'); break;
      case 'mixed': ids.push('operator', 'automation'); break;
      case 'external': ids.push('external'); break;
      case 'qc': ids.push('qc'); break;
      case 'wait': break;
      default: break;
    }
    requirements[block.id] = ids.map(resourceId => ({ resourceId, units: 1 }));
  }
  return requirements;
}

function genericBlocks(): GraphProcessBlock[] {
  return [
    { id: 'receipt', key: 'receipt', title: 'Приём и регистрация', automation: 'manual', time: { value: 2, unit: 'min' }, dependencies: [] },
    { id: 'prep', key: 'prep', title: 'Подготовка образца', automation: 'mixed', time: { value: 4, unit: 'min' }, dependencies: ['receipt'] },
    { id: 'processing', key: 'processing', title: 'Автоматическая обработка', automation: 'automatic', time: { value: 12, unit: 'min' }, dependencies: ['prep'] },
    { id: 'stain', key: 'stain', title: 'Окраска', automation: 'external', time: { value: 20, unit: 'min' }, dependencies: ['processing'] },
    { id: 'qc', key: 'qc', title: 'Финальный QC', automation: 'qc', time: { value: 1, unit: 'min' }, dependencies: ['stain'] },
  ];
}

function genericModel(): SimulationModel {
  const blocks = genericBlocks();
  return {
    name: 'Ресурсная модель лабораторного процесса',
    blocks,
    resources: DEFAULT_RESOURCES.map(resource => ({ ...resource })),
    requirementsByBlock: defaultRequirements(blocks),
    batchSize: 12,
    releaseIntervalSeconds: 0,
  };
}

function modelFromLbc(platformId: string): SimulationModel {
  const platform = LBC_PLATFORMS.find(item => item.id === platformId);
  if (!platform) return genericModel();
  let previousId: string | undefined;
  const blocks: GraphProcessBlock[] = platform.stages.map((stage, index) => {
    const id = `${stage.phase}_${index + 1}`;
    const block: GraphProcessBlock = {
      id,
      key: `${stage.phase}_${index + 1}`,
      title: stage.title,
      automation: stage.automation,
      time: extractInitialDuration(stage.time),
      dependencies: previousId ? [previousId] : [],
    };
    previousId = id;
    return block;
  });
  return {
    name: `${platform.vendor} ${platform.name} — resource simulation`,
    blocks,
    resources: DEFAULT_RESOURCES.map(resource => ({ ...resource })),
    requirementsByBlock: defaultRequirements(blocks),
    batchSize: 12,
    releaseIntervalSeconds: 0,
  };
}

function loadInitial(): SimulationModel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SimulationModel;
      if (Array.isArray(parsed.blocks) && Array.isArray(parsed.resources)) return parsed;
    }
  } catch {
    // Ignore invalid cache.
  }
  return genericModel();
}

function colorForAutomation(kind: ProcessAutomationKind): string {
  switch (kind) {
    case 'manual': return '#F59E0B';
    case 'automatic': return '#10B981';
    case 'mixed': return '#8B5CF6';
    case 'wait': return '#3B82F6';
    case 'external': return '#06B6D4';
    case 'qc': return '#EF4444';
    default: return '#64748B';
  }
}

function loadGenericMathModel(): { name?: string; blocks?: GraphProcessBlock[]; batchSize?: number } | null {
  try {
    const raw = localStorage.getItem(GENERIC_MATH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function ProcessSimulationApp() {
  const initial = useMemo(loadInitial, []);
  const [name, setName] = useState(initial.name);
  const [blocks, setBlocks] = useState(initial.blocks);
  const [resources, setResources] = useState(initial.resources);
  const [requirementsByBlock, setRequirementsByBlock] = useState(initial.requirementsByBlock);
  const [batchSize, setBatchSize] = useState(initial.batchSize);
  const [releaseIntervalSeconds, setReleaseIntervalSeconds] = useState(initial.releaseIntervalSeconds);
  const [template, setTemplate] = useState('generic');
  const [notice, setNotice] = useState('');

  const persist = (model?: Partial<SimulationModel>) => {
    const next: SimulationModel = {
      name: model?.name ?? name,
      blocks: model?.blocks ?? blocks,
      resources: model?.resources ?? resources,
      requirementsByBlock: model?.requirementsByBlock ?? requirementsByBlock,
      batchSize: model?.batchSize ?? batchSize,
      releaseIntervalSeconds: model?.releaseIntervalSeconds ?? releaseIntervalSeconds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const simulation = useMemo(() => simulateResourceConstrainedProcess(blocks, {
    batchSize,
    releaseIntervalSeconds,
    resources,
    requirementsByBlock,
  }), [blocks, batchSize, releaseIntervalSeconds, resources, requirementsByBlock]);

  const applyModel = (model: SimulationModel) => {
    setName(model.name);
    setBlocks(model.blocks);
    setResources(model.resources);
    setRequirementsByBlock(model.requirementsByBlock);
    setBatchSize(model.batchSize);
    setReleaseIntervalSeconds(model.releaseIntervalSeconds);
    persist(model);
  };

  const applyTemplate = (value: string) => {
    setTemplate(value);
    applyModel(value === 'generic' ? genericModel() : modelFromLbc(value));
  };

  const importFromProcessMath = () => {
    const source = loadGenericMathModel();
    if (!source?.blocks?.length) {
      setNotice('В Local Storage не найдена модель Process Math');
      return;
    }
    const next: SimulationModel = {
      name: `${source.name || 'Process Math'} — simulation`,
      blocks: source.blocks,
      resources: DEFAULT_RESOURCES.map(resource => ({ ...resource })),
      requirementsByBlock: defaultRequirements(source.blocks),
      batchSize: Math.max(1, Number(source.batchSize) || 1),
      releaseIntervalSeconds: 0,
    };
    applyModel(next);
    setNotice('Текущий Process Math DAG импортирован; ресурсы назначены по типам операций');
  };

  const updateResource = (id: string, patch: Partial<ProcessResource>) => {
    setResources(current => {
      const next = current.map(resource => resource.id === id ? { ...resource, ...patch } : resource);
      queueMicrotask(() => persist({ resources: next }));
      return next;
    });
  };

  const addResource = () => {
    const id = `resource_${Date.now()}`;
    setResources(current => {
      const next = [...current, { id, name: 'Новый ресурс', capacity: 1 }];
      queueMicrotask(() => persist({ resources: next }));
      return next;
    });
  };

  const removeResource = (id: string) => {
    setResources(current => {
      const next = current.filter(resource => resource.id !== id);
      queueMicrotask(() => persist({ resources: next }));
      return next;
    });
    setRequirementsByBlock(current => {
      const next = Object.fromEntries(Object.entries(current).map(([blockId, requirements]) => [
        blockId,
        requirements.filter(requirement => requirement.resourceId !== id),
      ]));
      queueMicrotask(() => persist({ requirementsByBlock: next }));
      return next;
    });
  };

  const toggleRequirement = (blockId: string, resourceId: string) => {
    setRequirementsByBlock(current => {
      const existing = current[blockId] || [];
      const has = existing.some(requirement => requirement.resourceId === resourceId);
      const next = {
        ...current,
        [blockId]: has
          ? existing.filter(requirement => requirement.resourceId !== resourceId)
          : [...existing, { resourceId, units: 1 }],
      };
      queueMicrotask(() => persist({ requirementsByBlock: next }));
      return next;
    });
  };

  const updateRequirementUnits = (blockId: string, resourceId: string, units: number) => {
    setRequirementsByBlock(current => {
      const next = {
        ...current,
        [blockId]: (current[blockId] || []).map(requirement =>
          requirement.resourceId === resourceId ? { ...requirement, units: Math.max(1, Math.floor(units || 1)) } : requirement,
        ),
      };
      queueMicrotask(() => persist({ requirementsByBlock: next }));
      return next;
    });
  };

  const maxTimeline = Math.max(1, simulation.stats.makespanSeconds);
  const visibleRuns = simulation.runs.slice(0, 120);

  return (
    <div className="sim-app">
      <style>{`
        :root{color-scheme:light}*{box-sizing:border-box}body{margin:0}.sim-app{min-height:100vh;background:#F6F8FB;color:#0F172A;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sim-top{position:sticky;top:0;z-index:30;background:rgba(246,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #E2E8F0}.sim-top-inner{max-width:1800px;margin:auto;padding:13px 20px;display:flex;gap:12px;align-items:center}.sim-mark{width:40px;height:40px;border-radius:12px;background:#0F172A;color:#fff;display:grid;place-items:center;font-weight:900}.sim-brand b{display:block;font-size:14px}.sim-brand span{display:block;color:#64748B;font-size:11px}.sim-back{margin-left:auto;border:1px solid #CBD5E1;background:#fff;border-radius:9px;padding:8px 10px;cursor:pointer}.sim-hero,.sim-controls,.sim-main{max-width:1800px;margin:auto}.sim-hero{padding:28px 20px 12px}.sim-eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:900;color:#64748B}.sim-hero h1{margin:7px 0 8px;font-size:clamp(28px,4vw,48px);letter-spacing:-.045em;line-height:1.04}.sim-hero p{max-width:1050px;color:#475569;line-height:1.6;margin:0}.sim-controls{padding:10px 20px 20px;display:flex;flex-wrap:wrap;gap:9px;align-items:end}.sim-field{display:flex;flex-direction:column;gap:4px}.sim-field label{font-size:9px;font-weight:900;color:#64748B;text-transform:uppercase;letter-spacing:.08em}.sim-input,.sim-select{border:1px solid #CBD5E1;background:#fff;border-radius:9px;padding:9px 10px;min-height:36px;font:inherit;font-size:12px;color:#0F172A}.sim-name{min-width:260px}.sim-btn{border:1px solid #CBD5E1;background:#fff;border-radius:9px;padding:9px 11px;min-height:36px;cursor:pointer;font:inherit;font-size:11px;font-weight:800;color:#334155}.sim-btn.primary{background:#0F172A;color:#fff;border-color:#0F172A}.sim-notice{max-width:1800px;margin:0 auto;padding:0 20px 12px;color:#475569;font-size:11px}.sim-main{padding:0 20px 36px;display:grid;grid-template-columns:minmax(360px,.85fr) minmax(520px,1.45fr);gap:16px}.sim-panel{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:14px;box-shadow:0 6px 18px rgba(15,23,42,.04)}.sim-panel h2{margin:0 0 10px;font-size:16px;letter-spacing:-.02em}.sim-panel h3{margin:14px 0 8px;font-size:12px}.sim-resource{display:grid;grid-template-columns:1fr 78px 30px;gap:6px;margin-bottom:6px}.sim-resource input{width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:7px 8px;font:inherit;font-size:11px}.sim-resource button{border:1px solid #FECACA;background:#FEF2F2;color:#B91C1C;border-radius:8px;cursor:pointer}.sim-stage{border:1px solid #E2E8F0;border-left:4px solid var(--tone);border-radius:10px;padding:9px;margin:7px 0}.sim-stage-head{display:flex;align-items:center;gap:7px}.sim-stage-head b{font-size:11px}.sim-stage-head span{margin-left:auto;font-size:9px;color:#64748B}.sim-reqs{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.sim-req{display:flex;align-items:center;gap:4px;border:1px solid #E2E8F0;border-radius:8px;padding:4px 6px;font-size:9px;color:#475569}.sim-req input[type=number]{width:38px;border:0;background:#F1F5F9;border-radius:5px;padding:3px;font-size:9px}.sim-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.sim-kpi{border:1px solid #E2E8F0;background:#F8FAFC;border-radius:11px;padding:10px}.sim-kpi span{display:block;color:#64748B;text-transform:uppercase;letter-spacing:.07em;font-size:8px;font-weight:900}.sim-kpi b{display:block;margin-top:4px;font-size:16px}.sim-error{border:1px solid #FECACA;background:#FEF2F2;color:#991B1B;border-radius:10px;padding:9px;font-size:10px;line-height:1.5;margin-bottom:8px}.sim-warning{border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;border-radius:10px;padding:8px;font-size:9px;line-height:1.45;margin-bottom:7px}.sim-util{display:grid;grid-template-columns:150px 1fr 52px;gap:8px;align-items:center;margin:7px 0;font-size:10px}.sim-util-track{height:8px;background:#E2E8F0;border-radius:999px;overflow:hidden}.sim-util-fill{height:100%;background:#0F172A;border-radius:999px}.sim-table{width:100%;border-collapse:collapse;font-size:9px}.sim-table th,.sim-table td{text-align:left;padding:6px;border-bottom:1px solid #EEF2F7}.sim-table th{color:#64748B;text-transform:uppercase;letter-spacing:.06em;font-size:8px}.sim-timeline{overflow-x:auto;border:1px solid #E2E8F0;border-radius:11px;background:#FAFBFC;padding:8px}.sim-run{display:grid;grid-template-columns:94px minmax(460px,1fr);gap:7px;align-items:center;margin:3px 0}.sim-run-label{font-size:8px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sim-track{height:15px;position:relative;background:#F1F5F9;border-radius:4px}.sim-bar{position:absolute;top:1px;height:13px;border-radius:3px;min-width:2px;opacity:.9}.sim-bar span{display:none}.sim-footnote{font-size:9px;color:#64748B;line-height:1.5;margin-top:7px}@media(max-width:1000px){.sim-main{grid-template-columns:1fr}.sim-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="sim-top">
        <div className="sim-top-inner">
          <div className="sim-mark">DES</div>
          <div className="sim-brand"><b>Resource-Constrained Process Simulation</b><span>очереди · оборудование · оператор · batch throughput</span></div>
          <button className="sim-back" onClick={() => { window.location.href = '/?view=process-math'; }}>← Process Math</button>
          <button className="sim-back" onClick={() => { window.location.href = '/'; }}>AutoTrace</button>
        </div>
      </header>

      <section className="sim-hero">
        <div className="sim-eyebrow">AutoTrace · discrete-event planning</div>
        <h1>Реальная производительность процесса с ограниченными ресурсами</h1>
        <p>Critical path отвечает на вопрос «сколько длится одна идеальная проба без очередей». Этот режим моделирует несколько проб одновременно и показывает, что происходит при одном операторе, одной центрифуге, одном процессоре или ограниченной станции окраски.</p>
      </section>

      <section className="sim-controls">
        <div className="sim-field"><label>Модель</label><input className="sim-input sim-name" value={name} onChange={event => { setName(event.target.value); persist({ name: event.target.value }); }} /></div>
        <div className="sim-field"><label>Шаблон</label><select className="sim-select" value={template} onChange={event => applyTemplate(event.target.value)}><option value="generic">Generic laboratory</option>{LBC_PLATFORMS.map(platform => <option key={platform.id} value={platform.id}>{platform.vendor} {platform.name}</option>)}</select></div>
        <div className="sim-field"><label>Проб в партии</label><input className="sim-input" type="number" min="1" max="500" value={batchSize} onChange={event => { const value = Math.max(1, Number(event.target.value) || 1); setBatchSize(value); persist({ batchSize: value }); }} /></div>
        <div className="sim-field"><label>Интервал прихода, сек</label><input className="sim-input" type="number" min="0" value={releaseIntervalSeconds} onChange={event => { const value = Math.max(0, Number(event.target.value) || 0); setReleaseIntervalSeconds(value); persist({ releaseIntervalSeconds: value }); }} /></div>
        <button className="sim-btn primary" onClick={importFromProcessMath}>Импорт текущего Process Math DAG</button>
      </section>
      {notice && <div className="sim-notice">{notice}</div>}

      <main className="sim-main">
        <section className="sim-panel">
          <h2>Ресурсы и назначения</h2>
          <p className="sim-footnote">Capacity — сколько одинаковых единиц ресурса может работать одновременно. Например, 2 оператора или 3 одинаковых центрифужных позиции.</p>
          <h3>Пул ресурсов</h3>
          {resources.map(resource => <div className="sim-resource" key={resource.id}><input value={resource.name} onChange={event => updateResource(resource.id, { name: event.target.value })} /><input type="number" min="1" value={resource.capacity} onChange={event => updateResource(resource.id, { capacity: Math.max(1, Number(event.target.value) || 1) })} /><button onClick={() => removeResource(resource.id)}>×</button></div>)}
          <button className="sim-btn" onClick={addResource}>+ ресурс</button>

          <h3>Какие блоки занимают какие ресурсы</h3>
          {blocks.map(block => {
            const active = requirementsByBlock[block.id] || [];
            return <div className="sim-stage" key={block.id} style={{ '--tone': colorForAutomation(block.automation) } as React.CSSProperties}>
              <div className="sim-stage-head"><b>{block.title}</b><span>{block.time.formula ? `ƒ ${block.time.formula}` : block.time.value != null ? `${block.time.value} ${block.time.unit}` : 'время ?'}</span></div>
              <div className="sim-reqs">
                {resources.map(resource => {
                  const req = active.find(item => item.resourceId === resource.id);
                  return <label className="sim-req" key={resource.id}><input type="checkbox" checked={Boolean(req)} onChange={() => toggleRequirement(block.id, resource.id)} />{resource.name}{req && <input type="number" min="1" max={resource.capacity} value={req.units} title="Одновременно требуемых единиц" onChange={event => updateRequirementUnits(block.id, resource.id, Number(event.target.value))} />}</label>;
                })}
              </div>
            </div>;
          })}
        </section>

        <section className="sim-panel">
          <h2>Результат симуляции</h2>
          {simulation.errors.map(error => <div className="sim-error" key={error}>{error}</div>)}
          {simulation.warnings.map(warning => <div className="sim-warning" key={warning}>{warning}</div>)}

          {simulation.ok && <>
            <div className="sim-kpis">
              <div className="sim-kpi"><span>Makespan партии</span><b>{formatDuration(simulation.stats.makespanSeconds)}</b></div>
              <div className="sim-kpi"><span>Средний cycle time</span><b>{formatDuration(simulation.stats.averageCycleSeconds)}</b></div>
              <div className="sim-kpi"><span>Throughput партии</span><b>{simulation.stats.throughputPerHour == null ? '—' : `${roundSmart(simulation.stats.throughputPerHour)}/ч`}</b></div>
              <div className="sim-kpi"><span>Output rate после разгона</span><b>{simulation.stats.outputRatePerHour == null ? '—' : `${roundSmart(simulation.stats.outputRatePerHour)}/ч`}</b></div>
              <div className="sim-kpi"><span>Среднее ожидание/операцию</span><b>{formatDuration(simulation.stats.averageWaitSeconds)}</b></div>
              <div className="sim-kpi"><span>P95 cycle</span><b>{formatDuration(simulation.stats.p95CycleSeconds)}</b></div>
              <div className="sim-kpi"><span>Resource bottleneck</span><b>{simulation.stats.resourceBottleneckName || '—'}</b></div>
              <div className="sim-kpi"><span>Utilization bottleneck</span><b>{roundSmart(simulation.stats.resourceBottleneckUtilizationPercent)}%</b></div>
            </div>

            <h3>Загрузка ресурсов</h3>
            {simulation.resourceStats.map(resource => <div className="sim-util" key={resource.id}><span>{resource.name} × {resource.capacity}</span><div className="sim-util-track"><div className="sim-util-fill" style={{ width: `${Math.min(100, resource.utilizationPercent)}%` }} /></div><b>{roundSmart(resource.utilizationPercent)}%</b></div>)}

            <h3>Где образуются очереди</h3>
            <table className="sim-table"><thead><tr><th>Этап</th><th>Среднее ожидание</th><th>Макс.</th><th>Суммарно</th></tr></thead><tbody>{simulation.blockStats.slice(0, 10).map(item => <tr key={item.blockId}><td>{item.blockTitle}</td><td>{formatDuration(item.averageWaitSeconds)}</td><td>{formatDuration(item.maxWaitSeconds)}</td><td>{formatDuration(item.totalWaitSeconds)}</td></tr>)}</tbody></table>

            <h3>Timeline первых операций</h3>
            <div className="sim-timeline">
              {visibleRuns.map(run => <div className="sim-run" key={run.taskId}><div className="sim-run-label">#{run.jobIndex + 1} · {run.blockTitle}</div><div className="sim-track"><div className="sim-bar" title={`готов ${formatDuration(run.readySeconds)} · старт ${formatDuration(run.startSeconds)} · финиш ${formatDuration(run.finishSeconds)} · очередь ${formatDuration(run.waitSeconds)}`} style={{ left: `${(run.startSeconds / maxTimeline) * 100}%`, width: `${Math.max(.3, (run.durationSeconds / maxTimeline) * 100)}%`, background: colorForAutomation(blocks.find(block => block.id === run.blockId)?.automation || 'automatic') }} /></div></div>)}
            </div>
            {simulation.runs.length > visibleRuns.length && <div className="sim-footnote">Показаны первые {visibleRuns.length} из {simulation.runs.length} операций, чтобы интерфейс оставался быстрым.</div>}
          </>}
        </section>
      </main>
    </div>
  );
}
