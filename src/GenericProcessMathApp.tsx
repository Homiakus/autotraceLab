import React, { useMemo, useState } from 'react';
import { LBC_PLATFORMS } from './data/lbcWorkflowData';
import {
  ProcessTimeInput,
  ProcessTimeUnit,
  extractInitialDuration,
  formatDuration,
  roundSmart,
} from './processMath';
import {
  GraphProcessBlock,
  ProcessAutomationKind,
  analyzeGraphProcess,
} from './processGraphMath';

const STORAGE_KEY = 'autotrace:generic-process-math:v1';

const AUTOMATION: Array<{ id: ProcessAutomationKind; label: string; color: string }> = [
  { id: 'manual', label: 'Ручной', color: '#F59E0B' },
  { id: 'automatic', label: 'Автоматический', color: '#10B981' },
  { id: 'mixed', label: 'Смешанный', color: '#8B5CF6' },
  { id: 'wait', label: 'Ожидание', color: '#3B82F6' },
  { id: 'external', label: 'Внешний модуль', color: '#06B6D4' },
  { id: 'qc', label: 'QC', color: '#EF4444' },
];

interface SavedModel {
  name: string;
  blocks: GraphProcessBlock[];
  batchSize: number;
  summaryFormula: string;
}

function newBlock(index: number, dependency?: string): GraphProcessBlock {
  return {
    id: `stage_${Date.now()}_${index}`,
    key: `stage_${index + 1}`,
    title: `Этап ${index + 1}`,
    automation: 'automatic',
    time: { value: 1, unit: 'min' },
    dependencies: dependency ? [dependency] : [],
  };
}

function genericDefault(): SavedModel {
  const receipt: GraphProcessBlock = {
    id: 'receipt',
    key: 'receipt',
    title: 'Приём и регистрация',
    automation: 'manual',
    time: { value: 2, unit: 'min' },
    dependencies: [],
  };
  const processing: GraphProcessBlock = {
    id: 'processing',
    key: 'processing',
    title: 'Автоматическая обработка',
    automation: 'automatic',
    time: { value: 12, unit: 'min' },
    dependencies: ['receipt'],
  };
  const qc: GraphProcessBlock = {
    id: 'qc',
    key: 'qc',
    title: 'Финальный контроль',
    automation: 'qc',
    time: { value: null, unit: 's', formula: 'max(30, receipt.time / 4)' },
    dependencies: ['processing'],
  };
  return {
    name: 'Новый технологический процесс',
    blocks: [receipt, processing, qc],
    batchSize: 1,
    summaryFormula: 'total.time / batch.count',
  };
}

function modelFromLbc(platformId: string): SavedModel {
  const platform = LBC_PLATFORMS.find(item => item.id === platformId);
  if (!platform) return genericDefault();
  let previousId: string | undefined;
  const blocks: GraphProcessBlock[] = platform.stages.map((stage, index) => {
    const id = `${stage.phase}_${index + 1}`;
    const time: ProcessTimeInput = extractInitialDuration(stage.time);
    const block: GraphProcessBlock = {
      id,
      key: stage.phase,
      title: stage.title,
      automation: stage.automation,
      time,
      dependencies: previousId ? [previousId] : [],
    };
    previousId = id;
    return block;
  });
  return {
    name: `${platform.vendor} ${platform.name}`,
    blocks,
    batchSize: 1,
    summaryFormula: 'critical.time',
  };
}

function loadInitial(): SavedModel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedModel;
      if (Array.isArray(parsed.blocks)) return parsed;
    }
  } catch {
    // Ignore invalid local cache.
  }
  return genericDefault();
}

function automationMeta(kind: ProcessAutomationKind) {
  return AUTOMATION.find(item => item.id === kind) || AUTOMATION[0];
}

export default function GenericProcessMathApp() {
  const initial = useMemo(loadInitial, []);
  const [name, setName] = useState(initial.name);
  const [blocks, setBlocks] = useState<GraphProcessBlock[]>(initial.blocks);
  const [batchSize, setBatchSize] = useState(initial.batchSize);
  const [summaryFormula, setSummaryFormula] = useState(initial.summaryFormula);
  const [template, setTemplate] = useState('generic');
  const [jsonOpen, setJsonOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState('');

  const analysis = useMemo(
    () => analyzeGraphProcess(blocks, { batchSize, summaryFormula }),
    [blocks, batchSize, summaryFormula],
  );

  const persist = (next?: Partial<SavedModel>) => {
    const model: SavedModel = {
      name: next?.name ?? name,
      blocks: next?.blocks ?? blocks,
      batchSize: next?.batchSize ?? batchSize,
      summaryFormula: next?.summaryFormula ?? summaryFormula,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  };

  const updateBlock = (id: string, updater: (block: GraphProcessBlock) => GraphProcessBlock) => {
    setBlocks(current => {
      const next = current.map(block => block.id === id ? updater(block) : block);
      queueMicrotask(() => persist({ blocks: next }));
      return next;
    });
  };

  const applyTemplate = (value: string) => {
    setTemplate(value);
    const model = value === 'generic' ? genericDefault() : modelFromLbc(value);
    setName(model.name);
    setBlocks(model.blocks);
    setBatchSize(model.batchSize);
    setSummaryFormula(model.summaryFormula);
    persist(model);
  };

  const addStage = () => {
    setBlocks(current => {
      const block = newBlock(current.length, current.at(-1)?.id);
      const next = [...current, block];
      queueMicrotask(() => persist({ blocks: next }));
      return next;
    });
  };

  const duplicateStage = (id: string) => {
    setBlocks(current => {
      const source = current.find(block => block.id === id);
      if (!source) return current;
      const duplicate: GraphProcessBlock = {
        ...source,
        id: `${source.id}_copy_${Date.now()}`,
        key: `${source.key}_copy`,
        title: `${source.title} — копия`,
        dependencies: [...source.dependencies],
        time: { ...source.time },
      };
      const index = current.findIndex(block => block.id === id);
      const next = [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)];
      queueMicrotask(() => persist({ blocks: next }));
      return next;
    });
  };

  const removeStage = (id: string) => {
    setBlocks(current => {
      const next = current
        .filter(block => block.id !== id)
        .map(block => ({ ...block, dependencies: block.dependencies.filter(dep => dep !== id) }));
      queueMicrotask(() => persist({ blocks: next }));
      return next;
    });
  };

  const moveStage = (id: string, direction: -1 | 1) => {
    setBlocks(current => {
      const index = current.findIndex(block => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      queueMicrotask(() => persist({ blocks: next }));
      return next;
    });
  };

  const exportModel = async () => {
    const model: SavedModel = { name, blocks, batchSize, summaryFormula };
    const text = JSON.stringify(model, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setNotice('JSON модели скопирован в буфер обмена');
    } catch {
      setImportText(text);
      setJsonOpen(true);
      setNotice('Clipboard недоступен — JSON открыт в поле экспорта');
    }
  };

  const importModel = () => {
    try {
      const parsed = JSON.parse(importText) as SavedModel;
      if (!parsed || !Array.isArray(parsed.blocks)) throw new Error('Поле blocks отсутствует');
      const normalized: SavedModel = {
        name: parsed.name || 'Импортированный процесс',
        blocks: parsed.blocks,
        batchSize: Number(parsed.batchSize) > 0 ? Number(parsed.batchSize) : 1,
        summaryFormula: parsed.summaryFormula || 'critical.time',
      };
      setName(normalized.name);
      setBlocks(normalized.blocks);
      setBatchSize(normalized.batchSize);
      setSummaryFormula(normalized.summaryFormula);
      persist(normalized);
      setNotice('Модель импортирована');
      setJsonOpen(false);
    } catch (error) {
      setNotice(`Ошибка импорта: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    }
  };

  const stats = analysis.stats;

  return (
    <div className="pm-app">
      <style>{`
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .pm-app { min-height:100vh; background:#F6F8FB; color:#0F172A; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .pm-top { position:sticky; top:0; z-index:40; background:rgba(246,248,251,.94); backdrop-filter:blur(14px); border-bottom:1px solid #E2E8F0; }
        .pm-top-inner { max-width:1800px; margin:auto; padding:13px 20px; display:flex; align-items:center; gap:12px; }
        .pm-mark { width:38px; height:38px; border-radius:12px; background:#0F172A; color:white; display:grid; place-items:center; font-weight:900; }
        .pm-brand { min-width:0; }
        .pm-brand b { display:block; font-size:14px; }
        .pm-brand span { display:block; color:#64748B; font-size:11px; }
        .pm-back { margin-left:auto; border:1px solid #CBD5E1; background:white; border-radius:9px; padding:8px 10px; cursor:pointer; color:#334155; }
        .pm-hero { max-width:1800px; margin:auto; padding:28px 20px 14px; }
        .pm-eyebrow { text-transform:uppercase; letter-spacing:.13em; font-size:10px; font-weight:900; color:#64748B; }
        .pm-hero h1 { margin:7px 0 8px; font-size:clamp(28px,4vw,48px); line-height:1.04; letter-spacing:-.045em; }
        .pm-hero p { max-width:980px; color:#475569; line-height:1.6; margin:0; }
        .pm-toolbar { max-width:1800px; margin:auto; padding:12px 20px 20px; display:flex; flex-wrap:wrap; gap:9px; align-items:end; }
        .pm-field { display:flex; flex-direction:column; gap:4px; }
        .pm-field label { font-size:9px; font-weight:900; color:#64748B; text-transform:uppercase; letter-spacing:.08em; }
        .pm-input,.pm-select { border:1px solid #CBD5E1; background:white; border-radius:9px; padding:9px 10px; min-height:36px; font:inherit; font-size:12px; color:#0F172A; outline:none; }
        .pm-input:focus,.pm-select:focus { border-color:#64748B; box-shadow:0 0 0 3px rgba(100,116,139,.1); }
        .pm-name { min-width:260px; }
        .pm-btn { border:1px solid #CBD5E1; background:white; border-radius:9px; padding:9px 11px; min-height:36px; cursor:pointer; font:inherit; font-size:11px; font-weight:800; color:#334155; }
        .pm-btn.primary { background:#0F172A; color:white; border-color:#0F172A; }
        .pm-btn.danger { color:#B91C1C; }
        .pm-notice { max-width:1800px; margin:0 auto 10px; padding:0 20px; color:#475569; font-size:11px; }
        .pm-board-shell { border-top:1px solid #E2E8F0; border-bottom:1px solid #E2E8F0; background:#EEF2F7; overflow-x:auto; padding:22px 20px 28px; }
        .pm-board { min-width:max-content; display:flex; align-items:stretch; gap:0; }
        .pm-stage-wrap { display:flex; align-items:center; }
        .pm-card { width:320px; min-height:410px; background:white; border:1px solid #E2E8F0; border-top:5px solid var(--tone); border-radius:16px; padding:14px; box-shadow:0 6px 18px rgba(15,23,42,.05); display:flex; flex-direction:column; gap:10px; }
        .pm-card.error { box-shadow:0 0 0 2px rgba(239,68,68,.18),0 6px 18px rgba(15,23,42,.05); }
        .pm-card-head { display:flex; gap:8px; align-items:center; }
        .pm-index { width:28px; height:28px; border-radius:9px; display:grid; place-items:center; background:#F1F5F9; font-size:11px; font-weight:900; color:#64748B; }
        .pm-pill { margin-left:auto; border:1px solid var(--tone); color:var(--tone); border-radius:999px; padding:4px 7px; font-size:8px; font-weight:900; text-transform:uppercase; }
        .pm-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
        .pm-card .pm-input,.pm-card .pm-select { width:100%; min-width:0; padding:7px 8px; min-height:32px; }
        .pm-formula { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; }
        .pm-eval { border-radius:10px; padding:9px; background:#F8FAFC; border:1px solid #E2E8F0; font-size:10px; line-height:1.45; }
        .pm-eval b { font-size:14px; color:#0F172A; }
        .pm-error { color:#B91C1C; font-size:9px; line-height:1.4; }
        .pm-deps { border:1px solid #E2E8F0; border-radius:10px; padding:8px; background:#FAFBFC; max-height:100px; overflow:auto; }
        .pm-deps label { display:flex; align-items:center; gap:6px; font-size:9px; color:#475569; padding:2px 0; }
        .pm-actions { margin-top:auto; display:flex; gap:5px; flex-wrap:wrap; }
        .pm-actions button { border:1px solid #E2E8F0; background:#F8FAFC; border-radius:7px; padding:5px 7px; font-size:9px; cursor:pointer; color:#475569; }
        .pm-arrow { width:54px; position:relative; flex:none; }
        .pm-arrow:before { content:""; position:absolute; left:6px; right:10px; top:50%; height:2px; background:#94A3B8; }
        .pm-arrow:after { content:""; position:absolute; right:5px; top:calc(50% - 5px); border-left:8px solid #94A3B8; border-top:5px solid transparent; border-bottom:5px solid transparent; }
        .pm-stats { width:360px; min-height:410px; background:#0F172A; color:white; border-radius:18px; padding:16px; box-shadow:0 12px 28px rgba(15,23,42,.18); }
        .pm-stats-eyebrow { color:#94A3B8; text-transform:uppercase; letter-spacing:.12em; font-size:9px; font-weight:900; }
        .pm-stats h2 { margin:5px 0 13px; font-size:24px; letter-spacing:-.04em; }
        .pm-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .pm-stat { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); border-radius:11px; padding:9px; }
        .pm-stat span { display:block; color:#94A3B8; font-size:8px; text-transform:uppercase; letter-spacing:.07em; margin-bottom:4px; }
        .pm-stat b { font-size:14px; }
        .pm-summary { margin-top:11px; border-top:1px solid rgba(255,255,255,.12); padding-top:10px; }
        .pm-summary input { width:100%; margin-top:5px; background:#111827; border:1px solid #334155; color:#E2E8F0; border-radius:8px; padding:8px; font-family:ui-monospace,monospace; font-size:10px; }
        .pm-summary-result { color:#A7F3D0; font-weight:900; margin-top:6px; font-size:13px; }
        .pm-warning { color:#FCA5A5; font-size:9px; margin-top:6px; line-height:1.4; }
        .pm-help { max-width:1800px; margin:auto; padding:24px 20px 50px; display:grid; grid-template-columns:1.2fr 1fr; gap:14px; }
        .pm-help-card { background:white; border:1px solid #E2E8F0; border-radius:14px; padding:15px; }
        .pm-help-card h3 { margin:0 0 8px; font-size:14px; }
        .pm-help-card p,.pm-help-card li { color:#475569; font-size:10px; line-height:1.55; }
        .pm-help-card code { background:#F1F5F9; padding:2px 4px; border-radius:4px; color:#0F172A; }
        .pm-json { max-width:1800px; margin:0 auto 20px; padding:0 20px; }
        .pm-json textarea { width:100%; min-height:220px; border:1px solid #CBD5E1; border-radius:12px; padding:12px; font-family:ui-monospace,monospace; font-size:10px; }
        .pm-json-actions { display:flex; gap:8px; margin-top:8px; }
        @media(max-width:800px){ .pm-help{grid-template-columns:1fr}.pm-card{width:290px}.pm-stats{width:320px}.pm-top-inner,.pm-toolbar,.pm-hero{padding-left:12px;padding-right:12px} }
      `}</style>

      <header className="pm-top">
        <div className="pm-top-inner">
          <div className="pm-mark">Σ</div>
          <div className="pm-brand">
            <b>AutoTrace · Process Math Workbench</b>
            <span>Время, формулы, зависимости, критический путь и итоговая статистика</span>
          </div>
          <button className="pm-back" onClick={() => window.location.assign(window.location.pathname)}>← AutoTrace</button>
        </div>
      </header>

      <section className="pm-hero">
        <div className="pm-eyebrow">Универсальная математическая модель технологического процесса</div>
        <h1>Математика прикреплена к блокам</h1>
        <p>
          Каждый блок имеет время или формулу, собственный математический ключ и зависимости от других блоков. Итоговый Σ-блок
          автоматически пересчитывает суммарное время, критический путь графа, узкое место, долю автоматизации и производительность партии.
        </p>
      </section>

      <section className="pm-toolbar">
        <div className="pm-field">
          <label>Шаблон</label>
          <select className="pm-select" value={template} onChange={e => applyTemplate(e.target.value)}>
            <option value="generic">Универсальный пример</option>
            {LBC_PLATFORMS.map(platform => (
              <option key={platform.id} value={platform.id}>{platform.vendor} · {platform.name}</option>
            ))}
          </select>
        </div>
        <div className="pm-field pm-name">
          <label>Название процесса</label>
          <input className="pm-input" value={name} onChange={e => { setName(e.target.value); persist({ name: e.target.value }); }} />
        </div>
        <div className="pm-field">
          <label>Размер партии</label>
          <input className="pm-input" type="number" min="1" step="1" value={batchSize} onChange={e => { const value = Math.max(1, Number(e.target.value) || 1); setBatchSize(value); persist({ batchSize: value }); }} />
        </div>
        <button className="pm-btn primary" onClick={addStage}>+ Добавить блок</button>
        <button className="pm-btn" onClick={exportModel}>Экспорт JSON</button>
        <button className="pm-btn" onClick={() => setJsonOpen(value => !value)}>Импорт</button>
        <button className="pm-btn danger" onClick={() => applyTemplate('generic')}>Сброс</button>
      </section>

      {notice && <div className="pm-notice">{notice}</div>}

      {jsonOpen && (
        <section className="pm-json">
          <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Вставьте JSON модели процесса…" />
          <div className="pm-json-actions">
            <button className="pm-btn primary" onClick={importModel}>Применить JSON</button>
            <button className="pm-btn" onClick={() => setJsonOpen(false)}>Закрыть</button>
          </div>
        </section>
      )}

      <section className="pm-board-shell">
        <div className="pm-board">
          {blocks.map((block, index) => {
            const meta = automationMeta(block.automation);
            const result = analysis.results[block.id];
            const hasError = Boolean(result?.error);
            return (
              <div className="pm-stage-wrap" key={block.id}>
                <article className={`pm-card ${hasError ? 'error' : ''}`} style={{ '--tone': meta.color } as React.CSSProperties}>
                  <div className="pm-card-head">
                    <span className="pm-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="pm-pill" style={{ '--tone': meta.color } as React.CSSProperties}>{meta.label}</span>
                  </div>

                  <div className="pm-field">
                    <label>Название блока</label>
                    <input className="pm-input" value={block.title} onChange={e => updateBlock(block.id, current => ({ ...current, title: e.target.value }))} />
                  </div>

                  <div className="pm-grid2">
                    <div className="pm-field">
                      <label>Математический ключ</label>
                      <input className="pm-input pm-formula" value={block.key} onChange={e => updateBlock(block.id, current => ({ ...current, key: e.target.value }))} />
                    </div>
                    <div className="pm-field">
                      <label>Тип операции</label>
                      <select className="pm-select" value={block.automation} onChange={e => updateBlock(block.id, current => ({ ...current, automation: e.target.value as ProcessAutomationKind }))}>
                        {AUTOMATION.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="pm-grid2">
                    <div className="pm-field">
                      <label>Фиксированное время</label>
                      <input
                        className="pm-input"
                        type="number"
                        min="0"
                        step="any"
                        value={block.time.value ?? ''}
                        disabled={Boolean(block.time.formula?.trim())}
                        onChange={e => updateBlock(block.id, current => ({ ...current, time: { ...current.time, value: e.target.value === '' ? null : Number(e.target.value) } }))}
                      />
                    </div>
                    <div className="pm-field">
                      <label>Единица</label>
                      <select className="pm-select" value={block.time.unit} disabled={Boolean(block.time.formula?.trim())} onChange={e => updateBlock(block.id, current => ({ ...current, time: { ...current.time, unit: e.target.value as ProcessTimeUnit } }))}>
                        <option value="ms">мс</option><option value="s">с</option><option value="min">мин</option><option value="h">ч</option>
                      </select>
                    </div>
                  </div>

                  <div className="pm-field">
                    <label>Формула времени, результат в секундах</label>
                    <input
                      className="pm-input pm-formula"
                      placeholder="например: prep.time + 30"
                      value={block.time.formula || ''}
                      onChange={e => updateBlock(block.id, current => ({ ...current, time: { ...current.time, formula: e.target.value } }))}
                    />
                  </div>

                  <div className="pm-field">
                    <label>Зависит от блоков</label>
                    <div className="pm-deps">
                      {blocks.filter(candidate => candidate.id !== block.id).length === 0 && <span style={{ fontSize: 9, color: '#94A3B8' }}>Нет других блоков</span>}
                      {blocks.filter(candidate => candidate.id !== block.id).map(candidate => (
                        <label key={candidate.id}>
                          <input
                            type="checkbox"
                            checked={block.dependencies.includes(candidate.id)}
                            onChange={e => updateBlock(block.id, current => ({
                              ...current,
                              dependencies: e.target.checked
                                ? Array.from(new Set([...current.dependencies, candidate.id]))
                                : current.dependencies.filter(dep => dep !== candidate.id),
                            }))}
                          />
                          {candidate.title}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pm-eval">
                    <div>Результат блока</div>
                    <b>{result?.seconds != null ? formatDuration(result.seconds) : '—'}</b>
                    {result?.criticalFinishSeconds != null && <div>Финиш по графу: {formatDuration(result.criticalFinishSeconds)}</div>}
                    <div>Переменная: <code>{result?.key || block.key}.time</code></div>
                  </div>
                  {result?.error && <div className="pm-error">⚠ {result.error}</div>}

                  <div className="pm-actions">
                    <button onClick={() => moveStage(block.id, -1)} disabled={index === 0}>←</button>
                    <button onClick={() => moveStage(block.id, 1)} disabled={index === blocks.length - 1}>→</button>
                    <button onClick={() => duplicateStage(block.id)}>Дублировать</button>
                    <button onClick={() => removeStage(block.id)}>Удалить</button>
                  </div>
                </article>
                <div className="pm-arrow" />
              </div>
            );
          })}

          <aside className="pm-stats">
            <div className="pm-stats-eyebrow">Итоговый математический блок</div>
            <h2>Σ Статистика</h2>
            <div className="pm-stat-grid">
              <div className="pm-stat"><span>Сумма времён</span><b>{formatDuration(stats.totalStageSeconds)}</b></div>
              <div className="pm-stat"><span>Критический путь</span><b>{formatDuration(stats.criticalPathSeconds)}</b></div>
              <div className="pm-stat"><span>Ручное время</span><b>{formatDuration(stats.manualSeconds)}</b></div>
              <div className="pm-stat"><span>Авто время</span><b>{formatDuration(stats.automaticSeconds)}</b></div>
              <div className="pm-stat"><span>Покрытие</span><b>{roundSmart(stats.coveragePercent)}%</b></div>
              <div className="pm-stat"><span>Автоматизация</span><b>{roundSmart(stats.automationTimeSharePercent)}%</b></div>
              <div className="pm-stat"><span>Узкое место</span><b>{stats.bottleneckBlockTitle || '—'}</b></div>
              <div className="pm-stat"><span>Пропускная способность</span><b>{stats.throughputPerHour == null ? '—' : `${roundSmart(stats.throughputPerHour)}/ч`}</b></div>
            </div>
            <div className="pm-summary">
              <div className="pm-stats-eyebrow">Пользовательская формула итогового блока</div>
              <input value={summaryFormula} onChange={e => { setSummaryFormula(e.target.value); persist({ summaryFormula: e.target.value }); }} placeholder="например: total.time / batch.count" />
              <div className="pm-summary-result">
                {analysis.summaryFormula?.ok ? `= ${roundSmart(analysis.summaryFormula.value ?? 0)}` : '—'}
              </div>
              {analysis.summaryFormula && !analysis.summaryFormula.ok && <div className="pm-warning">{analysis.summaryFormula.error}</div>}
            </div>
            {stats.hasCycle && <div className="pm-warning">Цикл зависимостей: {stats.cycleBlockIds.join(', ')}</div>}
            {analysis.warnings.map((warning, index) => <div className="pm-warning" key={index}>{warning}</div>)}
          </aside>
        </div>
      </section>

      <section className="pm-help">
        <div className="pm-help-card">
          <h3>Как связывать формулы</h3>
          <p>
            Каждый блок получает безопасный математический ключ. Например, если ключ первого блока <code>prep</code>, его время доступно как
            <code> prep.time</code>. Следующий блок может иметь формулу <code>prep.time + 30</code>. Все формулы времени возвращают секунды.
          </p>
          <p>Поддерживаются <code>+ - * / ^</code>, скобки и функции <code>sum</code>, <code>avg</code>, <code>min</code>, <code>max</code>, <code>round</code>, <code>ceil</code>, <code>floor</code>, <code>abs</code>, <code>sqrt</code>.</p>
        </div>
        <div className="pm-help-card">
          <h3>Переменные итогового Σ-блока</h3>
          <ul>
            <li><code>total.time</code> — сумма времён всех рассчитанных блоков.</li>
            <li><code>critical.time</code> — длительность критического пути с учётом ветвлений.</li>
            <li><code>manual.time</code>, <code>automatic.time</code>, <code>mixed.time</code>.</li>
            <li><code>bottleneck.time</code> — максимальное время одного этапа.</li>
            <li><code>batch.count</code>, <code>throughput.hour</code>, <code>coverage.percent</code>, <code>automation.percent</code>.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
