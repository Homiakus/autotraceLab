import React, { useMemo, useState } from 'react';
import {
  LBC_AUTOMATION_COLORS,
  LBC_AUTOMATION_LABELS,
  LBC_EVIDENCE_LABELS,
  LBC_PHASES,
  LBC_PLATFORMS,
  LbcAutomationKind,
  LbcPlatform,
  LbcStage,
} from './data/lbcWorkflowData';

const statusOrder: LbcAutomationKind[] = ['manual', 'automatic', 'mixed', 'wait', 'external', 'qc'];

const evidenceTone: Record<string, string> = {
  manufacturer: '#0F766E',
  'official-register': '#1D4ED8',
  publication: '#7C3AED',
  secondary: '#64748B',
  'lab-estimate': '#B45309',
  'not-published': '#475569',
};

function PlatformImage({ platform }: { platform: LbcPlatform }) {
  if (!platform.imageUrl) {
    return (
      <div className="lbc-image-placeholder" aria-label="Схематический вид платформы">
        <div className="lbc-machine-glyph">
          <span />
          <span />
          <span />
        </div>
        <small>фото не встроено</small>
      </div>
    );
  }

  return (
    <div className="lbc-platform-image-wrap">
      <img
        className="lbc-platform-image"
        src={platform.imageUrl}
        alt={platform.imageAlt || platform.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
          const parent = event.currentTarget.parentElement;
          if (parent) parent.classList.add('lbc-image-failed');
        }}
      />
      <div className="lbc-image-fallback">Фото недоступно — используйте ссылку на источник</div>
    </div>
  );
}

function StatusPill({ stage }: { stage: LbcStage }) {
  const color = LBC_AUTOMATION_COLORS[stage.automation];
  return (
    <span className="lbc-status-pill" style={{ borderColor: color, color }}>
      <span className="lbc-status-dot" style={{ background: color }} />
      {LBC_AUTOMATION_LABELS[stage.automation]}
    </span>
  );
}

function StageCard({ stage, isLast }: { stage: LbcStage; isLast: boolean }) {
  const color = LBC_AUTOMATION_COLORS[stage.automation];
  return (
    <div className="lbc-stage-slot">
      <article className="lbc-stage-card" style={{ borderTopColor: color }}>
        <div className="lbc-stage-meta">
          <StatusPill stage={stage} />
          <span className="lbc-evidence-pill" style={{ color: evidenceTone[stage.evidence] || '#475569' }}>
            {LBC_EVIDENCE_LABELS[stage.evidence]}
          </span>
        </div>
        <h3>{stage.title}</h3>
        <div className="lbc-time">⏱ {stage.time}</div>
        <p>{stage.description}</p>

        {(stage.operator || stage.machine || stage.note) && (
          <details className="lbc-details">
            <summary>Что именно делает человек и автомат</summary>
            {stage.operator && (
              <div className="lbc-detail-row">
                <b>Человек</b>
                <span>{stage.operator}</span>
              </div>
            )}
            {stage.machine && (
              <div className="lbc-detail-row">
                <b>Автомат</b>
                <span>{stage.machine}</span>
              </div>
            )}
            {stage.note && (
              <div className="lbc-detail-row">
                <b>Примечание</b>
                <span>{stage.note}</span>
              </div>
            )}
          </details>
        )}

        {stage.sourceUrl && (
          <a className="lbc-source-link" href={stage.sourceUrl} target="_blank" rel="noreferrer">
            источник этапа ↗
          </a>
        )}
      </article>
      {!isLast && (
        <div className="lbc-flow-arrow" aria-hidden="true">
          <span style={{ background: color }} />
          <i style={{ borderTopColor: color }} />
        </div>
      )}
    </div>
  );
}

function PlatformHeader({ platform }: { platform: LbcPlatform }) {
  const stainLabel =
    platform.staining === 'integrated'
      ? 'Окраска встроена'
      : platform.staining === 'optional'
        ? 'Окраска опциональна'
        : 'Окраска отдельно';

  return (
    <section className="lbc-platform-header">
      <PlatformImage platform={platform} />
      <div className="lbc-vendor">{platform.vendor}</div>
      <h2>{platform.name}</h2>
      <p className="lbc-principle">{platform.principle}</p>
      <div className="lbc-kpi-grid">
        <div>
          <span>Цикл</span>
          <b>{platform.totalTime}</b>
        </div>
        <div>
          <span>Производительность</span>
          <b>{platform.throughput}</b>
        </div>
      </div>
      <div className={`lbc-stain-badge ${platform.staining}`}>{stainLabel}</div>
      {platform.registrationRu && <div className="lbc-registration">РФ: {platform.registrationRu}</div>}
      {platform.regulatoryNote && <div className="lbc-reg-note">{platform.regulatoryNote}</div>}
      {platform.sourcePage && (
        <a className="lbc-source-link header-source" href={platform.sourcePage} target="_blank" rel="noreferrer">
          основной источник ↗
        </a>
      )}
    </section>
  );
}

export default function LbcWorkflowApp() {
  const [query, setQuery] = useState('');
  const [onlyIntegrated, setOnlyIntegrated] = useState(false);
  const [compact, setCompact] = useState(false);

  const platforms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return LBC_PLATFORMS.filter((platform) => {
      const matchesText =
        !normalized ||
        `${platform.vendor} ${platform.name} ${platform.family} ${platform.principle}`.toLowerCase().includes(normalized);
      const matchesStaining = !onlyIntegrated || platform.staining === 'integrated';
      return matchesText && matchesStaining;
    });
  }, [query, onlyIntegrated]);

  const autoStats = useMemo(() => {
    const stages = platforms.flatMap((platform) => platform.stages);
    const auto = stages.filter((stage) => stage.automation === 'automatic').length;
    const mixed = stages.filter((stage) => stage.automation === 'mixed').length;
    const manual = stages.filter((stage) => stage.automation === 'manual').length;
    return { auto, mixed, manual, total: stages.length };
  }, [platforms]);

  const columnWidth = compact ? 286 : 344;
  const phaseWidth = compact ? 132 : 172;
  const gridTemplateColumns = `${phaseWidth}px repeat(${platforms.length}, ${columnWidth}px)`;

  return (
    <div className={`lbc-app ${compact ? 'compact' : ''}`}>
      <style>{`
        :root { color-scheme: light; }
        body { margin: 0; }
        .lbc-app {
          min-height: 100vh;
          background: #F8FAFC;
          color: #0F172A;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .lbc-topbar {
          position: sticky; top: 0; z-index: 50;
          background: rgba(248,250,252,.95); backdrop-filter: blur(14px);
          border-bottom: 1px solid #E2E8F0;
          padding: 14px 22px;
        }
        .lbc-topbar-inner { max-width: 1800px; margin: 0 auto; display: flex; gap: 18px; align-items: center; justify-content: space-between; }
        .lbc-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .lbc-brand-mark { width: 38px; height: 38px; border-radius: 12px; background: #0F172A; color: white; display: grid; place-items: center; font-weight: 800; letter-spacing: -.04em; }
        .lbc-brand-text { min-width: 0; }
        .lbc-brand-text b { display: block; font-size: 14px; }
        .lbc-brand-text span { display: block; color: #64748B; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lbc-back { border: 1px solid #CBD5E1; background: white; border-radius: 10px; padding: 8px 11px; color: #334155; cursor: pointer; font: inherit; font-size: 12px; }
        .lbc-hero { max-width: 1800px; margin: 0 auto; padding: 34px 22px 18px; }
        .lbc-eyebrow { color: #475569; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 800; }
        .lbc-hero h1 { margin: 7px 0 10px; font-size: clamp(28px,4vw,48px); line-height: 1.02; letter-spacing: -.045em; max-width: 1150px; }
        .lbc-hero > p { color: #475569; line-height: 1.65; max-width: 1050px; margin: 0; }
        .lbc-notice { margin-top: 17px; padding: 13px 15px; max-width: 1180px; border: 1px solid #CBD5E1; background: white; border-radius: 12px; color: #475569; font-size: 13px; line-height: 1.55; }
        .lbc-notice strong { color: #0F172A; }
        .lbc-controls { max-width: 1800px; margin: 0 auto; padding: 10px 22px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .lbc-search { min-width: 280px; flex: 1 1 360px; max-width: 560px; border: 1px solid #CBD5E1; border-radius: 10px; padding: 10px 12px; background: white; color: #0F172A; outline: none; font: inherit; }
        .lbc-search:focus { border-color: #64748B; box-shadow: 0 0 0 3px rgba(100,116,139,.12); }
        .lbc-toggle { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #CBD5E1; background: white; border-radius: 10px; padding: 9px 11px; font-size: 12px; color: #334155; cursor: pointer; user-select: none; }
        .lbc-toggle input { accent-color: #0F172A; }
        .lbc-stat { margin-left: auto; font-size: 12px; color: #64748B; }
        .lbc-legend { max-width: 1800px; margin: 0 auto; padding: 0 22px 22px; display: flex; flex-wrap: wrap; gap: 8px; }
        .lbc-legend-item { display: inline-flex; align-items: center; gap: 7px; font-size: 11px; color: #475569; background: white; border: 1px solid #E2E8F0; border-radius: 999px; padding: 6px 9px; }
        .lbc-legend-dot { width: 8px; height: 8px; border-radius: 999px; }
        .lbc-board-shell { overflow-x: auto; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; background: #F1F5F9; padding: 18px 0 30px; }
        .lbc-board { display: grid; width: max-content; min-width: 100%; gap: 10px; padding: 0 20px; align-items: stretch; }
        .lbc-corner { position: sticky; left: 20px; z-index: 20; min-height: 420px; background: linear-gradient(180deg,#0F172A,#1E293B); border-radius: 16px; padding: 18px 14px; color: white; box-shadow: 0 8px 24px rgba(15,23,42,.12); }
        .lbc-corner b { display:block; font-size: 14px; margin-bottom: 8px; }
        .lbc-corner p { margin: 0; color: #CBD5E1; font-size: 11px; line-height: 1.55; }
        .lbc-platform-header { min-height: 420px; background: white; border: 1px solid #E2E8F0; border-radius: 16px; padding: 13px; box-shadow: 0 4px 14px rgba(15,23,42,.05); overflow: hidden; }
        .lbc-platform-image-wrap, .lbc-image-placeholder { height: 112px; border-radius: 11px; overflow: hidden; background: #F1F5F9; margin-bottom: 12px; position: relative; display: grid; place-items: center; }
        .lbc-platform-image { width: 100%; height: 100%; object-fit: contain; background: white; }
        .lbc-image-fallback { display:none; color:#94A3B8; font-size:10px; text-align:center; padding:10px; }
        .lbc-image-failed .lbc-image-fallback { display:block; }
        .lbc-machine-glyph { width: 70px; height: 54px; border: 2px solid #94A3B8; border-radius: 9px; display: grid; grid-template-columns: repeat(3,1fr); gap: 5px; padding: 8px; }
        .lbc-machine-glyph span { background: #CBD5E1; border-radius: 4px; }
        .lbc-image-placeholder small { color:#94A3B8; font-size:9px; margin-top:-16px; }
        .lbc-vendor { font-size: 10px; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
        .lbc-platform-header h2 { margin: 4px 0 8px; font-size: 20px; letter-spacing: -.035em; line-height: 1.08; }
        .lbc-principle { margin: 0 0 11px; color: #475569; font-size: 11px; line-height: 1.45; min-height: 48px; }
        .lbc-kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin: 10px 0; }
        .lbc-kpi-grid > div { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 9px; padding: 8px; }
        .lbc-kpi-grid span { display:block; color:#64748B; font-size:9px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
        .lbc-kpi-grid b { display:block; font-size:10px; line-height:1.35; }
        .lbc-stain-badge { display:inline-block; font-size:10px; font-weight:800; border-radius:999px; padding:5px 8px; margin: 2px 0 8px; }
        .lbc-stain-badge.integrated { color:#047857; background:#D1FAE5; }
        .lbc-stain-badge.external { color:#0E7490; background:#CFFAFE; }
        .lbc-stain-badge.optional { color:#7C3AED; background:#EDE9FE; }
        .lbc-registration { font-size: 10px; line-height:1.35; color:#334155; margin-top:4px; }
        .lbc-reg-note { font-size: 9px; line-height:1.35; color:#64748B; margin-top:5px; }
        .lbc-phase-cell { position: sticky; left: 20px; z-index: 15; background: #E2E8F0; border:1px solid #CBD5E1; border-radius: 12px; padding: 13px 11px; min-height: 230px; }
        .lbc-phase-number { display:block; font-size: 28px; font-weight:900; color:#94A3B8; letter-spacing:-.05em; }
        .lbc-phase-title { display:block; font-size:12px; font-weight:800; line-height:1.25; margin-top:5px; }
        .lbc-stage-slot { min-height: 230px; position: relative; padding-bottom: 20px; }
        .lbc-stage-card { height: calc(100% - 20px); box-sizing:border-box; background:white; border:1px solid #E2E8F0; border-top:4px solid; border-radius:12px; padding:12px; box-shadow:0 2px 8px rgba(15,23,42,.04); }
        .lbc-stage-meta { display:flex; align-items:center; justify-content:space-between; gap:7px; margin-bottom:8px; }
        .lbc-status-pill { display:inline-flex; align-items:center; gap:5px; font-size:9px; font-weight:900; border:1px solid; border-radius:999px; padding:3px 6px; letter-spacing:.04em; white-space:nowrap; }
        .lbc-status-dot { width:6px; height:6px; border-radius:50%; }
        .lbc-evidence-pill { font-size:8px; font-weight:700; text-align:right; }
        .lbc-stage-card h3 { margin:0 0 6px; font-size:14px; line-height:1.2; letter-spacing:-.02em; }
        .lbc-time { font-size:10px; font-weight:800; color:#0F172A; background:#F1F5F9; border-radius:7px; padding:5px 7px; margin-bottom:8px; }
        .lbc-stage-card p { margin:0; font-size:10px; line-height:1.5; color:#475569; }
        .lbc-details { margin-top:9px; border-top:1px dashed #CBD5E1; padding-top:7px; }
        .lbc-details summary { cursor:pointer; color:#334155; font-size:9px; font-weight:800; }
        .lbc-detail-row { display:grid; grid-template-columns:56px 1fr; gap:6px; margin-top:6px; font-size:9px; line-height:1.4; color:#475569; }
        .lbc-detail-row b { color:#0F172A; }
        .lbc-source-link { display:inline-block; margin-top:8px; color:#2563EB; font-size:9px; font-weight:700; text-decoration:none; }
        .lbc-source-link:hover { text-decoration:underline; }
        .header-source { margin-top:6px; }
        .lbc-flow-arrow { position:absolute; left:50%; bottom:0; height:22px; width:18px; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; }
        .lbc-flow-arrow span { display:block; width:2px; height:12px; opacity:.55; }
        .lbc-flow-arrow i { width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:6px solid; opacity:.7; }
        .lbc-footer { max-width:1800px; margin:0 auto; padding:26px 22px 50px; display:grid; grid-template-columns:2fr 1fr; gap:22px; }
        .lbc-footer-card { background:white; border:1px solid #E2E8F0; border-radius:14px; padding:17px; }
        .lbc-footer-card h3 { margin:0 0 8px; font-size:15px; }
        .lbc-footer-card p, .lbc-footer-card li { color:#475569; font-size:11px; line-height:1.55; }
        .lbc-footer-card ul { margin:8px 0 0; padding-left:17px; }
        .compact .lbc-platform-header { min-height: 380px; }
        .compact .lbc-stage-slot, .compact .lbc-phase-cell { min-height: 205px; }
        .compact .lbc-stage-card p { font-size:9px; }
        @media (max-width: 850px) {
          .lbc-topbar { padding:11px 12px; }
          .lbc-hero, .lbc-controls, .lbc-legend { padding-left:12px; padding-right:12px; }
          .lbc-stat { width:100%; margin-left:0; }
          .lbc-footer { grid-template-columns:1fr; padding-left:12px; padding-right:12px; }
          .lbc-board { padding-left:10px; }
          .lbc-corner, .lbc-phase-cell { left:10px; }
        }
      `}</style>

      <header className="lbc-topbar">
        <div className="lbc-topbar-inner">
          <div className="lbc-brand">
            <div className="lbc-brand-mark">AT</div>
            <div className="lbc-brand-text">
              <b>AutoTrace Lab · LBC Workflow Atlas</b>
              <span>Сравнение автоматизации приготовления и Pap-окраски</span>
            </div>
          </div>
          <button className="lbc-back" onClick={() => window.location.assign(window.location.pathname)}>
            ← в AutoTrace
          </button>
        </div>
      </header>

      <main>
        <section className="lbc-hero">
          <div className="lbc-eyebrow">Liquid-based cytology · сравнительная технологическая карта</div>
          <h1>От пришедшей в лабораторию виалы до готового окрашенного LBC-стекла</h1>
          <p>
            Платформы расположены рядом, а технологические фазы синхронизированы по строкам. Поэтому можно напрямую
            сравнить, где остаётся ручной труд, где работает фильтрация или density-gradient enrichment, кто формирует
            стекло автоматически и у каких систем Pap-окраска уже встроена в тот же контур.
          </p>
          <div className="lbc-notice">
            <strong>Как читать время:</strong> паспортное/официально опубликованное время показано как факт; batch throughput
            не пересчитывается искусственно во «время одного шага». Там, где производитель не раскрывает длительность
            внутренней операции, прямо написано «не опубликовано». Оценки accession/hands-on отмечены как лабораторные и не
            относятся к заявленным характеристикам прибора.
          </div>
        </section>

        <section className="lbc-controls" aria-label="Фильтры сравнительной схемы">
          <input
            className="lbc-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти платформу или принцип: ThinPrep, фильтрация, SurePath…"
          />
          <label className="lbc-toggle">
            <input type="checkbox" checked={onlyIntegrated} onChange={(event) => setOnlyIntegrated(event.target.checked)} />
            только со встроенной окраской
          </label>
          <label className="lbc-toggle">
            <input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} />
            компактный режим
          </label>
          <div className="lbc-stat">
            {platforms.length} платформ · {autoStats.auto} авто · {autoStats.mixed} смешанных · {autoStats.manual} ручных стадий
          </div>
        </section>

        <section className="lbc-legend" aria-label="Цветовая легенда">
          {statusOrder.map((status) => (
            <span className="lbc-legend-item" key={status}>
              <span className="lbc-legend-dot" style={{ background: LBC_AUTOMATION_COLORS[status] }} />
              {LBC_AUTOMATION_LABELS[status]}
            </span>
          ))}
        </section>

        <section className="lbc-board-shell">
          {platforms.length > 0 ? (
            <div className="lbc-board" style={{ gridTemplateColumns }}>
              <div className="lbc-corner">
                <b>Платформа →</b>
                <p>
                  Листайте вправо. Строки ниже — одинаковые укрупнённые технологические фазы. Цвет верхней полосы каждого
                  блока показывает степень автоматизации.
                </p>
              </div>
              {platforms.map((platform) => (
                <PlatformHeader key={platform.id} platform={platform} />
              ))}

              {LBC_PHASES.flatMap((phase, phaseIndex) => {
                const phaseCells: React.ReactNode[] = [
                  <div className="lbc-phase-cell" key={`phase-${phase.id}`}>
                    <span className="lbc-phase-number">{phase.short}</span>
                    <span className="lbc-phase-title">{phase.title}</span>
                  </div>,
                ];

                platforms.forEach((platform) => {
                  const stage = platform.stages.find((item) => item.phase === phase.id);
                  phaseCells.push(
                    stage ? (
                      <StageCard key={`${platform.id}-${phase.id}`} stage={stage} isLast={phaseIndex === LBC_PHASES.length - 1} />
                    ) : (
                      <div className="lbc-stage-slot" key={`${platform.id}-${phase.id}-empty`}>
                        <article className="lbc-stage-card" style={{ borderTopColor: '#CBD5E1' }}>
                          <h3>Нет отдельного этапа</h3>
                          <p>Функция объединена с соседней стадией или отсутствует в публичном описании платформы.</p>
                        </article>
                      </div>
                    ),
                  );
                });
                return phaseCells;
              })}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>По выбранным фильтрам платформы не найдены.</div>
          )}
        </section>

        <section className="lbc-footer">
          <div className="lbc-footer-card">
            <h3>Главное инженерное различие платформ</h3>
            <ul>
              <li><b>ThinPrep:</b> обратная связь через мембранную фильтрацию и последующий контактный перенос на стекло.</li>
              <li><b>SurePath / Totalys:</b> физическое клеточное обогащение через density reagent и центрифугирование до седиментации.</li>
              <li><b>EASYPREP / LTS / CytoReference:</b> разные степени интеграции центрифугирования, седиментации и staining в одном автомате.</li>
              <li><b>CellPrep / HURO PATH S / CellSlide:</b> фильтрационные схемы с высокой скоростью подготовки, но обычно с отдельной окраской.</li>
              <li><b>NOVAprep:</b> отдельная ветвь с differential/double decantation и роботизированным vial-to-slide workflow.</li>
            </ul>
          </div>
          <div className="lbc-footer-card">
            <h3>Граница этой схемы</h3>
            <p>
              Это технологический atlas для сравнения оборудования, а не замена IFU/SOP. Для валидации реального лабораторного
              процесса нужно использовать актуальную инструкцию именно той версии прибора, реагентов и staining protocol,
              которая зарегистрирована и введена в эксплуатацию в конкретной лаборатории.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
