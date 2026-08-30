import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

// Every route-level application is code-split. This is especially important for legacy
// regression views: keeping them accessible must not pull their storage adapters and old
// scheduler implementations into the initial production dependency graph.
const App = lazy(() => import('./App.tsx'));
const NativeProcessMathOverlay = lazy(() => import('./NativeProcessMathOverlay.tsx'));
const LbcWorkflowWorkbench = lazy(() => import('./LbcWorkflowWorkbench.tsx'));
const GenericProcessMathApp = lazy(() => import('./GenericProcessMathApp.tsx'));
const UniversalProcessMathApp = lazy(() => import('./UniversalProcessMathApp.tsx'));
const ProcessSimulationApp = lazy(() => import('./ProcessSimulationApp.tsx'));
const UniversalProcessSimulationApp = lazy(() => import('./UniversalProcessSimulationApp.tsx'));
const ProcessRiskApp = lazy(() => import('./ProcessRiskApp.tsx'));
const UniversalProcessRiskApp = lazy(() => import('./UniversalProcessRiskApp.tsx'));
const ProcessBatchApp = lazy(() => import('./ProcessBatchApp.tsx'));
const ProcessBatchRiskApp = lazy(() => import('./ProcessBatchRiskApp.tsx'));
const UniversalProcessBatchApp = lazy(() => import('./UniversalProcessBatchApp.tsx'));
const ProcessDigitalTwinApp = lazy(() => import('./ProcessDigitalTwinApp.tsx'));
const UniversalProcessDigitalTwinApp = lazy(() => import('./UniversalProcessDigitalTwinApp.tsx'));
const ProcessReliabilityApp = lazy(() => import('./ProcessReliabilityApp.tsx'));
const UniversalProcessReliabilityApp = lazy(() => import('./UniversalProcessReliabilityApp.tsx'));
const ProcessUnifiedTwinApp = lazy(() => import('./ProcessUnifiedTwinApp.tsx'));
const ProcessUnifiedOptimizerApp = lazy(() => import('./ProcessUnifiedOptimizerApp.tsx'));
const UniversalProcessOptimizerApp = lazy(() => import('./UniversalProcessOptimizerApp.tsx'));
const UniversalProcessLabApp = lazy(() => import('./UniversalProcessLabApp.tsx'));

const params = new URLSearchParams(window.location.search);
const view = params.get('view');
const hash = window.location.hash;
const route = (name: string) => view === name || hash === `#${name}`;

function RouteLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f8fb', color: '#64748b', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 }}>
      Loading AutoTrace…
    </div>
  );
}

function RoutedApp() {
  if (route('process-universal')) return <UniversalProcessLabApp />;
  if (route('process-unified-opt-legacy')) return <ProcessUnifiedOptimizerApp />;
  if (route('process-unified-opt')) return <UniversalProcessOptimizerApp />;
  if (route('process-unified-twin-legacy')) return <ProcessUnifiedTwinApp />;
  if (route('process-unified-twin')) return <UniversalProcessDigitalTwinApp />;
  if (route('process-reliability-legacy')) return <ProcessReliabilityApp />;
  if (route('process-reliability')) return <UniversalProcessReliabilityApp />;
  if (route('process-digital-twin-legacy')) return <ProcessDigitalTwinApp />;
  if (route('process-digital-twin')) return <UniversalProcessDigitalTwinApp />;
  if (route('process-batch-risk-legacy')) return <ProcessBatchRiskApp />;
  if (route('process-batch-legacy')) return <ProcessBatchApp />;
  if (route('process-batch-risk') || route('process-batch')) return <UniversalProcessBatchApp />;
  if (route('process-risk-legacy')) return <ProcessRiskApp />;
  if (route('process-risk')) return <UniversalProcessRiskApp />;
  if (route('process-sim-legacy')) return <ProcessSimulationApp />;
  if (route('process-sim')) return <UniversalProcessSimulationApp />;
  if (route('process-math-legacy')) return <GenericProcessMathApp />;
  if (route('process-math')) return <UniversalProcessMathApp />;
  if (route('lbc') || hash === '#lbc') return <LbcWorkflowWorkbench />;
  return <><App /><NativeProcessMathOverlay /></>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Suspense fallback={<RouteLoading />}>
        <RoutedApp />
      </Suspense>
    </ThemeProvider>
  </StrictMode>,
);
