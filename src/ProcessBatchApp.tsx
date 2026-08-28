import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock } from './processGraphMath';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { ProcessBatchConfig, simulateBatchCycleProcess } from './processBatchSimulation';

interface StoredSimulationModel {
  name: string;
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock: Record<string, ProcessResourceRequirement[]>;
  batchSize: number;
  releaseIntervalSeconds: number;
}

const SIM_STORAGE_KEY = 'autotrace:resource-simulation:v1';
const BATCH_STORAGE_KEY = 'autotrace:batch-simulation:v1';

function fallbackModel(): StoredSimulationModel {
  const blocks: GraphProcessBlock[] = [
    { id: 'receipt', key: 'receipt', title: 'Приём', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
    { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: ['receipt'] },
    { id: 'spin', key: 'spin', title: 'Центрифугирование', automation: 'automatic', time: { value: 8, unit: 'min' }, dependencies: ['prep'] },
    { id: 'stain', key: 'stain', title: 'Окраска', automation: 'external', time: { value: 20, unit: 'min' }, dependencies: ['spin'] },
    { id: 'qc', key: 'qc', title: 'QC', automation: 'qc', time: { value: 1, unit: 'min' }, dependencies: ['stain'] },
  ];
  return {
    name: 'Batch laboratory model',
    blocks,
    resources: [
      { id: 'operator', name: 'Оператор', capacity: 1 },
      { id: 'centrifuge', name: 'Центрифуга', capacity: 1 },
      { id: 'stainer', name: 'Stainer', capacity: 1 },
      { id: 'qc', name: 'QC', capacity: 1 },
    ],
    requirementsByBlock: {
      receipt: [{ resourceId: 'operator', units: 1 }],
      prep: [{ resourceId: 'operator', units: 1 }],
      spin: [{ resourceId: 'centrifuge', units: 1 }],
      stain: [{ resourceId: 'stainer', units: 1 }],
      qc: [{ resourceId: 'qc', units: 1 }],
    },
    batchSize: 12,
    releaseIntervalSeconds: 0,
  };
}

function loadSimulationModel(): StoredSimulationModel {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSimulationModel;
      if (Array.isArray(parsed.blocks) && Array.isArray(parsed.resources)) return parsed;
    }
  } catch {
    // Fallback below.
  }
  return fallbackModel();
}

function loadBatchConfigs(blocks: GraphProcessBlock[]): ProcessBatchConfig[] {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProcessBatchConfig[];
      if (Array.isArray(parsed)) return parsed.filter(item => blocks.some(block => block.id === item.blockId));
    }
  } catch {
    // Start empty.
  }
  return [];
}

export default function ProcessBatchApp() {
  const initialModel = useMemo(loadSimulationModel, []);
  const [model, setModel] = useState(initialModel);
  const [configs, setConfigs] = useState<ProcessBatchConfig[]>(() => loadBatchConfigs(initialModel.blocks));
  const [notice, setNotice] = useState('');

  const simulation = useMemo(() => simulateBatchCycleProcess(model.blocks, {
    batchSize: model.batchSize,
    releaseIntervalSeconds: model.releaseIntervalSeconds,
    resources: model.resources,
    requirementsByBlock: model.requirementsByBlock,
    batchConfigs: configs,
  }), [model, configs]);

  const persistConfigs = (next: ProcessBatchConfig[]) => localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(next));

  const reload = () => {
    const next = loadSimulationModel();
    setModel(next);
    const retained = configs.filter(config => next.blocks.some(block => block.id === config.blockId));
    setConfigs(retained);
    persistConfigs(retained);
    setNotice('Ресурсная Simulation-модель перечитана');
  };

  const toggleBatch = (blockId: string) => {
    setConfigs(current => {
      const exists = current.some(config => config.blockId === blockId);
      const next = exists
        ? current.filter(config => config.blockId !== blockId)
        : [...current, { blockId, batchCapacity: Math.min(12, Math.max(2, model.batchSize)), minBatchSize: 1, maxWaitSeconds: 0 }];
      persistConfigs(next);
      return next;
    });
  };

  const updateConfig = (blockId: string, patch: Partial<ProcessBatchConfig>) => {
    setConfigs(current => {
      const next = current.map(config => {
        if (config.blockId !== blockId) return config;
        const capacity = Math.max(1, Math.floor(Number(patch.batchCapacity ?? config.batchCapacity) || 1));
        return {
          ...config,
          ...patch,
          batchCapacity: capacity,
          minBatchSize: Math.min(capacity, Math.max(1, Math.floor(Number(patch.minBatchSize ?? config.minBatchSize) || 1))),
          maxWaitSeconds: Math.max(0, Number(patch.maxWaitSeconds ?? config.maxWaitSeconds) || 0),
        };
      });
      persistConfigs(next);
      return next;
    });
  };

  const maxTimeline = Math.max(1, simulation.stats.makespanSeconds);
  const visibleCycles = simulation.batchCycles.slice(0, 80);

  return (
    <div className="batch-app">
      <style>{`
        :root{color-scheme:light}*{box-sizing:border-box}body{margin:0}.batch-app{min-height:100vh;background:#F7F8FB;color:#0F172A;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.batch-top{position:sticky;top:0;z-index:30;background:rgba(247,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #E2E8F0}.batch-top-inner{max-width:1800px;margin:auto;padding:13px 20px;display:flex;gap:10px;align-items:center}.batch-mark{width:40px;height:40px;border-radius:12px;background:#0F172A;color:#fff;display:grid;place-items:center;font-weight:900}.batch-brand b{display:block;font-size:14px}.batch-brand span{display:block;color:#64748B;font-size:11px}.batch-nav{margin-left:auto;display:flex;gap:6px}.batch-btn{border:1px solid #CBD5E1;background:#fff;color:#334155;border-radius:9px;padding:9px 11px;cursor:pointer;font:inherit;font-size:11px;font-weight:800}.batch-hero,.batch-toolbar,.batch-grid{max-width:1800px;margin:auto}.batch-hero{padding:28px 20px 12px}.batch-eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:900;color:#64748B}.batch-hero h1{font-size:clamp(28px,4vw,48px);letter-spacing:-.045em;line-height:1.04;margin:7px 0 8px}.batch-hero p{max-width:1100px;color:#475569;line-height:1.6;margin:0}.batch-toolbar{padding:10px 20px 18px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}.batch-model{border:1px solid #E2E8F0;background:#fff;border-radius:9px;padding:9px 11px;font-size:11px;color:#475569}.batch-notice{font-size:10px;color:#475569}.batch-grid{padding:0 20px 36px;display:grid;grid-template-columns:minmax(380px,.9fr) minmax(560px,1.45fr);gap:16px}.batch-panel{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:14px;box-shadow:0 6px 18px rgba(15,23,42,.04)}.batch-panel h2{margin:0 0 10px;font-size:16px}.batch-panel h3{margin:14px 0 8px;font-size:12px}.batch-stage{border:1px solid #E2E8F0;border-radius:11px;padding:9px;margin:7px 0}.batch-stage-head{display:flex;gap:7px;align-items:center}.batch-stage-head b{font-size:10px}.batch-stage-head small{margin-left:auto;color:#64748B;font-size:8px}.batch-config{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.batch-field{display:flex;flex-direction:column;gap:3px}.batch-field label{font-size:8px;text-transform:uppercase;color:#64748B;font-weight:900;letter-spacing:.05em}.batch-field input{width:100%;border:1px solid #CBD5E1;border-radius:7px;padding:6px;font:inherit;font-size:10px}.batch-check{display:flex;align-items:center;gap:6px;font-size:9px;color:#475569}.batch-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.batch-kpi{border:1px solid #E2E8F0;background:#F8FAFC;border-radius:11px;padding:10px}.batch-kpi span{display:block;text-transform:uppercase;letter-spacing:.06em;color:#64748B;font-size:8px;font-weight:900}.batch-kpi b{display:block;margin-top:4px;font-size:15px}.batch-error{padding:8px;border:1px solid #FECACA;background:#FEF2F2;color:#991B1B;border-radius:9px;font-size:10px;margin:6px 0}.batch-warning{padding:8px;border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;border-radius:9px;font-size:9px;margin:6px 0}.batch-table{width:100%;border-collapse:collapse;font-size:9px}.batch-table th,.batch-table td{text-align:left;padding:7px 6px;border-bottom:1px solid #EEF2F7}.batch-table th{text-transform:uppercase;letter-spacing:.06em;color:#64748B;font-size:8px}.batch-util{display:grid;grid-template-columns:150px 1fr 52px;gap:7px;align-items:center;margin:6px 0;font-size:9px}.batch-track{height:8px;background:#E2E8F0;border-radius:99px;overflow:hidden}.batch-fill{height:100%;background:#0F172A}.batch-timeline{border:1px solid #E2E8F0;border-radius:10px;padding:8px;background:#FAFBFC}.batch-cycle-row{display:grid;grid-template-columns:130px 1fr 52px;gap:7px;align-items:center;margin:4px 0}.batch-cycle-label{font-size:8px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.batch-time-track{height:16px;background:#F1F5F9;border-radius:4px;position:relative}.batch-time-bar{position:absolute;top:1px;height:14px;border-radius:4px;background:#8B5CF6}.batch-fill-label{font-size:8px;font-weight:800;color:#6D28D9}.batch-note{font-size:9px;color:#64748B;line-height:1.5;margin-top:8px}@media(max-width:1050px){.batch-grid{grid-template-columns:1fr}.batch-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="batch-top"><div className="batch-top-inner"><div className="batch-mark">B×N</div><div className="batch-brand"><b>Batch-Cycle Process Simulation</b><span>корзины · роторы · rack cycles · fill rate</span></div><div className="batch-nav"><button className="batch-btn" onClick={() => { window.location.href='/?view=process-sim'; }}>Simulation</button><button className="batch-btn" onClick={() => { window.location.href='/?view=process-risk'; }}>Risk</button><button className="batch-btn" onClick={() => { window.location.href='/'; }}>AutoTrace</button></div></div></header>

      <section className="batch-hero"><div className="batch-eyebrow">AutoTrace · synchronized batch scheduling</div><h1>Операции, запускаемые корзиной или партией</h1><p>Обычная resource simulation считает каждую пробу отдельной операцией. Здесь выбранный блок запускается единым циклом для группы образцов: задаются вместимость партии, минимальное число для запуска и максимальное допустимое ожидание набора batch.</p></section>

      <section className="batch-toolbar"><div className="batch-model">Модель: <b>{model.name}</b> · {model.batchSize} образцов · arrival interval {model.releaseIntervalSeconds} сек</div><button className="batch-btn" onClick={reload}>↻ перечитать Simulation</button>{notice && <span className="batch-notice">{notice}</span>}</section>

      <main className="batch-grid">
        <section className="batch-panel"><h2>Batch-политика по этапам</h2><p className="batch-note">Batch capacity — сколько образцов помещается в один технологический цикл. Min batch — сколько желательно дождаться до старта. Max wait — сколько первая готовая проба может ждать набора партии; после таймаута разрешается неполный запуск.</p>{model.blocks.map(block => {
          const config = configs.find(item => item.blockId === block.id);
          return <div className="batch-stage" key={block.id}><div className="batch-stage-head"><label className="batch-check"><input type="checkbox" checked={Boolean(config)} onChange={() => toggleBatch(block.id)} />Batch cycle</label><b>{block.title}</b><small>{block.time.formula ? `ƒ ${block.time.formula}` : `${block.time.value ?? '?'} ${block.time.unit}`}</small></div>{config && <div className="batch-config"><div className="batch-field"><label>Вместимость</label><input type="number" min="1" value={config.batchCapacity} onChange={event => updateConfig(block.id, { batchCapacity: Number(event.target.value) })} /></div><div className="batch-field"><label>Min batch</label><input type="number" min="1" max={config.batchCapacity} value={config.minBatchSize} onChange={event => updateConfig(block.id, { minBatchSize: Number(event.target.value) })} /></div><div className="batch-field"><label>Max wait, сек</label><input type="number" min="0" value={config.maxWaitSeconds} onChange={event => updateConfig(block.id, { maxWaitSeconds: Number(event.target.value) })} /></div></div>}</div>;
        })}</section>

        <section className="batch-panel"><h2>Результат batch simulation</h2>{simulation.errors.map(error => <div className="batch-error" key={error}>{error}</div>)}{simulation.warnings.map(warning => <div className="batch-warning" key={warning}>{warning}</div>)}{simulation.ok && <><div className="batch-kpis"><div className="batch-kpi"><span>Makespan</span><b>{formatDuration(simulation.stats.makespanSeconds)}</b></div><div className="batch-kpi"><span>Throughput</span><b>{simulation.stats.throughputPerHour == null ? '—' : `${roundSmart(simulation.stats.throughputPerHour)}/ч`}</b></div><div className="batch-kpi"><span>Batch cycles</span><b>{simulation.stats.batchCycles}</b></div><div className="batch-kpi"><span>Avg fill</span><b>{roundSmart(simulation.stats.averageBatchFillPercent)}%</b></div><div className="batch-kpi"><span>Partial cycles</span><b>{simulation.stats.partialBatchCycles}</b></div><div className="batch-kpi"><span>Avg cycle time</span><b>{formatDuration(simulation.stats.averageCycleSeconds)}</b></div><div className="batch-kpi"><span>P95 cycle</span><b>{formatDuration(simulation.stats.p95CycleSeconds)}</b></div><div className="batch-kpi"><span>Avg wait/op</span><b>{formatDuration(simulation.stats.averageWaitSeconds)}</b></div></div>

          <h3>Эффективность batch-этапов</h3><table className="batch-table"><thead><tr><th>Этап</th><th>Циклов</th><th>Avg batch</th><th>Avg fill</th><th>Partial</th><th>Avg wait</th><th>Max wait</th></tr></thead><tbody>{simulation.batchBlockStats.map(stat => <tr key={stat.blockId}><td>{stat.blockTitle}</td><td>{stat.cycles}</td><td>{roundSmart(stat.averageBatchSize)}</td><td>{roundSmart(stat.averageFillPercent)}%</td><td>{stat.partialCycles}</td><td>{formatDuration(stat.averageWaitSeconds)}</td><td>{formatDuration(stat.maxWaitSeconds)}</td></tr>)}</tbody></table>

          <h3>Загрузка ресурсов</h3>{simulation.resourceStats.map(resource => <div className="batch-util" key={resource.id}><span>{resource.name} × {resource.capacity}</span><div className="batch-track"><div className="batch-fill" style={{ width:`${Math.min(100,resource.utilizationPercent)}%` }} /></div><b>{roundSmart(resource.utilizationPercent)}%</b></div>)}

          <h3>Batch timeline</h3><div className="batch-timeline">{visibleCycles.map(cycle => <div className="batch-cycle-row" key={cycle.batchId}><div className="batch-cycle-label">{cycle.blockTitle} · n={cycle.jobIndexes.length}</div><div className="batch-time-track"><div className="batch-time-bar" title={`start ${formatDuration(cycle.startSeconds)} · finish ${formatDuration(cycle.finishSeconds)} · jobs ${cycle.jobIndexes.map(i=>i+1).join(', ')}`} style={{ left:`${(cycle.startSeconds/maxTimeline)*100}%`, width:`${Math.max(.4,(cycle.durationSeconds/maxTimeline)*100)}%` }} /></div><span className="batch-fill-label">{roundSmart(cycle.fillPercent)}%</span></div>)}</div>
          <div className="batch-note">Batch operation резервирует требуемое оборудование один раз на весь цикл. Все образцы внутри цикла получают одинаковый start/finish, но их индивидуальное ожидание считается от собственного ready time.</div>
        </>}</section>
      </main>
    </div>
  );
}
