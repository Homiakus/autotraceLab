import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock } from './processGraphMath';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { planNextResourceCapacity, runProcessMonteCarlo } from './processRisk';

interface StoredSimulationModel {
  name: string;
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock: Record<string, ProcessResourceRequirement[]>;
  batchSize: number;
  releaseIntervalSeconds: number;
}

interface RiskRunSettings {
  iterations: number;
  seed: number;
  slaMakespanSeconds: number | null;
  uncertaintyPercentByBlock: Record<string, number>;
}

const SIM_STORAGE_KEY = 'autotrace:resource-simulation:v1';

function fallbackModel(): StoredSimulationModel {
  const blocks: GraphProcessBlock[] = [
    { id: 'receipt', key: 'receipt', title: 'Приём', automation: 'manual', time: { value: 2, unit: 'min' }, dependencies: [] },
    { id: 'prep', key: 'prep', title: 'Подготовка', automation: 'mixed', time: { value: 4, unit: 'min' }, dependencies: ['receipt'] },
    { id: 'processor', key: 'processor', title: 'Процессор', automation: 'automatic', time: { value: 12, unit: 'min' }, dependencies: ['prep'] },
    { id: 'stain', key: 'stain', title: 'Окраска', automation: 'external', time: { value: 20, unit: 'min' }, dependencies: ['processor'] },
    { id: 'qc', key: 'qc', title: 'QC', automation: 'qc', time: { value: 1, unit: 'min' }, dependencies: ['stain'] },
  ];
  return {
    name: 'Fallback laboratory risk model',
    blocks,
    resources: [
      { id: 'operator', name: 'Оператор', capacity: 1 },
      { id: 'automation', name: 'Автомат', capacity: 1 },
      { id: 'external', name: 'Stainer', capacity: 1 },
      { id: 'qc', name: 'QC', capacity: 1 },
    ],
    requirementsByBlock: {
      receipt: [{ resourceId: 'operator', units: 1 }],
      prep: [{ resourceId: 'operator', units: 1 }, { resourceId: 'automation', units: 1 }],
      processor: [{ resourceId: 'automation', units: 1 }],
      stain: [{ resourceId: 'external', units: 1 }],
      qc: [{ resourceId: 'qc', units: 1 }],
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
    // Use fallback.
  }
  return fallbackModel();
}

function defaultUncertainty(model: StoredSimulationModel, percent = 10): Record<string, number> {
  return Object.fromEntries(model.blocks.map(block => [block.id, block.automation === 'wait' ? 0 : percent]));
}

export default function ProcessRiskApp() {
  const initialModel = useMemo(loadModel, []);
  const [model, setModel] = useState(initialModel);
  const [iterations, setIterations] = useState(400);
  const [seed, setSeed] = useState(20260828);
  const [slaMinutes, setSlaMinutes] = useState<number | ''>('');
  const [uncertaintyPercentByBlock, setUncertaintyPercentByBlock] = useState<Record<string, number>>(() => defaultUncertainty(initialModel));
  const [runSettings, setRunSettings] = useState<RiskRunSettings>(() => ({
    iterations: 400,
    seed: 20260828,
    slaMakespanSeconds: null,
    uncertaintyPercentByBlock: defaultUncertainty(initialModel),
  }));

  const simulationOptions = useMemo(() => ({
    batchSize: model.batchSize,
    releaseIntervalSeconds: model.releaseIntervalSeconds,
    resources: model.resources,
    requirementsByBlock: model.requirementsByBlock,
  }), [model]);

  const uncertaintyByBlock = useMemo(() => Object.fromEntries(model.blocks.map(block => {
    const pct = Math.max(0, runSettings.uncertaintyPercentByBlock[block.id] || 0) / 100;
    return [block.id, pct === 0
      ? { kind: 'fixed' as const }
      : { kind: 'triangular' as const, minFactor: Math.max(0, 1 - pct), modeFactor: 1, maxFactor: 1 + pct }];
  })), [model.blocks, runSettings.uncertaintyPercentByBlock]);

  const monteCarlo = useMemo(() => runProcessMonteCarlo(model.blocks, simulationOptions, {
    iterations: runSettings.iterations,
    seed: runSettings.seed,
    slaMakespanSeconds: runSettings.slaMakespanSeconds,
    uncertaintyByBlock,
  }), [model.blocks, simulationOptions, runSettings, uncertaintyByBlock]);

  const capacityPlan = useMemo(() => planNextResourceCapacity(model.blocks, simulationOptions), [model.blocks, simulationOptions]);

  const reloadModel = () => {
    const next = loadModel();
    setModel(next);
    const uncertainty = defaultUncertainty(next);
    setUncertaintyPercentByBlock(uncertainty);
    setRunSettings(current => ({ ...current, uncertaintyPercentByBlock: uncertainty }));
  };

  const run = () => {
    setRunSettings({
      iterations: Math.max(1, Math.min(5000, Math.floor(iterations || 1))),
      seed: Math.floor(seed || 1),
      slaMakespanSeconds: slaMinutes === '' ? null : Math.max(0, Number(slaMinutes)) * 60,
      uncertaintyPercentByBlock: { ...uncertaintyPercentByBlock },
    });
  };

  return (
    <div className="risk-app">
      <style>{`
        :root{color-scheme:light}*{box-sizing:border-box}body{margin:0}.risk-app{min-height:100vh;background:#F7F8FB;color:#0F172A;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.risk-top{position:sticky;top:0;z-index:30;background:rgba(247,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #E2E8F0}.risk-top-inner{max-width:1800px;margin:auto;padding:13px 20px;display:flex;align-items:center;gap:10px}.risk-mark{width:40px;height:40px;border-radius:12px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:900}.risk-brand b{display:block;font-size:14px}.risk-brand span{display:block;color:#64748B;font-size:11px}.risk-nav{margin-left:auto;display:flex;gap:6px}.risk-btn{border:1px solid #CBD5E1;background:#fff;color:#334155;border-radius:9px;padding:9px 11px;cursor:pointer;font:inherit;font-size:11px;font-weight:800}.risk-btn.primary{background:#111827;color:#fff;border-color:#111827}.risk-hero,.risk-controls,.risk-grid{max-width:1800px;margin:auto}.risk-hero{padding:28px 20px 12px}.risk-eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:900;color:#64748B}.risk-hero h1{font-size:clamp(28px,4vw,48px);letter-spacing:-.045em;line-height:1.04;margin:7px 0 8px}.risk-hero p{max-width:1050px;color:#475569;line-height:1.6;margin:0}.risk-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:end;padding:10px 20px 18px}.risk-field{display:flex;flex-direction:column;gap:4px}.risk-field label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#64748B}.risk-input{border:1px solid #CBD5E1;background:#fff;border-radius:9px;padding:9px 10px;min-height:36px;font:inherit;font-size:12px}.risk-model{font-size:11px;color:#475569;padding:9px 11px;border:1px solid #E2E8F0;background:#fff;border-radius:9px}.risk-grid{padding:0 20px 36px;display:grid;grid-template-columns:minmax(360px,.8fr) minmax(560px,1.5fr);gap:16px}.risk-panel{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:14px;box-shadow:0 6px 18px rgba(15,23,42,.04)}.risk-panel h2{margin:0 0 10px;font-size:16px}.risk-panel h3{margin:14px 0 8px;font-size:12px}.risk-block{display:grid;grid-template-columns:1fr 80px 18px;align-items:center;gap:7px;padding:8px 0;border-bottom:1px solid #EEF2F7}.risk-block b{font-size:10px}.risk-block small{display:block;color:#64748B;font-size:8px;margin-top:2px}.risk-block input{width:100%;border:1px solid #E2E8F0;border-radius:7px;padding:6px;font:inherit;font-size:10px}.risk-pct{text-align:center;color:#64748B;font-size:10px}.risk-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.risk-kpi{border:1px solid #E2E8F0;background:#F8FAFC;border-radius:11px;padding:10px}.risk-kpi span{display:block;text-transform:uppercase;letter-spacing:.07em;color:#64748B;font-size:8px;font-weight:900}.risk-kpi b{display:block;margin-top:4px;font-size:15px}.risk-error{padding:8px;border:1px solid #FECACA;background:#FEF2F2;color:#991B1B;border-radius:9px;font-size:10px;margin:6px 0}.risk-warning{padding:8px;border:1px solid #FDE68A;background:#FFFBEB;color:#92400E;border-radius:9px;font-size:9px;margin:6px 0}.risk-table{width:100%;border-collapse:collapse;font-size:9px}.risk-table th,.risk-table td{text-align:left;padding:7px 6px;border-bottom:1px solid #EEF2F7}.risk-table th{text-transform:uppercase;letter-spacing:.06em;color:#64748B;font-size:8px}.risk-best{border:1px solid #BBF7D0;background:#F0FDF4;border-radius:11px;padding:10px;margin-bottom:10px;color:#166534;font-size:10px;line-height:1.5}.risk-best b{font-size:13px}.risk-note{font-size:9px;color:#64748B;line-height:1.5;margin-top:8px}@media(max-width:1050px){.risk-grid{grid-template-columns:1fr}.risk-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="risk-top"><div className="risk-top-inner"><div className="risk-mark">MC</div><div className="risk-brand"><b>Process Risk & Capacity Planner</b><span>Monte Carlo · SLA confidence · what-if +1 resource</span></div><div className="risk-nav"><button className="risk-btn" onClick={() => { window.location.href='/?view=process-sim'; }}>Simulation</button><button className="risk-btn" onClick={() => { window.location.href='/'; }}>AutoTrace</button></div></div></header>

      <section className="risk-hero"><div className="risk-eyebrow">AutoTrace · stochastic process analysis</div><h1>Устойчивость процесса и лучший следующий ресурс</h1><p>Детерминированная симуляция показывает один сценарий. Monte Carlo многократно изменяет продолжительности операций в заданных пределах и оценивает распределение makespan, cycle time и throughput. Capacity planner отдельно проверяет, какой ресурс выгоднее увеличить на одну единицу.</p></section>

      <section className="risk-controls">
        <div className="risk-model">Модель: <b>{model.name}</b> · batch {model.batchSize} · ресурсов {model.resources.length}</div>
        <button className="risk-btn" onClick={reloadModel}>↻ перечитать Simulation</button>
        <div className="risk-field"><label>Итераций</label><input className="risk-input" type="number" min="1" max="5000" value={iterations} onChange={event => setIterations(Math.max(1, Number(event.target.value) || 1))} /></div>
        <div className="risk-field"><label>Seed</label><input className="risk-input" type="number" value={seed} onChange={event => setSeed(Number(event.target.value) || 1)} /></div>
        <div className="risk-field"><label>SLA makespan, мин</label><input className="risk-input" type="number" min="0" placeholder="не задан" value={slaMinutes} onChange={event => setSlaMinutes(event.target.value === '' ? '' : Number(event.target.value))} /></div>
        <button className="risk-btn primary" onClick={run}>Запустить Monte Carlo</button>
      </section>

      <main className="risk-grid">
        <section className="risk-panel"><h2>Неопределённость времени</h2><p className="risk-note">Для каждого этапа задаётся симметричный треугольный разброс вокруг базового времени. Например ±15% означает min=0.85×, mode=1.0×, max=1.15×. 0% оставляет этап детерминированным.</p>{model.blocks.map(block => <div className="risk-block" key={block.id}><div><b>{block.title}</b><small>{block.automation} · {block.time.formula ? `ƒ ${block.time.formula}` : `${block.time.value ?? '?'} ${block.time.unit}`}</small></div><input type="number" min="0" max="200" value={uncertaintyPercentByBlock[block.id] ?? 0} onChange={event => setUncertaintyPercentByBlock(current => ({ ...current, [block.id]: Math.max(0, Number(event.target.value) || 0) }))} /><span className="risk-pct">±%</span></div>)}</section>

        <section className="risk-panel"><h2>Monte Carlo результат</h2>{monteCarlo.errors.map(error => <div className="risk-error" key={error}>{error}</div>)}{monteCarlo.warnings.slice(0,5).map(warning => <div className="risk-warning" key={warning}>{warning}</div>)}{monteCarlo.ok && <><div className="risk-kpis"><div className="risk-kpi"><span>Makespan P50</span><b>{formatDuration(monteCarlo.makespanSeconds.p50)}</b></div><div className="risk-kpi"><span>Makespan P90</span><b>{formatDuration(monteCarlo.makespanSeconds.p90)}</b></div><div className="risk-kpi"><span>Makespan P95</span><b>{formatDuration(monteCarlo.makespanSeconds.p95)}</b></div><div className="risk-kpi"><span>Makespan P99</span><b>{formatDuration(monteCarlo.makespanSeconds.p99)}</b></div><div className="risk-kpi"><span>Cycle P95</span><b>{formatDuration(monteCarlo.averageCycleSeconds.p95)}</b></div><div className="risk-kpi"><span>Wait P95</span><b>{formatDuration(monteCarlo.averageWaitSeconds.p95)}</b></div><div className="risk-kpi"><span>Throughput P50</span><b>{roundSmart(monteCarlo.throughputPerHour.p50)}/ч</b></div><div className="risk-kpi"><span>SLA confidence</span><b>{monteCarlo.slaProbabilityPercent == null ? '—' : `${roundSmart(monteCarlo.slaProbabilityPercent)}%`}</b></div></div><div className="risk-note">Выполнено {monteCarlo.completedIterations} / {monteCarlo.requestedIterations} итераций. Seed делает результат воспроизводимым.</div></>}

          <h3>Capacity sensitivity: добавить +1 единицу</h3>{capacityPlan.errors.map(error => <div className="risk-error" key={error}>{error}</div>)}{capacityPlan.bestScenario && <div className="risk-best">Лучший следующий ресурс: <b>{capacityPlan.bestScenario.resourceName} {capacityPlan.bestScenario.baselineCapacity} → {capacityPlan.bestScenario.candidateCapacity}</b><br/>makespan −{roundSmart(capacityPlan.bestScenario.makespanReductionPercent)}% · throughput +{roundSmart(capacityPlan.bestScenario.throughputGainPercent)}% · ожидание −{roundSmart(capacityPlan.bestScenario.waitReductionPercent)}%</div>}
          {capacityPlan.ok && <table className="risk-table"><thead><tr><th>Ресурс</th><th>Capacity</th><th>Makespan</th><th>Throughput</th><th>Wait</th><th>Utilization после</th></tr></thead><tbody>{capacityPlan.scenarios.map(scenario => <tr key={scenario.resourceId}><td>{scenario.resourceName}</td><td>{scenario.baselineCapacity} → {scenario.candidateCapacity}</td><td>−{roundSmart(scenario.makespanReductionPercent)}%</td><td>+{roundSmart(scenario.throughputGainPercent)}%</td><td>−{roundSmart(scenario.waitReductionPercent)}%</td><td>{roundSmart(scenario.candidateUtilizationPercent)}%</td></tr>)}</tbody></table>}
          <div className="risk-note">Рейтинг +1 ресурса является sensitivity-анализом, а не финансовой рекомендацией: стоимость оборудования, расходники, площадь, персонал и регуляторные ограничения в score не входят.</div>
        </section>
      </main>
    </div>
  );
}
