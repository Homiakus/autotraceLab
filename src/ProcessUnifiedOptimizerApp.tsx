import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock } from './processGraphMath';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { ProcessBatchConfig } from './processBatchSimulation';
import { optimizeUnifiedBatchPolicy, UnifiedOptimizerWeights } from './processUnifiedOptimizer';

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
  return {
    name: 'Optimizer demo',
    blocks: [{ id: 'spin', key: 'spin', title: 'Центрифугирование', automation: 'automatic', time: { value: 8, unit: 'min' }, dependencies: [] }],
    resources: [{ id: 'centrifuge', name: 'Центрифуга', capacity: 1 }],
    requirementsByBlock: { spin: [{ resourceId: 'centrifuge', units: 1 }] },
    batchSize: 24,
    releaseIntervalSeconds: 60,
  };
}

function loadModel(): StoredSimulationModel {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSimulationModel;
      if (Array.isArray(parsed.blocks) && Array.isArray(parsed.resources)) return parsed;
    }
  } catch { /* fallback */ }
  return fallbackModel();
}

function loadConfigs(model: StoredSimulationModel): ProcessBatchConfig[] {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProcessBatchConfig[];
      if (Array.isArray(parsed) && parsed.length) return parsed.filter(item => model.blocks.some(block => block.id === item.blockId));
    }
  } catch { /* defaults */ }
  return model.blocks.filter(block => /spin|центриф|stain|окраск/i.test(`${block.id} ${block.title}`)).map(block => ({ blockId: block.id, batchCapacity: 12, minBatchSize: 1, maxWaitSeconds: 600 }));
}

export default function ProcessUnifiedOptimizerApp() {
  const model = useMemo(loadModel, []);
  const [configs, setConfigs] = useState<ProcessBatchConfig[]>(() => loadConfigs(model));
  const [jobs, setJobs] = useState(Math.max(1, model.batchSize || 24));
  const [arrivalSeconds, setArrivalSeconds] = useState(Math.max(0, model.releaseIntervalSeconds || 60));
  const [slaMinutes, setSlaMinutes] = useState(60);
  const [maxScenarios, setMaxScenarios] = useState(500);
  const [weights, setWeights] = useState<UnifiedOptimizerWeights>({ throughput: 20, p95Cycle: 20, averageWait: 15, batchFill: 20, partialCycles: 10, sla: 15 });
  const [notice, setNotice] = useState('');

  const result = useMemo(() => optimizeUnifiedBatchPolicy(model.blocks, {
    jobs,
    seed: 20260828,
    arrivals: { kind: 'fixed', intervalSeconds: arrivalSeconds },
    resources: model.resources,
    requirementsByBlock: model.requirementsByBlock,
    batchConfigs: configs,
  }, {
    searches: configs.map(config => ({
      blockId: config.blockId,
      minBatchValues: [1, Math.ceil(config.batchCapacity / 2), config.batchCapacity],
      maxWaitValuesSeconds: [0, 60, 300, 600, 1200],
    })),
    maxScenarios,
    slaP95CycleSeconds: slaMinutes > 0 ? slaMinutes * 60 : null,
    weights,
  }), [model, configs, jobs, arrivalSeconds, slaMinutes, maxScenarios, weights]);

  const saveBest = () => {
    if (!result.best) return;
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(result.best.configs));
    setConfigs(result.best.configs.map(config => ({ ...config })));
    setNotice('Лучший сценарий сохранён как текущая batch policy');
  };

  const weightField = (key: keyof UnifiedOptimizerWeights, title: string) => <label className="op-field">{title}<input type="number" min={0} value={weights[key]} onChange={e => setWeights(current => ({ ...current, [key]: Math.max(0, Number(e.target.value) || 0) }))}/></label>;

  return <div className="op-app"><style>{`
    *{box-sizing:border-box}body{margin:0}.op-app{min-height:100vh;background:#f7f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.op-top{position:sticky;top:0;z-index:20;background:rgba(247,248,251,.95);border-bottom:1px solid #e2e8f0;backdrop-filter:blur(14px)}.op-topin{max-width:1800px;margin:auto;padding:13px 20px;display:flex;gap:10px;align-items:center}.op-mark{width:40px;height:40px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.op-brand b{display:block;font-size:14px}.op-brand span{display:block;font-size:10px;color:#64748b}.op-nav{margin-left:auto;display:flex;gap:6px}.op-btn{border:1px solid #cbd5e1;background:white;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:800;cursor:pointer}.op-main{max-width:1800px;margin:auto;padding:24px 20px 60px}.op-hero h1{font-size:clamp(28px,4vw,46px);letter-spacing:-.045em;margin:6px 0 8px}.op-hero p{max-width:1050px;color:#475569;line-height:1.6;margin:0}.op-eyebrow{text-transform:uppercase;font-size:9px;letter-spacing:.14em;font-weight:900;color:#64748b}.op-controls{margin-top:15px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;display:flex;flex-wrap:wrap;gap:7px}.op-field{display:flex;flex-direction:column;gap:3px;font-size:7px;color:#64748b;text-transform:uppercase;font-weight:900}.op-field input{width:105px;border:1px solid #cbd5e1;border-radius:7px;padding:7px;font-size:10px}.op-grid{display:grid;grid-template-columns:minmax(400px,.8fr) minmax(650px,1.4fr);gap:14px;margin-top:14px}.op-panel{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:13px}.op-panel h2{font-size:14px;margin:0 0 10px}.op-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.op-kpi{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:9px}.op-kpi span{display:block;font-size:7px;text-transform:uppercase;color:#64748b;font-weight:900}.op-kpi b{display:block;font-size:15px;margin-top:4px}.op-table{width:100%;border-collapse:collapse;font-size:9px}.op-table th,.op-table td{padding:6px;border-bottom:1px solid #edf2f7;text-align:left}.op-table th{font-size:7px;color:#64748b;text-transform:uppercase}.op-good{font-weight:900;color:#047857}.op-note{font-size:9px;color:#64748b;line-height:1.5}.op-config{border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:6px 0;font-size:9px}.op-config b{display:block;margin-bottom:4px}.op-warn{padding:8px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:9px;margin:5px 0}@media(max-width:1050px){.op-grid{grid-template-columns:1fr}.op-kpis{grid-template-columns:repeat(2,1fr)}}
  `}</style>
  <header className="op-top"><div className="op-topin"><div className="op-mark">OPT</div><div className="op-brand"><b>Batch Policy Optimizer</b><span>grid search · SLA · Pareto frontier</span></div><div className="op-nav"><button className="op-btn" onClick={()=>{window.location.href='/?view=process-unified-twin';}}>Unified Twin</button><button className="op-btn" onClick={()=>{window.location.href='/';}}>Canvas</button></div></div></header>
  <main className="op-main"><section className="op-hero"><div className="op-eyebrow">AutoTrace · policy optimization</div><h1>Подбор minBatch и maxWait по целям лаборатории</h1><p>Optimizer перебирает политики запуска существующих batch-блоков на одном и том же workload и ранжирует их по throughput, P95 cycle, ожиданию, заполнению корзин, числу неполных запусков и SLA.</p></section>
  <section className="op-controls"><label className="op-field">Проб<input type="number" min={1} value={jobs} onChange={e=>setJobs(Math.max(1,Number(e.target.value)||1))}/></label><label className="op-field">Arrival, сек<input type="number" min={0} value={arrivalSeconds} onChange={e=>setArrivalSeconds(Math.max(0,Number(e.target.value)||0))}/></label><label className="op-field">SLA P95, мин<input type="number" min={0} value={slaMinutes} onChange={e=>setSlaMinutes(Math.max(0,Number(e.target.value)||0))}/></label><label className="op-field">Max scenarios<input type="number" min={1} max={5000} value={maxScenarios} onChange={e=>setMaxScenarios(Math.max(1,Math.min(5000,Number(e.target.value)||1)))}/></label>{weightField('throughput','W throughput')}{weightField('p95Cycle','W P95')}{weightField('averageWait','W wait')}{weightField('batchFill','W fill')}{weightField('partialCycles','W partial')}{weightField('sla','W SLA')}</section>
  <div className="op-grid"><section className="op-panel"><h2>Search space</h2><p className="op-note">Для каждого активного batch: minBatch = 1 / 50% / capacity; maxWait = 0 / 1 / 5 / 10 / 20 мин. При нескольких batch-блоках строится декартово произведение с ограничением Max scenarios.</p>{configs.map(config=><div className="op-config" key={config.blockId}><b>{model.blocks.find(block=>block.id===config.blockId)?.title || config.blockId}</b>capacity {config.batchCapacity} · current min {config.minBatchSize} · current wait {formatDuration(config.maxWaitSeconds)}</div>)}{result.warnings.map(w=><div className="op-warn" key={w}>{w}</div>)}<p className="op-note">Generated: {result.generatedScenarios} · evaluated: {result.evaluatedScenarios} · Pareto: {result.pareto.length}</p>{result.best && <><button className="op-btn" onClick={saveBest}>Применить лучший сценарий</button>{notice && <p className="op-note">{notice}</p>}</>}</section>
  <section className="op-panel"><h2>Лучший сценарий</h2>{result.best ? <><div className="op-kpis"><div className="op-kpi"><span>Score</span><b>{roundSmart(result.best.score*100)}</b></div><div className="op-kpi"><span>P95 cycle</span><b>{formatDuration(result.best.simulation.stats.p95CycleSeconds)}</b></div><div className="op-kpi"><span>Throughput</span><b>{roundSmart(result.best.simulation.stats.throughputPerHour||0)}/ч</b></div><div className="op-kpi"><span>Avg fill</span><b>{roundSmart(result.best.simulation.stats.averageBatchFillPercent)}%</b></div></div><p className={result.best.slaMet === true?'op-good':'op-note'}>SLA: {result.best.slaMet == null?'не задан':result.best.slaMet?'PASS':'FAIL'}</p>{result.best.configs.map(config=><div className="op-config" key={config.blockId}>{config.blockId}: minBatch <b style={{display:'inline'}}>{config.minBatchSize}</b> · maxWait <b style={{display:'inline'}}>{formatDuration(config.maxWaitSeconds)}</b></div>)}<h2 style={{marginTop:16}}>Top scenarios</h2><table className="op-table"><thead><tr><th>#</th><th>Score</th><th>P95</th><th>Throughput</th><th>Wait</th><th>Fill</th><th>Pareto</th></tr></thead><tbody>{result.scenarios.slice(0,20).map(item=><tr key={item.rank}><td>{item.rank}</td><td>{roundSmart(item.score*100)}</td><td>{formatDuration(item.simulation.stats.p95CycleSeconds)}</td><td>{roundSmart(item.simulation.stats.throughputPerHour||0)}/ч</td><td>{formatDuration(item.simulation.stats.averageWaitSeconds)}</td><td>{roundSmart(item.simulation.stats.averageBatchFillPercent)}%</td><td>{item.pareto?'●':'—'}</td></tr>)}</tbody></table></> : <div className="op-warn">{result.errors.join(' · ')}</div>}</section></div>
  </main></div>;
}
