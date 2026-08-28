import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { GraphProcessBlock } from './processGraphMath';
import { ProcessResource, ProcessResourceRequirement } from './processSimulation';
import { ProcessBlockUncertainty } from './processRisk';
import { ProcessResourceCalendarPolicy } from './processResourceCalendar';
import {
  DigitalTwinArrivalKind,
  DigitalTwinReworkPolicy,
  simulateStochasticDigitalTwin,
} from './processDigitalTwin';

interface ResourceSimulationModel {
  name: string;
  blocks: GraphProcessBlock[];
  resources: ProcessResource[];
  requirementsByBlock: Record<string, ProcessResourceRequirement[]>;
  batchSize: number;
  releaseIntervalSeconds: number;
}

interface CalendarUiConfig {
  shiftEnabled: boolean;
  shiftStartHour: number;
  shiftEndHour: number;
  downtimeEnabled: boolean;
  downtimeStartHour: number;
  downtimeDurationHour: number;
}

const RESOURCE_STORAGE_KEY = 'autotrace:resource-simulation:v1';
const HOUR = 3600;
const DAY = 24 * HOUR;

function fallbackModel(): ResourceSimulationModel {
  const blocks: GraphProcessBlock[] = [
    { id: 'receipt', key: 'receipt', title: 'Приём и регистрация', automation: 'manual', time: { value: 2, unit: 'min' }, dependencies: [] },
    { id: 'prep', key: 'prep', title: 'Подготовка образца', automation: 'mixed', time: { value: 4, unit: 'min' }, dependencies: ['receipt'] },
    { id: 'process', key: 'process', title: 'Обработка', automation: 'automatic', time: { value: 12, unit: 'min' }, dependencies: ['prep'] },
    { id: 'qc', key: 'qc', title: 'QC', automation: 'qc', time: { value: 1, unit: 'min' }, dependencies: ['process'] },
  ];
  return {
    name: 'Digital Twin — демонстрационный процесс',
    blocks,
    resources: [
      { id: 'operator', name: 'Оператор', capacity: 1 },
      { id: 'automation', name: 'Автомат', capacity: 1 },
      { id: 'qc', name: 'QC-станция', capacity: 1 },
    ],
    requirementsByBlock: {
      receipt: [{ resourceId: 'operator', units: 1 }],
      prep: [{ resourceId: 'operator', units: 1 }, { resourceId: 'automation', units: 1 }],
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

function clampPercent(value: number): number {
  return Math.max(0, Math.min(95, Number(value) || 0));
}

function initialCalendars(resources: ProcessResource[]): Record<string, CalendarUiConfig> {
  return Object.fromEntries(resources.map(resource => [resource.id, {
    shiftEnabled: resource.id === 'operator',
    shiftStartHour: 8,
    shiftEndHour: 17,
    downtimeEnabled: false,
    downtimeStartHour: 12,
    downtimeDurationHour: 1,
  }]));
}

function buildCalendarPolicies(
  resources: ProcessResource[],
  configs: Record<string, CalendarUiConfig>,
): Record<string, ProcessResourceCalendarPolicy> {
  const policies: Record<string, ProcessResourceCalendarPolicy> = {};
  for (const resource of resources) {
    const config = configs[resource.id];
    if (!config || (!config.shiftEnabled && !config.downtimeEnabled)) continue;
    const policy: ProcessResourceCalendarPolicy = { cycleSeconds: DAY };
    if (config.shiftEnabled && config.shiftEndHour > config.shiftStartHour) {
      policy.workingWindows = [{
        startOffsetSeconds: Math.max(0, Math.min(24, config.shiftStartHour)) * HOUR,
        endOffsetSeconds: Math.max(0, Math.min(24, config.shiftEndHour)) * HOUR,
      }];
    }
    if (config.downtimeEnabled && config.downtimeDurationHour > 0) {
      const start = Math.max(0, config.downtimeStartHour) * HOUR;
      policy.plannedDowntime = [{
        startSeconds: start,
        endSeconds: start + Math.max(0, config.downtimeDurationHour) * HOUR,
        reason: 'Плановое окно недоступности',
      }];
    }
    policies[resource.id] = policy;
  }
  return policies;
}

export default function ProcessDigitalTwinApp() {
  const model = useMemo(loadModel, []);
  const [jobs, setJobs] = useState(Math.max(1, model.batchSize || 24));
  const [seed, setSeed] = useState(20260828);
  const [arrivalKind, setArrivalKind] = useState<DigitalTwinArrivalKind>('fixed');
  const [arrivalSeconds, setArrivalSeconds] = useState(Math.max(0, model.releaseIntervalSeconds || 60));
  const [statEveryN, setStatEveryN] = useState(0);
  const [spreadByBlock, setSpreadByBlock] = useState<Record<string, number>>(
    Object.fromEntries(model.blocks.map(block => [block.id, 10])),
  );
  const [reworkPercentByBlock, setReworkPercentByBlock] = useState<Record<string, number>>(
    Object.fromEntries(model.blocks.map(block => [block.id, 0])),
  );
  const [maxRepeatsByBlock, setMaxRepeatsByBlock] = useState<Record<string, number>>(
    Object.fromEntries(model.blocks.map(block => [block.id, 1])),
  );
  const [calendarByResource, setCalendarByResource] = useState<Record<string, CalendarUiConfig>>(
    () => initialCalendars(model.resources),
  );

  const uncertaintyByBlock = useMemo<Record<string, ProcessBlockUncertainty>>(() => {
    const result: Record<string, ProcessBlockUncertainty> = {};
    for (const block of model.blocks) {
      const spread = clampPercent(spreadByBlock[block.id] || 0) / 100;
      result[block.id] = spread > 0
        ? { kind: 'triangular', minFactor: 1 - spread, modeFactor: 1, maxFactor: 1 + spread }
        : { kind: 'fixed' };
    }
    return result;
  }, [model.blocks, spreadByBlock]);

  const reworkByBlock = useMemo<Record<string, DigitalTwinReworkPolicy>>(() => {
    const result: Record<string, DigitalTwinReworkPolicy> = {};
    for (const block of model.blocks) {
      const probability = Math.max(0, Math.min(100, reworkPercentByBlock[block.id] || 0)) / 100;
      if (probability > 0) {
        result[block.id] = {
          probability,
          maxRepeats: Math.max(0, Math.floor(maxRepeatsByBlock[block.id] || 0)),
        };
      }
    }
    return result;
  }, [model.blocks, reworkPercentByBlock, maxRepeatsByBlock]);

  const resourceCalendars = useMemo(
    () => buildCalendarPolicies(model.resources, calendarByResource),
    [model.resources, calendarByResource],
  );

  const simulation = useMemo(() => simulateStochasticDigitalTwin(model.blocks, {
    jobs,
    seed,
    arrivals: arrivalKind === 'poisson'
      ? { kind: 'poisson', meanIntervalSeconds: Math.max(0.001, arrivalSeconds) }
      : { kind: 'fixed', intervalSeconds: Math.max(0, arrivalSeconds) },
    resources: model.resources,
    requirementsByBlock: model.requirementsByBlock,
    uncertaintyByBlock,
    reworkByBlock,
    resourceCalendars,
    priority: { statEveryN, statPriority: 100, routinePriority: 0 },
  }), [model, jobs, seed, arrivalKind, arrivalSeconds, statEveryN, uncertaintyByBlock, reworkByBlock, resourceCalendars]);

  const updateCalendar = (resourceId: string, patch: Partial<CalendarUiConfig>) => {
    setCalendarByResource(current => ({
      ...current,
      [resourceId]: { ...current[resourceId], ...patch },
    }));
  };

  const stats = simulation.stats;
  const maxTimeline = simulation.runs.length ? Math.max(...simulation.runs.map(run => run.finishSeconds)) : 1;

  return (
    <div className="dt-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.dt-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.dt-top{position:sticky;top:0;z-index:20;background:rgba(246,248,251,.94);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.dt-topin{max-width:1800px;margin:auto;padding:13px 20px;display:flex;align-items:center;gap:12px}.dt-mark{width:38px;height:38px;border-radius:12px;background:#0f172a;color:white;display:grid;place-items:center;font-weight:900}.dt-brand b{display:block;font-size:14px}.dt-brand span{display:block;font-size:11px;color:#64748b}.dt-back{margin-left:auto;border:1px solid #cbd5e1;background:white;border-radius:9px;padding:8px 10px;cursor:pointer}.dt-main{max-width:1800px;margin:auto;padding:24px 20px 60px}.dt-hero h1{margin:7px 0 8px;font-size:clamp(28px,4vw,48px);letter-spacing:-.045em;line-height:1.04}.dt-hero p{max-width:1050px;color:#475569;line-height:1.55;margin:0}.dt-eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:10px;font-weight:900;color:#64748b}.dt-controls{margin-top:18px;display:flex;flex-wrap:wrap;gap:9px;padding:14px;background:white;border:1px solid #e2e8f0;border-radius:14px}.dt-field{display:flex;flex-direction:column;gap:4px}.dt-field label{font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.08em}.dt-input,.dt-select{border:1px solid #cbd5e1;background:white;border-radius:9px;padding:8px 9px;font:inherit;font-size:12px;min-height:36px}.dt-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px}.dt-card{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:13px}.dt-card span{display:block;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#64748b}.dt-card b{display:block;margin-top:5px;font-size:22px;letter-spacing:-.03em}.dt-section{margin-top:18px;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.dt-section h2{font-size:15px;margin:0 0 12px}.dt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:9px}.dt-stage{border:1px solid #e2e8f0;border-radius:12px;padding:11px;background:#fbfcfe}.dt-stage b{font-size:12px}.dt-stage small{display:block;color:#64748b;margin-top:3px}.dt-stage-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}.dt-stage-fields input{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px;font-size:11px}.dt-stage-fields label{font-size:8px;color:#64748b;font-weight:800}.dt-calendar{display:grid;grid-template-columns:repeat(3,minmax(100px,1fr));gap:7px;margin-top:10px;padding-top:9px;border-top:1px dashed #dbe3ed}.dt-calendar label{font-size:8px;color:#64748b;font-weight:800}.dt-check{display:flex!important;align-items:center;gap:6px}.dt-check input{width:auto}.dt-table{width:100%;border-collapse:collapse;font-size:10px}.dt-table th,.dt-table td{text-align:left;padding:7px;border-bottom:1px solid #edf2f7}.dt-table th{font-size:8px;text-transform:uppercase;letter-spacing:.07em;color:#64748b}.dt-bar{height:7px;border-radius:99px;background:#e2e8f0;overflow:hidden;margin-top:6px}.dt-bar>i{display:block;height:100%;background:#0f172a}.dt-run{position:relative;height:24px;border-bottom:1px solid #f1f5f9}.dt-run span{position:absolute;height:15px;top:4px;border-radius:4px;background:#334155;min-width:2px}.dt-run em{position:absolute;left:4px;top:5px;font-size:8px;font-style:normal;color:#64748b;z-index:2}.dt-error{margin-top:14px;padding:12px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:11px}.dt-note{font-size:10px;color:#64748b;line-height:1.5;margin-top:8px}@media(max-width:720px){.dt-stage-fields,.dt-calendar{grid-template-columns:1fr}.dt-main{padding-inline:12px}.dt-topin{padding-inline:12px}}
      `}</style>
      <div className="dt-top"><div className="dt-topin">
        <div className="dt-mark">DT</div>
        <div className="dt-brand"><b>Process Digital Twin</b><span>stochastic DES · shifts · downtime</span></div>
        <button className="dt-back" onClick={() => { window.location.href = '/?view=process-sim'; }}>Resource Simulation</button>
        <button className="dt-back" style={{ marginLeft: 0 }} onClick={() => { window.location.href = '/'; }}>Canvas</button>
      </div></div>
      <main className="dt-main">
        <div className="dt-hero">
          <div className="dt-eyebrow">AutoTrace · Digital Twin</div>
          <h1>Стохастический цифровой двойник процесса</h1>
          <p>Каждая проба имеет собственное время операции, приоритет и историю повторов. Теперь ресурсы также имеют рабочие смены и плановые окна недоступности: задача должна полностью поместиться в доступный интервал, иначе scheduler переносит её на следующий допустимый слот.</p>
        </div>

        <div className="dt-controls">
          <div className="dt-field"><label>Модель</label><div className="dt-input" style={{ minWidth: 260 }}>{model.name}</div></div>
          <div className="dt-field"><label>Проб / jobs</label><input className="dt-input" type="number" min={1} max={5000} value={jobs} onChange={e => setJobs(Math.max(1, Number(e.target.value) || 1))} /></div>
          <div className="dt-field"><label>Seed</label><input className="dt-input" type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} /></div>
          <div className="dt-field"><label>Поступление</label><select className="dt-select" value={arrivalKind} onChange={e => setArrivalKind(e.target.value as DigitalTwinArrivalKind)}><option value="fixed">Фиксированный интервал</option><option value="poisson">Poisson поток</option></select></div>
          <div className="dt-field"><label>{arrivalKind === 'poisson' ? 'Средний интервал, с' : 'Интервал, с'}</label><input className="dt-input" type="number" min={0} value={arrivalSeconds} onChange={e => setArrivalSeconds(Math.max(0, Number(e.target.value) || 0))} /></div>
          <div className="dt-field"><label>STAT каждая N-я проба (0=нет)</label><input className="dt-input" type="number" min={0} value={statEveryN} onChange={e => setStatEveryN(Math.max(0, Math.floor(Number(e.target.value) || 0)))} /></div>
        </div>

        {!simulation.ok ? <div className="dt-error">{simulation.errors.join(' · ')}</div> : <>
          <div className="dt-cards">
            <div className="dt-card"><span>Makespan</span><b>{formatDuration(stats.makespanSeconds)}</b></div>
            <div className="dt-card"><span>Cycle P95</span><b>{formatDuration(stats.p95CycleSeconds)}</b></div>
            <div className="dt-card"><span>Wait P95</span><b>{formatDuration(stats.p95WaitSeconds)}</b></div>
            <div className="dt-card"><span>Throughput</span><b>{stats.throughputPerHour == null ? '—' : `${roundSmart(stats.throughputPerHour)} /ч`}</b></div>
            <div className="dt-card"><span>Rework</span><b>{roundSmart(stats.reworkRatePercent)}%</b></div>
            <div className="dt-card"><span>Bottleneck</span><b style={{ fontSize: 15 }}>{stats.resourceBottleneckName || '—'}</b><small>{roundSmart(stats.resourceBottleneckUtilizationPercent)}% рабочего времени</small></div>
            <div className="dt-card"><span>STAT cycle</span><b>{stats.statAverageCycleSeconds == null ? '—' : formatDuration(stats.statAverageCycleSeconds)}</b></div>
            <div className="dt-card"><span>STAT advantage</span><b>{stats.statAdvantagePercent == null ? '—' : `${roundSmart(stats.statAdvantagePercent)}%`}</b></div>
          </div>

          <section className="dt-section">
            <h2>Календари ресурсов</h2>
            <div className="dt-grid">{model.resources.map(resource => {
              const config = calendarByResource[resource.id];
              const resourceStats = simulation.resourceStats.find(item => item.id === resource.id);
              const invalidShift = config.shiftEnabled && config.shiftEndHour <= config.shiftStartHour;
              return <div className="dt-stage" key={resource.id}>
                <b>{resource.name}</b><small>capacity {resource.capacity} · availability {roundSmart(resourceStats?.availabilityPercent ?? 100)}% · utilization {roundSmart(resourceStats?.utilizationPercent ?? 0)}%</small>
                <div className="dt-calendar">
                  <label className="dt-check"><input type="checkbox" checked={config.shiftEnabled} onChange={e => updateCalendar(resource.id, { shiftEnabled: e.target.checked })} />Рабочая смена</label>
                  <label>Начало, ч<input type="number" min={0} max={23.99} step={0.5} value={config.shiftStartHour} onChange={e => updateCalendar(resource.id, { shiftStartHour: Math.max(0, Math.min(23.99, Number(e.target.value) || 0)) })} /></label>
                  <label>Конец, ч<input type="number" min={0.01} max={24} step={0.5} value={config.shiftEndHour} onChange={e => updateCalendar(resource.id, { shiftEndHour: Math.max(0.01, Math.min(24, Number(e.target.value) || 0.01)) })} /></label>
                  <label className="dt-check"><input type="checkbox" checked={config.downtimeEnabled} onChange={e => updateCalendar(resource.id, { downtimeEnabled: e.target.checked })} />Плановый downtime</label>
                  <label>Старт от t=0, ч<input type="number" min={0} step={0.5} value={config.downtimeStartHour} onChange={e => updateCalendar(resource.id, { downtimeStartHour: Math.max(0, Number(e.target.value) || 0) })} /></label>
                  <label>Длительность, ч<input type="number" min={0} step={0.25} value={config.downtimeDurationHour} onChange={e => updateCalendar(resource.id, { downtimeDurationHour: Math.max(0, Number(e.target.value) || 0) })} /></label>
                </div>
                {invalidShift && <small style={{ color: '#b91c1c' }}>Конец смены должен быть позже начала; до исправления используется только downtime/24×7 доступность.</small>}
              </div>;
            })}</div>
            <div className="dt-note">Смена повторяется каждые 24 часа. Операции не дробятся на две смены: если длительность не помещается до закрытия окна, запуск переносится на следующую смену. Downtime задаётся абсолютным временем от начала симуляции.</div>
          </section>

          <section className="dt-section">
            <h2>Вариабельность и rework по этапам</h2>
            <div className="dt-grid">{model.blocks.map(block => (
              <div className="dt-stage" key={block.id}>
                <b>{block.title}</b><small>{block.id}</small>
                <div className="dt-stage-fields">
                  <label>Разброс ±%<input type="number" min={0} max={95} value={spreadByBlock[block.id] || 0} onChange={e => setSpreadByBlock(current => ({ ...current, [block.id]: clampPercent(Number(e.target.value)) }))} /></label>
                  <label>Rework %<input type="number" min={0} max={100} value={reworkPercentByBlock[block.id] || 0} onChange={e => setReworkPercentByBlock(current => ({ ...current, [block.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} /></label>
                  <label>Max repeats<input type="number" min={0} max={10} value={maxRepeatsByBlock[block.id] || 0} onChange={e => setMaxRepeatsByBlock(current => ({ ...current, [block.id]: Math.max(0, Math.min(10, Math.floor(Number(e.target.value) || 0))) }))} /></label>
                </div>
              </div>
            ))}</div>
          </section>

          <section className="dt-section">
            <h2>Ресурсы</h2>
            <div className="dt-grid">{simulation.resourceStats.map(resource => (
              <div className="dt-stage" key={resource.id}><b>{resource.name}</b><small>capacity {resource.capacity} · peak {resource.peakUnits} · availability {roundSmart(resource.availabilityPercent)}%</small><div className="dt-bar"><i style={{ width: `${Math.min(100, resource.utilizationPercent)}%` }} /></div><small>utilization {roundSmart(resource.utilizationPercent)}% доступного рабочего времени</small></div>
            ))}</div>
          </section>

          <section className="dt-section">
            <h2>Статистика этапов</h2>
            <table className="dt-table"><thead><tr><th>Этап</th><th>Runs</th><th>Avg duration</th><th>Avg wait</th><th>P95 wait</th><th>Rework</th></tr></thead><tbody>{simulation.blockStats.map(block => <tr key={block.blockId}><td>{block.blockTitle}</td><td>{block.runs}</td><td>{formatDuration(block.averageDurationSeconds)}</td><td>{formatDuration(block.averageWaitSeconds)}</td><td>{formatDuration(block.p95WaitSeconds)}</td><td>{block.reworkRuns} ({roundSmart(block.reworkRatePercent)}%)</td></tr>)}</tbody></table>
          </section>

          <section className="dt-section">
            <h2>Timeline первых операций</h2>
            {simulation.runs.slice(0, 80).map(run => (
              <div className="dt-run" key={run.taskId} title={`${run.blockTitle} · job ${run.jobIndex + 1} · attempt ${run.attempt}`}>
                <em>#{run.jobIndex + 1} {run.priority > 0 ? 'STAT ' : ''}{run.blockTitle}{run.attempt > 1 ? ` · retry ${run.attempt}` : ''}</em>
                <span style={{ left: `${(run.startSeconds / maxTimeline) * 100}%`, width: `${Math.max(.3, (run.durationSeconds / maxTimeline) * 100)}%`, opacity: run.reworkTriggered ? .45 : .9 }} />
              </div>
            ))}
            <div className="dt-note">Приоритет не прерывает уже начавшуюся операцию. Все stochastic-результаты воспроизводимы одним и тем же seed; календарные ограничения детерминированы заданной политикой ресурса.</div>
          </section>
        </>}
      </main>
    </div>
  );
}
