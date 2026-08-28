import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock } from './processGraphMath';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { ProcessBatchConfig } from './processBatchSimulation';
import { ProcessBlockUncertainty } from './processRisk';
import { DigitalTwinArrivalKind, DigitalTwinReworkPolicy } from './processDigitalTwin';
import { ProcessResourceCalendarPolicy } from './processResourceCalendar';
import { ResourceFailurePolicy } from './processReliability';
import { simulateUnifiedStochasticBatchTwin } from './processUnifiedTwin';

interface StoredSimulationModel {
  name: string;
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock: Record<string, ProcessResourceRequirement[]>;
  batchSize: number;
  releaseIntervalSeconds: number;
}

interface CalendarUi {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

interface ReliabilityUi {
  mtbfHours: number;
  mttrHours: number;
}

const SIM_STORAGE_KEY = 'autotrace:resource-simulation:v1';
const BATCH_STORAGE_KEY = 'autotrace:batch-simulation:v1';
const HOUR = 3600;
const DAY = 24 * HOUR;

function fallbackModel(): StoredSimulationModel {
  const blocks: GraphProcessBlock[] = [
    { id: 'receipt', key: 'receipt', title: 'Приём', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
    { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 2, unit: 'min' }, dependencies: ['receipt'] },
    { id: 'spin', key: 'spin', title: 'Центрифугирование', automation: 'automatic', time: { value: 8, unit: 'min' }, dependencies: ['prep'] },
    { id: 'stain', key: 'stain', title: 'Pap-окраска', automation: 'external', time: { value: 20, unit: 'min' }, dependencies: ['spin'] },
    { id: 'qc', key: 'qc', title: 'QC', automation: 'qc', time: { value: 1, unit: 'min' }, dependencies: ['stain'] },
  ];
  return {
    name: 'Unified LBC process model',
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
    batchSize: 24,
    releaseIntervalSeconds: 30,
  };
}

function loadModel(): StoredSimulationModel {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSimulationModel;
      if (Array.isArray(parsed.blocks) && Array.isArray(parsed.resources)) return parsed;
    }
  } catch {
    // fallback
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
    // defaults below
  }
  return blocks
    .filter(block => /центриф|spin|stain|окраск/i.test(`${block.id} ${block.title}`))
    .map(block => ({ blockId: block.id, batchCapacity: /stain|окраск/i.test(`${block.id} ${block.title}`) ? 20 : 12, minBatchSize: 1, maxWaitSeconds: 600 }));
}

function initialCalendars(resources: ProcessResource[]): Record<string, CalendarUi> {
  return Object.fromEntries(resources.map(resource => [resource.id, {
    enabled: resource.id === 'operator',
    startHour: 8,
    endHour: 17,
  }]));
}

function initialReliability(resources: ProcessResource[]): Record<string, ReliabilityUi> {
  return Object.fromEntries(resources.map(resource => [resource.id, { mtbfHours: 0, mttrHours: 0 }]));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(95, Number(value) || 0));
}

export default function ProcessUnifiedTwinApp() {
  const model = useMemo(loadModel, []);
  const [jobs, setJobs] = useState(Math.max(1, model.batchSize || 24));
  const [seed, setSeed] = useState(20260828);
  const [arrivalKind, setArrivalKind] = useState<DigitalTwinArrivalKind>('fixed');
  const [arrivalSeconds, setArrivalSeconds] = useState(Math.max(0, model.releaseIntervalSeconds || 30));
  const [statEveryN, setStatEveryN] = useState(0);
  const [batchConfigs, setBatchConfigs] = useState<ProcessBatchConfig[]>(() => loadBatchConfigs(model.blocks));
  const [spreadByBlock, setSpreadByBlock] = useState<Record<string, number>>(() => Object.fromEntries(model.blocks.map(block => [block.id, 10])));
  const [reworkByBlockPercent, setReworkByBlockPercent] = useState<Record<string, number>>(() => Object.fromEntries(model.blocks.map(block => [block.id, 0])));
  const [calendarByResource, setCalendarByResource] = useState<Record<string, CalendarUi>>(() => initialCalendars(model.resources));
  const [reliabilityByResource, setReliabilityByResource] = useState<Record<string, ReliabilityUi>>(() => initialReliability(model.resources));

  const uncertaintyByBlock = useMemo<Record<string, ProcessBlockUncertainty>>(() => Object.fromEntries(model.blocks.map(block => {
    const spread = clampPercent(spreadByBlock[block.id] || 0) / 100;
    return [block.id, spread > 0 ? { kind: 'triangular', minFactor: 1 - spread, modeFactor: 1, maxFactor: 1 + spread } : { kind: 'fixed' }];
  })), [model.blocks, spreadByBlock]);

  const reworkByBlock = useMemo<Record<string, DigitalTwinReworkPolicy>>(() => {
    const result: Record<string, DigitalTwinReworkPolicy> = {};
    for (const block of model.blocks) {
      const probability = Math.max(0, Math.min(100, reworkByBlockPercent[block.id] || 0)) / 100;
      if (probability > 0) result[block.id] = { probability, maxRepeats: 1 };
    }
    return result;
  }, [model.blocks, reworkByBlockPercent]);

  const resourceCalendars = useMemo<Record<string, ProcessResourceCalendarPolicy>>(() => {
    const result: Record<string, ProcessResourceCalendarPolicy> = {};
    for (const resource of model.resources) {
      const config = calendarByResource[resource.id];
      if (!config?.enabled || config.endHour <= config.startHour) continue;
      result[resource.id] = {
        cycleSeconds: DAY,
        workingWindows: [{ startOffsetSeconds: config.startHour * HOUR, endOffsetSeconds: config.endHour * HOUR }],
      };
    }
    return result;
  }, [model.resources, calendarByResource]);

  const failurePolicies = useMemo<ResourceFailurePolicy[]>(() => model.resources.flatMap(resource => {
    const config = reliabilityByResource[resource.id];
    if (!config || config.mtbfHours <= 0 || config.mttrHours <= 0) return [];
    return [{
      resourceId: resource.id,
      mtbfSeconds: config.mtbfHours * HOUR,
      mttrSeconds: config.mttrHours * HOUR,
      repairDistribution: 'triangular' as const,
      repairSpreadPercent: 20,
    }];
  }), [model.resources, reliabilityByResource]);

  const simulation = useMemo(() => simulateUnifiedStochasticBatchTwin(model.blocks, {
    jobs,
    seed,
    arrivals: arrivalKind === 'poisson'
      ? { kind: 'poisson', meanIntervalSeconds: Math.max(0.001, arrivalSeconds) }
      : { kind: 'fixed', intervalSeconds: Math.max(0, arrivalSeconds) },
    resources: model.resources,
    requirementsByBlock: model.requirementsByBlock,
    uncertaintyByBlock,
    reworkByBlock,
    batchConfigs,
    resourceCalendars,
    failurePolicies,
    priority: { statEveryN, statPriority: 100, routinePriority: 0 },
  }), [model, jobs, seed, arrivalKind, arrivalSeconds, statEveryN, uncertaintyByBlock, reworkByBlock, batchConfigs, resourceCalendars, failurePolicies]);

  const toggleBatch = (blockId: string) => {
    setBatchConfigs(current => current.some(item => item.blockId === blockId)
      ? current.filter(item => item.blockId !== blockId)
      : [...current, { blockId, batchCapacity: 12, minBatchSize: 1, maxWaitSeconds: 600 }]);
  };

  const updateBatch = (blockId: string, patch: Partial<ProcessBatchConfig>) => {
    setBatchConfigs(current => current.map(item => {
      if (item.blockId !== blockId) return item;
      const capacity = Math.max(1, Math.floor(Number(patch.batchCapacity ?? item.batchCapacity) || 1));
      return {
        ...item,
        ...patch,
        batchCapacity: capacity,
        minBatchSize: Math.min(capacity, Math.max(1, Math.floor(Number(patch.minBatchSize ?? item.minBatchSize) || 1))),
        maxWaitSeconds: Math.max(0, Number(patch.maxWaitSeconds ?? item.maxWaitSeconds) || 0),
      };
    }));
  };

  const maxTimeline = Math.max(1, simulation.stats.makespanSeconds);

  return <div className="ut-app">
    <style>{`
      *{box-sizing:border-box}body{margin:0}.ut-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ut-top{position:sticky;top:0;z-index:30;background:rgba(246,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.ut-topin{max-width:1900px;margin:auto;padding:13px 20px;display:flex;gap:10px;align-items:center}.ut-mark{width:42px;height:42px;border-radius:13px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.ut-brand b{display:block;font-size:14px}.ut-brand span{display:block;font-size:10px;color:#64748b}.ut-nav{margin-left:auto;display:flex;gap:6px}.ut-btn{border:1px solid #cbd5e1;background:white;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.ut-main{max-width:1900px;margin:auto;padding:24px 20px 60px}.ut-hero h1{font-size:clamp(28px,4vw,48px);letter-spacing:-.045em;line-height:1.04;margin:6px 0 8px}.ut-hero p{max-width:1100px;margin:0;color:#475569;line-height:1.6}.ut-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.14em;font-weight:900;color:#64748b}.ut-controls{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;background:#fff;border:1px solid #e2e8f0;padding:12px;border-radius:14px}.ut-field{display:flex;flex-direction:column;gap:3px}.ut-field label{font-size:8px;color:#64748b;font-weight:900;text-transform:uppercase}.ut-input,.ut-select{border:1px solid #cbd5e1;border-radius:8px;background:white;padding:7px 8px;font:inherit;font-size:10px;min-height:33px}.ut-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px;margin-top:12px}.ut-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:11px}.ut-kpi span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:900}.ut-kpi b{display:block;margin-top:4px;font-size:18px}.ut-grid{display:grid;grid-template-columns:minmax(390px,.9fr) minmax(600px,1.4fr);gap:14px;margin-top:14px}.ut-panel{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:13px}.ut-panel h2{margin:0 0 10px;font-size:14px}.ut-stage,.ut-resource{border:1px solid #e2e8f0;border-radius:10px;padding:9px;margin:7px 0;background:#fbfcfe}.ut-head{display:flex;gap:7px;align-items:center}.ut-head b{font-size:10px}.ut-head small{margin-left:auto;color:#64748b;font-size:8px}.ut-row{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}.ut-row label{font-size:7px;color:#64748b;font-weight:800}.ut-row input{width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:6px;font-size:9px}.ut-check{display:flex;align-items:center;gap:4px;font-size:8px;color:#475569}.ut-table{width:100%;border-collapse:collapse;font-size:9px}.ut-table th,.ut-table td{text-align:left;padding:6px;border-bottom:1px solid #edf2f7}.ut-table th{font-size:7px;text-transform:uppercase;color:#64748b;letter-spacing:.06em}.ut-track{height:7px;background:#e2e8f0;border-radius:99px;overflow:hidden}.ut-track i{display:block;height:100%;background:#0f172a}.ut-cycle{display:grid;grid-template-columns:115px 1fr 48px;gap:6px;align-items:center;margin:4px 0}.ut-time{height:15px;background:#f1f5f9;border-radius:4px;position:relative}.ut-time i{position:absolute;top:1px;height:13px;background:#8b5cf6;border-radius:3px}.ut-note{font-size:9px;color:#64748b;line-height:1.5}.ut-error{margin-top:10px;padding:9px;border-radius:9px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-size:9px}@media(max-width:1100px){.ut-grid{grid-template-columns:1fr}.ut-row{grid-template-columns:repeat(2,1fr)}}
    `}</style>
    <header className="ut-top"><div className="ut-topin"><div className="ut-mark">U×</div><div className="ut-brand"><b>Unified Stochastic Batch Twin</b><span>sample stochasticity · batch cycles · calendars · STAT · rework · MTBF/MTTR</span></div><div className="ut-nav"><button className="ut-btn" onClick={() => { window.location.href='/?view=process-digital-twin'; }}>Digital Twin</button><button className="ut-btn" onClick={() => { window.location.href='/?view=process-batch'; }}>Batch</button><button className="ut-btn" onClick={() => { window.location.href='/'; }}>Canvas</button></div></div></header>
    <main className="ut-main">
      <section className="ut-hero"><div className="ut-eyebrow">AutoTrace · unified discrete-event scheduler</div><h1>Единый цифровой двойник лабораторной линии</h1><p>Один scheduler одновременно формирует партии, резервирует оборудование, соблюдает смены, моделирует индивидуальную вариабельность проб, STAT-приоритет, повторную обработку и случайные ремонты оборудования.</p></section>
      <section className="ut-controls">
        <div className="ut-field"><label>Модель</label><div className="ut-input" style={{minWidth:230}}>{model.name}</div></div>
        <div className="ut-field"><label>Проб</label><input className="ut-input" type="number" min={1} max={5000} value={jobs} onChange={e => setJobs(Math.max(1, Number(e.target.value)||1))}/></div>
        <div className="ut-field"><label>Seed</label><input className="ut-input" type="number" value={seed} onChange={e => setSeed(Number(e.target.value)||0)}/></div>
        <div className="ut-field"><label>Поступление</label><select className="ut-select" value={arrivalKind} onChange={e => setArrivalKind(e.target.value as DigitalTwinArrivalKind)}><option value="fixed">fixed</option><option value="poisson">Poisson</option></select></div>
        <div className="ut-field"><label>Интервал, сек</label><input className="ut-input" type="number" min={0} value={arrivalSeconds} onChange={e => setArrivalSeconds(Math.max(0,Number(e.target.value)||0))}/></div>
        <div className="ut-field"><label>STAT каждая N-я</label><input className="ut-input" type="number" min={0} value={statEveryN} onChange={e => setStatEveryN(Math.max(0,Math.floor(Number(e.target.value)||0)))}/></div>
      </section>

      {simulation.ok ? <div className="ut-kpis">
        <div className="ut-kpi"><span>Makespan</span><b>{formatDuration(simulation.stats.makespanSeconds)}</b></div>
        <div className="ut-kpi"><span>Cycle P95</span><b>{formatDuration(simulation.stats.p95CycleSeconds)}</b></div>
        <div className="ut-kpi"><span>Throughput</span><b>{simulation.stats.throughputPerHour == null ? '—' : `${roundSmart(simulation.stats.throughputPerHour)}/ч`}</b></div>
        <div className="ut-kpi"><span>Batch cycles</span><b>{simulation.stats.batchCycles}</b></div>
        <div className="ut-kpi"><span>Avg fill</span><b>{roundSmart(simulation.stats.averageBatchFillPercent)}%</b></div>
        <div className="ut-kpi"><span>Partial cycles</span><b>{simulation.stats.partialBatchCycles}</b></div>
        <div className="ut-kpi"><span>Rework</span><b>{roundSmart(simulation.stats.reworkRatePercent)}%</b></div>
        <div className="ut-kpi"><span>Bottleneck</span><b style={{fontSize:13}}>{simulation.stats.resourceBottleneckName || '—'}</b></div>
      </div> : <div className="ut-error">{simulation.errors.join(' · ')}</div>}

      <div className="ut-grid">
        <section className="ut-panel"><h2>Этапы: stochasticity · rework · batch</h2>{model.blocks.map(stage => {
          const config = batchConfigs.find(item => item.blockId === stage.id);
          return <div className="ut-stage" key={stage.id}><div className="ut-head"><label className="ut-check"><input type="checkbox" checked={Boolean(config)} onChange={() => toggleBatch(stage.id)}/>batch</label><b>{stage.title}</b><small>{stage.id}</small></div><div className="ut-row">
            <label>Разброс ±%<input type="number" min={0} max={95} value={spreadByBlock[stage.id]||0} onChange={e=>setSpreadByBlock(current=>({...current,[stage.id]:clampPercent(Number(e.target.value))}))}/></label>
            <label>Rework %<input type="number" min={0} max={100} value={reworkByBlockPercent[stage.id]||0} onChange={e=>setReworkByBlockPercent(current=>({...current,[stage.id]:Math.max(0,Math.min(100,Number(e.target.value)||0))}))}/></label>
            {config ? <><label>Capacity<input type="number" min={1} value={config.batchCapacity} onChange={e=>updateBatch(stage.id,{batchCapacity:Number(e.target.value)})}/></label><label>Min / wait s<input type="text" value={`${config.minBatchSize} / ${config.maxWaitSeconds}`} onChange={e=>{const [min,wait]=e.target.value.split('/').map(Number);updateBatch(stage.id,{minBatchSize:min,maxWaitSeconds:wait});}}/></label></> : <><span/><span/></>}
          </div></div>;
        })}

        <h2 style={{marginTop:16}}>Ресурсы: смены · MTBF/MTTR</h2>{model.resources.map(resource => {
          const calendar = calendarByResource[resource.id];
          const reliability = reliabilityByResource[resource.id];
          return <div className="ut-resource" key={resource.id}><div className="ut-head"><label className="ut-check"><input type="checkbox" checked={Boolean(calendar?.enabled)} onChange={e=>setCalendarByResource(current=>({...current,[resource.id]:{...(current[resource.id]||{startHour:8,endHour:17}),enabled:e.target.checked}}))}/>смена</label><b>{resource.name}</b><small>capacity {resource.capacity}</small></div><div className="ut-row">
            <label>Начало, ч<input type="number" min={0} max={24} value={calendar?.startHour??8} onChange={e=>setCalendarByResource(current=>({...current,[resource.id]:{...(current[resource.id]||{enabled:false,endHour:17}),startHour:Number(e.target.value)}}))}/></label>
            <label>Конец, ч<input type="number" min={0} max={24} value={calendar?.endHour??17} onChange={e=>setCalendarByResource(current=>({...current,[resource.id]:{...(current[resource.id]||{enabled:false,startHour:8}),endHour:Number(e.target.value)}}))}/></label>
            <label>MTBF, ч<input type="number" min={0} value={reliability?.mtbfHours??0} onChange={e=>setReliabilityByResource(current=>({...current,[resource.id]:{...(current[resource.id]||{mttrHours:0}),mtbfHours:Math.max(0,Number(e.target.value)||0)}}))}/></label>
            <label>MTTR, ч<input type="number" min={0} value={reliability?.mttrHours??0} onChange={e=>setReliabilityByResource(current=>({...current,[resource.id]:{...(current[resource.id]||{mtbfHours:0}),mttrHours:Math.max(0,Number(e.target.value)||0)}}))}/></label>
          </div></div>;
        })}</section>

        <section className="ut-panel"><h2>Результат единого scheduler</h2>{simulation.warnings.map(warning=><div className="ut-note" key={warning}>⚠ {warning}</div>)}{simulation.ok && <>
          <table className="ut-table"><thead><tr><th>Ресурс</th><th>Utilization</th><th>Availability</th><th>Failures</th></tr></thead><tbody>{simulation.resourceStats.map(resource=><tr key={resource.id}><td>{resource.name}</td><td><div className="ut-track"><i style={{width:`${Math.min(100,resource.utilizationPercent)}%`}}/></div>{roundSmart(resource.utilizationPercent)}%</td><td>{roundSmart(resource.availabilityPercent)}%</td><td>{resource.generatedFailureWindows}</td></tr>)}</tbody></table>
          <h2 style={{marginTop:16}}>Batch cycles</h2>{simulation.batchCycles.slice(0,80).map(cycle=><div className="ut-cycle" key={cycle.batchId}><span className="ut-note">{cycle.blockTitle} · n={cycle.jobIndexes.length}</span><div className="ut-time"><i style={{left:`${(cycle.startSeconds/maxTimeline)*100}%`,width:`${Math.max(.3,((cycle.finishSeconds-cycle.startSeconds)/maxTimeline)*100)}%`}}/></div><span className="ut-note">{roundSmart(cycle.fillPercent)}%</span></div>)}
          <h2 style={{marginTop:16}}>Статистика этапов</h2><table className="ut-table"><thead><tr><th>Этап</th><th>Runs</th><th>Wait avg</th><th>Rework</th><th>Cycles / fill</th></tr></thead><tbody>{simulation.blockStats.map(stage=><tr key={stage.blockId}><td>{stage.blockTitle}</td><td>{stage.runs}</td><td>{formatDuration(stage.averageWaitSeconds)}</td><td>{roundSmart(stage.reworkRatePercent)}%</td><td>{stage.batchCycles ? `${stage.batchCycles} / ${roundSmart(stage.averageBatchFillPercent)}%` : '—'}</td></tr>)}</tbody></table>
        </>}</section>
      </div>
    </main>
  </div>;
}
