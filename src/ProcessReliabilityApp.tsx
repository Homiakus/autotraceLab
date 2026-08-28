import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock } from './processGraphMath';
import { DigitalTwinOptions } from './processDigitalTwin';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import {
  RepairDistributionKind,
  ResourceFailurePolicy,
  runReliabilityMonteCarlo,
} from './processReliability';

interface ResourceSimulationModel {
  name: string;
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock: Record<string, ProcessResourceRequirement[]>;
  batchSize: number;
  releaseIntervalSeconds: number;
}

interface FailureUiConfig {
  enabled: boolean;
  mtbfHours: number;
  mttrHours: number;
  distribution: RepairDistributionKind;
  spreadPercent: number;
}

const RESOURCE_STORAGE_KEY = 'autotrace:resource-simulation:v1';
const HOUR = 3600;

function fallbackModel(): ResourceSimulationModel {
  const blocks: GraphProcessBlock[] = [
    { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'manual', time: { value: 3, unit: 'min' }, dependencies: [] },
    { id: 'process', key: 'process', title: 'Автоматическая обработка', automation: 'automatic', time: { value: 12, unit: 'min' }, dependencies: ['prep'] },
    { id: 'qc', key: 'qc', title: 'QC', automation: 'qc', time: { value: 1, unit: 'min' }, dependencies: ['process'] },
  ];
  return {
    name: 'Reliability — демонстрационная линия',
    blocks,
    resources: [
      { id: 'operator', name: 'Оператор', capacity: 1 },
      { id: 'automation', name: 'Автомат', capacity: 1 },
      { id: 'qc', name: 'QC', capacity: 1 },
    ],
    requirementsByBlock: {
      prep: [{ resourceId: 'operator', units: 1 }],
      process: [{ resourceId: 'automation', units: 1 }],
      qc: [{ resourceId: 'qc', units: 1 }],
    },
    batchSize: 24,
    releaseIntervalSeconds: 60,
  };
}

function loadModel(): ResourceSimulationModel {
  try {
    const raw = localStorage.getItem(RESOURCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ResourceSimulationModel;
      if (Array.isArray(parsed.blocks) && Array.isArray(parsed.resources)) return parsed;
    }
  } catch {
    // Ignore invalid cache.
  }
  return fallbackModel();
}

function initialFailureConfig(resources: ProcessResource[]): Record<string, FailureUiConfig> {
  return Object.fromEntries(resources.map(resource => [resource.id, {
    enabled: resource.id !== 'operator',
    mtbfHours: resource.id === 'automation' ? 168 : 720,
    mttrHours: resource.id === 'automation' ? 2 : 1,
    distribution: 'triangular' as RepairDistributionKind,
    spreadPercent: 25,
  }]));
}

export default function ProcessReliabilityApp() {
  const model = useMemo(loadModel, []);
  const [jobs, setJobs] = useState(Math.max(1, model.batchSize || 24));
  const [arrivalSeconds, setArrivalSeconds] = useState(Math.max(0, model.releaseIntervalSeconds || 0));
  const [iterations, setIterations] = useState(300);
  const [seed, setSeed] = useState(20260828);
  const [slaHours, setSlaHours] = useState(8);
  const [failureConfig, setFailureConfig] = useState<Record<string, FailureUiConfig>>(
    () => initialFailureConfig(model.resources),
  );

  const failurePolicies = useMemo<ResourceFailurePolicy[]>(() => model.resources.flatMap(resource => {
    const config = failureConfig[resource.id];
    if (!config?.enabled) return [];
    return [{
      resourceId: resource.id,
      mtbfSeconds: Math.max(0.001, config.mtbfHours) * HOUR,
      mttrSeconds: Math.max(0.001, config.mttrHours) * HOUR,
      repairDistribution: config.distribution,
      repairSpreadPercent: Math.max(0, Math.min(95, config.spreadPercent)),
    }];
  }), [model.resources, failureConfig]);

  const digitalTwinOptions = useMemo<DigitalTwinOptions>(() => ({
    jobs,
    seed,
    arrivals: { kind: 'fixed', intervalSeconds: arrivalSeconds },
    resources: model.resources,
    requirementsByBlock: model.requirementsByBlock,
  }), [jobs, seed, arrivalSeconds, model.resources, model.requirementsByBlock]);

  const result = useMemo(() => runReliabilityMonteCarlo(model.blocks, digitalTwinOptions, {
    iterations,
    seed,
    failurePolicies,
    slaMakespanSeconds: slaHours > 0 ? slaHours * HOUR : undefined,
  }), [model.blocks, digitalTwinOptions, iterations, seed, failurePolicies, slaHours]);

  const updateFailure = (resourceId: string, patch: Partial<FailureUiConfig>) => {
    setFailureConfig(current => ({ ...current, [resourceId]: { ...current[resourceId], ...patch } }));
  };

  return (
    <div className="rel-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.rel-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.rel-top{position:sticky;top:0;z-index:20;background:rgba(246,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.rel-topin{max-width:1800px;margin:auto;padding:13px 20px;display:flex;gap:12px;align-items:center}.rel-mark{width:38px;height:38px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.rel-brand b{display:block;font-size:14px}.rel-brand span{display:block;font-size:11px;color:#64748b}.rel-back{margin-left:auto;border:1px solid #cbd5e1;background:white;border-radius:9px;padding:8px 10px;cursor:pointer}.rel-main{max-width:1800px;margin:auto;padding:24px 20px 60px}.rel-eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:900;color:#64748b}.rel-hero h1{margin:7px 0 8px;font-size:clamp(28px,4vw,48px);line-height:1.04;letter-spacing:-.045em}.rel-hero p{max-width:1050px;color:#475569;line-height:1.55;margin:0}.rel-controls{margin-top:18px;display:flex;flex-wrap:wrap;gap:9px;padding:14px;background:white;border:1px solid #e2e8f0;border-radius:14px}.rel-field{display:flex;flex-direction:column;gap:4px}.rel-field label{font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em}.rel-input,.rel-select{border:1px solid #cbd5e1;background:white;border-radius:9px;padding:8px 9px;font:inherit;font-size:12px;min-height:36px}.rel-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px}.rel-card{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:13px}.rel-card span{display:block;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em}.rel-card b{display:block;margin-top:5px;font-size:22px;letter-spacing:-.03em}.rel-section{margin-top:18px;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.rel-section h2{font-size:15px;margin:0 0 12px}.rel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:9px}.rel-resource{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fbfcfe}.rel-resource b{font-size:12px}.rel-resource small{display:block;margin-top:3px;color:#64748b}.rel-rgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.rel-rgrid label{font-size:8px;color:#64748b;font-weight:800}.rel-rgrid input,.rel-rgrid select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px;font-size:11px;background:white}.rel-check{display:flex!important;align-items:center;gap:6px}.rel-check input{width:auto}.rel-table{width:100%;border-collapse:collapse;font-size:10px}.rel-table th,.rel-table td{text-align:left;padding:8px;border-bottom:1px solid #edf2f7}.rel-table th{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:.07em}.rel-error{margin-top:14px;padding:12px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:11px}.rel-note{font-size:10px;color:#64748b;line-height:1.55;margin-top:9px}@media(max-width:760px){.rel-main,.rel-topin{padding-inline:12px}.rel-rgrid{grid-template-columns:1fr 1fr}}
      `}</style>
      <div className="rel-top"><div className="rel-topin">
        <div className="rel-mark">R</div>
        <div className="rel-brand"><b>Reliability Twin</b><span>MTBF / MTTR Monte Carlo</span></div>
        <button className="rel-back" onClick={() => { window.location.href = '/?view=process-digital-twin'; }}>Digital Twin</button>
        <button className="rel-back" style={{ marginLeft: 0 }} onClick={() => { window.location.href = '/'; }}>Canvas</button>
      </div></div>
      <main className="rel-main">
        <div className="rel-hero">
          <div className="rel-eyebrow">AutoTrace · Reliability</div>
          <h1>Влияние MTBF/MTTR на лабораторный процесс</h1>
          <p>Каждая Monte Carlo итерация использует один и тот же stochastic workload для baseline и failure-сценария. Поэтому разница между ними показывает вклад отказов оборудования, а не случайный разброс самих проб.</p>
        </div>

        <div className="rel-controls">
          <div className="rel-field"><label>Модель</label><div className="rel-input" style={{ minWidth: 260 }}>{model.name}</div></div>
          <div className="rel-field"><label>Проб / jobs</label><input className="rel-input" type="number" min={1} max={5000} value={jobs} onChange={e => setJobs(Math.max(1, Number(e.target.value) || 1))} /></div>
          <div className="rel-field"><label>Интервал входа, с</label><input className="rel-input" type="number" min={0} value={arrivalSeconds} onChange={e => setArrivalSeconds(Math.max(0, Number(e.target.value) || 0))} /></div>
          <div className="rel-field"><label>Monte Carlo</label><input className="rel-input" type="number" min={1} max={5000} value={iterations} onChange={e => setIterations(Math.max(1, Math.min(5000, Math.floor(Number(e.target.value) || 1))))} /></div>
          <div className="rel-field"><label>Seed</label><input className="rel-input" type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} /></div>
          <div className="rel-field"><label>SLA makespan, ч</label><input className="rel-input" type="number" min={0} step={0.5} value={slaHours} onChange={e => setSlaHours(Math.max(0, Number(e.target.value) || 0))} /></div>
        </div>

        {!result.ok ? <div className="rel-error">{result.errors.join(' · ')}</div> : <>
          <div className="rel-cards">
            <div className="rel-card"><span>Makespan P95</span><b>{formatDuration(result.makespan.p95)}</b></div>
            <div className="rel-card"><span>Baseline P95</span><b>{formatDuration(result.baselineMakespan.p95)}</b></div>
            <div className="rel-card"><span>Failure delay P95</span><b>{formatDuration(result.addedDelay.p95)}</b></div>
            <div className="rel-card"><span>Throughput P50</span><b>{roundSmart(result.throughputPerHour.p50)} /ч</b></div>
            <div className="rel-card"><span>Availability P50</span><b>{roundSmart(result.availabilityPercent.p50)}%</b></div>
            <div className="rel-card"><span>SLA confidence</span><b>{result.slaProbabilityPercent == null ? '—' : `${roundSmart(result.slaProbabilityPercent)}%`}</b></div>
            <div className="rel-card"><span>Completed MC</span><b>{result.completedIterations}</b><small>из {result.iterations}</small></div>
          </div>

          <section className="rel-section">
            <h2>Надёжность ресурсов</h2>
            <div className="rel-grid">{model.resources.map(resource => {
              const config = failureConfig[resource.id];
              return <div className="rel-resource" key={resource.id}>
                <b>{resource.name}</b><small>resource id: {resource.id} · capacity {resource.capacity}</small>
                <div className="rel-rgrid">
                  <label className="rel-check"><input type="checkbox" checked={config.enabled} onChange={e => updateFailure(resource.id, { enabled: e.target.checked })} />MTBF/MTTR</label>
                  <label>MTBF, ч<input type="number" min={0.001} step={1} value={config.mtbfHours} onChange={e => updateFailure(resource.id, { mtbfHours: Math.max(0.001, Number(e.target.value) || 0.001) })} /></label>
                  <label>MTTR, ч<input type="number" min={0.001} step={0.25} value={config.mttrHours} onChange={e => updateFailure(resource.id, { mttrHours: Math.max(0.001, Number(e.target.value) || 0.001) })} /></label>
                  <label>Repair distribution<select value={config.distribution} onChange={e => updateFailure(resource.id, { distribution: e.target.value as RepairDistributionKind })}><option value="fixed">Fixed</option><option value="uniform">Uniform</option><option value="triangular">Triangular</option></select></label>
                  <label>Repair spread ±%<input type="number" min={0} max={95} value={config.spreadPercent} onChange={e => updateFailure(resource.id, { spreadPercent: Math.max(0, Math.min(95, Number(e.target.value) || 0)) })} /></label>
                </div>
              </div>;
            })}</div>
            <div className="rel-note">В текущей non-preemptive модели отказ не прерывает уже начатую операцию. Если ресурс уже находится в ремонте, новая задача ждёт окончания MTTR. Отказы генерируются в календарном времени как uptime ~ Exp(MTBF).</div>
          </section>

          <section className="rel-section">
            <h2>Результат по ресурсам</h2>
            <table className="rel-table"><thead><tr><th>Ресурс</th><th>Mean failures</th><th>P95 failures</th><th>Mean downtime</th><th>P95 downtime</th><th>Mean availability</th></tr></thead><tbody>{result.resourceStats.map(stat => {
              const resource = model.resources.find(item => item.id === stat.resourceId);
              return <tr key={stat.resourceId}><td>{resource?.name || stat.resourceId}</td><td>{roundSmart(stat.meanFailures)}</td><td>{roundSmart(stat.p95Failures)}</td><td>{formatDuration(stat.meanDowntimeSeconds)}</td><td>{formatDuration(stat.p95DowntimeSeconds)}</td><td>{roundSmart(stat.meanAvailabilityPercent)}%</td></tr>;
            })}</tbody></table>
          </section>

          <section className="rel-section">
            <h2>Перцентили</h2>
            <table className="rel-table"><thead><tr><th>Метрика</th><th>P50</th><th>P90</th><th>P95</th><th>P99</th></tr></thead><tbody>
              <tr><td>Makespan</td><td>{formatDuration(result.makespan.p50)}</td><td>{formatDuration(result.makespan.p90)}</td><td>{formatDuration(result.makespan.p95)}</td><td>{formatDuration(result.makespan.p99)}</td></tr>
              <tr><td>Baseline makespan</td><td>{formatDuration(result.baselineMakespan.p50)}</td><td>{formatDuration(result.baselineMakespan.p90)}</td><td>{formatDuration(result.baselineMakespan.p95)}</td><td>{formatDuration(result.baselineMakespan.p99)}</td></tr>
              <tr><td>Added failure delay</td><td>{formatDuration(result.addedDelay.p50)}</td><td>{formatDuration(result.addedDelay.p90)}</td><td>{formatDuration(result.addedDelay.p95)}</td><td>{formatDuration(result.addedDelay.p99)}</td></tr>
              <tr><td>Throughput /ч</td><td>{roundSmart(result.throughputPerHour.p50)}</td><td>{roundSmart(result.throughputPerHour.p90)}</td><td>{roundSmart(result.throughputPerHour.p95)}</td><td>{roundSmart(result.throughputPerHour.p99)}</td></tr>
            </tbody></table>
          </section>
        </>}
      </main>
    </div>
  );
}
