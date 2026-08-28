import React, { useMemo, useState } from 'react';
import { LBC_DOMAIN_PACK } from './domainPacks/lbc';
import { BUILT_IN_PROCESS_DOMAIN_PACKS } from './processBuiltInPacks';
import { cloneProcessScenario, ProcessScenarioProfile } from './processDomain';
import { PROCESS_MATH_PROFILE_STORAGE_KEY, resizeProcessScenarioJobs } from './processMathProfile';
import { formatDuration, ProcessTimeUnit, roundSmart } from './processMath';
import { parseProcessScenario, serializeProcessScenario } from './processProfileIO';
import {
  LEGACY_RESOURCE_SIMULATION_STORAGE_KEY,
  PROCESS_SIMULATION_PROFILE_STORAGE_KEY,
  applyAutomationResourceDefaults,
  createBlankProcessSimulationScenario,
  evaluateProcessSimulationReadiness,
  migrateLegacyResourceSimulationModel,
  removeProcessResourceFromScenario,
  setBlockResourceRequirement,
  setFixedArrivalInterval,
  upsertProcessResource,
} from './processSimulationProfile';
import { LegacyResourceSimulationModel } from './processLegacyAdapters';
import { simulateUniversalScenario } from './processUniversalCompiler';
import { buildProcessTemplateCatalog, createScenarioFromTemplateRef } from './processTemplateCatalog';

const DOMAIN_PACKS = [...BUILT_IN_PROCESS_DOMAIN_PACKS, LBC_DOMAIN_PACK];
const TEMPLATE_CATALOG = buildProcessTemplateCatalog(DOMAIN_PACKS);
const CUSTOM_TEMPLATE = '__custom__';

function fixedArrivalSeconds(profile: ProcessScenarioProfile): number {
  return profile.arrivals?.kind === 'fixed' ? Math.max(0, Number(profile.arrivals.intervalSeconds) || 0) : 0;
}

function persist(profile: ProcessScenarioProfile): void {
  try {
    localStorage.setItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY, serializeProcessScenario(profile));
  } catch {
    // Local persistence is optional; never block the model editor.
  }
}

function loadInitial(): ProcessScenarioProfile {
  try {
    const current = localStorage.getItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY);
    if (current) {
      const parsed = parseProcessScenario(current);
      if (parsed.ok && parsed.value) return parsed.value;
    }
  } catch {
    // Continue to legacy migration.
  }
  try {
    const legacy = localStorage.getItem(LEGACY_RESOURCE_SIMULATION_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as LegacyResourceSimulationModel;
      if (parsed && Array.isArray(parsed.blocks) && Array.isArray(parsed.resources)) {
        const migrated = migrateLegacyResourceSimulationModel(parsed);
        persist(migrated);
        return migrated;
      }
    }
  } catch {
    // Invalid legacy state is ignored.
  }
  return createBlankProcessSimulationScenario();
}

function freshResourceId(profile: ProcessScenarioProfile): string {
  const used = new Set(profile.resources.map(resource => resource.id));
  let index = profile.resources.length + 1;
  while (used.has(`resource-${index}`)) index += 1;
  return `resource-${index}`;
}

export default function UniversalProcessSimulationApp() {
  const initial = useMemo(loadInitial, []);
  const [profile, setProfile] = useState<ProcessScenarioProfile>(initial);
  const [templateRef, setTemplateRef] = useState(CUSTOM_TEMPLATE);
  const [seed, setSeed] = useState(20260828);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState('');

  const readiness = useMemo(() => evaluateProcessSimulationReadiness(profile), [profile]);
  const simulation = useMemo(() => simulateUniversalScenario(profile, seed), [profile, seed]);
  const releaseIntervalSeconds = fixedArrivalSeconds(profile);
  const maxTimeline = Math.max(1, simulation.stats.makespanSeconds);
  const visibleRuns = simulation.core.runs.slice(0, 120);

  const commit = (next: ProcessScenarioProfile, message?: string) => {
    setProfile(next);
    persist(next);
    if (message) setNotice(message);
  };

  const mutate = (fn: (draft: ProcessScenarioProfile) => void) => {
    const next = cloneProcessScenario(profile);
    fn(next);
    commit(next);
  };

  const applyTemplate = (ref: string) => {
    setTemplateRef(ref);
    if (ref === CUSTOM_TEMPLATE) {
      commit(createBlankProcessSimulationScenario(), 'Создан новый universal simulation profile');
      return;
    }
    const source = createScenarioFromTemplateRef(DOMAIN_PACKS, ref);
    if (!source) {
      setNotice('Шаблон не найден');
      return;
    }
    const next = source.resources.length ? source : applyAutomationResourceDefaults(source);
    commit(next, `Загружен шаблон: ${next.name}`);
  };

  const importFromProcessMath = () => {
    try {
      const raw = localStorage.getItem(PROCESS_MATH_PROFILE_STORAGE_KEY);
      if (!raw) {
        setNotice('Process Math v2 profile не найден в Local Storage');
        return;
      }
      const parsed = parseProcessScenario(raw);
      if (!parsed.ok || !parsed.value) {
        setNotice(`Process Math profile невалиден: ${parsed.errors.join('; ')}`);
        return;
      }
      const next = applyAutomationResourceDefaults(parsed.value);
      commit(next, 'Process Math v2 profile импортирован; отсутствующие resource defaults добавлены по типам операций');
      setTemplateRef(CUSTOM_TEMPLATE);
    } catch (error) {
      setNotice(`Ошибка импорта Process Math: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const exportProfile = async () => {
    const text = serializeProcessScenario(profile);
    try {
      await navigator.clipboard.writeText(text);
      setNotice('ProcessScenarioProfile скопирован в буфер обмена');
    } catch {
      setImportText(text);
      setJsonOpen(true);
      setNotice('Clipboard недоступен — JSON открыт ниже');
    }
  };

  const importProfile = () => {
    const parsed = parseProcessScenario(importText);
    if (!parsed.ok || !parsed.value) {
      setNotice(`Ошибка импорта: ${parsed.errors.join('; ') || 'невалидный профиль'}`);
      return;
    }
    commit(parsed.value, 'Universal simulation profile импортирован');
    setTemplateRef(CUSTOM_TEMPLATE);
    setJsonOpen(false);
  };

  const addResource = () => {
    const id = freshResourceId(profile);
    commit(upsertProcessResource(profile, { id, name: 'Новый ресурс', capacity: 1 }));
  };

  return (
    <div className="usim-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.usim-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.usim-top{position:sticky;top:0;z-index:30;background:rgba(246,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.usim-topin{max-width:1800px;margin:auto;padding:12px 18px;display:flex;align-items:center;gap:10px}.usim-mark{width:40px;height:40px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.usim-brand b{display:block;font-size:14px}.usim-brand span{display:block;color:#64748b;font-size:10px}.usim-btn,.usim-input,.usim-select{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;color:#0f172a}.usim-btn{font-weight:800;cursor:pointer}.usim-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}.usim-btn.danger{color:#b91c1c}.usim-back{margin-left:auto}.usim-main{max-width:1800px;margin:auto;padding:24px 18px 52px}.usim-eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:9px;color:#64748b;font-weight:900}.usim-hero h1{margin:5px 0 8px;font-size:clamp(30px,4vw,50px);letter-spacing:-.045em;line-height:1.03}.usim-hero p{max-width:1100px;color:#475569;line-height:1.55;margin:0}.usim-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:18px 0}.usim-field{display:flex;flex-direction:column;gap:4px}.usim-field label{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:900}.usim-template{min-width:310px}.usim-name{min-width:250px}.usim-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.usim-chip{font-size:9px;border:1px solid #dbe3ee;background:#fff;border-radius:999px;padding:5px 8px;color:#475569}.usim-chip.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}.usim-chip.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}.usim-notice{font-size:10px;color:#475569;margin-bottom:10px}.usim-json textarea{width:100%;min-height:210px;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.usim-json-actions{display:flex;gap:7px;margin-top:7px}.usim-grid{display:grid;grid-template-columns:minmax(370px,.9fr) minmax(560px,1.35fr);gap:14px}.usim-panel{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:13px;box-shadow:0 5px 16px rgba(15,23,42,.04)}.usim-panel h2{margin:0 0 9px;font-size:14px}.usim-panel h3{margin:13px 0 7px;font-size:11px}.usim-resource{display:grid;grid-template-columns:100px 1fr 70px 30px;gap:5px;margin-bottom:6px}.usim-resource .usim-input{width:100%;min-width:0}.usim-resource-id{font:9px ui-monospace,monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;overflow:hidden;text-overflow:ellipsis}.usim-block{border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:7px 0}.usim-blockhead{display:flex;align-items:center;gap:6px}.usim-blockhead b{font-size:10px}.usim-blockhead span{margin-left:auto;font-size:8px;color:#64748b}.usim-time{display:grid;grid-template-columns:1fr 65px;gap:5px;margin-top:6px}.usim-reqs{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.usim-req{display:flex;align-items:center;gap:4px;border:1px solid #e2e8f0;border-radius:8px;padding:4px 6px;font-size:8px;color:#475569}.usim-req input[type=number]{width:42px;border:0;background:#f1f5f9;border-radius:5px;padding:3px;font-size:8px}.usim-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.usim-kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px}.usim-kpi span{display:block;font-size:8px;text-transform:uppercase;color:#64748b}.usim-kpi b{display:block;margin-top:4px;font-size:14px}.usim-error,.usim-warning{border-radius:9px;padding:7px;font-size:9px;line-height:1.45;margin-top:6px}.usim-error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b}.usim-warning{border:1px solid #fde68a;background:#fffbeb;color:#92400e}.usim-table{width:100%;border-collapse:collapse;font-size:9px}.usim-table th,.usim-table td{text-align:left;padding:6px;border-bottom:1px solid #edf2f7}.usim-table th{font-size:8px;text-transform:uppercase;color:#64748b}.usim-bar{height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden}.usim-bar i{display:block;height:100%;background:#64748b}.usim-timeline{max-height:360px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;padding:7px}.usim-run{display:grid;grid-template-columns:100px 1fr 70px;gap:6px;align-items:center;font-size:8px;margin:4px 0}.usim-track{height:8px;background:#f1f5f9;border-radius:999px;position:relative;overflow:hidden}.usim-track i{position:absolute;top:0;height:100%;background:#475569;border-radius:999px}@media(max-width:1050px){.usim-grid{grid-template-columns:1fr}.usim-template,.usim-name{min-width:220px}.usim-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="usim-top"><div className="usim-topin"><div className="usim-mark">DES</div><div className="usim-brand"><b>Universal Process Simulation</b><span>ProcessScenarioProfile · resources · queues · universal scheduler</span></div><button className="usim-btn usim-back" onClick={() => window.location.assign(window.location.pathname)}>← AutoTrace</button></div></header>

      <main className="usim-main">
        <section className="usim-hero"><div className="usim-eyebrow">Resource-constrained discrete-event simulation v2</div><h1>Один simulation document вместо нескольких форматов</h1><p>Jobs, arrivals, DAG, resources, requirements, batches, compatibility, changeovers, calendars, failures и retries живут в одном `ProcessScenarioProfile`. Экран больше не создаёт отдельную LBC-specific simulation model.</p></section>

        <section className="usim-toolbar">
          <div className="usim-field"><label>Domain Pack / шаблон</label><select className="usim-select usim-template" value={templateRef} onChange={event => applyTemplate(event.target.value)}><option value={CUSTOM_TEMPLATE}>Custom universal scenario</option>{DOMAIN_PACKS.map(pack => <optgroup key={pack.id} label={`${pack.name} · ${pack.version}`}>{TEMPLATE_CATALOG.filter(item => item.packId === pack.id).map(item => <option key={item.ref} value={item.ref}>{item.templateName}</option>)}</optgroup>)}</select></div>
          <div className="usim-field"><label>Название</label><input className="usim-input usim-name" value={profile.name} onChange={event => mutate(draft => { draft.name = event.target.value; })}/></div>
          <div className="usim-field"><label>Jobs</label><input className="usim-input" type="number" min="1" step="1" value={profile.jobs.length} onChange={event => commit(resizeProcessScenarioJobs(profile, Number(event.target.value)))}/></div>
          <div className="usim-field"><label>Fixed arrival, с</label><input className="usim-input" type="number" min="0" step="any" value={releaseIntervalSeconds} onChange={event => commit(setFixedArrivalInterval(profile, Number(event.target.value)))}/></div>
          <div className="usim-field"><label>Seed</label><input className="usim-input" type="number" value={seed} onChange={event => setSeed(Number(event.target.value) || 0)}/></div>
          <button className="usim-btn" onClick={importFromProcessMath}>Импорт Process Math v2</button><button className="usim-btn" onClick={exportProfile}>Экспорт JSON</button><button className="usim-btn" onClick={() => setJsonOpen(value => !value)}>Импорт JSON</button><button className="usim-btn danger" onClick={() => applyTemplate(CUSTOM_TEMPLATE)}>Сброс</button>
        </section>

        <div className="usim-chips"><span className="usim-chip">schema {profile.schemaVersion}</span><span className="usim-chip">domain {profile.domain || 'generic'}</span><span className="usim-chip">resources {profile.resources.length}</span><span className={`usim-chip ${readiness.simulationReady ? 'ok' : 'warn'}`}>{readiness.simulationReady ? 'simulation-ready' : `${readiness.unresolvedTimeBlockIds.length} unresolved timings`}</span>{profile.compatibility?.length ? <span className="usim-chip">compatibility {profile.compatibility.length}</span> : null}{profile.changeovers?.length ? <span className="usim-chip">changeovers {profile.changeovers.length}</span> : null}</div>
        {notice && <div className="usim-notice">{notice}</div>}
        {jsonOpen && <section className="usim-json"><textarea value={importText} onChange={event => setImportText(event.target.value)} placeholder="ProcessScenarioProfile JSON…"/><div className="usim-json-actions"><button className="usim-btn primary" onClick={importProfile}>Применить</button><button className="usim-btn" onClick={() => setJsonOpen(false)}>Закрыть</button></div></section>}

        <section className="usim-grid">
          <article className="usim-panel"><h2>Модель ресурсов</h2><button className="usim-btn primary" onClick={addResource}>+ Ресурс</button><h3>Resources</h3>{profile.resources.map(resource => <div className="usim-resource" key={resource.id}><div className="usim-resource-id" title={resource.id}>{resource.id}</div><input className="usim-input" value={resource.name} onChange={event => commit(upsertProcessResource(profile, { ...resource, name: event.target.value }))}/><input className="usim-input" type="number" min="1" step="1" value={resource.capacity} onChange={event => commit(upsertProcessResource(profile, { ...resource, capacity: Number(event.target.value) }))}/><button className="usim-btn danger" onClick={() => commit(removeProcessResourceFromScenario(profile, resource.id))}>×</button></div>)}
          <h3>Operations / requirements</h3>{profile.blocks.map(block => <div className="usim-block" key={block.id}><div className="usim-blockhead"><b>{block.title}</b><span>{block.automation}</span></div><div className="usim-time"><input className="usim-input" type="number" min="0" step="any" value={block.time.value ?? ''} disabled={Boolean(block.time.formula?.trim())} onChange={event => mutate(draft => { const target=draft.blocks.find(item=>item.id===block.id); if(target) target.time.value=event.target.value===''?null:Number(event.target.value); })}/><select className="usim-select" value={block.time.unit} disabled={Boolean(block.time.formula?.trim())} onChange={event => mutate(draft => { const target=draft.blocks.find(item=>item.id===block.id); if(target) target.time.unit=event.target.value as ProcessTimeUnit; })}><option value="ms">мс</option><option value="s">с</option><option value="min">мин</option><option value="h">ч</option></select></div><div className="usim-reqs">{profile.resources.map(resource => {const req=(profile.requirementsByBlock?.[block.id]||[]).find(item=>item.resourceId===resource.id);return <label className="usim-req" key={resource.id}><input type="checkbox" checked={Boolean(req)} onChange={event => commit(setBlockResourceRequirement(profile,block.id,resource.id,event.target.checked?1:0))}/>{resource.name}{req&&<input type="number" min="1" max={resource.capacity} value={req.units} onChange={event => commit(setBlockResourceRequirement(profile,block.id,resource.id,Number(event.target.value)))}/>}</label>;})}</div></div>)}</article>

          <article className="usim-panel"><h2>Simulation result</h2><div className="usim-kpis"><div className="usim-kpi"><span>Makespan</span><b>{formatDuration(simulation.stats.makespanSeconds)}</b></div><div className="usim-kpi"><span>P95 cycle</span><b>{formatDuration(simulation.stats.p95CycleSeconds)}</b></div><div className="usim-kpi"><span>Avg wait</span><b>{formatDuration(simulation.stats.averageWaitSeconds)}</b></div><div className="usim-kpi"><span>Throughput</span><b>{simulation.stats.throughputPerHour==null?'—':`${roundSmart(simulation.stats.throughputPerHour)}/ч`}</b></div><div className="usim-kpi"><span>Batch fill</span><b>{roundSmart(simulation.stats.averageBatchFillPercent)}%</b></div><div className="usim-kpi"><span>Changeover</span><b>{formatDuration(simulation.policyStats.totalChangeoverSeconds)}</b></div><div className="usim-kpi"><span>Runs</span><b>{simulation.core.stats.totalRuns}</b></div><div className="usim-kpi"><span>Status</span><b>{simulation.ok?'OK':'ERROR'}</b></div></div>{simulation.errors.map((error,index)=><div className="usim-error" key={index}>{error}</div>)}{simulation.warnings.map((warning,index)=><div className="usim-warning" key={index}>{warning}</div>)}
          <h3>Resource utilization</h3><table className="usim-table"><thead><tr><th>Resource</th><th>Capacity</th><th>Utilization</th><th>Availability</th><th>Peak</th></tr></thead><tbody>{simulation.core.resourceStats.map(resource=><tr key={resource.id}><td>{resource.name}</td><td>{resource.capacity}</td><td><div>{roundSmart(resource.utilizationPercent)}%</div><div className="usim-bar"><i style={{width:`${Math.min(100,Math.max(0,resource.utilizationPercent))}%`}}/></div></td><td>{roundSmart(resource.availabilityPercent)}%</td><td>{resource.peakUnits}</td></tr>)}</tbody></table>
          <h3>Operation queues</h3><table className="usim-table"><thead><tr><th>Operation</th><th>Runs</th><th>Avg wait</th><th>P95 wait</th><th>Rework</th></tr></thead><tbody>{simulation.core.blockStats.map(block=><tr key={block.blockId}><td>{block.blockTitle}</td><td>{block.runs}</td><td>{formatDuration(block.averageWaitSeconds)}</td><td>{formatDuration(block.p95WaitSeconds)}</td><td>{roundSmart(block.reworkRatePercent)}%</td></tr>)}</tbody></table>
          <h3>Timeline · first {visibleRuns.length} runs</h3><div className="usim-timeline">{visibleRuns.map(run=>{const left=(run.startSeconds/maxTimeline)*100;const width=Math.max(.25,((run.finishSeconds-run.startSeconds)/maxTimeline)*100);return <div className="usim-run" key={run.taskId}><span>J{run.jobIndex+1} · {run.blockTitle}</span><div className="usim-track"><i style={{left:`${left}%`,width:`${width}%`}}/></div><span>{formatDuration(run.startSeconds)} → {formatDuration(run.finishSeconds)}</span></div>;})}</div></article>
        </section>
      </main>
    </div>
  );
}
