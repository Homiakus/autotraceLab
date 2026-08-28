import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock } from './processGraphMath';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { ProcessBatchConfig, simulateBatchCycleProcess } from './processBatchSimulation';
import { runBatchProcessMonteCarlo } from './processBatchRisk';

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
    { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 1, unit: 'min' }, dependencies: [] },
    { id: 'spin', key: 'spin', title: 'Центрифуга', automation: 'automatic', time: { value: 8, unit: 'min' }, dependencies: ['prep'] },
  ];
  return {
    name: 'Fallback batch risk model',
    blocks,
    resources: [
      { id: 'operator', name: 'Оператор', capacity: 1 },
      { id: 'centrifuge', name: 'Центрифуга', capacity: 1 },
    ],
    requirementsByBlock: {
      prep: [{ resourceId: 'operator', units: 1 }],
      spin: [{ resourceId: 'centrifuge', units: 1 }],
    },
    batchSize: 12,
    releaseIntervalSeconds: 0,
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
      if (Array.isArray(parsed)) return parsed.filter(config => blocks.some(block => block.id === config.blockId));
    }
  } catch {
    // fallback below
  }
  const likely = blocks.find(block => block.automation === 'automatic');
  return likely ? [{ blockId: likely.id, batchCapacity: 12, minBatchSize: 1, maxWaitSeconds: 0 }] : [];
}

function defaultUncertainty(blocks: GraphProcessBlock[]): Record<string, number> {
  return Object.fromEntries(blocks.map(block => [block.id, block.automation === 'wait' ? 0 : 10]));
}

export default function ProcessBatchRiskApp() {
  const initialModel = useMemo(loadModel, []);
  const initialBatchConfigs = useMemo(() => loadBatchConfigs(initialModel.blocks), [initialModel.blocks]);
  const [model, setModel] = useState(initialModel);
  const [batchConfigs, setBatchConfigs] = useState(initialBatchConfigs);
  const [uncertainty, setUncertainty] = useState<Record<string, number>>(() => defaultUncertainty(initialModel.blocks));
  const [iterations, setIterations] = useState(400);
  const [seed, setSeed] = useState(20260828);
  const [slaMinutes, setSlaMinutes] = useState<number | ''>('');
  const [runVersion, setRunVersion] = useState(0);
  const [committed, setCommitted] = useState(() => ({
    uncertainty: defaultUncertainty(initialModel.blocks),
    iterations: 400,
    seed: 20260828,
    slaSeconds: null as number | null,
  }));

  const simOptions = useMemo(() => ({
    batchSize: model.batchSize,
    releaseIntervalSeconds: model.releaseIntervalSeconds,
    resources: model.resources,
    requirementsByBlock: model.requirementsByBlock,
    batchConfigs,
  }), [model, batchConfigs]);

  const baseline = useMemo(() => simulateBatchCycleProcess(model.blocks, simOptions), [model.blocks, simOptions]);
  const monteCarlo = useMemo(() => {
    void runVersion;
    return runBatchProcessMonteCarlo(model.blocks, simOptions, {
      iterations: committed.iterations,
      seed: committed.seed,
      slaMakespanSeconds: committed.slaSeconds,
      uncertaintyByBlock: Object.fromEntries(model.blocks.map(block => {
        const pct = Math.max(0, committed.uncertainty[block.id] || 0) / 100;
        return [block.id, pct === 0
          ? { kind: 'fixed' as const }
          : { kind: 'triangular' as const, minFactor: Math.max(0, 1 - pct), modeFactor: 1, maxFactor: 1 + pct }];
      })),
    });
  }, [model.blocks, simOptions, committed, runVersion]);

  const reload = () => {
    const nextModel = loadModel();
    const nextBatch = loadBatchConfigs(nextModel.blocks);
    const nextUncertainty = defaultUncertainty(nextModel.blocks);
    setModel(nextModel);
    setBatchConfigs(nextBatch);
    setUncertainty(nextUncertainty);
    setCommitted(current => ({ ...current, uncertainty: nextUncertainty }));
  };

  const run = () => {
    setCommitted({
      uncertainty: { ...uncertainty },
      iterations: Math.max(1, Math.min(5000, Math.floor(iterations || 1))),
      seed: Math.floor(seed || 1),
      slaSeconds: slaMinutes === '' ? null : Math.max(0, Number(slaMinutes)) * 60,
    });
    setRunVersion(version => version + 1);
  };

  return (
    <div className="br-app">
      <style>{`
        :root{color-scheme:light}*{box-sizing:border-box}body{margin:0}.br-app{min-height:100vh;background:#F7F8FB;color:#0F172A;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.br-top{position:sticky;top:0;z-index:20;background:rgba(247,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #E2E8F0}.br-top-inner{max-width:1800px;margin:auto;padding:13px 20px;display:flex;gap:10px;align-items:center}.br-mark{width:42px;height:42px;border-radius:12px;background:#581C87;color:#fff;display:grid;place-items:center;font-weight:900}.br-brand b{display:block;font-size:14px}.br-brand span{display:block;color:#64748B;font-size:11px}.br-nav{margin-left:auto;display:flex;gap:6px}.br-btn{border:1px solid #CBD5E1;background:#fff;border-radius:9px;padding:9px 11px;cursor:pointer;font:inherit;font-size:11px;font-weight:800;color:#334155}.br-btn.primary{background:#581C87;color:#fff;border-color:#581C87}.br-hero,.br-controls,.br-grid{max-width:1800px;margin:auto}.br-hero{padding:28px 20px 12px}.br-eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:900;color:#7E22CE}.br-hero h1{font-size:clamp(28px,4vw,48px);letter-spacing:-.045em;line-height:1.04;margin:7px 0 8px}.br-hero p{max-width:1100px;color:#475569;line-height:1.6;margin:0}.br-controls{padding:10px 20px 18px;display:flex;gap:8px;align-items:end;flex-wrap:wrap}.br-model{border:1px solid #E2E8F0;background:#fff;border-radius:9px;padding:9px 11px;font-size:11px;color:#475569}.br-field{display:flex;flex-direction:column;gap:3px}.br-field label{font-size:8px;text-transform:uppercase;letter-spacing:.07em;color:#64748B;font-weight:900}.br-input{border:1px solid #CBD5E1;background:#fff;border-radius:9px;padding:9px 10px;min-height:36px;font:inherit;font-size:11px}.br-grid{padding:0 20px 36px;display:grid;grid-template-columns:minmax(360px,.8fr) minmax(580px,1.5fr);gap:16px}.br-panel{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:14px;box-shadow:0 6px 18px rgba(15,23,42,.04)}.br-panel h2{font-size:16px;margin:0 0 10px}.br-panel h3{font-size:12px;margin:14px 0 8px}.br-block{display:grid;grid-template-columns:1fr 82px 20px;gap:7px;align-items:center;padding:8px 0;border-bottom:1px solid #EEF2F7}.br-block b{font-size:10px}.br-block small{display:block;color:#64748B;font-size:8px;margin-top:2px}.br-block input{width:100%;border:1px solid #CBD5E1;border-radius:7px;padding:6px;font:inherit;font-size:10px}.br-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.br-kpi{border:1px solid #E2E8F0;background:#FAF8FF;border-radius:11px;padding:10px}.br-kpi span{display:block;text-transform:uppercase;letter-spacing:.06em;color:#64748B;font-size:8px;font-weight:900}.br-kpi b{display:block;margin-top:4px;font-size:15px}.br-error{border:1px solid #FECACA;background:#FEF2F2;color:#991B1B;border-radius:9px;padding:8px;font-size:10px;margin:6px 0}.br-warning{border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;border-radius:9px;padding:8px;font-size:9px;margin:6px 0}.br-table{width:100%;border-collapse:collapse;font-size:9px}.br-table th,.br-table td{text-align:left;padding:7px 6px;border-bottom:1px solid #EEF2F7}.br-table th{text-transform:uppercase;letter-spacing:.06em;color:#64748B;font-size:8px}.br-note{font-size:9px;color:#64748B;line-height:1.5;margin-top:8px}@media(max-width:1050px){.br-grid{grid-template-columns:1fr}.br-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="br-top"><div className="br-top-inner"><div className="br-mark">BMC</div><div className="br-brand"><b>Batch Monte Carlo Risk</b><span>uncertainty × synchronized batches</span></div><div className="br-nav"><button className="br-btn" onClick={() => { window.location.href='/?view=process-batch'; }}>Batch</button><button className="br-btn" onClick={() => { window.location.href='/?view=process-risk'; }}>Risk</button><button className="br-btn" onClick={() => { window.location.href='/'; }}>AutoTrace</button></div></div></header>

      <section className="br-hero"><div className="br-eyebrow">AutoTrace · stochastic batch scheduling</div><h1>Риск процесса с реальными batch-циклами</h1><p>Каждая Monte Carlo итерация заново строит расписание корзин/rotor/rack cycles после изменения времён этапов. Поэтому в распределение попадают не только колебания длительности, но и последствия ожидания набора партии, частичных запусков и конкуренции за оборудование.</p></section>

      <section className="br-controls"><div className="br-model">Модель: <b>{model.name}</b> · batch {model.batchSize} · batch-блоков {batchConfigs.length}</div><button className="br-btn" onClick={reload}>↻ перечитать Batch/Simulation</button><div className="br-field"><label>Итераций</label><input className="br-input" type="number" min="1" max="5000" value={iterations} onChange={event => setIterations(Math.max(1,Number(event.target.value)||1))} /></div><div className="br-field"><label>Seed</label><input className="br-input" type="number" value={seed} onChange={event => setSeed(Number(event.target.value)||1)} /></div><div className="br-field"><label>SLA makespan, мин</label><input className="br-input" type="number" min="0" placeholder="не задан" value={slaMinutes} onChange={event => setSlaMinutes(event.target.value===''?'':Number(event.target.value))} /></div><button className="br-btn primary" onClick={run}>Запустить Batch Monte Carlo</button></section>

      <main className="br-grid">
        <section className="br-panel"><h2>Неопределённость этапов</h2><div className="br-note">±% задаёт triangular uncertainty вокруг базового времени блока. Batch policy (capacity/min batch/max wait) остаётся фиксированной, а scheduler пересчитывается на каждой итерации.</div>{model.blocks.map(block => <div className="br-block" key={block.id}><div><b>{block.title}</b><small>{batchConfigs.some(config=>config.blockId===block.id)?'BATCH · ':''}{block.automation} · {block.time.formula?`ƒ ${block.time.formula}`:`${block.time.value??'?'} ${block.time.unit}`}</small></div><input type="number" min="0" max="200" value={uncertainty[block.id]??0} onChange={event=>setUncertainty(current=>({...current,[block.id]:Math.max(0,Number(event.target.value)||0)}))}/><span>±%</span></div>)}</section>

        <section className="br-panel"><h2>Распределение результата</h2>{baseline.errors.map(error=><div className="br-error" key={error}>{error}</div>)}{monteCarlo.errors.map(error=><div className="br-error" key={error}>{error}</div>)}{monteCarlo.warnings.slice(0,5).map(warning=><div className="br-warning" key={warning}>{warning}</div>)}{monteCarlo.ok&&<><div className="br-kpis"><div className="br-kpi"><span>Makespan P50</span><b>{formatDuration(monteCarlo.makespanSeconds.p50)}</b></div><div className="br-kpi"><span>Makespan P95</span><b>{formatDuration(monteCarlo.makespanSeconds.p95)}</b></div><div className="br-kpi"><span>Makespan P99</span><b>{formatDuration(monteCarlo.makespanSeconds.p99)}</b></div><div className="br-kpi"><span>SLA confidence</span><b>{monteCarlo.slaProbabilityPercent==null?'—':`${roundSmart(monteCarlo.slaProbabilityPercent)}%`}</b></div><div className="br-kpi"><span>Throughput P50</span><b>{roundSmart(monteCarlo.throughputPerHour.p50)}/ч</b></div><div className="br-kpi"><span>Cycle P95</span><b>{formatDuration(monteCarlo.averageCycleSeconds.p95)}</b></div><div className="br-kpi"><span>Fill P50</span><b>{roundSmart(monteCarlo.averageBatchFillPercent.p50)}%</b></div><div className="br-kpi"><span>Partial cycles P95</span><b>{roundSmart(monteCarlo.partialBatchCycles.p95)}</b></div></div>

          <h3>Детерминированная база vs риск</h3><table className="br-table"><thead><tr><th>Метрика</th><th>Baseline</th><th>P50</th><th>P95</th><th>P99</th></tr></thead><tbody><tr><td>Makespan</td><td>{formatDuration(baseline.stats.makespanSeconds)}</td><td>{formatDuration(monteCarlo.makespanSeconds.p50)}</td><td>{formatDuration(monteCarlo.makespanSeconds.p95)}</td><td>{formatDuration(monteCarlo.makespanSeconds.p99)}</td></tr><tr><td>Avg cycle</td><td>{formatDuration(baseline.stats.averageCycleSeconds)}</td><td>{formatDuration(monteCarlo.averageCycleSeconds.p50)}</td><td>{formatDuration(monteCarlo.averageCycleSeconds.p95)}</td><td>{formatDuration(monteCarlo.averageCycleSeconds.p99)}</td></tr><tr><td>Avg wait</td><td>{formatDuration(baseline.stats.averageWaitSeconds)}</td><td>{formatDuration(monteCarlo.averageWaitSeconds.p50)}</td><td>{formatDuration(monteCarlo.averageWaitSeconds.p95)}</td><td>{formatDuration(monteCarlo.averageWaitSeconds.p99)}</td></tr><tr><td>Batch fill</td><td>{roundSmart(baseline.stats.averageBatchFillPercent)}%</td><td>{roundSmart(monteCarlo.averageBatchFillPercent.p50)}%</td><td>{roundSmart(monteCarlo.averageBatchFillPercent.p95)}%</td><td>{roundSmart(monteCarlo.averageBatchFillPercent.p99)}%</td></tr></tbody></table><div className="br-note">Выполнено {monteCarlo.completedIterations}/{monteCarlo.requestedIterations} сценариев. Это анализ неопределённости модели и организационных времён, а не разрешение изменять валидированные параметры медицинского протокола.</div></>}
        </section>
      </main>
    </div>
  );
}
