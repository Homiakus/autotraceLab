import React, { useMemo, useState } from 'react';
import { LBC_DOMAIN_PACK } from './domainPacks/lbc';
import { BUILT_IN_PROCESS_DOMAIN_PACKS } from './processBuiltInPacks';
import { cloneProcessScenario, ProcessScenarioProfile } from './processDomain';
import { GraphProcessBlock, ProcessAutomationKind, analyzeGraphProcess } from './processGraphMath';
import {
  LEGACY_PROCESS_MATH_STORAGE_KEY,
  PROCESS_MATH_PROFILE_STORAGE_KEY,
  LegacyProcessMathModel,
  createBlankProcessMathScenario,
  getProcessMathMetadata,
  migrateLegacyProcessMathModel,
  resizeProcessScenarioJobs,
  withProcessMathMetadata,
} from './processMathProfile';
import { ProcessTimeUnit, formatDuration, roundSmart } from './processMath';
import { parseProcessScenario, serializeProcessScenario } from './processProfileIO';
import {
  buildProcessTemplateCatalog,
  createScenarioFromTemplateRef,
} from './processTemplateCatalog';

const DOMAIN_PACKS = [...BUILT_IN_PROCESS_DOMAIN_PACKS, LBC_DOMAIN_PACK];
const TEMPLATE_CATALOG = buildProcessTemplateCatalog(DOMAIN_PACKS);
const CUSTOM_TEMPLATE = '__custom__';

const AUTOMATION: Array<{ id: ProcessAutomationKind; label: string }> = [
  { id: 'manual', label: 'Ручной' },
  { id: 'automatic', label: 'Автоматический' },
  { id: 'mixed', label: 'Смешанный' },
  { id: 'wait', label: 'Ожидание' },
  { id: 'external', label: 'Внешний модуль' },
  { id: 'qc', label: 'QC' },
];

function newBlock(index: number, dependency?: string): GraphProcessBlock {
  const id = `stage_${Date.now()}_${index}`;
  return {
    id,
    key: `stage_${index + 1}`,
    title: `Этап ${index + 1}`,
    automation: 'automatic',
    time: { value: 1, unit: 'min' },
    dependencies: dependency ? [dependency] : [],
  };
}

function persistProfile(profile: ProcessScenarioProfile): void {
  try {
    localStorage.setItem(PROCESS_MATH_PROFILE_STORAGE_KEY, serializeProcessScenario(profile));
  } catch {
    // Persistence must never prevent editing in-memory.
  }
}

function loadInitialProfile(): ProcessScenarioProfile {
  try {
    const current = localStorage.getItem(PROCESS_MATH_PROFILE_STORAGE_KEY);
    if (current) {
      const parsed = parseProcessScenario(current);
      if (parsed.ok && parsed.value) return parsed.value;
    }
  } catch {
    // Fall through to the legacy migration path.
  }

  try {
    const legacy = localStorage.getItem(LEGACY_PROCESS_MATH_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as LegacyProcessMathModel;
      if (parsed && Array.isArray(parsed.blocks)) {
        const migrated = migrateLegacyProcessMathModel(parsed);
        persistProfile(migrated);
        return migrated;
      }
    }
  } catch {
    // Invalid legacy cache is ignored.
  }

  return createBlankProcessMathScenario();
}

function timingReadiness(profile: ProcessScenarioProfile): { coveragePercent: number; simulationReady: boolean } | null {
  const raw = profile.metadata?.timingReadiness;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const coveragePercent = Number(value.coveragePercent);
  if (!Number.isFinite(coveragePercent)) return null;
  return { coveragePercent, simulationReady: value.simulationReady === true };
}

export default function UniversalProcessMathApp() {
  const initial = useMemo(loadInitialProfile, []);
  const [profile, setProfile] = useState<ProcessScenarioProfile>(initial);
  const [templateRef, setTemplateRef] = useState(getProcessMathMetadata(initial).sourceTemplateRef || CUSTOM_TEMPLATE);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState('');

  const mathMeta = getProcessMathMetadata(profile);
  const summaryFormula = mathMeta.summaryFormula;
  const batchSize = profile.jobs.length;
  const analysis = useMemo(
    () => analyzeGraphProcess(profile.blocks, { batchSize, summaryFormula }),
    [profile.blocks, batchSize, summaryFormula],
  );
  const readiness = timingReadiness(profile);

  const commit = (next: ProcessScenarioProfile, noticeText?: string) => {
    setProfile(next);
    persistProfile(next);
    if (noticeText) setNotice(noticeText);
  };

  const updateProfile = (mutate: (draft: ProcessScenarioProfile) => void) => {
    const next = cloneProcessScenario(profile);
    mutate(next);
    commit(next);
  };

  const updateBlock = (id: string, updater: (block: GraphProcessBlock) => GraphProcessBlock) => {
    updateProfile(draft => {
      draft.blocks = draft.blocks.map(block => block.id === id ? updater(block) : block);
    });
  };

  const applyTemplate = (ref: string) => {
    setTemplateRef(ref);
    if (ref === CUSTOM_TEMPLATE) {
      commit(createBlankProcessMathScenario(), 'Создан новый универсальный профиль');
      return;
    }
    const source = createScenarioFromTemplateRef(DOMAIN_PACKS, ref);
    if (!source) {
      setNotice('Шаблон не найден');
      return;
    }
    const next = withProcessMathMetadata(source, { sourceTemplateRef: ref, summaryFormula: 'critical.time' });
    commit(next, `Загружен Domain Pack шаблон: ${next.name}`);
  };

  const addStage = () => {
    updateProfile(draft => {
      draft.blocks.push(newBlock(draft.blocks.length, draft.blocks.at(-1)?.id));
    });
  };

  const duplicateStage = (id: string) => {
    updateProfile(draft => {
      const index = draft.blocks.findIndex(block => block.id === id);
      if (index < 0) return;
      const source = draft.blocks[index];
      const duplicate: GraphProcessBlock = {
        ...source,
        id: `${source.id}_copy_${Date.now()}`,
        key: `${source.key}_copy`,
        title: `${source.title} — копия`,
        dependencies: [...source.dependencies],
        time: { ...source.time },
      };
      draft.blocks.splice(index + 1, 0, duplicate);
    });
  };

  const removeStage = (id: string) => {
    updateProfile(draft => {
      draft.blocks = draft.blocks
        .filter(block => block.id !== id)
        .map(block => ({ ...block, dependencies: block.dependencies.filter(dep => dep !== id) }));
    });
  };

  const moveStage = (id: string, direction: -1 | 1) => {
    updateProfile(draft => {
      const index = draft.blocks.findIndex(block => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= draft.blocks.length) return;
      [draft.blocks[index], draft.blocks[target]] = [draft.blocks[target], draft.blocks[index]];
    });
  };

  const exportProfile = async () => {
    const text = serializeProcessScenario(profile);
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Universal ProcessScenarioProfile скопирован в буфер обмена');
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
    const next = parsed.value;
    commit(next, 'ProcessScenarioProfile импортирован');
    setTemplateRef(getProcessMathMetadata(next).sourceTemplateRef || CUSTOM_TEMPLATE);
    setJsonOpen(false);
  };

  const packId = typeof profile.metadata?.domainPackId === 'string' ? profile.metadata.domainPackId : 'custom';
  const packVersion = typeof profile.metadata?.domainPackVersion === 'string' ? profile.metadata.domainPackVersion : '—';
  const stats = analysis.stats;

  return (
    <div className="upm-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.upm-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.upm-top{position:sticky;top:0;z-index:30;background:rgba(246,248,251,.94);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.upm-topin{max-width:1800px;margin:auto;padding:12px 18px;display:flex;align-items:center;gap:10px}.upm-mark{width:40px;height:40px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.upm-brand b{display:block;font-size:14px}.upm-brand span{display:block;font-size:10px;color:#64748b}.upm-back{margin-left:auto}.upm-btn,.upm-input,.upm-select{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;color:#0f172a}.upm-btn{font-weight:800;cursor:pointer}.upm-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}.upm-btn.danger{color:#b91c1c}.upm-main{max-width:1800px;margin:auto;padding:24px 18px 50px}.upm-hero h1{margin:5px 0 8px;font-size:clamp(30px,4vw,50px);letter-spacing:-.045em;line-height:1.03}.upm-eyebrow{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#64748b}.upm-sub{max-width:1050px;color:#475569;line-height:1.55;margin:0}.upm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:18px 0}.upm-field{display:flex;flex-direction:column;gap:4px}.upm-field label{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#64748b}.upm-template{min-width:330px}.upm-name{min-width:260px}.upm-context{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.upm-chip{border:1px solid #dbe3ee;background:#fff;border-radius:999px;padding:5px 8px;font-size:9px;color:#475569}.upm-chip.ok{color:#166534;border-color:#bbf7d0;background:#f0fdf4}.upm-chip.warn{color:#92400e;border-color:#fde68a;background:#fffbeb}.upm-notice{font-size:10px;color:#475569;margin:8px 0}.upm-json textarea{width:100%;min-height:220px;border:1px solid #cbd5e1;border-radius:12px;padding:12px;font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.upm-json-actions{display:flex;gap:8px;margin-top:7px}.upm-board-shell{margin:16px -18px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#eef2f7;overflow-x:auto;padding:18px}.upm-board{display:flex;min-width:max-content;align-items:stretch}.upm-wrap{display:flex;align-items:center}.upm-card{width:300px;min-height:390px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:9px;box-shadow:0 5px 16px rgba(15,23,42,.04)}.upm-card.error{box-shadow:0 0 0 2px rgba(239,68,68,.2)}.upm-head{display:flex;align-items:center;gap:6px}.upm-index{width:27px;height:27px;border-radius:8px;background:#f1f5f9;display:grid;place-items:center;font-size:10px;font-weight:900}.upm-kind{margin-left:auto;font-size:8px;text-transform:uppercase;font-weight:900;color:#64748b}.upm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.upm-card .upm-input,.upm-card .upm-select{width:100%;min-width:0;padding:7px}.upm-formula{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.upm-deps{max-height:95px;overflow:auto;border:1px solid #e2e8f0;border-radius:9px;padding:6px;background:#fafbfc}.upm-deps label{display:flex;align-items:center;gap:5px;padding:2px 0;font-size:9px;color:#475569}.upm-eval{background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:8px;font-size:9px;line-height:1.45}.upm-eval b{font-size:13px}.upm-error{color:#b91c1c;font-size:9px}.upm-actions{margin-top:auto;display:flex;gap:4px;flex-wrap:wrap}.upm-actions button{border:1px solid #e2e8f0;background:#f8fafc;border-radius:7px;padding:5px 6px;font-size:8px;cursor:pointer}.upm-arrow{width:34px;position:relative}.upm-arrow:before{content:"";position:absolute;top:50%;left:7px;right:7px;height:1px;background:#94a3b8}.upm-arrow:after{content:"";position:absolute;top:calc(50% - 4px);right:6px;border-left:7px solid #94a3b8;border-top:4px solid transparent;border-bottom:4px solid transparent}.upm-stats{width:360px;background:#0f172a;color:#fff;border-radius:16px;padding:14px}.upm-stats h2{margin:4px 0 12px}.upm-statgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.upm-stat{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:8px}.upm-stat span{display:block;font-size:8px;color:#94a3b8;text-transform:uppercase}.upm-stat b{font-size:13px}.upm-summary{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)}.upm-summary input{width:100%;margin-top:4px;background:#111827;border:1px solid #334155;color:#fff;border-radius:8px;padding:8px;font:10px ui-monospace,monospace}.upm-warning{font-size:9px;color:#fca5a5;margin-top:5px}.upm-help{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.upm-help article{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px}.upm-help h3{font-size:13px;margin:0 0 6px}.upm-help p{font-size:10px;line-height:1.5;color:#475569;margin:4px 0}@media(max-width:900px){.upm-help{grid-template-columns:1fr}.upm-card{width:280px}.upm-stats{width:320px}.upm-template,.upm-name{min-width:220px}}
      `}</style>

      <header className="upm-top"><div className="upm-topin"><div className="upm-mark">Σ</div><div className="upm-brand"><b>Universal Process Math</b><span>ProcessScenarioProfile · Domain Packs · DAG formulas</span></div><button className="upm-btn upm-back" onClick={() => window.location.assign(window.location.pathname)}>← AutoTrace</button></div></header>

      <main className="upm-main">
        <section className="upm-hero"><div className="upm-eyebrow">Domain-neutral mathematical workbench</div><h1>Один редактор для разных процессов</h1><p className="upm-sub">Manufacturing, service, compute и LBC загружаются как Domain Pack шаблоны. Редактор работает только с универсальным `ProcessScenarioProfile`: предметная область не меняет математику DAG, формулы или формат экспорта.</p></section>

        <section className="upm-toolbar">
          <div className="upm-field"><label>Domain Pack / шаблон</label><select className="upm-select upm-template" value={templateRef} onChange={event => applyTemplate(event.target.value)}><option value={CUSTOM_TEMPLATE}>Custom · новый универсальный процесс</option>{DOMAIN_PACKS.map(pack => <optgroup key={pack.id} label={`${pack.name} · ${pack.version}`}>{TEMPLATE_CATALOG.filter(item => item.packId === pack.id).map(item => <option key={item.ref} value={item.ref}>{item.templateName}</option>)}</optgroup>)}</select></div>
          <div className="upm-field"><label>Название</label><input className="upm-input upm-name" value={profile.name} onChange={event => updateProfile(draft => { draft.name = event.target.value; })} /></div>
          <div className="upm-field"><label>Jobs / размер партии</label><input className="upm-input" type="number" min="1" step="1" value={batchSize} onChange={event => commit(resizeProcessScenarioJobs(profile, Number(event.target.value)))} /></div>
          <button className="upm-btn primary" onClick={addStage}>+ Блок</button><button className="upm-btn" onClick={exportProfile}>Экспорт profile JSON</button><button className="upm-btn" onClick={() => setJsonOpen(value => !value)}>Импорт</button><button className="upm-btn danger" onClick={() => applyTemplate(CUSTOM_TEMPLATE)}>Сброс</button>
        </section>

        <div className="upm-context"><span className="upm-chip">domain: {profile.domain || 'generic'}</span><span className="upm-chip">pack: {packId}@{packVersion}</span><span className="upm-chip">schema: {profile.schemaVersion}</span><span className="upm-chip">jobs: {batchSize}</span>{readiness && <span className={`upm-chip ${readiness.simulationReady ? 'ok' : 'warn'}`}>timing coverage {roundSmart(readiness.coveragePercent)}% · {readiness.simulationReady ? 'simulation-ready' : 'needs timings'}</span>}</div>
        {notice && <div className="upm-notice">{notice}</div>}

        {jsonOpen && <section className="upm-json"><textarea value={importText} onChange={event => setImportText(event.target.value)} placeholder="Вставьте ProcessScenarioProfile JSON…"/><div className="upm-json-actions"><button className="upm-btn primary" onClick={importProfile}>Применить</button><button className="upm-btn" onClick={() => setJsonOpen(false)}>Закрыть</button></div></section>}

        <section className="upm-board-shell"><div className="upm-board">
          {profile.blocks.map((block, index) => {
            const result = analysis.results[block.id];
            return <div className="upm-wrap" key={block.id}><article className={`upm-card ${result?.error ? 'error' : ''}`}>
              <div className="upm-head"><span className="upm-index">{String(index + 1).padStart(2, '0')}</span><span className="upm-kind">{AUTOMATION.find(item => item.id === block.automation)?.label || block.automation}</span></div>
              <div className="upm-field"><label>Название блока</label><input className="upm-input" value={block.title} onChange={event => updateBlock(block.id, current => ({ ...current, title: event.target.value }))}/></div>
              <div className="upm-grid2"><div className="upm-field"><label>Математический ключ</label><input className="upm-input upm-formula" value={block.key} onChange={event => updateBlock(block.id, current => ({ ...current, key: event.target.value }))}/></div><div className="upm-field"><label>Тип</label><select className="upm-select" value={block.automation} onChange={event => updateBlock(block.id, current => ({ ...current, automation: event.target.value as ProcessAutomationKind }))}>{AUTOMATION.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div></div>
              <div className="upm-grid2"><div className="upm-field"><label>Время</label><input className="upm-input" type="number" min="0" step="any" value={block.time.value ?? ''} disabled={Boolean(block.time.formula?.trim())} onChange={event => updateBlock(block.id, current => ({ ...current, time: { ...current.time, value: event.target.value === '' ? null : Number(event.target.value) } }))}/></div><div className="upm-field"><label>Единица</label><select className="upm-select" value={block.time.unit} disabled={Boolean(block.time.formula?.trim())} onChange={event => updateBlock(block.id, current => ({ ...current, time: { ...current.time, unit: event.target.value as ProcessTimeUnit } }))}><option value="ms">мс</option><option value="s">с</option><option value="min">мин</option><option value="h">ч</option></select></div></div>
              <div className="upm-field"><label>Формула, результат в секундах</label><input className="upm-input upm-formula" value={block.time.formula || ''} placeholder="например: prep.time + 30" onChange={event => updateBlock(block.id, current => ({ ...current, time: { ...current.time, formula: event.target.value } }))}/></div>
              <div className="upm-field"><label>Зависимости DAG</label><div className="upm-deps">{profile.blocks.filter(candidate => candidate.id !== block.id).map(candidate => <label key={candidate.id}><input type="checkbox" checked={block.dependencies.includes(candidate.id)} onChange={event => updateBlock(block.id, current => ({ ...current, dependencies: event.target.checked ? Array.from(new Set([...current.dependencies, candidate.id])) : current.dependencies.filter(dep => dep !== candidate.id) }))}/>{candidate.title}</label>)}</div></div>
              <div className="upm-eval"><div>Результат</div><b>{result?.seconds != null ? formatDuration(result.seconds) : '—'}</b>{result?.criticalFinishSeconds != null && <div>Финиш по графу: {formatDuration(result.criticalFinishSeconds)}</div>}<div>Переменная: <code>{result?.key || block.key}.time</code></div></div>{result?.error && <div className="upm-error">⚠ {result.error}</div>}
              <div className="upm-actions"><button onClick={() => moveStage(block.id, -1)} disabled={index === 0}>←</button><button onClick={() => moveStage(block.id, 1)} disabled={index === profile.blocks.length - 1}>→</button><button onClick={() => duplicateStage(block.id)}>Дублировать</button><button onClick={() => removeStage(block.id)}>Удалить</button></div>
            </article><div className="upm-arrow"/></div>;
          })}
          <aside className="upm-stats"><div className="upm-eyebrow">Universal graph analysis</div><h2>Σ Статистика</h2><div className="upm-statgrid"><div className="upm-stat"><span>Сумма времён</span><b>{formatDuration(stats.totalStageSeconds)}</b></div><div className="upm-stat"><span>Критический путь</span><b>{formatDuration(stats.criticalPathSeconds)}</b></div><div className="upm-stat"><span>Ручное</span><b>{formatDuration(stats.manualSeconds)}</b></div><div className="upm-stat"><span>Автоматическое</span><b>{formatDuration(stats.automaticSeconds)}</b></div><div className="upm-stat"><span>Покрытие</span><b>{roundSmart(stats.coveragePercent)}%</b></div><div className="upm-stat"><span>Автоматизация</span><b>{roundSmart(stats.automationTimeSharePercent)}%</b></div><div className="upm-stat"><span>Узкое место</span><b>{stats.bottleneckBlockTitle || '—'}</b></div><div className="upm-stat"><span>Throughput</span><b>{stats.throughputPerHour == null ? '—' : `${roundSmart(stats.throughputPerHour)}/ч`}</b></div></div><div className="upm-summary"><div className="upm-eyebrow">Итоговая формула</div><input value={summaryFormula} onChange={event => commit(withProcessMathMetadata(profile, { summaryFormula: event.target.value }))}/><div style={{marginTop:6,fontWeight:900,color:'#a7f3d0'}}>{analysis.summaryFormula?.ok ? `= ${roundSmart(analysis.summaryFormula.value ?? 0)}` : '—'}</div>{analysis.summaryFormula && !analysis.summaryFormula.ok && <div className="upm-warning">{analysis.summaryFormula.error}</div>}{stats.hasCycle && <div className="upm-warning">Цикл: {stats.cycleBlockIds.join(', ')}</div>}{analysis.warnings.map((warning, warningIndex) => <div className="upm-warning" key={warningIndex}>{warning}</div>)}</div></aside>
        </div></section>

        <section className="upm-help"><article><h3>Теперь шаблоны действительно универсальны</h3><p>Dropdown строится из `ProcessDomainPackManifest`, а не из `LBC_PLATFORMS`. Чтобы добавить новый класс процессов, достаточно зарегистрировать новый pack с profile templates.</p><p>Существующий LBC-каталог подключён как отдельный pack и не добавляет лабораторных условий в математическое ядро.</p></article><article><h3>Без подмены неизвестных данных</h3><p>Для LBC source-time автоматически извлекается только там, где строка содержит однозначное число. Диапазоны и «не опубликовано» остаются пустыми. Их можно заполнить валидированными измерениями прямо здесь, после чего экспортировать уже полноценный universal profile.</p></article></section>
      </main>
    </div>
  );
}
